// src/utils/prefs.ts
export const MONEY_PREF_KEY = 'pref:money_visible'; // '1' = mostrar, '0' = ocultar

export function getMoneyVisible(): boolean {
  try { return localStorage.getItem(MONEY_PREF_KEY) !== '0'; } catch { return true; }
}
export function setMoneyVisible(v: boolean) {
  try { localStorage.setItem(MONEY_PREF_KEY, v ? '1' : '0'); } catch {}
}
