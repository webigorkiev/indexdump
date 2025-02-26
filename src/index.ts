import * as fs from "fs";
import * as path from "path";
import margv from "margv";
import mariadb from "mariadb";
import {stdout} from "process";
import {performance} from "perf_hooks";
import chalk from "chalk";
import archiver from "archiver";
import {PassThrough, Readable, Writable} from "stream";

(async() => {
    const start = performance.now();
    const argv = margv();

    // Show version
    const showVersion = argv.v || argv.version;

    if(showVersion) {
        stdout.write("indexdump: %VERSION%" + "\n");
        process.exit(0);
    }

    // Check arguments length
    if(argv.$.length < 3) {
        console.error("Error parse arguments. Use: -h<host> -P<port> <index> > dump.sql");
        process.exit(0);
    }

    // Help
    const showHelp = !!argv.help;

    if(showHelp) {
        const TAB3 = "\t\t\t";
        const TAB4 = "\t\t\t\t";
        const TAB5 = "\t\t\t\t\t";
        stdout.write(chalk.green("List of settings\n"));
        stdout.write(chalk.bold("-h/--host") + TAB4 + "host (default: 127.0.0.1)\n");
        stdout.write(chalk.bold("-P/--port") + TAB4 + "port (default: 9306)\n");
        stdout.write(chalk.bold("--dry-run") + TAB4 + "run in dry mode\n");
        stdout.write(chalk.bold("-ch/--chunk") + TAB4 + "chunk size for bulk inserts\n");
        stdout.write(chalk.bold("--add-drop-index\n--add-drop-table") + "\t\t\t" + "add DROP TABLE\n");
        stdout.write(chalk.bold("--add-locks") + TAB4 + "add LOCK\t" + chalk.red("not currently implemented in Manticore Search\n"));
        stdout.write(chalk.bold("--add-freeze") + TAB4 + "add FREEZE\n");
        stdout.write(chalk.bold("--to-index") + TAB4 + "rename to index in backup\t" + chalk.red("only for single index\n"));
        stdout.write(chalk.bold("--prefix") + TAB4 + "add prefix for all indexes\n");
        stdout.write(chalk.bold("--indexes test1\n--indexes test2\n--indexes=test1,test2") + "\t" + "indexes list for dump\n");
        stdout.write(chalk.bold("--all") + TAB5 + "all indexes\n");
        stdout.write(chalk.bold("--limit") + TAB5 + "add limit for all indexes, --limit=0 dump only structure\n");
        stdout.write(chalk.bold("--path") + TAB5 + "path from which the index will be restored (default: current)\n");
        stdout.write(chalk.bold("--data-dir") + TAB4 + "allow to set manticore data path\n");
        stdout.write(chalk.bold("--add-config") + TAB3 + "add manticore.json to dump\n");
        process.exit(0);
    }

    // Input args
    const host = (argv.$.find((v: string) => v.indexOf("-h") === 0) || "").replace("-h", "") || argv["h"] || argv["host"] || "127.0.01";
    const port = (argv.$.find((v: string) => v.indexOf("-P") === 0) || "").replace("-P", "") || argv["P"] || argv["port"] || 9306;
    const chunk = (argv.$.find((v: string) => v.indexOf("-ch") === 0) || "").replace("-ch", "") || argv["ch"] || argv["chunk"] || 1000;
    const dropTable = !!(argv['add-drop-index'] || argv['add-drop-table']);
    const addLocks = !!argv['add-locks'];
    const addFreeze = !!argv['add-freeze'];
    const toTable = argv['to-index'] || argv['to-table'];
    const toPrefix = argv['prefix'] || "";
    const tables = argv['indexes'] || argv['tables'];
    const isAll = argv['all']; // all - all tables or array of tables names
    const limit = argv['limit'] ? parseInt(argv['limit']) : argv['limit'];
    const filesPath = argv['path'] || path.resolve();
    const index = tables || argv.$.pop();
    const dryRun = !!argv['dry-run'];
    const dataDir = argv['data-dir'] || "";
    const addConfig = !!argv['add-config'];

    // Files that need to add to archive
    const filesToCopy = [] as {file: string, path: string}[]

    if(toTable && tables) {
        console.error("Error parse arguments. You can`t use to-table and tables together")
        process.exit(0);
    }

    dryRun && stdout.write(chalk.yellow("\n----- Start dry run -----\n"));
    const devNull = new Writable({
        write(chunk: any, encoding: BufferEncoding, callback: (error?: (Error | null)) => void) { setImmediate(callback); }
    });

    // Archiver
    const arch = archiver('tar', {gzip: true});
    !dryRun && arch.pipe(stdout);
    dryRun && arch.pipe(devNull);

    // Promisify stream
    const promisifyStream = (file: string, name: string) => {

        // Skip files without access
        if(!dryRun) {
            try {
                fs.accessSync(file, fs.constants.R_OK);
            } catch(e: any) {
                return;
            }
        }

        dryRun && stdout.write(`${file} => ./${name}`);
        return new Promise(resolve => {
            const entryListener = () => {
                arch.off("entry", entryListener);
                arch.off("error", errorListener);
                dryRun && stdout.write(chalk.green(" " + "done\n"));
                resolve(true);
            }
            const errorListener = () => {
                arch.off("entry", entryListener);
                arch.off("error", errorListener);
                dryRun && stdout.write(chalk.red(" " + "not accessible\n"));
                resolve(true);
            }
            arch
                .append(fs.createReadStream(file), {name})
                .on("entry", entryListener)
                .on("error", errorListener);

        });
    }

    // Create stream
    const createStream = (name: string): PassThrough => {
        dryRun && stdout.write(`./${name}\n`);
        const stream = new PassThrough();
        arch
            .append(stream, {name})

        return stream;
    }

    // helper for matching path
    const pathReplacer = async(strIndexCreate: string, pathToFile: string, index: string): Promise<string> => {
        for(const label of  ["exceptions","stopwords","wordforms"]) {
            const matches = strIndexCreate.match(RegExp(`${label}='([^']*)'`));
            const files =  (matches?.[1]?.split(/\s+/) || []).filter((file) => /^([A-Z]:)?\//.test(file));

            if(files.length) {
                const newFiles = files.map((file) => path.resolve(pathToFile, `./${path.basename(file)}`));
                const newFilesString = newFiles.join(' ');
                strIndexCreate = strIndexCreate.replace(matches![0], `${label}='${newFilesString}'`);
                files.map((file) => filesToCopy.push({file, path: path.join(index, path.basename(file))}));
            }
        }

        return strIndexCreate;
    }

    // connection
    const conn = await mariadb.createConnection({host, port});

    // Dump index
    const dumpTable = async(
        index: string,
        output: PassThrough
    ) => {
        const toIndex = toTable ? `${toPrefix}${toTable}` : `${toPrefix}${index}`;

        // helpers
        const startChunk = (cols: string[]) => output.write(`INSERT INTO ${toIndex} (${cols.join(",")}) VALUES`);
        const endChunk = (rows: string[]) => output.write(`${rows.join(",\n")};\n`);

        output.write(`-- START DUMP ${index} --\n`);
        toIndex !== (index || toPrefix) && output.write(`-- WITH TABLE NAME CHANGE TO ${toIndex} --\n`);

        // Add drop table
        if(dropTable) {
            output.write(`DROP TABLE IF EXISTS ${toIndex};\n`);
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
                    output.write(`-- WARNING: field ${row['Field']} NOT stored, so not included in output --\n`);
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
        createTableFiltered = await pathReplacer(createTableFiltered, path.resolve(filesPath, `./${toIndex}`), toIndex);
        output.write(createTableFiltered + ";\n");

        if(limit !== 0) {
            // Data
            let count = 0, lastId = 0, next = true;

            while(next) {
                let i = 0, rows = [] as string[];
                addLocks && await conn.query(`LOCK TABLES ${index} WRITE;`); // LOCK TABLES `estok_categories` WRITE;
                addFreeze && await conn.query(`FREEZE ${index};`);
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
                            addFreeze && await conn.query(`UNFREEZE ${index};`);
                            addLocks && await conn.query(`UNLOCK TABLES;`); // UNLOCK TABLES;
                            resolve(true);
                        })
                })
            }

            output.write(`-- COUNT: ${count} --\n`);
        }

        // End rows
        output.write(`-- END DUMP ${index} --\n`);
    }

    // Tables to Dump
    let tablesList = [index];

    if(tables) {
        if(Array.isArray(tables)) {
            tablesList = tables;
        } else {
            tablesList = tables.split(",");
        }
    }

    // All indexes
    if(isAll) {
        tablesList = (await conn.query(`SHOW TABLES;`))
            .map((row: {Index: string}) => row['Index'])
    }

    // Create stream
    const stream = createStream("dump.sql");

    // Dump
    for(const current of tablesList) {
        dryRun && stdout.write(`${current}`);
        await dumpTable(current, stream);
        dryRun && stdout.write(chalk.green(" " + "done\n"));
    }
    stream.write(`\n`);
    const interval = Math.round((performance.now() - start) / 10) / 100;
    stream.write(`-- TIME: ${interval}s --\n`);
    stream.end();

    await new Promise(resolve => setTimeout(resolve, 100));

    // files
    for(const {file, path} of filesToCopy) {
        await promisifyStream(file, path);
    }

    // manticore.json
    if((isAll || addConfig) && filesToCopy.length) {
        // try to find manticore.json
        const base = dataDir || path.dirname(filesToCopy[0].file);
        if(base) {
            const manticoreJson = path.join(base, "..", "manticore.json");

            try {
                dryRun && stdout.write(chalk.green(`manticore.json\n`))
                await promisifyStream(manticoreJson, path.basename(manticoreJson));
            } catch(e) {}
        }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    dryRun && stdout.write(`\n`);
    dryRun && stdout.write(`TIME: ${interval}s\n`);

    // End process
    await arch.finalize();
    await conn.end();

    dryRun && stdout.write(chalk.yellow("----- End dry run -----\n\n"));
})();