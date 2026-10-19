function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function round3(value) {
    return Math.round((toNumber(value) + Number.EPSILON) * 1000) / 1000;
}

function average(values = []) {
    const valid = values.map(Number).filter(Number.isFinite);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function alphabetToNumber(label) {
    const text = String(label || "").trim().toUpperCase();

    if (!/^[A-Z]{1,2}$/.test(text)) {
        return null;
    }

    let value = 0;

    for (const character of text) {
        value = value * 26 + character.charCodeAt(0) - 64;
    }

    return value;
}

function labelToNumber(label, type) {
    if (type === "alpha") {
        return alphabetToNumber(label);
    }

    const value = Number(label);
    return Number.isFinite(value) ? value : null;
}

function labelsAreSequential(labels = [], type) {
    if (labels.length < 2) return false;

    const values = labels.map(label => labelToNumber(label, type));

    if (values.some(value => value === null)) {
        return false;
    }

    for (let index = 1; index < values.length; index++) {
        if (values[index] - values[index - 1] !== 1) {
            return false;
        }
    }

    return true;
}

function clusterByCoordinate(candidates = [], coordinateKey, tolerance = 8) {
    const sorted = candidates
        .slice()
        .sort((left, right) => toNumber(left[coordinateKey]) - toNumber(right[coordinateKey]));

    const clusters = [];

    for (const candidate of sorted) {
        const coordinate = toNumber(candidate[coordinateKey]);

        let cluster = clusters.find(item =>
            Math.abs(item.coordinate - coordinate) <= tolerance
        );

        if (!cluster) {
            cluster = {
                coordinate,
                candidates: []
            };
            clusters.push(cluster);
        }

        cluster.candidates.push(candidate);
        cluster.coordinate = average(
            cluster.candidates.map(item => toNumber(item[coordinateKey]))
        );
    }

    return clusters;
}

function mergeRepeatedLabels(candidates = [], positionKey) {
    const grouped = new Map();

    for (const candidate of candidates) {
        const label = String(candidate.value || "").trim().toUpperCase();
        if (!label) continue;

        if (!grouped.has(label)) {
            grouped.set(label, []);
        }

        grouped.get(label).push(candidate);
    }

    const merged = [];

    for (const [label, items] of grouped.entries()) {
        const centerX = average(items.map(item => toNumber(item.centerX, item.x)));
        const centerY = average(items.map(item => toNumber(item.centerY, item.y)));

        merged.push({
            label,
            centerX: round3(centerX),
            centerY: round3(centerY),
            position: round3(positionKey === "centerX" ? centerX : centerY),
            occurrenceCount: items.length,
            sourceCandidates: items
        });
    }

    return merged;
}

function calculateSpacing(axes = []) {
    if (axes.length < 2) {
        return {
            values: [],
            average: 0,
            minimum: 0,
            maximum: 0,
            variationRatio: 0,
            reasonablyRegular: false
        };
    }

    const values = [];

    for (let index = 1; index < axes.length; index++) {
        values.push(Math.abs(axes[index].position - axes[index - 1].position));
    }

    const averageValue = average(values);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const variationRatio = averageValue > 0
        ? (maximum - minimum) / averageValue
        : 0;

    return {
        values: values.map(round3),
        average: round3(averageValue),
        minimum: round3(minimum),
        maximum: round3(maximum),
        variationRatio: round3(variationRatio),
        reasonablyRegular: variationRatio <= 0.6
    };
}

function buildAxisCandidate({
    cluster,
    type,
    orientation,
    minimumLabels
}) {
    const positionKey = orientation === "horizontal"
        ? "centerX"
        : "centerY";

    const merged = mergeRepeatedLabels(cluster.candidates, positionKey);

    if (merged.length < minimumLabels) {
        return null;
    }

    merged.sort((left, right) => left.position - right.position);

    const coordinateOrderLabels = merged.map(item => item.label);
    const forwardSequential = labelsAreSequential(coordinateOrderLabels, type);
    const reverseSequential = labelsAreSequential(
        coordinateOrderLabels.slice().reverse(),
        type
    );

    const axes = merged.map(item => ({
        label: item.label,
        position: item.position,
        centerX: item.centerX,
        centerY: item.centerY,
        occurrenceCount: item.occurrenceCount,
        sourceCandidates: item.sourceCandidates
    }));

    const spacing = calculateSpacing(axes);

    let confidence = Math.min(axes.length / 6, 0.45);

    if (forwardSequential || reverseSequential) {
        confidence += 0.35;
    }

    if (spacing.reasonablyRegular) {
        confidence += 0.15;
    }

    if (axes.some(axis => axis.occurrenceCount > 1)) {
        confidence += 0.05;
    }

    return {
        type,
        orientation,
        alignmentCoordinate: round3(cluster.coordinate),
        labelsInCoordinateOrder: coordinateOrderLabels,
        isSequential: forwardSequential || reverseSequential,
        sequenceDirection: forwardSequential
            ? "ascending"
            : reverseSequential
                ? "descending"
                : "non-sequential",
        axes,
        spacing,
        confidence: round3(Math.min(confidence, 1))
    };
}

function findAxisCandidates(candidates = [], options = {}) {
    const type = options.type;
    const orientation = options.orientation;
    const tolerance = Number.isFinite(Number(options.alignmentTolerance))
        ? Number(options.alignmentTolerance)
        : 8;
    const minimumLabels = Number.isFinite(Number(options.minimumLabels))
        ? Number(options.minimumLabels)
        : 2;

    const alignmentKey = orientation === "horizontal"
        ? "centerY"
        : "centerX";

    const clusters = clusterByCoordinate(candidates, alignmentKey, tolerance);

    return clusters
        .map(cluster => buildAxisCandidate({
            cluster,
            type,
            orientation,
            minimumLabels
        }))
        .filter(Boolean);
}

function scoreAxisCandidate(candidate) {
    if (!candidate) return -1;

    let score = candidate.axes.length * 10;

    if (candidate.isSequential) score += 25;
    if (candidate.spacing.reasonablyRegular) score += 10;

    score += candidate.confidence * 10;

    return score;
}

function chooseBestAxis(candidates = []) {
    if (candidates.length === 0) return null;

    return candidates
        .slice()
        .sort((left, right) =>
            scoreAxisCandidate(right) - scoreAxisCandidate(left)
        )[0];
}

function buildPageGridModel(pageCandidates = {}, options = {}) {
    const alphaCandidates = Array.isArray(pageCandidates.alphaCandidates)
        ? pageCandidates.alphaCandidates
        : [];
    const numericCandidates = Array.isArray(pageCandidates.numericCandidates)
        ? pageCandidates.numericCandidates
        : [];

    const commonOptions = {
        alignmentTolerance: options.alignmentTolerance
    };

    const alphaHorizontal = findAxisCandidates(alphaCandidates, {
        ...commonOptions,
        type: "alpha",
        orientation: "horizontal",
        minimumLabels: options.minimumAlphaLabels ?? 2
    });

    const alphaVertical = findAxisCandidates(alphaCandidates, {
        ...commonOptions,
        type: "alpha",
        orientation: "vertical",
        minimumLabels: options.minimumAlphaLabels ?? 2
    });

    const numericHorizontal = findAxisCandidates(numericCandidates, {
        ...commonOptions,
        type: "numeric",
        orientation: "horizontal",
        minimumLabels: options.minimumNumericLabels ?? 2
    });

    const numericVertical = findAxisCandidates(numericCandidates, {
        ...commonOptions,
        type: "numeric",
        orientation: "vertical",
        minimumLabels: options.minimumNumericLabels ?? 2
    });

    const alphaAxis = chooseBestAxis([
        ...alphaHorizontal,
        ...alphaVertical
    ]);

    const numericAxis = chooseBestAxis([
        ...numericHorizontal,
        ...numericVertical
    ]);

    let status = "detected";
    const warnings = [];

    if (!alphaAxis && !numericAxis) {
        status = "grid-not-found";
        warnings.push("No aligned alphabetic or numeric grid axes were detected.");
    } else if (!alphaAxis) {
        status = "partial-grid";
        warnings.push("Numeric grid detected, but alphabetic grid was not detected.");
    } else if (!numericAxis) {
        status = "partial-grid";
        warnings.push("Alphabetic grid detected, but numeric grid was not detected.");
    } else if (alphaAxis.orientation === numericAxis.orientation) {
        status = "review-required";
        warnings.push("Alphabetic and numeric grids have the same orientation.");
    }

    const confidenceValues = [alphaAxis, numericAxis]
        .filter(Boolean)
        .map(axis => axis.confidence);

    return {
        pageNumber: toNumber(pageCandidates.pageNumber, 1),
        status,
        alphaAxis,
        numericAxis,
        warnings,
        confidence: confidenceValues.length > 0
            ? round3(average(confidenceValues))
            : 0,
        candidateAxes: {
            alphaHorizontal,
            alphaVertical,
            numericHorizontal,
            numericVertical
        }
    };
}

function buildGridAxes(detectorResult = {}, options = {}) {
    const pages = Array.isArray(detectorResult.pages)
        ? detectorResult.pages
        : [];

    const pageModels = pages.map(pageCandidates =>
        buildPageGridModel(pageCandidates, options)
    );

    return {
        pages: pageModels,
        diagnostics: {
            pageCount: pageModels.length,
            detectedPageCount: pageModels.filter(page => page.status === "detected").length,
            partialPageCount: pageModels.filter(page => page.status === "partial-grid").length,
            reviewPageCount: pageModels.filter(page => page.status === "review-required").length,
            noGridPageCount: pageModels.filter(page => page.status === "grid-not-found").length
        }
    };
}

function getPageGridModel(gridModel, pageNumber) {
    if (!gridModel || !Array.isArray(gridModel.pages)) {
        return null;
    }

    return gridModel.pages.find(page =>
        Number(page.pageNumber) === Number(pageNumber)
    ) || null;
}

module.exports = {
    buildGridAxes,
    buildPageGridModel,
    findAxisCandidates,
    chooseBestAxis,
    getPageGridModel,
    alphabetToNumber,
    labelsAreSequential,
    calculateSpacing
};
