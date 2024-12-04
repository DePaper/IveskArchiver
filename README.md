# IveskArchiver
This script will download .pdf files of all digitized invoices of your companies that are marked as favorite. It will store them in the folder you provide as `outputpath`.
The following is the tree of folders the files will be placed in: `<outputpath>/Ivesk.lt/<myname>/YYYY-MM/<operation>/<filename>.pdf`.
* `myname` - company name that accountant is working with (a favorite company).
* `YYYY-MM` - year and month taken from document's date.
* `operation` - `Pirkimai` or `Pardavimai`.
* `filename` - combination of document date, document number, client name and document id.

The script will download all the documents it can and finish. It will remember where it left off and running the script again will download next batch of files, if they are available. If not, then it will do nothing.
The file, where the next page key is stored, is also saved in `<outputpath>/Ivesk.lt`. It should not be deleted. If it is deleted, the script will download all the files you have already downloaded again.

In case of failure, the script will not lose progress and resume where it left off the next time it is run.

# Requirements
* Node.js 20.x and up.
* Ivesk.lt API key. You can generate it here: [https://app.ivesk.lt/settings/general](https://app.ivesk.lt/settings/general).

## Usage
`node archiver.js <apikey> <outputpath>`
* `apikey` - API key to Ivesk.lt
* `outputpath` - folder where the files should be downloaded
