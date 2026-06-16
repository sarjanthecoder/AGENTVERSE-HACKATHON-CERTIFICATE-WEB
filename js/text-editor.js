/* ============================================================
   AI Certificate Generator — Text Editor
   Manages text input controls and syncs with canvas layers.
   ============================================================ */

const TextEditor = (() => {
  'use strict';

  /* ── Layer Definitions ── */
  const LAYER_DEFS = [
    { id: 'name', label: 'Participant Name', placeholder: 'Enter full name...' },
    { id: 'role', label: 'Role / Designation', placeholder: 'e.g., AI ENGINEER' },
    { id: 'event', label: 'Event Name', placeholder: 'e.g., AGENTVERSE HACKATHON', optional: true },
    { id: 'date', label: 'Date', placeholder: 'e.g., June 2, 2026', optional: true }
  ];

  let currentCertType = 'participant';
  let layerTexts = {};
  let activeLayerId = 'name';
  const unlockedTypes = new Set(['participant', 'judge']);

  /* ── Init ── */

  /**
   * Initialize the text editor and bind events
   */
  function init() {
    // Bind text input events
    LAYER_DEFS.forEach(def => {
      const input = document.getElementById(`input-${def.id}`);
      if (input) {
        input.addEventListener('input', Utils.debounce(() => {
          onTextChange(def.id, input.value);
        }, 50));

        input.addEventListener('focus', () => {
          activeLayerId = def.id;
          CanvasEngine.selectLayer(def.id);
          highlightActiveControl(def.id);
        });
      }
    });

    // Certificate type selector
    const typeSelect = document.getElementById('cert-type');
    if (typeSelect) {
      let lastType = typeSelect.value;
      typeSelect.addEventListener('change', () => {
        const newType = typeSelect.value;
        if (newType === '1st_prize' || newType === '2nd_prize' || newType === '3rd_prize') {
          if (unlockedTypes.has(newType)) {
            lastType = newType;
            setCertificateType(newType);
            return;
          }
          showPasswordModal(newType, (success) => {
            if (success) {
              unlockedTypes.add(newType);
              lastType = newType;
              setCertificateType(newType);
            } else {
              typeSelect.value = lastType;
            }
          });
        } else {
          lastType = newType;
          setCertificateType(newType);
        }
      });
    }

    // Style controls
    bindStyleControls();



    // Fixed date to May 31, 2026
    layerTexts['date'] = 'May 31, 2026';
    onTextChange('date', 'May 31, 2026');

    // Set default active
    highlightActiveControl('name');
  }

  /**
   * Handle text input change
   */
  function onTextChange(layerId, text) {
    layerTexts[layerId] = text;

    const layer = CanvasEngine.getTextLayer(layerId);
    let extra = {};
    if (layerId === 'name') {
      extra = { x: 0.5, alignment: 'center' };
    }

    if (layer) {
      CanvasEngine.setTextLayer({ ...layer, text, ...extra });
    } else {
      // Create new layer with preset defaults
      const preset = TemplateManager.getCertificatePreset(currentCertType);
      const defaults = preset?.layers?.[layerId] || {};
      CanvasEngine.setTextLayer({
        ...CanvasEngine.getDefaultTextConfig(),
        ...defaults,
        id: layerId,
        text,
        visible: true,
        ...extra
      });
    }

    pushHistory();
  }

  /**
   * Set certificate type and apply preset + swap template background
   */
  function setCertificateType(type) {
    currentCertType = type;
    const preset = TemplateManager.getCertificatePreset(type);
    if (!preset) return;

    // Smart Mode: Swap the background template image for this cert type
    if (typeof App !== 'undefined' && App.loadTemplateForType) {
      App.loadTemplateForType(type);
    }

    // Apply preset styling to each layer (preserve existing text)
    Object.entries(preset.layers).forEach(([layerId, config]) => {
      const existingLayer = CanvasEngine.getTextLayer(layerId);
      let text = existingLayer?.text || layerTexts[layerId] || '';

      if (layerId === 'date') {
        text = 'May 31, 2026';
      }

      let extra = {};
      if (layerId === 'name') {
        extra = { x: 0.5, alignment: 'center' };
      }

      CanvasEngine.setTextLayer({
        ...CanvasEngine.getDefaultTextConfig(),
        ...config,
        id: layerId,
        text,
        visible: true,
        ...extra
      });
    });

    // Update style controls to reflect active layer
    if (activeLayerId) {
      syncStyleControls(activeLayerId);
    }

    pushHistory();
    UIController.toast(`Applied "${preset.label}" template`, 'success');
  }

  function getCertificateType() {
    return currentCertType;
  }

  /* ── Style Controls ── */

  function bindStyleControls() {
    // Font Family
    const fontFamily = document.getElementById('style-fontFamily');
    if (fontFamily) {
      fontFamily.addEventListener('change', () => updateActiveLayerStyle('fontFamily', fontFamily.value));
    }

    // Font Size
    const fontSize = document.getElementById('style-fontSize');
    const fontSizeVal = document.getElementById('style-fontSize-val');
    if (fontSize) {
      fontSize.addEventListener('input', () => {
        const val = parseInt(fontSize.value);
        if (fontSizeVal) fontSizeVal.textContent = `${val}px`;
        updateActiveLayerStyle('fontSize', val);
      });
    }

    // Font Weight
    const fontWeight = document.getElementById('style-fontWeight');
    if (fontWeight) {
      fontWeight.addEventListener('change', () => updateActiveLayerStyle('fontWeight', fontWeight.value));
    }

    // Text Color
    const textColor = document.getElementById('style-color');
    if (textColor) {
      textColor.addEventListener('input', () => updateActiveLayerStyle('color', textColor.value));
    }

    // Letter Spacing
    const letterSpacing = document.getElementById('style-letterSpacing');
    const letterSpacingVal = document.getElementById('style-letterSpacing-val');
    if (letterSpacing) {
      letterSpacing.addEventListener('input', () => {
        const val = parseInt(letterSpacing.value);
        if (letterSpacingVal) letterSpacingVal.textContent = `${val}px`;
        updateActiveLayerStyle('letterSpacing', val);
      });
    }

    // Rotation
    const rotation = document.getElementById('style-rotation');
    const rotationVal = document.getElementById('style-rotation-val');
    if (rotation) {
      rotation.addEventListener('input', () => {
        const val = parseInt(rotation.value);
        if (rotationVal) rotationVal.textContent = `${val}°`;
        updateActiveLayerStyle('rotation', val);
      });
    }

    // Alignment buttons
    ['left', 'center', 'right'].forEach(align => {
      const btn = document.getElementById(`align-${align}`);
      if (btn) {
        btn.addEventListener('click', () => {
          updateActiveLayerStyle('alignment', align);
          updateAlignmentButtons(align);
        });
      }
    });

    // Shadow controls
    const shadowColor = document.getElementById('style-shadowColor');
    const shadowBlur = document.getElementById('style-shadowBlur');
    const shadowBlurVal = document.getElementById('style-shadowBlur-val');

    if (shadowColor) {
      shadowColor.addEventListener('input', () => updateShadow());
    }
    if (shadowBlur) {
      shadowBlur.addEventListener('input', () => {
        if (shadowBlurVal) shadowBlurVal.textContent = `${shadowBlur.value}px`;
        updateShadow();
      });
    }

    // X / Y position
    const posX = document.getElementById('style-posX');
    const posXVal = document.getElementById('style-posX-val');
    const posY = document.getElementById('style-posY');
    const posYVal = document.getElementById('style-posY-val');

    if (posX) {
      posX.addEventListener('input', () => {
        const val = parseInt(posX.value) / 100;
        if (posXVal) posXVal.textContent = `${posX.value}%`;
        updateActiveLayerStyle('x', val);
      });
    }
    if (posY) {
      posY.addEventListener('input', () => {
        const val = parseInt(posY.value) / 100;
        if (posYVal) posYVal.textContent = `${posY.value}%`;
        updateActiveLayerStyle('y', val);
      });
    }

    // Center buttons
    const centerH = document.getElementById('btn-centerH');
    const centerV = document.getElementById('btn-centerV');
    if (centerH) {
      centerH.addEventListener('click', () => {
        updateActiveLayerStyle('x', 0.5);
        if (posX) { posX.value = 50; if (posXVal) posXVal.textContent = '50%'; }
      });
    }
    if (centerV) {
      centerV.addEventListener('click', () => {
        updateActiveLayerStyle('y', 0.5);
        if (posY) { posY.value = 50; if (posYVal) posYVal.textContent = '50%'; }
      });
    }
  }

  function updateShadow() {
    const color = document.getElementById('style-shadowColor')?.value || 'rgba(0,0,0,0.3)';
    const blur = parseInt(document.getElementById('style-shadowBlur')?.value || '4');
    updateActiveLayerStyle('shadow', { color, blur, offsetX: 0, offsetY: 2 });
  }

  function updateActiveLayerStyle(prop, value) {
    if (!activeLayerId) return;

    const layer = CanvasEngine.getTextLayer(activeLayerId);
    if (!layer) return;

    CanvasEngine.setTextLayer({ ...layer, [prop]: value });
  }

  function updateAlignmentButtons(active) {
    ['left', 'center', 'right'].forEach(align => {
      const btn = document.getElementById(`align-${align}`);
      if (btn) {
        btn.classList.toggle('active', align === active);
      }
    });
  }

  /**
   * Sync style controls UI to match a layer's current config
   */
  function syncStyleControls(layerId) {
    const layer = CanvasEngine.getTextLayer(layerId);
    if (!layer) return;

    setInputValue('style-fontFamily', layer.fontFamily);
    setInputValue('style-fontSize', layer.fontSize);
    setText('style-fontSize-val', `${layer.fontSize}px`);
    setInputValue('style-fontWeight', layer.fontWeight);
    setInputValue('style-color', layer.color);
    setInputValue('style-letterSpacing', layer.letterSpacing);
    setText('style-letterSpacing-val', `${layer.letterSpacing}px`);
    setInputValue('style-rotation', layer.rotation);
    setText('style-rotation-val', `${layer.rotation}°`);
    setInputValue('style-posX', Math.round(layer.x * 100));
    setText('style-posX-val', `${Math.round(layer.x * 100)}%`);
    setInputValue('style-posY', Math.round(layer.y * 100));
    setText('style-posY-val', `${Math.round(layer.y * 100)}%`);

    if (layer.shadow) {
      setInputValue('style-shadowColor', layer.shadow.color);
      setInputValue('style-shadowBlur', layer.shadow.blur);
      setText('style-shadowBlur-val', `${layer.shadow.blur}px`);
    }

    updateAlignmentButtons(layer.alignment);
    highlightActiveControl(layerId);
  }

  function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function highlightActiveControl(layerId) {
    document.querySelectorAll('.layer-input-group').forEach(g => {
      g.classList.remove('active-layer');
    });
    const group = document.getElementById(`layer-group-${layerId}`);
    if (group) group.classList.add('active-layer');
  }

  /* ── External API ── */

  /**
   * Set active layer and sync controls
   */
  function setActiveLayer(id) {
    activeLayerId = id;
    syncStyleControls(id);
  }

  /**
   * Update position controls when layer is dragged on canvas
   */
  function onLayerDragged(layerId, x, y) {
    if (layerId === activeLayerId) {
      setInputValue('style-posX', Math.round(x * 100));
      setText('style-posX-val', `${Math.round(x * 100)}%`);
      setInputValue('style-posY', Math.round(y * 100));
      setText('style-posY-val', `${Math.round(y * 100)}%`);
    }
  }

  /**
   * Get current text values for all layers
   */
  function getLayerTexts() {
    return { ...layerTexts };
  }

  /**
   * Set text values programmatically (for bulk generation)
   */
  function setLayerTexts(texts) {
    Object.entries(texts).forEach(([id, text]) => {
      layerTexts[id] = text;
      const input = document.getElementById(`input-${id}`);
      if (input) input.value = text;
      onTextChange(id, text);
    });
  }

  /* ── History Integration ── */

  let historyTimeout = null;

  function pushHistory() {
    clearTimeout(historyTimeout);
    historyTimeout = setTimeout(() => {
      const layers = CanvasEngine.getTextLayers();
      HistoryManager.push({ layers, certType: currentCertType });
    }, 300);
  }

  /**
   * Restore state from history
   */
  function restoreState(state) {
    if (!state) return;

    if (state.layers) {
      CanvasEngine.setAllTextLayers(state.layers);
      // Sync inputs
      state.layers.forEach(layer => {
        const input = document.getElementById(`input-${layer.id}`);
        if (input) input.value = layer.text || '';
        layerTexts[layer.id] = layer.text || '';
      });
    }

    if (state.certType) {
      currentCertType = state.certType;
      const typeSelect = document.getElementById('cert-type');
      if (typeSelect) typeSelect.value = state.certType;
    }

    if (activeLayerId) {
      syncStyleControls(activeLayerId);
    }
  }

  /* ── Password Prompts for Prizes ── */
  const PRIZE_PASSWORDS = {
    '1st_prize': 'lender1stpze',
    '2nd_prize': 'oculus2ndpze',
    '3rd_prize': 'synkf3rdpze'
  };

  function showPasswordModal(type, callback) {
    const modal = document.getElementById('password-verification-modal');
    const titleEl = document.getElementById('password-modal-title');
    const passwordInput = document.getElementById('cert-password');
    const errorEl = document.getElementById('password-error-msg');
    const verifyBtn = document.getElementById('btn-verify-password');
    const cancelBtn = document.getElementById('btn-cancel-password');

    if (!modal || !passwordInput || !errorEl) {
      // Fallback if elements not loaded yet
      const password = prompt(`Enter password for ${type.replace('_', ' ')}:`);
      if (password === PRIZE_PASSWORDS[type]) {
        callback(true);
      } else {
        alert('Incorrect password!');
        callback(false);
      }
      return;
    }

    // Set title
    const label = type === '1st_prize' ? '1st Prize' : type === '2nd_prize' ? '2nd Prize' : '3rd Prize';
    titleEl.textContent = `${label} Unlock`;
    passwordInput.value = '';
    errorEl.style.display = 'none';

    // Show modal
    modal.classList.add('active');
    passwordInput.focus();

    // Clean up previous event listeners
    const newVerifyBtn = verifyBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    verifyBtn.parentNode.replaceChild(newVerifyBtn, verifyBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const onVerify = () => {
      const entered = passwordInput.value;
      if (entered === PRIZE_PASSWORDS[type]) {
        modal.classList.remove('active');
        callback(true);
      } else {
        errorEl.textContent = 'Incorrect password. Please try again.';
        errorEl.style.display = 'block';
        passwordInput.select();
      }
    };

    const onCancel = () => {
      modal.classList.remove('active');
      callback(false);
    };

    newVerifyBtn.addEventListener('click', onVerify);
    newCancelBtn.addEventListener('click', onCancel);

    // Enter key support
    passwordInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onVerify();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
  }

  return {
    LAYER_DEFS,
    init,
    setCertificateType,
    getCertificateType,
    setActiveLayer,
    onLayerDragged,
    getLayerTexts,
    setLayerTexts,
    syncStyleControls,
    pushHistory,
    restoreState
  };
})();
