/* ============================================================
   AI Certificate Generator — Canvas Engine
   Core rendering engine with layer system, high-DPI support,
   and export capabilities.
   ============================================================ */

const CanvasEngine = (() => {
  'use strict';

  /* ── State ── */
  let canvas = null;        // Preview canvas element
  let ctx = null;           // 2D context
  let wrapper = null;       // Canvas wrapper div
  let interactionLayer = null;

  let bgImage = null;       // Background template Image object
  let bgNaturalW = 0;       // Background natural width
  let bgNaturalH = 0;       // Background natural height

  let zoom = 1;
  let textLayers = [];      // Array of text layer config objects
  let selectedLayerId = null;

  // Preview scaling: we scale down the canvas for display
  let displayScale = 1;     // Ratio of display size to natural size

  // QR Code Cache State
  let qrCodeImageCache = null;
  let qrCodeImageLoading = false;
  let lastCertIdForQr = null;
  let debouncedPrepareQr = null;

  /* ── Callbacks ── */
  let onLayerSelect = null;
  let onLayerMove = null;
  let onRenderComplete = null;

  /* ── Init ── */

  /**
   * Initialize the canvas engine
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas - The canvas element
   * @param {HTMLElement} opts.wrapper - The canvas wrapper div
   * @param {HTMLElement} opts.interactionLayer - Transparent layer for mouse events
   */
  function init(opts) {
    canvas = opts.canvas;
    ctx = canvas.getContext('2d');
    wrapper = opts.wrapper;
    interactionLayer = opts.interactionLayer;

    // Set up mouse/touch interaction for drag
    setupInteraction();

    // Initialize debounced helper for QR generation
    debouncedPrepareQr = Utils.debounce((text) => {
      prepareQrCode(text).then(() => {
        render();
      }).catch(err => {
        console.warn('Failed to prepare QR code for live preview:', err);
      });
    }, 250);
  }

  /* ── Background ── */

  /**
   * Set the background template image
   * @param {HTMLImageElement} img
   */
  function setBackground(img) {
    bgImage = img;
    bgNaturalW = img.naturalWidth;
    bgNaturalH = img.naturalHeight;

    // Size the canvas to natural image dimensions
    canvas.width = bgNaturalW;
    canvas.height = bgNaturalH;

    // Calculate display scale to fit in container
    fitToContainer();
    render();
  }

  /**
   * Get background dimensions
   */
  function getBackgroundSize() {
    return { width: bgNaturalW, height: bgNaturalH };
  }

  /**
   * Fit canvas display to its container
   */
  function fitToContainer() {
    if (!bgNaturalW || !bgNaturalH) return;

    const container = wrapper.parentElement;
    const containerW = container.clientWidth - 64; // Padding
    const containerH = container.clientHeight - 64;

    const scaleX = containerW / bgNaturalW;
    const scaleY = containerH / bgNaturalH;
    displayScale = Math.min(scaleX, scaleY, 1); // Don't upscale

    const displayW = bgNaturalW * displayScale * zoom;
    const displayH = bgNaturalH * displayScale * zoom;

    wrapper.style.width = `${displayW}px`;
    wrapper.style.height = `${displayH}px`;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    if (interactionLayer) {
      interactionLayer.style.width = `${displayW}px`;
      interactionLayer.style.height = `${displayH}px`;
    }
  }

  /* ── Zoom ── */

  function setZoom(newZoom) {
    zoom = Utils.clamp(newZoom, 0.25, 3);
    fitToContainer();
    render();
    updateTextHandles();
    return zoom;
  }

  function getZoom() {
    return zoom;
  }

  /* ── Text Layers ── */

  /**
   * Add or update a text layer
   * @param {Object} config
   * @param {string} config.id - Unique layer ID
   * @param {string} config.text - Text content
   * @param {number} config.x - X position (0-1 relative to canvas)
   * @param {number} config.y - Y position (0-1 relative to canvas)
   * @param {number} config.fontSize - Font size in pixels (at natural resolution)
   * @param {string} config.fontFamily - Font family
   * @param {string} config.fontWeight - Font weight
   * @param {string} config.color - Text color
   * @param {string} config.alignment - 'left' | 'center' | 'right'
   * @param {number} config.letterSpacing - Letter spacing in px
   * @param {number} config.rotation - Rotation in degrees
   * @param {Object} config.shadow - { color, blur, offsetX, offsetY }
   * @param {boolean} config.visible - Whether to render this layer
   */
  function setTextLayer(config) {
    const idx = textLayers.findIndex(l => l.id === config.id);
    if (idx >= 0) {
      textLayers[idx] = { ...textLayers[idx], ...config };
    } else {
      textLayers.push({ ...getDefaultTextConfig(), ...config });
    }

    // Live preview QR preparation
    if (config.id === 'certId' && config.text) {
      if (debouncedPrepareQr) {
        debouncedPrepareQr(config.text);
      } else {
        prepareQrCode(config.text).then(() => {
          render();
        }).catch(err => {
          console.warn('Failed to prepare QR code for live preview:', err);
        });
      }
    }

    render();
    updateTextHandles();
  }

  /**
   * Remove a text layer
   */
  function removeTextLayer(id) {
    textLayers = textLayers.filter(l => l.id !== id);
    render();
    updateTextHandles();
  }

  /**
   * Get all text layers
   */
  function getTextLayers() {
    return textLayers.map(l => ({ ...l }));
  }

  /**
   * Get a specific text layer
   */
  function getTextLayer(id) {
    const layer = textLayers.find(l => l.id === id);
    return layer ? { ...layer } : null;
  }

  /**
   * Set all text layers at once (for undo/redo)
   */
  function setAllTextLayers(layers) {
    textLayers = layers.map(l => ({ ...l }));
    render();
    updateTextHandles();
  }

  /**
   * Default text configuration
   */
  function getDefaultTextConfig() {
    return {
      id: '',
      text: '',
      x: 0.5,
      y: 0.5,
      fontSize: 48,
      fontFamily: 'Inter',
      fontWeight: '700',
      color: '#ffffff',
      alignment: 'center',
      letterSpacing: 0,
      rotation: 0,
      shadow: { color: 'rgba(0,0,0,0.3)', blur: 4, offsetX: 0, offsetY: 2 },
      visible: true
    };
  }

  /* ── Selection ── */

  function selectLayer(id) {
    selectedLayerId = id;
    updateTextHandles();
    if (onLayerSelect) onLayerSelect(id);
  }

  function getSelectedLayerId() {
    return selectedLayerId;
  }

  /* ── Rendering ── */

  /**
   * Render all layers to the canvas
   */
  function render() {
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Layer 1: Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, bgNaturalW, bgNaturalH);
    }

    // Layer 2+: Text layers
    textLayers.forEach(layer => {
      if (!layer.visible || !layer.text) return;
      if (layer.id === 'certId') {
        drawQrCodeLayer(ctx, layer, bgNaturalW, bgNaturalH);
      } else {
        renderTextLayer(ctx, layer, bgNaturalW, bgNaturalH);
      }
    });

    if (onRenderComplete) onRenderComplete();
  }

  /**
   * Render a single text layer
   * Uses manual char-by-char drawing for letter spacing (cross-browser)
   */
  function renderTextLayer(context, layer, canvasW, canvasH) {
    const x = layer.x * canvasW;
    const y = layer.y * canvasH;

    context.save();

    // Move to position
    context.translate(x, y);

    // Rotation
    if (layer.rotation) {
      context.rotate(Utils.degToRad(layer.rotation));
    }

    // Dynamic Font Scaling for name layer (max width 75% of canvas)
    let fontSize = layer.fontSize;
    if (layer.id === 'name') {
      context.font = `${layer.fontWeight} ${fontSize}px "${layer.fontFamily}"`;
      let textWidth = context.measureText(layer.text).width;
      const spacing = layer.letterSpacing || 0;
      const extraSpacing = layer.text.length > 1 ? spacing * (layer.text.length - 1) : 0;
      textWidth += extraSpacing;

      const maxWidth = canvasW * 0.75;
      if (textWidth > maxWidth) {
        fontSize = Math.floor(fontSize * (maxWidth / textWidth));
      }
    }

    // Font setup
    context.font = `${layer.fontWeight} ${fontSize}px "${layer.fontFamily}"`;
    context.fillStyle = layer.color;
    context.textBaseline = 'middle';

    // Shadow
    if (layer.shadow && layer.shadow.blur > 0) {
      context.shadowColor = layer.shadow.color;
      context.shadowBlur = layer.shadow.blur;
      context.shadowOffsetX = layer.shadow.offsetX;
      context.shadowOffsetY = layer.shadow.offsetY;
    }

    // Draw text — use manual spacing if letterSpacing is set
    const spacing = layer.letterSpacing || 0;

    if (spacing !== 0) {
      // Manual character-by-character rendering for cross-browser letter spacing
      drawTextWithSpacing(context, layer.text, spacing, layer.alignment);
    } else {
      // Standard single-call fillText
      if (layer.alignment === 'center') {
        context.textAlign = 'center';
      } else if (layer.alignment === 'right') {
        context.textAlign = 'right';
      } else {
        context.textAlign = 'left';
      }
      context.fillText(layer.text, 0, 0);
    }

    context.restore();
  }

  /**
   * Draw text character by character with custom letter spacing
   * Works in all browsers without ctx.letterSpacing support
   */
  function drawTextWithSpacing(context, text, spacing, alignment) {
    context.textAlign = 'left'; // Always left for manual positioning

    // Measure total width with spacing
    let totalWidth = 0;
    const charWidths = [];
    for (let i = 0; i < text.length; i++) {
      const w = context.measureText(text[i]).width;
      charWidths.push(w);
      totalWidth += w + (i < text.length - 1 ? spacing : 0);
    }

    // Calculate start X based on alignment
    let startX = 0;
    if (alignment === 'center') {
      startX = -totalWidth / 2;
    } else if (alignment === 'right') {
      startX = -totalWidth;
    }

    // Draw each character
    let currentX = startX;
    for (let i = 0; i < text.length; i++) {
      context.fillText(text[i], currentX, 0);
      currentX += charWidths[i] + spacing;
    }
  }

  /* ── QR Code Rendering Helpers ── */

  /**
   * Dynamically build verification URL for QR Code based on current page environment
   */
  function getVerificationUrl(certId) {
    if (typeof AppConfig !== 'undefined' && AppConfig.VERIFY_BASE_URL) {
      return `${AppConfig.VERIFY_BASE_URL}/verify.html?id=${encodeURIComponent(certId)}`;
    }

    let origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin === 'null') {
      if (typeof AppConfig !== 'undefined' && AppConfig.FIREBASE_CONFIG && AppConfig.FIREBASE_CONFIG.projectId) {
        return `https://${AppConfig.FIREBASE_CONFIG.projectId}.web.app/verify.html?id=${encodeURIComponent(certId)}`;
      }
      origin = 'https://agentverse-2dc49.web.app';
    }

    let pathname = window.location.pathname;
    let dir = '';
    if (pathname.includes('/')) {
      dir = pathname.substring(0, pathname.lastIndexOf('/'));
    }
    return `${origin}${dir}/verify.html?id=${encodeURIComponent(certId)}`;
  }

  /**
   * Draw the QR Code image on context at the specified text layer location
   */
  function drawQrCodeLayer(context, layer, canvasW, canvasH) {
    const x = layer.x * canvasW;
    const y = layer.y * canvasH;

    // Dynamically size based on fontSize
    const qrSize = (layer.fontSize || 14) * 8;
    const padding = qrSize * 0.08;
    const frameSize = qrSize + padding * 2;
    const borderRadius = qrSize * 0.06;

    context.save();

    let drawX = x;
    let drawY = y - qrSize - padding; // Sit completely above Y (similar to text baseline)

    if (layer.alignment === 'right') {
      drawX = x - qrSize - padding; // Sit completely to the left of X
    } else if (layer.alignment === 'center') {
      drawX = x - qrSize / 2;       // Centered around X
    } else {
      drawX = x + padding;          // Sit completely to the right of X
    }

    // Apply rotation if any
    if (layer.rotation) {
      // Rotate around the center of the QR card
      context.translate(drawX + qrSize / 2, drawY + qrSize / 2);
      context.rotate(Utils.degToRad(layer.rotation));
      context.translate(-(drawX + qrSize / 2), -(drawY + qrSize / 2));
    }

    // Draw high contrast background card
    const frameX = drawX - padding;
    const frameY = drawY - padding;

    context.shadowColor = 'rgba(0, 0, 0, 0.2)';
    context.shadowBlur = layer.shadow ? layer.shadow.blur * 2 : 12;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 4;

    context.fillStyle = '#ffffff';
    drawRoundedRect(context, frameX, frameY, frameSize, frameSize, borderRadius);
    context.fill();

    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    if (qrCodeImageCache) {
      context.drawImage(qrCodeImageCache, drawX, drawY, qrSize, qrSize);
    } else {
      // Loading state
      context.fillStyle = '#f1f5f9';
      drawRoundedRect(context, drawX, drawY, qrSize, qrSize, borderRadius * 0.5);
      context.fill();

      context.font = `600 ${Math.max(10, qrSize * 0.1)}px "Inter"`;
      context.fillStyle = '#64748b';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(qrCodeImageLoading ? 'Generating QR...' : 'No QR Code', drawX + qrSize / 2, drawY + qrSize / 2);
    }

    context.restore();
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Pre-render and cache the QR code image for a certificate ID
   */
  let lastQrUrl = '';
  function prepareQrCode(certId) {
    const qrUrl = window.currentProjectUrl || getVerificationUrl(certId);
    if (lastCertIdForQr === certId && lastQrUrl === qrUrl && qrCodeImageCache) {
      return Promise.resolve(qrCodeImageCache);
    }

    lastCertIdForQr = certId;
    lastQrUrl = qrUrl;
    qrCodeImageCache = null;
    qrCodeImageLoading = true;

    if (typeof VerificationManager !== 'undefined' && VerificationManager.generateQRCodeImage) {
      return VerificationManager.generateQRCodeImage(qrUrl)
        .then(img => {
          // Only update cache if this matches the latest requested cert ID
          if (lastCertIdForQr === certId) {
            qrCodeImageCache = img;
            qrCodeImageLoading = false;
          }
          return img;
        })
        .catch(err => {
          console.error('Failed to generate QR Code image:', err);
          if (lastCertIdForQr === certId) {
            qrCodeImageLoading = false;
          }
          throw err;
        });
    } else {
      qrCodeImageLoading = false;
      return Promise.reject(new Error('VerificationManager or generateQRCodeImage is not available'));
    }
  }

  /**
   * Render to an offscreen canvas at full resolution for export
   * @param {number} scaleFactor - Multiplier for resolution
   * @returns {HTMLCanvasElement}
   */
  function renderForExport(scaleFactor = 1) {
    const exportW = bgNaturalW * scaleFactor;
    const exportH = bgNaturalH * scaleFactor;

    const offscreen = document.createElement('canvas');
    offscreen.width = exportW;
    offscreen.height = exportH;
    const offCtx = offscreen.getContext('2d');

    // Enable high-quality rendering
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = 'high';

    // Scale everything
    offCtx.scale(scaleFactor, scaleFactor);

    // Background
    if (bgImage) {
      offCtx.drawImage(bgImage, 0, 0, bgNaturalW, bgNaturalH);
    }

    // Text layers
    textLayers.forEach(layer => {
      if (!layer.visible || !layer.text) return;
      if (layer.id === 'certId') {
        drawQrCodeLayer(offCtx, layer, bgNaturalW, bgNaturalH);
      } else {
        renderTextLayer(offCtx, layer, bgNaturalW, bgNaturalH);
      }
    });

    return offscreen;
  }

  /* ── Interaction (Drag & Drop on Canvas) ── */

  let isDragging = false;
  let dragLayerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartLayerX = 0;
  let dragStartLayerY = 0;

  function setupInteraction() {
    if (!interactionLayer) return;

    interactionLayer.addEventListener('mousedown', onMouseDown);
    interactionLayer.addEventListener('mousemove', onMouseMove);
    interactionLayer.addEventListener('mouseup', onMouseUp);
    interactionLayer.addEventListener('mouseleave', onMouseUp);

    // Touch support
    interactionLayer.addEventListener('touchstart', onTouchStart, { passive: false });
    interactionLayer.addEventListener('touchmove', onTouchMove, { passive: false });
    interactionLayer.addEventListener('touchend', onMouseUp);
  }

  function getCanvasCoords(clientX, clientY) {
    const rect = wrapper.getBoundingClientRect();
    const scaleTotal = displayScale * zoom;
    const cx = (clientX - rect.left) / scaleTotal / bgNaturalW;
    const cy = (clientY - rect.top) / scaleTotal / bgNaturalH;
    return { x: cx, y: cy };
  }

  function hitTestLayers(rx, ry) {
    // Hit test in reverse order (top layer first)
    for (let i = textLayers.length - 1; i >= 0; i--) {
      const layer = textLayers[i];
      // Skip certId (QR code) layer to make it stationary and non-selectable/non-draggable
      if (!layer.visible || !layer.text || layer.id === 'certId') continue;

      // Approximate bounding box
      const metrics = measureTextLayer(layer);
      const halfW = metrics.width / 2 / bgNaturalW;
      const halfH = metrics.height / 2 / bgNaturalH;

      let lx = layer.x;
      let ly = layer.y;

      // Adjust for alignment
      if (layer.alignment === 'left') {
        lx += halfW;
      } else if (layer.alignment === 'right') {
        lx -= halfW;
      }

      // Calculate touch padding (at least 24 CSS pixels, fallback/minimum 2% of canvas size)
      const scaleTotal = displayScale * zoom;
      const padX = scaleTotal > 0 ? Math.max(0.02, 24 / (scaleTotal * bgNaturalW)) : 0.02;
      const padY = scaleTotal > 0 ? Math.max(0.02, 24 / (scaleTotal * bgNaturalH)) : 0.02;

      if (Math.abs(rx - lx) < halfW + padX && Math.abs(ry - ly) < halfH + padY) {
        return layer.id;
      }
    }
    return null;
  }

  function measureTextLayer(layer) {
    if (layer.id === 'certId') {
      const qrSize = (layer.fontSize || 14) * 8;
      const padding = qrSize * 0.08;
      const headerHeight = qrSize * 0.22;
      return {
        width: qrSize + padding * 2,
        height: qrSize + padding * 2 + headerHeight
      };
    }

    ctx.save();
    ctx.font = `${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}"`;
    const baseMetrics = ctx.measureText(layer.text);
    ctx.restore();

    // Add letter spacing to total width
    const spacing = layer.letterSpacing || 0;
    const extraSpacing = layer.text.length > 1 ? spacing * (layer.text.length - 1) : 0;

    return {
      width: baseMetrics.width + extraSpacing,
      height: layer.fontSize * 1.4 // Approximate line height
    };
  }

  function onMouseDown(e) {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const hitId = hitTestLayers(coords.x, coords.y);

    if (hitId) {
      isDragging = true;
      dragLayerId = hitId;
      const layer = textLayers.find(l => l.id === hitId);
      dragStartX = coords.x;
      dragStartY = coords.y;
      dragStartLayerX = layer.x;
      dragStartLayerY = layer.y;
      selectLayer(hitId);
      wrapper.classList.add('dragging');
      e.preventDefault();
    } else {
      selectLayer(null);
    }
  }

  function onMouseMove(e) {
    if (!isDragging || !dragLayerId) return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    const dx = coords.x - dragStartX;
    const dy = coords.y - dragStartY;

    const layer = textLayers.find(l => l.id === dragLayerId);
    if (layer) {
      if (layer.id === 'certId') {
        return; // Fixed place, do not move the QR code
      }
      if (layer.id === 'name') {
        layer.x = 0.5; // Always center the name
      } else {
        layer.x = Utils.clamp(dragStartLayerX + dx, 0, 1);
      }
      layer.y = Utils.clamp(dragStartLayerY + dy, 0, 1);
      render();
      updateTextHandles();
      if (onLayerMove) onLayerMove(layer.id, layer.x, layer.y);
    }
  }

  function onMouseUp() {
    if (isDragging && dragLayerId) {
      // Push to history after drag
      wrapper.classList.remove('dragging');
      isDragging = false;

      // Notify for history push
      if (onLayerMove) {
        const layer = textLayers.find(l => l.id === dragLayerId);
        if (layer) onLayerMove(layer.id, layer.x, layer.y, true); // true = dragEnd
      }
    }
    isDragging = false;
    dragLayerId = null;
  }

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      onMouseDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 1 && isDragging) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }

  /* ── Text Handles (visual selection indicators) ── */

  function updateTextHandles() {
    // Remove existing handles
    if (!interactionLayer) return;
    interactionLayer.querySelectorAll('.text-handle').forEach(h => h.remove());

    if (!selectedLayerId || !bgNaturalW) return;

    const layer = textLayers.find(l => l.id === selectedLayerId);
    if (!layer || !layer.text) return;

    const metrics = measureTextLayer(layer);
    const scaleTotal = displayScale * zoom;

    // Position in display coordinates
    let handleX = layer.x * bgNaturalW * scaleTotal;
    let handleY = layer.y * bgNaturalH * scaleTotal;
    const handleW = metrics.width * scaleTotal;
    const handleH = metrics.height * scaleTotal;

    // Adjust for alignment
    let offsetX = 0;
    if (layer.alignment === 'center') offsetX = -handleW / 2;
    else if (layer.alignment === 'right') offsetX = -handleW;

    let handleTop;
    if (layer.id === 'certId') {
      // The QR code card sits completely above the Y anchor coordinate
      handleTop = (layer.y * bgNaturalH - metrics.height) * scaleTotal;
    } else {
      handleTop = handleY - handleH / 2;
    }

    const handle = document.createElement('div');
    handle.className = 'text-handle active';
    handle.style.left = `${handleX + offsetX - 4}px`;
    handle.style.top = `${handleTop - 4}px`;
    handle.style.width = `${handleW + 8}px`;
    handle.style.height = `${handleH + 8}px`;

    if (layer.rotation) {
      handle.style.transform = `rotate(${layer.rotation}deg)`;
      handle.style.transformOrigin = 'center center';
    }

    interactionLayer.appendChild(handle);
  }

  /* ── Event Callbacks ── */

  function onLayerSelectCallback(fn) { onLayerSelect = fn; }
  function onLayerMoveCallback(fn) { onLayerMove = fn; }
  function onRenderCompleteCallback(fn) { onRenderComplete = fn; }

  /* ── Public API ── */

  return {
    init,
    setBackground,
    getBackgroundSize,
    fitToContainer,
    setZoom,
    getZoom,
    setTextLayer,
    removeTextLayer,
    getTextLayers,
    getTextLayer,
    setAllTextLayers,
    getDefaultTextConfig,
    selectLayer,
    getSelectedLayerId,
    render,
    renderForExport,
    prepareQrCode,
    measureTextLayer: (layer) => {
      if (!ctx) return { width: 0, height: 0 };
      return measureTextLayer(layer);
    },
    onLayerSelect: onLayerSelectCallback,
    onLayerMove: onLayerMoveCallback,
    onRenderComplete: onRenderCompleteCallback
  };
})();
