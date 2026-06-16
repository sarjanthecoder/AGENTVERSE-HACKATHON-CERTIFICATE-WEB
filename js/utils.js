/* ============================================================
   AI Certificate Generator — Utilities
   Helper functions used across all modules.
   ============================================================ */

const Utils = (() => {
  'use strict';

  /**
   * Debounce a function call
   * @param {Function} fn - Function to debounce
   * @param {number} ms - Delay in milliseconds
   * @returns {Function}
   */
  function debounce(fn, ms = 150) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /**
   * Throttle a function call
   * @param {Function} fn - Function to throttle
   * @param {number} ms - Minimum interval in milliseconds
   * @returns {Function}
   */
  function throttle(fn, ms = 16) {
    let last = 0;
    let timer;
    return function (...args) {
      const now = Date.now();
      const remaining = ms - (now - last);
      clearTimeout(timer);
      if (remaining <= 0) {
        last = now;
        fn.apply(this, args);
      } else {
        timer = setTimeout(() => {
          last = Date.now();
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  /**
   * Clamp a value between min and max
   */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Generate a unique ID
   * @param {string} prefix
   * @returns {string}
   */
  function generateId(prefix = 'CERT') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = prefix + '-';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Format a date to a readable string
   * @param {Date} date
   * @returns {string}
   */
  function formatDate(date) {
    if (!date) date = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Parse CSV text into an array of objects
   * Supports quoted fields and various line endings
   * @param {string} text - CSV content
   * @returns {{ headers: string[], rows: Object[] }}
   */
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one data row.');
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = (values[idx] || '').trim();
      });
      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Trigger a file download from a Blob
   * @param {Blob} blob
   * @param {string} filename
   */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Load a Google Font dynamically
   * @param {string} family - Font family name
   * @param {string[]} weights - e.g. ['400', '700']
   * @returns {Promise<void>}
   */
  async function loadGoogleFont(family, weights = ['400', '700']) {
    const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return; // Already loaded

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(';')}&display=swap`;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  /**
   * Load an image from a File or URL
   * @param {string|File} source
   * @returns {Promise<HTMLImageElement>}
   */
  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));

      if (source instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(source);
      } else {
        img.src = source;
      }
    });
  }

  /**
   * Convert degrees to radians
   */
  function degToRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Deep clone a plain object
   */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Wait for given milliseconds
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format file size to human readable
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  return {
    debounce,
    throttle,
    clamp,
    generateId,
    formatDate,
    parseCSV,
    downloadBlob,
    loadGoogleFont,
    loadImage,
    degToRad,
    deepClone,
    sleep,
    formatFileSize
  };
})();
