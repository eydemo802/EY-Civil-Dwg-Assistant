const {
    executeFormula
} = require("./engine/formulaEngine");

const dimensions = {

    radius: {
        value: 14,
        unit: "m"
    },

    height: {
        value: 3.5,
        unit: "m"
    }
};

const volumeFormula =
    "PI*radius^2*height";

const areaFormula =
    "2*PI*radius*height";

console.log(
    "Volume:",
    executeFormula(
        volumeFormula,
        dimensions
    )
);

console.log(
    "Area:",
    executeFormula(
        areaFormula,
        dimensions
    )
);