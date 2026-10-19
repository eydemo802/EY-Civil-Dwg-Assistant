// server/parser/annotationParser.js

function cleanText(value) {
    return String(value || "")
        .replace(/[–—−]/g, "-")
        .replace(/×/g, "x")
        .replace(/\s+/g, " ")
        .trim();
}

const PCC_GRADES = new Set([5, 7.5, 10, 15]);

function getConcreteCategory(grade) {
    if (!Number.isFinite(grade)) return "";
    if (PCC_GRADES.has(grade)) return "PCC";
    return grade > 15 ? "RCC" : "";
}

function extractConcreteGrade(value) {
    const text = cleanText(value);

    // Grade must follow a hyphen. Notes may follow the grade.
    const pattern = /-\s*(?:m\s*)?(5|7\.5|10|15|20|25|30|35|40|45|50|55|60)(?=\s|$|\(|\[)/ig;
    const match = pattern.exec(text);

    if (!match) {
        return {
            textWithoutGrade: text,
            concreteGrade: null,
            concreteGradeLabel: "",
            concreteCategory: "",
            trailingNotes: ""
        };
    }

    const concreteGrade = Number(match[1]);

    return {
        textWithoutGrade: cleanText(text.slice(0, match.index)),
        concreteGrade,
        concreteGradeLabel: `M${concreteGrade}`,
        concreteCategory: getConcreteCategory(concreteGrade),
        trailingNotes: cleanText(text.slice(match.index + match[0].length))
    };
}

function parseAnnotation(annotationText) {
    const sourceText = cleanText(annotationText);
    const gradeDetails = extractConcreteGrade(sourceText);
    const textWithoutGrade = gradeDetails.textWithoutGrade;
    const isDeduction = /^-\s*/.test(textWithoutGrade);

    const cleanedText = isDeduction
        ? textWithoutGrade.replace(/^-\s*/, "")
        : textWithoutGrade;

    const parts = cleanedText
        .split(/\s*-\s*/)
        .map(cleanText)
        .filter(Boolean);

    return {
        sourceText,
        cleanedText,
        concreteGrade: gradeDetails.concreteGrade,
        concreteGradeLabel: gradeDetails.concreteGradeLabel,
        concreteCategory: gradeDetails.concreteCategory,
        annotationTrailingNotes: gradeDetails.trailingNotes,
        isDeduction,
        entryType: isDeduction ? "Deduction" : "Addition",
        shapeText: parts[0] || null,
        elementType: parts[1] || null,
        dimensionText: parts.slice(2).join(" - ") || null,
        isValid: parts.length >= 3
    };
}

module.exports = {
    parseAnnotation,
    extractConcreteGrade,
    getConcreteCategory,
    cleanText
};
