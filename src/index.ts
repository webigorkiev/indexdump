import * as fs from "fs";
import * as path from "path";
import margv from "margv";
import mariadb from "mariadb";
import {stdout} from "process";
import {performance} from "perf_hooks";

(async() => {
    const start = performance.now();
    const argv = margv();
    const showVersion = argv.v || argv.version;

    if(showVersion) {
        stdout.write("indexdump: %VERSION%" + "\n");
        process.exit(0);
    }

    // Check arguments length
    if(argv.$.length <= 1) {
        console.error("Error parse arguments. Use: -h<host> -P<port> <index> > dump.sql")
        process.exit(0);
    }

    const host = (argv.$.find((v: string) => v.indexOf("-h") === 0) || "").replace("-h", "") || argv["h"] || argv["host"] || "127.0.01";
    const port = (argv.$.find((v: string) => v.indexOf("-P") === 0) || "").replace("-P", "") || argv["P"] || argv["port"] || 9306;
    const chunk = (argv.$.find((v: string) => v.indexOf("-ch") === 0) || "").replace("-ch", "") || argv["ch"] || argv["chunk"] || 1000;
    const dropTable = !!(argv['add-drop-index'] || argv['add-drop-table']);
    const addLocks = !!argv['add-locks'];
    const toTable = argv['to-index'] || argv['to-table'];
    const toPrefix = argv['prefix'] || "";
    const tables = argv['indexes'] || argv['tables'];
    const all = argv['all']; // all - all tables or array of tables names
    const limit = argv['limit'] ? parseInt(argv['limit']) : argv['limit'];
    const filesPath = argv['path'] || path.resolve();
    const index = tables || argv.$.pop();

    if(toTable && tables) {
        console.error("Error parse arguments. You can`t use to-table and tables together")
        process.exit(0);
    }

    // helper for matching path
    const pathReplacer = (strIndexCreate: string, pathToFile: string): string => {
        ["exceptions","stopwords","wordforms"].forEach((label) => {
            const matches = strIndexCreate.match(RegExp(`${label}='([^']*)'`));
            const files =  (matches?.[1]?.split(/\s+/) || []).filter((file) => /^([A-Z]:)?\//.test(file));

            if(files.length) {
                const newFiles = files.map((file) => path.resolve(pathToFile, `./${path.basename(file)}`));
                const newFilesString = newFiles.join(' ');
                strIndexCreate = strIndexCreate.replace(matches![0], `${label}='${newFilesString}'`);

                for(let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const newFile = newFiles[i];
                    try {
                        fs.mkdirSync(path.dirname(newFile), {recursive: true});
                        fs.copyFileSync(file, newFile);
                    } catch(e: any) {
                        stdout.write(`-- ${e.message} --\n`);
                    }
                }
            }
        });

        return strIndexCreate;
    }

    // connection
    const conn = await mariadb.createConnection({host, port});

    const dumpTable = async(
        index: string
    ) => {
        const toIndex = toTable ? `${toPrefix}${toTable}` : `${toPrefix}${index}`;

        // helpers
        const startChunk = (cols: string[]) => stdout.write(`INSERT INTO ${toIndex} (${cols.join(",")}) VALUES`);
        const endChunk = (rows: string[]) => stdout.write(`${rows.join(",")};\n`);

        stdout.write(`-- START DUMP ${index} --\n`);
        toIndex !== (index || toPrefix) && stdout.write(`-- WITH TABLE NAME CHANGE TO ${toIndex} --\n`);

        // Add drop table
        if(dropTable) {
            stdout.write(`DROP TABLE IF EXISTS ${toIndex};\n`);
        }

        // Select types
        const describe = await conn.query(`DESCRIBE ${index};`) as { Field: string, Type: string, Properties: string }[];
        const types = describe
            .reduce((
                ac: Record<string, string>,
                row: { Field: string, Type: string, Properties: string }
            ) => {
                ac[row['Field']] = row['Type'];

                if(row['Type'] === 'text' && row['Properties'].indexOf('stored') === -1) {
                    stdout.write(`-- WARNING: field ${row['Field']} NOT stored, so not included in output --\n`);
                }

                return ac;
            }, {});

        // Real fields
        const allowsFields = describe
            .filter((row) => !['tokencount'].includes(row['Type']))
            .map((row) => row['Field'])
        const allFields = describe
            .map((row) => row['Field'])

        // Create tables
        const createTableString = (await conn.query(`SHOW CREATE TABLE ${index};`))[0]['Create Table']
            .replace(RegExp(`CREATE[\\s\\t]+TABLE[\\s\\t]+${index}`, 'i'), `CREATE TABLE ${toIndex}`);
        let createTableFiltered = createTableString.split(/\r?\n/)
            .filter((row: string) => !allFields.includes(row.split(/\s+/)[0]) || allowsFields.includes(row.split(/\s+/)[0]))
            .join("\n");
        createTableFiltered = pathReplacer(createTableFiltered, path.resolve(filesPath, `./${toIndex}`));
        stdout.write(createTableFiltered + ";\n");

        if(limit !== 0) {
            // Data
            let count = 0, lastId = 0, next = true;

            while(next) {
                let i = 0, rows = [] as string[];
                addLocks && await conn.query(`LOCK ${index};`);
                await new Promise(resolve => {
                    const stream = conn.queryStream(`SELECT *
                                                     FROM ${index}
                                                     WHERE id > ${lastId}
                                                     ORDER BY id ASC
                                                     LIMIT ${chunk}
                                                     OPTION max_matches =
                                                     ${chunk};`);
                    stream
                        .on("error", err => {
                            console.error(err);
                            process.exit(0);
                        })
                        .on("data", (row) => {

                            // Delete tokencount
                            Object.keys(row).forEach((key) => {
                                if(!allowsFields.includes(key)) {
                                    delete row[key];
                                }
                            });
                            i === 0 && startChunk(Object.keys(row));
                            if(!limit || count < limit) {
                                rows.push(`(${Object.entries(row)
                                    .map((
                                        [key, value]
                                    ) => types[key] === 'mva' ? `(${value})` : conn.escape(value)).join(',')})`);
                                lastId = row['id'];
                                i++;
                                count++;
                            }

                            // Limit
                            if(limit && limit === count) {
                                next = false;
                            }
                        })
                        .on("end", async() => {
                            if(!rows.length) {
                                next = false;
                            } else {
                                endChunk(rows);
                            }
                            addLocks && await conn.query(`UNLOCK ${index};`);
                            resolve(true);
                        })
                })
            }

            stdout.write(`-- COUNT: ${count} --\n`);
        }

        // End rows
        stdout.write(`-- END DUMP ${index} --\n`);
    }
    let tablesList = [index];

    if(tables) {
        if(Array.isArray(tables)) {
            tablesList = tables;
        } else {
            tablesList = tables.split(",");
        }
    }

    if(all) {
        tablesList = (await conn.query(`SHOW TABLES;`))
            .map((row: {Index: string}) => row['Index'])
    }

    // Dump
    for(const current of tablesList) {
        await dumpTable(current);
    }

    stdout.write(`\n`);
    const interval = Math.round((performance.now() - start) / 10) / 100;
    stdout.write(`-- TIME: ${interval}s --\n`);
    await conn.end();
})();