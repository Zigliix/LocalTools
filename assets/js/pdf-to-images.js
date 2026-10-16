import * as pdfjsLib from "./vendor/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;

const fileInput = document.querySelector("#pdf-input");
const dropzone = document.querySelector("#pdf-dropzone");
const results = document.querySelector("#img-results");
const grid = document.querySelector("#thumb-grid");
const filenameEl = document.querySelector("#preview-filename");
const status = document.querySelector("#pdf-status");
const exportBtn = document.querySelector("#export-images");
const formatSel = document.querySelector("#img-format");
const jpegQ = document.querySelector("#jpeg-q");
const jpegQVal = document.querySelector("#jpeg-q-val");
const jpegRow = document.querySelector("#jpeg-q-row");
const scaleSel = document.querySelector("#img-scale");
const controls = document.querySelector("#export-controls");

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 50;
let currentFile = null;
let rendered = [];

function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.classList.toggle("is-error", isError);
}

jpegQ?.addEventListener("input", () => { jpegQVal.textContent = `${jpegQ.value}%`; });
formatSel?.addEventListener("change", () => {
    jpegRow.style.display = formatSel.value === "jpeg" ? "" : "none";
});

function openPicker() { fileInput.click(); }
document.querySelector("#choose-pdf")?.addEventListener("click", openPicker);
document.querySelector("#change-pdf")?.addEventListener("click", openPicker);
fileInput?.addEventListener("change", () => {
    if (fileInput.files.length) setFile(fileInput.files[0]);
    fileInput.value = "";
});
dropzone?.addEventListener("click", (e) => { if (!e.target.closest("button")) openPicker(); });
dropzone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); }
});
["dragenter", "dragover"].forEach((n) => dropzone?.addEventListener(n, (e) => {
    e.preventDefault(); dropzone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((n) => dropzone?.addEventListener(n, (e) => {
    e.preventDefault(); dropzone.classList.remove("is-dragging");
}));
dropzone?.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
});

function setFile(file) {
    const ok = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf" || file.type === "";
    if (!ok) { setStatus("Only PDF files are supported.", true); return; }
    if (file.size > MAX_BYTES) { setStatus("File over 100 MB is not supported.", true); return; }
    if (file.size === 0) { setStatus("This file looks empty.", true); return; }
    currentFile = file;
    rendered = [];
    dropzone.hidden = true;
    results.hidden = false;
    controls.hidden = false;
    grid.replaceChildren();
    filenameEl.textContent = file.name;
    exportBtn.disabled = false;
    exportBtn.textContent = "Export pages";
    setStatus("Ready. Choose format, then export.");
}

function downloadURL(url, name) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

exportBtn?.addEventListener("click", async () => {
    if (!currentFile) return;
    if (rendered.length > 0) {
        // second click: download all sequentially
        setStatus(`Downloading ${rendered.length} images…`);
        rendered.forEach((r, i) => {
            setTimeout(() => downloadURL(r.url, r.name), i * 400);
        });
        setStatus(`Started ${rendered.length} downloads (browser may ask permission).`);
        return;
    }
    exportBtn.disabled = true;
    const original = exportBtn.textContent;
    exportBtn.textContent = "Rendering…";
    grid.replaceChildren();
    try {
        const buf = await currentFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        if (pdf.numPages > MAX_PAGES) throw new Error(`PDF has ${pdf.numPages} pages, max ${MAX_PAGES} for in-browser export.`);
        const format = formatSel.value;
        const scale = Number(scaleSel.value);
        const jq = Number(jpegQ.value) / 100;
        const base = currentFile.name.replace(/\.pdf$/i, "");
        for (let i = 1; i <= pdf.numPages; i++) {
            setStatus(`Rendering page ${i}/${pdf.numPages}…`);
            const page = await pdf.getPage(i);
            const vp = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(vp.width);
            canvas.height = Math.round(vp.height);
            await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
            const mime = format === "jpeg" ? "image/jpeg" : "image/png";
            const blob = await new Promise((res) => canvas.toBlob(res, mime, jq));
            if (!blob) throw new Error("Export failed on page " + i);
            const url = URL.createObjectURL(blob);
            const ext = format === "jpeg" ? "jpg" : "png";
            const name = `${base}-p${i}.${ext}`;
            rendered.push({ url, name });
            const card = document.createElement("div");
            card.className = "thumb-card";
            const img = document.createElement("img");
            img.src = url;
            img.alt = `Page ${i}`;
            const nm = document.createElement("span");
            nm.className = "thumb-name";
            nm.textContent = name;
            nm.title = name;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = "Download";
            btn.addEventListener("click", () => downloadURL(url, name));
            card.append(img, nm, btn);
            grid.append(card);
            page.cleanup();
        }
        setStatus(`${rendered.length} pages ready. Click a page or “Download all”.`);
        exportBtn.textContent = "Download all";
        exportBtn.disabled = false;
    } catch (e) {
        const msg = String(e?.message || e);
        if (/encrypt|password/i.test(msg)) setStatus("This PDF is password-protected.", true);
        else setStatus(`Could not export: ${msg.slice(0, 160)}`, true);
        exportBtn.textContent = original;
        exportBtn.disabled = false;
    }
});
