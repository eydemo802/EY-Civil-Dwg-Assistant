// server/config/shapeMatcher.js

const { loadShapeMaster } = require("./excelMasterLoader");

const masterData = loadShapeMaster();

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function matchShape(shapeText) {

    const normalizedShape =
        normalizeText(shapeText);

    //------------------------------------
    // EXACT / ALIAS MATCH
    //------------------------------------

    const shapeId =
        masterData.shapeAliases[
            normalizedShape
        ];

    if (!shapeId) {

        return {
            found: false,

            inputShape:
                shapeText,

            matchType:
                "none",

            matchScore:
                0,

            shape: null
        };
    }

    const matchedShape =
        masterData.shapes[
            shapeId
        ];

    return {

        found: true,

        inputShape:
            shapeText,

        matchType:
            "exact",

        matchScore:
            100,

        shape: matchedShape
    };
}

module.exports = {
    matchShape
};