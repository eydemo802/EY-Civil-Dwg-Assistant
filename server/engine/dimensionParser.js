function normalizeText(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const LABELS = [
    "outer bottom radius", "outer top radius", "inner bottom radius", "inner top radius",
    "outer bottom diameter", "outer top diameter", "inner bottom diameter", "inner top diameter",
    "outer bottom dia", "outer top dia", "inner bottom dia", "inner top dia",
    "outer radius", "inner radius", "outer diameter", "inner diameter", "outer dia", "inner dia",
    "bottom radius", "top radius", "bottom diameter", "top diameter", "bottom dia", "top dia",
    "outer length", "outer width", "outer height", "inner length", "inner width", "inner height",
    "parallel side 1", "parallel side 2", "trapezoid height", "triangle height",
    "major radius", "minor radius", "tube radius", "sphere radius", "cap height",
    "haunch length", "haunch height", "base perimeter", "base area", "bottom area", "top area",
    "bottom side", "top side", "base side", "semi axis a", "semi axis b", "semi axis c",
    "radius 1", "radius 2", "radius1", "radius2", "length", "width", "breadth", "depth",
    "height", "thickness", "diameter", "radius", "side 1", "side 2", "side 3", "side 4",
    "side", "area", "od", "id", "dia", "len", "ht", "thk", "l", "b", "h", "r"
];

function escapeRegex(value) {
    return String(value)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+");
}

const LABEL_PATTERN = LABELS
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|");

const LABEL_FIRST = new RegExp(
    `(?:^|[x,&;]|\\s)(?<label>${LABEL_PATTERN})\\s*(?:=|:)?\\s*(?<value>-?\\d+(?:\\.\\d+)?)\\s*(?<unit>mm|cm|m)?(?=\\s|$|[x,&;()])`,
    "gi"
);

const VALUE_FIRST = new RegExp(
    `(?:^|[x,&;]|\\s)(?<value>-?\\d+(?:\\.\\d+)?)\\s*(?<unit>mm|cm|m)?\\s*(?<label>${LABEL_PATTERN})(?=\\s|$|[x,&;()])`,
    "gi"
);

function addMatch(dimensions, match) {
    const label = normalizeText(match.groups?.label);
    const value = Number(match.groups?.value);
    const unit = normalizeText(match.groups?.unit) || "mm";

    if (label && Number.isFinite(value) && !dimensions[label]) {
        dimensions[label] = { value, unit };
    }
}

function parseDimensions(dimensionText) {
    const dimensions = {};
    if (!dimensionText) return dimensions;

    const cleanedText = String(dimensionText)
        .replace(/[–—−]/g, "-")
        .replace(/×/g, "x")
        .replace(/&/g, " x ")
        .replace(/\bNTS\b/gi, " ")
        .replace(/\bTYP\b/gi, " ")
        .replace(/\(\s*E\s*\/\s*F\s*\)/gi, " ")
        .replace(/\bD\d+\s*@\s*\d+\s*c\s*\/\s*c\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    LABEL_FIRST.lastIndex = 0;
    VALUE_FIRST.lastIndex = 0;

    let match;
    while ((match = LABEL_FIRST.exec(cleanedText)) !== null) addMatch(dimensions, match);
    while ((match = VALUE_FIRST.exec(cleanedText)) !== null) addMatch(dimensions, match);

    /*
     * Explicit fallback for simple dimensions. This is intentionally limited
     * to named geometry fields, so reinforcement numbers and NTS dimensions
     * are not interpreted as shape geometry.
     */
    const simpleDimensionFallbacks = [
        ["radius", /(?:^|\s|x)radius\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?(?=\s|$|x)/i],
        ["height", /(?:^|\s|x)height\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?(?=\s|$|x)/i],
        ["depth", /(?:^|\s|x)depth\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?(?=\s|$|x)/i],
        ["length", /(?:^|\s|x)length\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?(?=\s|$|x)/i],
        ["width", /(?:^|\s|x)width\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?(?=\s|$|x)/i],
        ["outer dia", /(?:^|\s|x)outer\s+dia(?:meter)?\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?(?=\s|$|x)/i],
        ["inner dia", /(?:^|\s|x)inner\s+dia(?:meter)?\s*(?:=|:)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?(?=\s|$|x)/i]
    ];

    simpleDimensionFallbacks.forEach(([label, regex]) => {
        if (dimensions[label]) {
            return;
        }

        const fallbackMatch =
            cleanedText.match(regex);

        if (!fallbackMatch) {
            return;
        }

        const value =
            Number(fallbackMatch[1]);

        if (!Number.isFinite(value)) {
            return;
        }

        dimensions[label] = {
            value,
            unit:
                normalizeText(
                    fallbackMatch[2]
                ) || "mm"
        };
    });

    console.log("PARSED DIMENSIONS:", JSON.stringify(dimensions, null, 2));
    return dimensions;
}

module.exports = {
    parseDimensions,
    DIMENSION_LABELS: LABELS
};
