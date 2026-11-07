import type { Ataque, Lixamento, Polimento } from '../setores/laboratorio/casos/tipos'

/*
 * O que faz: as ações manuais do Laboratório de Falhas (v2.2, H109), sem
 * tela. Cada bancada transforma o que o jogador fez com as mãos nas escolhas
 * do motor de ensaios (src/setores/laboratorio/motor), que decide o que
 * aparece. Assim, pular a lixa 600 dá a "camada deformada e arrancamentos",
 * atacar demais dá "sobreataque", e assim por diante.
 * Onde mexer: quanto cada lixa, pano e ataque exige está em PREPARO.
 */

export const PREPARO = {
  /** Lixas na ordem; cada uma precisa remover os riscos da anterior. */
  lixas: [220, 600, 1200] as const,
  /** Distância de passadas (mm de arraste na lixa, escala do jogo) para cada lixa completar. */
  distanciaLixaMm: { 220: 900, 600: 1100, 1200: 1300 } as Record<number, number>,
  /** Sem girar 90° ao trocar de lixa, os riscos novos e os antigos se confundem: rende menos. */
  rendimentoSemGirar: 0.55,
  /** Polimento: segundos de pano com movimento, por pasta de diamante (µm). */
  poliS: { 6: 8, 1: 6 } as Record<number, number>,
  /** Ataque com Nital: abaixo de `minimoS` não revela; acima de `maximoS`, sobreataque. */
  ataque: { minimoS: 2, maximoS: 12 },
  /** Microscópio: o foco precisa ficar a menos disto do ponto certo (unidades do botão de foco). */
  focoTolerancia: { 10: 4, 100: 2, 500: 0.8 } as Record<number, number>,
  /** Cortadeira: avanço máximo sem travar o disco (mm/s) e comprimento do corte (mm). */
  corte: { avancoMaxMmS: 3, comprimentoMm: 14 },
} as const

export type GrauLixa = (typeof PREPARO.lixas)[number]

/** Lixamento à mão: passadas na lixa, girando a amostra 90° a cada troca. */
export class LixamentoManual {
  lixa: GrauLixa | null = null
  /** Progresso de cada lixa (0 a 1). */
  readonly progresso: Record<GrauLixa, number> = { 220: 0, 600: 0, 1200: 0 }
  /** A amostra foi girada 90° desde a troca de lixa. */
  girada = true
  /** Direção atual dos riscos (0° ou 90°). */
  angulo = 0
  private lixaAnterior: GrauLixa | null = null

  trocarLixa(l: GrauLixa): void {
    if (this.lixa === l) return
    this.lixaAnterior = this.lixa
    this.lixa = l
    this.girada = this.lixaAnterior === null
  }
  girar(): void {
    this.angulo = this.angulo === 0 ? 90 : 0
    if (this.lixaAnterior !== null) this.girada = true
  }
  /** Uma passada de `distanciaMm` na lixa atual. */
  passar(distanciaMm: number): void {
    if (!this.lixa || distanciaMm <= 0) return
    const rendimento = this.girada ? 1 : PREPARO.rendimentoSemGirar
    this.progresso[this.lixa] = Math.min(1, this.progresso[this.lixa] + (distanciaMm * rendimento) / PREPARO.distanciaLixaMm[this.lixa])
  }
  completa(l: GrauLixa): boolean { return this.progresso[l] >= 1 }
  /**
   * O que o motor recebe: a última lixa de uma sequência sem saltos. Pular
   * a 600 (220 → 1200) conta como "lixa-220": os riscos fundos da 220 ficam
   * por baixo, e o polimento sobre eles arranca partículas.
   */
  get resultado(): Lixamento | null {
    if (!this.completa(220)) return null
    if (!this.completa(600)) return 'lixa-220'
    if (!this.completa(1200)) return 'lixa-600'
    return 'lixa-1200'
  }
  /** Riscos de cada lixa ainda visíveis (0 a 1): a lixa seguinte apaga os da anterior. */
  riscosVisiveis(l: GrauLixa): number {
    const i = PREPARO.lixas.indexOf(l)
    const seguinte = PREPARO.lixas[i + 1]
    const proprio = this.progresso[l]
    return seguinte ? proprio * (1 - this.progresso[seguinte]) : proprio
  }
}

/** Polimento no pano com pasta de diamante: só vale com o movimento (tempo de pano). */
export class PolimentoManual {
  pasta: 6 | 1 | null = null
  readonly segundos: Record<6 | 1, number> = { 6: 0, 1: 0 }
  trocarPasta(p: 6 | 1): void { this.pasta = p }
  polir(dt: number, movendo: boolean): void {
    if (!this.pasta || !movendo || dt <= 0) return
    this.segundos[this.pasta] += dt
  }
  completo(p: 6 | 1): boolean { return this.segundos[p] >= PREPARO.poliS[p] }
  get resultado(): Polimento {
    if (!this.completo(6)) return 'nenhum'
    return this.completo(1) ? 'diamante-6-1' : 'diamante-6'
  }
}

/** Ataque químico com Nital: o tempo de imersão decide. */
export function ataqueDoTempo(segundos: number): Ataque {
  if (segundos < PREPARO.ataque.minimoS) return 'nenhum'
  return segundos > PREPARO.ataque.maximoS ? 'nital-30s' : 'nital-5s'
}

/** Foco do microscópio: o ponto certo muda a cada amostra e aumento; desfoque proporcional ao erro. */
export function pontoDeFoco(semente: string, ampliacao: number): number {
  let h = 0
  for (const c of `${semente}/${ampliacao}`) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return -20 + (h % 4000) / 100 // −20 a +20
}
export function emFoco(foco: number, alvo: number, ampliacao: number): boolean {
  return Math.abs(foco - alvo) <= PREPARO.focoTolerancia[ampliacao]
}
/** Desfoque (px de blur) para mostrar na imagem. */
export function desfoque(foco: number, alvo: number, ampliacao: number): number {
  const e = Math.abs(foco - alvo) / PREPARO.focoTolerancia[ampliacao]
  return e <= 1 ? 0 : Math.min(12, (e - 1) * 2.5)
}

/** Cortadeira: avançar rápido demais trava o disco (o corte precisa recomeçar). */
export class Cortadeira {
  avancoMm = 0
  travou = false
  get pronto(): boolean { return this.avancoMm >= PREPARO.corte.comprimentoMm }
  avancar(velocidadeMmS: number, dt: number, refrigerando: boolean): void {
    if (this.travou || this.pronto || dt <= 0 || velocidadeMmS <= 0) return
    // Sem refrigeração o limite cai à metade (o disco aquece e trava).
    if (velocidadeMmS > PREPARO.corte.avancoMaxMmS * (refrigerando ? 1 : 0.5)) { this.travou = true; return }
    this.avancoMm = Math.min(PREPARO.corte.comprimentoMm, this.avancoMm + velocidadeMmS * dt)
  }
  recomecar(): void { this.avancoMm = 0; this.travou = false }
}
