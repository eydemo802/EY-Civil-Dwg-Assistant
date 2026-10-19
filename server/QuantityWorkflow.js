const {
    detectLeaderTarget
} = require(
    "./geometry/leaderLineDetector"
);

const {
    detectMemberGeometry
} = require(
    "./geometry/memberGeometryLocator"
);

const {
    detectGridCandidates
} = require(
    "./grid/gridDetector"
);

const {
    buildGridAxes,
    getPageGridModel
} = require(
    "./grid/gridAxisBuilder"
);

const {
    locateGrid
} = require(
    "./grid/gridLocatorEngine"
);

const {
    createElementAnchor
} = require(
    "./grid/elementLocatorEngine"
);

const {
    parsePdfFile
} = require(
    "./pdfParser"
);

const {
    extractAnnotations,
    extractReferenceLevels,
    buildReferenceLevelBands,
    getReferencePageModel,
    assignReferenceLevelBand
} = require(
    "./parser/annotationExtractionEngine"
);

const {
    calculateQuantities
} = require(
    "./engine/batchQuantityEngine"
);

const {
    generateWorkbook
} = require(
    "./excelGenerator"
);

function getAnnotationPageNumber(
    annotationInfo
) {

    return Number(
        annotationInfo?.pageNumber ||
        annotationInfo?.page ||
        1
    );
}

function findAnnotationInfo(
    annotations,
    sourceText
) {

    return (
        annotations.find(
            item =>
                item.annotation ===
                sourceText
        ) ||
        null
    );
}

function createAnnotationFallbackAnchor(
    annotationInfo
) {

    if (!annotationInfo) {

        return {

            x: 0,

            y: 0,

            width: 0,

            height: 0,

            pageNumber: 1,

            anchorSource:
                "not-found"
        };
    }

    return {

        x:
            Number(
                annotationInfo.x ||
                0
            ),

        y:
            Number(
                annotationInfo.y ||
                0
            ),

        width:
            Number(
                annotationInfo.width ||
                0
            ),

        height:
            Number(
                annotationInfo.height ||
                0
            ),

        pageNumber:
            getAnnotationPageNumber(
                annotationInfo
            ),

        anchorSource:
            "annotation-fallback"
    };
}

function getNormalizedDimensionValue(
    result,
    dimensionName
) {
    const dimension =
        result.normalizedDimensions?.[
            dimensionName
        ];

    const rawValue =
        dimension &&
        typeof dimension === "object"
            ? dimension.value
            : dimension;

    const numericValue =
        Number(rawValue);

    return Number.isFinite(numericValue)
        ? numericValue
        : null;
}

function getExpectedVerticalSpan(result) {
    return (
        getNormalizedDimensionValue(
            result,
            "height"
        ) ??
        getNormalizedDimensionValue(
            result,
            "depth"
        ) ??
        getNormalizedDimensionValue(
            result,
            "outerHeight"
        )
    );
}

function getReferenceAllocationKey(
    result,
    pageNumber,
    expectedHeight
) {
    if (
        result.isDeduction ||
        !Number.isFinite(expectedHeight) ||
        expectedHeight <= 0
    ) {
        return null;
    }

    return [
        pageNumber,
        result.shapeId || result.shape || "shape",
        result.referenceElement || "element",
        Number(expectedHeight).toFixed(3)
    ].join("|");
}

async function runQuantityWorkflow(
    filePath,
    originalName,
    uploadMetadata = {}
) {

    //-----------------------------------
    // STEP 1 - PARSE PDF
    //-----------------------------------

    const pdf =
        await parsePdfFile(
            filePath,
            originalName
        );

    //-----------------------------------
    // STEP 2 - DETECT GRID CANDIDATES
    //-----------------------------------

    const gridCandidates =
        detectGridCandidates(
            pdf.textItems
        );

    //-----------------------------------
    // STEP 3 - BUILD GRID MODEL
    //-----------------------------------

    const gridModel =
        buildGridAxes(
            gridCandidates,
            {

                alignmentTolerance:
                    8,

                minimumAlphaLabels:
                    2,

                minimumNumericLabels:
                    1
            }
        );

    //-----------------------------------
    // STEP 4 - EXTRACT ANNOTATIONS
    //-----------------------------------

    const annotations =
        extractAnnotations(
            pdf.textItems
        );

    //-----------------------------------
    // STEP 4A - EXTRACT REFERENCE LEVELS
    //-----------------------------------
    const referenceLevels =
        extractReferenceLevels(
            pdf.textItems,
            { yTolerance: 6 }
        );

    const referenceLevelModel =
        buildReferenceLevelBands(
            referenceLevels
        );

    console.log(
        "PRIMARY REFERENCE LEVELS:",
        JSON.stringify(referenceLevels, null, 4)
    );
    console.log(
        "REFERENCE LEVEL MODEL:",
        JSON.stringify(referenceLevelModel, null, 4)
    );

    //-----------------------------------
    // STEP 5 - CALCULATE QUANTITIES
    //-----------------------------------

    const batchResult =
        calculateQuantities(
            annotations.map(
                item =>
                    item.annotation
            )
        );

    //-----------------------------------
    // STEP 6 - ENRICH SUCCESSFUL RESULTS
    //-----------------------------------

    const usedReferenceBands =
        new Map();

    batchResult.successfulCalculations
        .forEach(result => {

            const annotationInfo =
                findAnnotationInfo(
                    annotations,
                    result.sourceText
                );

            if (!annotationInfo) {

                result.pdfFileName =
                    originalName;

                result.gridLocation =
                    "";

                result.gridAnchorSource =
                    "annotation-not-found";

                result.elementMatch =
                    "";
                result.fromRefLevel = null;
                result.toRefLevel = null;
                result.referenceLevelMatchType =
                    "annotation-not-found";
                result.referenceLevelConfidence = 0;

                return;
            }

            const pageNumber =
                getAnnotationPageNumber(
                    annotationInfo
                );

            result.pageNumber =
                pageNumber;

            result.x =
                annotationInfo.x;

            result.y =
                annotationInfo.y;

            result.pdfFileName =
                originalName;

            //-----------------------------------
            // FIND PAGE GRID MODEL
            //-----------------------------------

            const pageGridModel =
                getPageGridModel(
                    gridModel,
                    pageNumber
                );

            //-----------------------------------
            // FIND ELEMENT REFERENCE COORDINATE
            //-----------------------------------

            const elementAnchor =
                createElementAnchor({

                    referenceElement:
                        result.referenceElement,

                    textItems:
                        pdf.textItems,

                    pageNumber,

                    annotationInfo,

                    minimumScore:
                        50
                });

            //-----------------------------------
// LEADER DETECTION
//-----------------------------------

const leaderResult =
    detectLeaderTarget({

        annotationInfo,

        vectorSegments:
            pdf.vectorSegments,

        pageNumber
    });

//-----------------------------------
// MEMBER DETECTION
//-----------------------------------

const memberResult =
    detectMemberGeometry({

        leaderResult,

        vectorSegments:
            pdf.vectorSegments,

        pageNumber
    });

            //-----------------------------------
            // ASSIGN REFERENCE LEVEL BAND
            //-----------------------------------
            const pageReferenceModel =
                getReferencePageModel(
                    referenceLevelModel,
                    pageNumber
                );

            const expectedHeight =
                getExpectedVerticalSpan(
                    result
                );

            const allocationKey =
                getReferenceAllocationKey(
                    result,
                    pageNumber,
                    expectedHeight
                );

            if (
                allocationKey &&
                !usedReferenceBands.has(
                    allocationKey
                )
            ) {
                usedReferenceBands.set(
                    allocationKey,
                    new Set()
                );
            }

            const usedBandKeys =
                allocationKey
                    ? usedReferenceBands.get(
                        allocationKey
                    )
                    : new Set();

            const referenceLevelAssignment =
                assignReferenceLevelBand({
                    annotationInfo,
                    pageReferenceModel,
                    geometry: {
                        leaderTarget: leaderResult.leaderTarget,
                        leaderConfidence: leaderResult.confidence,
                        memberStart: memberResult.startPoint,
                        memberEnd: memberResult.endPoint,
                        memberConfidence: memberResult.confidence
                    },
                    expectedHeight,
                    usedBandKeys,
                    boundaryTolerance: 5,
                    heightTolerance: 0.12
                });

            if (
                allocationKey &&
                referenceLevelAssignment
                    .referenceLevelBandKey
            ) {
                usedBandKeys.add(
                    referenceLevelAssignment
                        .referenceLevelBandKey
                );
            }

            result.fromRefLevel =
                referenceLevelAssignment.fromRefLevel;
            result.toRefLevel =
                referenceLevelAssignment.toRefLevel;
            result.referenceLevelMatchType =
                referenceLevelAssignment.referenceLevelMatchType;
            result.referenceLevelConfidence =
                referenceLevelAssignment.referenceLevelConfidence;
            result.referenceLevelAnchorY =
                referenceLevelAssignment.referenceLevelAnchorY;
            result.referenceLevelExpectedHeight =
                expectedHeight;

            //-----------------------------------
            // ASSIGN GRID LOCATION
            //-----------------------------------

            result.gridLocation =
    pageGridModel
        ? locateGrid(
            elementAnchor,
            pageGridModel
        )
        : "";

//-----------------------------------
// GEOMETRY DATA
//-----------------------------------

result.leaderDetected =
    leaderResult.found;

result.leaderConfidence =
    leaderResult.confidence || 0;

result.leaderTarget =
    leaderResult.leaderTarget || null;

result.memberDetected =
    memberResult.found;

result.memberConfidence =
    memberResult.confidence || 0;

result.memberStart =
    memberResult.startPoint || null;

result.memberEnd =
    memberResult.endPoint || null;

result.memberLength =
    memberResult.length || 0;

            result.gridAnchorSource =
                elementAnchor.anchorSource;

            result.elementMatch =
                elementAnchor
                    .elementLocation
                    ?.matchedText ||
                "";

            result.elementMatchConfidence =
                elementAnchor
                    .elementLocation
                    ?.confidence ||
                0;

            //-----------------------------------
            // TEMPORARY DIAGNOSTICS
            //-----------------------------------

            console.log(
                "================================"
            );

            console.log(
    "================================"
);

console.log(
    "REFERENCE:",
    result.referenceElement
);

console.log(
    "GRID:",
    result.gridLocation
);

console.log(
    "LEADER FOUND:",
    leaderResult.found
);

console.log(
    "LEADER CONFIDENCE:",
    leaderResult.confidence
);

console.log(
    "LEADER TARGET:",
    leaderResult.leaderTarget
);

console.log(
    "MEMBER FOUND:",
    memberResult.found
);

console.log(
    "MEMBER CONFIDENCE:",
    memberResult.confidence
);

console.log(
    "MEMBER START:",
    memberResult.startPoint
);

console.log(
    "MEMBER END:",
    memberResult.endPoint
);

console.log(
    "MEMBER LENGTH:",
    memberResult.length
);

console.log(
    "================================"
);

            console.log(
                "PAGE:",
                pageNumber
            );

            console.log(
                "GRID MODEL STATUS:",
                pageGridModel
                    ? pageGridModel.status
                    : "page-grid-not-found"
            );

            console.log(
                "GRID LOCATION:",
                result.gridLocation
            );

            console.log(
                "ANCHOR SOURCE:",
                result.gridAnchorSource
            );

            console.log(
                "MATCHED ELEMENT TEXT:",
                result.elementMatch
            );

            console.log(
                "ELEMENT MATCH CONFIDENCE:",
                result.elementMatchConfidence
            );

            console.log(
                "ANCHOR COORDINATES:",
                {
                    x:
                        elementAnchor.x,

                    y:
                        elementAnchor.y
                }
            );

            console.log(
                "================================"
            );
        });

    //-----------------------------------
    // STEP 7 - ENRICH REVIEW ITEMS
    //-----------------------------------

    batchResult.reviewItems
        .forEach(item => {

            const annotationInfo =
                findAnnotationInfo(
                    annotations,
                    item.sourceText
                );

            if (!annotationInfo) {

                item.pdfFileName =
                    originalName;

                item.gridLocation =
                    "";

                item.gridAnchorSource =
                    "annotation-not-found";

                item.elementMatch =
                    "";

                return;
            }

            const pageNumber =
                getAnnotationPageNumber(
                    annotationInfo
                );

            item.pageNumber =
                pageNumber;

            item.pdfFileName =
                originalName;

            const pageGridModel =
                getPageGridModel(
                    gridModel,
                    pageNumber
                );

            /*
             * Review items normally contain only:
             *
             * sourceText
             * status
             * reason
             *
             * They may not contain referenceElement.
             *
             * Therefore use element-reference location
             * only when referenceElement is available.
             */

            let reviewAnchor;

            if (item.referenceElement) {

                reviewAnchor =
                    createElementAnchor({

                        referenceElement:
                            item.referenceElement,

                        textItems:
                            pdf.textItems,

                        pageNumber,

                        annotationInfo,

                        minimumScore:
                            50
                    });

            } else {

                reviewAnchor =
                    createAnnotationFallbackAnchor(
                        annotationInfo
                    );
            }

            item.gridLocation =
                pageGridModel
                    ? locateGrid(
                        reviewAnchor,
                        pageGridModel)
                        
                        : "";

item.gridAnchorSource =
    reviewAnchor.anchorSource;

item.elementMatch =
    reviewAnchor
        .elementLocation
        ?.matchedText || "";

});

    //-----------------------------------
    // STEP 8 - GENERATE EXCEL
    //-----------------------------------

    const excelFile =
        await generateWorkbook(
            batchResult,
            annotations,
            {
                ...uploadMetadata,
                approvedDrawingNumber: originalName,
                originalFileName: originalName
            }
        );

    //-----------------------------------
    // STEP 9 - RETURN EVERYTHING
    //-----------------------------------

    return {

        pdfFileName:
            originalName,

        project:
            uploadMetadata.project ||
            "",

        building:
            uploadMetadata.building ||
            "",

        buildingShortName:
            uploadMetadata.buildingShortName ||
            "",

        pageCount:
            pdf.pageCount,

        annotationCount:
            annotations.length,
        referenceLevels,
        referenceLevelModel,

        gridModel,

        excelFile,

        batchResult
    };
}

module.exports = {
    runQuantityWorkflow
};