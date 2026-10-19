// server/geometry/memberGeometryLocator.js

function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function round3(value) {
    return Math.round((toNumber(value) + Number.EPSILON) * 1000) / 1000;
}

function distance(first, second) {
    const dx = toNumber(first.x) - toNumber(second.x);
    const dy = toNumber(first.y) - toNumber(second.y);
    return Math.sqrt(dx * dx + dy * dy);
}

function getSegmentMidpoint(segment) {
    return {
        x: (toNumber(segment.x1) + toNumber(segment.x2)) / 2,
        y: (toNumber(segment.y1) + toNumber(segment.y2)) / 2
    };
}

function getSegmentAngle(segment) {
    const dx = toNumber(segment.x2) - toNumber(segment.x1);
    const dy = toNumber(segment.y2) - toNumber(segment.y1);

    let angle = Math.atan2(dy, dx) * 180 / Math.PI;

    if (angle < 0) {
        angle += 180;
    }

    return angle;
}

function angleDifference(firstAngle, secondAngle) {
    let difference = Math.abs(firstAngle - secondAngle) % 180;

    if (difference > 90) {
        difference = 180 - difference;
    }

    return difference;
}

function pointToSegmentDistance(point, segment) {
    const x = toNumber(point.x);
    const y = toNumber(point.y);
    const x1 = toNumber(segment.x1);
    const y1 = toNumber(segment.y1);
    const x2 = toNumber(segment.x2);
    const y2 = toNumber(segment.y2);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const denominator = dx * dx + dy * dy;

    if (denominator === 0) {
        return distance(point, { x: x1, y: y1 });
    }

    const t = Math.max(
        0,
        Math.min(1, ((x - x1) * dx + (y - y1) * dy) / denominator)
    );

    return distance(point, {
        x: x1 + t * dx,
        y: y1 + t * dy
    });
}

function endpointsNear(firstSegment, secondSegment, tolerance) {
    const firstPoints = [
        { x: firstSegment.x1, y: firstSegment.y1 },
        { x: firstSegment.x2, y: firstSegment.y2 }
    ];

    const secondPoints = [
        { x: secondSegment.x1, y: secondSegment.y1 },
        { x: secondSegment.x2, y: secondSegment.y2 }
    ];

    return firstPoints.some(firstPoint =>
        secondPoints.some(secondPoint =>
            distance(firstPoint, secondPoint) <= tolerance
        )
    );
}

function extendAlignedMember(seedSegment, candidateSegments, options) {
    const angleTolerance = options.angleTolerance;
    const connectionTolerance = options.connectionTolerance;
    const maximumSegments = options.maximumSegments;
    const seedAngle = getSegmentAngle(seedSegment);

    const memberSegments = [seedSegment];
    const usedIndexes = new Set([seedSegment.segmentIndex]);

    let changed = true;

    while (changed && memberSegments.length < maximumSegments) {
        changed = false;

        for (const candidate of candidateSegments) {
            if (usedIndexes.has(candidate.segmentIndex)) {
                continue;
            }

            const candidateAngle = getSegmentAngle(candidate);

            if (angleDifference(seedAngle, candidateAngle) > angleTolerance) {
                continue;
            }

            const connected = memberSegments.some(existing =>
                endpointsNear(existing, candidate, connectionTolerance) ||
                pointToSegmentDistance(
                    getSegmentMidpoint(candidate),
                    existing
                ) <= connectionTolerance
            );

            if (!connected) {
                continue;
            }

            memberSegments.push(candidate);
            usedIndexes.add(candidate.segmentIndex);
            changed = true;

            if (memberSegments.length >= maximumSegments) {
                break;
            }
        }
    }

    return memberSegments;
}

function projectPoint(point, angleDegrees) {
    const angleRadians = angleDegrees * Math.PI / 180;

    return (
        toNumber(point.x) * Math.cos(angleRadians) +
        toNumber(point.y) * Math.sin(angleRadians)
    );
}

function deriveMemberEndpoints(segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
        return null;
    }

    const dominantSegment = segments
        .slice()
        .sort((left, right) =>
            toNumber(right.length) - toNumber(left.length)
        )[0];

    const angle = getSegmentAngle(dominantSegment);
    const points = [];

    for (const segment of segments) {
        points.push(
            { x: toNumber(segment.x1), y: toNumber(segment.y1) },
            { x: toNumber(segment.x2), y: toNumber(segment.y2) }
        );
    }

    const sorted = points
        .map(point => ({
            point,
            projection: projectPoint(point, angle)
        }))
        .sort((left, right) => left.projection - right.projection);

    const start = sorted[0].point;
    const end = sorted[sorted.length - 1].point;

    return {
        startPoint: {
            x: round3(start.x),
            y: round3(start.y)
        },
        endPoint: {
            x: round3(end.x),
            y: round3(end.y)
        },
        angle: round3(angle),
        length: round3(distance(start, end))
    };
}

function findNearbyMemberCandidates({
    targetPoint,
    vectorSegments,
    pageNumber,
    searchRadius,
    minimumMemberLength,
    maximumMemberLength
}) {
    return vectorSegments
        .filter(segment =>
            Number(segment.pageNumber || 1) === Number(pageNumber) &&
            toNumber(segment.length) >= minimumMemberLength &&
            toNumber(segment.length) <= maximumMemberLength &&
            pointToSegmentDistance(targetPoint, segment) <= searchRadius
        )
        .map(segment => ({
            segment,
            targetDistance: round3(
                pointToSegmentDistance(targetPoint, segment)
            )
        }))
        .sort((left, right) => {
            if (left.targetDistance !== right.targetDistance) {
                return left.targetDistance - right.targetDistance;
            }

            return toNumber(right.segment.length) - toNumber(left.segment.length);
        });
}

function detectMemberGeometry({
    leaderResult,
    vectorSegments = [],
    pageNumber,
    searchRadius = 18,
    minimumMemberLength = 15,
    maximumMemberLength = 2000,
    angleTolerance = 6,
    connectionTolerance = 4,
    maximumSegments = 40
}) {
    if (!leaderResult || !leaderResult.found || !leaderResult.leaderTarget) {
        return {
            found: false,
            status: "leader-target-not-available",
            confidence: 0,
            startPoint: null,
            endPoint: null,
            memberSegments: []
        };
    }

    const effectivePage = Number(
        pageNumber || leaderResult.pageNumber || 1
    );

    const candidates = findNearbyMemberCandidates({
        targetPoint: leaderResult.leaderTarget,
        vectorSegments,
        pageNumber: effectivePage,
        searchRadius,
        minimumMemberLength,
        maximumMemberLength
    });

    if (candidates.length === 0) {
        return {
            found: false,
            status: "member-not-found-near-leader",
            confidence: 0,
            startPoint: null,
            endPoint: null,
            memberSegments: [],
            candidateCount: 0
        };
    }

    const seedSegment = candidates[0].segment;

    const pageSegments = vectorSegments.filter(segment =>
        Number(segment.pageNumber || 1) === effectivePage &&
        toNumber(segment.length) >= 1 &&
        toNumber(segment.length) <= maximumMemberLength
    );

    const memberSegments = extendAlignedMember(
        seedSegment,
        pageSegments,
        {
            angleTolerance,
            connectionTolerance,
            maximumSegments
        }
    );

    const geometry = deriveMemberEndpoints(memberSegments);

    if (!geometry || geometry.length <= 0) {
        return {
            found: false,
            status: "member-endpoints-not-derived",
            confidence: 0,
            startPoint: null,
            endPoint: null,
            memberSegments,
            candidateCount: candidates.length
        };
    }

    const seedDistance = candidates[0].targetDistance;
    let score = 0;

    score += Math.max(0, 40 - seedDistance * 2);
    score += Math.min(geometry.length / 10, 35);
    score += Math.min(memberSegments.length * 3, 20);

    if (leaderResult.confidence) {
        score += Math.min(leaderResult.confidence * 5, 5);
    }

    return {
        found: true,
        status: "member-geometry-detected",
        pageNumber: effectivePage,
        confidence: round3(Math.min(score / 100, 1)),
        startPoint: geometry.startPoint,
        endPoint: geometry.endPoint,
        angle: geometry.angle,
        length: geometry.length,
        seedDistance,
        seedSegment,
        memberSegments,
        candidateCount: candidates.length
    };
}

module.exports = {
    detectMemberGeometry,
    findNearbyMemberCandidates,
    extendAlignedMember,
    deriveMemberEndpoints,
    getSegmentAngle,
    angleDifference,
    pointToSegmentDistance
};
