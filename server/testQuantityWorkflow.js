const path = require("path");

const {
    runQuantityWorkflow
} = require("./QuantityWorkflow");

async function run() {

    const result =
        await runQuantityWorkflow(
            path.join(
                __dirname,
                "../uploads/sample.pdf"
            ),
            "sample.pdf"
        );

    console.log(
        JSON.stringify(
            result.summary || {},
            null,
            4
        )
    );

    console.log(
        "Excel:",
        result.excelFile
    );
}

run();