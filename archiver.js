const fs = require('fs').promises;
const path = require('path');

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

function printUsage() {
    console.log('Usage: node archiver.js <apikey> <outputpath>');
}

async function main() {
    const args = process.argv.slice(2);
    const apikey = args[0];
    const outputpath = args[1];

    if (!apikey) {
        console.error('"apiKey" is required.');
        printUsage();
        return;
    }

    if (!outputpath) {
        console.error('"outputPath" is required.');
        printUsage();
        return;
    }

    const lastPageFileName = `${apikey.substring(0, 36)}.json`;
    const lastPageFilePath = path.join(outputpath, lastPageFileName);
    const lastPageFile = await getLastPageFile(lastPageFilePath);

    const options = {
        method: 'GET',
        headers: { 'x-api-key': apikey },
    };

    const url = new URL('https://stagingapp.ivesk.lt/api/pub/digitized');
    if (lastPageFile?.next) { url.searchParams.append('from', lastPageFile.next); }

    let data = null;
    let page = 1;
    do {
        console.log(`Page: `, page);

        const resp = await fetch(url, options);
        data = await resp.json();

        const promises = data.documents.map(doc => fetchFile(doc.url, path.join(outputpath, doc.id)));
        await Promise.all(promises);

        if (data.next) {
            await fs.writeFile(lastPageFilePath, JSON.stringify({ next: data.next }));
        }

        ++page;
        url.searchParams.append('from', data.next);
    } while (data.next);
}

main();