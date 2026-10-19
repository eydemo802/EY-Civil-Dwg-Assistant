const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const {
    runQuantityWorkflow
} = require("./QuantityWorkflow");

const app = express();

app.use(cors());
app.use(express.json());

//--------------------------------------------------
// PATHS
//--------------------------------------------------

const PROJECT_ROOT =
    path.join(
        __dirname,
        ".."
    );

const uploadDir =
    path.join(
        PROJECT_ROOT,
        "uploads"
    );

fs.mkdirSync(
    uploadDir,
    {
        recursive: true
    }
);

app.use(
    express.static(
        PROJECT_ROOT
    )
);

//--------------------------------------------------
// FILE UPLOAD
//--------------------------------------------------

const storage =
    multer.diskStorage({

        destination(
            req,
            file,
            cb
        ) {

            cb(
                null,
                uploadDir
            );
        },

        filename(
            req,
            file,
            cb
        ) {

            const fileName =
                Date.now() +
                "-" +
                file.originalname.replace(
                    /\s+/g,
                    "_"
                );

            cb(
                null,
                fileName
            );
        }
    });

const upload =
    multer({
        storage
    });

//--------------------------------------------------
// HEALTH CHECK
//--------------------------------------------------

app.get(
    "/health",
    function (
        req,
        res
    ) {

        res.json({

            success: true,

            status: "ok"
        });
    }
);

//--------------------------------------------------
// UPLOAD ROUTE
//--------------------------------------------------

app.post(
    "/upload",
    upload.single("pdf"),
    async function (
        req,
        res
    ) {

        try {

            if (!req.file) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "No PDF file was provided."
                    });
            }

            console.log(
                "================================"
            );

            console.log(
                "PDF RECEIVED:"
            );

            console.log(
                req.file.originalname
            );

            console.log(
                "================================"
            );
            const uploadMetadata = {
                project:
                    String(
                        req.body?.project ||
                        ""
                    ).trim(),

                building:
                    String(
                        req.body?.building ||
                        ""
                    ).trim(),

                buildingShortName:
                    String(
                        req.body?.buildingShortName ||
                        ""
                    ).trim()
            };

            console.log(
                "UPLOAD METADATA:",
                uploadMetadata
            );

            const result =
                await runQuantityWorkflow(
                    req.file.path,
                    req.file.originalname,
                    uploadMetadata
                );

            const generatedFileName =
                path.basename(
                    result.excelFile
                );

            return res.json({

                success: true,

                message:
                    "Quantities generated successfully.",

                pdfFileName:
                    result.pdfFileName,

                project:
                    result.project,

                building:
                    result.building,

                buildingShortName:
                    result.buildingShortName,

                pageCount:
                    result.pageCount,

                annotationCount:
                    result.annotationCount,

                successfulCount:
                    result.batchResult.summary.successfulCount,

                reviewCount:
                    result.batchResult.summary.reviewCount,

                totalVolume:
                    result.batchResult.summary.totalVolume,

                totalArea:
                    result.batchResult.summary.totalArea,

                outputFile:
                    generatedFileName,

                downloadUrl:
                    `/download/${encodeURIComponent(
                        generatedFileName
                    )}`
            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:"
            );

            console.error(
                error
            );

            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        error.message
                });
        }
    }
);

//--------------------------------------------------
// DOWNLOAD ROUTE
//--------------------------------------------------

app.get(
    "/download/:fileName",
    function (
        req,
        res
    ) {

        const fileName =
            path.basename(
                req.params.fileName
            );

        const filePath =
            path.join(
                PROJECT_ROOT,
                "output",
                fileName
            );

        if (
            !fs.existsSync(
                filePath
            )
        ) {

            return res
                .status(404)
                .json({

                    success: false,

                    message:
                        "Workbook not found."
                });
        }

        return res.download(
            filePath,
            fileName
        );
    }
);

//--------------------------------------------------
// START SERVER
//--------------------------------------------------

const PORT =
    process.env.PORT ||
    4012;

app.listen(
    PORT,
    function () {

        console.log(
            "================================"
        );

        console.log(
            "EY DWG Assistant"
        );

        console.log(
            "Geometry Quantity Engine Running"
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "================================"
        );
    }
);
