// Crop: drag rectangle on displayed image, free or fixed ratio
const fileInput = document.querySelector("#img-input");
const dropzone = document.querySelector("#img-dropzone");
const stageWrap = document.querySelector("#img-stage-wrap");
const wrap = document.querySelector("#crop-wrap");
const preview = document.querySelector("#img-preview");
const rect = document.querySelector("#crop-rect");
const filenameEl = document.querySelector("#preview-filename");
const metaEl = document.querySelector("#img-meta");
const status = document.querySelector("#img-status");
const actionBtn = document.querySelector("#img-action");
const controls = document.querySelector("#tool-controls");
const ratioSel = document.querySelector("#ratio");
const formatSel = document.querySelector("#out-format");

const MAX_BYTES = 25 * 1024 * 1024;
let currentFile = null;
let objectUrl = null;
let sel = null; // {x,y,w,h} in displayed px relative to img
let drawing = null;
let moving = null;

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
function ratioValue() {
    const v = ratioSel.value;
    if (v === "1:1") return 1;
    if (v === "4:3") return 4 / 3;
    if (v === "16:9") return 16 / 9;
    return null;
}
function drawRect() {
    if (!sel) { rect.hidden = true; actionBtn.disabled = true; return; }
    rect.hidden = false;
    rect.style.left = `${sel.x}px`;
    rect.style.top = `${sel.y}px`;
    rect.style.width = `${sel.w}px`;
    rect.style.height = `${sel.h}px`;
    const k = currentFile.width / preview.clientWidth;
    metaEl.innerHTML = "";
    const s = document.createElement("span");
    s.textContent = `Selection ≈ ${Math.round(sel.w * k)}×${Math.round(sel.h * k)} px`;
    metaEl.append(s);
    actionBtn.disabled = false;
    setStatus("Selection ready. Adjust or download.");
}
function posInImg(e) {
    const r = preview.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return {
        x: Math.max(0, Math.min(r.width, cx)),
        y: Math.max(0, Math.min(r.height, cy)),
        w: r.width,
        h: r.height,
    };
}
function applyRatioLock(s, fixed) {
    if (!fixed) return s;
    let { x, y, w, h } = s;
    if (w / Math.max(1, h) > fixed) w = h * fixed;
    else h = w / fixed;
    return { x, y, w, h };
}

wrap?.addEventListener("pointerdown", (e) => {
    if (!currentFile) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    const p = posInImg(e);
    // move existing box?
    if (sel && p.x >= sel.x && p.x <= sel.x + sel.w && p.y >= sel.y && p.y <= sel.y + sel.h) {
        moving = { dx: p.x - sel.x, dy: p.y - sel.y };
    } else {
        drawing = { x0: p.x, y0: p.y };
        sel = { x: p.x, y: p.y, w: 0, h: 0 };
    }
});
wrap?.addEventListener("pointermove", (e) => {
    if (!currentFile) return;
    const p = posInImg(e);
    const fixed = ratioValue();
    if (drawing) {
        let w = Math.abs(p.x - drawing.x0);
        let h = Math.abs(p.y - drawing.y0);
        let x = Math.min(p.x, drawing.x0);
        let y = Math.min(p.y, drawing.y0);
        if (fixed) {
            if (w / Math.max(1, h) > fixed) w = h * fixed;
            else h = w / fixed;
            x = p.x >= drawing.x0 ? drawing.x0 : drawing.x0 - w;
            y = p.y >= drawing.y0 ? drawing.y0 : drawing.y0 - h;
        }
        // clamp
        w = Math.min(w, preview.clientWidth - x);
        h = Math.min(h, preview.clientHeight - y);
        x = Math.max(0, x); y = Math.max(0, y);
        sel = { x, y, w, h };
        drawRect();
    } else if (moving && sel) {
        let x = Math.max(0, Math.min(preview.clientWidth - sel.w, p.x - moving.dx));
        let y = Math.max(0, Math.min(preview.clientHeight - sel.h, p.y - moving.dy));
        sel = { ...sel, x, y };
        drawRect();
    }
});
wrap?.addEventListener("pointerup", () => {
    drawing = null;
    moving = null;
    if (sel && (sel.w < 8 || sel.h < 8)) { sel = null; drawRect(); setStatus("Selection too small. Drag a bigger area."); }
});
ratioSel?.addEventListener("change", () => {
    if (!sel || !currentFile) return;
    const fixed = ratioValue();
    if (!fixed) { drawRect(); return; }
    // default centered box with ratio
    const dw = preview.clientWidth;
    const dh = preview.clientHeight;
    let w = dw * 0.8;
    let h = w / fixed;
    if (h > dh * 0.8) { h = dh * 0.8; w = h * fixed; }
    sel = { x: (dw - w) / 2, y: (dh - h) / 2, w, h };
    drawRect();
});

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
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        preview.src = objectUrl;
        filenameEl.textContent = file.name;
        sel = null;
        drawRect();
        metaEl.innerHTML = "";
        const s = document.createElement("span");
        s.textContent = `${img.naturalWidth}×${img.naturalHeight} px`;
        metaEl.append(s);
        dropzone.hidden = true;
        stageWrap.hidden = false;
        controls.hidden = false;
        setStatus("Drag on the photo to select a crop area.");
    } catch (e) {
        setStatus(e.message, true);
    }
}

actionBtn?.addEventListener("click", async () => {
    if (!currentFile || !sel) return;
    actionBtn.disabled = true;
    const original = actionBtn.textContent;
    actionBtn.textContent = "Cropping…";
    try {
        const img = await loadImage(currentFile.file);
        const kx = img.naturalWidth / preview.clientWidth;
        const ky = img.naturalHeight / preview.clientHeight;
        const sx = Math.round(sel.x * kx);
        const sy = Math.round(sel.y * ky);
        const sw = Math.round(sel.w * kx);
        const sh = Math.round(sel.h * ky);
        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d");
        const mime = formatSel.value;
        if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, sw, sh); }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.92));
        if (!blob) throw new Error("Export failed.");
        const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
        const base = currentFile.file.name.replace(/\.[a-z0-9]+$/i, "");
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${base}-crop-${sw}x${sh}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setStatus(`Cropped ${sw}×${sh}. Download started.`);
    } catch (e) {
        setStatus(e.message, true);
    } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = original;
    }
});
