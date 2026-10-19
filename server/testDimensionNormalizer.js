const {
    normalizeDimensions
} = require("./engine/dimensionNormalizer");

const parsedDimensions = {

    dia: {
        value: 28000,
        unit: "mm"
    },

    depth: {
        value: 3500,
        unit: "mm"
    }
};

const result =
    normalizeDimensions(
        parsedDimensions
    );

console.log(
    JSON.stringify(
        result,
        null,
        4
    )
);
