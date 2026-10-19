const {
    calculateQuantities
} = require(
    "./engine/batchQuantityEngine"
);

const {
    generateWorkbook
} = require(
    "./excelGenerator"
);

async function run() {

    const annotations = [

        "Solid Cylinder - Raft - Dia 28000 x Depth 3500",

        "Cuboid - Pedestal - Length 5000 x Width 3000 x Height 2000",

        "Wrong Shape - Test - Dia 5000"
    ];

    const batchResult =
        calculateQuantities(
            annotations
        );

    const file =
        await generateWorkbook(
            batchResult,
            annotations
        );

    console.log(
        "Created:",
        file
    );
}

run();