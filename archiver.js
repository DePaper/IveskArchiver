const fs = require('fs').promises;
const path = require('path');

const API_URL = 'https://app.ivesk.lt/api/pub/digitized';

/**
 * @param {object} document 
 * @returns {string[]}
 */
function generateOutputStructure(document, outputpath) {
    // Might not work correcly if both companies are favorite.
    const myname = document.sellerisfavorite ? document.sellernameascii : document.buyernameascii; 
    const othername = document.sellerisfavorite ? document.buyernameascii : document.sellernameascii;
    const operation = document.sellerisfavorite ? 'Pardavimai' : 'Pirkimai';

    return [
        outputpath,
        'Ivesk.lt',
        myname,
        document.date.substring(0, 7),
        operation,
        `${document.date} ${document.docnum.replace(/\s/g, '').replace(/[<>:"?/\\|*]/g, '_')} ${othername} ${document.id}.pdf`,
    ];
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

    console.log(`Saving ${path.join(...structure)}`);
    const folders = path.join(...structure.slice(0, structure.length - 1));
    await fs.mkdir(folders, { recursive: true });
    return fs.writeFile(path.join(...structure), file);
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