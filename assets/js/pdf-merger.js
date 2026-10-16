const fileInput = document.querySelector("#pdf-input");
const dropzone = document.querySelector("#pdf-dropzone");
const workspace = document.querySelector(".pdf-workspace");
const editor = document.querySelector("#pdf-editor");
const fileList = document.querySelector("#pdf-file-list");
const fileCount = document.querySelector("#pdf-count");
const previewFrame = document.querySelector("#pdf-preview-frame");
const previewFilename = document.querySelector("#preview-filename");
const status = document.querySelector("#pdf-status");
const mergeButton = document.querySelector("#merge-pdfs");
const files = [];
let selectedFileId = null;
let nextFileId = 0;
let dragCounter = 0;

const MAX_FILES = 50;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

function formatFileSize(size) {
    if (!Number.isFinite(size) || size <= 0) {
        return "—";
    }
    if (size < 1024 * 1024) {
        return `${Math.max(1, Math.round(size / 1024))} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function isPdfFile(file) {
    if (!file || typeof file.name !== "string") return false;
    const nameOk = file.name.toLowerCase().endsWith(".pdf");
    const typeOk = file.type === "application/pdf" || file.type === "";
    return nameOk || typeOk;
}

function selectFile(id) {
    const file = files.find((item) => item.id === id);
    if (!file) return;
    selectedFileId = id;
    if (previewFilename) previewFilename.textContent = file.file.name;
    if (previewFrame) previewFrame.src = `${file.url}#toolbar=0&navpanes=0`;
    renderFiles();
}

function removeFile(id) {
    const index = files.findIndex((item) => item.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(files[index].url);
    files.splice(index, 1);

    if (selectedFileId === id) {
        selectedFileId = files[Math.min(index, files.length - 1)]?.id ?? null;
    }

    if (selectedFileId === null) {
        if (previewFrame) previewFrame.removeAttribute("src");
        if (previewFilename) previewFilename.textContent = "Choose a PDF to preview";
    } else {
        const file = files.find((item) => item.id === selectedFileId);
        if (file) {
            if (previewFilename) previewFilename.textContent = file.file.name;
            if (previewFrame) previewFrame.src = `${file.url}#toolbar=0&navpanes=0`;
        }
    }

    renderFiles();
    updateStatusAfterChange();
}

function moveFile(id, direction) {
    const index = files.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= files.length) return;
    [files[index], files[nextIndex]] = [files[nextIndex], files[index]];
    renderFiles();
}

function updateStatusAfterChange() {
    if (files.length < 2) {
        setStatus("Add at least two PDFs to merge.");
    } else {
        setStatus(`${files.length} PDFs ready to merge.`);
    }
}

function renderFiles() {
    if (!fileList) return;
    fileList.replaceChildren();

    files.forEach((item, index) => {
        const listItem = document.createElement("li");
        listItem.className = "pdf-file-item";
        if (item.id === selectedFileId) {
            listItem.classList.add("is-selected");
        }

        const selectButton = document.createElement("button");
        selectButton.className = "pdf-file-select";
        selectButton.type = "button";
        selectButton.setAttribute("aria-label", `Preview ${item.file.name}`);
        selectButton.setAttribute("aria-current", item.id === selectedFileId ? "true" : "false");

        const thumbnail = document.createElement("span");
        thumbnail.className = "pdf-mini-preview";
        thumbnail.setAttribute("aria-hidden", "true");
        const thumbnailLabel = document.createElement("span");
        thumbnailLabel.textContent = "PDF";
        const thumbnailLines = document.createElement("i");
        thumbnail.append(thumbnailLabel, thumbnailLines);

        const details = document.createElement("span");
        details.className = "pdf-file-details";
        const name = document.createElement("span");
        name.className = "pdf-file-name";
        name.textContent = item.file.name;
        name.title = item.file.name;
        const size = document.createElement("span");
        size.className = "pdf-file-size";
        size.textContent = formatFileSize(item.file.size);
        details.append(name, size);
        selectButton.append(thumbnail, details);
        selectButton.addEventListener("click", () => selectFile(item.id));

        const actions = document.createElement("div");
        actions.className = "pdf-file-actions";
        const upButton = document.createElement("button");
        upButton.type = "button";
        upButton.textContent = "↑";
        upButton.setAttribute("aria-label", `Move ${item.file.name} up`);
        upButton.disabled = index === 0;
        upButton.addEventListener("click", (e) => {
            e.stopPropagation();
            moveFile(item.id, -1);
        });
        const downButton = document.createElement("button");
        downButton.type = "button";
        downButton.textContent = "↓";
        downButton.setAttribute("aria-label", `Move ${item.file.name} down`);
        downButton.disabled = index === files.length - 1;
        downButton.addEventListener("click", (e) => {
            e.stopPropagation();
            moveFile(item.id, 1);
        });
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `Remove ${item.file.name}`);
        removeButton.addEventListener("click", (e) => {
            e.stopPropagation();
            removeFile(item.id);
        });
        actions.append(upButton, downButton, removeButton);
        listItem.append(selectButton, actions);
        fileList.append(listItem);
    });

    if (fileCount) fileCount.textContent = String(files.length);
    if (dropzone) dropzone.hidden = files.length > 0;
    if (editor) editor.hidden = files.length === 0;
    if (mergeButton) mergeButton.disabled = files.length < 2;
}

function addFiles(fileCollection) {
    if (!fileCollection || fileCollection.length === 0) return;
    const addedFiles = [];
    const rejectedNames = [];
    const oversizedNames = [];

    if (files.length + fileCollection.length > MAX_FILES) {
        setStatus(`Too many files. Maximum ${MAX_FILES} PDFs at a time.`, true);
        return;
    }

    Array.from(fileCollection).forEach((file) => {
        if (!isPdfFile(file)) {
            rejectedNames.push(file.name || "unknown file");
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            oversizedNames.push(file.name);
            return;
        }
        if (file.size === 0) {
            rejectedNames.push(file.name);
            return;
        }
        const item = {
            id: nextFileId++,
            file,
            url: URL.createObjectURL(file),
        };
        files.push(item);
        addedFiles.push(item);
    });

    if (selectedFileId === null && addedFiles.length > 0) {
        selectFile(addedFiles[0].id);
    } else {
        renderFiles();
    }

    if (rejectedNames.length > 0) {
        setStatus(`Only PDF files are supported. Skipped: ${rejectedNames.join(", ")}`, true);
    } else if (oversizedNames.length > 0) {
        setStatus(`Files over 100 MB are not supported. Skipped: ${oversizedNames.join(", ")}`, true);
    } else if (files.length < 2) {
        setStatus("Add at least one more PDF to merge.");
    } else {
        setStatus(`${files.length} PDFs ready to merge.`);
    }
}

function openFilePicker() {
    fileInput.click();
}

document.querySelector("#choose-pdfs")?.addEventListener("click", openFilePicker);
document.querySelector("#add-pdf")?.addEventListener("click", openFilePicker);
document.querySelector("#add-pdf-list")?.addEventListener("click", openFilePicker);
document.querySelector("#preview-add-pdf")?.addEventListener("click", openFilePicker);

fileInput?.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
});

dropzone?.addEventListener("click", (event) => {
    if (!event.target.closest("button")) {
        openFilePicker();
    }
});

dropzone?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFilePicker();
    }
});

if (workspace) {
    ["dragenter", "dragover"].forEach((eventName) => {
        workspace.addEventListener(eventName, (event) => {
            event.preventDefault();
            if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")) {
                dragCounter += 1;
                dropzone?.classList.add("is-dragging");
                if (editor && !editor.hidden) {
                    dropzone.hidden = false;
                    dropzone.style.position = "absolute";
                    dropzone.style.inset = "0";
                    dropzone.style.zIndex = "5";
                    dropzone.style.background = "var(--workspace-bg)";
                }
            }
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        workspace.addEventListener(eventName, (event) => {
            event.preventDefault();
            dragCounter = Math.max(0, dragCounter - 1);
            if (dragCounter === 0 || eventName === "drop") {
                dragCounter = 0;
                dropzone?.classList.remove("is-dragging");
                dropzone.style.position = "";
                dropzone.style.inset = "";
                dropzone.style.zIndex = "";
                dropzone.style.background = "";
                renderFiles();
            }
        });
    });

    workspace.addEventListener("drop", (event) => {
        if (event.dataTransfer?.files?.length) {
            addFiles(event.dataTransfer.files);
        }
    });
}

function friendlyMergeError(error) {
    const msg = String(error?.message || error || "");
    if (/encrypt|password|decrypt/i.test(msg)) {
        return "One PDF is password-protected. Remove its password first, then try again.";
    }
    if (/invalid|corrupt|parse|trailer|xref/i.test(msg)) {
        return `A PDF looks corrupted and could not be read (${msg.slice(0, 120)}).`;
    }
    return `Could not merge these PDFs: ${msg.slice(0, 160)}`;
}

mergeButton?.addEventListener("click", async () => {
    if (files.length < 2) {
        setStatus("Add at least two PDFs to merge.", true);
        return;
    }
    if (!window.PDFLib) {
        setStatus("The PDF library is not available offline. Reload the page and try again.", true);
        return;
    }

    mergeButton.disabled = true;
    const originalText = mergeButton.textContent;
    mergeButton.textContent = "Merging…";
    setStatus("Merging your PDFs on this device…");

    try {
        const mergedPdf = await window.PDFLib.PDFDocument.create();

        for (const item of files) {
            const buffer = await item.file.arrayBuffer();
            const sourcePdf = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
            const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            pages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedBytes = await mergedPdf.save();
        const mergedBlob = new Blob([mergedBytes], { type: "application/pdf" });
        const mergedUrl = URL.createObjectURL(mergedBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = mergedUrl;
        downloadLink.download = "merged.pdf";
        downloadLink.rel = "noopener";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(mergedUrl), 5000);
        setStatus("PDFs merged. Your download should start shortly.");
    } catch (error) {
        setStatus(friendlyMergeError(error), true);
    } finally {
        mergeButton.disabled = files.length < 2;
        mergeButton.textContent = originalText;
    }
});

window.addEventListener("beforeunload", () => {
    files.forEach((item) => URL.revokeObjectURL(item.url));
});

renderFiles();
updateStatusAfterChange();
