const {
    executeFormula
} = require("./formulaEngine");

const FACE_COMPONENT_MAP = {
    SIDE: "side",
    TOP: "top",
    BOTTOM: "bottom",
    OUTER_SIDE: "outerSide",
    INNER_SIDE: "innerSide"
};

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function isWildcard(value) {
    return (
        !value ||
        value === "*"
    );
}

function matchesPattern(
    sourceValue,
    pattern
) {
    const source =
        normalizeText(sourceValue);

    const normalizedPattern =
        normalizeText(pattern);

    if (isWildcard(normalizedPattern)) {
        return true;
    }

    return normalizedPattern
        .split("|")
        .map(item => item.trim())
        .filter(Boolean)
        .some(item =>
            source.includes(item)
        );
}

function isExecutableFormula(formula) {
    const text =
        String(formula || "")
            .trim();

    if (!text) {
        return false;
    }

    const normalized =
        text.toLowerCase();

    return (
        !normalized.includes("requires") &&
        !normalized.includes("review")
    );
}

function evaluateFaceFormula(
    formula,
    dimensions
) {
    if (!isExecutableFormula(formula)) {
        return {
            value: 0,
            calculated: false,
            formula:
                String(formula || "").trim(),
            error: ""
        };
    }

    try {
        return {
            value:
                executeFormula(
                    formula,
                    dimensions
                ),
            calculated: true,
            formula,
            error: ""
        };
    } catch (error) {
        return {
            value: 0,
            calculated: false,
            formula,
            error:
                error.message
        };
    }
}

function findApplicableRule({
    shutteringRules = [],
    concreteCategory,
    referenceElement,
    shapeName
}) {
    return (
        shutteringRules.find(rule => {
            return (
                matchesPattern(
                    concreteCategory,
                    rule.concreteCategory
                ) &&
                matchesPattern(
                    referenceElement,
                    rule.referenceElementPattern
                ) &&
                matchesPattern(
                    shapeName,
                    rule.shapePattern
                )
            );
        }) ||
        null
    );
}

function createReviewResult({
    faceAreas,
    faceFormulaTrace,
    rule,
    reason
}) {
    return {
        faceAreas,
        faceFormulaTrace,
        shutteringArea: null,
        ruleApplied:
            rule?.ruleName ||
            "No shuttering rule applied",
        rulePriority:
            rule?.priority ??
            null,
        includedFaceComponents:
            rule?.includedFaceComponents ||
            [],
        excludedFaceComponents:
            rule?.excludedFaceComponents ||
            [],
        status:
            "Review Required",
        reviewReason:
            reason
    };
}

function calculateShuttering({
    shape,
    dimensions,
    concreteCategory,
    referenceElement,
    shutteringRules = []
}) {
    const faceFormulaTrace = {
        side:
            evaluateFaceFormula(
                shape.sideFaceFormula,
                dimensions
            ),
        top:
            evaluateFaceFormula(
                shape.topFaceFormula,
                dimensions
            ),
        bottom:
            evaluateFaceFormula(
                shape.bottomFaceFormula,
                dimensions
            ),
        outerSide:
            evaluateFaceFormula(
                shape.outerSideFormula,
                dimensions
            ),
        innerSide:
            evaluateFaceFormula(
                shape.innerSideFormula,
                dimensions
            )
    };

    const faceAreas = {
        side:
            faceFormulaTrace.side.value,
        top:
            faceFormulaTrace.top.value,
        bottom:
            faceFormulaTrace.bottom.value,
        outerSide:
            faceFormulaTrace.outerSide.value,
        innerSide:
            faceFormulaTrace.innerSide.value
    };

    const rule =
        findApplicableRule({
            shutteringRules,
            concreteCategory,
            referenceElement,
            shapeName:
                shape.standardShape
        });

    if (!rule) {
        return createReviewResult({
            faceAreas,
            faceFormulaTrace,
            rule,
            reason:
                "No applicable shuttering rule was found."
        });
    }

    if (
        shape.shutteringEnabled !== "yes" ||
        shape.defaultShutteringRule ===
            "REVIEW_REQUIRED"
    ) {
        return createReviewResult({
            faceAreas,
            faceFormulaTrace,
            rule,
            reason:
                "Shape Master requires engineering review for shuttering."
        });
    }

    if (
        rule.calculationMode ===
            "MANUAL_REVIEW" ||
        rule.includedFaceComponents.includes(
            "REVIEW"
        )
    ) {
        return createReviewResult({
            faceAreas,
            faceFormulaTrace,
            rule,
            reason:
                rule.notes ||
                "The selected shuttering rule requires manual review."
        });
    }

    const excludedComponents =
        new Set(
            rule.excludedFaceComponents
        );

    const includedComponents =
        rule.includedFaceComponents
            .filter(component =>
                !excludedComponents.has(
                    component
                )
            );

    if (!includedComponents.length) {
        return createReviewResult({
            faceAreas,
            faceFormulaTrace,
            rule,
            reason:
                "The selected shuttering rule has no included face components."
        });
    }

    const missingComponents =
        includedComponents.filter(component => {
            const faceKey =
                FACE_COMPONENT_MAP[component];

            return (
                !faceKey ||
                !faceFormulaTrace[
                    faceKey
                ]?.calculated
            );
        });

    if (missingComponents.length) {
        return createReviewResult({
            faceAreas,
            faceFormulaTrace,
            rule,
            reason:
                `Face formula unavailable for: ${missingComponents.join(", ")}`
        });
    }

    const shutteringArea =
        includedComponents.reduce(
            (sum, component) => {
                const faceKey =
                    FACE_COMPONENT_MAP[
                        component
                    ];

                return (
                    sum +
                    Number(
                        faceAreas[faceKey] ||
                        0
                    )
                );
            },
            0
        );

    return {
        faceAreas,
        faceFormulaTrace,
        shutteringArea:
            Number(
                shutteringArea.toFixed(4)
            ),
        ruleApplied:
            rule.ruleName,
        rulePriority:
            rule.priority,
        includedFaceComponents:
            includedComponents,
        excludedFaceComponents:
            rule.excludedFaceComponents,
        status:
            "Calculated",
        reviewReason: ""
    };
}

module.exports = {
    calculateShuttering,
    findApplicableRule,
    matchesPattern,
    FACE_COMPONENT_MAP
};
