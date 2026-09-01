/**
 * state.js — localStorage persistence helpers for the ERC Newsletter Builder.
 *
 * All three functions guard localStorage access in try/catch: storage can
 * throw in private/incognito mode or when the quota is exceeded.
 */

const STORAGE_KEY = 'erc_newsletter_issue';

/**
 * Persist the issue model to localStorage.
 * @param {object} issue
 */
export function saveState(issue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issue));
  } catch (_) {
    // Private mode / quota exceeded — silently ignore
  }
}

/**
 * Load a previously saved issue from localStorage.
 * @returns {object|null} Parsed issue, or null if absent or invalid JSON.
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Remove the saved issue from localStorage.
 */
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    // Ignore
  }
}
