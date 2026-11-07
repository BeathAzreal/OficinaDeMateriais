// Formatação numérica em português (vírgula decimal).

export function num(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function comSinal(v: number, casas = 2): string {
  const s = num(Math.abs(v), casas);
  return (v >= 0 ? '+' : '−') + s;
}

export function pct(v: number, casas = 0): string {
  return `${num(v * 100, casas)} %`;
}
