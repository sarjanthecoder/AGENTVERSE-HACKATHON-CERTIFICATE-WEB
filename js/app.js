/* ============================================================
   AI Certificate Generator — App Bootstrapper
   Main application entry point. Initializes all modules,
   wires up events, and coordinates the system.
   ============================================================ */

const App = (() => {
  'use strict';

  /**
   * Initialize the entire application
   */
  async function init() {
    console.log('🚀 AI Certificate Generator — Initializing...');

    // 1. Initialize UI controller (toasts, ripples)
    UIController.init();
    UIController.initRippleEffects();
    UIController.initCollapsibleSections();

    // 2. Load Google Fonts
    try {
      await TemplateManager.loadAllFonts();
      console.log('✅ Fonts loaded');
    } catch (e) {
      console.warn('⚠️ Some fonts failed to load:', e);
    }

    // 3. Initialize Canvas Engine
    const canvas = document.getElementById('certificate-canvas');
    const wrapper = document.getElementById('canvas-wrapper');
    const interactionLayer = document.getElementById('interaction-layer');

    CanvasEngine.init({ canvas, wrapper, interactionLayer });

    // 4. Set up canvas callbacks
    CanvasEngine.onLayerSelect((id) => {
      if (id) {
        TextEditor.setActiveLayer(id);
      }
    });

    CanvasEngine.onLayerMove((id, x, y, dragEnd) => {
      TextEditor.onLayerDragged(id, x, y);
      if (dragEnd) {
        TextEditor.pushHistory();
      }
    });

    // 5. Initialize sub-modules
    TextEditor.init();
    ExportManager.init();
    BulkGenerator.init();
    VerificationManager.init();

    // 5b. Wire up Upload & Verify button
    const uploadVerifyBtn = document.getElementById('btn-upload-verify');
    if (uploadVerifyBtn) {
      uploadVerifyBtn.addEventListener('click', () => VerificationManager.uploadAndRegisterNow());
    }

    // 5c. Auto-generate Cert ID from name so QR pipeline always has an ID
    const nameInput   = document.getElementById('input-name');
    const certIdInput = document.getElementById('input-certId');
    if (nameInput && certIdInput) {
      nameInput.addEventListener('input', () => {
        const slug = nameInput.value.trim()
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 20);
        if (slug) {
          const certId = `CERT-${slug}`;
          certIdInput.value = certId;
          
          // Explicitly update canvas engine layer so it registers
          const preset = TemplateManager.getCertificatePreset(TextEditor.getCertificateType());
          const certIdPreset = preset?.layers?.certId || {};
          
          CanvasEngine.setTextLayer({
            ...CanvasEngine.getDefaultTextConfig(),
            ...certIdPreset,
            id: 'certId',
            text: certId,
            visible: true
          });
        }
      });
    }

    // 6. Set up template upload
    setupTemplateUpload();

    // 7. Initialize History
    HistoryManager.init({ layers: [], certType: 'participant' });
    HistoryManager.onChange(updateHistoryButtons);
    setupHistoryShortcuts();

    // 8. Set up zoom controls
    setupZoomControls();

    // 9. Set up preset controls
    setupPresetControls();

    // 10. Set up grid toggle
    setupGridToggle();

    // 11. Window resize handler
    window.addEventListener('resize', Utils.debounce(() => {
      CanvasEngine.fitToContainer();
    }, 200));

    // 12. AUTO-LOAD default template on startup
    await loadDefaultTemplate();

    // 13. Initialize Email Auth Overlay
    initEmailAuth();

    // 14. Initialize Landing Page Overlay
    initLandingPage();

    // Show ready toast
    UIController.toast('🎨 Certificate Generator ready!', 'success');
    console.log('✅ App initialized');
  }

  /* ── Auto-Load Default Template ── */

  async function loadDefaultTemplate() {
    try {
      const defaultPath = TemplateManager.getTemplateImagePath('participant') + `?v=${Date.now()}`;
      const img = await Utils.loadImage(defaultPath);

      // Set background
      CanvasEngine.setBackground(img);

      // Hide empty state, show canvas
      const emptyState = document.getElementById('canvas-empty');
      const canvasWrapper = document.getElementById('canvas-wrapper');
      if (emptyState) emptyState.style.display = 'none';
      if (canvasWrapper) canvasWrapper.style.display = 'block';

      // Show template thumbnail
      const thumb = document.getElementById('template-thumb');
      if (thumb) {
        thumb.src = img.src;
        thumb.style.display = 'block';
      }

      // Apply default preset (participant)
      TextEditor.setCertificateType('participant');

      // Update canvas info
      updateCanvasInfo();

      console.log(`%c Default template loaded (${img.naturalWidth}x${img.naturalHeight})`, 'color: #8b5cf6;');
    } catch (err) {
      console.warn('Could not auto-load default template:', err.message);
      // Not a fatal error — user can still upload manually
    }
  }

  /* ── Load Template by Certificate Type (Smart Mode) ── */

  async function loadTemplateForType(type) {
    try {
      const imgPath = TemplateManager.getTemplateImagePath(type) + `?v=${Date.now()}`;
      const img = await Utils.loadImage(imgPath);

      CanvasEngine.setBackground(img);

      // Update thumbnail
      const thumb = document.getElementById('template-thumb');
      if (thumb) {
        thumb.src = img.src;
        thumb.style.display = 'block';
      }

      // Make sure canvas is visible
      const emptyState = document.getElementById('canvas-empty');
      const canvasWrapper = document.getElementById('canvas-wrapper');
      if (emptyState) emptyState.style.display = 'none';
      if (canvasWrapper) canvasWrapper.style.display = 'block';

      updateCanvasInfo();
    } catch (err) {
      console.warn(`Could not load template for type "${type}":`, err.message);
    }
  }

  /* ── Template Upload ── */

  function setupTemplateUpload() {
    const dropzone = document.getElementById('template-dropzone');
    const fileInput = document.getElementById('template-file');

    if (!dropzone || !fileInput) return;

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) loadTemplateFile(file);
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) loadTemplateFile(file);
    });
  }

  async function loadTemplateFile(file) {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      UIController.toast('Please upload a PNG, JPG, or WebP image', 'error');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      UIController.toast('File too large. Max 50MB.', 'error');
      return;
    }

    try {
      UIController.toast('Loading template...', 'info');

      const img = await Utils.loadImage(file);

      // Set background
      CanvasEngine.setBackground(img);

      // Hide empty state, show canvas
      const emptyState = document.getElementById('canvas-empty');
      const canvasWrapper = document.getElementById('canvas-wrapper');
      if (emptyState) emptyState.style.display = 'none';
      if (canvasWrapper) canvasWrapper.style.display = 'block';

      // Show template thumbnail
      const thumb = document.getElementById('template-thumb');
      if (thumb) {
        thumb.src = img.src;
        thumb.style.display = 'block';
      }

      // Update canvas info
      updateCanvasInfo();

      UIController.toast(`✅ Template loaded (${img.naturalWidth}×${img.naturalHeight})`, 'success');
    } catch (err) {
      UIController.toast('Failed to load image: ' + err.message, 'error');
    }
  }

  /* ── Zoom Controls ── */

  function setupZoomControls() {
    const zoomIn = document.getElementById('btn-zoom-in');
    const zoomOut = document.getElementById('btn-zoom-out');
    const zoomFit = document.getElementById('btn-zoom-fit');

    if (zoomIn) {
      zoomIn.addEventListener('click', () => {
        const newZoom = CanvasEngine.setZoom(CanvasEngine.getZoom() + 0.1);
        updateZoomDisplay(newZoom);
      });
    }

    if (zoomOut) {
      zoomOut.addEventListener('click', () => {
        const newZoom = CanvasEngine.setZoom(CanvasEngine.getZoom() - 0.1);
        updateZoomDisplay(newZoom);
      });
    }

    if (zoomFit) {
      zoomFit.addEventListener('click', () => {
        const newZoom = CanvasEngine.setZoom(1);
        updateZoomDisplay(newZoom);
      });
    }
  }

  function updateZoomDisplay(zoom) {
    const display = document.getElementById('zoom-display');
    if (display) {
      display.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  /* ── History (Undo / Redo) ── */

  function setupHistoryShortcuts() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        performRedo();
      }
    });

    // Undo button
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.addEventListener('click', performUndo);

    // Redo button
    const redoBtn = document.getElementById('btn-redo');
    if (redoBtn) redoBtn.addEventListener('click', performRedo);
  }

  function performUndo() {
    const state = HistoryManager.undo();
    if (state) {
      TextEditor.restoreState(state);
      UIController.toast('↩️ Undo', 'info', 1500);
    }
  }

  function performRedo() {
    const state = HistoryManager.redo();
    if (state) {
      TextEditor.restoreState(state);
      UIController.toast('↪️ Redo', 'info', 1500);
    }
  }

  function updateHistoryButtons({ canUndo, canRedo }) {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  }

  /* ── Preset Controls ── */

  function setupPresetControls() {
    // Save preset
    const saveBtn = document.getElementById('btn-save-preset');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const name = prompt('Enter preset name:');
        if (!name) return;

        const config = {
          layers: CanvasEngine.getTextLayers(),
          certType: TextEditor.getCertificateType()
        };
        TemplateManager.saveUserPreset(name, config);
        refreshPresetList();
        UIController.toast(`💾 Preset "${name}" saved`, 'success');
      });
    }

    // Export config
    const exportBtn = document.getElementById('btn-export-config');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const config = {
          layers: CanvasEngine.getTextLayers(),
          certType: TextEditor.getCertificateType()
        };
        const json = TemplateManager.exportConfig(config);
        const blob = new Blob([json], { type: 'application/json' });
        Utils.downloadBlob(blob, 'certificate_config.json');
        UIController.toast('📄 Configuration exported', 'success');
      });
    }

    // Import config
    const importBtn = document.getElementById('btn-import-config');
    const importFile = document.getElementById('config-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const config = TemplateManager.importConfig(evt.target.result);
            if (config.layers) {
              CanvasEngine.setAllTextLayers(config.layers);
              config.layers.forEach(layer => {
                const input = document.getElementById(`input-${layer.id}`);
                if (input) input.value = layer.text || '';
              });
            }
            if (config.certType) {
              const typeSelect = document.getElementById('cert-type');
              if (typeSelect) typeSelect.value = config.certType;
            }
            UIController.toast('📥 Configuration imported', 'success');
          } catch (err) {
            UIController.toast('Invalid config file: ' + err.message, 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    // Initial preset list
    refreshPresetList();
  }

  function refreshPresetList() {
    const list = document.getElementById('preset-list');
    if (!list) return;

    const presets = TemplateManager.getUserPresets();
    if (presets.length === 0) {
      list.innerHTML = '<p class="empty-state-text" style="padding: var(--sp-2);">No saved presets yet</p>';
      return;
    }

    list.innerHTML = presets.map(p => `
      <div class="preset-item" style="display:flex;justify-content:space-between;align-items:center;padding:var(--sp-2);border-bottom:1px solid var(--glass-border);">
        <button class="btn btn-ghost btn-sm preset-load" data-name="${p.name}" style="flex:1;justify-content:flex-start;">
          📁 ${p.name}
        </button>
        <button class="btn btn-ghost btn-sm preset-delete" data-name="${p.name}" style="color:var(--clr-error);">✕</button>
      </div>
    `).join('');

    // Bind load events
    list.querySelectorAll('.preset-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = presets.find(p => p.name === btn.dataset.name);
        if (preset && preset.config) {
          if (preset.config.layers) {
            CanvasEngine.setAllTextLayers(preset.config.layers);
            preset.config.layers.forEach(layer => {
              const input = document.getElementById(`input-${layer.id}`);
              if (input) input.value = layer.text || '';
            });
          }
          UIController.toast(`Loaded preset "${btn.dataset.name}"`, 'success');
        }
      });
    });

    // Bind delete events
    list.querySelectorAll('.preset-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        TemplateManager.deleteUserPreset(btn.dataset.name);
        refreshPresetList();
        UIController.toast('Preset deleted', 'info');
      });
    });
  }

  /* ── Grid Toggle ── */

  function setupGridToggle() {
    const gridBtn = document.getElementById('btn-grid');
    const gridOverlay = document.getElementById('grid-overlay');
    if (gridBtn && gridOverlay) {
      gridBtn.addEventListener('click', () => {
        gridOverlay.classList.toggle('visible');
        gridBtn.classList.toggle('active');
      });
    }
  }

  /* ── Canvas Info ── */

  function updateCanvasInfo() {
    const info = document.getElementById('canvas-info');
    if (!info) return;

    const bgSize = CanvasEngine.getBackgroundSize();
    if (bgSize.width) {
      info.innerHTML = `<span>${bgSize.width}</span> × <span>${bgSize.height}</span> px`;
    } else {
      info.innerHTML = 'No template loaded';
    }
  }

  /* ── Email Authentication Flow ── */

  function initEmailAuth() {
    const overlay = document.getElementById('email-verification-overlay');
    const emailInput = document.getElementById('auth-email');
    const verifyBtn = document.getElementById('btn-verify-email');
    const errorMsg = document.getElementById('auth-error-msg');

    if (!overlay || !emailInput || !verifyBtn) return;

    // Show modal on startup
    overlay.classList.add('active');
    emailInput.focus();

    const onVerify = () => {
      const email = emailInput.value.trim();
      if (!email) {
        if (errorMsg) {
          errorMsg.textContent = 'Please enter an email address.';
          errorMsg.style.display = 'block';
        }
        return;
      }

      // Check database (ParticipantDB is loaded from js/db.js)
      if (typeof findUserByEmail === 'function') {
        const user = findUserByEmail(email);
        if (user) {
          window.currentUser = user;
          window.currentProjectUrl = user.url;

          // Autofill name and event
          TextEditor.setLayerTexts({ name: user.name });

          // Dispatch input event to generate cert ID and render QR
          const nameInput = document.getElementById('input-name');
          if (nameInput) {
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Hide modal
          overlay.classList.remove('active');
          UIController.toast(`Welcome back, ${user.name}!`, 'success');
        } else {
          if (errorMsg) {
            errorMsg.textContent = 'Email not registered. Please verify and try again.';
            errorMsg.style.display = 'block';
          }
          emailInput.select();
        }
      } else {
        console.error('findUserByEmail is not defined');
        overlay.classList.remove('active');
      }
    };

    verifyBtn.addEventListener('click', onVerify);

    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onVerify();
      }
    });
  }

  /* ── Landing Page Flow ── */
  function initLandingPage() {
    const landing = document.getElementById('landing-page');
    const startBtns = [
      document.getElementById('btn-get-started'),
      document.getElementById('btn-header-get-started')
    ];
    
    if (landing) {
      startBtns.forEach(btn => {
        if (btn) {
          btn.addEventListener('click', () => {
            landing.classList.add('fade-out');
            setTimeout(() => {
              landing.style.display = 'none';
            }, 1000);
          });
        }
      });

      // Verification shortcut opens verify.html registry page
      const verifyBtn = document.getElementById('btn-verify-shortcut');
      if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
          window.location.href = 'verify.html';
        });
      }
    }
  }

  /* ── Start ── */

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, loadTemplateFile, loadTemplateForType };
})();
