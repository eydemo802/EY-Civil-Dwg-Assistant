const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

/*
 * Fixed dimension schema from Shape_Formula_Master_V2.xlsx.
 * Existing extraction/calculation values are not changed here.
 * This module only writes batchResult values into Excel.
 */
const MASTER_DIMENSIONS = [
    "radius",
    "height",
    "outerRadius",
    "innerRadius",
    "thickness",
    "side",
    "outerSide",
    "innerSide",
    "length",
    "width",
    "outerLength",
    "outerWidth",
    "outerHeight",
    "innerLength",
    "innerWidth",
    "innerHeight",
    "base",
    "triangleHeight",
    "side2",
    "side3",
    "parallelSide1",
    "parallelSide2",
    "trapezoidHeight",
    "side4",
    "baseArea",
    "basePerimeter",
    "bottomRadius",
    "topRadius",
    "outerBottomRadius",
    "outerTopRadius",
    "innerBottomRadius",
    "innerTopRadius",
    "sphereRadius",
    "capHeight",
    "radius1",
    "radius2",
    "semiAxisA",
    "semiAxisB",
    "semiAxisC",
    "baseSide",
    "bottomSide",
    "topSide",
    "bottomArea",
    "topArea",
    "majorRadius",
    "tubeRadius",
    "area",
    "haunchLength",
    "haunchHeight"
];

function ensureOutputDir() {
    const outputDir = path.join(__dirname, "..", "output");

    fs.mkdirSync(outputDir, {
        recursive: true
    });

    return outputDir;
}

/*
 * Keep all master dimensions first, but also retain any new dimension
 * returned by the existing geometry engine so no calculated value is lost.
 */
function getDimensionNames(successfulCalculations = []) {
    const names = new Set(MASTER_DIMENSIONS);

    successfulCalculations.forEach(item => {
        const dimensions = item.normalizedDimensions || {};

        Object.keys(dimensions).forEach(name => {
            names.add(name);
        });
    });

    const additionalDimensions = [...names]
        .filter(name => !MASTER_DIMENSIONS.includes(name))
        .sort();

    return [
        ...MASTER_DIMENSIONS,
        ...additionalDimensions
    ];
}

function toDisplayName(value) {
    return String(value || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, character => character.toUpperCase());
}

function getDimensionValue(result, dimensionName) {
    const dimension = result.normalizedDimensions?.[dimensionName];

    if (dimension === undefined || dimension === null || dimension === "") {
        return 0;
    }

    /* Supports both original { value, unit } objects and direct numbers. */
    const rawValue =
        typeof dimension === "object"
            ? dimension.value
            : dimension;

    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return 0;
    }

    const numericValue = Number(rawValue);

    /* Preserve non-numeric engine output rather than silently deleting it. */
    return Number.isFinite(numericValue)
        ? numericValue
        : rawValue;
}

function getSourceDimensions(result) {
    return Object.entries(result.providedDimensions || {})
        .map(([key, value]) => {
            if (value && typeof value === "object") {
                return `${key}=${value.value ?? ""} ${value.unit ?? ""}`.trim();
            }

            return `${key}=${value ?? ""}`;
        })
        .join(", ");
}

function getUploadMetadata(batchResult = {}, uploadMetadata = {}) {
    const embeddedMetadata =
        batchResult.uploadMetadata ||
        batchResult.metadata ||
        batchResult.classification ||
        {};

    return {
        project:
            uploadMetadata.project ??
            embeddedMetadata.project ??
            batchResult.project ??
            "",

        building:
            uploadMetadata.building ??
            uploadMetadata.buildingName ??
            embeddedMetadata.building ??
            embeddedMetadata.buildingName ??
            batchResult.building ??
            batchResult.buildingName ??
            "",

        buildingShortName:
            uploadMetadata.buildingShortName ??
            uploadMetadata.buildingAbbreviation ??
            embeddedMetadata.buildingShortName ??
            embeddedMetadata.buildingAbbreviation ??
            batchResult.buildingShortName ??
            batchResult.buildingAbbreviation ??
            "",
        approvedDrawingNumber:
            uploadMetadata.approvedDrawingNumber ??
            uploadMetadata.originalFileName ??
            ""
    };
}

function safeFilePart(value) {
    return String(value || "")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "_");
}

function getOutputFileName(metadata) {
    const parts = [
        metadata.project,
        metadata.buildingShortName,
        "quantity-results"
    ]
        .map(safeFilePart)
        .filter(Boolean);

    return `${parts.join("_") || "quantity-results"}.xlsx`;
}


const SCOPE_MASTER_HEADERS = [
    "Project", "Building Name", "Discipline", "RL", "Ref RL", "Activity",
    "Sub Activity", "Element Part Mark", "Grid", "L4 Top Level", "Shape",
    "Grade", "Bottom Level", "Top Level", "Count", "Length", "Breadth",
    "Dia", "Height", "Area Section", "Concrete qty gross", "Deduction volume",
    "Concrete qty net", "Area shuttering gross", "Deduction area shuttering",
    "Area shuttering net", "Drawing reference 1", "Drawing reference 2",
    "Drawing reference 3", "Drawing reference 4", "Issued Date", "Release Date",
    "Revision Number", "Activity Mapping", "Remarks mapping", "All Dimensions"
];

function normalizedName(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function dimensionToMeters(value) {
    const raw = value && typeof value === "object" ? value.value : value;
    const unit = value && typeof value === "object"
        ? String(value.unit || "mm").toLowerCase()
        : "m";
    const number = Number(raw);
    if (!Number.isFinite(number)) return "";
    if (unit === "mm") return number / 1000;
    if (unit === "cm") return number / 100;
    return number;
}

function getSourceDimension(result, aliases) {
    const entries = Object.entries(result.providedDimensions || {});
    for (const alias of aliases) {
        const found = entries.find(([key]) => normalizedName(key) === normalizedName(alias));
        if (found) {
            const value = dimensionToMeters(found[1]);
            if (value !== "") return value;
        }
    }
    return "";
}

function getNormalizedDimension(result, names) {
    for (const name of names) {
        const item = result.normalizedDimensions?.[name];
        const raw = item && typeof item === "object" ? item.value : item;
        const number = Number(raw);
        if (Number.isFinite(number)) return number;
    }
    return "";
}

function getScopeDimensions(result) {
    const length = getSourceDimension(result, ["length", "len", "l"]);
    const breadth = getSourceDimension(result, ["breadth", "width", "b"]);
    const dia = getSourceDimension(result, ["dia", "diameter"]);
    const height = getSourceDimension(result, ["height", "depth", "ht", "h"]);
    return {
        length: length !== "" ? length : getNormalizedDimension(result, ["length"]),
        breadth: breadth !== "" ? breadth : getNormalizedDimension(result, ["width"]),
        dia,
        height: height !== "" ? height : getNormalizedDimension(result, ["height", "depth", "outerHeight"]),
        areaSection: getNormalizedDimension(result, ["area", "baseArea"])
    };
}

function getAllDimensions(result) {
    const parts = [];
    Object.entries(result.normalizedDimensions || {}).forEach(([name, item]) => {
        const raw = item && typeof item === "object" ? item.value : item;
        const number = Number(raw);
        if (Number.isFinite(number)) parts.push(`${name}=${number.toFixed(3)}`);
    });
    return parts.length ? `(${parts.join(", ")})` : "";
}

function getFormattedGrade(result) {
    const grade = Number(
        result.concreteGrade
    );

    if (
        !Number.isFinite(grade) ||
        grade <= 0
    ) {
        return "";
    }

    const category = String(
        result.concreteCategory || ""
    ).trim();

    return category
        ? `M-${grade} ${category}`
        : `M-${grade}`;
}

const ACTIVITY_SUBACTIVITY_MASTER_FILE = path.join(
    __dirname,
    "config",
    "activity_subactivity_master.csv"
);

let activitySubactivityMasterCache = null;

function parseCsvText(csvText) {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
        const character = csvText[index];
        const nextCharacter = csvText[index + 1];

        if (character === '"') {
            if (insideQuotes && nextCharacter === '"') {
                value += '"';
                index += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (character === "," && !insideQuotes) {
            row.push(value);
            value = "";
            continue;
        }

        if ((character === "\n" || character === "\r") && !insideQuotes) {
            if (character === "\r" && nextCharacter === "\n") {
                index += 1;
            }
            row.push(value);
            if (row.some(cell => String(cell).trim() !== "")) {
                rows.push(row);
            }
            row = [];
            value = "";
            continue;
        }

        value += character;
    }

    row.push(value);
    if (row.some(cell => String(cell).trim() !== "")) {
        rows.push(row);
    }

    return rows;
}

function normalizeMappingText(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/_/g, " ")
        .replace(/[^A-Z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function loadActivitySubactivityMaster() {
    if (activitySubactivityMasterCache) {
        return activitySubactivityMasterCache;
    }

    if (!fs.existsSync(ACTIVITY_SUBACTIVITY_MASTER_FILE)) {
        console.warn(
            "Activity/Sub Activity master not found:",
            ACTIVITY_SUBACTIVITY_MASTER_FILE
        );
        activitySubactivityMasterCache = [];
        return activitySubactivityMasterCache;
    }

    const csvText = fs.readFileSync(
        ACTIVITY_SUBACTIVITY_MASTER_FILE,
        "utf8"
    );
    const rows = parseCsvText(csvText);

    if (!rows.length) {
        activitySubactivityMasterCache = [];
        return activitySubactivityMasterCache;
    }

    const headers = rows[0].map(value => String(value).trim());
    const buildingIndex = headers.indexOf("Building name");
    const activityIndex = headers.indexOf("Activity (Element Type)");
    const subActivityIndex = headers.indexOf("Sub Activity (Element Part)");

    if (
        buildingIndex < 0 ||
        activityIndex < 0 ||
        subActivityIndex < 0
    ) {
        console.warn(
            "Activity/Sub Activity master has unsupported headers."
        );
        activitySubactivityMasterCache = [];
        return activitySubactivityMasterCache;
    }

    activitySubactivityMasterCache = rows
        .slice(1)
        .map(row => ({
            building: String(row[buildingIndex] || "").trim(),
            activity: String(row[activityIndex] || "").trim(),
            subActivity: String(row[subActivityIndex] || "").trim()
        }))
        .filter(item =>
            item.building &&
            item.activity &&
            item.subActivity
        );

    return activitySubactivityMasterCache;
}

function getResultThicknessMm(result) {
    const directThickness = getNormalizedDimension(
        result,
        ["thickness"]
    );

    if (directThickness !== "") {
        return directThickness * 1000;
    }

    const outerRadius = getNormalizedDimension(
        result,
        ["outerRadius"]
    );
    const innerRadius = getNormalizedDimension(
        result,
        ["innerRadius"]
    );

    if (outerRadius !== "" && innerRadius !== "") {
        return Math.abs(outerRadius - innerRadius) * 1000;
    }

    return null;
}

function getActivityHint(referenceElement) {
    const reference = normalizeMappingText(referenceElement);

    if (/\b(RAFT|FOOTING|FOUNDATION|PCC)\b/.test(reference)) {
        return ["FOOTING", "FOUNDATION"];
    }
    if (/\bPEDESTAL\b/.test(reference)) {
        return ["PEDESTAL", "FOOTING"];
    }
    if (/\b(CONE WALL|SHELL WALL|WALL)\b/.test(reference)) {
        return ["WALL"];
    }
    if (/\b(RING BEAM|PLINTH BEAM|BEAM)\b/.test(reference)) {
        return ["BEAM"];
    }
    if (/\bSLAB\b/.test(reference)) {
        return ["SLAB"];
    }
    if (/\bCOLUMN\b/.test(reference)) {
        return ["COLUMN"];
    }

    return [];
}

function getWordTokens(value) {
    const ignoredWords = new Set([
        "THE", "OF", "AND", "PART", "ELEMENT"
    ]);

    return normalizeMappingText(value)
        .split(" ")
        .filter(token =>
            token &&
            !ignoredWords.has(token)
        );
}

function scoreActivitySubactivityCandidate(
    candidate,
    result
) {
    const reference = normalizeMappingText(
        result.referenceElement
    );
    const activity = normalizeMappingText(
        candidate.activity
    );
    const subActivity = normalizeMappingText(
        candidate.subActivity
    );
    const activityHints = getActivityHint(reference);
    let score = 0;

    if (activityHints.includes(activity)) {
        score += 45;
    }

    if (subActivity === reference) {
        score += 100;
    } else if (
        subActivity.includes(reference) ||
        reference.includes(subActivity)
    ) {
        score += 70;
    }

    const referenceTokens = new Set(
        getWordTokens(reference)
    );
    const subActivityTokens = getWordTokens(
        subActivity
    );
    const overlappingTokens = subActivityTokens.filter(
        token => referenceTokens.has(token)
    );

    score += overlappingTokens.length * 15;

    if (reference.includes("RAFT") && subActivity.includes("SILO RAFT")) {
        score += 90;
    }
    if (reference.includes("CONE WALL") && subActivity.includes("SILO CONE WALL")) {
        score += 90;
    }
    if (reference.includes("RING BEAM") && subActivity.includes("SILO RING BEAM")) {
        score += 90;
    }
    if (reference.includes("PLINTH BEAM") && subActivity.includes("PLINTH BEAM")) {
        score += 90;
    }
    if (reference.includes("TOP SLAB") && subActivity.includes("TOP SLAB")) {
        score += 90;
    }

    if (
        reference.includes("SHELL WALL") &&
        subActivity.includes("SHELL WALL")
    ) {
        score += 55;

        const thicknessMm = getResultThicknessMm(result);
        const thicknessMatch = subActivity.match(/\b(\d{2,4})\s*TH\b/);

        if (thicknessMm !== null && thicknessMatch) {
            const masterThicknessMm = Number(thicknessMatch[1]);
            const difference = Math.abs(
                thicknessMm - masterThicknessMm
            );

            if (difference <= 25) {
                score += 120;
            } else if (difference <= 75) {
                score += 50;
            } else {
                score -= 60;
            }
        }
    }

    return score;
}

function matchActivitySubactivity(result, metadata) {
    const building = normalizeMappingText(metadata.building);
    const referenceElement = String(
        result.referenceElement || ""
    ).trim();

    if (!building || !referenceElement) {
        return {
            activity: "",
            subActivity: "",
            matched: false
        };
    }

    const buildingCandidates = loadActivitySubactivityMaster()
        .filter(item =>
            normalizeMappingText(item.building) === building
        );

    if (!buildingCandidates.length) {
        console.warn(
            `No Activity/Sub Activity master rows found for building: ${metadata.building}`
        );
        return {
            activity: "",
            subActivity: "",
            matched: false
        };
    }

    const rankedCandidates = buildingCandidates
        .map(candidate => ({
            ...candidate,
            score: scoreActivitySubactivityCandidate(
                candidate,
                result
            )
        }))
        .sort((left, right) =>
            right.score - left.score
        );

    const bestMatch = rankedCandidates[0];

    if (!bestMatch || bestMatch.score < 60) {
        console.warn(
            `No approved Activity/Sub Activity match for ${metadata.building}: ${referenceElement}`
        );
        return {
            activity: "",
            subActivity: "",
            matched: false
        };
    }

    return {
        activity: bestMatch.activity,
        subActivity: bestMatch.subActivity,
        matched: true
    };
}

function getScopeMasterRow(result, metadata) {
    const d = getScopeDimensions(result);
    const activityMapping = matchActivitySubactivity(
        result,
        metadata
    );
    const volume = Number(result.volume || 0);
    const shuttering = Number(result.shutteringArea || 0);
    const deduction = Boolean(result.isDeduction);
    return [
        metadata.project, metadata.building, "Civil",
        result.fromRefLevel ?? "", result.toRefLevel ?? "",
        activityMapping.activity,
        activityMapping.subActivity,
        result.referenceElement ?? "", result.gridLocation ?? "",
        result.toRefLevel ?? "", result.shape ?? "",
        getFormattedGrade(result), result.fromRefLevel ?? "",
        result.toRefLevel ?? "", 1, d.length, d.breadth, d.dia, d.height,
        d.areaSection, deduction ? 0 : Math.max(volume, 0),
        deduction ? Math.abs(volume) : 0, volume,
        deduction ? 0 : Math.max(shuttering, 0),
        deduction ? Math.abs(shuttering) : 0, shuttering,
        result.pdfFileName || metadata.approvedDrawingNumber,
        "", "", "", "", "", "", "", "", getAllDimensions(result)
    ];
}

function formatScopeMasterSheet(sheet) {
    styleHeader(sheet);
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 3 }];
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: SCOPE_MASTER_HEADERS.length }
    };
    sheet.columns.forEach((column, index) => {
        const header = SCOPE_MASTER_HEADERS[index];
        if (header === "All Dimensions") column.width = 54;
        else if (header && header.startsWith("Drawing reference")) column.width = 26;
        else column.width = 17;
    });
    ["RL", "Ref RL", "L4 Top Level", "Bottom Level", "Top Level", "Length",
     "Breadth", "Dia", "Height", "Area Section", "Concrete qty gross",
     "Deduction volume", "Concrete qty net", "Area shuttering gross",
     "Deduction area shuttering", "Area shuttering net"].forEach(header => {
        sheet.getColumn(SCOPE_MASTER_HEADERS.indexOf(header) + 1).numFmt = "0.000";
    });
}

function styleHeader(sheet) {
    const headerRow = sheet.getRow(1);

    headerRow.height = 30;

    headerRow.eachCell(cell => {
        cell.font = {
            bold: true,
            color: {
                argb: "FF1A1A1A"
            }
        };

        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
                argb: "FFFFE600"
            }
        };

        cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true
        };

        cell.border = {
            top: {
                style: "thin",
                color: { argb: "FFB7B7B7" }
            },
            left: {
                style: "thin",
                color: { argb: "FFB7B7B7" }
            },
            bottom: {
                style: "thin",
                color: { argb: "FFB7B7B7" }
            },
            right: {
                style: "thin",
                color: { argb: "FFB7B7B7" }
            }
        };
    });
}

function formatQuantitySheet(
    sheet,
    headers,
    dimensionNames
) {
    styleHeader(sheet);

    sheet.views = [
        {
            state: "frozen",
            ySplit: 1,
            xSplit: 3
        }
    ];

    sheet.autoFilter = {
        from: {
            row: 1,
            column: 1
        },
        to: {
            row: 1,
            column: headers.length
        }
    };

    sheet.columns.forEach(
        (column, index) => {
            const header =
                headers[index];

            if (index < 3) {
                column.width = 22;
            } else if (
                header === "Source Annotation" ||
                header === "Source Dimensions"
            ) {
                column.width = 38;
            } else if (
                header === "Shuttering Rule Applied" ||
                header === "Shuttering Review Reason"
            ) {
                column.width = 34;
            } else if (
                header === "Grade of Concrete" ||
                header === "Concrete Category" ||
                header === "Shuttering Status"
            ) {
                column.width = 20;
            } else {
                column.width = 18;
            }
        }
    );

    const dimensionStartColumn =
        headers.indexOf(
            `${toDisplayName(
                dimensionNames[0]
            )} (m)`
        ) + 1;

    const dimensionEndColumn =
        dimensionStartColumn +
        dimensionNames.length -
        1;

    sheet.getColumn(7).numFmt =
        "0.000";

    sheet.getColumn(8).numFmt =
        "0.000";

    for (
        let columnNumber =
            dimensionStartColumn;
        columnNumber <=
            dimensionEndColumn;
        columnNumber += 1
    ) {
        sheet.getColumn(
            columnNumber
        ).numFmt = "0.000";
    }

    [
        "Volume (m3)",
        "Total Geometric Area (m2)",
        "Side Face Area (m2)",
        "Top Face Area (m2)",
        "Bottom Face Area (m2)",
        "Outer Side Area (m2)",
        "Inner Side Area (m2)",
        "Shuttering Area (m2)"
    ].forEach(header => {
        const columnNumber =
            headers.indexOf(header) + 1;

        if (columnNumber > 0) {
            sheet.getColumn(
                columnNumber
            ).numFmt = "0.000";
        }
    });

    const matchScoreColumn =
        headers.indexOf(
            "Match Score"
        ) + 1;

    if (matchScoreColumn > 0) {
        sheet.getColumn(
            matchScoreColumn
        ).numFmt = "0.00";
    }
}

/*
 * Backward compatible signatures:
 *
 * generateWorkbook(batchResult, annotations)
 * generateWorkbook(batchResult, annotations, uploadMetadata)
 */
async function generateWorkbook(
    batchResult,
    annotations = [],
    uploadMetadata = {}
) {
    if (!batchResult || typeof batchResult !== "object") {
        throw new Error("A valid batchResult object is required.");
    }

    const workbook = new ExcelJS.Workbook();

    const successful =
        Array.isArray(batchResult.successfulCalculations)
            ? batchResult.successfulCalculations
            : [];

    const review =
        Array.isArray(batchResult.reviewItems)
            ? batchResult.reviewItems
            : [];

    const summary =
        batchResult.summary || {};

    const metadata =
        getUploadMetadata(
            batchResult,
            uploadMetadata
        );

    //--------------------------------------------------
    // QUANTITY RESULTS
    //--------------------------------------------------

    const quantitySheet =
        workbook.addWorksheet(
            "Quantity Results"
        );

    const dimensionNames =
        getDimensionNames(
            successful
        );

    const headers = [
        "Project",
        "Building",
        "Building Short Name",
        "Entry Type",
        "Reference Element",
        "Grid Location",
                "From Ref Level (m)",
        "To Ref Level (m)",
        "Grade of Concrete",
        "Concrete Category",
        "Shape",
        "Shape ID",
        "Source Annotation",
        "Source Dimensions",
        ...dimensionNames.map(
            dimensionName =>
                `${toDisplayName(dimensionName)} (m)`
        ),
        "Volume (m3)",
        "Total Geometric Area (m2)",
        "Side Face Area (m2)",
        "Top Face Area (m2)",
        "Bottom Face Area (m2)",
        "Outer Side Area (m2)",
        "Inner Side Area (m2)",
        "Shuttering Rule Applied",
        "Shuttering Status",
        "Shuttering Review Reason",
        "Shuttering Area (m2)",
        "Match Type",
        "Match Score"
    ];

    quantitySheet.addRow(headers);

    successful.forEach(result => {
        const row = [
            metadata.project,
            metadata.building,
            metadata.buildingShortName,

            result.entryType ||
                (result.isDeduction
                    ? "Deduction"
                    : "Addition"),

            result.referenceElement ?? "",
            result.gridLocation ?? "",
                        result.fromRefLevel ?? "",
            result.toRefLevel ?? "",
            getFormattedGrade(result),
            result.concreteCategory ?? "",
            result.shape ?? "",
            result.shapeId ?? "",
            result.sourceText ?? "",
            getSourceDimensions(result)
        ];

        dimensionNames.forEach(dimensionName => {
            row.push(
                getDimensionValue(
                    result,
                    dimensionName
                )
            );
        });

        /* Preserve original calculated values exactly, including zero. */
        row.push(
            result.volume ?? 0,
            result.area ?? 0,
            result.sideFaceArea ?? 0,
            result.topFaceArea ?? 0,
            result.bottomFaceArea ?? 0,
            result.outerSideArea ?? 0,
            result.innerSideArea ?? 0,
            result.shutteringRuleApplied ?? "",
            result.shutteringStatus ?? "",
            result.shutteringReviewReason ?? "",
            result.shutteringArea ?? "",
            result.matchType ?? "",
            result.matchScore ?? 0
        );

        const excelRow =
            quantitySheet.addRow(row);

        excelRow.height = 22;
        excelRow.alignment = {
            vertical: "middle",
            wrapText: true
        };

        if (result.isDeduction) {
            excelRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: "FFFDE9E7"
                }
            };

            excelRow.font = {
                color: {
                    argb: "FFC00000"
                }
            };
        }
    });

    formatQuantitySheet(
        quantitySheet,
        headers,
        dimensionNames
    );

    //--------------------------------------------------
    // SCOPE MASTER UPLOAD
    //--------------------------------------------------
    const scopeMasterSheet = workbook.addWorksheet("Scope Master Upload");
    scopeMasterSheet.addRow(SCOPE_MASTER_HEADERS);
    successful.forEach(result => {
        const row = scopeMasterSheet.addRow(getScopeMasterRow(result, metadata));
        row.height = 22;
        row.alignment = { vertical: "middle", wrapText: true };
        if (result.isDeduction) {
            row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE9E7" } };
        }
    });
    formatScopeMasterSheet(scopeMasterSheet);

    //--------------------------------------------------
    // REVIEW SHEET - ORIGINAL LOGIC RETAINED
    //--------------------------------------------------

    const reviewSheet =
        workbook.addWorksheet(
            "Review Required"
        );

    reviewSheet.addRow([
        "Project",
        "Building",
        "Building Short Name",
        "Annotation",
        "Grid Location",
        "Reason"
    ]);

    review.forEach(item => {
        reviewSheet.addRow([
            metadata.project,
            metadata.building,
            metadata.buildingShortName,
            item.sourceText ?? "",
            item.gridLocation ?? "",
            item.reason ?? ""
        ]);
    });

    styleHeader(reviewSheet);
    reviewSheet.columns.forEach(column => {
        column.width = 24;
    });
    reviewSheet.getColumn(4).width = 60;
    reviewSheet.getColumn(6).width = 50;

    //--------------------------------------------------
    // SUMMARY SHEET - ORIGINAL LOGIC RETAINED
    //--------------------------------------------------

    const summarySheet =
        workbook.addWorksheet(
            "Summary"
        );

    summarySheet.addRow([
        "Metric",
        "Value"
    ]);

    summarySheet.addRow([
        "Project",
        metadata.project
    ]);

    summarySheet.addRow([
        "Building",
        metadata.building
    ]);

    summarySheet.addRow([
        "Building Short Name",
        metadata.buildingShortName
    ]);

    summarySheet.addRow([
        "Total Annotations",
        summary.totalAnnotations ?? annotations.length
    ]);

    summarySheet.addRow([
        "Successful",
        summary.successfulCount ?? successful.length
    ]);

    summarySheet.addRow([
        "Review Required",
        summary.reviewCount ?? review.length
    ]);

    const totalAdditions =
        successful
            .filter(item => !item.isDeduction)
            .reduce(
                (sum, item) =>
                    sum + Number(item.volume || 0),
                0
            );

    const totalDeductions =
        successful
            .filter(item => item.isDeduction)
            .reduce(
                (sum, item) =>
                    sum + Math.abs(
                        Number(item.volume || 0)
                    ),
                0
            );

    summarySheet.addRow([
        "Total Additions",
        totalAdditions
    ]);

    summarySheet.addRow([
        "Total Deductions",
        totalDeductions
    ]);

    summarySheet.addRow([
        "Net Volume",
        totalAdditions - totalDeductions
    ]);

    summarySheet.addRow([
        "Total Geometric Area",
        summary.totalArea ??
            successful.reduce(
                (sum, item) =>
                    sum + Number(item.area || 0),
                0
            )
    ]);

    summarySheet.addRow([
        "Total Shuttering Area",
        summary.totalShutteringArea ??
            successful.reduce(
                (sum, item) =>
                    sum + Number(
                        item.shutteringArea || 0
                    ),
                0
            )
    ]);

    summarySheet.addRow([
        "Shuttering Calculated",
        summary.shutteringCalculatedCount ??
            successful.filter(
                item =>
                    item.shutteringStatus ===
                    "Calculated"
            ).length
    ]);

    summarySheet.addRow([
        "Shuttering Review Required",
        summary.shutteringReviewCount ??
            successful.filter(
                item =>
                    item.shutteringStatus ===
                    "Review Required"
            ).length
    ]);

    styleHeader(summarySheet);
    summarySheet.getColumn(1).width = 28;
    summarySheet.getColumn(2).width = 38;

    //--------------------------------------------------
    // RAW ANNOTATIONS - ORIGINAL LOGIC RETAINED
    //--------------------------------------------------

    const rawSheet =
        workbook.addWorksheet(
            "Raw Annotations"
        );

    rawSheet.addRow([
        "Project",
        "Building",
        "Building Short Name",
        "Annotation"
    ]);

    annotations.forEach(annotation => {
        rawSheet.addRow([
            metadata.project,
            metadata.building,
            metadata.buildingShortName,
            typeof annotation === "string"
                ? annotation
                : annotation.text ||
                  annotation.sourceText ||
                  JSON.stringify(annotation)
        ]);
    });

    styleHeader(rawSheet);
    rawSheet.getColumn(1).width = 22;
    rawSheet.getColumn(2).width = 32;
    rawSheet.getColumn(3).width = 24;
    rawSheet.getColumn(4).width = 95;

    //--------------------------------------------------
    // OUTPUT
    //--------------------------------------------------

    const outputDir =
        ensureOutputDir();

    const outputPath =
        path.join(
            outputDir,
            getOutputFileName(metadata)
        );

    await workbook.xlsx.writeFile(
        outputPath
    );

    return outputPath;
}

module.exports = {
    generateWorkbook,
    MASTER_DIMENSIONS
};
