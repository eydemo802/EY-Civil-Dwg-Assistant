const path = require("path");

const {
    parsePdfFile
} = require("./pdfParser");

const {
    detectGridCandidates
} = require("./grid/gridDetector");

async function run() {

    const pdfPath =
        path.join(
            __dirname,
            "../uploads/sample-grid.pdf"
        );

    const pdf =
        await parsePdfFile(
            pdfPath,
            "sample-grid.pdf"
        );

    const gridCandidates =
        detectGridCandidates(
            pdf.textItems
        );

    console.log(
        "GRID DETECTOR DIAGNOSTICS:"
    );

    console.log(
        JSON.stringify(
            gridCandidates.diagnostics,
            null,
            4
        )
    );

    console.log(
        "ALPHABET CANDIDATES:"
    );

    console.log(
        JSON.stringify(
            gridCandidates.alphaCandidates,
            null,
            4
        )
    );

    console.log(
        "NUMERIC CANDIDATES:"
    );

    console.log(
        JSON.stringify(
            gridCandidates.numericCandidates,
            null,
            4
        )
    );
}

run().catch(error => {

    console.error(
        "GRID DETECTOR TEST FAILED:"
    );

    console.error(error);

    process.exitCode = 1;
});