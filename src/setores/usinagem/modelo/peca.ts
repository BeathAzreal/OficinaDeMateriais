// Representação da peça: perfil discretizado ao longo do eixo.
// z = 0 na face livre (lado da ferramenta), crescendo em direção à placa.

export const DZ = 0.1; // mm — largura de cada célula do perfil

export interface Peca {
  balanco: number; // mm em balanço (da face livre até a face das castanhas)
  diametroBruto: number; // mm
  diametros: number[]; // mm, uma posição por célula
  /** Número do passe que gerou a superfície da célula; −1 = superfície original (com carepa). */
  origem: number[];
  /** Ra estimada da superfície da célula [µm]; NaN na superfície original. */
  ra: number[];
  /** Diâmetro do furo central na célula [mm]; 0 = maciço. */
  furo: number[];
  /** Diâmetro programado de referência (coordenada X, em diâmetro) [mm]. */
  dref: number;
  /** Material da peça (id do catálogo). */
  materialId: string;
}

export function criarPeca(diametro: number, balanco: number, materialId: string): Peca {
  const n = Math.round(balanco / DZ);
  return {
    balanco,
    diametroBruto: diametro,
    diametros: new Array(n).fill(diametro),
    origem: new Array(n).fill(-1),
    ra: new Array(n).fill(Number.NaN),
    furo: new Array(n).fill(0),
    dref: diametro,
    materialId,
  };
}

export function copiarPeca(p: Peca): Peca {
  return {
    ...p,
    diametros: p.diametros.slice(),
    origem: p.origem.slice(),
    ra: p.ra.slice(),
    furo: p.furo.slice(),
  };
}

/** Maior diâmetro de furo entre z0 e z1 [mm]. */
export function furoMaximoEntre(peca: Peca, z0: number, z1: number): number {
  const i0 = celulaEm(peca, z0);
  const i1 = Math.max(i0, celulasAte(peca, z1) - 1);
  let m = 0;
  for (let i = i0; i <= i1; i++) m = Math.max(m, peca.furo[i]);
  return m;
}

/** Profundidade do furo de diâmetro pleno, lida com paquímetro de profundidade [mm, sem arredondar]. */
export function profundidadeFuro(peca: Peca): number {
  const d0 = peca.furo[0];
  if (d0 <= 0) return 0;
  let i = 0;
  while (i < peca.furo.length && peca.furo[i] >= d0 - 0.1) i++;
  return i * DZ;
}

export const centroCelula = (i: number) => (i + 0.5) * DZ;

export function celulaEm(peca: Peca, z: number): number {
  const i = Math.floor(z / DZ);
  return Math.min(peca.diametros.length - 1, Math.max(0, i));
}

/** Número de células cujo centro fica antes de z (cobertas por um passe de comprimento z). */
export function celulasAte(peca: Peca, z: number): number {
  return Math.min(peca.diametros.length, Math.max(0, Math.round(z / DZ)));
}

export function diametroEm(peca: Peca, z: number): number {
  return peca.diametros[celulaEm(peca, z)];
}

export function extremosEntre(peca: Peca, z0: number, z1: number): { min: number; max: number } {
  const i0 = celulaEm(peca, z0);
  const i1 = Math.max(i0, celulasAte(peca, z1) - 1);
  let min = Infinity;
  let max = -Infinity;
  for (let i = i0; i <= i1; i++) {
    min = Math.min(min, peca.diametros[i]);
    max = Math.max(max, peca.diametros[i]);
  }
  return { min, max };
}
