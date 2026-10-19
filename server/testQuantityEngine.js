const {
    calculateQuantity
} = require("./engine/quantityEngine");

const result =
    calculateQuantity(
        "Solid Cylinder - Raft - Dia 28000 x Depth 3500"
    );

console.log(
    JSON.stringify(
        result,
        null,
        4
    )
);