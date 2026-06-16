/* ============================================================
   AI Certificate Generator — UI Controller
   Toast notifications, modals, loading states, and UI helpers.
   ============================================================ */

const UIController = (() => {
  'use strict';

  let toastContainer = null;

  /**
   * Initialize the UI controller
   */
  function init() {
    // Create toast container
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  /* ── Toast Notifications ── */

  const TOAST_ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  /**
   * Show a toast notification
   * @param {string} message - Notification message
   * @param {'success'|'error'|'warning'|'info'} type - Toast type
   * @param {number} duration - Duration in ms (0 = manual dismiss)
   */
  function toast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${TOAST_ICONS[type]}</span>
      <span class="toast-message">${message}</span>
      ${duration > 0 ? '<div class="toast-progress"></div>' : ''}
    `;

    // Adjust progress animation duration
    if (duration > 0) {
      const progress = toast.querySelector('.toast-progress');
      if (progress) {
        progress.style.animationDuration = `${duration}ms`;
      }
    }

    // Click to dismiss
    toast.addEventListener('click', () => dismissToast(toast));

    toastContainer.appendChild(toast);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => dismissToast(toast), duration);
    }

    return toast;
  }

  function dismissToast(toastEl) {
    if (!toastEl || !toastEl.parentNode) return;
    toastEl.classList.add('removing');
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 300);
  }

  /* ── Modal ── */

  /**
   * Show a modal dialog
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.content - HTML content
   * @param {Array} options.actions - Array of { label, class, onClick }
   * @returns {HTMLElement} The modal overlay element
   */
  function showModal({ title, content, actions = [] }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${title}</h3>
        <div class="modal-content">${content}</div>
        <div class="modal-actions" id="modal-actions"></div>
      </div>
    `;

    const actionsContainer = overlay.querySelector('#modal-actions');
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `btn ${action.class || 'btn-secondary'}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        if (action.onClick) action.onClick();
        closeModal(overlay);
      });
      actionsContainer.appendChild(btn);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });

    document.body.appendChild(overlay);
    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('active'));

    return overlay;
  }

  function closeModal(overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }

  /**
   * Show a confirmation dialog
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  function confirm(message) {
    return new Promise((resolve) => {
      showModal({
        title: 'Confirm',
        content: `<p style="color: var(--clr-text-secondary); font-size: var(--fs-sm);">${message}</p>`,
        actions: [
          { label: 'Cancel', class: 'btn-secondary', onClick: () => resolve(false) },
          { label: 'Confirm', class: 'btn-primary', onClick: () => resolve(true) }
        ]
      });
    });
  }

  /* ── Loading State ── */

  /**
   * Show loading overlay on an element
   * @param {HTMLElement} container - Element to overlay
   * @param {string} text - Loading text
   * @returns {HTMLElement} The loading overlay
   */
  function showLoading(container, text = 'Processing...') {
    let overlay = container.querySelector('.loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="spinner"></div>
        <span class="loading-text">${text}</span>
      `;
      container.style.position = 'relative';
      container.appendChild(overlay);
    } else {
      overlay.querySelector('.loading-text').textContent = text;
    }
    requestAnimationFrame(() => overlay.classList.add('active'));
    return overlay;
  }

  /**
   * Hide loading overlay
   */
  function hideLoading(container) {
    const overlay = container.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }
  }

  /* ── Collapsible Sections ── */

  /**
   * Initialize collapsible section cards
   */
  function initCollapsibleSections() {
    document.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.section-card');
        card.classList.toggle('collapsed');
      });
    });
  }

  /* ── Tab Switching ── */

  /**
   * Initialize tabs
   * @param {string} containerId - Parent container with .tabs and .tab-content elements
   */
  function initTabs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const tabs = container.querySelectorAll('.tab');
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = container.querySelector(`#${target}`);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  }

  /* ── Button Ripple Effect ── */

  /**
   * Add ripple effect to all .btn elements
   */
  function initRippleEffects() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;

      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  /* ── Progress Bar ── */

  /**
   * Update a progress bar
   * @param {string} barId - ID of the .progress-fill element
   * @param {number} percent - 0-100
   * @param {string} label - Optional label text
   */
  function updateProgress(barId, percent, label = '') {
    const fill = document.getElementById(barId);
    if (fill) {
      fill.style.width = `${percent}%`;
    }
    if (label) {
      const labelEl = document.getElementById(barId + '-label');
      if (labelEl) labelEl.textContent = label;
    }
  }

  return {
    init,
    toast,
    showModal,
    closeModal,
    confirm,
    showLoading,
    hideLoading,
    initCollapsibleSections,
    initTabs,
    initRippleEffects,
    updateProgress
  };
})();
