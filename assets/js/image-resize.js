// Resize: width / height / percent, aspect locked
const fileInput = document.querySelector("#img-input");
const dropzone = document.querySelector("#img-dropzone");
const stageWrap = document.querySelector("#img-stage-wrap");
const preview = document.querySelector("#img-preview");
const filenameEl = document.querySelector("#preview-filename");
const metaEl = document.querySelector("#img-meta");
const status = document.querySelector("#img-status");
const actionBtn = document.querySelector("#img-action");
const controls = document.querySelector("#tool-controls");
const modeSel = document.querySelector("#mode");
const sizeInput = document.querySelector("#size-val");
const sizeUnit = document.querySelector("#size-unit");
const dimHint = document.querySelector("#dim-hint");
const formatSel = document.querySelector("#out-format");

const MAX_BYTES = 25 * 1024 * 1024;
let currentFile = null;
let objectUrl = null;

function fmt(size) {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.classList.toggle("is-error", isError);
}
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
        img.src = url;
    });
}

function refreshHint() {
    if (!currentFile) return;
    const mode = modeSel.value;
    if (mode === "width") {
        sizeUnit.textContent = "px wide";
        if (!sizeInput.dataset.touched) sizeInput.value = Math.min(currentFile.width, 1280);
    } else if (mode === "height") {
        sizeUnit.textContent = "px tall";
        if (!sizeInput.dataset.touched) sizeInput.value = Math.min(currentFile.height, 1280);
    } else {
        sizeUnit.textContent = "%";
        if (!sizeInput.dataset.touched) sizeInput.value = 50;
    }
    updateLiveHint();
}
function targetDims() {
    const mode = modeSel.value;
    const v = Math.max(1, Number(sizeInput.value) || 1);
    const { width, height } = currentFile;
    if (mode === "width") {
        const w = Math.min(12000, Math.round(v));
        return { w, h: Math.max(1, Math.round((height * w) / width)) };
    }
    if (mode === "height") {
        const h = Math.min(12000, Math.round(v));
        return { w: Math.max(1, Math.round((width * h) / height)), h };
    }
    const p = Math.min(1000, Math.max(1, v)) / 100;
    return { w: Math.max(1, Math.round(width * p)), h: Math.max(1, Math.round(height * p)) };
}
function updateLiveHint() {
    if (!currentFile) return;
    try {
        const { w, h } = targetDims();
        dimHint.textContent = `Original ${currentFile.width}×${currentFile.height} → ${w}×${h}. Aspect preserved.`;
    } catch { /* ignore */ }
}
modeSel?.addEventListener("change", () => { delete sizeInput.dataset.touched; refreshHint(); });
sizeInput?.addEventListener("input", () => { sizeInput.dataset.touched = "1"; updateLiveHint(); });

function openPicker() { fileInput.click(); }
document.querySelector("#choose-img")?.addEventListener("click", openPicker);
document.querySelector("#change-img")?.addEventListener("click", openPicker);
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

async function setFile(file) {
    if (!file.type.startsWith("image/")) { setStatus(`Not an image: ${file.name}`, true); return; }
    if (file.size > MAX_BYTES) { setStatus("Image over 25 MB is not supported.", true); return; }
    try {
        const img = await loadImage(file);
        currentFile = { file, width: img.naturalWidth, height: img.naturalHeight };
        delete sizeInput.dataset.touched;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        preview.src = objectUrl;
        filenameEl.textContent = file.name;
        metaEl.innerHTML = "";
        const s = document.createElement("span");
        s.textContent = `${img.naturalWidth}×${img.naturalHeight} px • ${fmt(file.size)}`;
        metaEl.append(s);
        dropzone.hidden = true;
        stageWrap.hidden = false;
        controls.hidden = false;
        actionBtn.disabled = false;
        refreshHint();
        setStatus("Ready. Set a size, then resize.");
    } catch (e) {
        setStatus(e.message, true);
    }
}

actionBtn?.addEventListener("click", async () => {
    if (!currentFile) return;
    actionBtn.disabled = true;
    const original = actionBtn.textContent;
    actionBtn.textContent = "Resizing…";
    try {
        const img = await loadImage(currentFile.file);
        const { w, h } = targetDims();
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        const mime = formatSel.value;
        if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.92));
        if (!blob) throw new Error("Export failed.");
        const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
        const base = currentFile.file.name.replace(/\.[a-z0-9]+$/i, "");
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${base}-${w}x${h}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setStatus(`Done: ${w}×${h} (${fmt(blob.size)}).`);
    } catch (e) {
        setStatus(e.message, true);
    } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = original;
    }
});
