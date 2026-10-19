const { parsePdf } =
    require("./pdfParser");

async function run() {

    const result =
        await parsePdf(
            "./sample.pdf"
        );

    console.log(
        JSON.stringify(
            result.slice(0, 20),
            null,
            4
        )
    );
}

run();