import type { MaterialId } from './material'
import { FUSAO } from './parametros'

/*
 * H101 (v2.0): a chapa consumida pelo calor, em estágios.
 *
 * O índice de fusão F de cada fatia (H33, já relativo à espessura e ao
 * material) é o calor no meio da poça. Para os lados ele cai como
 * F·exp(−k·(2·d/w)²), com w a largura da mancha de calor (a da poça, até 8 mm). Cada ponto da chapa passa
 * pelos estágios conforme o calor que chegou nele: raiz aparente no avesso,
 * metal vazando e pendurado, face afundando e, onde passou do limite, o
 * metal cai e abre o buraco. O furo nasce no ponto mais quente e alarga com
 * mais calor. Como o pico guardado não diminui (H101), o buraco não fecha.
 * Números do jogo.
 */

export interface LimiaresPenetracao {
  /** Raiz começa a aparecer no avesso. */
  raizAparente: number
  /** Metal vaza e pendura no avesso. */
  excesso: number
  /** A poça cai e a face afunda. */
  afunda: number
  /** O metal cai: buraco. */
  furo: number
}

/**
 * Estágios por material. No aço e no inox há aviso: a raiz aparece, o metal
 * pendura e só depois fura. O alumínio quase não avisa: conduz o calor para
 * longe e não muda de cor, até que a poça cai de uma vez (faixa estreita).
 */
export const LIMIARES_PENETRACAO: Record<MaterialId, LimiaresPenetracao> = {
  'aco-carbono': { raizAparente: 1.6, excesso: 2.1, afunda: 2.35, furo: FUSAO.perfuracao },
  'inox-austenitico': { raizAparente: 1.6, excesso: 2.1, afunda: 2.35, furo: FUSAO.perfuracao },
  aluminio: { raizAparente: 2.25, excesso: 2.42, afunda: 2.52, furo: FUSAO.perfuracao },
  // H104: galvanizado e médio carbono avisam como o aço; o inox ferrítico como o inox; o cobre, como o alumínio, quase não avisa.
  'aco-galvanizado': { raizAparente: 1.6, excesso: 2.1, afunda: 2.35, furo: FUSAO.perfuracao },
  'aco-medio-carbono': { raizAparente: 1.6, excesso: 2.1, afunda: 2.35, furo: FUSAO.perfuracao },
  'inox-ferritico': { raizAparente: 1.6, excesso: 2.1, afunda: 2.35, furo: FUSAO.perfuracao },
  cobre: { raizAparente: 2.2, excesso: 2.4, afunda: 2.5, furo: FUSAO.perfuracao },
}

export const CONSUMO = {
  /** Queda do calor para os lados da poça: F·exp(−k·(2d/w)²). */
  quedaLateral: 3.3,
  /** Célula do mapa da chapa (mm) e meia largura coberta a partir da junta (mm). */
  celulaMm: 0.5,
  meiaLarguraMm: 50,
  /** Borda queimada em volta do buraco (mm). */
  bordaMm: 1.2,
  /**
   * Largura da mancha de calor do arco (mm): o calor que fura se concentra
   * nela, não na poça inteira (a poça parada fica larga com o metal
   * acumulado). Com o espalhamento ao longo da junta (H4), o buraco sai
   * quase redondo. Número do jogo.
   */
  larguraCalorMm: 8,
} as const

/** Calor relativo (índice F) a `dMm` do meio de uma poça de largura `larguraMm`. */
export function calorLateral(F: number, larguraMm: number, dMm: number): number {
  if (larguraMm <= 0) return 0
  const r = (2 * dMm) / Math.min(larguraMm, CONSUMO.larguraCalorMm)
  return F * Math.exp(-CONSUMO.quedaLateral * r * r)
}

/**
 * Largura do buraco (mm) na fatia: onde o calor lateral passa do limite de
 * furo. Zero até o limite; nasce estreito no meio e alarga com o calor.
 */
export function larguraFuroMm(F: number, larguraMm: number, furo: number = FUSAO.perfuracao): number {
  if (F <= furo || larguraMm <= 0) return 0
  return Math.min(larguraMm, CONSUMO.larguraCalorMm) * Math.sqrt(Math.log(F / furo) / CONSUMO.quedaLateral)
}

export type EstagioChapa = 'intacta' | 'raiz' | 'vazando' | 'afundando' | 'furada'

/** Estágio de um ponto da chapa pelo calor que chegou nele. */
export function estagioChapa(Flocal: number, l: LimiaresPenetracao): EstagioChapa {
  if (Flocal > l.furo) return 'furada'
  if (Flocal > l.afunda) return 'afundando'
  if (Flocal > l.excesso) return 'vazando'
  if (Flocal > l.raizAparente) return 'raiz'
  return 'intacta'
}

/** Mapa da chapa: em cada célula, 0 intacta … 1 buraco (canal 0) e borda queimada 0…1 (canal 1). */
export interface MapaConsumo {
  nx: number
  ny: number
  /** RGBA por célula, linha a linha (y = lateral, de −meia a +meia; x ao longo da junta). */
  dados: Uint8Array
}

/**
 * Mapa da chapa a partir do que a análise guardou por fatia: largura do
 * buraco, onde está o meio da poça e quanto afundou. Serve ao MIG, ao
 * eletrodo e ao TIG (cada um calcula furoMm do seu jeito).
 */
export function preencherMapaConsumo(
  mapa: MapaConsumo,
  passoMm: number,
  furoMm: ArrayLike<number>,
  centroMm: ArrayLike<number>,
  afundamento: ArrayLike<number>,
  limpar = true,
): boolean {
  if (limpar) mapa.dados.fill(0)
  const cel = CONSUMO.celulaMm
  let algum = false
  for (let i = 0; i < furoMm.length; i++) {
    const furo = furoMm[i]
    const af = afundamento[i]
    if (furo <= 0 && af <= 0.3) continue
    const xMm = (i + 0.5) * passoMm
    const c = centroMm[i]
    const meio = furo / 2
    const alcance = meio + CONSUMO.bordaMm * (furo > 0 ? 1 : af)
    const ix0 = Math.max(0, Math.floor((xMm - passoMm / 2) / cel))
    const ix1 = Math.min(mapa.nx - 1, Math.ceil((xMm + passoMm / 2) / cel) - 1)
    const iy0 = Math.max(0, Math.floor((c - alcance + CONSUMO.meiaLarguraMm) / cel))
    const iy1 = Math.min(mapa.ny - 1, Math.ceil((c + alcance + CONSUMO.meiaLarguraMm) / cel))
    for (let iy = iy0; iy <= iy1; iy++) {
      const d = Math.abs((iy + 0.5) * cel - CONSUMO.meiaLarguraMm - c)
      const buraco = d < meio ? 255 : 0
      const borda = Math.round(255 * Math.max(0, Math.min(1, 1 - (d - meio) / Math.max(0.01, alcance - meio))) * (furo > 0 ? 1 : 0.6 * af))
      for (let ix = ix0; ix <= ix1; ix++) {
        const k = 4 * (iy * mapa.nx + ix)
        mapa.dados[k] = Math.max(mapa.dados[k], buraco)
        mapa.dados[k + 1] = Math.max(mapa.dados[k + 1], borda)
        if (buraco) algum = true
      }
    }
  }
  return algum
}

export function novoMapaConsumo(comprimentoMm: number): MapaConsumo {
  const nx = Math.ceil(comprimentoMm / CONSUMO.celulaMm)
  const ny = Math.ceil((2 * CONSUMO.meiaLarguraMm) / CONSUMO.celulaMm)
  return { nx, ny, dados: new Uint8Array(4 * nx * ny) }
}
