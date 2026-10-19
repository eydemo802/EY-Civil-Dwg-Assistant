const { evaluate } = require("mathjs");

function normalizeFormula(formula) {
    return String(formula || "")
        .replace(/\bSQRT\s*\(/gi, "sqrt(")
        .trim();
}

function executeFormula(formula, dimensions) {
    const normalizedFormula = normalizeFormula(formula);
    if (!normalizedFormula) throw new Error("Formula is empty");

    const scope = { PI: Math.PI };

    for (const [key, data] of Object.entries(dimensions)) {
        scope[key] = data && typeof data === "object" ? data.value : data;
    }

    const result = evaluate(normalizedFormula, scope);

    if (!Number.isFinite(Number(result))) {
        throw new Error(`Formula returned a non-numeric result: ${normalizedFormula}`);
    }

    return Number(Number(result).toFixed(4));
}

module.exports = {
    executeFormula,
    normalizeFormula
};
