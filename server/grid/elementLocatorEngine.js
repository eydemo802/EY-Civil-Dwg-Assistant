// server/grid/elementLocatorEngine.js

function cleanText(value) {
    return String(value || "")
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/\u202F/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeForComparison(value) {
    return cleanText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
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

function getItemCentre(item = {}) {
    const x = Number(item.x || 0);
    const y = Number(item.y || 0);
    const width = Number(item.width || 0);
    const height = Number(item.height || 0);

    return {
        x: round3(x + width / 2),
        y: round3(y + height / 2)
    };
}

function extractReferenceTokens(referenceElement) {
    const original = cleanText(referenceElement);
    const normalized = normalizeForComparison(original);

    if (!normalized) {
        return [];
    }

    const tokens = new Set();

    tokens.add(normalized);

    const words = original
        .split(/\s+/)
        .map(normalizeForComparison)
        .filter(Boolean);

    if (words.length > 1) {
        tokens.add(words.join(""));
        tokens.add(words[words.length - 1]);
    }

    const alphaNumericMatches = original.match(/[A-Za-z]+\s*-?\s*\d+/g) || [];

    alphaNumericMatches.forEach(match => {
        tokens.add(normalizeForComparison(match));
    });

    const numberMatches = original.match(/\d+/g) || [];

    numberMatches.forEach(match => {
        tokens.add(normalizeForComparison(match));
    });

    return Array.from(tokens)
        .filter(token => token.length > 0)
        .sort((left, right) => right.length - left.length);
}

function buildCandidateText(item = {}) {
    return cleanText(
        item.text ||
        item.rawText ||
        ""
    );
}

function scoreReferenceMatch(referenceElement, itemText) {
    const referenceTokens = extractReferenceTokens(referenceElement);
    const normalizedItem = normalizeForComparison(itemText);

    if (!normalizedItem || referenceTokens.length === 0) {
        return 0;
    }

    let bestScore = 0;

    for (const token of referenceTokens) {
        if (!token) {
            continue;
        }

        if (normalizedItem === token) {
            bestScore = Math.max(bestScore, 100);
            continue;
        }

        if (normalizedItem.includes(token)) {
            bestScore = Math.max(
                bestScore,
                token.length >= 4 ? 90 : 55
            );
            continue;
        }

        if (token.includes(normalizedItem)) {
            bestScore = Math.max(
                bestScore,
                normalizedItem.length >= 4 ? 80 : 40
            );
        }
    }

    return bestScore;
}

function calculateDistance(firstPoint, secondPoint) {
    const dx = Number(firstPoint.x || 0) - Number(secondPoint.x || 0);
    const dy = Number(firstPoint.y || 0) - Number(secondPoint.y || 0);

    return Math.sqrt(dx * dx + dy * dy);
}

function isLikelyQuantityAnnotationText(text) {
    const cleaned = cleanText(text);

    if (!cleaned) {
        return false;
    }

    const hyphenCount = (cleaned.match(/-/g) || []).length;

    return hyphenCount >= 2;
}

function findElementReferenceCandidates({
    referenceElement,
    textItems = [],
    pageNumber,
    annotationInfo,
    maximumDistance = Infinity
}) {
    const annotationCentre = annotationInfo
        ? getItemCentre(annotationInfo)
        : null;

    const candidates = [];

    for (const item of textItems) {
        const itemPageNumber = Number(
            item.pageNumber ||
            item.page ||
            1
        );

        if (
            pageNumber !== undefined &&
            pageNumber !== null &&
            itemPageNumber !== Number(pageNumber)
        ) {
            continue;
        }

        const itemText = buildCandidateText(item);

        if (!itemText) {
            continue;
        }

        if (isLikelyQuantityAnnotationText(itemText)) {
            continue;
        }

        const referenceScore = scoreReferenceMatch(
            referenceElement,
            itemText
        );

        if (referenceScore <= 0) {
            continue;
        }

        const centre = getItemCentre(item);
        const distance = annotationCentre
            ? calculateDistance(annotationCentre, centre)
            : 0;

        if (distance > maximumDistance) {
            continue;
        }

        const distancePenalty = annotationCentre
            ? Math.min(distance / 20, 30)
            : 0;

        const finalScore = Math.max(
            0,
            referenceScore - distancePenalty
        );

        candidates.push({
            referenceElement: cleanText(referenceElement),
            matchedText: itemText,
            pageNumber: itemPageNumber,
            x: round3(item.x),
            y: round3(item.y),
            width: round3(item.width),
            height: round3(item.height),
            centerX: centre.x,
            centerY: centre.y,
            referenceScore: round3(referenceScore),
            distanceFromAnnotation: round3(distance),
            score: round3(finalScore),
            sourceIndex: item.index ?? null,
            sourceItem: item
        });
    }

    return candidates.sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }

        return left.distanceFromAnnotation - right.distanceFromAnnotation;
    });
}

function locateElementReference({
    referenceElement,
    textItems = [],
    pageNumber,
    annotationInfo,
    minimumScore = 50,
    maximumDistance = Infinity
}) {
    const candidates = findElementReferenceCandidates({
        referenceElement,
        textItems,
        pageNumber,
        annotationInfo,
        maximumDistance
    });

    const bestCandidate = candidates.find(
        candidate => candidate.score >= minimumScore
    );

    if (!bestCandidate) {
        return {
            found: false,
            referenceElement: cleanText(referenceElement),
            detectionStatus: "element-reference-not-found",
            confidence: 0,
            point: null,
            matchedText: "",
            candidateCount: candidates.length,
            candidates
        };
    }

    return {
        found: true,
        referenceElement: cleanText(referenceElement),
        detectionStatus: "element-reference-detected",
        confidence: round3(
            Math.min(bestCandidate.score / 100, 1)
        ),
        point: {
            x: bestCandidate.centerX,
            y: bestCandidate.centerY,
            pageNumber: bestCandidate.pageNumber
        },
        matchedText: bestCandidate.matchedText,
        sourceIndex: bestCandidate.sourceIndex,
        distanceFromAnnotation: bestCandidate.distanceFromAnnotation,
        candidateCount: candidates.length,
        candidates
    };
}

function createElementAnchor({
    referenceElement,
    textItems = [],
    pageNumber,
    annotationInfo,
    minimumScore = 50,
    maximumDistance = Infinity
}) {
    const elementLocation = locateElementReference({
        referenceElement,
        textItems,
        pageNumber,
        annotationInfo,
        minimumScore,
        maximumDistance
    });

    if (elementLocation.found) {
        return {
            x: elementLocation.point.x,
            y: elementLocation.point.y,
            width: 0,
            height: 0,
            pageNumber: elementLocation.point.pageNumber,
            anchorSource: "element-reference",
            elementLocation
        };
    }

    if (annotationInfo) {
        const annotationCentre = getItemCentre(annotationInfo);

        return {
            x: annotationCentre.x,
            y: annotationCentre.y,
            width: 0,
            height: 0,
            pageNumber: Number(
                annotationInfo.pageNumber ||
                annotationInfo.page ||
                pageNumber ||
                1
            ),
            anchorSource: "annotation-fallback",
            elementLocation
        };
    }

    return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        pageNumber: Number(pageNumber || 1),
        anchorSource: "not-found",
        elementLocation
    };
}

module.exports = {
    locateElementReference,
    findElementReferenceCandidates,
    createElementAnchor,
    extractReferenceTokens,
    scoreReferenceMatch,
    getItemCentre,
    normalizeForComparison
};
