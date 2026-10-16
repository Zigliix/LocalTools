import * as pdfjsLib from "./vendor/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;

const fileInput = document.querySelector("#pdf-input");
const dropzone = document.querySelector("#pdf-dropzone");
const editor = document.querySelector("#pdf-editor");
const filenameEl = document.querySelector("#preview-filename");
const metaEl = document.querySelector("#pdf-meta");
const status = document.querySelector("#pdf-status");
const actionBtn = document.querySelector("#compress-pdf");
const qualityInput = document.querySelector("#quality");
const qualityVal = document.querySelector("#quality-val");
const controls = document.querySelector("#compress-controls");

const MAX_BYTES = 100 * 1024 * 1024;
let currentFile = null;

function fmt(size) {
    if (!Number.isFinite(size) || size <= 0) return "—";
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.classList.toggle("is-error", isError);
}

qualityInput?.addEventListener("input", () => {
    qualityVal.textContent = `${qualityInput.value}%`;
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
    e.preventDefault();
    dropzone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((n) => dropzone?.addEventListener(n, (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragging");
}));
dropzone?.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
});

function setFile(file) {
    const okName = file.name.toLowerCase().endsWith(".pdf");
    const okType = file.type === "application/pdf" || file.type === "";
    if (!okName && !okType) { setStatus("Only PDF files are supported.", true); return; }
    if (file.size > MAX_BYTES) { setStatus("File over 100 MB is not supported.", true); return; }
    if (file.size === 0) { setStatus("This file looks empty.", true); return; }
    currentFile = file;
    dropzone.hidden = true;
    editor.hidden = false;
    controls.hidden = false;
    filenameEl.textContent = file.name;
    metaEl.innerHTML = "";
    const s = document.createElement("span");
    s.textContent = `Original: ${fmt(file.size)} • Quality: ${qualityInput.value}% — press Compress`;
    metaEl.append(s);
    actionBtn.disabled = false;
    setStatus("Ready. Adjust quality, then compress.");
}

function friendlyError(error) {
    const msg = String(error?.message || error || "");
    if (/encrypt|password|decrypt/i.test(msg)) return "This PDF is password-protected. Unlock it first.";
    if (/invalid|corrupt|parse|trailer|xref/i.test(msg)) return `This PDF looks corrupted (${msg.slice(0, 120)}).`;
    return `Could not compress: ${msg.slice(0, 160)}`;
}

actionBtn?.addEventListener("click", async () => {
    if (!currentFile) return;
    if (!window.PDFLib) { setStatus("PDF library missing. Reload the page.", true); return; }
    const q = Number(qualityInput.value) / 100;
    const scale = 0.6 + q * 1.4;
    actionBtn.disabled = true;
    const original = actionBtn.textContent;
    actionBtn.textContent = "Compressing…";
    setStatus("Rendering pages on this device…");

    try {
        const buf = await currentFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        if (pdf.numPages > 100) throw new Error("PDF has over 100 pages, too heavy for in-browser compression.");
        const out = await window.PDFLib.PDFDocument.create();
        for (let i = 1; i <= pdf.numPages; i++) {
            setStatus(`Compressing page ${i}/${pdf.numPages}…`);
            const page = await pdf.getPage(i);
            const vp = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(vp.width));
            canvas.height = Math.max(1, Math.round(vp.height));
            await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
            const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
            if (!blob) throw new Error("Canvas export failed on page " + i);
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const img = await out.embedJpg(bytes);
            const v1 = page.getViewport({ scale: 1 });
            const pg = out.addPage([v1.width, v1.height]);
            pg.drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height });
            page.cleanup();
        }
        const outBytes = await out.save({ useObjectStreams: true });
        const before = currentFile.size;
        const after = outBytes.length;
        const pct = Math.round((1 - after / before) * 100);
        const a = document.createElement("a");
        const url = URL.createObjectURL(new Blob([outBytes], { type: "application/pdf" }));
        a.href = url;
        a.download = currentFile.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        metaEl.innerHTML = "";
        const s = document.createElement("span");
        s.textContent = `Done: ${fmt(before)} → ${fmt(after)} (${pct >= 0 ? "-" + pct + "%" : "+" + Math.abs(pct) + "%"}). Download started.`;
        metaEl.append(s);
        setStatus(`Compressed: ${fmt(before)} → ${fmt(after)}.`);
    } catch (e) {
        setStatus(friendlyError(e), true);
    } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = original;
    }
});
