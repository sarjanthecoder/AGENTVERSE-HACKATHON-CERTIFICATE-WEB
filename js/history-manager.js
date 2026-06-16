/* ============================================================
   AI Certificate Generator — History Manager (Undo / Redo)
   Maintains a state stack for undo/redo operations.
   ============================================================ */

const HistoryManager = (() => {
  'use strict';

  const MAX_HISTORY = 50;
  let stack = [];
  let pointer = -1;
  let onChangeCallback = null;

  /**
   * Initialize history with a starting state
   * @param {Object} initialState
   */
  function init(initialState) {
    stack = [Utils.deepClone(initialState)];
    pointer = 0;
  }

  /**
   * Push a new state onto the history stack
   * Clears any future states (redo stack)
   * @param {Object} state
   */
  function push(state) {
    // Remove everything after current pointer
    stack = stack.slice(0, pointer + 1);

    // Add new state
    stack.push(Utils.deepClone(state));

    // Enforce max history
    if (stack.length > MAX_HISTORY) {
      stack.shift();
    }

    pointer = stack.length - 1;
    notifyChange();
  }

  /**
   * Undo — go back one step
   * @returns {Object|null} The previous state, or null if at the beginning
   */
  function undo() {
    if (!canUndo()) return null;
    pointer--;
    notifyChange();
    return Utils.deepClone(stack[pointer]);
  }

  /**
   * Redo — go forward one step
   * @returns {Object|null} The next state, or null if at the end
   */
  function redo() {
    if (!canRedo()) return null;
    pointer++;
    notifyChange();
    return Utils.deepClone(stack[pointer]);
  }

  /**
   * Check if undo is possible
   */
  function canUndo() {
    return pointer > 0;
  }

  /**
   * Check if redo is possible
   */
  function canRedo() {
    return pointer < stack.length - 1;
  }

  /**
   * Get the current state
   */
  function getCurrentState() {
    if (pointer >= 0 && pointer < stack.length) {
      return Utils.deepClone(stack[pointer]);
    }
    return null;
  }

  /**
   * Set a callback for when history changes (for updating UI buttons)
   */
  function onChange(callback) {
    onChangeCallback = callback;
  }

  function notifyChange() {
    if (onChangeCallback) {
      onChangeCallback({
        canUndo: canUndo(),
        canRedo: canRedo(),
        depth: stack.length,
        position: pointer
      });
    }
  }

  /**
   * Clear all history
   */
  function clear() {
    stack = [];
    pointer = -1;
    notifyChange();
  }

  return {
    init,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    getCurrentState,
    onChange,
    clear
  };
})();
