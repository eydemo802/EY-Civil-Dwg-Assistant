const {
    parseDimensions
} = require("./engine/dimensionParser");

console.log(
    JSON.stringify(
        parseDimensions(
            "Dia 28000 x Depth 3500"
        ),
        null,
        4
    )
);