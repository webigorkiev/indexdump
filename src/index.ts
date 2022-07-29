import margv from "margv";
import mariadb from "mariadb";
import {stdout} from "process";
import {performance} from "perf_hooks";

(async() => {
    const start = performance.now();
    const argv = margv();
    const host = (argv.$.find((v: string) => v.indexOf("-h") === 0) || "").replace("-h", "") || argv["h"] || argv["host"] || "127.0.01";
    const port = (argv.$.find((v: string) => v.indexOf("-P") === 0) || "").replace("-P", "") || argv["P"] || argv["port"] || 9306;
    const chunk = (argv.$.find((v: string) => v.indexOf("-ch") === 0) || "").replace("-ch", "") || argv["ch"] || argv["chunk"] || 1000;
    const index = argv.$.pop();

    const startChunk = (cols: string[]) => stdout.write(`INSERT INTO ${index} (${cols.join(",")}) VALUES`);
    const endChunk = (rows: string[]) => stdout.write(`${rows.join(",")};\n`);

    if(argv.$.length <= 1) {
        console.error("Error parse arguments. Use: -h<host> -P<port> <index> > dump.sql")
        process.exit(0);
    }
    const conn = await mariadb.createConnection({host, port});

    stdout.write(`-- START DUMP ${index} --\n`);

    // Create tables
    stdout.write((await conn.query(`SHOW CREATE TABLE ${index};`))[0]['Create Table'] + ";\n");

    // Select types
    const types = (await conn.query(`DESCRIBE ${index};`))
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

    // Data
    let count = 0, lastId = 0, next = true;

    while(next) {
        let i = 0, rows = [] as string[];
        await new Promise(resolve => conn.queryStream(`SELECT *
                          FROM ${index}
                          WHERE id > ${lastId}
                          ORDER BY id ASC
                          LIMIT ${chunk}
                          OPTION max_matches =
                          ${chunk};`)
            .on("error", err => {
                console.error(err);
                process.exit(0);
            })
            .on("data", (row) => {
                i === 0 && startChunk(Object.keys(row));
                rows.push(`(${Object.entries(row)
                    .map((
                        [key, value],
                        index
                    ) => types[key] === 'mva' ? `(${value})` : conn.escape(value)).join(',')})`);
                lastId = row['id'];
                i++;
                count++;
            })
            .on("end", async() => {
                if(!rows.length) {
                    next = false;
                } else {
                    endChunk(rows);
                }

                resolve(true);
            }));
    }

    // End rows
    const interval = Math.round((performance.now() - start) / 10) / 100;
    stdout.write(`-- END DUMP ${index} --\n`);
    stdout.write(`-- COUNT: ${count} --\n`);
    stdout.write(`-- TIME: ${interval}s --\n`);
    await conn.end();
})();