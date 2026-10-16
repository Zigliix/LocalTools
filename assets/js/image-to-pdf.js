// Images to PDF: multi-image list with reorder, fit or A4 pages via pdf-lib
const fileInput = document.querySelector("#img-input");
const dropzone = document.querySelector("#img-dropzone");
const editor = document.querySelector("#img-editor");
const fileList = document.querySelector("#img-file-list");
const fileCount = document.querySelector("#img-count");
const previewImg = document.querySelector("#img-preview");
const previewName = document.querySelector("#preview-filename");
const status = document.querySelector("#img-status");
const actionBtn = document.querySelector("#img-action");
const controls = document.querySelector("#tool-controls");
const pageSizeSel = document.querySelector("#page-size");
const qualityInput = document.querySelector("#jpeg-q");
const qualityVal = document.querySelector("#jpeg-q-val");

const MAX_FILES = 30;
const MAX_BYTES = 25 * 1024 * 1024;
const files = [];
let selectedId = null;
let nextId = 0;

function fmt(size) {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.classList.toggle("is-error", isError);
}
qualityInput?.addEventListener("input", () => { qualityVal.textContent = `${qualityInput.value}%`; });

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Unreadable image: ${file.name}`)); };
        img.src = url;
    });
}

function select(id) {
    const it = files.find((f) => f.id === id);
    if (!it) return;
    selectedId = id;
    previewName.textContent = it.file.name;
    previewImg.src = it.url;
    render();
}
function remove(id) {
    const i = files.findIndex((f) => f.id === id);
    if (i < 0) return;
    URL.revokeObjectURL(files[i].url);
    files.splice(i, 1);
    if (selectedId === id) selectedId = files[Math.min(i, files.length - 1)]?.id ?? null;
    if (selectedId === null) {
        previewName.textContent = "Choose an image to preview";
        previewImg.removeAttribute("src");
    } else {
        const it = files.find((f) => f.id === selectedId);
        previewName.textContent = it.file.name;
        previewImg.src = it.url;
    }
    render();
    setStatus(files.length === 0 ? "Add at least one image." : `${files.length} image${files.length > 1 ? "s" : ""} ready.`);
}
function move(id, dir) {
    const i = files.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= files.length) return;
    [files[i], files[j]] = [files[j], files[i]];
    render();
}

function render() {
    fileList.replaceChildren();
    files.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "pdf-file-item" + (item.id === selectedId ? " is-selected" : "");
        const sel = document.createElement("button");
        sel.className = "pdf-file-select";
        sel.type = "button";
        sel.setAttribute("aria-label", `Preview ${item.file.name}`);
        const thumb = document.createElement("span");
        thumb.className = "pdf-mini-preview";
        thumb.setAttribute("aria-hidden", "true");
        const im = document.createElement("img");
        im.src = item.url;
        im.alt = "";
        im.style.cssText = "width:48px;height:62px;object-fit:cover;border-radius:.3rem;";
        const det = document.createElement("span");
        det.className = "pdf-file-details";
        const nm = document.createElement("span");
        nm.className = "pdf-file-name";
        nm.textContent = item.file.name;
        nm.title = item.file.name;
        const sz = document.createElement("span");
        sz.className = "pdf-file-size";
        sz.textContent = `${item.width}×${item.height} • ${fmt(item.file.size)}`;
        det.append(nm, sz);
        sel.append(thumb, det);
        thumb.replaceChildren(im);
        sel.addEventListener("click", () => select(item.id));
        const acts = document.createElement("div");
        acts.className = "pdf-file-actions";
        const up = document.createElement("button");
        up.type = "button"; up.textContent = "↑"; up.disabled = index === 0;
        up.setAttribute("aria-label", `Move ${item.file.name} up`);
        up.addEventListener("click", (e) => { e.stopPropagation(); move(item.id, -1); });
        const dn = document.createElement("button");
        dn.type = "button"; dn.textContent = "↓"; dn.disabled = index === files.length - 1;
        dn.setAttribute("aria-label", `Move ${item.file.name} down`);
        dn.addEventListener("click", (e) => { e.stopPropagation(); move(item.id, 1); });
        const rm = document.createElement("button");
        rm.type = "button"; rm.textContent = "×";
        rm.setAttribute("aria-label", `Remove ${item.file.name}`);
        rm.addEventListener("click", (e) => { e.stopPropagation(); remove(item.id); });
        acts.append(up, dn, rm);
        li.append(sel, acts);
        fileList.append(li);
    });
    fileCount.textContent = String(files.length);
    dropzone.hidden = files.length > 0;
    editor.hidden = files.length === 0;
    controls.hidden = files.length === 0;
    actionBtn.disabled = files.length === 0;
}

async function addFiles(list) {
    if (!list?.length) return;
    if (files.length + list.length > MAX_FILES) {
        setStatus(`Max ${MAX_FILES} images at a time.`, true);
        return;
    }
    const added = [];
    for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/")) { setStatus(`Skipped non-image: ${file.name}`, true); continue; }
        if (file.size > MAX_BYTES) { setStatus(`Skipped over 25 MB: ${file.name}`, true); continue; }
        if (file.size === 0) continue;
        try {
            const img = await loadImage(file);
            files.push({ id: nextId++, file, url: URL.createObjectURL(file), width: img.naturalWidth, height: img.naturalHeight });
            added.push(file.name);
        } catch {
            setStatus(`Could not read: ${file.name}`, true);
        }
    }
    if (selectedId === null && files.length) select(files[0].id);
    else render();
    if (files.length) setStatus(`${files.length} image${files.length > 1 ? "s" : ""} ready. Reorder with ↑↓, then build.`);
}

function openPicker() { fileInput.click(); }
document.querySelector("#choose-img")?.addEventListener("click", openPicker);
document.querySelector("#add-img")?.addEventListener("click", openPicker);
document.querySelector("#add-img-list")?.addEventListener("click", openPicker);
fileInput?.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
dropzone?.addEventListener("click", (e) => { if (!e.target.closest("button")) openPicker(); });
dropzone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); }
});
["dragenter", "dragover"].forEach((n) => dropzone?.parentElement?.addEventListener(n, (e) => {
    e.preventDefault(); dropzone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((n) => dropzone?.parentElement?.addEventListener(n, (e) => {
    e.preventDefault(); dropzone.classList.remove("is-dragging");
}));
dropzone?.parentElement?.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
});

actionBtn?.addEventListener("click", async () => {
    if (!files.length) return;
    if (!window.PDFLib) { setStatus("PDF library missing. Reload.", true); return; }
    actionBtn.disabled = true;
    const original = actionBtn.textContent;
    actionBtn.textContent = "Building…";
    try {
        const q = Number(qualityInput.value) / 100;
        const doc = await window.PDFLib.PDFDocument.create();
        const A4 = [595.28, 841.89];
        for (const [idx, item] of files.entries()) {
            setStatus(`Adding ${idx + 1}/${files.length}: ${item.file.name}…`);
            const buf = await item.file.arrayBuffer();
            let embedded, dims;
            const lower = item.file.name.toLowerCase();
            if (item.file.type === "image/png" || lower.endsWith(".png")) {
                embedded = await doc.embedPng(buf);
                dims = embedded.scale(1);
            } else {
                // normalize everything else through canvas to JPEG
                const img = await loadImage(item.file);
                const c = document.createElement("canvas");
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                const cx = c.getContext("2d");
                cx.fillStyle = "#ffffff";
                cx.fillRect(0, 0, c.width, c.height);
                cx.drawImage(img, 0, 0);
                const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
                if (!blob) throw new Error("Image encoding failed.");
                embedded = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
                dims = { width: c.width, height: c.height };
            }
            if (pageSizeSel.value === "a4") {
                const page = doc.addPage(A4);
                const k = Math.min((A4[0] - 72) / dims.width, (A4[1] - 72) / dims.height);
                const w = dims.width * k;
                const h = dims.height * k;
                page.drawImage(embedded, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
            } else {
                const page = doc.addPage([dims.width, dims.height]);
                page.drawImage(embedded, { x: 0, y: 0, width: dims.width, height: dims.height });
            }
        }
        const bytes = await doc.save({ useObjectStreams: true });
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "images.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setStatus(`PDF built from ${files.length} images. Download started.`);
    } catch (e) {
        setStatus(`Could not build PDF: ${String(e.message || e).slice(0, 160)}`, true);
    } finally {
        actionBtn.disabled = files.length === 0;
        actionBtn.textContent = original;
    }
});

render();
