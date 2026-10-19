const fs = require("fs");
const path = require("path");

const {
    extractVectorSegmentsFromBuffer
} = require("./geometry/vectorPathExtractor");

async function loadPdfJs() {
    try {
        return require("pdfjs-dist/legacy/build/pdf.js");
    } catch (commonJsError) {
        try {
            return await import(
                "pdfjs-dist/legacy/build/pdf.mjs"
            );
        } catch (moduleError) {
            return null;
        }
    }
}

function decodeAutoCadGlyphText(text) {
    if (!text) {
        return "";
    }

    let decoded = "";

    for (const character of text) {
        const characterCode =
            character.charCodeAt(0);

        if (
            characterCode >= 0xF000 &&
            characterCode <= 0xF0FF
        ) {
            const asciiCode =
                characterCode & 0xff;

            if (
                asciiCode >= 32 &&
                asciiCode <= 126
            ) {
                decoded +=
                    String.fromCharCode(
                        asciiCode
                    );
            } else {
                decoded += character;
            }
        } else {
            decoded += character;
        }
    }

    return decoded;
}

function normalizeText(text) {
    return decodeAutoCadGlyphText(
        text || ""
    )
        .replace(/\r/g, "\n")
        .replace(/\u00A0/g, " ")
        .replace(/\u202F/g, " ")
        .replace(/×/g, "x")
        .replace(/[ \t]+/g, " ")
        .trim();
}

function normalizeSingleItemText(text) {
    return decodeAutoCadGlyphText(
        text || ""
    )
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/\u202F/g, " ")
        .replace(/×/g, "x")
        .replace(/[ \t]+/g, " ")
        .trim();
}

function splitLines(text) {
    return String(text || "")
        .split(/\r?\n/)
        .map(function (line) {
            return line.trim();
        })
        .filter(Boolean);
}

function buildTextFromPositionedItems(
    textItems
) {
    if (
        !Array.isArray(textItems) ||
        textItems.length === 0
    ) {
        return "";
    }

    const sorted =
        textItems
            .slice()
            .sort(function (
                first,
                second
            ) {
                if (
                    first.pageNumber !==
                    second.pageNumber
                ) {
                    return (
                        first.pageNumber -
                        second.pageNumber
                    );
                }

                const yDifference =
                    Math.abs(
                        Number(second.y || 0) -
                        Number(first.y || 0)
                    );

                if (yDifference > 3) {
                    return (
                        Number(second.y || 0) -
                        Number(first.y || 0)
                    );
                }

                return (
                    Number(first.x || 0) -
                    Number(second.x || 0)
                );
            });

    let output = "";
    let lastPage = null;
    let lastY = null;

    for (const item of sorted) {
        const text =
            normalizeSingleItemText(
                item.text
            );

        if (!text) {
            continue;
        }

        if (
            lastPage !==
            item.pageNumber
        ) {
            if (output) {
                output += "\n";
            }

            output +=
                "PAGE " +
                item.pageNumber +
                "\n";

            lastPage =
                item.pageNumber;

            lastY =
                item.y;
        } else {
            const yDifference =
                Math.abs(
                    Number(item.y || 0) -
                    Number(lastY || 0)
                );

            if (yDifference > 3) {
                output += "\n";
            } else {
                output += " ";
            }

            lastY =
                item.y;
        }

        output += text;
    }

    return output.trim();
}

async function extractTextItemsWithPdfJs(
    buffer
) {
    const pdfjsLib =
        await loadPdfJs();

    if (!pdfjsLib) {
        return {
            success: false,
            textItems: [],
            rawTextFromItems: "",
            pageCount: 1,
            reason:
                "pdfjs-dist not available"
        };
    }

    try {
        const loadingTask =
            pdfjsLib.getDocument({
                data:
                    new Uint8Array(
                        buffer
                    ),

                disableWorker:
                    true,

                useSystemFonts:
                    true
            });

        const pdf =
            await loadingTask.promise;

        const textItems = [];

        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {
            const page =
                await pdf.getPage(
                    pageNumber
                );

            const viewport =
                page.getViewport({
                    scale: 1
                });

            const content =
                await page.getTextContent();

            for (
                let index = 0;
                index <
                    content.items.length;
                index++
            ) {
                const item =
                    content.items[index];

                const raw =
                    item.str || "";

                const clean =
                    normalizeSingleItemText(
                        raw
                    );

                if (!clean) {
                    continue;
                }

                let x = 0;
                let y = 0;

                let width =
                    Number(
                        item.width || 0
                    );

                let height =
                    Number(
                        item.height || 0
                    );

                try {
                    const transformed =
                        pdfjsLib.Util
                            .transform(
                                viewport.transform,
                                item.transform
                            );

                    x =
                        Number(
                            transformed[4] || 0
                        );

                    y =
                        Number(
                            transformed[5] || 0
                        );

                    if (
                        !height &&
                        item.transform &&
                        item.transform.length >= 4
                    ) {
                        height =
                            Math.abs(
                                Number(
                                    item.transform[3] ||
                                    0
                                )
                            );
                    }
                } catch (
                    coordinateError
                ) {
                    if (
                        item.transform &&
                        item.transform.length >= 6
                    ) {
                        x =
                            Number(
                                item.transform[4] ||
                                0
                            );

                        y =
                            Number(
                                item.transform[5] ||
                                0
                            );
                    }
                }

                textItems.push({
                    pageNumber,
                    index,

                    text:
                        clean,

                    rawText:
                        raw,

                    x,
                    y,
                    width,
                    height,
                    hasEOL: Boolean(item.hasEOL),
                    fontName: item.fontName || "",
                    direction: item.dir || "",
                    transform: Array.isArray(item.transform)
                        ? item.transform.slice()
                        : [],
                    pageWidth: Number(viewport.width || 0),
                    pageHeight: Number(viewport.height || 0)
                });
            }
        }

        return {
            success: true,

            textItems,

            rawTextFromItems:
                buildTextFromPositionedItems(
                    textItems
                ),

            pageCount:
                pdf.numPages,

            reason: ""
        };
    } catch (error) {
        return {
            success: false,

            textItems: [],

            rawTextFromItems: "",

            pageCount: 1,

            reason:
                error.message
        };
    }
}

async function extractTextWithPdfParse(
    buffer
) {
    const {
        PDFParse
    } = require("pdf-parse");

    const parser =
        new PDFParse({
            data: buffer,
            verbosity: 0
        });

    const result =
        await parser.getText();

    return {
        rawText:
            result.text || "",

        pageCount:
            result.pages
                ? result.pages.length
                : 1
    };
}

async function extractVectorGeometry(
    buffer
) {
    try {
        const result =
            await extractVectorSegmentsFromBuffer(
                buffer,
                {
                    scale: 1,
                    minimumLength: 0.5
                }
            );

        return {
            success:
                Boolean(result.success),

            vectorSegments:
                Array.isArray(
                    result.vectorSegments
                )
                    ? result.vectorSegments
                    : [],

            pages:
                Array.isArray(
                    result.pages
                )
                    ? result.pages
                    : [],

            diagnostics:
                result.diagnostics || {},

            reason:
                result.reason || ""
        };
    } catch (error) {
        console.error(
            "VECTOR EXTRACTION FAILED:"
        );

        console.error(
            error.message
        );

        return {
            success: false,

            vectorSegments: [],

            pages: [],

            diagnostics: {},

            reason:
                error.message
        };
    }
}

function writeDebugFile(
    outputDir,
    fileName,
    content
) {
    const filePath =
        path.join(
            outputDir,
            fileName
        );

    fs.writeFileSync(
        filePath,
        content,
        "utf8"
    );

    return filePath;
}

function writeJsonDebugFile(
    outputDir,
    fileName,
    value
) {
    return writeDebugFile(
        outputDir,
        fileName,
        JSON.stringify(
            value,
            null,
            2
        )
    );
}

async function parsePdfFile(
    filePath,
    originalName
) {
    const buffer =
        fs.readFileSync(
            filePath
        );

    const outputDir =
        path.join(
            __dirname,
            "..",
            "output"
        );

    fs.mkdirSync(
        outputDir,
        {
            recursive: true
        }
    );

    const vectorResult =
        await extractVectorGeometry(
            buffer
        );

    const positionedResult =
        await extractTextItemsWithPdfJs(
            buffer
        );

    let rawText = "";
    let pageCount = 1;
    let textItems = [];

    if (
        positionedResult.success &&
        positionedResult.rawTextFromItems
    ) {
        rawText =
            positionedResult
                .rawTextFromItems;

        pageCount =
            positionedResult
                .pageCount ||
            1;

        textItems =
            positionedResult
                .textItems ||
            [];
    } else {
        const fallback =
            await extractTextWithPdfParse(
                buffer
            );

        rawText =
            fallback.rawText || "";

        pageCount =
            fallback.pageCount || 1;

        textItems = [];
    }

    const normalizedText =
        normalizeText(
            rawText
        );

    writeDebugFile(
        outputDir,
        "raw-extracted-text.txt",
        rawText
    );

    writeDebugFile(
        outputDir,
        "extracted-text.txt",
        normalizedText
    );

    writeJsonDebugFile(
        outputDir,
        "positioned-text-items.json",
        textItems
    );

    writeJsonDebugFile(
        outputDir,
        "vector-segments.json",
        vectorResult
    );

    console.log(
        "================================"
    );

    console.log(
        "PDF:",
        originalName
    );

    console.log(
        "Pages:",
        pageCount
    );

    console.log(
        "Raw Text Length:",
        rawText.length
    );

    console.log(
        "Normalized Text Length:",
        normalizedText.length
    );

    console.log(
        "Positioned Text Items:",
        textItems.length
    );

    console.log(
        "Coordinate Extraction:",
        positionedResult.success
            ? "YES"
            : "NO"
    );

    if (
        !positionedResult.success
    ) {
        console.log(
            "Coordinate Extraction Reason:",
            positionedResult.reason
        );
    }

    console.log(
        "Vector Extraction:",
        vectorResult.success
            ? "YES"
            : "NO"
    );

    console.log(
        "Vector Segments:",
        vectorResult
            .vectorSegments
            .length
    );

    if (
        vectorResult.reason
    ) {
        console.log(
            "Vector Extraction Reason:",
            vectorResult.reason
        );
    }

    console.log(
        "Vector Diagnostics:"
    );

    console.log(
        JSON.stringify(
            vectorResult.diagnostics,
            null,
            4
        )
    );

    console.log(
        "FIRST NORMALIZED SAMPLE:"
    );

    console.log(
        normalizedText.substring(
            0,
            1000
        )
    );

    console.log(
        "================================"
    );

    return {
        fileName:
            originalName,

        pageCount,

        rawText:
            normalizedText,

        originalRawText:
            rawText,

        textItems,

        vectorSegments:
            vectorResult
                .vectorSegments,

        vectorPages:
            vectorResult.pages,

        vectorDiagnostics:
            vectorResult
                .diagnostics,

        vectorExtractionSuccess:
            vectorResult.success,

        vectorExtractionReason:
            vectorResult.reason,

        pages: []
    };
}

module.exports = {
    parsePdfFile,
    normalizeText,
    normalizeSingleItemText,
    splitLines,
    decodeAutoCadGlyphText,
    buildTextFromPositionedItems,
    extractTextItemsWithPdfJs,
    extractTextWithPdfParse,
    extractVectorGeometry,
    writeDebugFile,
    writeJsonDebugFile
};  