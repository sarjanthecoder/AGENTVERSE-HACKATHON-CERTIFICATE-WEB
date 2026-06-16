/* ============================================================
   AI Certificate Generator — Template Manager
   Handles template loading, smart certificate presets,
   and preset save/load.
   ============================================================ */

const TemplateManager = (() => {
  'use strict';

  /* ── Available Fonts ── */
  const FONTS = [
    { family: 'Inter', weights: ['400', '500', '600', '700', '800'] },
    { family: 'Orbitron', weights: ['400', '500', '700', '900'] },
    { family: 'Playfair Display', weights: ['400', '700', '900'] },
    { family: 'Great Vibes', weights: ['400'] },
    { family: 'Montserrat', weights: ['400', '500', '600', '700', '800'] },
    { family: 'Roboto', weights: ['400', '500', '700'] },
    { family: 'Poppins', weights: ['400', '500', '600', '700'] },
    { family: 'Raleway', weights: ['400', '600', '700'] },
    { family: 'Dancing Script', weights: ['400', '700'] },
    { family: 'Bebas Neue', weights: ['400'] },
    { family: 'Cinzel', weights: ['400', '700', '900'] },
    { family: 'Oswald', weights: ['400', '500', '700'] }
  ];

  /* ── Template Image Paths (bundled in assets/) ── */
  const TEMPLATE_IMAGES = {
    'participant':  'assets/participant final.png',
    '1st_prize':    'assets/1st-prize-template.png',
    '2nd_prize':    'assets/2nd-prize-template.png',
    '3rd_prize':    'assets/3rd-prize-template.png',
    'judge':        'assets/judge-template.png'
  };

  /* ── Smart Certificate Presets ── */
  /* Positions are 0-1 relative to canvas; Date = LEFT */
  const CERTIFICATE_PRESETS = {
    'participant': {
      label: 'Participant',
      templateImage: 'assets/participant final.png',
      layers: {
        name: {
          x: 0.5, y: 0.535,
          fontSize: 64, fontFamily: 'Playfair Display', fontWeight: '700',
          color: '#1a1a2e', alignment: 'center', letterSpacing: 2,
          shadow: { color: 'rgba(124,58,237,0.15)', blur: 6, offsetX: 0, offsetY: 2 }
        },
        role: {
          x: 0.5, y: 0.59,
          fontSize: 24, fontFamily: 'Inter', fontWeight: '600',
          color: '#4a4a6a', alignment: 'center', letterSpacing: 4,
          shadow: { color: 'rgba(0,0,0,0.08)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        event: {
          x: 0.5, y: 0.645,
          fontSize: 20, fontFamily: 'Inter', fontWeight: '400',
          color: '#5a5a7a', alignment: 'center', letterSpacing: 1,
          shadow: { color: 'rgba(0,0,0,0.05)', blur: 1, offsetX: 0, offsetY: 0 }
        },
        // DATE — positioned at BOTTOM LEFT
        date: {
          x: 0.12, y: 0.95,
          fontSize: 16, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'left', letterSpacing: 1,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        // CERTIFICATE ID — positioned at BOTTOM RIGHT
        certId: {
          x: 0.94, y: 0.95,
          fontSize: 14, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'right', letterSpacing: 2,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        }
      }
    },
    '1st_prize': {
      label: '1st Prize',
      templateImage: 'assets/1st-prize-template.png',
      layers: {
        name: {
          x: 0.5, y: 0.535,
          fontSize: 68, fontFamily: 'Cinzel', fontWeight: '900',
          color: '#B8860B', alignment: 'center', letterSpacing: 3,
          shadow: { color: 'rgba(184,134,11,0.35)', blur: 10, offsetX: 0, offsetY: 2 }
        },
        role: {
          x: 0.5, y: 0.59,
          fontSize: 26, fontFamily: 'Inter', fontWeight: '600',
          color: '#2a2a4e', alignment: 'center', letterSpacing: 4,
          shadow: { color: 'rgba(0,0,0,0.08)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        event: {
          x: 0.5, y: 0.645,
          fontSize: 20, fontFamily: 'Inter', fontWeight: '500',
          color: '#4a4a6a', alignment: 'center', letterSpacing: 1,
          shadow: { color: 'rgba(0,0,0,0.05)', blur: 1, offsetX: 0, offsetY: 0 }
        },
        date: {
          x: 0.12, y: 0.95,
          fontSize: 16, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'left', letterSpacing: 1,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        certId: {
          x: 0.94, y: 0.95,
          fontSize: 14, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'right', letterSpacing: 2,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        }
      }
    },
    '2nd_prize': {
      label: '2nd Prize',
      templateImage: 'assets/2nd-prize-template.png',
      layers: {
        name: {
          x: 0.5, y: 0.535,
          fontSize: 64, fontFamily: 'Cinzel', fontWeight: '700',
          color: '#708090', alignment: 'center', letterSpacing: 3,
          shadow: { color: 'rgba(112,128,144,0.3)', blur: 8, offsetX: 0, offsetY: 2 }
        },
        role: {
          x: 0.5, y: 0.59,
          fontSize: 24, fontFamily: 'Inter', fontWeight: '600',
          color: '#2a2a4e', alignment: 'center', letterSpacing: 4,
          shadow: { color: 'rgba(0,0,0,0.08)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        event: {
          x: 0.5, y: 0.645,
          fontSize: 20, fontFamily: 'Inter', fontWeight: '500',
          color: '#4a4a6a', alignment: 'center', letterSpacing: 1,
          shadow: { color: 'rgba(0,0,0,0.05)', blur: 1, offsetX: 0, offsetY: 0 }
        },
        date: {
          x: 0.12, y: 0.95,
          fontSize: 16, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'left', letterSpacing: 1,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        certId: {
          x: 0.94, y: 0.95,
          fontSize: 14, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'right', letterSpacing: 2,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        }
      }
    },
    '3rd_prize': {
      label: '3rd Prize',
      templateImage: 'assets/3rd-prize-template.png',
      layers: {
        name: {
          x: 0.5, y: 0.535,
          fontSize: 60, fontFamily: 'Cinzel', fontWeight: '700',
          color: '#8B4513', alignment: 'center', letterSpacing: 3,
          shadow: { color: 'rgba(139,69,19,0.25)', blur: 8, offsetX: 0, offsetY: 2 }
        },
        role: {
          x: 0.5, y: 0.59,
          fontSize: 24, fontFamily: 'Inter', fontWeight: '600',
          color: '#2a2a4e', alignment: 'center', letterSpacing: 4,
          shadow: { color: 'rgba(0,0,0,0.08)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        event: {
          x: 0.5, y: 0.645,
          fontSize: 20, fontFamily: 'Inter', fontWeight: '500',
          color: '#4a4a6a', alignment: 'center', letterSpacing: 1,
          shadow: { color: 'rgba(0,0,0,0.05)', blur: 1, offsetX: 0, offsetY: 0 }
        },
        date: {
          x: 0.12, y: 0.95,
          fontSize: 16, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'left', letterSpacing: 1,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        certId: {
          x: 0.94, y: 0.95,
          fontSize: 14, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'right', letterSpacing: 2,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        }
      }
    },
    'judge': {
      label: 'Judge',
      templateImage: 'assets/judge-template.png',
      layers: {
        name: {
          x: 0.5, y: 0.535,
          fontSize: 58, fontFamily: 'Playfair Display', fontWeight: '700',
          color: '#1a1a3e', alignment: 'center', letterSpacing: 2,
          shadow: { color: 'rgba(99,102,241,0.15)', blur: 6, offsetX: 0, offsetY: 2 }
        },
        role: {
          x: 0.5, y: 0.59,
          fontSize: 24, fontFamily: 'Inter', fontWeight: '600',
          color: '#4338ca', alignment: 'center', letterSpacing: 5,
          shadow: { color: 'rgba(0,0,0,0.08)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        event: {
          x: 0.5, y: 0.645,
          fontSize: 20, fontFamily: 'Inter', fontWeight: '400',
          color: '#5a5a7a', alignment: 'center', letterSpacing: 1,
          shadow: { color: 'rgba(0,0,0,0.05)', blur: 1, offsetX: 0, offsetY: 0 }
        },
        date: {
          x: 0.12, y: 0.95,
          fontSize: 16, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'left', letterSpacing: 1,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        },
        certId: {
          x: 0.94, y: 0.95,
          fontSize: 14, fontFamily: 'Inter', fontWeight: '900',
          color: '#0f1e56', alignment: 'right', letterSpacing: 2,
          shadow: { color: 'rgba(15,30,86,0.1)', blur: 2, offsetX: 0, offsetY: 1 }
        }
      }
    }
  };

  /* ── User Presets (localStorage) ── */

  const STORAGE_KEY = 'cert-gen-presets';

  /**
   * Get saved user presets
   * @returns {Object[]}
   */
  function getUserPresets() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a user preset
   * @param {string} name - Preset name
   * @param {Object} config - Layers configuration
   */
  function saveUserPreset(name, config) {
    const presets = getUserPresets();
    const existing = presets.findIndex(p => p.name === name);
    const preset = {
      name,
      config: Utils.deepClone(config),
      createdAt: new Date().toISOString()
    };

    if (existing >= 0) {
      presets[existing] = preset;
    } else {
      presets.push(preset);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return preset;
  }

  /**
   * Delete a user preset
   */
  function deleteUserPreset(name) {
    const presets = getUserPresets().filter(p => p.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }

  /**
   * Export configuration as JSON
   * @param {Object} config
   * @returns {string}
   */
  function exportConfig(config) {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON
   * @param {string} jsonStr
   * @returns {Object}
   */
  function importConfig(jsonStr) {
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Invalid JSON configuration');
    }
  }

  /**
   * Get the certificate preset for a given type
   * @param {string} type - Certificate type key
   * @returns {Object|null}
   */
  function getCertificatePreset(type) {
    return CERTIFICATE_PRESETS[type] || null;
  }

  /**
   * Get all certificate type options
   */
  function getCertificateTypes() {
    return Object.entries(CERTIFICATE_PRESETS).map(([key, val]) => ({
      value: key,
      label: val.label
    }));
  }

  /**
   * Get the template image path for a certificate type
   * @param {string} type
   * @returns {string}
   */
  function getTemplateImagePath(type) {
    return TEMPLATE_IMAGES[type] || TEMPLATE_IMAGES['participant'];
  }

  /**
   * Load all fonts
   */
  async function loadAllFonts() {
    const promises = FONTS.map(f => Utils.loadGoogleFont(f.family, f.weights).catch(() => {
      console.warn(`Failed to load font: ${f.family}`);
    }));
    await Promise.all(promises);
  }

  /**
   * Get available font families
   */
  function getFontFamilies() {
    return FONTS.map(f => f.family);
  }

  return {
    FONTS,
    TEMPLATE_IMAGES,
    CERTIFICATE_PRESETS,
    getUserPresets,
    saveUserPreset,
    deleteUserPreset,
    exportConfig,
    importConfig,
    getCertificatePreset,
    getCertificateTypes,
    getTemplateImagePath,
    loadAllFonts,
    getFontFamilies
  };
})();
