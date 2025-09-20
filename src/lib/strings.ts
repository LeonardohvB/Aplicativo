// Title Case para TODAS as palavras (preserva hífen e apóstrofo)
const capSingle = (w: string) => {
  if (!w) return '';
  const ap = w.match(/^([a-z])'([a-z].*)$/i); // d'ávila -> D'Ávila
  if (ap) return ap[1].toUpperCase() + "'" + (ap[2][0]?.toUpperCase() + ap[2].slice(1).toLowerCase());
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
};

export const titleAllWordsLive = (input: string) => {
  if (!input) return '';
  if (/^\s+$/.test(input)) return '';
  const hadTrailing = /\s$/.test(input);
  const core = input.toLowerCase().replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
  const words = core
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.includes('-') ? w.split('-').map(capSingle).join('-') : capSingle(w)))
    .join(' ');
  return words ? (hadTrailing ? words + ' ' : words) : '';
};

export const titleAllWordsFinal = (input: string) => titleAllWordsLive(input).trim();
