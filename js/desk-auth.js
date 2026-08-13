/**
 * Browser-side desk password. The desk API routes (/api/sheet, /api/process)
 * require an x-desk-password header — see api/_auth.js. This is where the
 * browser keeps that value: cached in localStorage, asked for once via a
 * prompt, and cleared whenever a call comes back 401 so the next attempt
 * asks again instead of looping on a wrong value.
 */

const STORAGE_KEY = 'erc-desk-password';

export function getDeskPassword() {
  let password = localStorage.getItem(STORAGE_KEY);
  if (!password) {
    password = window.prompt('Desk password:') || '';
    if (password) localStorage.setItem(STORAGE_KEY, password);
  }
  return password;
}

export function clearDeskPassword() {
  localStorage.removeItem(STORAGE_KEY);
}
