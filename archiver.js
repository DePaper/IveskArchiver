const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

async function fetchFile(url, outputPath) {
    const resp = await fetch(url, { method: 'GET' });
    const file = Buffer.from(await resp.arrayBuffer());
    return fs.writeFile(outputPath, file);
}

async function getLastPageFile(filename) {
    try {
        const result = await fs.readFile(filename, 'utf-8');
        return JSON.parse(result);
    } catch {
        return null;
    }
}

async function main() {
    if (!config.apikey) { throw new Error('"config.apikey" is required'); }
    if (!config.outputpath) { throw new Error('"config.outputpath" is required'); }

    const lastPageFileName = `${config.apikey.substring(0, 36)}.json`;
    const lastPageFile = await getLastPageFile(path.join(config.outputpath, lastPageFileName));

    const options = {
        method: 'GET',
        headers: { 'x-api-key': config.apikey },
    };

    const url = new URL('https://stagingapp.ivesk.lt/api/pub/digitized');
    if (lastPageFile?.next) { url.searchParams.append('from', lastPageFile.next); }

    let data = null;
    let page = 1;
    do {
        console.log(`Page: `, page);

        const resp = await fetch(url, options);
        data = await resp.json();

        const promises = data.documents.map(doc => fetchFile(doc.url, path.join(config.outputpath, doc.id)));
        await Promise.all(promises);

        if (data.next) {
            await fs.writeFile(path.join(config.outputpath, lastPageFileName), JSON.stringify({ next: data.next }));
        }

        ++page;
        url.searchParams.append('from', data.next);
    } while (data.next);
}

main();