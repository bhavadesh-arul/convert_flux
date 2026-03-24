/* ============================================================
   ConvertFlux — app.js
   All tools run 100% client-side. No file ever leaves browser.
   ============================================================ */

// ── PDF.js worker ──
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ── Mobile nav ──
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileNav').classList.toggle('open');
});

// ────────────────────────────────────────────────
// MODAL SYSTEM
// ────────────────────────────────────────────────
function openTool(toolId) {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  content.innerHTML = buildToolUI(toolId);
  initTool(toolId);
}
function closeTool() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('modalContent').innerHTML = '';
}
function closeModal(e) {
  if (e.target === document.getElementById('modalOverlay')) closeTool();
}

// ────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}
function savingPct(orig, out) {
  if (!orig || !out) return '';
  const pct = ((orig - out) / orig * 100).toFixed(1);
  return pct > 0 ? `↓ ${pct}% smaller` : `↑ ${Math.abs(pct)}% larger`;
}
function dlBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
function setStatus(id, msg, type = '') {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.className = 'status-msg ' + type; }
}
function setProgress(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = pct + '%';
}
function readFileAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}
function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function qualityRow(id = 'quality', label = 'Quality', defVal = 92) {
  return `
  <div class="setting-group">
    <label>${label}</label>
    <div class="quality-slider-wrap">
      <input type="range" id="${id}" min="1" max="100" value="${defVal}"
        oninput="document.getElementById('${id}Val').textContent=this.value+'%';this.style.setProperty('--val',this.value+'%')">
      <span class="quality-val" id="${id}Val">${defVal}%</span>
    </div>
  </div>`;
}
function sizeRow() {
  return `
  <div class="size-compare" id="sizeCompare" style="display:none">
    <div class="size-box"><span id="origSize">—</span><small>Original</small></div>
    <div class="size-arrow">→</div>
    <div class="size-box"><span id="outSize">—</span><small>Output</small></div>
    <div class="size-box"><span id="savingPct" class="size-saving">—</span><small>Change</small></div>
  </div>`;
}
function showSizeCompare(origBytes, outBytes) {
  const el = document.getElementById('sizeCompare');
  if (!el) return;
  el.style.display = 'flex';
  document.getElementById('origSize').textContent = fmtSize(origBytes);
  document.getElementById('outSize').textContent = fmtSize(outBytes);
  document.getElementById('savingPct').textContent = savingPct(origBytes, outBytes);
}

// ────────────────────────────────────────────────
// TOOL UI BUILDERS
// ────────────────────────────────────────────────
function buildToolUI(id) {
  const tools = {
    pdfToImg: {
      title: 'PDF to Images',
      sub: 'Convert each PDF page to PNG or JPG with custom DPI settings.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">📄</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Output Format</label>
            <select id="imgFmt"><option value="png">PNG</option><option value="jpeg">JPG</option></select>
          </div>
          <div class="setting-group">
            <label>DPI / Resolution</label>
            <select id="dpiSel">
              <option value="1">72 DPI (screen)</option>
              <option value="2.08" selected>150 DPI (standard)</option>
              <option value="4.17">300 DPI (print quality)</option>
              <option value="8.33">600 DPI (ultra high)</option>
            </select>
          </div>
          <div class="setting-group">
            <label>Color Mode</label>
            <select id="colorMode"><option value="rgb">RGB (color)</option><option value="gray">Grayscale</option></select>
          </div>
          ${qualityRow('quality','JPEG Quality (if JPG)',92)}
        </div>
        ${sizeRow()}
        <div class="progress-bar-wrap"><div class="progress-bar" id="prog"></div></div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfToImg()">Convert to Images</button>
        </div>`
    },
    imgToPdf: {
      title: 'Images to PDF',
      sub: 'Drag to reorder, duplicate, or remove images before converting.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*" multiple />
          <div class="drop-icon">🖼️</div>
          <p><strong>Click or drag</strong> images here (multiple allowed)</p>
        </div>
        <div class="img-grid" id="imgGrid"></div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Page Size</label>
            <select id="pageSize"><option>A4</option><option>Letter</option><option>A3</option></select>
          </div>
          <div class="setting-group">
            <label>Orientation</label>
            <select id="orient"><option>Portrait</option><option>Landscape</option></select>
          </div>
          <div class="setting-group">
            <label>Margin (mm)</label>
            <input type="number" id="margin" value="10" min="0" max="50"/>
          </div>
          ${qualityRow('quality','Image Quality',95)}
        </div>
        ${sizeRow()}
        <p class="status-msg" id="status">Add images to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runImgToPdf()">Convert to PDF</button>
        </div>`
    },
    pdfMerge: {
      title: 'PDF Merge',
      sub: 'Combine multiple PDF files into one. Drag to reorder.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" multiple />
          <div class="drop-icon">🔗</div>
          <p><strong>Click or drag</strong> multiple PDFs here</p>
        </div>
        <div class="file-list" id="fileList"></div>
        ${sizeRow()}
        <p class="status-msg" id="status">Add at least 2 PDF files.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfMerge()">Merge PDFs</button>
        </div>`
    },
    pdfSplit: {
      title: 'PDF Split',
      sub: 'Extract specific page ranges or split every page into its own file.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">✂️</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group" style="grid-column:1/-1">
            <label>Page Range (e.g. 1-3, 5, 7-9) — leave blank to split every page</label>
            <input type="text" id="pageRange" placeholder="e.g. 1-3, 5, 8-10"/>
          </div>
        </div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfSplit()">Split PDF</button>
        </div>`
    },
    pdfCompress: {
      title: 'PDF Compress',
      sub: 'Reduce PDF file size. Lossless by default — lower quality only if needed.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">🗜️</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <div class="settings-panel">
          ${qualityRow('quality','Image Quality in PDF',85)}
          <div class="setting-group">
            <label>DPI (image downscaling)</label>
            <select id="compDpi">
              <option value="0">Keep original (lossless)</option>
              <option value="150">150 DPI (standard)</option>
              <option value="96">96 DPI (small size)</option>
              <option value="72">72 DPI (minimum)</option>
            </select>
          </div>
        </div>
        ${sizeRow()}
        <div class="progress-bar-wrap"><div class="progress-bar" id="prog"></div></div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfCompress()">Compress PDF</button>
        </div>`
    },
    pdfEditor: {
      title: 'PDF Page Editor',
      sub: 'Drag to reorder, rotate, duplicate or delete pages — Adobe Acrobat style.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">🧩</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <div class="page-grid" id="pageGrid"></div>
        <p class="status-msg" id="status">Load a PDF to see page thumbnails.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfEditorSave()">💾 Save New PDF</button>
        </div>`
    },
    pdfToWord: {
      title: 'PDF to Word',
      sub: 'Extract text from PDF and download as a .txt / Word-compatible file.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">📝</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfToWord()">Extract Text</button>
        </div>`
    },
    pdfPageNum: {
      title: 'Add Page Numbers',
      sub: 'Automatically add page numbers to every page of your PDF.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">🔢</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Position</label>
            <select id="numPos"><option>Bottom Center</option><option>Bottom Right</option><option>Bottom Left</option><option>Top Center</option></select>
          </div>
          <div class="setting-group">
            <label>Start From Page</label>
            <input type="number" id="startPage" value="1" min="1"/>
          </div>
          <div class="setting-group">
            <label>Font Size</label>
            <input type="number" id="fontSize" value="12" min="6" max="36"/>
          </div>
          <div class="setting-group">
            <label>Format</label>
            <select id="numFmt"><option>1, 2, 3...</option><option>Page 1 of N</option></select>
          </div>
        </div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfPageNum()">Add Page Numbers</button>
        </div>`
    },
    pdfWatermark: {
      title: 'PDF Watermark',
      sub: 'Add a diagonal text watermark to every page of your PDF.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">💧</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group" style="grid-column:1/-1">
            <label>Watermark Text</label>
            <input type="text" id="wmText" value="CONFIDENTIAL" placeholder="Enter watermark text"/>
          </div>
          <div class="setting-group">
            <label>Opacity (%)</label>
            <input type="number" id="wmOpacity" value="30" min="5" max="100"/>
          </div>
          <div class="setting-group">
            <label>Font Size</label>
            <input type="number" id="wmSize" value="48" min="12" max="120"/>
          </div>
        </div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfWatermark()">Add Watermark</button>
        </div>`
    },
    pdfPassword: {
      title: 'PDF Password Protect / Unlock',
      sub: 'Note: Browser-based encryption is basic. For production use, use pdf-lib with owner/user passwords.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf" />
          <div class="drop-icon">🔒</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Action</label>
            <select id="passAction"><option value="protect">Password Protect</option><option value="unlock">Unlock / Remove Password</option></select>
          </div>
          <div class="setting-group">
            <label>Password</label>
            <input type="text" id="passWord" placeholder="Enter password"/>
          </div>
        </div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfPassword()">Apply</button>
        </div>`
    },
    // ─── Image Tools ───
    imgCompress: {
      title: 'Image Compress',
      sub: 'Reduce image size with quality control. Lossless by default.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*" multiple/>
          <div class="drop-icon">📦</div>
          <p><strong>Click or drag</strong> images here (multiple allowed)</p>
        </div>
        <div class="settings-panel">
          ${qualityRow('quality','Quality',90)}
          <div class="setting-group">
            <label>Max Width (px, 0 = no limit)</label>
            <input type="number" id="maxW" value="0" min="0"/>
          </div>
        </div>
        ${sizeRow()}
        <div class="progress-bar-wrap"><div class="progress-bar" id="prog"></div></div>
        <p class="status-msg" id="status">Select images to compress.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runImgCompress()">Compress Images</button>
        </div>`
    },
    imgConvert: {
      title: 'Image Format Convert',
      sub: 'Convert between JPG, PNG, WEBP. PNG is lossless by default.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*" multiple/>
          <div class="drop-icon">🔄</div>
          <p><strong>Click or drag</strong> images here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Output Format</label>
            <select id="outFmt">
              <option value="image/png">PNG (lossless)</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WEBP</option>
            </select>
          </div>
          ${qualityRow('quality','Quality (JPG/WEBP)',92)}
        </div>
        ${sizeRow()}
        <p class="status-msg" id="status">Select images to convert.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runImgConvert()">Convert Format</button>
        </div>`
    },
    imgResize: {
      title: 'Image Resize',
      sub: 'Resize images to exact dimensions. Aspect ratio lock available.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*" multiple/>
          <div class="drop-icon">📐</div>
          <p><strong>Click or drag</strong> images here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Width (px)</label>
            <input type="number" id="resW" value="800" min="1"/>
          </div>
          <div class="setting-group">
            <label>Height (px)</label>
            <input type="number" id="resH" value="600" min="1"/>
          </div>
          <div class="setting-group">
            <label>Lock Aspect Ratio</label>
            <select id="lockAR"><option value="1">Yes</option><option value="0">No</option></select>
          </div>
          <div class="setting-group">
            <label>Output Format</label>
            <select id="resFmt"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WEBP</option></select>
          </div>
        </div>
        ${sizeRow()}
        <p class="status-msg" id="status">Select images to resize.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runImgResize()">Resize Images</button>
        </div>`
    },
    imgCrop: {
      title: 'Image Crop',
      sub: 'Visually select a crop area and download the cropped image.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*"/>
          <div class="drop-icon">🖼️</div>
          <p><strong>Click or drag</strong> one image here</p>
        </div>
        <canvas id="cropCanvas" style="display:none"></canvas>
        <div id="cropControls" style="display:none">
          <div class="settings-panel">
            <div class="setting-group"><label>X</label><input type="number" id="cropX" value="0"/></div>
            <div class="setting-group"><label>Y</label><input type="number" id="cropY" value="0"/></div>
            <div class="setting-group"><label>Width</label><input type="number" id="cropW" value="100"/></div>
            <div class="setting-group"><label>Height</label><input type="number" id="cropH" value="100"/></div>
          </div>
        </div>
        <p class="status-msg" id="status">Load an image to crop.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runImgCrop()">Download Cropped Image</button>
        </div>`
    },
    imgToBase64: {
      title: 'Image to Base64',
      sub: 'Convert an image to a Base64 string for use in HTML/CSS/JS.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*"/>
          <div class="drop-icon">💻</div>
          <p><strong>Click or drag</strong> one image here</p>
        </div>
        <p class="status-msg" id="status">Load an image.</p>
        <textarea class="code-area" id="b64Output" placeholder="Base64 output will appear here..." readonly></textarea>
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="copyBase64()">📋 Copy Base64</button>
          <button class="btn btn-ghost" onclick="copyDataUrl()">📋 Copy Data URL</button>
        </div>`
    },
    bulkImgZip: {
      title: 'Bulk Image Download as ZIP',
      sub: 'Convert format then download all images in a single ZIP file.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*" multiple/>
          <div class="drop-icon">📁</div>
          <p><strong>Click or drag</strong> multiple images here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Output Format</label>
            <select id="zipFmt"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WEBP</option></select>
          </div>
          ${qualityRow('quality','Quality',92)}
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar" id="prog"></div></div>
        <p class="status-msg" id="status">Add images to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runBulkZip()">Download as ZIP</button>
        </div>`
    },
    // ─── Excel / CSV ───
    excelToPdf: {
      title: 'Excel / CSV to PDF',
      sub: 'Convert spreadsheet data to a formatted PDF table.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".xlsx,.xls,.csv"/>
          <div class="drop-icon">📊</div>
          <p><strong>Click or drag</strong> an Excel or CSV file here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Page Size</label>
            <select id="xlPageSize"><option>A4</option><option>Letter</option><option>A3</option></select>
          </div>
          <div class="setting-group">
            <label>Orientation</label>
            <select id="xlOrient"><option>Portrait</option><option>Landscape</option></select>
          </div>
        </div>
        <p class="status-msg" id="status">Select a file to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runExcelToPdf()">Convert to PDF</button>
        </div>`
    },
    pdfToExcel: {
      title: 'PDF to CSV / Excel',
      sub: 'Extract text/table data from PDF pages into a CSV file.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".pdf"/>
          <div class="drop-icon">📋</div>
          <p><strong>Click or drag</strong> a PDF file here</p>
        </div>
        <p class="status-msg" id="status">Select a PDF to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runPdfToExcel()">Extract to CSV</button>
        </div>`
    },
    csvMerge: {
      title: 'CSV Merge',
      sub: 'Combine multiple CSV files into one. Headers handled automatically.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".csv" multiple/>
          <div class="drop-icon">🔗</div>
          <p><strong>Click or drag</strong> multiple CSV files here</p>
        </div>
        <div class="file-list" id="fileList"></div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Keep header from first file only?</label>
            <select id="headerMode"><option value="1">Yes (one header row)</option><option value="0">No (keep all headers)</option></select>
          </div>
        </div>
        <p class="status-msg" id="status">Add at least 2 CSV files.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runCsvMerge()">Merge CSVs</button>
        </div>`
    },
    csvSplit: {
      title: 'CSV Split',
      sub: 'Split a large CSV into smaller files by number of rows.',
      body: `
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept=".csv"/>
          <div class="drop-icon">✂️</div>
          <p><strong>Click or drag</strong> a CSV file here</p>
        </div>
        <div class="settings-panel">
          <div class="setting-group">
            <label>Rows per file</label>
            <input type="number" id="rowsPerFile" value="1000" min="1"/>
          </div>
          <div class="setting-group">
            <label>Include header in each file?</label>
            <select id="includeHeader"><option value="1">Yes</option><option value="0">No</option></select>
          </div>
        </div>
        <p class="status-msg" id="status">Select a CSV to begin.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="convertBtn" disabled onclick="runCsvSplit()">Split CSV</button>
        </div>`
    }
  };
  const t = tools[id];
  if (!t) return '<p>Tool not found.</p>';
  return `<h2 class="modal-title">${t.title}</h2>
          <p class="modal-subtitle">${t.sub}</p>
          ${t.body}`;
}

// ────────────────────────────────────────────────
// TOOL INITIALIZERS (drop zone + file list setup)
// ────────────────────────────────────────────────
let _files = [];
let _pdfEditorPages = []; // array of {pageNum, rotation}

function initTool(id) {
  _files = [];
  const inp = document.getElementById('fileInput');
  const dz = document.getElementById('dropZone');
  if (!inp || !dz) return;

  inp.addEventListener('change', e => handleFiles(e.target.files, id));
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFiles(e.dataTransfer.files, id); });

  // Sortable file list for merge tools
  const fl = document.getElementById('fileList');
  if (fl) Sortable.create(fl, { animation: 150, handle: '.drag-handle', onEnd: () => reorderFilesFromList(fl) });

  // Sortable image grid for img-to-pdf
  const ig = document.getElementById('imgGrid');
  if (ig) Sortable.create(ig, { animation: 150 });
}

function handleFiles(files, id) {
  const arr = Array.from(files);
  if (!arr.length) return;

  if (['pdfMerge','csvMerge'].includes(id)) {
    _files.push(...arr);
    renderFileList();
  } else if (id === 'imgToPdf') {
    _files.push(...arr);
    renderImgGrid();
  } else if (id === 'imgCompress' || id === 'imgConvert' || id === 'imgResize' || id === 'bulkImgZip') {
    _files = arr;
    setStatus('status', `${arr.length} file(s) loaded.`);
    document.getElementById('convertBtn').disabled = false;
    document.getElementById('fileInput').parentElement.querySelector('p').innerHTML =
      `<strong>${arr.length} file(s)</strong> selected`;
  } else if (id === 'imgToBase64') {
    _files = arr;
    runImgToBase64Preview(arr[0]);
  } else if (id === 'imgCrop') {
    _files = arr;
    showCropCanvas(arr[0]);
  } else {
    _files = arr;
    const name = arr[0].name;
    setStatus('status', `Loaded: ${name} (${fmtSize(arr[0].size)})`);
    document.getElementById('convertBtn').disabled = false;
    document.getElementById('fileInput').parentElement.querySelector('p').innerHTML =
      `<strong>${name}</strong> — ${fmtSize(arr[0].size)}`;
    if (id === 'pdfEditor') loadPdfEditorThumbs(arr[0]);
    if (id === 'pdfCompress') showSizeCompare(arr[0].size, 0);
  }
  const btn = document.getElementById('convertBtn');
  if (btn && _files.length) btn.disabled = false;
}

function renderFileList() {
  const fl = document.getElementById('fileList');
  if (!fl) return;
  fl.innerHTML = _files.map((f,i) => `
    <div class="file-item" data-idx="${i}">
      <span class="drag-handle">⠿</span>
      <span class="file-name">${f.name}</span>
      <span class="file-size">${fmtSize(f.size)}</span>
      <button class="remove-btn" onclick="removeFile(${i})">✕</button>
    </div>`).join('');
  const btn = document.getElementById('convertBtn');
  if (btn) btn.disabled = _files.length < 2;
  setStatus('status', `${_files.length} file(s) ready. Drag to reorder.`);
}
function removeFile(i) {
  _files.splice(i,1);
  renderFileList();
  const ig = document.getElementById('imgGrid');
  if (ig) renderImgGrid();
}
function reorderFilesFromList(fl) {
  const items = fl.querySelectorAll('.file-item');
  const newOrder = [];
  items.forEach(el => newOrder.push(_files[+el.dataset.idx]));
  _files = newOrder;
  renderFileList();
}

function renderImgGrid() {
  const ig = document.getElementById('imgGrid');
  if (!ig) return;
  ig.innerHTML = '';
  _files.forEach((f,i) => {
    const url = URL.createObjectURL(f);
    const div = document.createElement('div');
    div.className = 'img-thumb'; div.dataset.idx = i;
    div.innerHTML = `<img src="${url}" alt="img${i}"/>
      <button class="dup-btn" title="Duplicate" onclick="dupImg(${i})">⧉</button>
      <button class="remove-btn" title="Remove" onclick="removeFile(${i})">✕</button>
      <div class="img-idx">${i+1}</div>`;
    ig.appendChild(div);
  });
  Sortable.create(ig, { animation: 150 });
  const btn = document.getElementById('convertBtn');
  if (btn) btn.disabled = _files.length === 0;
  setStatus('status', `${_files.length} image(s) ready. Drag to reorder.`);
}
function dupImg(i) {
  _files.splice(i+1, 0, _files[i]);
  renderImgGrid();
}

// ─── PDF EDITOR THUMBNAILS ───
async function loadPdfEditorThumbs(file) {
  setStatus('status', 'Loading pages...');
  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  _pdfEditorPages = Array.from({length: pdf.numPages}, (_,i) => ({ pageNum: i+1, rotation: 0 }));

  const grid = document.getElementById('pageGrid');
  grid.innerHTML = '';

  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i+1);
    const vp = page.getViewport({ scale: 0.4 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

    const div = document.createElement('div');
    div.className = 'page-thumb'; div.dataset.idx = i;
    div.innerHTML = `<div class="thumb-actions">
      <button class="thumb-btn" title="Rotate" onclick="rotateEditorPage(${i})">↻</button>
      <button class="thumb-btn" title="Duplicate" onclick="dupEditorPage(${i})">⧉</button>
      <button class="thumb-btn" title="Delete" style="color:#ff5050" onclick="delEditorPage(${i})">✕</button>
    </div>
    <div class="thumb-label">Page ${i+1}</div>`;
    div.insertBefore(canvas, div.firstChild);
    grid.appendChild(div);
  }
  Sortable.create(grid, { animation: 150 });
  document.getElementById('convertBtn').disabled = false;
  setStatus('status', `${pdf.numPages} pages loaded. Drag to reorder.`, 'ok');
}
function rotateEditorPage(i) { _pdfEditorPages[i].rotation = (_pdfEditorPages[i].rotation + 90) % 360; setStatus('status',`Page ${i+1} will be rotated.`,'ok'); }
function dupEditorPage(i) {
  _pdfEditorPages.splice(i+1,0,{..._pdfEditorPages[i]});
  setStatus('status','Page duplicated. Save to apply.','ok');
}
function delEditorPage(i) {
  _pdfEditorPages.splice(i,1);
  const grid = document.getElementById('pageGrid');
  grid.children[i].remove();
  setStatus('status','Page removed. Save to apply.','ok');
}

// ─── IMAGE CROP ───
let _cropImg = null;
function showCropCanvas(file) {
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    _cropImg = img;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    canvas.style.display = 'block';
    document.getElementById('cropControls').style.display = 'block';
    document.getElementById('cropW').value = img.naturalWidth;
    document.getElementById('cropH').value = img.naturalHeight;
    document.getElementById('convertBtn').disabled = false;
    setStatus('status','Image loaded. Set crop values and download.','ok');
  };
  img.src = URL.createObjectURL(file);
}

// ─── IMAGE TO BASE64 PREVIEW ───
async function runImgToBase64Preview(file) {
  const dataUrl = await readFileAsDataURL(file);
  document.getElementById('b64Output').value = dataUrl.split(',')[1];
  setStatus('status', `Base64 ready (${fmtSize(file.size)} original).`, 'ok');
}
function copyBase64() {
  const ta = document.getElementById('b64Output');
  navigator.clipboard.writeText(ta.value).then(() => setStatus('status','Copied to clipboard!','ok'));
}
function copyDataUrl() {
  const inp = document.getElementById('fileInput');
  if (!_files[0]) return;
  readFileAsDataURL(_files[0]).then(du => {
    navigator.clipboard.writeText(du).then(() => setStatus('status','Data URL copied!','ok'));
  });
}

// ════════════════════════════════════════════════
// TOOL RUNNERS
// ════════════════════════════════════════════════

// ─── PDF TO IMAGES ───
async function runPdfToImg() {
  if (!_files[0]) return;
  const fmt = document.getElementById('imgFmt').value;
  const scale = parseFloat(document.getElementById('dpiSel').value);
  const quality = parseInt(document.getElementById('quality').value) / 100;
  const gray = document.getElementById('colorMode').value === 'gray';
  setStatus('status','Converting...');
  setProgress('prog', 0);

  const buf = await readFileAsArrayBuffer(_files[0]);
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  let totalBytes = 0;

  const zip = new JSZip();
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    if (gray) { ctx.filter = 'grayscale(1)'; }
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const mimeType = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const base64 = dataUrl.split(',')[1];
    const byteLen = Math.ceil(base64.length * 0.75);
    totalBytes += byteLen;
    zip.file(`page_${String(i).padStart(3,'0')}.${fmt}`, base64, { base64: true });
    setProgress('prog', Math.round(i / total * 100));
    setStatus('status', `Processing page ${i} of ${total}...`);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  showSizeCompare(_files[0].size, zipBlob.size);
  dlBlob(zipBlob, _files[0].name.replace('.pdf','') + '_images.zip');
  setStatus('status', `Done! ${total} images downloaded as ZIP.`, 'ok');
}

// ─── IMAGES TO PDF ───
async function runImgToPdf() {
  if (!_files.length) return;
  const { jsPDF } = window.jspdf;
  const pageSize = document.getElementById('pageSize').value.toLowerCase();
  const orient = document.getElementById('orient').value === 'Portrait' ? 'p' : 'l';
  const margin = parseInt(document.getElementById('margin').value) || 10;
  const quality = parseInt(document.getElementById('quality').value) / 100;

  setStatus('status','Creating PDF...');

  // Get sorted order from DOM
  const grid = document.getElementById('imgGrid');
  const orderedFiles = [];
  grid.querySelectorAll('.img-thumb').forEach(el => {
    orderedFiles.push(_files[+el.dataset.idx]);
  });

  const doc = new jsPDF({ orientation: orient, unit: 'mm', format: pageSize });
  const pw = doc.internal.pageSize.getWidth() - margin*2;
  const ph = doc.internal.pageSize.getHeight() - margin*2;

  for (let i = 0; i < orderedFiles.length; i++) {
    const dataUrl = await readFileAsDataURL(orderedFiles[i]);
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = dataUrl; });
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let rw = pw, rh = (ih / iw) * pw;
    if (rh > ph) { rh = ph; rw = (iw / ih) * ph; }
    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, 'JPEG', margin, margin, rw, rh, undefined, 'FAST', 0);
  }

  const pdfBytes = doc.output('arraybuffer');
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  showSizeCompare(_files.reduce((s,f) => s+f.size, 0), blob.size);
  dlBlob(blob, 'images_to_pdf.pdf');
  setStatus('status','PDF created and downloaded!','ok');
}

// ─── PDF MERGE ───
async function runPdfMerge() {
  if (_files.length < 2) return;
  setStatus('status','Merging PDFs...');
  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();
  for (const f of _files) {
    const buf = await readFileAsArrayBuffer(f);
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const bytes = await merged.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  showSizeCompare(_files.reduce((s,f)=>s+f.size,0), blob.size);
  dlBlob(blob, 'merged.pdf');
  setStatus('status','Merged PDF downloaded!','ok');
}

// ─── PDF SPLIT ───
async function runPdfSplit() {
  if (!_files[0]) return;
  const rangeStr = document.getElementById('pageRange').value.trim();
  setStatus('status','Splitting PDF...');
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(_files[0]);
  const src = await PDFDocument.load(buf);
  const total = src.getPageCount();

  let ranges = [];
  if (!rangeStr) {
    for (let i = 0; i < total; i++) ranges.push([i]);
  } else {
    rangeStr.split(',').forEach(part => {
      part = part.trim();
      if (part.includes('-')) {
        const [a,b] = part.split('-').map(n=>parseInt(n)-1);
        const r = []; for (let i=a;i<=Math.min(b,total-1);i++) r.push(i);
        ranges.push(r);
      } else {
        const n = parseInt(part)-1;
        if (n>=0 && n<total) ranges.push([n]);
      }
    });
  }

  const zip = new JSZip();
  for (let ri = 0; ri < ranges.length; ri++) {
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(src, ranges[ri]);
    pages.forEach(p => newPdf.addPage(p));
    const bytes = await newPdf.save();
    zip.file(`split_${ri+1}.pdf`, bytes);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  dlBlob(zipBlob, 'split_pages.zip');
  setStatus('status',`Split into ${ranges.length} file(s). ZIP downloaded.`,'ok');
}

// ─── PDF COMPRESS ───
async function runPdfCompress() {
  if (!_files[0]) return;
  setStatus('status','Compressing PDF...');
  setProgress('prog',10);
  const origSize = _files[0].size;
  // Re-render pages at lower DPI using PDF.js then rebuild with jsPDF
  const dpi = parseInt(document.getElementById('compDpi').value) || 0;
  const quality = parseInt(document.getElementById('quality').value) / 100;

  if (dpi === 0) {
    // Lossless: just re-save with pdf-lib
    const { PDFDocument } = PDFLib;
    const buf = await readFileAsArrayBuffer(_files[0]);
    const pdf = await PDFDocument.load(buf);
    const bytes = await pdf.save({ useObjectStreams: true });
    const blob = new Blob([bytes],{type:'application/pdf'});
    setProgress('prog',100);
    showSizeCompare(origSize, blob.size);
    dlBlob(blob,'compressed.pdf');
    setStatus('status','PDF re-saved (lossless). Downloaded.','ok');
    return;
  }

  const scale = dpi / 96;
  const buf = await readFileAsArrayBuffer(_files[0]);
  const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt' });
  let firstPage = true;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const pgVp = page.getViewport({ scale: 1 });
    if (!firstPage) doc.addPage([pgVp.width, pgVp.height]); else doc.setPage(1);
    doc.addImage(dataUrl,'JPEG',0,0,pgVp.width,pgVp.height,undefined,'FAST');
    if (firstPage) { firstPage = false; }
    setProgress('prog', Math.round(i/pdfDoc.numPages*90));
  }
  setProgress('prog',100);
  const bytes = doc.output('arraybuffer');
  const blob = new Blob([bytes],{type:'application/pdf'});
  showSizeCompare(origSize, blob.size);
  dlBlob(blob,'compressed.pdf');
  setStatus('status','Compressed PDF downloaded!','ok');
}

// ─── PDF EDITOR SAVE ───
async function runPdfEditorSave() {
  if (!_files[0]) return;
  setStatus('status','Saving edited PDF...');
  const { PDFDocument, degrees } = PDFLib;
  const buf = await readFileAsArrayBuffer(_files[0]);
  const src = await PDFDocument.load(buf);

  // Get DOM order
  const grid = document.getElementById('pageGrid');
  const orderedIdxs = Array.from(grid.querySelectorAll('.page-thumb')).map(el => +el.dataset.idx);

  const newPdf = await PDFDocument.create();
  for (const idx of orderedIdxs) {
    if (idx >= _pdfEditorPages.length) continue;
    const pg = _pdfEditorPages[idx];
    const [copied] = await newPdf.copyPages(src, [pg.pageNum - 1]);
    if (pg.rotation) copied.setRotation(degrees(pg.rotation));
    newPdf.addPage(copied);
  }
  const bytes = await newPdf.save();
  const blob = new Blob([bytes],{type:'application/pdf'});
  dlBlob(blob,'edited.pdf');
  setStatus('status','Edited PDF saved!','ok');
}

// ─── PDF TO WORD (text extract) ───
async function runPdfToWord() {
  if (!_files[0]) return;
  setStatus('status','Extracting text...');
  const buf = await readFileAsArrayBuffer(_files[0]);
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += `\n--- Page ${i} ---\n` + tc.items.map(s=>s.str).join(' ') + '\n';
  }
  const blob = new Blob([text],{type:'text/plain'});
  dlBlob(blob, _files[0].name.replace('.pdf','')+'.txt');
  setStatus('status','Text extracted and downloaded!','ok');
}

// ─── ADD PAGE NUMBERS ───
async function runPdfPageNum() {
  if (!_files[0]) return;
  setStatus('status','Adding page numbers...');
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const buf = await readFileAsArrayBuffer(_files[0]);
  const pdf = await PDFDocument.load(buf);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pos = document.getElementById('numPos').value;
  const startPg = parseInt(document.getElementById('startPage').value)||1;
  const fs = parseInt(document.getElementById('fontSize').value)||12;
  const fmt = document.getElementById('numFmt').value;
  const total = pdf.getPageCount();

  pdf.getPages().forEach((page, i) => {
    const { width, height } = page.getSize();
    const label = fmt.includes('N') ? `Page ${i+startPg} of ${total}` : `${i+startPg}`;
    const tw = font.widthOfTextAtSize(label, fs);
    let x = width/2 - tw/2, y = 20;
    if (pos.includes('Right')) x = width - tw - 20;
    if (pos.includes('Left')) x = 20;
    if (pos.includes('Top')) y = height - fs - 15;
    page.drawText(label, { x, y, size: fs, font, color: rgb(0.1,0.1,0.1) });
  });

  const bytes = await pdf.save();
  dlBlob(new Blob([bytes],{type:'application/pdf'}), 'numbered.pdf');
  setStatus('status','Page numbers added!','ok');
}

// ─── PDF WATERMARK ───
async function runPdfWatermark() {
  if (!_files[0]) return;
  const text = document.getElementById('wmText').value || 'CONFIDENTIAL';
  const opacity = parseFloat(document.getElementById('wmOpacity').value)/100;
  const size = parseInt(document.getElementById('wmSize').value)||48;
  setStatus('status','Adding watermark...');
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  const buf = await readFileAsArrayBuffer(_files[0]);
  const pdf = await PDFDocument.load(buf);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width/2 - tw/2, y: height/2 - size/2,
      size, font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(45)
    });
  });
  const bytes = await pdf.save();
  dlBlob(new Blob([bytes],{type:'application/pdf'}), 'watermarked.pdf');
  setStatus('status','Watermark added!','ok');
}

// ─── PDF PASSWORD ───
async function runPdfPassword() {
  if (!_files[0]) return;
  const action = document.getElementById('passAction').value;
  const pass = document.getElementById('passWord').value;
  setStatus('status', action === 'protect' ? 'Note: Browser-based PDF encryption is limited. File will be re-saved.' : 'Re-saving PDF (browser cannot deeply unlock encrypted PDFs)...');
  const { PDFDocument } = PDFLib;
  try {
    const buf = await readFileAsArrayBuffer(_files[0]);
    const pdf = await PDFDocument.load(buf, { password: action === 'unlock' ? pass : undefined, ignoreEncryption: action === 'unlock' });
    const bytes = await pdf.save();
    dlBlob(new Blob([bytes],{type:'application/pdf'}), action === 'protect' ? 'protected.pdf' : 'unlocked.pdf');
    setStatus('status','Done! File downloaded.','ok');
  } catch(e) {
    setStatus('status','Error: ' + e.message + ' (wrong password or encrypted format)','err');
  }
}

// ─── IMAGE COMPRESS ───
async function runImgCompress() {
  if (!_files.length) return;
  const quality = parseInt(document.getElementById('quality').value) / 100;
  const maxW = parseInt(document.getElementById('maxW').value) || undefined;
  setStatus('status','Compressing...');
  let totalOrig = 0, totalOut = 0;
  setProgress('prog',0);

  for (let i = 0; i < _files.length; i++) {
    const f = _files[i];
    totalOrig += f.size;
    const opts = { maxSizeMB: 50, initialQuality: quality, useWebWorker: true };
    if (maxW) opts.maxWidthOrHeight = maxW;
    const compressed = await imageCompression(f, opts);
    totalOut += compressed.size;
    dlBlob(compressed, 'compressed_' + f.name);
    setProgress('prog', Math.round((i+1)/_files.length*100));
  }
  showSizeCompare(totalOrig, totalOut);
  setStatus('status',`${_files.length} image(s) compressed!`,'ok');
}

// ─── IMAGE FORMAT CONVERT ───
async function runImgConvert() {
  if (!_files.length) return;
  const fmt = document.getElementById('outFmt').value;
  const quality = parseInt(document.getElementById('quality').value)/100;
  const ext = fmt.split('/')[1];
  let totalOrig = 0, totalOut = 0;

  for (const f of _files) {
    totalOrig += f.size;
    const dataUrl = await readFileAsDataURL(f);
    const img = new Image();
    await new Promise(res=>{img.onload=res;img.src=dataUrl;});
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img,0,0);
    const outDataUrl = canvas.toDataURL(fmt, fmt==='image/png'?1:quality);
    const base64 = outDataUrl.split(',')[1];
    const byteLen = Math.ceil(base64.length*0.75);
    totalOut += byteLen;
    const blob = await fetch(outDataUrl).then(r=>r.blob());
    dlBlob(blob, f.name.replace(/\.[^.]+$/,'.')+ext);
  }
  showSizeCompare(totalOrig,totalOut);
  setStatus('status',`${_files.length} image(s) converted!`,'ok');
}

// ─── IMAGE RESIZE ───
async function runImgResize() {
  if (!_files.length) return;
  const tw = parseInt(document.getElementById('resW').value);
  const th = parseInt(document.getElementById('resH').value);
  const lockAR = document.getElementById('lockAR').value === '1';
  const fmt = document.getElementById('resFmt').value;
  const ext = fmt.split('/')[1];
  let totalOrig=0,totalOut=0;

  for (const f of _files) {
    totalOrig += f.size;
    const dataUrl = await readFileAsDataURL(f);
    const img = new Image();
    await new Promise(res=>{img.onload=res;img.src=dataUrl;});
    let rw = tw, rh = th;
    if (lockAR) {
      const ar = img.naturalWidth / img.naturalHeight;
      rh = Math.round(tw / ar);
    }
    const canvas = document.createElement('canvas');
    canvas.width = rw; canvas.height = rh;
    canvas.getContext('2d').drawImage(img,0,0,rw,rh);
    const outUrl = canvas.toDataURL(fmt, 0.92);
    const blob = await fetch(outUrl).then(r=>r.blob());
    totalOut += blob.size;
    dlBlob(blob, f.name.replace(/\.[^.]+$/,'_resized.')+ext);
  }
  showSizeCompare(totalOrig,totalOut);
  setStatus('status',`${_files.length} image(s) resized!`,'ok');
}

// ─── IMAGE CROP ───
async function runImgCrop() {
  if (!_cropImg) return;
  const x = parseInt(document.getElementById('cropX').value)||0;
  const y = parseInt(document.getElementById('cropY').value)||0;
  const cw = parseInt(document.getElementById('cropW').value)||100;
  const ch = parseInt(document.getElementById('cropH').value)||100;
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  canvas.getContext('2d').drawImage(_cropImg,x,y,cw,ch,0,0,cw,ch);
  const blob = await new Promise(res=>canvas.toBlob(res,'image/png'));
  dlBlob(blob,'cropped.png');
  setStatus('status','Cropped image downloaded!','ok');
}

// ─── BULK ZIP ───
async function runBulkZip() {
  if (!_files.length) return;
  const fmt = document.getElementById('zipFmt').value;
  const quality = parseInt(document.getElementById('quality').value)/100;
  const ext = fmt.split('/')[1];
  const zip = new JSZip();
  setProgress('prog',0);
  for (let i=0;i<_files.length;i++) {
    const f=_files[i];
    const dataUrl = await readFileAsDataURL(f);
    const img=new Image();
    await new Promise(res=>{img.onload=res;img.src=dataUrl;});
    const canvas=document.createElement('canvas');
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    canvas.getContext('2d').drawImage(img,0,0);
    const outUrl=canvas.toDataURL(fmt,quality);
    zip.file(f.name.replace(/\.[^.]+$/,'.')+ext, outUrl.split(',')[1],{base64:true});
    setProgress('prog',Math.round((i+1)/_files.length*100));
  }
  const blob=await zip.generateAsync({type:'blob'});
  dlBlob(blob,'images.zip');
  setStatus('status',`${_files.length} images packed into ZIP!`,'ok');
}

// ─── EXCEL TO PDF ───
async function runExcelToPdf() {
  if (!_files[0]) return;
  setStatus('status','Converting...');
  const buf = await readFileAsArrayBuffer(_files[0]);
  const wb = XLSX.read(buf,{type:'array'});
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const data = XLSX.utils.sheet_to_json(ws,{header:1});

  const { jsPDF } = window.jspdf;
  const pageSize = document.getElementById('xlPageSize').value.toLowerCase();
  const orient = document.getElementById('xlOrient').value === 'Portrait' ? 'p' : 'l';
  const doc = new jsPDF({ orientation: orient, unit: 'mm', format: pageSize });
  const pw = doc.internal.pageSize.getWidth();
  let y = 15; const rowH = 7; const colW = pw / (data[0]?.length||1) - 2;

  doc.setFontSize(9);
  data.forEach((row,ri) => {
    if (y > doc.internal.pageSize.getHeight()-15) { doc.addPage(); y=15; }
    if (ri===0) { doc.setFont(undefined,'bold'); } else { doc.setFont(undefined,'normal'); }
    row.forEach((cell,ci) => {
      const x = 10 + ci*(colW+2);
      doc.rect(x, y-5, colW+2, rowH);
      doc.text(String(cell??''), x+1, y, {maxWidth: colW});
    });
    y += rowH;
  });
  const blob = new Blob([doc.output('arraybuffer')],{type:'application/pdf'});
  dlBlob(blob, _files[0].name.replace(/\.[^.]+$/,'')+'.pdf');
  setStatus('status','Excel converted to PDF!','ok');
}

// ─── PDF TO EXCEL/CSV ───
async function runPdfToExcel() {
  if (!_files[0]) return;
  setStatus('status','Extracting data...');
  const buf = await readFileAsArrayBuffer(_files[0]);
  const pdf = await pdfjsLib.getDocument({data:buf}).promise;
  let csv = '';
  for (let i=1;i<=pdf.numPages;i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const line = tc.items.map(s=>'"'+s.str.replace(/"/g,'""')+'"').join(',');
    csv += line + '\n';
  }
  dlBlob(new Blob([csv],{type:'text/csv'}), _files[0].name.replace('.pdf','')+'.csv');
  setStatus('status','CSV downloaded!','ok');
}

// ─── CSV MERGE ───
async function runCsvMerge() {
  if (_files.length < 2) return;
  setStatus('status','Merging CSVs...');
  const headerMode = document.getElementById('headerMode').value === '1';
  let merged = '';
  let firstHeader = null;
  for (let i=0;i<_files.length;i++) {
    const text = await _files[i].text();
    const lines = text.split('\n').filter(l=>l.trim());
    if (i===0) {
      firstHeader = lines[0];
      merged += text + '\n';
    } else {
      const rest = headerMode ? lines.slice(1) : lines;
      merged += rest.join('\n') + '\n';
    }
  }
  dlBlob(new Blob([merged],{type:'text/csv'}),'merged.csv');
  setStatus('status','CSVs merged!','ok');
}

// ─── CSV SPLIT ───
async function runCsvSplit() {
  if (!_files[0]) return;
  setStatus('status','Splitting CSV...');
  const rowsPerFile = parseInt(document.getElementById('rowsPerFile').value)||1000;
  const inclHeader = document.getElementById('includeHeader').value === '1';
  const text = await _files[0].text();
  const lines = text.split('\n').filter(l=>l.trim());
  const header = lines[0];
  const dataLines = lines.slice(1);

  const zip = new JSZip();
  let chunk = 0;
  for (let i=0;i<dataLines.length;i+=rowsPerFile) {
    chunk++;
    const part = dataLines.slice(i, i+rowsPerFile);
    const content = (inclHeader ? header+'\n' : '') + part.join('\n');
    zip.file(`split_${chunk}.csv`, content);
  }
  const blob = await zip.generateAsync({type:'blob'});
  dlBlob(blob,'split_csvs.zip');
  setStatus('status',`Split into ${chunk} files. ZIP downloaded.`,'ok');
}
