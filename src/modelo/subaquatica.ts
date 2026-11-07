/*
 * H110 (v2.2): soldagem subaquática molhada com eletrodo revestido.
 *
 * Modelo didático, sem pretensão de procedimento qualificado. O que muda em
 * relação ao eletrodo na oficina:
 * - a água rouba calor do arco: a fonte precisa de mais corrente para o mesmo
 *   arco (fator que cresce com a profundidade, porque a pressão aperta o arco);
 * - o arco ferve a água e forma uma bolha de vapor e hidrogênio: arco um pouco
 *   longo já deixa poro, e mais fundo dá mais poro;
 * - a peça esfria muito rápido (t8/5 curto): a zona afetada pelo calor fica
 *   dura e sujeita a trinca por hidrogênio. Andar mais devagar (mais calor) e
 *   um segundo passe por cima (revenimento) ajudam;
 * - segurança: o ajudante na superfície liga e desliga a corrente numa chave
 *   (chave faca). Trocar a vareta com a corrente ligada dá choque.
 */

/** Pressão absoluta (bar): 1 da atmosfera + 1 a cada 10 m de água do mar. */
export function pressaoBar(profundidadeM: number): number {
  return 1 + Math.max(0, profundidadeM) / 10
}

/** Corrente na fonte ÷ corrente que chega ao arco (a água rouba calor; a pressão aperta o arco). */
export function fatorCorrente(profundidadeM: number): number {
  return 1.15 + 0.005 * Math.max(0, profundidadeM)
}

/**
 * Poro extra da água (0…1, somado ao poro do eletrodo): base pela
 * profundidade e muito mais com o arco acima de um diâmetro (a bolha de vapor
 * deixa a poça sem a proteção do revestimento). `arcoDiametros` é o arco médio
 * em diâmetros da alma, como na análise do eletrodo.
 */
export function poroAgua(profundidadeM: number, arcoDiametros: number): number {
  const lim = (v: number) => Math.max(0, Math.min(1, v))
  return lim(0.04 + 0.006 * Math.max(0, profundidadeM) + 0.35 * lim((arcoDiametros - 1) / 0.6))
}

/** Tempo de resfriamento de 800 a 500 °C (s): no ar ~10 s por kJ/mm; na água, perto de um quinto. */
export function t85S(aporteKJmm: number, profundidadeM: number | null): number {
  const ar = 10 * Math.max(0, aporteKJmm)
  return profundidadeM === null ? ar : ar * 0.22 * (1 - 0.004 * Math.min(60, Math.max(0, profundidadeM)))
}

export const SUBAQUATICA = {
  /** Dureza máxima aceita na ZTA no jogo (HV). Referência didática; normas de solda molhada pedem algo nesta faixa. */
  durezaLimiteHV: 350,
  /** Abaixo disso o risco de trinca por hidrogênio é baixo no jogo (HV). */
  durezaSeguraHV: 300,
  /** Quanto um segundo passe por cima tira da dureza (revenimento), em HV. */
  revenimentoHV: 40,
  /** Tempo para o ajudante confirmar a chave depois do pedido (s). */
  confirmacaoS: 0.9,
  /** Desconto na nota por choque (pontos de 1000). */
  descontoChoque: 150,
  /** Desconto máximo pela dureza acima do limite (pontos de 1000). */
  descontoDurezaMax: 200,
} as const

/**
 * Dureza máxima estimada na ZTA (HV). Mistura martensita (dura, depende do
 * carbono) e ferrita/perlita (macia) pela fração que tem tempo de se
 * transformar: f = 1 − e^(−t8/5 ÷ τ), com τ maior para CE maior.
 */
export function durezaZTA(carbono: number, ce: number, t85: number, passes = 1): number {
  const martensita = 884 * carbono + 294
  const macia = 180
  const tau = Math.max(0.6, 2 + 12 * (ce - 0.25))
  const f = 1 - Math.exp(-Math.max(0, t85) / tau)
  const hv = martensita * (1 - f) + macia * f
  return Math.round(hv - (passes >= 2 ? SUBAQUATICA.revenimentoHV : 0))
}

export type RiscoHidrogenio = 'baixo' | 'medio' | 'alto'

export function riscoHidrogenio(durezaHV: number, profundidadeM: number): RiscoHidrogenio {
  // Mais fundo, mais hidrogênio na bolha (a água se dissocia no arco sob pressão).
  const ajuste = durezaHV + 1.5 * Math.max(0, profundidadeM)
  return ajuste < SUBAQUATICA.durezaSeguraHV ? 'baixo' : ajuste <= SUBAQUATICA.durezaLimiteHV + 10 ? 'medio' : 'alto'
}

/** O que o ajudante na superfície está fazendo com a chave da corrente. */
export type EstadoChave = 'desligada' | 'ligando' | 'ligada' | 'desligando'

/**
 * Chave faca na superfície: o mergulhador pede (“liga!”, “desliga!”) e o
 * ajudante confirma depois de um instante. Trocar a vareta com a corrente
 * ligada é choque.
 */
export class ChaveSeguranca {
  estado: EstadoChave = 'desligada'
  private faltaS = 0
  choques = 0
  trocasSeguras = 0

  get ligada(): boolean { return this.estado === 'ligada' || this.estado === 'desligando' }

  /** Pede para ligar se está desligada (ou desligando); senão, para desligar. */
  pedir(): void {
    if (this.estado === 'desligada' || this.estado === 'desligando') this.estado = this.estado === 'desligando' ? 'ligada' : 'ligando'
    else this.estado = this.estado === 'ligando' ? 'desligada' : 'desligando'
    this.faltaS = this.estado === 'ligando' || this.estado === 'desligando' ? SUBAQUATICA.confirmacaoS : 0
  }

  avancar(dt: number): void {
    if (this.estado !== 'ligando' && this.estado !== 'desligando') return
    this.faltaS -= dt
    if (this.faltaS <= 0) this.estado = this.estado === 'ligando' ? 'ligada' : 'desligada'
  }

  /** Troca de vareta: com a corrente ligada é choque. */
  trocarVareta(): 'choque' | 'ok' {
    if (this.ligada) { this.choques++; return 'choque' }
    this.trocasSeguras++
    return 'ok'
  }
}

export interface LaudoSubaquatico {
  profundidadeM: number
  pressaoBar: number
  t85S: number
  t85ArS: number
  durezaHV: number
  durezaArHV: number
  risco: RiscoHidrogenio
  choques: number
  descontoChoques: number
  descontoDureza: number
  /** Desconto total (pontos de 1000). */
  desconto: number
  /** No Difícil: sem choque e com a dureza dentro do limite. */
  aprovado: boolean
}

export function laudoSubaquatico(op: { profundidadeM: number; carbono: number; ce: number; aporteKJmm: number; passes: number; choques: number }): LaudoSubaquatico {
  const t = t85S(op.aporteKJmm, op.profundidadeM)
  const tAr = t85S(op.aporteKJmm, null)
  const hv = durezaZTA(op.carbono, op.ce, t, op.passes)
  const hvAr = durezaZTA(op.carbono, op.ce, tAr, op.passes)
  const descontoChoques = op.choques * SUBAQUATICA.descontoChoque
  const acima = Math.max(0, hv - SUBAQUATICA.durezaLimiteHV)
  const descontoDureza = Math.min(SUBAQUATICA.descontoDurezaMax, Math.round(acima * 4))
  return {
    profundidadeM: op.profundidadeM, pressaoBar: pressaoBar(op.profundidadeM), t85S: t, t85ArS: tAr,
    durezaHV: hv, durezaArHV: hvAr, risco: riscoHidrogenio(hv, op.profundidadeM),
    choques: op.choques, descontoChoques, descontoDureza, desconto: descontoChoques + descontoDureza,
    aprovado: op.choques === 0 && hv <= SUBAQUATICA.durezaLimiteHV,
  }
}
