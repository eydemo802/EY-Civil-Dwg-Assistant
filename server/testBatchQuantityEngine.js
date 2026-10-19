const {
    calculateQuantities
} = require("./engine/batchQuantityEngine");

const annotations = [

    "Solid Cylinder - Raft - Dia 28000 x Depth 3500",

    "Cuboid - Pedestal - Length 5000 x Width 3000 x Height 2000",

    "Wrong Shape - Test - Dia 5000"
];

const result =
    calculateQuantities(
        annotations
    );

console.log(
    JSON.stringify(
        result,
        null,
        4
    )
);