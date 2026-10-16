// Compress photo: quality + longest-side cap
const fileInput = document.querySelector("#img-input");
const dropzone = document.querySelector("#img-dropzone");
const stageWrap = document.querySelector("#img-stage-wrap");
const preview = document.querySelector("#img-preview");
const filenameEl = document.querySelector("#preview-filename");
const metaEl = document.querySelector("#img-meta");
const status = document.querySelector("#img-status");
const actionBtn = document.querySelector("#img-action");
const controls = document.querySelector("#tool-controls");
const qualityInput = document.querySelector("#quality");
const qualityVal = document.querySelector("#quality-val");
const maxsideSel = document.querySelector("#maxside");
const formatSel = document.querySelector("#out-format");

const MAX_BYTES = 25 * 1024 * 1024;
let currentFile = null;
let objectUrl = null;

function fmt(size) {
    if (!Number.isFinite(size) || size <= 0) return "—";
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

qualityInput?.addEventListener("input", () => { qualityVal.textContent = `${qualityInput.value}%`; });

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
    if (file.size === 0) { setStatus("This file looks empty.", true); return; }
    try {
        const img = await loadImage(file);
        currentFile = { file, width: img.naturalWidth, height: img.naturalHeight };
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
        setStatus("Ready. Tune quality, then compress.");
    } catch (e) {
        setStatus(e.message, true);
    }
}

actionBtn?.addEventListener("click", async () => {
    if (!currentFile) return;
    actionBtn.disabled = true;
    const original = actionBtn.textContent;
    actionBtn.textContent = "Compressing…";
    try {
        const img = await loadImage(currentFile.file);
        let { width, height } = currentFile;
        const cap = Number(maxsideSel.value);
        if (cap > 0) {
            const longest = Math.max(width, height);
            if (longest > cap) {
                const k = cap / longest;
                width = Math.round(width * k);
                height = Math.round(height * k);
            }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        const mime = formatSel.value;
        if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(img, 0, 0, width, height);
        const q = Number(qualityInput.value) / 100;
        const blob = await new Promise((res) => canvas.toBlob(res, mime, q));
        if (!blob) throw new Error("Export failed. Try JPEG.");
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const base = currentFile.file.name.replace(/\.[a-z0-9]+$/i, "");
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${base}-compressed.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        const pct = Math.round((1 - blob.size / currentFile.file.size) * 100);
        setStatus(`Done: ${fmt(currentFile.file.size)} → ${fmt(blob.size)} (${pct >= 0 ? "-" + pct + "%" : "+" + Math.abs(pct) + "%"}), ${width}×${height}.`);
    } catch (e) {
        setStatus(e.message, true);
    } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = original;
    }
});
