// Fenômenos com dados sintéticos: força (para carga e deflexão), desgaste e rugosidade.
// Cada função documenta a hipótese correspondente de docs/MODELO.md (códigos H…).

import { raGeometrico } from './cinematica';
import type { ComponentesRa, Ferramenta, FerramentaTornear, Material, NivelCarga } from './tipos';

const grausParaRad = (g: number) => (g * Math.PI) / 180;

// ---------------------------------------------------------------- Força (H5, H6)

/** Espessura de corte h [mm] = f · sen κr */
export function espessuraCorte(f: number, ferramenta: FerramentaTornear): number {
  return f * Math.sin(grausParaRad(ferramenta.anguloPosicao));
}

/** Força de corte Fc [N] = kc · ap · f, com kc = kc11 · h^(−mc) (forma de Kienzle, parâmetros sintéticos). */
export function energiaEspecifica(h: number, material: Material): number {
  return material.comportamento.forca.kc11 * Math.max(h, 0.01) ** -material.comportamento.forca.mc;
}

export function forcaCorte(ap: number, f: number, material: Material, ferramenta: FerramentaTornear): number {
  if (ap <= 0) return 0;
  return energiaEspecifica(espessuraCorte(f, ferramenta), material) * ap * f;
}

/**
 * Fração da força que empurra a ferramenta para fora da peça (força passiva).
 * Sintética: cresce quando ap é pequeno frente ao raio de ponta, porque o corte
 * acontece só no arco da ponta (H6).
 */
export function razaoPassiva(ap: number, ferramenta: FerramentaTornear): number {
  return 0.3 + 0.4 * Math.exp(-ap / ferramenta.raioPonta);
}

/** Momento de inércia de área de seção circular, maciça ou vazada [mm⁴]. */
export function inerciaCircular(diametro: number, furo = 0): number {
  return (Math.PI * (diametro ** 4 - furo ** 4)) / 64;
}

/**
 * Afastamento radial [mm] da ponta em relação à peça (H7): flexibilidade do sistema
 * (placa, árvore, carro) + flexão da peça em balanço, viga engastada na placa.
 */
export function deflexaoRadial(
  forcaPassiva: number,
  distanciaPlaca: number,
  diametroSecao: number,
  rigidezSistema: number,
  moduloElasticidade: number,
  furoSecao = 0,
): number {
  const sistema = forcaPassiva / rigidezSistema;
  const peca =
    (forcaPassiva * distanciaPlaca ** 3) / (3 * moduloElasticidade * inerciaCircular(diametroSecao, furoSecao));
  return sistema + peca;
}

/** Índice de carga = Fc / Fc,limite da aresta (que cai com o desgaste). ≥ 1 → lascamento (H8). */
/** Fator de enfraquecimento da aresta com o desgaste (sintético). */
export function enfraquecimento(vb: number, ferramenta: Ferramenta): number {
  return 1 - 0.3 * Math.min(vb / ferramenta.vbLimite, 1.5);
}

export function indiceCarga(fc: number, ferramenta: FerramentaTornear, vb: number): number {
  return fc / (ferramenta.forcaLimite * enfraquecimento(vb, ferramenta));
}

export function nivelCarga(indice: number): NivelCarga {
  if (indice < 0.35) return 'baixa';
  if (indice < 0.65) return 'moderada';
  if (indice < 1) return 'alta';
  return 'crítica';
}

// ---------------------------------------------------------------- Desgaste (H9–H11)

/**
 * Curva de desgaste de flanco em função da fração de vida consumida x (dano acumulado):
 * amaciamento rápido, trecho estável e aceleração. Φ(1) = 1 → VB = VB,limite.
 */
export function curvaDesgaste(x: number): number {
  const xx = Math.max(0, x);
  return 0.3 * (1 - Math.exp(-10 * xx)) + 0.7 * xx * xx;
}

export function vbDeDano(dano: number, ferramenta: Ferramenta): number {
  return ferramenta.vbLimite * curvaDesgaste(dano);
}

/** Desgaste radial da ponta [mm] associado à marca de flanco: VB · tan α. */
export function desgasteRadial(vb: number, ferramenta: FerramentaTornear): number {
  return vb * Math.tan(grausParaRad(ferramenta.anguloFolga));
}

// ---------------------------------------------------------------- Rugosidade (H12–H16)

/** Ap efetiva abaixo da qual a aresta passa a atritar/recalcar em vez de cortar (sintético). */
export const AP_ATRITO = 0.1; // mm
export const RA_LASCAMENTO = 2.5; // µm, sintético

export function componentesRa(
  f: number,
  vc: number,
  vb: number,
  apEfetivo: number,
  lascada: boolean,
  material: Material,
  ferramenta: FerramentaTornear,
): ComponentesRa {
  const geometrica = raGeometrico(f, ferramenta.raioPonta);
  const comPiso = Math.sqrt(geometrica ** 2 + material.comportamento.raMinimo ** 2);
  const piso = comPiso - geometrica;
  const apc = material.comportamento.rugosidadeApc(vc);
  const razaoVb = vb / ferramenta.vbLimite;
  const desgaste = 1.2 * razaoVb * razaoVb;
  const atrito = apEfetivo < AP_ATRITO ? material.comportamento.raAtritoMax * (1 - apEfetivo / AP_ATRITO) : 0;
  const lascamento = lascada ? RA_LASCAMENTO : 0;
  return {
    geometrica,
    piso,
    apc,
    desgaste,
    atrito,
    lascamento,
    total: comPiso + apc + desgaste + atrito + lascamento,
  };
}

/** Faixa didática de interpretação da Ra estimada (±30 %), não é incerteza calculada. */
export const FAIXA_RA = 0.3;
export function faixaRa(ra: number): [number, number] {
  return [ra * (1 - FAIXA_RA), ra * (1 + FAIXA_RA)];
}
