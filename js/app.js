document.addEventListener("DOMContentLoaded", function () {

    console.log("EY DWG Assistant frontend loaded.");

    //==================================================
    // LOGIN PAGE
    //==================================================

    const passwordInput =
        document.getElementById("passwordInput");

    const passwordToggle =
        document.getElementById("passwordToggle");

    if (
        passwordInput &&
        passwordToggle
    ) {

        passwordToggle.addEventListener(
            "click",
            function () {

                const isHidden =
                    passwordInput.type ===
                    "password";

                passwordInput.type =
                    isHidden
                        ? "text"
                        : "password";

                passwordToggle.textContent =
                    isHidden
                        ? "Hide"
                        : "Show";

                passwordToggle.setAttribute(
                    "aria-label",
                    isHidden
                        ? "Hide password"
                        : "Show password"
                );
            }
        );
    }

    const loginForm =
        document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                window.location.href =
                    "pages/dashboard.html";
            }
        );
    }

    //==================================================
    // UPLOAD PAGE ELEMENTS
    //==================================================

    const dropzone =
        document.getElementById("dropzone");

    const fileInput =
        document.getElementById("pdfInput");

    const fileLabel =
        document.getElementById("fileLabel");

    const uploadButton =
        document.getElementById("uploadButton");

    const statusText =
        document.getElementById("statusText");

    const resultsSection =
        document.getElementById(
            "resultsSection"
        );

    const annotationCount =
        document.getElementById(
            "annotationCount"
        );

    const successfulCount =
        document.getElementById(
            "successfulCount"
        );

    const reviewCount =
        document.getElementById(
            "reviewCount"
        );

    const workbookName =
        document.getElementById(
            "workbookName"
        );

    const workbookTime =
        document.getElementById(
            "workbookTime"
        );

    const workbookSize =
        document.getElementById(
            "workbookSize"
        );

    const downloadButton =
        document.getElementById(
            "downloadButton"
        );

    const historyBody =
        document.getElementById(
            "historyBody"
        );

    let selectedFile = null;

    //==================================================
    // UI HELPERS
    //==================================================

    function setStatus(
        message,
        type = "normal"
    ) {

        if (!statusText) {
            return;
        }

        statusText.textContent =
            message;

        if (type === "success") {

            statusText.style.color =
                "#8fe38b";

        } else if (type === "error") {

            statusText.style.color =
                "#ff8b8b";

        } else if (
            type === "processing"
        ) {

            statusText.style.color =
                "var(--accent)";

        } else {

            statusText.style.color =
                "var(--muted)";
        }
    }

    function setUploadButtonState(
        isProcessing
    ) {

        if (!uploadButton) {
            return;
        }

        uploadButton.disabled =
            isProcessing;

        uploadButton.textContent =
            isProcessing
                ? "Processing..."
                : "Generate Quantities";
    }

    function hideResults() {

        if (resultsSection) {

            resultsSection.style.display =
                "none";
        }

        if (downloadButton) {

            downloadButton.removeAttribute(
                "href"
            );
        }
    }

    function showResults(
        result
    ) {

        if (annotationCount) {

            annotationCount.textContent =
                String(
                    result.annotationCount ??
                    0
                );
        }

        if (successfulCount) {

            successfulCount.textContent =
                String(
                    result.successfulCount ??
                    0
                );
        }

        if (reviewCount) {

            reviewCount.textContent =
                String(
                    result.reviewCount ??
                    0
                );
        }

        if (workbookName) {

            workbookName.textContent =
                result.outputFile ||
                "quantity-result.xlsx";
        }

        if (workbookTime) {

            workbookTime.textContent =
                new Date()
                    .toLocaleString();
        }

        if (workbookSize) {

            workbookSize.textContent =
                "Ready for download";
        }

        if (
            downloadButton &&
            result.downloadUrl
        ) {

            downloadButton.href =
                result.downloadUrl;

            downloadButton.style.display =
                "inline-flex";

            downloadButton.setAttribute(
                "download",
                result.outputFile ||
                "quantity-result.xlsx"
            );
        }

        if (resultsSection) {

            resultsSection.style.display =
                "block";
        }
    }

    function isPdfFile(file) {

        if (!file) {
            return false;
        }

        const fileName =
            String(
                file.name || ""
            ).toLowerCase();

        const mimeType =
            String(
                file.type || ""
            ).toLowerCase();

        return (
            fileName.endsWith(".pdf") ||
            mimeType ===
                "application/pdf"
        );
    }

    function handleFile(file) {

        hideResults();

        if (!isPdfFile(file)) {

            selectedFile =
                null;

            if (fileInput) {
                fileInput.value = "";
            }

            if (fileLabel) {

                fileLabel.textContent =
                    "Please select a PDF file.";
            }

            setStatus(
                "Only PDF files are accepted.",
                "error"
            );

            return;
        }

        selectedFile =
            file;

        if (fileLabel) {

            fileLabel.textContent =
                file.name;
        }

        setStatus(
            `Ready to process ${file.name}.`
        );
    }

    //==================================================
    // DROPZONE EVENTS
    //==================================================

    if (
        dropzone &&
        fileInput
    ) {

        [
            "dragenter",
            "dragover"
        ].forEach(function (eventType) {

            dropzone.addEventListener(
                eventType,
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    dropzone.classList.add(
                        "active"
                    );
                }
            );
        });

        [
            "dragleave",
            "dragend"
        ].forEach(function (eventType) {

            dropzone.addEventListener(
                eventType,
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    dropzone.classList.remove(
                        "active"
                    );
                }
            );
        });

        dropzone.addEventListener(
            "drop",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                dropzone.classList.remove(
                    "active"
                );

                const files =
                    event.dataTransfer
                        ? event.dataTransfer.files
                        : null;

                if (
                    files &&
                    files.length > 0
                ) {

                    handleFile(
                        files[0]
                    );
                }
            }
        );

        dropzone.addEventListener(
            "click",
            function () {

                if (
                    uploadButton &&
                    uploadButton.disabled
                ) {
                    return;
                }

                fileInput.click();
            }
        );

        dropzone.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {

                    event.preventDefault();

                    fileInput.click();
                }
            }
        );

        fileInput.addEventListener(
            "change",
            function (event) {

                const file =
                    event.target.files &&
                    event.target.files[0];

                if (file) {

                    handleFile(file);
                }
            }
        );
    }

    if (uploadButton) {

        uploadButton.addEventListener(
            "click",
            async function () {

                if (!selectedFile) {

                    setStatus(
                        "Please select a PDF file first.",
                        "error"
                    );

                    return;
                }

                const formData =
                    new FormData();

                formData.append(
                    "pdf",
                    selectedFile
                );

                //--------------------------------------
                // DRAWING CLASSIFICATION METADATA
                //--------------------------------------
                const projectSelect =
                    document.getElementById(
                        "projectSelect"
                    );

                const buildingSelect =
                    document.getElementById(
                        "buildingSelect"
                    );

                const buildingShortNameSelect =
                    document.getElementById(
                        "buildingShortNameSelect"
                    );

                const selectedBuildingOption =
                    buildingSelect &&
                    buildingSelect.selectedIndex >= 0
                        ? buildingSelect.options[
                              buildingSelect.selectedIndex
                          ]
                        : null;

                const project =
                    String(
                        projectSelect?.value ||
                        localStorage.getItem(
                            "dwgSelectedProject"
                        ) ||
                        ""
                    ).trim();

                const building =
                    String(
                        selectedBuildingOption?.text ||
                        localStorage.getItem(
                            "dwgSelectedBuilding"
                        ) ||
                        ""
                    ).trim();

                const buildingShortName =
                    String(
                        buildingShortNameSelect?.value ||
                        localStorage.getItem(
                            "dwgSelectedBuildingShortName"
                        ) ||
                        ""
                    ).trim();

                if (
                    !project ||
                    !building ||
                    !buildingShortName
                ) {
                    setStatus(
                        "Select Project, Building Name and Building Short Name before generating quantities.",
                        "error"
                    );
                    return;
                }

                formData.append(
                    "project",
                    project
                );

                formData.append(
                    "building",
                    building
                );

                formData.append(
                    "buildingShortName",
                    buildingShortName
                );

                setUploadButtonState(true);
                setStatus(
                    "Processing PDF...",
                    "processing"
                );

                try {

                    const response =
                        await fetch(
                            "/upload",
                            {
                                method: "POST",
                                body: formData
                            }
                        );

                    const result =
                        await response.json();

                    if (!response.ok || !result.success) {

                        throw new Error(
                            result.message ||
                            "Upload failed."
                        );
                    }

                    showResults(result);
                    setStatus(
                        "Quantities generated successfully.",
                        "success"
                    );

                } catch (error) {

                    setStatus(
                        error.message ||
                        "Unable to process the PDF.",
                        "error"
                    );

                } finally {

                    setUploadButtonState(false);
                }
            }
        );
    }
});