// Relações geométricas e cinemáticas exatas do torneamento cilíndrico externo.
// São as únicas relações do jogo que não dependem de dados sintéticos.

/** vc [m/min] = π · D [mm] · n [rpm] / 1000 */
export function velocidadeCorte(diametro: number, n: number): number {
  return (Math.PI * diametro * n) / 1000;
}

/** n [rpm] = 1000 · vc [m/min] / (π · D [mm]) — usado só para explicar a relação inversa. */
export function rotacaoPara(vc: number, diametro: number): number {
  return (1000 * vc) / (Math.PI * diametro);
}

/** vf [mm/min] = f [mm/volta] · n [rpm] */
export function velocidadeAvanco(f: number, n: number): number {
  return f * n;
}

/** Redução diametral [mm] provocada por uma profundidade radial ap [mm]: ΔD = 2 · ap */
export function reducaoDiametral(ap: number): number {
  return 2 * ap;
}

/** ap [mm] = (D₀ − D₁) / 2 */
export function profundidadeRadial(diametroAntes: number, diametroDepois: number): number {
  return (diametroAntes - diametroDepois) / 2;
}

/** Diâmetro programado após o passe: D = Dref − 2 · ap */
export function diametroProgramado(diametroReferencia: number, ap: number): number {
  return diametroReferencia - reducaoDiametral(ap);
}

/** tc [min] = percurso [mm] / vf [mm/min] */
export function tempoCorte(percurso: number, vf: number): number {
  if (vf <= 0) return Infinity;
  return percurso / vf;
}

/** Taxa teórica de remoção Q [cm³/min] = vc [m/min] · ap [mm] · f [mm] (os fatores 1000 se cancelam). */
export function taxaRemocao(vc: number, ap: number, f: number): number {
  return vc * ap * f;
}

/** Volume de um anel [mm³] entre dois diâmetros ao longo de dz [mm]. */
export function volumeAnel(diametroExterno: number, diametroInterno: number, dz: number): number {
  return (Math.PI / 4) * (diametroExterno ** 2 - diametroInterno ** 2) * dz;
}

/** Profundidade radial de rugosidade teórica (pico-vale) [mm] para ponta de raio rε: Rt = f²/(8 rε). */
export function rtGeometrico(f: number, raioPonta: number): number {
  return (f * f) / (8 * raioPonta);
}

/** Ra geométrico [µm] ≈ f²/(32 rε), com f e rε em mm. Válido quando f é pequeno frente a rε. */
export function raGeometrico(f: number, raioPonta: number): number {
  return ((f * f) / (32 * raioPonta)) * 1000;
}

/** Conversões auxiliares. */
export const mmParaUm = (mm: number) => mm * 1000;
export const mm3ParaCm3 = (mm3: number) => mm3 / 1000;
export const minParaS = (min: number) => min * 60;
