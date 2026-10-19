// server/grid/gridDetector.js

function cleanText(value) {

    return String(value || "")
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/\u202F/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function roundCoordinate(value) {

    const numericValue =
        Number(value);

    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    return Math.round(
        numericValue * 1000
    ) / 1000;
}

function isAlphabetGridLabel(text) {

    /*
     * Accepts:
     *
     * A
     * B
     * C
     * Z
     * AA
     * AB
     *
     * Does not accept:
     *
     * AB36
     * GRID A
     * BEAM
     */

    return /^[A-Z]{1,2}$/i.test(
        cleanText(text)
    );
}

function isNumericGridLabel(text) {

    /*
     * Accepts integer grid labels:
     *
     * 1
     * 2
     * 12
     * 99
     *
     * Rejects:
     *
     * 2.5
     * 9000
     * +18.000M
     * -6.000M
     */

    const cleaned =
        cleanText(text);

    if (!/^\d{1,2}$/.test(cleaned)) {
        return false;
    }

    const numericValue =
        Number(cleaned);

    return (
        Number.isInteger(numericValue) &&
        numericValue >= 1 &&
        numericValue <= 99
    );
}

function getItemCenter(item) {

    const x =
        Number(item.x || 0);

    const y =
        Number(item.y || 0);

    const width =
        Number(item.width || 0);

    const height =
        Number(item.height || 0);

    return {

        centerX:
            x + width / 2,

        centerY:
            y + height / 2
    };
}

function createCandidate(
    item,
    type
) {

    const center =
        getItemCenter(item);

    return {

        type,

        value:
            cleanText(item.text)
                .toUpperCase(),

        originalText:
            item.text,

        pageNumber:
            Number(
                item.pageNumber ||
                item.page ||
                1
            ),

        x:
            roundCoordinate(
                item.x
            ),

        y:
            roundCoordinate(
                item.y
            ),

        width:
            roundCoordinate(
                item.width
            ),

        height:
            roundCoordinate(
                item.height
            ),

        centerX:
            roundCoordinate(
                center.centerX
            ),

        centerY:
            roundCoordinate(
                center.centerY
            ),

        sourceIndex:
            item.index ?? null
    };
}

function areCoordinatesNear(
    first,
    second,
    tolerance
) {

    return (
        first.pageNumber ===
            second.pageNumber &&

        first.value ===
            second.value &&

        Math.abs(
            first.centerX -
            second.centerX
        ) <= tolerance &&

        Math.abs(
            first.centerY -
            second.centerY
        ) <= tolerance
    );
}

function removeNearDuplicates(
    candidates,
    tolerance = 3
) {

    const uniqueCandidates = [];

    for (const candidate of candidates) {

        const duplicate =
            uniqueCandidates.find(
                existing =>
                    areCoordinatesNear(
                        existing,
                        candidate,
                        tolerance
                    )
            );

        if (duplicate) {

            duplicate.duplicateCount =
                Number(
                    duplicate.duplicateCount ||
                    1
                ) + 1;

            continue;
        }

        uniqueCandidates.push({

            ...candidate,

            duplicateCount:
                1
        });
    }

    return uniqueCandidates;
}

function groupCandidatesByPage(
    candidates
) {

    const pages = {};

    for (const candidate of candidates) {

        const pageKey =
            String(
                candidate.pageNumber
            );

        if (!pages[pageKey]) {

            pages[pageKey] = {

                pageNumber:
                    candidate.pageNumber,

                alphaCandidates:
                    [],

                numericCandidates:
                    []
            };
        }

        if (
            candidate.type ===
            "alpha"
        ) {

            pages[pageKey]
                .alphaCandidates
                .push(candidate);

        } else if (
            candidate.type ===
            "numeric"
        ) {

            pages[pageKey]
                .numericCandidates
                .push(candidate);
        }
    }

    for (
        const pageData
        of Object.values(pages)
    ) {

        pageData.alphaCandidates.sort(
            (left, right) => {

                if (
                    left.centerY !==
                    right.centerY
                ) {

                    return (
                        right.centerY -
                        left.centerY
                    );
                }

                return (
                    left.centerX -
                    right.centerX
                );
            }
        );

        pageData.numericCandidates.sort(
            (left, right) => {

                if (
                    left.centerX !==
                    right.centerX
                ) {

                    return (
                        left.centerX -
                        right.centerX
                    );
                }

                return (
                    right.centerY -
                    left.centerY
                );
            }
        );
    }

    return Object.values(pages)
        .sort(
            (left, right) =>
                left.pageNumber -
                right.pageNumber
        );
}

/**
 * Detects possible grid labels in PDF positioned-text items.
 *
 * This function does not decide the final grid structure.
 * It only returns coordinate-bearing candidates.
 *
 * Input item example:
 *
 * {
 *     pageNumber: 1,
 *     index: 25,
 *     text: "A",
 *     x: 180,
 *     y: 720,
 *     width: 8,
 *     height: 10
 * }
 */

function detectGridCandidates(
    textItems = [],
    options = {}
) {

    const duplicateTolerance =
        Number.isFinite(
            Number(
                options.duplicateTolerance
            )
        )
            ? Number(
                options.duplicateTolerance
            )
            : 3;

    const alphaCandidates = [];

    const numericCandidates = [];

    for (const item of textItems) {

        const text =
            cleanText(
                item.text
            );

        if (!text) {
            continue;
        }

        if (
            isAlphabetGridLabel(
                text
            )
        ) {

            alphaCandidates.push(
                createCandidate(
                    item,
                    "alpha"
                )
            );

            continue;
        }

        if (
            isNumericGridLabel(
                text
            )
        ) {

            numericCandidates.push(
                createCandidate(
                    item,
                    "numeric"
                )
            );
        }
    }

    const uniqueAlphaCandidates =
        removeNearDuplicates(
            alphaCandidates,
            duplicateTolerance
        );

    const uniqueNumericCandidates =
        removeNearDuplicates(
            numericCandidates,
            duplicateTolerance
        );

    const allCandidates = [

        ...uniqueAlphaCandidates,

        ...uniqueNumericCandidates
    ];

    return {

        alphaCandidates:
            uniqueAlphaCandidates,

        numericCandidates:
            uniqueNumericCandidates,

        pages:
            groupCandidatesByPage(
                allCandidates
            ),

        diagnostics: {

            totalTextItems:
                textItems.length,

            rawAlphaCandidateCount:
                alphaCandidates.length,

            rawNumericCandidateCount:
                numericCandidates.length,

            uniqueAlphaCandidateCount:
                uniqueAlphaCandidates.length,

            uniqueNumericCandidateCount:
                uniqueNumericCandidates.length
        }
    };
}

module.exports = {

    detectGridCandidates,

    isAlphabetGridLabel,

    isNumericGridLabel,

    removeNearDuplicates,

    groupCandidatesByPage
};