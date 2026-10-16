// Remove background (simple): flood-fill from edges with tolerance, live preview
const fileInput = document.querySelector("#img-input");
const dropzone = document.querySelector("#img-dropzone");
const stageWrap = document.querySelector("#img-stage-wrap");
const canvas = document.querySelector("#img-canvas");
const filenameEl = document.querySelector("#preview-filename");
const metaEl = document.querySelector("#img-meta");
const status = document.querySelector("#img-status");
const actionBtn = document.querySelector("#img-action");
const controls = document.querySelector("#tool-controls");
const tolInput = document.querySelector("#tolerance");
const tolVal = document.querySelector("#tolerance-val");

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_DIM = 1600; // work at capped size for speed, export full size
let currentFile = null;
let fullImg = null;
let workCanvas = null;
let raf = 0;

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
tolInput?.addEventListener("input", () => {
    tolVal.textContent = tolInput.value;
    schedulePreview();
});
function schedulePreview() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { if (fullImg) renderPreview(); });
}

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
        fullImg = await loadImage(file);
        currentFile = file;
        filenameEl.textContent = file.name;
        dropzone.hidden = true;
        stageWrap.hidden = false;
        controls.hidden = false;
        actionBtn.disabled = false;
        // work canvas at capped size
        const k = Math.min(1, MAX_DIM / Math.max(fullImg.naturalWidth, fullImg.naturalHeight));
        workCanvas = document.createElement("canvas");
        workCanvas.width = Math.max(1, Math.round(fullImg.naturalWidth * k));
        workCanvas.height = Math.max(1, Math.round(fullImg.naturalHeight * k));
        workCanvas.getContext("2d", { willReadFrequently: true }).drawImage(fullImg, 0, 0, workCanvas.width, workCanvas.height);
        renderPreview();
        setStatus("Preview ready. Adjust tolerance — solid backgrounds erase best.");
    } catch (e) {
        setStatus(e.message, true);
    }
}

// Edge flood-fill: sample 4 corners, BFS from borders where color distance < tol
function eraseBackground(srcCanvas, tol) {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const ctx = srcCanvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const corners = [
        [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
        [Math.floor(w / 2), 1], [Math.floor(w / 2), h - 2],
    ];
    const refs = corners
        .filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h)
        .map(([x, y]) => {
            const i = (y * w + x) * 4;
            return [d[i], d[i + 1], d[i + 2]];
        });
    const tol2 = tol * tol * 3;
    const close = (i) => {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        return refs.some(([rr, gg, bb]) => {
            const dr = r - rr, dg = g - gg, db = b - bb;
            return dr * dr + dg * dg + db * db <= tol2;
        });
    };
    const visited = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
    let removed = 0;
    while (stack.length) {
        const p = stack.pop();
        if (p < 0 || p >= w * h || visited[p]) continue;
        visited[p] = 1;
        const i = p * 4;
        if (d[i + 3] === 0) continue;
        if (!close(i)) continue;
        d[i + 3] = 0;
        removed++;
        const x = p % w;
        const y = (p / w) | 0;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
    }
    ctx.putImageData(img, 0, 0);
    return removed / (w * h);
}

function renderPreview() {
    const tol = Number(tolInput.value);
    const tmp = document.createElement("canvas");
    tmp.width = workCanvas.width;
    tmp.height = workCanvas.height;
    tmp.getContext("2d").drawImage(workCanvas, 0, 0);
    const frac = eraseBackground(tmp, tol);
    canvas.width = tmp.width;
    canvas.height = tmp.height;
    canvas.getContext("2d").drawImage(tmp, 0, 0);
    metaEl.innerHTML = "";
    const s = document.createElement("span");
    s.textContent = `${fullImg.naturalWidth}×${fullImg.naturalHeight} px • erased ~${Math.round(frac * 100)}% of preview pixels • PNG output`;
    metaEl.append(s);
    if (frac < 0.02) setStatus("Almost nothing erased — raise tolerance or use a more solid backdrop.", false);
    else if (frac > 0.85) setStatus("Almost everything erased — lower tolerance, background may match subject.", false);
    else setStatus("Preview updated. Download when happy.");
}

actionBtn?.addEventListener("click", async () => {
    if (!fullImg || !currentFile) return;
    actionBtn.disabled = true;
    const original = actionBtn.textContent;
    actionBtn.textContent = "Exporting…";
    try {
        const tol = Number(tolInput.value);
        const out = document.createElement("canvas");
        out.width = fullImg.naturalWidth;
        out.height = fullImg.naturalHeight;
        out.getContext("2d", { willReadFrequently: true }).drawImage(fullImg, 0, 0);
        eraseBackground(out, tol);
        const blob = await new Promise((res) => out.toBlob(res, "image/png"));
        if (!blob) throw new Error("Export failed.");
        const base = currentFile.name.replace(/\.[a-z0-9]+$/i, "");
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${base}-no-bg.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setStatus("Background removed. PNG download started.");
    } catch (e) {
        setStatus(e.message, true);
    } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = original;
    }
});
