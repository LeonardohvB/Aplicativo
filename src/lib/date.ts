
/** Data local de hoje em YYYY-MM-DD (sem timezone bug) */
export function todayLocalISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** Converte "HH:MM" para minutos desde 00:00 */
export function hmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Compara uma data ISO (YYYY-MM-DD) com HOJE (local): -1=passado, 0=hoje, 1=futuro */
export function compareToToday(dateISO: string): -1 | 0 | 1 {
  const today = todayLocalISO();
  if (dateISO < today) return -1;
  if (dateISO > today) return 1;
  return 0;
}

/** Retorna true se o INÍCIO do slot já passou (considerando o dia e a hora local) */
export function isSlotStartPast(dateISO: string, startHHmm: string): boolean {
  const cmp = compareToToday(dateISO);
  if (cmp < 0) return true;   // dia no passado
  if (cmp > 0) return false;  // dia no futuro

  // mesmo dia: compara hora/minuto
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= hmToMinutes(startHHmm);
}

/** (opcional) Retorna true se o FIM do slot já passou */
export function isSlotEndPast(dateISO: string, endHHmm: string): boolean {
  const cmp = compareToToday(dateISO);
  if (cmp < 0) return true;
  if (cmp > 0) return false;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= hmToMinutes(endHHmm);
}

/** Bloqueia só quando passou do início + tolerância (min) */
export function isStartPastWithGrace(
  dateISO: string,
  startHHmm: string,
  graceMin = 10
): boolean {
  const cmp = compareToToday(dateISO);
  if (cmp < 0) return true;   // dia passado
  if (cmp > 0) return false;  // dia futuro

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cutoff = hmToMinutes(startHHmm) + (graceMin || 0);
  return nowMin >= cutoff;
}

