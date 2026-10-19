const {
    convertDimensionsToMeters
} = require("./engine/unitConverter");

const normalizedDimensions = {

    radius: {
        value: 14000,
        unit: "mm",
        source: "dia",
        transformation: "divideBy2"
    },

    height: {
        value: 3500,
        unit: "mm",
        source: "depth",
        transformation: "direct"
    }
};

const result =
    convertDimensionsToMeters(
        normalizedDimensions
    );

console.log(
    JSON.stringify(
        result,
        null,
        4
    )
);