#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Download PDF file from Ivesk.lt and save it in outpuPath
 * @param {object} document 
 * @param {string} outputPath 
 * @returns {Promise<void>}
 */
async function fetchFile(document, outputPath) {
    const resp = await fetch(document.url, { method: 'GET' });
    const file = Buffer.from(await resp.arrayBuffer());

    // clean up docnum so that would not break file name
    document.docnum = document.docnum.replace(/[<>:"?/\\|*]/g, '_');

    const filePaths = [];
    if (document.sellerisfavorite) {
        filePaths.push(path.join(outputPath, `${document.sellernameascii}/${document.date.substring(0, 7)}/Pardavimai/${document.date} ${document.docnum} ${document.buyernameascii}.pdf`));
    }
    if (document.buyerisfavorite) {
        filePaths.push(path.join(outputPath, `${document.buyernameascii}/${document.date.substring(0, 7)}/Pirkimai/${document.date} ${document.docnum} ${document.sellernameascii}.pdf`));
    }

    for (const filePath of filePaths) {
        console.log(`Saving ${filePath}`);
        const folder = path.dirname(filePath);
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(filePath, file);
    }

}

/**
 * @param {string} filename 
 * @returns {object | null}
 */
function getLastPageFile(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf-8'));
    } catch {
        return null;
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node archiver.js <apikey> <outputpath>');
        return 1;
    }
    const apikey = args[0];
    const outputpath = args[1];

    // Load the "marker" where sinchronization finished last time. Will resume from it.
    const lastPageFilePath = path.join(outputpath, `${apikey.substring(0, 36)}.json`);
    const fromMarker = getLastPageFile(lastPageFilePath);

    const url = new URL('https://app.ivesk.lt/api/pub/digitized');
    url.searchParams.append('doctype', 'invoice');
    if (fromMarker?.next) {
        url.searchParams.append('from', fromMarker.next);
    }

    let data = null;
    do {
        const resp = await fetch(url, {
            method: 'GET',
            headers: { 'x-api-key': apikey },
        });
        data = await resp.json();

        if (!resp.ok) {
            throw new Error(`Error fetching page: ${data.message}`);
        }

        // Not running this in parallel because there might be race conditions with mkdir. Running sequentially avoids that and it stil works pretty fast.
        const invoices = data.documents.filter(doc => (doc.sellerisfavorite || doc.buyerisfavorite));
        for (const invoice of invoices) {
            await fetchFile(invoice, outputpath);
        }

        if (data.next) {
            // save the "marker" where sinchronization finished, will resume from here next time
            fs.writeFileSync(lastPageFilePath, JSON.stringify({ next: data.next }));
        }

        url.searchParams.set('from', data.next);
    } while (data.next);
}

main();