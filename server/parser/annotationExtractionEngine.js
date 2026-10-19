const {
    loadShapeMaster
} = require("../config/excelMasterLoader");

const masterData =
    loadShapeMaster();

function cleanText(value) {

    return String(value || "")
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/\u202F/g, " ")
        .replace(/×/g, "x")
        .replace(/[–—−]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegex(value) {

    return String(value)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}

/*
Creates a flexible pattern.

Example:

"Solid Cylinder"

can match:

"Solid Cylinder"
"Solid C y linder"
"S o l i d C y l i n d e r"
*/

function createFlexibleShapeRegex(
    shapeName
) {

    const words =
        cleanText(shapeName)
            .split(/\s+/)
            .filter(Boolean);

    const wordPatterns =
        words.map(word => {

            return Array.from(word)
                .map(character => {

                    return (
                        escapeRegex(character) +
                        "\\s*"
                    );
                })
                .join("");
        });

    return new RegExp(
        wordPatterns.join("\\s+"),
        "gi"
    );
}

function getShapeDefinitions() {

    return Object.values(
        masterData.shapes || {}
    )
        .filter(shape => {

            return Boolean(
                shape.standardShape
            );
        })
        .sort((left, right) => {

            return (
                right.standardShape.length -
                left.standardShape.length
            );
        })
        .map(shape => ({

            shapeId:
                shape.shapeId,

            standardShape:
                shape.standardShape,

            regex:
                createFlexibleShapeRegex(
                    shape.standardShape
                )
        }));
}

const shapeDefinitions =
    getShapeDefinitions();

function findShapeMatches(text) {

    const matches = [];

    for (
        const shapeDefinition
        of shapeDefinitions
    ) {

        const regex =
            new RegExp(
                shapeDefinition.regex.source,
                "gi"
            );

        let match;

        while (
            (
                match =
                    regex.exec(text)
            ) !== null
        ) {

            matches.push({

                start:
                    match.index,

                end:
                    match.index +
                    match[0].length,

                matchedText:
                    match[0],

                shapeId:
                    shapeDefinition.shapeId,

                standardShape:
                    shapeDefinition.standardShape
            });

            if (
                match.index ===
                regex.lastIndex
            ) {

                regex.lastIndex++;
            }
        }
    }

    matches.sort((left, right) => {

        if (
            left.start !==
            right.start
        ) {

            return (
                left.start -
                right.start
            );
        }

        return (
            (
                right.end -
                right.start
            ) -
            (
                left.end -
                left.start
            )
        );
    });

    /*
    Remove overlapping matches.

    Example:
    "Solid Cylinder"

    should not produce both:
    "Solid Cylinder"
    and
    "Cylinder"
    */

    const nonOverlappingMatches = [];

    for (const candidate of matches) {

        const overlaps =
            nonOverlappingMatches.some(
                existing => {

                    return (
                        candidate.start <
                            existing.end &&
                        candidate.end >
                            existing.start
                    );
                }
            );

        if (!overlaps) {

            nonOverlappingMatches.push(
                candidate
            );
        }
    }

    return nonOverlappingMatches
        .sort(
            (left, right) =>
                left.start -
                right.start
        );
}

function groupItemsIntoRows(
    textItems = [],
    yTolerance = 4
) {

    const itemsByPage =
        new Map();

    for (const item of textItems) {

        const text =
            cleanText(
                item.text
            );

        if (!text) {
            continue;
        }

        const pageNumber =
            Number(
                item.pageNumber ||
                item.page ||
                1
            );

        if (
            !itemsByPage.has(
                pageNumber
            )
        ) {

            itemsByPage.set(
                pageNumber,
                []
            );
        }

        itemsByPage
            .get(pageNumber)
            .push({

                ...item,

                text,

                pageNumber,

                x:
                    Number(
                        item.x || 0
                    ),

                y:
                    Number(
                        item.y || 0
                    ),

                width:
                    Number(
                        item.width || 0
                    ),

                height:
                    Number(
                        item.height || 0
                    )
            });
    }

    const rows = [];

    for (
        const [
            pageNumber,
            pageItems
        ]
        of itemsByPage.entries()
    ) {

        const sortedItems =
            pageItems
                .slice()
                .sort((left, right) => {

                    const yDifference =
                        right.y -
                        left.y;

                    if (
                        Math.abs(
                            yDifference
                        ) >
                        yTolerance
                    ) {

                        return yDifference;
                    }

                    return (
                        left.x -
                        right.x
                    );
                });

        const pageRows = [];

        for (
            const item
            of sortedItems
        ) {

            let matchingRow = null;

            for (
                const existingRow
                of pageRows
            ) {

                if (
                    Math.abs(
                        existingRow.y -
                        item.y
                    ) <=
                    yTolerance
                ) {

                    matchingRow =
                        existingRow;

                    break;
                }
            }

            if (!matchingRow) {

                matchingRow = {

                    pageNumber,

                    y:
                        item.y,

                    items:
                        []
                };

                pageRows.push(
                    matchingRow
                );
            }

            matchingRow.items.push(
                item
            );

            const totalItems =
                matchingRow.items.length;

            matchingRow.y =
                (
                    matchingRow.y *
                    (
                        totalItems -
                        1
                    ) +
                    item.y
                ) /
                totalItems;
        }

        for (
            const row
            of pageRows
        ) {

            row.items.sort(
                (left, right) =>
                    left.x -
                    right.x
            );

            const text =
                cleanText(
                    row.items
                        .map(item =>
                            item.text
                        )
                        .join(" ")
                );

            rows.push({

                pageNumber,

                text,

                x:
                    row.items.length
                        ? Math.min(
                            ...row.items.map(
                                item =>
                                    item.x
                            )
                        )
                        : null,

                y:
                    row.y,

                width:
                    row.items.reduce(
                        (
                            total,
                            item
                        ) =>
                            total +
                            item.width,
                        0
                    ),

                height:
                    row.items.length
                        ? Math.max(
                            ...row.items.map(
                                item =>
                                    item.height
                            )
                        )
                        : null,

                sourceItems:
                    row.items
            });
        }
    }

    return rows.sort(
        (left, right) => {

            if (
                left.pageNumber !==
                right.pageNumber
            ) {

                return (
                    left.pageNumber -
                    right.pageNumber
                );
            }

            return (
                right.y -
                left.y
            );
        }
    );
}

function canonicalizeAnnotation(
    annotationText,
    shapeMatch
) {

    const beforeShape =
        annotationText.slice(
            0,
            shapeMatch.start
        );

    const afterShape =
        annotationText.slice(
            shapeMatch.end
        );

    const isDeduction =
        /-\s*$/.test(
            beforeShape
        );

    return cleanText(
        (
            isDeduction
                ? "- "
                : ""
        ) +
        shapeMatch.standardShape +
        afterShape
    );
}

function splitRowIntoAnnotations(
    row
) {

    const shapeMatches =
        findShapeMatches(
            row.text
        );

    if (
        shapeMatches.length === 0
    ) {

        return [];
    }

    const annotations = [];

    for (
        let index = 0;
        index <
        shapeMatches.length;
        index++
    ) {

        const currentMatch =
            shapeMatches[index];

        const nextMatch =
            shapeMatches[
                index + 1
            ];

        let start =
            currentMatch.start;

        /*
        Preserve a leading minus immediately
        before the shape for deduction entries.
        */

        const prefix =
            row.text.slice(
                0,
                start
            );

        const deductionMatch =
            prefix.match(
                /-\s*$/
            );

        if (deductionMatch) {

            start =
                deductionMatch.index;
        }

        const end =
            nextMatch
                ? nextMatch.start
                : row.text.length;

        const annotationText =
            row.text.slice(
                start,
                end
            );

        const relativeShapeMatch = {

            ...currentMatch,

            start:
                currentMatch.start -
                start,

            end:
                currentMatch.end -
                start
        };

        const text =
            canonicalizeAnnotation(
                annotationText,
                relativeShapeMatch
            );

        if (text) {

            annotations.push({

                text,

                pageNumber:
                    row.pageNumber,

                x:
                    row.x,

                y:
                    row.y,

                width:
                    row.width,

                height:
                    row.height
            });
        }
    }

    return annotations;
}


/*
 * Reference-level detection
 *
 * Examples supported:
 * +27.000M
 * +9.000 M
 * 0.000M
 * -2.500 MTR
 * -6.000 METERS
 */
const REFERENCE_LEVEL_PATTERN =
    /(^|\s)([+\-±]?\d+(?:\.\d+)?)\s*(M|MTR|MTRS|METER|METERS)\b/i;

function parseReferenceLevelText(value) {
    const text = cleanText(value);

    if (!text) {
        return null;
    }

    const match =
        text.match(
            REFERENCE_LEVEL_PATTERN
        );

    if (!match) {
        return null;
    }

    const numericValue =
        Number(
            String(match[2])
                .replace("±", "")
        );

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    return {
        value: numericValue,
        matchedText: match[0].trim(),
        sourceText: text
    };
}

function extractReferenceLevels(
    textItems = [],
    options = {}
) {
    const yTolerance =
        Number(
            options.yTolerance ?? 6
        );

    const rawLevels = [];

    textItems.forEach(item => {
        const parsed =
            parseReferenceLevelText(
                item.text
            );

        if (!parsed) {
            return;
        }

        rawLevels.push({
            pageNumber:
                Number(
                    item.pageNumber ||
                    item.page ||
                    1
                ),
            value:
                parsed.value,
            matchedText:
                parsed.matchedText,
            sourceText:
                parsed.sourceText,
            x:
                Number(item.x || 0),
            y:
                Number(item.y || 0),
            width:
                Number(item.width || 0),
            height:
                Number(item.height || 0)
        });
    });

    const primaryLevels = selectPrimaryReferenceLevels(rawLevels, {
        xTolerance: options.xTolerance ?? 36,
        minimumUniqueLevels: options.minimumUniqueLevels ?? 3
    });

    const deduplicated = [];

    primaryLevels
        .sort((left, right) => {
            if (
                left.pageNumber !==
                right.pageNumber
            ) {
                return (
                    left.pageNumber -
                    right.pageNumber
                );
            }

            return left.y - right.y;
        })
        .forEach(level => {
            const existing =
                deduplicated.find(item => {
                    return (
                        item.pageNumber ===
                            level.pageNumber &&
                        Math.abs(
                            item.value -
                            level.value
                        ) < 0.0001 &&
                        Math.abs(
                            item.y -
                            level.y
                        ) <= yTolerance
                    );
                });

            if (!existing) {
                deduplicated.push({
                    ...level,
                    occurrences: 1
                });
                return;
            }

            const count =
                existing.occurrences + 1;

            existing.x =
                (
                    existing.x *
                    existing.occurrences +
                    level.x
                ) /
                count;

            existing.y =
                (
                    existing.y *
                    existing.occurrences +
                    level.y
                ) /
                count;

            existing.occurrences =
                count;
        });

    return deduplicated;
}


/* Select the recurring left-side construction elevation cluster. */
function selectPrimaryReferenceLevels(rawLevels = [], options = {}) {
    const xTolerance = Number(options.xTolerance ?? 36);
    const minimumUniqueLevels = Number(options.minimumUniqueLevels ?? 3);
    const levelsByPage = new Map();

    rawLevels.forEach(level => {
        if (!levelsByPage.has(level.pageNumber)) {
            levelsByPage.set(level.pageNumber, []);
        }
        levelsByPage.get(level.pageNumber).push(level);
    });

    const selected = [];

    for (const pageLevels of levelsByPage.values()) {
        const candidates = pageLevels.slice().sort((a, b) => a.x - b.x);
        const clusters = candidates.map(seed => {
            const members = candidates.filter(level =>
                Math.abs(level.x - seed.x) <= xTolerance
            );
            const uniqueCount = new Set(
                members.map(level => Number(level.value).toFixed(3))
            ).size;
            const averageX = members.reduce((sum, level) => sum + level.x, 0) /
                Math.max(members.length, 1);
            return { members, uniqueCount, totalCount: members.length, averageX };
        });

        const valid = clusters.filter(
            cluster => cluster.uniqueCount >= minimumUniqueLevels
        );

        if (!valid.length) {
            selected.push(...candidates);
            continue;
        }

        const best = valid.sort((a, b) =>
            b.uniqueCount - a.uniqueCount ||
            b.totalCount - a.totalCount ||
            a.averageX - b.averageX
        )[0];

        if (!best) continue;

        const primary = best.members.slice();
        const primaryKeys = new Set(
            primary.map(level => `${level.pageNumber}|${level.x}|${level.y}|${level.value}`)
        );
        const minY = Math.min(...primary.map(level => level.y));
        const maxY = Math.max(...primary.map(level => level.y));
        const topValue = primary
            .filter(level => level.y === minY)
            .sort((a, b) => b.value - a.value)[0]?.value;
        const bottomValue = primary
            .filter(level => level.y === maxY)
            .sort((a, b) => a.value - b.value)[0]?.value;

        /*
         * Retain a displaced outermost construction level such as +61.000M
         * when it sits above the main left-side stack and continues the same
         * elevation direction. Internal elevations inside the stack are not
         * allowed back in.
         */
        const outerExtensions = candidates.filter(level => {
            const key = `${level.pageNumber}|${level.x}|${level.y}|${level.value}`;
            if (primaryKeys.has(key)) return false;
            const above = level.y < minY && level.value > topValue;
            const below = level.y > maxY && level.value < bottomValue;
            return above || below;
        });

        selected.push(...primary, ...outerExtensions);
    }

    return selected;
}

function buildReferenceLevelBands(
    referenceLevels = []
) {
    const levelsByPage =
        new Map();

    referenceLevels.forEach(level => {
        if (
            !levelsByPage.has(
                level.pageNumber
            )
        ) {
            levelsByPage.set(
                level.pageNumber,
                []
            );
        }

        levelsByPage
            .get(level.pageNumber)
            .push(level);
    });

    const pages = [];

    for (
        const [pageNumber, levels]
        of levelsByPage.entries()
    ) {
        const ordered =
            levels
                .slice()
                .sort(
                    (left, right) =>
                        left.y -
                        right.y
                );

        const bands = [];

        for (
            let index = 0;
            index < ordered.length - 1;
            index += 1
        ) {
            const first =
                ordered[index];

            const second =
                ordered[index + 1];

            bands.push({
                pageNumber,
                minimumY:
                    Math.min(
                        first.y,
                        second.y
                    ),
                maximumY:
                    Math.max(
                        first.y,
                        second.y
                    ),
                fromRefLevel:
                    Math.min(
                        first.value,
                        second.value
                    ),
                toRefLevel:
                    Math.max(
                        first.value,
                        second.value
                    ),
                firstLevel:
                    first,
                secondLevel:
                    second
            });
        }

        pages.push({
            pageNumber,
            levels:
                ordered,
            bands
        });
    }

    return pages.sort(
        (left, right) =>
            left.pageNumber -
            right.pageNumber
    );
}

function getReferencePageModel(
    referenceLevelModel = [],
    pageNumber = 1
) {
    return (
        referenceLevelModel.find(
            page =>
                Number(page.pageNumber) ===
                Number(pageNumber)
        ) ||
        null
    );
}

function getVerticalAnchor(
    annotationInfo,
    geometry = {}
) {
    const leaderTarget =
        geometry.leaderTarget;

    if (
        leaderTarget &&
        Number.isFinite(
            Number(leaderTarget.y)
        )
    ) {
        return {
            y:
                Number(
                    leaderTarget.y
                ),
            source:
                "leader-target",
            confidence:
                Number(
                    geometry.leaderConfidence ||
                    0
                )
        };
    }

    const memberStart =
        geometry.memberStart;

    const memberEnd =
        geometry.memberEnd;

    if (
        memberStart &&
        memberEnd &&
        Number.isFinite(
            Number(memberStart.y)
        ) &&
        Number.isFinite(
            Number(memberEnd.y)
        )
    ) {
        return {
            y:
                (
                    Number(memberStart.y) +
                    Number(memberEnd.y)
                ) /
                2,
            source:
                "member-midpoint",
            confidence:
                Number(
                    geometry.memberConfidence ||
                    0
                )
        };
    }

    if (annotationInfo) {
        return {
            y:
                Number(
                    annotationInfo.y ||
                    0
                ) +
                Number(
                    annotationInfo.height ||
                    0
                ) /
                2,
            source:
                "annotation-position",
            confidence:
                35
        };
    }

    return {
        y: null,
        source: "not-found",
        confidence: 0
    };
}

function getReferenceBandKey(band) {
    return [
        band.pageNumber,
        Number(band.fromRefLevel).toFixed(3),
        Number(band.toRefLevel).toFixed(3)
    ].join("|");
}

function assignReferenceLevelBand({
    annotationInfo,
    pageReferenceModel,
    geometry = {},
    expectedHeight = null,
    usedBandKeys = new Set(),
    boundaryTolerance = 5,
    heightTolerance = 0.12
}) {
    if (
        !pageReferenceModel ||
        !Array.isArray(pageReferenceModel.bands) ||
        pageReferenceModel.bands.length === 0
    ) {
        return {
            fromRefLevel: null,
            toRefLevel: null,
            referenceLevelMatchType: "reference-levels-not-found",
            referenceLevelConfidence: 0,
            referenceLevelAnchorY: null,
            referenceLevelBandKey: null
        };
    }

    const anchor = getVerticalAnchor(
        annotationInfo,
        geometry
    );

    if (!Number.isFinite(anchor.y)) {
        return {
            fromRefLevel: null,
            toRefLevel: null,
            referenceLevelMatchType: "anchor-not-found",
            referenceLevelConfidence: 0,
            referenceLevelAnchorY: null,
            referenceLevelBandKey: null
        };
    }

    const bands = pageReferenceModel.bands.map(band => ({
        ...band,
        bandHeight: Math.abs(
            Number(band.toRefLevel) -
            Number(band.fromRefLevel)
        ),
        midpointY:
            (Number(band.minimumY) + Number(band.maximumY)) / 2,
        key: getReferenceBandKey(band)
    }));

    const numericExpectedHeight = Number(expectedHeight);
    const hasExpectedHeight =
        Number.isFinite(numericExpectedHeight) &&
        numericExpectedHeight > 0;

    /*
     * If the calculated vertical dimension matches one or more construction
     * bands, only those bands are valid candidates. This is essential for
     * repeated 9 m shell-wall lifts.
     */
    let candidates = hasExpectedHeight
        ? bands.filter(band =>
            Math.abs(band.bandHeight - numericExpectedHeight) <=
            Math.max(heightTolerance, numericExpectedHeight * 0.015)
        )
        : [];

    let matchType = "height-compatible-band";

    /*
     * Openings and irregular members may not span a complete level band.
     * For them, use the band containing the reliable geometry anchor.
     */
    if (!candidates.length) {
        candidates = bands.filter(band =>
            anchor.y >= band.minimumY - boundaryTolerance &&
            anchor.y <= band.maximumY + boundaryTolerance
        );
        matchType = anchor.source;
    }

    /*
     * Do not force an unrelated nearest band. An unresolved result is safer
     * than writing an incorrect construction level into the workbook.
     */
    if (!candidates.length) {
        return {
            fromRefLevel: null,
            toRefLevel: null,
            referenceLevelMatchType: "review-required",
            referenceLevelConfidence: 0,
            referenceLevelAnchorY: anchor.y,
            referenceLevelBandKey: null
        };
    }

    const unusedCandidates = candidates.filter(
        band => !usedBandKeys.has(band.key)
    );

    const candidatePool = unusedCandidates.length
        ? unusedCandidates
        : candidates;

    const matchedBand = candidatePool
        .map(band => ({
            band,
            distance: Math.abs(anchor.y - band.midpointY)
        }))
        .sort((left, right) => {
            if (left.distance !== right.distance) {
                return left.distance - right.distance;
            }
            return left.band.minimumY - right.band.minimumY;
        })[0]?.band || null;

    if (!matchedBand) {
        return {
            fromRefLevel: null,
            toRefLevel: null,
            referenceLevelMatchType: "review-required",
            referenceLevelConfidence: 0,
            referenceLevelAnchorY: anchor.y,
            referenceLevelBandKey: null
        };
    }

    return {
        fromRefLevel: matchedBand.fromRefLevel,
        toRefLevel: matchedBand.toRefLevel,
        referenceLevelMatchType:
            hasExpectedHeight && matchType === "height-compatible-band"
                ? `${matchType}:${anchor.source}`
                : matchType,
        referenceLevelConfidence: anchor.confidence,
        referenceLevelAnchorY: anchor.y,
        referenceLevelBandKey: matchedBand.key
    };
}

function trimAnnotationAtGrade(value) {
    const text = cleanText(value);
    const match = text.match(
        /(?:\s*-\s*|\s+)m\s*(\d+(?:\.\d+)?)(?=\s|$|\(|\[)/i
    );

    if (!match) {
        return text;
    }

    return cleanText(
        text.slice(
            0,
            match.index + match[0].length
        )
    );
}

function buildContentOrderPageStream(pageItems = []) {
    const orderedItems = pageItems
        .slice()
        .sort((left, right) => {
            const leftIndex = Number(left.index);
            const rightIndex = Number(right.index);

            if (
                Number.isFinite(leftIndex) &&
                Number.isFinite(rightIndex) &&
                leftIndex !== rightIndex
            ) {
                return leftIndex - rightIndex;
            }

            if (left.y !== right.y) {
                return right.y - left.y;
            }

            return left.x - right.x;
        });

    let text = "";
    const spans = [];

    orderedItems.forEach(item => {
        const itemText = cleanText(item.text);
        if (!itemText) return;

        if (text) text += " ";
        const start = text.length;
        text += itemText;

        spans.push({
            start,
            end: text.length,
            item
        });
    });

    return { text, spans };
}

function getItemForCharacterOffset(spans, offset) {
    return spans.find(span =>
        offset >= span.start &&
        offset < span.end
    )?.item || null;
}

function extractAnnotationsFromContentOrder(textItems = []) {
    const itemsByPage = new Map();

    textItems.forEach(item => {
        const pageNumber = Number(
            item.pageNumber || item.page || 1
        );

        if (!itemsByPage.has(pageNumber)) {
            itemsByPage.set(pageNumber, []);
        }

        itemsByPage.get(pageNumber).push({
            ...item,
            pageNumber,
            x: Number(item.x || 0),
            y: Number(item.y || 0),
            width: Number(item.width || 0),
            height: Number(item.height || 0)
        });
    });

    const annotations = [];

    for (const [pageNumber, pageItems] of itemsByPage.entries()) {
        const pageStream = buildContentOrderPageStream(pageItems);
        const shapeMatches = findShapeMatches(pageStream.text);

        shapeMatches.forEach((shapeMatch, index) => {
            const nextMatch = shapeMatches[index + 1];
            let start = shapeMatch.start;
            const prefix = pageStream.text.slice(
                Math.max(0, start - 4),
                start
            );
            const deductionMatch = prefix.match(/-\s*$/);

            if (deductionMatch) {
                start -= prefix.length - deductionMatch.index;
            }

            const end = nextMatch
                ? nextMatch.start
                : pageStream.text.length;

            const relativeShapeMatch = {
                ...shapeMatch,
                start: shapeMatch.start - start,
                end: shapeMatch.end - start
            };

            const annotation = trimAnnotationAtGrade(
                canonicalizeAnnotation(
                    pageStream.text.slice(start, end),
                    relativeShapeMatch
                )
            );

            if (!annotation) return;

            const sourceItem = getItemForCharacterOffset(
                pageStream.spans,
                shapeMatch.start
            );

            annotations.push({
                annotation,
                pageNumber,
                x: Number(sourceItem?.x || 0),
                y: Number(sourceItem?.y || 0),
                width: Number(sourceItem?.width || 0),
                height: Number(sourceItem?.height || 0),
                extractionSource: "content-order"
            });
        });
    }

    return annotations;
}

function normalizeAnnotationForMerge(value) {
    return cleanText(value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function getCandidateDistance(left, right) {
    const xDistance = Math.abs(
        Number(left.x || 0) -
        Number(right.x || 0)
    );
    const yDistance = Math.abs(
        Number(left.y || 0) -
        Number(right.y || 0)
    );

    return {
        xDistance,
        yDistance
    };
}

function areSamePhysicalAnnotation(
    left,
    right,
    options = {}
) {
    if (
        Number(left.pageNumber) !==
        Number(right.pageNumber)
    ) {
        return false;
    }

    const leftText =
        normalizeAnnotationForMerge(
            left.annotation
        );
    const rightText =
        normalizeAnnotationForMerge(
            right.annotation
        );

    if (!leftText || !rightText) {
        return false;
    }

    const textOverlaps =
        leftText === rightText ||
        leftText.includes(rightText) ||
        rightText.includes(leftText);

    if (!textOverlaps) {
        return false;
    }

    const distance =
        getCandidateDistance(
            left,
            right
        );

    return (
        distance.xDistance <=
            Number(options.xTolerance ?? 42) &&
        distance.yDistance <=
            Number(options.yTolerance ?? 10)
    );
}

function isLikelyIncompleteRowCandidate(
    candidate,
    primaryCandidates = []
) {
    if (
        candidate.extractionSource !==
        "row"
    ) {
        return false;
    }

    const candidateText =
        normalizeAnnotationForMerge(
            candidate.annotation
        );

    const hasNtsNoise =
        /\bnts\b/i.test(
            candidate.annotation
        );

    const hasGrade =
        /-\s*m?\s*\d+(?:\.\d+)?\s*$/i
            .test(candidate.annotation);

    const nearbyCompletePrimary =
        primaryCandidates.some(primary => {
            if (
                Number(primary.pageNumber) !==
                Number(candidate.pageNumber)
            ) {
                return false;
            }

            const primaryText =
                normalizeAnnotationForMerge(
                    primary.annotation
                );

            const sameShape =
                shapeDefinitions.some(shape => {
                    const shapeName =
                        cleanText(
                            shape.standardShape
                        ).toLowerCase();

                    return (
                        candidateText.includes(
                            shapeName
                        ) &&
                        primaryText.includes(
                            shapeName
                        )
                    );
                });

            if (!sameShape) {
                return false;
            }

            const distance =
                getCandidateDistance(
                    candidate,
                    primary
                );

            return (
                distance.yDistance <= 18 &&
                primary.annotation.length >
                    candidate.annotation.length
            );
        });

    return (
        nearbyCompletePrimary &&
        (
            hasNtsNoise ||
            !hasGrade
        )
    );
}

function mergeAnnotationCandidates(
    primary = [],
    secondary = []
) {
    const merged = [];

    const acceptedSecondary =
        secondary.filter(candidate => {
            return !isLikelyIncompleteRowCandidate(
                candidate,
                primary
            );
        });

    [...primary, ...acceptedSecondary]
        .forEach(candidate => {
            const duplicateIndex =
                merged.findIndex(existing => {
                    return areSamePhysicalAnnotation(
                        existing,
                        candidate
                    );
                });

            if (duplicateIndex < 0) {
                merged.push(candidate);
                return;
            }

            if (
                candidate.annotation.length >
                merged[duplicateIndex]
                    .annotation.length
            ) {
                merged[duplicateIndex] =
                    candidate;
            }
        });

    return merged.sort((left, right) => {
        if (
            Number(left.pageNumber) !==
            Number(right.pageNumber)
        ) {
            return (
                Number(left.pageNumber) -
                Number(right.pageNumber)
            );
        }

        return (
            Number(right.y || 0) -
            Number(left.y || 0)
        );
    });
}

function evaluateAnnotationCriteria(candidate) {
    const annotation = cleanText(
        candidate?.annotation ||
        candidate?.text ||
        ""
    );

    const shapeMatch =
        findShapeMatches(annotation)[0] ||
        null;

    const parts = annotation
        .replace(/^\-\s*/, "")
        .split(/\s*\-\s*/)
        .map(cleanText)
        .filter(Boolean);

    const hasShape = Boolean(
        shapeMatch &&
        shapeMatch.start === 0
    );

    const hasElement = Boolean(
        parts[1] &&
        /[a-z]/i.test(parts[1])
    );

    const dimensionText =
        parts.slice(2).join(" - ");

    const hasDimension = Boolean(
        dimensionText &&
        /(?:radius|dia(?:meter)?|depth|height|length|width|breadth|side|area|perimeter|thickness|base)\s*(?:=|:)?\s*\d/i
            .test(dimensionText)
    );

    const hasGrade =
        /(?:^|\s)-\s*M\s*\d+(?:\.\d+)?\s*$/i
            .test(annotation);

    const missingCriteria = [];

    if (!hasShape) {
        missingCriteria.push("shape");
    }
    if (!hasElement) {
        missingCriteria.push("element");
    }
    if (!hasDimension) {
        missingCriteria.push("dimension");
    }
    if (!hasGrade) {
        missingCriteria.push("grade");
    }

    return {
        isComplete:
            missingCriteria.length === 0,
        missingCriteria,
        reviewReason:
            missingCriteria.length
                ? `Missing annotation criteria: ${missingCriteria.join(", ")}`
                : ""
    };
}

function deduplicateContentOrderAnnotations(
    candidates = [],
    yTolerance = 3
) {
    const retained = [];

    candidates.forEach(candidate => {
        const candidateText =
            normalizeAnnotationForMerge(
                candidate.annotation
            );

        const duplicate = retained.some(existing => {
            return (
                Number(existing.pageNumber) ===
                    Number(candidate.pageNumber) &&
                normalizeAnnotationForMerge(
                    existing.annotation
                ) === candidateText &&
                Math.abs(
                    Number(existing.y || 0) -
                    Number(candidate.y || 0)
                ) <= yTolerance
            );
        });

        if (!duplicate) {
            retained.push(candidate);
        }
    });

    return retained;
}

function extractAnnotations(
    textItems = []
) {
    /*
     * Simple authoritative extraction flow:
     * 1. Read annotations only once in PDF content order.
     * 2. Start an annotation at a recognised Shape Master shape.
     * 3. End it at the next recognised shape.
     * 4. Retain repeated text when it occurs at a different drawing Y-position.
     * 5. Mark incomplete Shape-Element-Dimension-Grade candidates for review.
     *
     * Row extraction is deliberately not merged into the result because the
     * same physical demarcation can have a different row bounding box and was
     * therefore being returned twice.
     */
    const contentOrderCandidates =
        extractAnnotationsFromContentOrder(
            textItems
        );

    const annotations =
        deduplicateContentOrderAnnotations(
            contentOrderCandidates
        )
            .map(candidate => {
                const validation =
                    evaluateAnnotationCriteria(
                        candidate
                    );

                return {
                    ...candidate,
                    annotationCriteriaComplete:
                        validation.isComplete,
                    annotationMissingCriteria:
                        validation.missingCriteria,
                    annotationReviewReason:
                        validation.reviewReason,
                    extractionSource:
                        "content-order"
                };
            })
            .sort((left, right) => {
                if (
                    Number(left.pageNumber) !==
                    Number(right.pageNumber)
                ) {
                    return (
                        Number(left.pageNumber) -
                        Number(right.pageNumber)
                    );
                }

                return (
                    Number(right.y || 0) -
                    Number(left.y || 0)
                );
            });

    const completeCount =
        annotations.filter(item =>
            item.annotationCriteriaComplete
        ).length;

    console.log(
        "ANNOTATION EXTRACTION COUNTS:",
        {
            contentOrder:
                contentOrderCandidates.length,
            retained:
                annotations.length,
            complete:
                completeCount,
            reviewRequired:
                annotations.length -
                completeCount
        }
    );

    return annotations;
}

module.exports = {
    cleanText,
    findShapeMatches,
    groupItemsIntoRows,
    canonicalizeAnnotation,
    splitRowIntoAnnotations,
    extractAnnotations,
    extractAnnotationsFromContentOrder,
    evaluateAnnotationCriteria,
    deduplicateContentOrderAnnotations,
    mergeAnnotationCandidates,
    areSamePhysicalAnnotation,
    isLikelyIncompleteRowCandidate,
    trimAnnotationAtGrade,
    parseReferenceLevelText,
    extractReferenceLevels,
    selectPrimaryReferenceLevels,
    buildReferenceLevelBands,
    getReferencePageModel,
    getReferenceBandKey,
    assignReferenceLevelBand
};
