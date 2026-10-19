const { loadShapeMaster } = require("../config/excelMasterLoader");

const masterData = loadShapeMaster();

function normalizeDimensions(parsedDimensions) {

    const normalized = {};

    for (const [inputDimension, dimensionData] of Object.entries(parsedDimensions)) {

        const aliasDefinition =
            masterData.dimensionAliases[
                inputDimension.toLowerCase()
            ];

        //-----------------------------------
        // Alias not found
        //-----------------------------------

        if (!aliasDefinition) {

            normalized[inputDimension] = {
                ...dimensionData,
                source: inputDimension,
                transformation: "unknown"
            };

            continue;
        }

        let value = dimensionData.value;

        //-----------------------------------
        // Transformation
        //-----------------------------------

        switch (
            aliasDefinition.transformation
        ) {

            case "divideBy2":

                value = value / 2;
                break;

            case "direct":

                value = value;
                break;

            default:

                value = value;
                break;
        }

        //-----------------------------------
        // Store result
        //-----------------------------------

        normalized[
            aliasDefinition.standardDimension
        ] = {

            value,

            unit: dimensionData.unit,

            source: inputDimension,

            transformation:
                aliasDefinition.transformation
        };
    }
    console.log(
    "================================"
);

console.log(
    "PARSED DIMENSIONS:"
);

console.log(
    JSON.stringify(
        parsedDimensions,
        null,
        2
    )
);

console.log(
    "NORMALIZED DIMENSIONS:"
);

console.log(
    JSON.stringify(
        normalized,
        null,
        2
    )
);

console.log(
    "================================"
);

    return normalized;
}

module.exports = {
    normalizeDimensions
};