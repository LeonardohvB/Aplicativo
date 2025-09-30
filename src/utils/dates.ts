// src/utils/dates.ts

/** "YYYY-MM-DD" no fuso local (sem pegar UTC de surpresa) */
export const localISODate = (d = new Date()) => {
  const dd = new Date(d);
  dd.setMinutes(dd.getMinutes() - dd.getTimezoneOffset());
  return dd.toISOString().slice(0, 10);
};

/** Cria um Date no MEIO-DIA local do dia informado (evita trocar de dia por fuso) */
export const parseLocalNoon = (dateYYYYMMDD: string) =>
  new Date(`${dateYYYYMMDD}T12:00:00`);

/** Compara duas datas "YYYY-MM-DD" por igualdade simples */
export const sameLocalDay = (yyyyMmDdA: string, yyyyMmDdB: string) =>
  yyyyMmDdA === yyyyMmDdB;

/** Limites (início/fim) de um dia no fuso local */
export const dayBoundsLocal = (yyyyMmDd: string) => {
  const start = new Date(`${yyyyMmDd}T00:00:00`);
  const end   = new Date(`${yyyyMmDd}T23:59:59.999`);
  return { start, end };
};

/** Limites cobrindo de `from` até `to` (ambos inclusive) no fuso local */
export const rangeBoundsLocal = (fromYYYYMMDD: string, toYYYYMMDD: string) => {
  const a = dayBoundsLocal(fromYYYYMMDD);
  const b = dayBoundsLocal(toYYYYMMDD);
  return { start: a.start, end: b.end };
};

/** Início e fim da semana local (domingo–sábado). Se preferir segunda–domingo, ajuste o cálculo. */
export const weekBoundsLocal = (d = new Date()) => {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // domingo
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/** Início e fim do mês local do Date informado */
export const monthBoundsLocal = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/** Combina "YYYY-MM-DD" + "HH:mm" em um Date local (útil para ordenar slots) */
export const combineLocalDateTime = (dateYYYYMMDD: string, timeHHMM: string) => {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const d = new Date(`${dateYYYYMMDD}T00:00:00`);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
};

/** Checa se a data "YYYY-MM-DD" cai dentro do intervalo [from, to] (inclusivo) */
export const isDateInRangeLocal = (
  dateYYYYMMDD: string,
  fromYYYYMMDD: string,
  toYYYYMMDD: string
) => {
  const { start, end } = rangeBoundsLocal(fromYYYYMMDD, toYYYYMMDD);
  const mid = parseLocalNoon(dateYYYYMMDD);
  return mid >= start && mid <= end;
};
