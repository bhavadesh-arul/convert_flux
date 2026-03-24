/* ============================================================
   FileFlux — app.js
   All 7 tools, 100% browser-based, no server uploads
   ============================================================ */

// ---- PDF.js worker ----
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ============================================================
// NAVBAR HAMBURGER
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const ham = document.getElementById('hamburger');
  const links = document.querySelector('.nav-links');
  if (ham && links) {
    ham.addEventListener('click', () => links.classList.toggle('open'));
  }
});

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 3200);
}

// ============================================================
// FORMAT FILE SIZE
// ============================================================
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

// ============================================================
// TOOL PANEL OPEN / CLOSE
// ============================================================
const TOOL_CONFIGS = {
  'pdf-to-image':   { title: 'PDF to Images',          build: buildPdfToImage },
  'image-to-pdf':   { title: 'Images to PDF',          build: buildImageToPdf },
  'pdf-merge':      { title: 'Merge PDFs',             build: buildPdfMerge },
  'pdf-split':      { title: 'Split PDF',              build: buildPdfSplit },
  'image-compress': { title: 'Compress Image',         build: buildImageCompress },
  'image-convert':  { title: 'Convert Image Format',  build: buildImageConvert },
  'pdf-compress':   { title: 'Compress PDF',           build: buildPdfCompress },
};

function openTool(toolId) {
  const cfg = TOOL_CONFIGS[toolId];
  if (!cfg) return;

  const panel     = document.getElementById('toolPanel');
  const titleEl   = document.getElementById('panelTitle');
  const bodyEl    = document.getElementById('panelBody');
  const tools     = document.querySelector('.tools-section');
  const hero      = document.querySelector('.hero');
  const features  = document.getElementById('featuresSection');

  titleEl.textContent = cfg.title;
  bodyEl.innerHTML = '';
  cfg.build(bodyEl);

  panel.style.display    = 'block';
  if (tools) tools.style.display = 'none';
  if (hero)  hero.style.display  = 'none';
  if (features) features.style.display = 'none';

  // Hide top ad
  document.querySelectorAll('.ad-top').forEach(a => a.style.display = 'none');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeTool() {
  const panel     = document.getElementById('toolPanel');
  const tools     = document.querySelector('.tools-section');
  const hero      = document.querySelector('.hero');
  const features  = document.getElementById('featuresSection');

  panel.style.display = 'none';
  if (tools) tools.style.display = 'block';
  if (hero)  hero.style.display  = 'block';
  if (features) features.style.display = 'block';

  document.querySelectorAll('.ad-top').forEach(a => a.style.display = 'block');
}

// ============================================================
// HELPER: Build Drop Zone HTML
// ============================================================
function dropZoneHTML(id, label, accept, multiple = false) {
  return `
    <div class="drop-zone" id="dz_${id}">
      <input type="file" id="file_${id}" accept="${accept}" ${multiple ? 'multiple' : ''} />
      <div class="drop-icon">📂</div>
      <div class="drop-title">${label}</div>
      <div class="drop-sub">Click to browse or drag & drop here</div>
    </div>
    <div class="file-list" id="fl_${id}"></div>
  `;
}

// Attach drag-and-drop visuals
function attachDZ(id) {
  const dz = document.getElementById(`dz_${id}`);
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); });
}

function renderFileList(files, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  Array.from(files).forEach((f, i) => {
    el.innerHTML += `
      <div class="file-item">
        <span class="file-item-name">📄 ${f.name}</span>
        <span class="file-item-size">${fmtSize(f.size)}</span>
        <button class="file-item-remove" title="Remove">✕</button>
      </div>`;
  });
}

// Helper: trigger download of a Blob
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Progress helpers
function showProgress(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'block'; }
}
function setProgress(barId, pct, labelId, label) {
  const bar  = document.getElementById(barId);
  const lbl  = document.getElementById(labelId);
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = label;
}
function showResults(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

// ============================================================
// 1. PDF TO IMAGE
// ============================================================
function buildPdfToImage(container) {
  container.innerHTML = `
    ${dropZoneHTML('p2i', 'Drop a PDF file here', '.pdf', false)}
    <div class="options-row">
      <div class="option-group">
        <label class="option-label">Output Format</label>
        <select class="option-select" id="p2i_fmt">
          <option value="image/png">PNG</option>
          <option value="image/jpeg">JPG</option>
        </select>
      </div>
      <div class="option-group">
        <label class="option-label">Quality / Scale</label>
        <div class="slider-wrap">
          <input type="range" id="p2i_scale" min="1" max="3" step="0.5" value="2" />
          <span class="slider-value" id="p2i_scaleVal">2x</span>
        </div>
      </div>
    </div>
    <div class="info-box">⚡ <strong>Privacy:</strong> Your PDF never leaves your device. All processing happens locally in your browser.</div>
    <button class="action-btn" id="p2i_btn" disabled>🖼️ Convert to Images</button>

    <div class="progress-wrap" id="p2i_prog">
      <div class="progress-label" id="p2i_progLbl">Processing…</div>
      <div class="progress-bar-bg"><div class="progress-bar" id="p2i_bar"></div></div>
    </div>
    <div class="results-section" id="p2i_results">
      <div class="results-title">✅ Conversion Complete!</div>
      <div id="p2i_resItems"></div>
      <button class="download-all-btn" id="p2i_dlAll">⬇ Download All as ZIP</button>
    </div>
  `;

  attachDZ('p2i');
  const scaleInput = document.getElementById('p2i_scale');
  const scaleVal   = document.getElementById('p2i_scaleVal');
  scaleInput.addEventListener('input', () => scaleVal.textContent = scaleInput.value + 'x');

  let pdfFile = null;
  let resultBlobs = [];

  const fileInput = document.getElementById('file_p2i');
  fileInput.addEventListener('change', () => {
    pdfFile = fileInput.files[0];
    if (pdfFile) {
      renderFileList([pdfFile], 'fl_p2i');
      document.getElementById('p2i_btn').disabled = false;
    }
  });

  document.getElementById('p2i_btn').addEventListener('click', async () => {
    if (!pdfFile) return;
    const fmt   = document.getElementById('p2i_fmt').value;
    const scale = parseFloat(scaleInput.value);
    const ext   = fmt === 'image/jpeg' ? 'jpg' : 'png';
    resultBlobs = [];

    showProgress('p2i_prog');
    document.getElementById('p2i_btn').disabled = true;

    try {
      const arrBuf = await pdfFile.arrayBuffer();
      const pdf    = await pdfjsLib.getDocument({ data: arrBuf }).promise;
      const total  = pdf.numPages;
      const resEl  = document.getElementById('p2i_resItems');
      resEl.innerHTML = '';

      for (let i = 1; i <= total; i++) {
        setProgress('p2i_bar', (i / total) * 100, 'p2i_progLbl', `Rendering page ${i} of ${total}…`);
        const page     = await pdf.getPage(i);
        const vp       = page.getViewport({ scale });
        const canvas   = document.createElement('canvas');
        canvas.width   = vp.width;
        canvas.height  = vp.height;
        const ctx      = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const blob = await new Promise(res => canvas.toBlob(res, fmt, 0.92));
        resultBlobs.push({ blob, name: `page_${i}.${ext}` });

        const size = fmtSize(blob.size);
        resEl.innerHTML += `
          <div class="result-item">
            <span class="result-name">📄 page_${i}.${ext}</span>
            <span class="result-size">${size}</span>
            <button class="download-btn" data-idx="${resultBlobs.length - 1}">Download</button>
          </div>`;
      }

      showResults('p2i_results');
      setProgress('p2i_bar', 100, 'p2i_progLbl', 'Done!');

      // Wire individual download buttons
      resEl.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          downloadBlob(resultBlobs[idx].blob, resultBlobs[idx].name);
        });
      });

      // Download all as ZIP
      document.getElementById('p2i_dlAll').onclick = async () => {
        const zip = new JSZip();
        resultBlobs.forEach(r => zip.file(r.name, r.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'pdf_images.zip');
      };

      showToast(`${total} pages converted! 🎉`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error converting PDF. Please try a valid PDF file.', 'error');
    }
    document.getElementById('p2i_btn').disabled = false;
  });
}

// ============================================================
// 2. IMAGES TO PDF
// ============================================================
function buildImageToPdf(container) {
  container.innerHTML = `
    ${dropZoneHTML('i2p', 'Drop JPG/PNG images here', 'image/jpeg,image/png,image/webp', true)}
    <div class="options-row">
      <div class="option-group">
        <label class="option-label">Page Size</label>
        <select class="option-select" id="i2p_size">
          <option value="a4">A4</option>
          <option value="letter">Letter</option>
          <option value="fit">Fit to Image</option>
        </select>
      </div>
      <div class="option-group">
        <label class="option-label">Orientation</label>
        <select class="option-select" id="i2p_orient">
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </div>
    </div>
    <div class="info-box">💡 Images are added in the order you select them. Select all at once or use the tool multiple times.</div>
    <button class="action-btn" id="i2p_btn" disabled>📄 Create PDF</button>

    <div class="progress-wrap" id="i2p_prog">
      <div class="progress-label" id="i2p_progLbl">Processing…</div>
      <div class="progress-bar-bg"><div class="progress-bar" id="i2p_bar"></div></div>
    </div>
    <div class="results-section" id="i2p_results">
      <div class="results-title">✅ PDF Created!</div>
      <div id="i2p_resItems"></div>
    </div>
  `;

  attachDZ('i2p');
  let imgFiles = [];

  const fileInput = document.getElementById('file_i2p');
  fileInput.addEventListener('change', () => {
    imgFiles = Array.from(fileInput.files);
    renderFileList(imgFiles, 'fl_i2p');
    document.getElementById('i2p_btn').disabled = imgFiles.length === 0;
  });

  document.getElementById('i2p_btn').addEventListener('click', async () => {
    if (!imgFiles.length) return;
    showProgress('i2p_prog');
    document.getElementById('i2p_btn').disabled = true;

    try {
      const { jsPDF } = window.jspdf;
      const pageSize  = document.getElementById('i2p_size').value;
      const orient    = document.getElementById('i2p_orient').value;

      let pdf = null;

      for (let i = 0; i < imgFiles.length; i++) {
        setProgress('i2p_bar', ((i + 1) / imgFiles.length) * 100, 'i2p_progLbl', `Adding image ${i + 1} of ${imgFiles.length}…`);

        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = e => res(e.target.result);
          r.onerror = rej;
          r.readAsDataURL(imgFiles[i]);
        });

        const img  = await new Promise((res, rej) => {
          const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl;
        });

        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;

        if (pageSize === 'fit') {
          const w = imgW * 0.264583; // px to mm at 96dpi
          const h = imgH * 0.264583;
          if (!pdf) {
            pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h] });
          } else {
            pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
          }
          pdf.addImage(dataUrl, 'JPEG', 0, 0, w, h);
        } else {
          const fmt = pageSize === 'a4' ? 'a4' : 'letter';
          if (!pdf) {
            pdf = new jsPDF({ orientation: orient, unit: 'mm', format: fmt });
          } else {
            pdf.addPage(fmt, orient);
          }
          const pw = pdf.internal.pageSize.getWidth();
          const ph = pdf.internal.pageSize.getHeight();
          const ar = imgW / imgH;
          let dw = pw, dh = pw / ar;
          if (dh > ph) { dh = ph; dw = ph * ar; }
          const ox = (pw - dw) / 2, oy = (ph - dh) / 2;
          pdf.addImage(dataUrl, 'JPEG', ox, oy, dw, dh);
        }
      }

      const blob = pdf.output('blob');
      const size = fmtSize(blob.size);
      showResults('i2p_results');
      document.getElementById('i2p_resItems').innerHTML = `
        <div class="result-item">
          <span class="result-name">📄 images_combined.pdf</span>
          <span class="result-size">${size}</span>
          <button class="download-btn" id="i2p_dl">Download</button>
        </div>`;
      document.getElementById('i2p_dl').onclick = () => downloadBlob(blob, 'images_combined.pdf');
      showToast(`PDF created with ${imgFiles.length} pages! 🎉`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error creating PDF.', 'error');
    }
    document.getElementById('i2p_btn').disabled = false;
  });
}

// ============================================================
// 3. PDF MERGE
// ============================================================
function buildPdfMerge(container) {
  container.innerHTML = `
    ${dropZoneHTML('pm', 'Drop PDF files to merge', '.pdf', true)}
    <div class="info-box">📌 PDFs will be merged in the order shown. Select them in the order you want.</div>
    <button class="action-btn" id="pm_btn" disabled>📎 Merge PDFs</button>

    <div class="progress-wrap" id="pm_prog">
      <div class="progress-label" id="pm_progLbl">Merging…</div>
      <div class="progress-bar-bg"><div class="progress-bar" id="pm_bar"></div></div>
    </div>
    <div class="results-section" id="pm_results">
      <div class="results-title">✅ PDFs Merged!</div>
      <div id="pm_resItems"></div>
    </div>
  `;

  attachDZ('pm');
  let pdfFiles = [];

  const fileInput = document.getElementById('file_pm');
  fileInput.addEventListener('change', () => {
    pdfFiles = Array.from(fileInput.files);
    renderFileList(pdfFiles, 'fl_pm');
    document.getElementById('pm_btn').disabled = pdfFiles.length < 2;
  });

  document.getElementById('pm_btn').addEventListener('click', async () => {
    if (pdfFiles.length < 2) { showToast('Select at least 2 PDF files.', 'error'); return; }
    showProgress('pm_prog');
    document.getElementById('pm_btn').disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const merged = await PDFDocument.create();

      for (let i = 0; i < pdfFiles.length; i++) {
        setProgress('pm_bar', ((i + 1) / pdfFiles.length) * 90, 'pm_progLbl', `Processing ${pdfFiles[i].name}…`);
        const buf  = await pdfFiles[i].arrayBuffer();
        const doc  = await PDFDocument.load(buf);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }

      setProgress('pm_bar', 98, 'pm_progLbl', 'Saving merged PDF…');
      const bytes = await merged.save();
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      const size  = fmtSize(blob.size);

      showResults('pm_results');
      document.getElementById('pm_resItems').innerHTML = `
        <div class="result-item">
          <span class="result-name">📄 merged.pdf</span>
          <span class="result-size">${size}</span>
          <button class="download-btn" id="pm_dl">Download</button>
        </div>`;
      document.getElementById('pm_dl').onclick = () => downloadBlob(blob, 'merged.pdf');
      setProgress('pm_bar', 100, 'pm_progLbl', 'Done!');
      showToast('PDFs merged successfully! 🎉', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error merging PDFs. Are they valid, non-encrypted PDFs?', 'error');
    }
    document.getElementById('pm_btn').disabled = false;
  });
}

// ============================================================
// 4. PDF SPLIT
// ============================================================
function buildPdfSplit(container) {
  container.innerHTML = `
    ${dropZoneHTML('ps', 'Drop a PDF file to split', '.pdf', false)}
    <div class="options-row">
      <div class="option-group">
        <label class="option-label">Split Mode</label>
        <select class="option-select" id="ps_mode">
          <option value="all">Every Page (individual files)</option>
          <option value="range">Page Range</option>
        </select>
      </div>
      <div class="option-group" id="ps_rangeGroup" style="display:none;">
        <label class="option-label">Pages (e.g. 1-3, 5, 7-9)</label>
        <input type="text" class="option-input" id="ps_range" placeholder="1-3, 5, 7-9" style="width:180px;" />
      </div>
    </div>
    <div class="info-box">✂️ Split a PDF into individual pages or extract a specific range of pages.</div>
    <button class="action-btn" id="ps_btn" disabled>✂️ Split PDF</button>

    <div class="progress-wrap" id="ps_prog">
      <div class="progress-label" id="ps_progLbl">Splitting…</div>
      <div class="progress-bar-bg"><div class="progress-bar" id="ps_bar"></div></div>
    </div>
    <div class="results-section" id="ps_results">
      <div class="results-title">✅ Split Complete!</div>
      <div id="ps_resItems"></div>
      <button class="download-all-btn" id="ps_dlAll">⬇ Download All as ZIP</button>
    </div>
  `;

  attachDZ('ps');

  const modeSelect = document.getElementById('ps_mode');
  const rangeGroup = document.getElementById('ps_rangeGroup');
  modeSelect.addEventListener('change', () => {
    rangeGroup.style.display = modeSelect.value === 'range' ? 'flex' : 'none';
  });

  let pdfFile = null;
  let resultBlobs = [];

  const fileInput = document.getElementById('file_ps');
  fileInput.addEventListener('change', () => {
    pdfFile = fileInput.files[0];
    if (pdfFile) { renderFileList([pdfFile], 'fl_ps'); document.getElementById('ps_btn').disabled = false; }
  });

  document.getElementById('ps_btn').addEventListener('click', async () => {
    if (!pdfFile) return;
    showProgress('ps_prog');
    document.getElementById('ps_btn').disabled = true;
    resultBlobs = [];

    try {
      const { PDFDocument } = PDFLib;
      const buf    = await pdfFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(buf);
      const total  = srcDoc.getPageCount();
      const mode   = modeSelect.value;
      const resEl  = document.getElementById('ps_resItems');
      resEl.innerHTML = '';

      let pageNums = [];
      if (mode === 'all') {
        pageNums = Array.from({ length: total }, (_, i) => i + 1);
      } else {
        const rangeStr = document.getElementById('ps_range').value.trim();
        if (!rangeStr) { showToast('Enter page ranges like 1-3, 5', 'error'); document.getElementById('ps_btn').disabled = false; return; }
        rangeStr.split(',').forEach(part => {
          part = part.trim();
          if (part.includes('-')) {
            const [a, b] = part.split('-').map(Number);
            for (let x = a; x <= b; x++) { if (x >= 1 && x <= total) pageNums.push(x); }
          } else {
            const n = parseInt(part);
            if (n >= 1 && n <= total) pageNums.push(n);
          }
        });
        pageNums = [...new Set(pageNums)].sort((a, b) => a - b);
      }

      for (let i = 0; i < pageNums.length; i++) {
        const pg  = pageNums[i];
        setProgress('ps_bar', ((i + 1) / pageNums.length) * 100, 'ps_progLbl', `Extracting page ${pg}…`);
        const doc = await PDFDocument.create();
        const [copied] = await doc.copyPages(srcDoc, [pg - 1]);
        doc.addPage(copied);
        const bytes = await doc.save();
        const blob  = new Blob([bytes], { type: 'application/pdf' });
        resultBlobs.push({ blob, name: `page_${pg}.pdf` });

        const size = fmtSize(blob.size);
        resEl.innerHTML += `
          <div class="result-item">
            <span class="result-name">📄 page_${pg}.pdf</span>
            <span class="result-size">${size}</span>
            <button class="download-btn" data-idx="${resultBlobs.length - 1}">Download</button>
          </div>`;
      }

      showResults('ps_results');
      resEl.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          downloadBlob(resultBlobs[idx].blob, resultBlobs[idx].name);
        });
      });

      document.getElementById('ps_dlAll').onclick = async () => {
        const zip = new JSZip();
        resultBlobs.forEach(r => zip.file(r.name, r.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'split_pages.zip');
      };

      showToast(`${pageNums.length} pages extracted! 🎉`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error splitting PDF.', 'error');
    }
    document.getElementById('ps_btn').disabled = false;
  });
}

// ============================================================
// 5. IMAGE COMPRESS
// ============================================================
function buildImageCompress(container) {
  container.innerHTML = `
    ${dropZoneHTML('ic', 'Drop images to compress (JPG/PNG/WebP)', 'image/*', true)}
    <div class="options-row">
      <div class="option-group">
        <label class="option-label">Max File Size (KB)</label>
        <input type="number" class="option-input" id="ic_maxKb" value="200" min="10" max="5000" style="width:120px;" />
      </div>
      <div class="option-group">
        <label class="option-label">Quality (0–1)</label>
        <div class="slider-wrap">
          <input type="range" id="ic_quality" min="0.1" max="1" step="0.05" value="0.8" />
          <span class="slider-value" id="ic_qualVal">0.80</span>
        </div>
      </div>
    </div>
    <div class="info-box">🗜️ Images are compressed in your browser using smart algorithms. Original files are never touched.</div>
    <button class="action-btn" id="ic_btn" disabled>🗜️ Compress Images</button>

    <div class="progress-wrap" id="ic_prog">
      <div class="progress-label" id="ic_progLbl">Compressing…</div>
      <div class="progress-bar-bg"><div class="progress-bar" id="ic_bar"></div></div>
    </div>
    <div class="results-section" id="ic_results">
      <div class="results-title">✅ Compression Complete!</div>
      <div id="ic_resItems"></div>
      <button class="download-all-btn" id="ic_dlAll">⬇ Download All as ZIP</button>
    </div>
  `;

  attachDZ('ic');
  const qualInput = document.getElementById('ic_quality');
  const qualVal   = document.getElementById('ic_qualVal');
  qualInput.addEventListener('input', () => qualVal.textContent = parseFloat(qualInput.value).toFixed(2));

  let imgFiles = [];
  let resultBlobs = [];

  const fileInput = document.getElementById('file_ic');
  fileInput.addEventListener('change', () => {
    imgFiles = Array.from(fileInput.files);
    renderFileList(imgFiles, 'fl_ic');
    document.getElementById('ic_btn').disabled = imgFiles.length === 0;
  });

  document.getElementById('ic_btn').addEventListener('click', async () => {
    if (!imgFiles.length) return;
    showProgress('ic_prog');
    document.getElementById('ic_btn').disabled = true;
    resultBlobs = [];

    const maxKb   = parseInt(document.getElementById('ic_maxKb').value) || 200;
    const quality = parseFloat(qualInput.value);
    const resEl   = document.getElementById('ic_resItems');
    resEl.innerHTML = '';

    try {
      for (let i = 0; i < imgFiles.length; i++) {
        setProgress('ic_bar', ((i + 1) / imgFiles.length) * 100, 'ic_progLbl', `Compressing ${imgFiles[i].name}…`);
        const origSize = imgFiles[i].size;

        const compressed = await imageCompression(imgFiles[i], {
          maxSizeMB:      maxKb / 1024,
          maxWidthOrHeight: 4096,
          initialQuality: quality,
          useWebWorker:   true,
        });

        const blob = new Blob([compressed], { type: compressed.type });
        resultBlobs.push({ blob, name: `compressed_${imgFiles[i].name}` });

        const pct = ((1 - blob.size / origSize) * 100).toFixed(1);
        resEl.innerHTML += `
          <div class="result-item">
            <span class="result-name">🖼️ ${imgFiles[i].name}</span>
            <span class="result-size">${fmtSize(origSize)} → ${fmtSize(blob.size)} (↓${pct}%)</span>
            <button class="download-btn" data-idx="${resultBlobs.length - 1}">Download</button>
          </div>`;
      }

      showResults('ic_results');
      resEl.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          downloadBlob(resultBlobs[idx].blob, resultBlobs[idx].name);
        });
      });

      document.getElementById('ic_dlAll').onclick = async () => {
        const zip = new JSZip();
        resultBlobs.forEach(r => zip.file(r.name, r.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'compressed_images.zip');
      };

      showToast(`${imgFiles.length} image(s) compressed! 🎉`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error compressing images.', 'error');
    }
    document.getElementById('ic_btn').disabled = false;
  });
}

// ============================================================
// 6. IMAGE FORMAT CONVERT
// ============================================================
function buildImageConvert(container) {
  container.innerHTML = `
    ${dropZoneHTML('ifc', 'Drop images to convert', 'image/*', true)}
    <div class="options-row">
      <div class="option-group">
        <label class="option-label">Convert To</label>
        <select class="option-select" id="ifc_fmt">
          <option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option>
          <option value="image/webp">WebP</option>
        </select>
      </div>
      <div class="option-group">
        <label class="option-label">Quality (JPG/WebP)</label>
        <div class="slider-wrap">
          <input type="range" id="ifc_q" min="0.5" max="1" step="0.05" value="0.92" />
          <span class="slider-value" id="ifc_qVal">92%</span>
        </div>
      </div>
    </div>
    <div class="info-box">🔄 Convert between JPG, PNG, and WebP formats instantly in your browser.</div>
    <button class="action-btn" id="ifc_btn" disabled>🔄 Convert Images</button>

    <div class="progress-wrap" id="ifc_prog">
      <div class="progress-label" id="ifc_progLbl">Converting…</div>
      <div class="progress-bar-bg"><div class="progress-bar" id="ifc_bar"></div></div>
    </div>
    <div class="results-section" id="ifc_results">
      <div class="results-title">✅ Conversion Complete!</div>
      <div id="ifc_resItems"></div>
      <button class="download-all-btn" id="ifc_dlAll">⬇ Download All as ZIP</button>
    </div>
  `;

  attachDZ('ifc');
  const qInput = document.getElementById('ifc_q');
  const qVal   = document.getElementById('ifc_qVal');
  qInput.addEventListener('input', () => qVal.textContent = Math.round(parseFloat(qInput.value) * 100) + '%');

  let imgFiles = [];
  let resultBlobs = [];

  const fileInput = document.getElementById('file_ifc');
  fileInput.addEventListener('change', () => {
    imgFiles = Array.from(fileInput.files);
    renderFileList(imgFiles, 'fl_ifc');
    document.getElementById('ifc_btn').disabled = imgFiles.length === 0;
  });

  document.getElementById('ifc_btn').addEventListener('click', async () => {
    if (!imgFiles.length) return;
    showProgress('ifc_prog');
    document.getElementById('ifc_btn').disabled = true;
    resultBlobs = [];

    const fmt = document.getElementById('ifc_fmt').value;
    const q   = parseFloat(qInput.value);
    const ext = fmt === 'image/jpeg' ? 'jpg' : fmt === 'image/webp' ? 'webp' : 'png';
    const resEl = document.getElementById('ifc_resItems');
    resEl.innerHTML = '';

    try {
      for (let i = 0; i < imgFiles.length; i++) {
        setProgress('ifc_bar', ((i + 1) / imgFiles.length) * 100, 'ifc_progLbl', `Converting ${imgFiles[i].name}…`);

        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(imgFiles[i]);
        });
        const img = await new Promise((res, rej) => {
          const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (fmt === 'image/jpeg') {
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);

        const blob = await new Promise(res => canvas.toBlob(res, fmt, q));
        const baseName = imgFiles[i].name.replace(/\.[^.]+$/, '');
        resultBlobs.push({ blob, name: `${baseName}.${ext}` });

        resEl.innerHTML += `
          <div class="result-item">
            <span class="result-name">🖼️ ${baseName}.${ext}</span>
            <span class="result-size">${fmtSize(blob.size)}</span>
            <button class="download-btn" data-idx="${resultBlobs.length - 1}">Download</button>
          </div>`;
      }

      showResults('ifc_results');
      resEl.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          downloadBlob(resultBlobs[idx].blob, resultBlobs[idx].name);
        });
      });

      document.getElementById('ifc_dlAll').onclick = async () => {
        const zip = new JSZip();
        resultBlobs.forEach(r => zip.file(r.name, r.blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'converted_images.zip');
      };

      showToast(`${imgFiles.length} image(s) converted! 🎉`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error converting images.', 'error');
    }
    document.getElementById('ifc_btn').disabled = false;
  });
}

// ============================================================
// 7. PDF COMPRESS
// ============================================================
function buildPdfCompress(container) {
  container.innerHTML = `
    ${dropZoneHTML('pc', 'Drop a PDF file to compress', '.pdf', false)}
    <div class="options-row">
      <div class="option-group">
        <label class="option-label">Image Quality</label>
        <div class="slider-wrap">
          <input type="range" id="pc_q" min="0.3" max="0.95" step="0.05" value="0.7" />
          <span class="slider-value" id="pc_qVal">70%</span>
        </div>
      </div>
      <div class="option-group">
        <label class="option-label">Image Scale</label>
        <div class="slider-wrap">
          <input type="range" id="pc_scale" min="0.3" max="1" step="0.1" value="0.8" />
          <span class="slider-value" id="pc_scaleVal">80%</span>
        </div>
      </div>
    </div>
    <div class="info-box">🗜️ PDF compression works by re-rendering and compressing embedded images. Text quality is not affected. Best for image-heavy PDFs.</div>
    <button class="action-btn" id="pc_btn" disabled>🗜️ Compress PDF</button>

    <div class="progress-wrap" id="pc_prog">
      <div class="progress-label" id="pc_progLbl">Compressing…</div>
      <div class="progress-bar-bg"><div class="progress-bar" id="pc_bar"></div></div>
    </div>
    <div class="results-section" id="pc_results">
      <div class="results-title">✅ PDF Compressed!</div>
      <div id="pc_resItems"></div>
    </div>
  `;

  attachDZ('pc');

  const qIn   = document.getElementById('pc_q');
  const qVal  = document.getElementById('pc_qVal');
  const scIn  = document.getElementById('pc_scale');
  const scVal = document.getElementById('pc_scaleVal');
  qIn.addEventListener('input', () => qVal.textContent = Math.round(parseFloat(qIn.value) * 100) + '%');
  scIn.addEventListener('input', () => scVal.textContent = Math.round(parseFloat(scIn.value) * 100) + '%');

  let pdfFile = null;

  const fileInput = document.getElementById('file_pc');
  fileInput.addEventListener('change', () => {
    pdfFile = fileInput.files[0];
    if (pdfFile) { renderFileList([pdfFile], 'fl_pc'); document.getElementById('pc_btn').disabled = false; }
  });

  document.getElementById('pc_btn').addEventListener('click', async () => {
    if (!pdfFile) return;
    showProgress('pc_prog');
    document.getElementById('pc_btn').disabled = true;

    const quality = parseFloat(qIn.value);
    const imgScale = parseFloat(scIn.value);

    try {
      const origSize = pdfFile.size;
      setProgress('pc_bar', 10, 'pc_progLbl', 'Loading PDF…');

      const arrBuf  = await pdfFile.arrayBuffer();
      const pdfDoc  = await pdfjsLib.getDocument({ data: arrBuf }).promise;
      const { PDFDocument, rgb } = PDFLib;
      const newPdf  = await PDFDocument.create();
      const total   = pdfDoc.numPages;

      for (let i = 1; i <= total; i++) {
        setProgress('pc_bar', 10 + (i / total) * 80, 'pc_progLbl', `Re-rendering page ${i} of ${total}…`);

        const page = await pdfDoc.getPage(i);
        const vp   = page.getViewport({ scale: imgScale * 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
        const imgBytes   = Uint8Array.from(atob(imgDataUrl.split(',')[1]), c => c.charCodeAt(0));
        const jpgImg     = await newPdf.embedJpg(imgBytes);

        const origVp  = page.getViewport({ scale: 1 });
        const newPage = newPdf.addPage([origVp.width, origVp.height]);
        newPage.drawImage(jpgImg, { x: 0, y: 0, width: origVp.width, height: origVp.height });
      }

      setProgress('pc_bar', 95, 'pc_progLbl', 'Saving…');
      const bytes    = await newPdf.save();
      const blob     = new Blob([bytes], { type: 'application/pdf' });
      const newSize  = blob.size;
      const pct      = ((1 - newSize / origSize) * 100).toFixed(1);

      showResults('pc_results');
      document.getElementById('pc_resItems').innerHTML = `
        <div class="result-item">
          <span class="result-name">📄 compressed.pdf</span>
          <span class="result-size">${fmtSize(origSize)} → ${fmtSize(newSize)} (↓${pct}%)</span>
          <button class="download-btn" id="pc_dl">Download</button>
        </div>`;
      document.getElementById('pc_dl').onclick = () => downloadBlob(blob, 'compressed.pdf');
      setProgress('pc_bar', 100, 'pc_progLbl', 'Done!');
      showToast(`PDF compressed by ${pct}%! 🎉`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error compressing PDF. Try reducing the scale/quality settings.', 'error');
    }
    document.getElementById('pc_btn').disabled = false;
  });
}
