const path = require("path");
const XLSX = require("xlsx");

const MASTER_FILE = path.join(
    __dirname,
    "Shape_Formula_Master_V2.xlsx"
);

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function splitAndClean(value, separator = ",") {
    return String(value || "")
        .split(separator)
        .map(valueItem => valueItem.trim())
        .filter(Boolean);
}

function toNumber(value, fallback = 0) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue)
        ? numericValue
        : fallback;
}

//--------------------------------------------------
// CACHE
//--------------------------------------------------

let cachedMaster = null;

//--------------------------------------------------
// MASTER LOADER
//--------------------------------------------------

function loadShapeMaster() {
    if (cachedMaster) {
        return cachedMaster;
    }

    const workbook = XLSX.readFile(
        MASTER_FILE
    );

    if (!workbook.Sheets["ShapeMaster"]) {
        throw new Error(
            "ShapeMaster sheet not found"
        );
    }

    if (!workbook.Sheets["DimensionAliases"]) {
        throw new Error(
            "DimensionAliases sheet not found"
        );
    }

    if (!workbook.Sheets["ShutteringRules"]) {
        throw new Error(
            "ShutteringRules sheet not found"
        );
    }

    //-----------------------------------
    // LOAD SHAPES
    //-----------------------------------

    const shapeRows =
        XLSX.utils.sheet_to_json(
            workbook.Sheets["ShapeMaster"],
            {
                defval: ""
            }
        );

    const shapes = {};
    const shapeAliases = {};

    for (const row of shapeRows) {
        const shapeId =
            row["Shape ID"];

        if (!shapeId) {
            continue;
        }

        const standardShape =
            row["Standard Shape"];

        const acceptedNames =
            splitAndClean(
                row["Accepted Names"]
            );

        const requiredDimensions =
            splitAndClean(
                row["Required Dimensions"]
            );

        const enabled =
            normalizeText(
                row["Enabled"]
            );

        const shutteringEnabled =
            normalizeText(
                row["Shuttering Enabled"]
            );

        const shapeObject = {
            shapeId,
            standardShape,
            acceptedNames,
            requiredDimensions,

            volumeFormula:
                row["Volume Formula"],

            areaFormula:
                row["Area Formula"],

            formulaAreaType:
                row["Formula Area Type"],

            defaultUnit:
                row["Default Unit"],

            enabled,

            reviewRequired:
                enabled === "review",

            //-----------------------------------
            // SHUTTERING FORMULAS
            //-----------------------------------

            sideFaceFormula:
                row["Side Face Formula"],

            topFaceFormula:
                row["Top Face Formula"],

            bottomFaceFormula:
                row["Bottom Face Formula"],

            outerSideFormula:
                row["Outer Side Formula"],

            innerSideFormula:
                row["Inner Side Formula"],

            defaultShutteringRule:
                row["Default Shuttering Rule"],

            shutteringEnabled,

            shutteringReviewRequired:
                shutteringEnabled === "review"
        };

        shapes[shapeId] =
            shapeObject;

        shapeAliases[
            normalizeText(
                standardShape
            )
        ] = shapeId;

        acceptedNames.forEach(alias => {
            shapeAliases[
                normalizeText(alias)
            ] = shapeId;
        });
    }

    //-----------------------------------
    // LOAD DIMENSION ALIASES
    //-----------------------------------

    const aliasRows =
        XLSX.utils.sheet_to_json(
            workbook.Sheets["DimensionAliases"],
            {
                defval: ""
            }
        );

    const dimensionAliases = {};
    const duplicateAliases =
        new Set();

    for (const row of aliasRows) {
        const aliases =
            splitAndClean(
                row["Input Annotation(s)"]
            );

        const standardDimension =
            row["Standard Dimension"];

        const transformation =
            row["Transformation"];

        aliases.forEach(alias => {
            const key =
                normalizeText(alias);

            if (dimensionAliases[key]) {
                duplicateAliases.add(
                    key
                );
                return;
            }

            dimensionAliases[key] = {
                standardDimension,
                transformation,
                notes:
                    row["Notes"]
            };
        });
    }

    if (duplicateAliases.size > 0) {
        console.warn(
            "Duplicate Aliases Found:",
            [...duplicateAliases]
        );
    }

    //-----------------------------------
    // LOAD SHUTTERING RULES
    //-----------------------------------

    const shutteringRuleRows =
        XLSX.utils.sheet_to_json(
            workbook.Sheets["ShutteringRules"],
            {
                defval: ""
            }
        );

    const shutteringRules =
        shutteringRuleRows
            .map(row => {
                return {
                    priority:
                        toNumber(
                            row["Rule Priority"],
                            9999
                        ),

                    ruleName:
                        String(
                            row["Rule Name"] ||
                            "Unnamed shuttering rule"
                        ).trim(),

                    concreteCategory:
                        normalizeText(
                            row["Concrete Category"] ||
                            "*"
                        ),

                    referenceElementPattern:
                        normalizeText(
                            row["Reference Element Pattern"] ||
                            "*"
                        ),

                    shapePattern:
                        normalizeText(
                            row["Shape Pattern"] ||
                            "*"
                        ),

                    includedFaceComponents:
                        splitAndClean(
                            row["Included Face Components"]
                        ).map(component =>
                            component.toUpperCase()
                        ),

                    excludedFaceComponents:
                        splitAndClean(
                            row["Excluded Face Components"]
                        ).map(component =>
                            component.toUpperCase()
                        ),

                    calculationMode:
                        String(
                            row["Calculation Mode"] ||
                            "SUM_INCLUDED"
                        )
                            .trim()
                            .toUpperCase(),

                    enabled:
                        normalizeText(
                            row["Enabled"]
                        ),

                    notes:
                        row["Notes"]
                };
            })
            .filter(rule =>
                rule.enabled === "yes"
            )
            .sort((left, right) =>
                left.priority -
                right.priority
            );

    cachedMaster = {
        shapes,
        shapeAliases,
        dimensionAliases,
        shutteringRules
    };

    return cachedMaster;
}

function clearShapeMasterCache() {
    cachedMaster = null;
}

module.exports = {
    loadShapeMaster,
    clearShapeMasterCache
};
