const fs = require('fs').promises;
const path = require('path');

const API_URL = 'https://app.ivesk.lt/api/pub/digitized';

function generatePath(outputpath, operation, myname, othername, date, docnum, id) {
    return [
        outputpath,
        'Ivesk.lt',
        myname,
        date.substring(0, 7),
        operation,
        `${date} ${docnum.replace(/\s/g, '').replace(/[<>:"?/\\|*]/g, '_')} ${othername} ${id}.pdf`,
    ];
}

/**
 * @param {object} document 
 * @returns {string[]}
 */
function generateOutputStructure(document, outputpath) {
    const result = [];

    if (document.sellerisfavorite) {
        result.push(generatePath(outputpath, 'Pardavimai', document.sellernameascii, document.buyernameascii, document.date, document.docnum, document.id));
    }
    if (document.buyerisfavorite) {
        result.push(generatePath(outputpath, 'Pirkimai', document.buyernameascii, document.sellernameascii, document.date, document.docnum, document.id));
    }

    return result;
}

/**
 * 
 * @param {object} document 
 * @param {string} outputPath 
 * @returns {Promise<void>}
 */
async function fetchFile(document, outputPath) {
    const resp = await fetch(document.url, { method: 'GET' });
    const file = Buffer.from(await resp.arrayBuffer());

    const structure = generateOutputStructure(document, outputPath);
    for (const item of structure) {
        console.log(`Saving ${path.join(...item)}`);
        const folders = path.join(...item.slice(0, item.length - 1));
        await fs.mkdir(folders, { recursive: true });
        await fs.writeFile(path.join(...item), file);
    }

}

/**
 * @param {string} filename 
 * @returns {object | null}
 */
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
    // Save the "next" page marker in the same output folder where the files will be saved.
    const lastPageFilePath = path.join(outputpath, 'Ivesk.lt', lastPageFileName); 
    const lastPageFile = await getLastPageFile(lastPageFilePath);

    const options = {
        method: 'GET',
        headers: { 'x-api-key': apikey },
    };

    const url = new URL(API_URL);
    if (lastPageFile?.next) { url.searchParams.append('from', lastPageFile.next); }

    let data = null;
    do {
        const resp = await fetch(url, options);
        data = await resp.json();

        if (!resp.ok) {
            throw new Error(`Error fetching page: ${data.message}`);
        }

        // Not running this in parallel because there might be race conditions with mkdir. Running sequentially avoids that and it stil works pretty fast.
        const invoices = data.documents .filter(doc => doc.doctype === 'invoice' && (doc.sellerisfavorite || doc.buyerisfavorite));
        for (const invoice of invoices) {
            await fetchFile(invoice, outputpath);
        }

        if (data.next) {
            await fs.writeFile(lastPageFilePath, JSON.stringify({ next: data.next }));
        }

        url.searchParams.set('from', data.next);
    } while (data.next);
}

main();