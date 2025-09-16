// src/lib/phone-br.ts
export function onlyDigits(v: string) {
  return (v || '').replace(/\D+/g, '');
}

// Formata celular BR: (DD) X XXXX-XXXX
export function formatBRCell(v: string) {
  const d = onlyDigits(v).slice(0, 11); // dd + 9 dígitos
  const len = d.length;

  if (len === 0) return '';
  if (len <= 2) return `(${d}`;
  if (len <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (len <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  // len 8..11
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}
