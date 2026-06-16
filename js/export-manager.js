/* ============================================================
   AI Certificate Generator — Export Manager
   PNG, PDF, and ZIP export with high-quality rendering.
   ============================================================ */

const ExportManager = (() => {
  'use strict';

  /* ── Quality Presets ── */
  const QUALITY_PRESETS = {
    standard: { label: 'Standard (2×)', scale: 2 },
    high:     { label: 'High (4×)', scale: 4 },
    ultra:    { label: 'Ultra HD (8×)', scale: 8 }
  };

  let currentQuality = 'high';

  /* ── Maximum canvas dimension (browsers cap around 16384) ── */
  const MAX_CANVAS_DIM = 16384;

  /* ── Init ── */

  function init() {
    // PNG button
    const pngBtn = document.getElementById('btn-export-png');
    if (pngBtn) pngBtn.addEventListener('click', exportPNG);

    // PDF button
    const pdfBtn = document.getElementById('btn-export-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);

    // Quality selector
    const qualitySelect = document.getElementById('export-quality');
    if (qualitySelect) {
      qualitySelect.addEventListener('change', () => {
        currentQuality = qualitySelect.value;
      });
    }
  }

  /**
   * Calculate safe scale factor so the export canvas doesn't exceed browser limits
   */
  function getSafeScale() {
    const bgSize = CanvasEngine.getBackgroundSize();
    const desiredScale = QUALITY_PRESETS[currentQuality]?.scale || 4;

    if (!bgSize.width || !bgSize.height) return desiredScale;

    const maxW = bgSize.width * desiredScale;
    const maxH = bgSize.height * desiredScale;

    if (maxW > MAX_CANVAS_DIM || maxH > MAX_CANVAS_DIM) {
      // Scale down to fit within browser canvas limit
      const safeScale = Math.min(
        MAX_CANVAS_DIM / bgSize.width,
        MAX_CANVAS_DIM / bgSize.height
      );
      return Math.floor(safeScale);
    }

    return desiredScale;
  }

  /* ── PNG Export ── */

  async function exportPNG() {
    const bgSize = CanvasEngine.getBackgroundSize();
    if (!bgSize.width) {
      UIController.toast('Please upload a template image first', 'error');
      return;
    }

    UIController.toast('Rendering high-quality PNG...', 'info');

    // Small delay so the toast appears before heavy canvas work
    await Utils.sleep(100);

    try {
      const scale = getSafeScale();
      const exportCanvas = await VerificationManager.prepareExportCanvas(scale);

      const blob = await new Promise((resolve, reject) => {
        exportCanvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create PNG. Try a lower quality setting.')),
          'image/png',
          1.0
        );
      });

      const nameInput = document.getElementById('input-name');
      const name = nameInput?.value?.trim() || 'certificate';
      const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      Utils.downloadBlob(blob, `${safeName}_certificate.png`);

      const sizeStr = Utils.formatFileSize(blob.size);
      UIController.toast(
        `✅ PNG exported — ${exportCanvas.width}×${exportCanvas.height}px, ${sizeStr}`,
        'success',
        5000
      );

      // Trigger Cloudinary Upload and Firebase Save in background
      VerificationManager.processVerificationPipeline(exportCanvas);
    } catch (err) {
      console.error('PNG export error:', err);
      UIController.toast('PNG export failed: ' + err.message, 'error');
    }
  }

  /* ── PDF Export ── */

  async function exportPDF() {
    const bgSize = CanvasEngine.getBackgroundSize();
    if (!bgSize.width) {
      UIController.toast('Please upload a template image first', 'error');
      return;
    }

    // Check jsPDF availability
    if (!window.jspdf && !window.jsPDF) {
      UIController.toast('PDF library is still loading. Please wait a moment and try again.', 'warning');
      return;
    }

    UIController.toast('Generating PDF...', 'info');
    await Utils.sleep(100);

    try {
      const scale = getSafeScale();
      const exportCanvas = await VerificationManager.prepareExportCanvas(scale);

      // Determine orientation from aspect ratio
      const isLandscape = bgSize.width > bgSize.height;
      const orientation = isLandscape ? 'landscape' : 'portrait';

      // Get jsPDF constructor — handle both CDN packaging formats
      let JsPDFClass;
      if (window.jspdf && window.jspdf.jsPDF) {
        JsPDFClass = window.jspdf.jsPDF;
      } else if (window.jsPDF) {
        JsPDFClass = window.jsPDF;
      } else {
        throw new Error('jsPDF library not available');
      }

      const pdf = new JsPDFClass({
        orientation,
        unit: 'mm',
        format: 'a4'
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Calculate image dimensions to fit page with margins
      const margin = 5;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;

      const imgAspect = bgSize.width / bgSize.height;
      const pageAspect = availW / availH;

      let imgW, imgH;
      if (imgAspect > pageAspect) {
        imgW = availW;
        imgH = availW / imgAspect;
      } else {
        imgH = availH;
        imgW = availH * imgAspect;
      }

      const imgX = (pageW - imgW) / 2;
      const imgY = (pageH - imgH) / 2;

      // Convert canvas to PNG data URL and embed in PDF
      const imgData = exportCanvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');

      // Save the file
      const nameInput = document.getElementById('input-name');
      const name = nameInput?.value?.trim() || 'certificate';
      const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      pdf.save(`${safeName}_certificate.pdf`);

      UIController.toast('✅ PDF exported successfully!', 'success');

      // Trigger Cloudinary Upload and Firebase Save in background
      VerificationManager.processVerificationPipeline(exportCanvas);
    } catch (err) {
      console.error('PDF export error:', err);
      UIController.toast('PDF export failed: ' + err.message, 'error');
    }
  }

  /* ── Canvas Info ── */

  function getExportInfo() {
    const bgSize = CanvasEngine.getBackgroundSize();
    const scale = getSafeScale();
    return {
      width: bgSize.width * scale,
      height: bgSize.height * scale,
      quality: QUALITY_PRESETS[currentQuality]?.label || 'High',
      dpi: 300
    };
  }

  function setQuality(quality) {
    if (QUALITY_PRESETS[quality]) {
      currentQuality = quality;
    }
  }

  return {
    QUALITY_PRESETS,
    init,
    exportPNG,
    exportPDF,
    getExportInfo,
    setQuality
  };
})();
