// server/geometry/vectorPathExtractor.js

async function loadPdfJs() {
    try {
        return require("pdfjs-dist/legacy/build/pdf.js");
    } catch (commonJsError) {
        try {
            return await import("pdfjs-dist/legacy/build/pdf.mjs");
        } catch (moduleError) {
            throw new Error(
                "pdfjs-dist could not be loaded for vector extraction."
            );
        }
    }
}

function round3(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Math.round(
        (number + Number.EPSILON) * 1000
    ) / 1000;
}

function multiplyMatrices(first, second) {
    return [
        first[0] * second[0] + first[2] * second[1],
        first[1] * second[0] + first[3] * second[1],
        first[0] * second[2] + first[2] * second[3],
        first[1] * second[2] + first[3] * second[3],
        first[0] * second[4] + first[2] * second[5] + first[4],
        first[1] * second[4] + first[3] * second[5] + first[5]
    ];
}

function transformPoint(matrix, x, y) {
    return {
        x: matrix[0] * x + matrix[2] * y + matrix[4],
        y: matrix[1] * x + matrix[3] * y + matrix[5]
    };
}

function calculateLength(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    return Math.sqrt(dx * dx + dy * dy);
}

function createSegment({
    pageNumber,
    pathId,
    segmentIndex,
    x1,
    y1,
    x2,
    y2,
    lineWidth,
    sourceOperation,
    isCurveApproximation = false
}) {
    return {
        pageNumber,
        pathId,
        segmentIndex,
        x1: round3(x1),
        y1: round3(y1),
        x2: round3(x2),
        y2: round3(y2),
        length: round3(
            calculateLength(x1, y1, x2, y2)
        ),
        lineWidth: round3(lineWidth),
        sourceOperation,
        isCurveApproximation
    };
}

function normalizeConstructPathArguments(args) {
    if (!Array.isArray(args)) {
        return {
            operations: [],
            coordinates: []
        };
    }

    const operations = Array.isArray(args[0])
        ? args[0]
        : [];

    let coordinates = [];

    if (Array.isArray(args[1])) {
        coordinates = args[1];
    } else if (
        args[1] &&
        typeof args[1].length === "number"
    ) {
        coordinates = Array.from(args[1]);
    }

    return {
        operations,
        coordinates
    };
}

function extractSegmentsFromConstructPath({
    args,
    pdfjsLib,
    coordinateMatrix,
    pageNumber,
    pathId,
    lineWidth,
    startSegmentIndex
}) {
    const OPS = pdfjsLib.OPS;
    const normalized = normalizeConstructPathArguments(args);
    const operations = normalized.operations;
    const coordinates = normalized.coordinates;
    const segments = [];

    let coordinateIndex = 0;
    let currentPoint = null;
    let subPathStart = null;
    let segmentIndex = startSegmentIndex;

    function readPoint() {
        if (coordinateIndex + 1 >= coordinates.length) {
            return null;
        }

        const x = Number(coordinates[coordinateIndex]);
        const y = Number(coordinates[coordinateIndex + 1]);
        coordinateIndex += 2;

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }

        return transformPoint(coordinateMatrix, x, y);
    }

    function addLine(targetPoint, sourceOperation, isCurveApproximation) {
        if (!currentPoint || !targetPoint) {
            currentPoint = targetPoint || currentPoint;
            return;
        }

        segments.push(
            createSegment({
                pageNumber,
                pathId,
                segmentIndex,
                x1: currentPoint.x,
                y1: currentPoint.y,
                x2: targetPoint.x,
                y2: targetPoint.y,
                lineWidth,
                sourceOperation,
                isCurveApproximation
            })
        );

        segmentIndex += 1;
        currentPoint = targetPoint;
    }

    for (const operation of operations) {
        if (operation === OPS.moveTo) {
            currentPoint = readPoint();
            subPathStart = currentPoint;
            continue;
        }

        if (operation === OPS.lineTo) {
            addLine(readPoint(), "lineTo", false);
            continue;
        }

        if (operation === OPS.curveTo) {
            readPoint();
            readPoint();
            addLine(readPoint(), "curveTo", true);
            continue;
        }

        if (operation === OPS.curveTo2) {
            readPoint();
            addLine(readPoint(), "curveTo2", true);
            continue;
        }

        if (operation === OPS.curveTo3) {
            readPoint();
            addLine(readPoint(), "curveTo3", true);
            continue;
        }

        if (operation === OPS.rectangle) {
            if (coordinateIndex + 3 >= coordinates.length) {
                continue;
            }

            const x = Number(coordinates[coordinateIndex]);
            const y = Number(coordinates[coordinateIndex + 1]);
            const width = Number(coordinates[coordinateIndex + 2]);
            const height = Number(coordinates[coordinateIndex + 3]);
            coordinateIndex += 4;

            const rawPoints = [
                [x, y],
                [x + width, y],
                [x + width, y + height],
                [x, y + height],
                [x, y]
            ];

            const transformedPoints = rawPoints.map(point =>
                transformPoint(
                    coordinateMatrix,
                    point[0],
                    point[1]
                )
            );

            for (
                let rectangleIndex = 1;
                rectangleIndex < transformedPoints.length;
                rectangleIndex++
            ) {
                const first = transformedPoints[rectangleIndex - 1];
                const second = transformedPoints[rectangleIndex];

                segments.push(
                    createSegment({
                        pageNumber,
                        pathId,
                        segmentIndex,
                        x1: first.x,
                        y1: first.y,
                        x2: second.x,
                        y2: second.y,
                        lineWidth,
                        sourceOperation: "rectangle",
                        isCurveApproximation: false
                    })
                );

                segmentIndex += 1;
            }

            currentPoint = transformedPoints[0];
            subPathStart = transformedPoints[0];
            continue;
        }

        if (operation === OPS.closePath) {
            if (
                currentPoint &&
                subPathStart &&
                (
                    currentPoint.x !== subPathStart.x ||
                    currentPoint.y !== subPathStart.y
                )
            ) {
                addLine(subPathStart, "closePath", false);
            }
        }
    }

    return {
        segments,
        nextSegmentIndex: segmentIndex,
        hasUsableCoordinates:
            operations.length > 0 &&
            coordinates.length > 0
    };
}

async function extractPageVectorSegments(
    page,
    pdfjsLib,
    pageNumber,
    options = {}
) {
    const viewport = page.getViewport({
        scale: Number(options.scale || 1)
    });

    const operatorList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;

    let currentTransform = [1, 0, 0, 1, 0, 0];
    let currentLineWidth = 1;
    const graphicsStateStack = [];
    const segments = [];

    let pathId = 0;
    let segmentIndex = 0;
    let constructPathCount = 0;
    let emptyConstructPathCount = 0;

    for (
        let operationIndex = 0;
        operationIndex < operatorList.fnArray.length;
        operationIndex++
    ) {
        const operation = operatorList.fnArray[operationIndex];
        const args = operatorList.argsArray[operationIndex];

        if (operation === OPS.save) {
            graphicsStateStack.push({
                transform: currentTransform.slice(),
                lineWidth: currentLineWidth
            });
            continue;
        }

        if (operation === OPS.restore) {
            const restored = graphicsStateStack.pop();

            if (restored) {
                currentTransform = restored.transform;
                currentLineWidth = restored.lineWidth;
            }
            continue;
        }

        if (operation === OPS.transform) {
            if (Array.isArray(args) && args.length >= 6) {
                const transform = args.slice(0, 6).map(Number);
                currentTransform = multiplyMatrices(
                    currentTransform,
                    transform
                );
            }
            continue;
        }

        if (operation === OPS.setLineWidth) {
            const candidateWidth = Array.isArray(args)
                ? Number(args[0])
                : Number(args);

            if (Number.isFinite(candidateWidth)) {
                currentLineWidth = candidateWidth;
            }
            continue;
        }

        if (operation === OPS.constructPath) {
            constructPathCount += 1;
            pathId += 1;

            const coordinateMatrix = multiplyMatrices(
                viewport.transform,
                currentTransform
            );

            const extracted = extractSegmentsFromConstructPath({
                args,
                pdfjsLib,
                coordinateMatrix,
                pageNumber,
                pathId,
                lineWidth: currentLineWidth,
                startSegmentIndex: segmentIndex
            });

            if (!extracted.hasUsableCoordinates) {
                emptyConstructPathCount += 1;
            }

            segments.push(...extracted.segments);
            segmentIndex = extracted.nextSegmentIndex;
        }
    }

    const minimumLength = Number.isFinite(
        Number(options.minimumLength)
    )
        ? Number(options.minimumLength)
        : 0.5;

    const usableSegments = segments.filter(segment =>
        segment.length >= minimumLength
    );

    return {
        pageNumber,
        segments: usableSegments,
        diagnostics: {
            operatorCount: operatorList.fnArray.length,
            constructPathCount,
            emptyConstructPathCount,
            extractedSegmentCount: segments.length,
            usableSegmentCount: usableSegments.length,
            minimumLength,
            possibleConstructPathRegression:
                constructPathCount > 0 &&
                emptyConstructPathCount === constructPathCount
        }
    };
}

async function extractVectorSegmentsFromBuffer(
    buffer,
    options = {}
) {
    const pdfjsLib = await loadPdfJs();

    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
        useSystemFonts: true
    });

    const pdf = await loadingTask.promise;
    const pages = [];
    const vectorSegments = [];

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {
        const page = await pdf.getPage(pageNumber);

        const pageResult = await extractPageVectorSegments(
            page,
            pdfjsLib,
            pageNumber,
            options
        );

        pages.push(pageResult);
        vectorSegments.push(...pageResult.segments);
    }

    return {
        success: true,
        pageCount: pdf.numPages,
        vectorSegments,
        pages,
        diagnostics: {
            totalSegments: vectorSegments.length,
            pageDiagnostics: pages.map(page =>
                page.diagnostics
            ),
            possibleConstructPathRegression:
                pages.some(page =>
                    page.diagnostics
                        .possibleConstructPathRegression
                )
        }
    };
}

module.exports = {
    extractVectorSegmentsFromBuffer,
    extractPageVectorSegments,
    extractSegmentsFromConstructPath,
    normalizeConstructPathArguments,
    multiplyMatrices,
    transformPoint
};
