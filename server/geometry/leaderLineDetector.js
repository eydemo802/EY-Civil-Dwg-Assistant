// server/geometry/leaderLineDetector.js

function toNumber(value, fallback = 0) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function round3(value) {

    return Math.round(
        (
            toNumber(value) +
            Number.EPSILON
        ) *
        1000
    ) / 1000;
}

function distance(
    first,
    second
) {

    const dx =
        toNumber(first.x) -
        toNumber(second.x);

    const dy =
        toNumber(first.y) -
        toNumber(second.y);

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}

function pointToSegmentDistance(
    point,
    segment
) {

    const x =
        toNumber(point.x);

    const y =
        toNumber(point.y);

    const x1 =
        toNumber(segment.x1);

    const y1 =
        toNumber(segment.y1);

    const x2 =
        toNumber(segment.x2);

    const y2 =
        toNumber(segment.y2);

    const dx =
        x2 - x1;

    const dy =
        y2 - y1;

    const denominator =
        dx * dx +
        dy * dy;

    if (denominator === 0) {

        return distance(
            point,
            {
                x: x1,
                y: y1
            }
        );
    }

    const projectionRatio =
        (
            (x - x1) * dx +
            (y - y1) * dy
        ) /
        denominator;

    const clampedRatio =
        Math.max(
            0,
            Math.min(
                1,
                projectionRatio
            )
        );

    const projectedPoint = {

        x:
            x1 +
            clampedRatio * dx,

        y:
            y1 +
            clampedRatio * dy
    };

    return distance(
        point,
        projectedPoint
    );
}

function getAnnotationBox(
    annotation = {}
) {

    const x =
        toNumber(
            annotation.x
        );

    const y =
        toNumber(
            annotation.y
        );

    const width =
        Math.max(
            0,
            toNumber(
                annotation.width
            )
        );

    const height =
        Math.max(
            0,
            toNumber(
                annotation.height
            )
        );

    return {

        left:
            x,

        right:
            x + width,

        bottom:
            y,

        top:
            y + height,

        centre: {

            x:
                x +
                width / 2,

            y:
                y +
                height / 2
        }
    };
}

function pointToBoxDistance(
    point,
    box
) {

    const x =
        toNumber(
            point.x
        );

    const y =
        toNumber(
            point.y
        );

    const dx =
        Math.max(
            box.left - x,
            0,
            x - box.right
        );

    const dy =
        Math.max(
            box.bottom - y,
            0,
            y - box.top
        );

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}

function getSegmentEndpoints(
    segment
) {

    return [

        {
            x:
                toNumber(
                    segment.x1
                ),

            y:
                toNumber(
                    segment.y1
                )
        },

        {
            x:
                toNumber(
                    segment.x2
                ),

            y:
                toNumber(
                    segment.y2
                )
        }
    ];
}

function segmentNearAnnotation(
    segment,
    annotationBox,
    tolerance
) {

    const endpoints =
        getSegmentEndpoints(
            segment
        );

    const endpointNearAnnotation =
        endpoints.some(
            point =>
                pointToBoxDistance(
                    point,
                    annotationBox
                ) <= tolerance
        );

    if (endpointNearAnnotation) {

        return true;
    }

    const centreDistance =
        pointToSegmentDistance(
            annotationBox.centre,
            segment
        );

    return (
        centreDistance <=
        tolerance
    );
}

function endpointsNear(
    firstSegment,
    secondSegment,
    tolerance
) {

    const firstEndpoints =
        getSegmentEndpoints(
            firstSegment
        );

    const secondEndpoints =
        getSegmentEndpoints(
            secondSegment
        );

    return firstEndpoints.some(
        firstPoint =>

            secondEndpoints.some(
                secondPoint =>

                    distance(
                        firstPoint,
                        secondPoint
                    ) <= tolerance
            )
    );
}

function getSegmentKey(
    segment
) {

    if (
        segment.segmentIndex !==
        undefined &&
        segment.segmentIndex !==
        null
    ) {

        return String(
            segment.segmentIndex
        );
    }

    return [
        round3(segment.x1),
        round3(segment.y1),
        round3(segment.x2),
        round3(segment.y2)
    ].join("|");
}

function buildConnectedChain(
    startSegment,
    allSegments,
    connectTolerance,
    maxSegments
) {

    const chain = [
        startSegment
    ];

    const used =
        new Set([
            getSegmentKey(
                startSegment
            )
        ]);

    let changed =
        true;

    while (
        changed &&
        chain.length <
            maxSegments
    ) {

        changed =
            false;

        for (
            const candidate
            of allSegments
        ) {

            const candidateKey =
                getSegmentKey(
                    candidate
                );

            if (
                used.has(
                    candidateKey
                )
            ) {

                continue;
            }

            const connected =
                chain.some(
                    segment =>

                        endpointsNear(
                            segment,
                            candidate,
                            connectTolerance
                        )
                );

            if (!connected) {

                continue;
            }

            chain.push(
                candidate
            );

            used.add(
                candidateKey
            );

            changed =
                true;

            if (
                chain.length >=
                maxSegments
            ) {

                break;
            }
        }
    }

    return chain;
}

function getChainEndpoints(
    chain,
    connectTolerance
) {

    const points = [];

    for (
        const segment
        of chain
    ) {

        points.push(
            ...getSegmentEndpoints(
                segment
            )
        );
    }

    return points.filter(
        (
            point,
            pointIndex
        ) => {

            let connectionCount =
                0;

            for (
                let otherIndex = 0;
                otherIndex <
                    points.length;
                otherIndex++
            ) {

                if (
                    otherIndex ===
                    pointIndex
                ) {

                    continue;
                }

                if (
                    distance(
                        point,
                        points[
                            otherIndex
                        ]
                    ) <=
                    connectTolerance
                ) {

                    connectionCount +=
                        1;
                }
            }

            return (
                connectionCount <= 1
            );
        }
    );
}

function calculateChainLength(
    chain
) {

    return chain.reduce(
        (
            sum,
            segment
        ) =>
            sum +
            toNumber(
                segment.length
            ),
        0
    );
}

function selectLeaderTarget(
    chain,
    annotationBox,
    connectTolerance
) {

    const endpoints =
        getChainEndpoints(
            chain,
            connectTolerance
        );

    if (
        endpoints.length === 0
    ) {

        return null;
    }

    return endpoints
        .slice()
        .sort(
            (
                left,
                right
            ) =>

                pointToBoxDistance(
                    right,
                    annotationBox
                ) -

                pointToBoxDistance(
                    left,
                    annotationBox
                )
        )[0];
}

function calculateChainDirectionChanges(
    chain
) {

    if (
        !Array.isArray(chain) ||
        chain.length < 2
    ) {

        return 0;
    }

    let directionChanges =
        0;

    let previousAngle =
        null;

    for (
        const segment
        of chain
    ) {

        const dx =
            toNumber(segment.x2) -
            toNumber(segment.x1);

        const dy =
            toNumber(segment.y2) -
            toNumber(segment.y1);

        const angle =
            Math.atan2(
                dy,
                dx
            ) *
            180 /
            Math.PI;

        if (
            previousAngle !== null
        ) {

            let difference =
                Math.abs(
                    angle -
                    previousAngle
                );

            while (
                difference > 180
            ) {

                difference -=
                    180;
            }

            if (
                difference > 15
            ) {

                directionChanges +=
                    1;
            }
        }

        previousAngle =
            angle;
    }

    return directionChanges;
}

function scoreLeaderCandidate(
    candidate
) {

    const chain =
        candidate.chain;

    const totalLength =
        candidate.totalLength;

    const targetDistance =
        candidate.targetDistance;

    const directionChanges =
        calculateChainDirectionChanges(
            chain
        );

    let score =
        0;

    score +=
        Math.min(
            chain.length * 8,
            32
        );

    score +=
        Math.min(
            totalLength / 10,
            35
        );

    score +=
        Math.min(
            targetDistance / 8,
            25
        );

    if (
        chain.length >= 2
    ) {

        score +=
            8;
    }

    if (
        directionChanges >= 1
    ) {

        score +=
            Math.min(
                directionChanges * 4,
                12
            );
    }

    return round3(
        Math.min(
            score,
            100
        )
    );
}

function detectLeaderTarget({
    annotationInfo,
    vectorSegments = [],
    pageNumber,
    annotationTolerance = 14,
    connectTolerance = 3,
    minimumSegmentLength = 2,
    maximumSegmentLength = 500,
    maximumChainSegments = 12,
    minimumConfidence = 0.35
}) {

    if (
        !annotationInfo ||
        !Array.isArray(
            vectorSegments
        )
    ) {

        return {

            found:
                false,

            status:
                "invalid-input",

            confidence:
                0,

            leaderTarget:
                null,

            chain:
                []
        };
    }

    const effectivePage =
        Number(
            pageNumber ||
            annotationInfo.pageNumber ||
            annotationInfo.page ||
            1
        );

    const pageSegments =
        vectorSegments.filter(
            segment =>

                Number(
                    segment.pageNumber ||
                    1
                ) ===
                    effectivePage &&

                toNumber(
                    segment.length
                ) >=
                    minimumSegmentLength &&

                toNumber(
                    segment.length
                ) <=
                    maximumSegmentLength
        );

    const annotationBox =
        getAnnotationBox(
            annotationInfo
        );

    const startCandidates =
        pageSegments.filter(
            segment =>

                segmentNearAnnotation(
                    segment,
                    annotationBox,
                    annotationTolerance
                )
        );

    const chainCandidates =
        startCandidates.map(
            startSegment => {

                const chain =
                    buildConnectedChain(
                        startSegment,
                        pageSegments,
                        connectTolerance,
                        maximumChainSegments
                    );

                const leaderTarget =
                    selectLeaderTarget(
                        chain,
                        annotationBox,
                        connectTolerance
                    );

                const totalLength =
                    calculateChainLength(
                        chain
                    );

                const targetDistance =
                    leaderTarget
                        ? pointToBoxDistance(
                            leaderTarget,
                            annotationBox
                        )
                        : 0;

                const candidate = {

                    startSegment,

                    chain,

                    leaderTarget,

                    totalLength:
                        round3(
                            totalLength
                        ),

                    targetDistance:
                        round3(
                            targetDistance
                        )
                };

                candidate.score =
                    scoreLeaderCandidate(
                        candidate
                    );

                return candidate;
            }
        );

    const bestCandidate =
        chainCandidates
            .filter(
                candidate =>
                    candidate.leaderTarget
            )
            .sort(
                (
                    left,
                    right
                ) =>
                    right.score -
                    left.score
            )[0];

    if (!bestCandidate) {

        return {

            found:
                false,

            status:
                "leader-not-found",

            confidence:
                0,

            leaderTarget:
                null,

            chain:
                [],

            candidateCount:
                chainCandidates.length,

            pageSegmentCount:
                pageSegments.length,

            startCandidateCount:
                startCandidates.length
        };
    }

    const confidence =
        round3(
            bestCandidate.score /
            100
        );

    if (
        confidence <
        minimumConfidence
    ) {

        return {

            found:
                false,

            status:
                "leader-confidence-too-low",

            confidence,

            leaderTarget:
                bestCandidate
                    .leaderTarget,

            chain:
                bestCandidate.chain,

            candidateCount:
                chainCandidates.length,

            pageSegmentCount:
                pageSegments.length,

            startCandidateCount:
                startCandidates.length
        };
    }

    return {

        found:
            true,

        status:
            "leader-detected",

        pageNumber:
            effectivePage,

        leaderTarget: {

            x:
                round3(
                    bestCandidate
                        .leaderTarget
                        .x
                ),

            y:
                round3(
                    bestCandidate
                        .leaderTarget
                        .y
                )
        },

        confidence,

        totalLength:
            bestCandidate
                .totalLength,

        targetDistance:
            bestCandidate
                .targetDistance,

        chain:
            bestCandidate.chain,

        candidateCount:
            chainCandidates.length,

        pageSegmentCount:
            pageSegments.length,

        startCandidateCount:
            startCandidates.length,

        annotationBox
    };
}

module.exports = {

    detectLeaderTarget,

    getAnnotationBox,

    pointToBoxDistance,

    pointToSegmentDistance,

    segmentNearAnnotation,

    endpointsNear,

    buildConnectedChain,

    getChainEndpoints,

    calculateChainLength,

    selectLeaderTarget,

    calculateChainDirectionChanges,

    scoreLeaderCandidate
};