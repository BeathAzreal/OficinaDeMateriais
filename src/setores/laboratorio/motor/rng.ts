/**
 * Aleatoriedade reproduzível. Toda variação do jogo vem de hashes das condições de aquisição,
 * de modo que as mesmas condições produzem sempre o mesmo resultado.
 */

/** Hash FNV-1a de uma lista de valores. */
export function hashValores(...valores: (number | string)[]): number {
  let h = 0x811c9dc5;
  const texto = valores.map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join('|');
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash rápido de inteiros (para uso por pixel). */
export function hashInt(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function unitario(h: number): number {
  return (h >>> 0) / 4294967296;
}

/** Valor em [0, 1) a partir de valores arbitrários. */
export function aleatorio01(...valores: (number | string)[]): number {
  return unitario(hashValores(...valores));
}

/** Aproximação de normal padrão (soma de 4 uniformes), determinística. */
export function normalPadrao(...valores: (number | string)[]): number {
  let s = 0;
  for (let i = 0; i < 4; i++) s += aleatorio01(...valores, 'n', i);
  return (s - 2) / Math.sqrt(4 / 12);
}

/** Gerador sequencial mulberry32. */
export function gerador(semente: number): () => number {
  let t = semente >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
