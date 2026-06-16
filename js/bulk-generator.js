/* ============================================================
   AI Certificate Generator — Bulk Generator
   CSV upload, parsing, batch certificate generation.
   ============================================================ */

const BulkGenerator = (() => {
  'use strict';

  let csvData = null;      // Parsed CSV data
  let isGenerating = false;
  let generatedBlobs = []; // Array of { name, blob }

  /* ── Init ── */

  function init() {
    // CSV file input
    const csvInput = document.getElementById('csv-file');
    if (csvInput) {
      csvInput.addEventListener('change', handleCSVUpload);
    }

    // CSV dropzone
    const csvDropzone = document.getElementById('csv-dropzone');
    if (csvDropzone) {
      csvDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        csvDropzone.classList.add('drag-over');
      });
      csvDropzone.addEventListener('dragleave', () => {
        csvDropzone.classList.remove('drag-over');
      });
      csvDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        csvDropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
          readCSVFile(file);
        } else {
          UIController.toast('Please upload a .csv file', 'error');
        }
      });
    }

    // Generate button
    const genBtn = document.getElementById('btn-bulk-generate');
    if (genBtn) {
      genBtn.addEventListener('click', generateAll);
    }

    // Download ZIP button
    const zipBtn = document.getElementById('btn-download-zip');
    if (zipBtn) {
      zipBtn.addEventListener('click', downloadZIP);
    }
  }

  /* ── CSV Handling ── */

  function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      UIController.toast('Please upload a .csv file', 'error');
      return;
    }

    readCSVFile(file);
  }

  function readCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        csvData = Utils.parseCSV(e.target.result);
        displayCSVPreview();
        UIController.toast(`Loaded ${csvData.rows.length} entries from CSV`, 'success');
      } catch (err) {
        UIController.toast(err.message, 'error');
      }
    };
    reader.onerror = () => UIController.toast('Failed to read CSV file', 'error');
    reader.readAsText(file);
  }

  /**
   * Display CSV data in a preview table
   */
  function displayCSVPreview() {
    const container = document.getElementById('csv-preview');
    if (!container || !csvData) return;

    const { headers, rows } = csvData;

    let html = `
      <div class="csv-table-wrap">
        <table class="csv-table">
          <thead><tr>
            ${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.slice(0, 20).map(row =>
              `<tr>${headers.map(h => `<td>${escapeHTML(row[h] || '')}</td>`).join('')}</tr>`
            ).join('')}
            ${rows.length > 20 ? `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--clr-text-muted);">... and ${rows.length - 20} more</td></tr>` : ''}
          </tbody>
        </table>
      </div>
      <div style="margin-top:var(--sp-3);display:flex;justify-content:space-between;align-items:center;">
        <span class="badge">${rows.length} entries</span>
        <button class="btn btn-primary btn-sm" id="btn-bulk-generate">
          ⚡ Generate All
        </button>
      </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';

    // Re-bind generate button (since we replaced the HTML)
    const genBtn = document.getElementById('btn-bulk-generate');
    if (genBtn) {
      genBtn.addEventListener('click', generateAll);
    }
  }

  /* ── Bulk Generation ── */

  /**
   * Generate certificates for all CSV rows
   */
  async function generateAll() {
    if (!csvData || csvData.rows.length === 0) {
      UIController.toast('No CSV data loaded', 'error');
      return;
    }

    if (isGenerating) {
      UIController.toast('Generation already in progress', 'warning');
      return;
    }

    const bgSize = CanvasEngine.getBackgroundSize();
    if (!bgSize.width) {
      UIController.toast('Please upload a template image first', 'error');
      return;
    }

    isGenerating = true;
    generatedBlobs = [];

    const rows = csvData.rows;
    const total = rows.length;

    // Show progress
    const progressContainer = document.getElementById('bulk-progress');
    if (progressContainer) progressContainer.style.display = 'block';

    UIController.toast(`Generating ${total} certificates...`, 'info', 5000);

    for (let i = 0; i < total; i++) {
      const row = rows[i];

      // Map CSV columns to layer texts
      const texts = {
        name: row.name || row.participant || row['participant name'] || '',
        role: row.role || row.designation || row['role / designation'] || '',
        certId: row.certid || row.certificateid || row.id || row['certificate id'] || Utils.generateId('CERT')
      };

      // Handle certificate type
      const certType = mapCertificateType(row.certificatetype || row.certificate_type || row.type || 'participant');

      // Load and set the unique background for this certificate type
      try {
        const imgPath = TemplateManager.getTemplateImagePath(certType) + `?v=${Date.now()}`;
        const img = await Utils.loadImage(imgPath);
        CanvasEngine.setBackground(img);
      } catch (err) {
        console.warn(`Failed to load background for ${certType}:`, err);
      }

      // Apply preset for this certificate type
      const preset = TemplateManager.getCertificatePreset(certType);
      if (preset) {
        Object.entries(preset.layers).forEach(([layerId, config]) => {
          const existingLayer = CanvasEngine.getTextLayer(layerId);
          const text = texts[layerId] || existingLayer?.text || '';
          CanvasEngine.setTextLayer({
            ...CanvasEngine.getDefaultTextConfig(),
            ...config,
            id: layerId,
            text,
            visible: true
          });
        });
      }

      // Set name and role specifically
      if (texts.name) {
        const nameLayer = CanvasEngine.getTextLayer('name');
        if (nameLayer) CanvasEngine.setTextLayer({ ...nameLayer, text: texts.name });
      }
      if (texts.role) {
        const roleLayer = CanvasEngine.getTextLayer('role');
        if (roleLayer) CanvasEngine.setTextLayer({ ...roleLayer, text: texts.role });
      }

      // Wait for the QR Code image to be generated and cached for this certificate
      if (texts.certId) {
        try {
          await CanvasEngine.prepareQrCode(texts.certId);
        } catch (err) {
          console.warn(`Failed to prepare QR Code for row ${i + 1}:`, err);
        }
      }

      // Render at high quality
      const exportCanvas = CanvasEngine.renderForExport(2);

      // Convert to blob
      const blob = await new Promise(resolve => {
        exportCanvas.toBlob(resolve, 'image/png', 1.0);
      });

      const safeName = (texts.name || `certificate_${i + 1}`).replace(/[^a-zA-Z0-9]/g, '_');
      generatedBlobs.push({ name: `${safeName}.png`, blob });

      // Update progress
      const percent = Math.round(((i + 1) / total) * 100);
      UIController.updateProgress('bulk-progress-fill', percent, `${i + 1} / ${total}`);

      // Yield to the event loop so UI stays responsive
      if (i % 5 === 0) {
        await Utils.sleep(10);
      }
    }

    isGenerating = false;
    UIController.toast(`✅ Generated ${total} certificates!`, 'success', 5000);

    // Show download ZIP button
    const zipBtn = document.getElementById('btn-download-zip');
    if (zipBtn) zipBtn.style.display = 'inline-flex';
  }

  /**
   * Map user-entered certificate types to preset keys
   */
  function mapCertificateType(type) {
    const normalized = type.toLowerCase().trim();
    const mapping = {
      'participant': 'participant',
      'participation': 'participant',
      '1st prize': '1st_prize',
      '1st': '1st_prize',
      'first': '1st_prize',
      'winner': '1st_prize',
      '2nd prize': '2nd_prize',
      '2nd': '2nd_prize',
      'second': '2nd_prize',
      'runner-up': '2nd_prize',
      'runner up': '2nd_prize',
      '3rd prize': '3rd_prize',
      '3rd': '3rd_prize',
      'third': '3rd_prize',
      'judge': 'judge'
    };
    return mapping[normalized] || 'participant';
  }

  /* ── ZIP Download ── */

  async function downloadZIP() {
    if (generatedBlobs.length === 0) {
      UIController.toast('No certificates generated yet', 'error');
      return;
    }

    UIController.toast('Creating ZIP file...', 'info');

    try {
      const zip = new JSZip();

      generatedBlobs.forEach(({ name, blob }) => {
        zip.file(name, blob);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      Utils.downloadBlob(zipBlob, `certificates_${Date.now()}.zip`);
      UIController.toast(`Downloaded ${generatedBlobs.length} certificates as ZIP`, 'success');
    } catch (err) {
      UIController.toast('Failed to create ZIP: ' + err.message, 'error');
    }
  }

  /* ── Helpers ── */

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getGeneratedCount() {
    return generatedBlobs.length;
  }

  return {
    init,
    generateAll,
    downloadZIP,
    getGeneratedCount
  };
})();
