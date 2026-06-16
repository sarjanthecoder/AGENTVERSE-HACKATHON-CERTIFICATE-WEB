/* ============================================================
   AI Certificate Generator — Verification Manager
   Coordinates QR Code embedding, Cloudinary uploads, and
   Firebase Firestore metadata storage for frontend-only
   certificate verification.
   ============================================================ */

const VerificationManager = (() => {
  'use strict';

  let isUploading = false;
  let lastRegisteredUrl = '';

  /**
   * Initialize Verification Manager
   */
  function init() {
    console.log('🛡️ Verification Manager initialized');
    
    // If Firebase keys are configured, initialize Firebase SDK
    if (AppConfig.isFirebaseConfigured()) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(AppConfig.FIREBASE_CONFIG);
          console.log('🔥 Firebase Initialized successfully!');
        }
      } catch (err) {
        console.error('Failed to initialize Firebase SDK:', err);
      }
    } else {
      console.log('ℹ️ Firebase not configured. Verification Manager is running in Local Mock Fallback Mode.');
    }
  }

  /**
   * Helper to generate a QRCode image element asynchronously
   * @param {string} text - URL to encode in the QR code
   * @returns {Promise<HTMLImageElement>}
   */
  function generateQRCodeImage(text) {
    return new Promise((resolve, reject) => {
      const tempDiv = document.createElement('div');
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);

      try {
        // Create QRCode.js instance
        const qrcode = new QRCode(tempDiv, {
          text: text,
          width: 256,
          height: 256,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });

        // Poll until the Image source gets populated
        const checkInterval = setInterval(() => {
          const img = tempDiv.querySelector('img');
          if (img && img.src && img.complete) {
            clearInterval(checkInterval);
            
            const loadedImg = new Image();
            loadedImg.crossOrigin = 'anonymous';
            loadedImg.onload = () => {
              document.body.removeChild(tempDiv);
              resolve(loadedImg);
            };
            loadedImg.onerror = () => reject(new Error('Failed to load generated QR Image'));
            loadedImg.src = img.src;
          }
        }, 50);

        // Timeout fallback
        setTimeout(() => {
          clearInterval(checkInterval);
          if (tempDiv.parentNode) document.body.removeChild(tempDiv);
          reject(new Error('QR Code generation timed out'));
        }, 5000);

      } catch (err) {
        if (tempDiv.parentNode) document.body.removeChild(tempDiv);
        reject(err);
      }
    });
  }

  /**
   * Composite the QR code onto the high-resolution export canvas
   * @param {number} scale - Export scale factor
   * @returns {Promise<HTMLCanvasElement>}
   */
  async function prepareExportCanvas(scale) {
    // Fetch active Certificate ID
    const certIdInput = document.getElementById('input-certId');
    const certId = certIdInput?.value?.trim() || 'CERT-DEMO';

    // Ensure the QR code is fully generated and cached before exporting
    try {
      if (typeof CanvasEngine !== 'undefined' && CanvasEngine.prepareQrCode) {
        await CanvasEngine.prepareQrCode(certId);
      }
    } catch (err) {
      console.warn('Failed to prepare QR Code for export:', err);
    }

    // 1. Core export canvas rendered by CanvasEngine
    // Note: CanvasEngine now automatically renders the QR Code on the certId layer!
    return CanvasEngine.renderForExport(scale);
  }

  /**
   * Upload image blob directly to Cloudinary via Unsigned Upload API
   * @param {Blob} imageBlob
   * @returns {Promise<string>}
   */
  async function uploadToCloudinary(imageBlob) {
    if (!AppConfig.isCloudinaryConfigured()) {
      console.log('ℹ️ Cloudinary is not configured. Simulating upload in Local Mock Fallback Mode.');
      await Utils.sleep(1200); // Simulate upload latency
      return ''; // Will trigger mock save
    }

    const { cloudName, uploadPreset } = AppConfig.CLOUDINARY_CONFIG;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('file', imageBlob);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'AGENTVERSE');

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || 'Failed to upload to Cloudinary');
    }

    const data = await response.json();
    return data.secure_url;
  }

  /**
   * Save certificate verification metadata to Firestore or LocalStorage
   */
  async function saveCertificateMetadata(certId, name, certType, secureUrl) {
    // Dynamic issue date — formatted as "June 2, 2026"
    const issueDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const metadata = {
      certificateId: certId,
      name: name,
      certificateType: certType,
      issueDate: issueDate,
      cloudinaryUrl: secureUrl,
      status: 'verified',
      createdAt: new Date().toISOString()
    };

    if (AppConfig.isFirebaseConfigured()) {
      try {
        const db = firebase.firestore();
        await db.collection('certificates').doc(certId).set(metadata);
        console.log('🔥 Saved metadata securely in Firestore!');
      } catch (err) {
        console.error('Firestore save failed, falling back to local storage:', err);
        saveToLocalStorage(certId, metadata);
      }
    } else {
      saveToLocalStorage(certId, metadata);
    }
  }

  /**
   * Fallback: Save metadata to LocalStorage for local-first execution
   */
  function saveToLocalStorage(certId, metadata) {
    const STORAGE_KEY = 'mock-certificates';
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      data[certId] = metadata;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('💾 Saved mock metadata in LocalStorage!');
    } catch (err) {
      console.error('LocalStorage write failed:', err);
    }
  }

  /**
   * Coordinate the entire cloud verification pipeline:
   * QR Code Embed -> Cloudinary Upload -> Firebase Firestore Save -> Return URL
   */
  async function processVerificationPipeline(canvas) {
    if (isUploading) return;

    // Fetch details
    const nameInput = document.getElementById('input-name');
    const certIdInput = document.getElementById('input-certId');
    const typeSelect = document.getElementById('cert-type');

    const name = nameInput?.value?.trim() || 'John Doe';
    const certId = certIdInput?.value?.trim() || 'CERT-DEMO';
    const certType = typeSelect?.options[typeSelect.selectedIndex]?.text.replace(/^[^\s]+\s+/, '') || 'Participant';

    isUploading = true;
    UIController.toast('🛡️ Initiating cloud verification...', 'info');

    try {
      // 1. Convert Canvas to Blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Failed to capture canvas blob')), 'image/png', 0.95);
      });

      // 2. Upload to Cloudinary
      let secureUrl = await uploadToCloudinary(blob);

      // If in Mock Mode, use compressed local base64 to allow fully operational local verification preview!
      if (!secureUrl) {
        secureUrl = canvas.toDataURL('image/jpeg', 0.4); // Compact jpeg
      }

      // 3. Save details to Firebase Firestore (or LocalStorage fallback)
      await saveCertificateMetadata(certId, name, certType, secureUrl);

      UIController.toast('🛡️ Verification metadata registered in Cloud!', 'success');
    } catch (err) {
      console.error('Verification pipeline error:', err);
      UIController.toast('⚠️ Cloud upload failed: ' + err.message, 'warning');
    } finally {
      isUploading = false;
    }
  }

  /**
   * Immediately upload current canvas state to Cloudinary and register in Firebase.
   * Called when user clicks the "Upload & Verify" button.
   * QR code must already be generated (certId must be filled).
   */
  async function uploadAndRegisterNow() {
    if (isUploading) {
      UIController.toast('⏳ Upload already in progress...', 'warning');
      return;
    }

    const certIdInput = document.getElementById('input-certId');
    const nameInput   = document.getElementById('input-name');
    const typeSelect  = document.getElementById('cert-type');

    const certId   = certIdInput?.value?.trim();
    const name     = nameInput?.value?.trim() || 'Unknown';
    const certType = typeSelect?.options[typeSelect.selectedIndex]?.text
                       .replace(/^[^\s]+\s+/, '') || 'Participant';

    if (!certId) {
      UIController.toast('⚠️ Enter a Certificate ID first to generate a QR!', 'error');
      return;
    }

    const bgSize = CanvasEngine.getBackgroundSize();
    if (!bgSize.width) {
      UIController.toast('⚠️ Please load a certificate template first!', 'error');
      return;
    }

    isUploading = true;

    // Show loading state on button
    const uploadBtn = document.getElementById('btn-upload-verify');
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = '⏳ Uploading...';
    }

    UIController.toast('🛡️ Generating QR & uploading certificate to cloud...', 'info', 4000);

    try {
      // 1. Render high-res canvas with QR embedded
      const exportCanvas = await prepareExportCanvas(4);

      // 2. Convert canvas to PNG Blob
      const blob = await new Promise((resolve, reject) => {
        exportCanvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Canvas capture failed')),
          'image/png', 0.95
        );
      });

      // 3. Upload to Cloudinary
      UIController.toast('☁️ Uploading to Cloudinary...', 'info', 3000);
      let secureUrl = await uploadToCloudinary(blob);

      // Fallback: local base64 for offline / mock mode
      if (!secureUrl) {
        secureUrl = exportCanvas.toDataURL('image/jpeg', 0.4);
      }

      // 4. Save certificate metadata to Firebase (or LocalStorage fallback)
      UIController.toast('🔥 Registering in Firebase...', 'info', 2000);
      await saveCertificateMetadata(certId, name, certType, secureUrl);

      // 5. Build and show the live verification URL
      const verifyUrl = (typeof AppConfig !== 'undefined' && AppConfig.VERIFY_BASE_URL)
        ? `${AppConfig.VERIFY_BASE_URL}/verify.html?id=${encodeURIComponent(certId)}`
        : `${window.location.origin}/verify.html?id=${encodeURIComponent(certId)}`;

      lastRegisteredUrl = verifyUrl;

      UIController.toast('✅ Certificate registered! QR is now live & scannable.', 'success', 8000);

      // Reveal the verify URL panel
      const container = document.getElementById('verify-url-container');
      const link      = document.getElementById('verify-url-link');
      if (container && link) {
        link.href        = verifyUrl;
        link.textContent = verifyUrl;
        container.style.display = 'flex';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Update button to success state
      if (uploadBtn) {
        uploadBtn.textContent = '✅ Registered!';
        uploadBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        setTimeout(() => {
          uploadBtn.textContent = '🛡️ Upload & Verify';
          uploadBtn.style.background = '';
          uploadBtn.disabled = false;
        }, 3000);
      }

    } catch (err) {
      console.error('Upload & Register error:', err);
      UIController.toast('❌ Upload failed: ' + err.message, 'error');
      if (uploadBtn) {
        uploadBtn.textContent = '🛡️ Upload & Verify';
        uploadBtn.disabled = false;
      }
    } finally {
      isUploading = false;
    }
  }

  return {
    init,
    generateQRCodeImage,
    prepareExportCanvas,
    processVerificationPipeline,
    uploadAndRegisterNow
  };
})();
