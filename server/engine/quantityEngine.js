const {
    parseAnnotation
} = require("../parser/annotationParser");

const {
    matchShape
} = require("../config/shapeMatcher");

const {
    loadShapeMaster
} = require("../config/excelMasterLoader");

const {
    parseDimensions
} = require("./dimensionParser");

const {
    normalizeDimensions
} = require("./dimensionNormalizer");

const {
    convertDimensionsToMeters
} = require("./unitConverter");

const {
    executeFormula
} = require("./formulaEngine");

const {
    calculateShuttering
} = require("./shutteringEngine");

function applySign(
    value,
    isDeduction
) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return value;
    }

    const numericValue =
        Number(value);

    if (!Number.isFinite(numericValue)) {
        return value;
    }

    return isDeduction
        ? -Math.abs(numericValue)
        : numericValue;
}

function calculateQuantity(annotationText) {
    //-----------------------------------
    // STEP 1 - PARSE ANNOTATION
    //-----------------------------------

    const annotation =
        parseAnnotation(
            annotationText
        );

    if (!annotation.isValid) {
        throw new Error(
            "Invalid annotation format"
        );
    }

    //-----------------------------------
    // STEP 2 - MATCH SHAPE
    //-----------------------------------

    const shapeMatch =
        matchShape(
            annotation.shapeText
        );

    if (!shapeMatch.found) {
        throw new Error(
            `Shape not found: ${annotation.shapeText}`
        );
    }

    //-----------------------------------
    // STEP 3 - PARSE DIMENSIONS
    //-----------------------------------

    const parsedDimensions =
        parseDimensions(
            annotation.dimensionText
        );

    //-----------------------------------
    // STEP 4 - NORMALIZE DIMENSIONS
    //-----------------------------------

    const normalizedDimensions =
        normalizeDimensions(
            parsedDimensions
        );

    //-----------------------------------
    // STEP 5 - CONVERT TO METERS
    //-----------------------------------

    const metricDimensions =
        convertDimensionsToMeters(
            normalizedDimensions
        );

    //-----------------------------------
    // REQUIRED DIMENSION VALIDATION
    //-----------------------------------

    const requiredDimensions =
        shapeMatch.shape
            .requiredDimensions;

    for (const dimension of requiredDimensions) {
        if (!metricDimensions[dimension]) {
            throw new Error(
                `Missing required dimension: ${dimension}`
            );
        }
    }

    //-----------------------------------
    // STEP 6 - CALCULATE VOLUME
    //-----------------------------------

    let volume =
        executeFormula(
            shapeMatch.shape
                .volumeFormula,
            metricDimensions
        );

    //-----------------------------------
    // STEP 7 - CALCULATE GEOMETRIC AREA
    //-----------------------------------

    let area =
        executeFormula(
            shapeMatch.shape
                .areaFormula,
            metricDimensions
        );

    //-----------------------------------
    // STEP 8 - CALCULATE SHUTTERING
    //-----------------------------------

    const masterData =
        loadShapeMaster();

    const shutteringResult =
        calculateShuttering({
            shape:
                shapeMatch.shape,
            dimensions:
                metricDimensions,
            concreteCategory:
                annotation
                    .concreteCategory,
            referenceElement:
                annotation.elementType,
            shutteringRules:
                masterData
                    .shutteringRules
        });

    //-----------------------------------
    // STEP 9 - APPLY DEDUCTION SIGN
    //-----------------------------------

    if (annotation.isDeduction) {
        volume = -Math.abs(volume);
        area = -Math.abs(area);
    }

    const signedFaceAreas = {
        side:
            applySign(
                shutteringResult
                    .faceAreas.side,
                annotation.isDeduction
            ),
        top:
            applySign(
                shutteringResult
                    .faceAreas.top,
                annotation.isDeduction
            ),
        bottom:
            applySign(
                shutteringResult
                    .faceAreas.bottom,
                annotation.isDeduction
            ),
        outerSide:
            applySign(
                shutteringResult
                    .faceAreas.outerSide,
                annotation.isDeduction
            ),
        innerSide:
            applySign(
                shutteringResult
                    .faceAreas.innerSide,
                annotation.isDeduction
            )
    };

    const shutteringArea =
        applySign(
            shutteringResult
                .shutteringArea,
            annotation.isDeduction
        );

    //-----------------------------------
    // FINAL OBJECT
    //-----------------------------------

    return {
        //-----------------------------------
        // SOURCE
        //-----------------------------------

        sourceText:
            annotation.sourceText,

        cleanedText:
            annotation.cleanedText,

        //-----------------------------------
        // ENTRY TYPE
        //-----------------------------------

        isDeduction:
            annotation.isDeduction,

        entryType:
            annotation.entryType,

        //-----------------------------------
        // ELEMENT
        //-----------------------------------

        referenceElement:
            annotation.elementType,

        //-----------------------------------
        // CONCRETE GRADE
        //-----------------------------------

        concreteGrade:
            annotation.concreteGrade,

        concreteGradeLabel:
            annotation
                .concreteGradeLabel,

        concreteCategory:
            annotation
                .concreteCategory,

        //-----------------------------------
        // SHAPE INFO
        //-----------------------------------

        shapeId:
            shapeMatch.shape.shapeId,

        shape:
            shapeMatch.shape
                .standardShape,

        matchType:
            shapeMatch.matchType,

        matchScore:
            shapeMatch.matchScore,

        //-----------------------------------
        // FORMULA INFO
        //-----------------------------------

        formulaAreaType:
            shapeMatch.shape
                .formulaAreaType,

        volumeFormula:
            shapeMatch.shape
                .volumeFormula,

        areaFormula:
            shapeMatch.shape
                .areaFormula,

        sideFaceFormula:
            shapeMatch.shape
                .sideFaceFormula,

        topFaceFormula:
            shapeMatch.shape
                .topFaceFormula,

        bottomFaceFormula:
            shapeMatch.shape
                .bottomFaceFormula,

        outerSideFormula:
            shapeMatch.shape
                .outerSideFormula,

        innerSideFormula:
            shapeMatch.shape
                .innerSideFormula,

        //-----------------------------------
        // DIMENSIONS
        //-----------------------------------

        providedDimensions:
            parsedDimensions,

        normalizedDimensions:
            metricDimensions,

        //-----------------------------------
        // BACKWARD COMPATIBILITY
        //-----------------------------------

        dimensions:
            metricDimensions,

        //-----------------------------------
        // GEOMETRY RESULTS
        //-----------------------------------

        volume,
        area,

        volumeUnit:
            "m3",

        areaUnit:
            "m2",

        //-----------------------------------
        // SHUTTERING RESULTS
        //-----------------------------------

        faceAreas:
            signedFaceAreas,

        sideFaceArea:
            signedFaceAreas.side,

        topFaceArea:
            signedFaceAreas.top,

        bottomFaceArea:
            signedFaceAreas.bottom,

        outerSideArea:
            signedFaceAreas.outerSide,

        innerSideArea:
            signedFaceAreas.innerSide,

        shutteringArea,

        shutteringUnit:
            "m2",

        shutteringRuleApplied:
            shutteringResult
                .ruleApplied,

        shutteringRulePriority:
            shutteringResult
                .rulePriority,

        shutteringIncludedFaces:
            shutteringResult
                .includedFaceComponents,

        shutteringExcludedFaces:
            shutteringResult
                .excludedFaceComponents,

        shutteringStatus:
            shutteringResult.status,

        shutteringReviewReason:
            shutteringResult
                .reviewReason,

        shutteringFormulaTrace:
            shutteringResult
                .faceFormulaTrace
    };
}

module.exports = {
    calculateQuantity
};
