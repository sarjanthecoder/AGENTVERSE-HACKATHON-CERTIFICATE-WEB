/* ============================================================
   AI Certificate Generator — Global Configuration
   Configure Firebase and Cloudinary credentials here.
   ============================================================ */

const AppConfig = (() => {
  'use strict';

  // --- PLACE YOUR REAL CREDENTIALS HERE ---
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAnsHgTjhfRUzA5vSTFsVDnQakyZDmbMVY",
    authDomain: "agentverse-2dc49.firebaseapp.com",
    projectId: "agentverse-2dc49",
    storageBucket: "agentverse-2dc49.firebasestorage.app",
    messagingSenderId: "72592299012",
    appId: "1:72592299012:web:a1ba844efc39a7a3c39151"
  };

  const CLOUDINARY_CONFIG = {
    cloudName: "dzldp0nc9",
    uploadPreset: "AGENTVERSE" // Must be an unsigned upload preset
  };

  const VERIFY_BASE_URL = "https://agentverse-2dc49.web.app"; // Your production verification domain

  /**
   * Check if Firebase is configured
   */
  function isFirebaseConfigured() {
    return FIREBASE_CONFIG.apiKey && 
           !FIREBASE_CONFIG.apiKey.startsWith("YOUR_") && 
           FIREBASE_CONFIG.projectId && 
           !FIREBASE_CONFIG.projectId.startsWith("YOUR_");
  }

  /**
   * Check if Cloudinary is configured
   */
  function isCloudinaryConfigured() {
    return CLOUDINARY_CONFIG.cloudName && 
           !CLOUDINARY_CONFIG.cloudName.startsWith("YOUR_") && 
           CLOUDINARY_CONFIG.uploadPreset && 
           !CLOUDINARY_CONFIG.uploadPreset.startsWith("YOUR_");
  }

  return {
    FIREBASE_CONFIG,
    CLOUDINARY_CONFIG,
    VERIFY_BASE_URL,
    isFirebaseConfigured,
    isCloudinaryConfigured
  };
})();
