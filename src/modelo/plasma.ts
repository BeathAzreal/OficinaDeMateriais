import type { PecaTig } from '../missoes/pecasTig'
import { ModeloTig, type EventoTig } from './tig'

/*
 * Soldagem a plasma (PAW) didática, H107. Mesma chapa e mesmo calor do TIG
 * (modelo/tig.ts), com o que muda no plasma:
 * - O tungstênio fica recuado dentro de um bocal de cobre com furo estreito
 *   (constritor). O arco sai em coluna estreita: concentra o calor e quase
 *   não abre com a distância (no TIG, o arco é um cone que abre).
 * - Por isso não há tungstênio na poça. O risco é o bocal: encostado na
 *   peça, ou com corrente alta para o furo dele, o arco passa pelo bocal
 *   (arco duplo) e o gasta; o arco gasto abre e perde força.
 * - O arco piloto (entre o tungstênio e o bocal) deixa abrir o arco de longe.
 * - Keyhole: com calor que atravessa a chapa e gás de plasma suficiente, o
 *   jato fura a chapa; a poça corre em volta do furo e fecha atrás. Uma
 *   passada solda a espessura toda, sem chanfro. Parado ou com gás demais, o
 *   furo cresce e não fecha (vira corte). No fim, a corrente precisa descer
 *   em rampa para o furo fechar; cortar de vez deixa um furo.
 * - Pouca corrente, pouco gás ou avanço rápido: o keyhole não abre (ou
 *   fecha) e a solda vira só fusão de superfície (melt-in), sem penetrar.
 * Números do jogo (comportamento qualitativo), não de procedimento.
 */

export const PLASMA = {
  /** Arco piloto: o arco transferido abre até esta distância e se mantém até `arcoMaxMm`. */
  aberturaMm: 9,
  arcoMaxMm: 14,
  /** Bocal encostando na peça (o tungstênio fica recuado: não toca a poça). */
  contatoMm: 0.8,
  /** Vazão do gás de plasma (L/min): faixa da fonte e valor de partida. */
  gas: { min: 0.3, max: 4, inicial: 1.5 },
  /** Abaixo disto o jato não tem força para abrir o keyhole (só fusão de superfície). */
  gasKeyholeMin: 0.8,
  /** Corrente máxima para o furo do bocal: acima disto o arco passa pelo bocal (arco duplo). */
  correnteBocalA: 230,
  /** O keyhole abre com o calor da seção acima desta fração do limite de "furar" da chapa, e fecha abaixo de `fechaFracao`. */
  abreFracao: 0.92,
  fechaFracao: 0.8,
  /** Diâmetro do keyhole (mm): base, por unidade de gás e por segundo parado. */
  furoBaseMm: 1,
  furoPorGasMm: 0.8,
  furoParadoMmS: 2.5,
  /** Abaixo desta velocidade (mm/s) a tocha conta como parada e o furo cresce. */
  velocidadeMinMmS: 1.2,
  /** Rampa de descida (s) que fecha o keyhole no fim. */
  rampaFechaS: 0.45,
} as const

/** Furo que ainda fecha atrás da poça (mm): a tensão superficial segura mais metal na chapa grossa. */
export function furoQueFechaMm(espessuraMm: number): number {
  return 1.4 + 0.55 * espessuraMm
}

export class ModeloPlasma extends ModeloTig {
  /** Vazão do gás de plasma (L/min). */
  gasLMin: number = PLASMA.gas.inicial
  /** Bocal gasto por arco duplo: o arco abre e perde força até trocar o bocal. */
  bocalGasto = false
  arcosDuplos = 0
  /** Keyhole aberto agora, e o diâmetro dele (mm). */
  keyhole = false
  keyholeMm = 0
  /** Seções (1 mm) que o keyhole atravessou: penetração total. */
  readonly passante = new Uint8Array(150)
  /** Vezes que o keyhole abriu (o 1º é o normal; os outros, de quando fechou no meio). */
  aberturasKeyhole = 0
  private paradoS = 0
  private arcoDuploAgora = false
  /** Rampa de descida: há quanto tempo a corrente vem caindo sem voltar a subir (s). */
  private rampaS = 0
  private pedalVisto = 0

  constructor(peca: PecaTig) {
    super(peca)
  }

  protected override get aberturaMm(): number { return PLASMA.aberturaMm }
  protected override get arcoMaxMm(): number { return PLASMA.arcoMaxMm }
  protected override get contatoMm(): number { return PLASMA.contatoMm }

  /** Coluna estreita que quase não abre com a distância; bocal gasto espalha. */
  override get sigmaMm(): number {
    const gas = Math.max(0, Math.min(1, (this.gasLMin - PLASMA.gas.min) / 2))
    return 0.75 + 0.05 * Math.max(0.5, this.distanciaMm) - 0.15 * gas + (this.bocalGasto ? 0.9 : 0)
  }

  /** O plasma é CC−, com tensão mais alta que o TIG (arco constrito e mais longo). */
  override get tensaoV(): number { return 20 + 0.4 * Math.max(0, this.distanciaMm) }

  /** Não há contaminação: quem encosta é o bocal, e o arco passa por ele. */
  protected override aoEncostar(eventos?: (e: EventoTig) => void): void {
    this.registrarArcoDuplo(eventos)
  }

  private registrarArcoDuplo(eventos?: (e: EventoTig) => void): void {
    this.arcosDuplos++
    this.bocalGasto = true
    eventos?.('arco-duplo')
  }

  /** Keyhole: abre com a seção quente e gás suficiente; cresce parado; fecha atrás se não for grande demais. */
  protected override aposAquecer(dt: number, eventos?: (e: EventoTig) => void): void {
    // O pedal muda entre quadros e fica igual nos subpassos: a rampa só zera quando a corrente volta a subir.
    if (this.pedal < this.pedalVisto - 1e-6) this.rampaS += dt
    else if (this.pedal > this.pedalVisto + 1e-6) this.rampaS = 0
    else if (this.rampaS > 0) this.rampaS += dt
    this.pedalVisto = this.pedal
    // Corrente alta demais para o bocal: arco duplo (conta uma vez por episódio).
    const excesso = this.correnteAtualA > PLASMA.correnteBocalA
    if (excesso && !this.arcoDuploAgora) this.registrarArcoDuplo(eventos)
    this.arcoDuploAgora = excesso

    const relativo = this.temperaturaEm(this.xMm, this.yMm) / this.limiteFuroK
    const gasOk = this.gasLMin >= PLASMA.gasKeyholeMin
    if (!this.keyhole && gasOk && relativo >= PLASMA.abreFracao) {
      this.keyhole = true
      this.aberturasKeyhole++
      this.paradoS = 0
      eventos?.('keyhole')
    } else if (this.keyhole && (!gasOk || relativo < PLASMA.fechaFracao)) {
      this.keyhole = false
    }
    if (!this.keyhole) { this.keyholeMm = 0; return }
    // O jato tem a força da corrente: na rampa de descida o furo encolhe e fecha.
    this.paradoS = this.velocidadeMmS < PLASMA.velocidadeMinMmS ? this.paradoS + dt * this.pedal : Math.max(0, this.paradoS - 2 * dt)
    this.keyholeMm = this.pedal * (PLASMA.furoBaseMm + PLASMA.furoPorGasMm * this.gasLMin + (this.bocalGasto ? 0.5 : 0)) + PLASMA.furoParadoMmS * this.paradoS
    const i = Math.round(this.xMm - 0.5)
    if (i >= 0 && i < this.passante.length) this.passante[i] = 1
  }

  /** O furo só fica quando o keyhole cresce além do que a poça consegue fechar (ou a poça fica larga demais). */
  protected override conferirFuro(eventos?: (e: EventoTig) => void): void {
    if (this.estado !== 'arco') return
    const grande = this.keyhole && this.keyholeMm > furoQueFechaMm(this.peca.espessuraMm)
    const larga = 2 * this.raioPocaMm > 3.5 * this.peca.espessuraMm + 3
    if (!grande && !larga) return
    this.marcarFuro(eventos)
  }

  private marcarFuro(eventos?: (e: EventoTig) => void): void {
    if (this.furos.some((f) => Math.abs(f.xMm - this.xMm) < 4)) return
    this.furos.push({ xMm: this.xMm, yMm: this.yMm })
    eventos?.('furo')
  }

  /** Fim do arco: com o keyhole aberto, só a rampa de descida deixa o furo fechar. */
  protected override aoApagar(cortouDeVez: boolean, eventos?: (e: EventoTig) => void): void {
    if (this.keyhole) {
      const fechou = !cortouDeVez && this.rampaS >= PLASMA.rampaFechaS
      if (!fechou) this.marcarFuro(eventos)
      this.keyhole = false
      this.keyholeMm = 0
      this.rampaS = 0
      return
    }
    this.rampaS = 0
    super.aoApagar(cortouDeVez, eventos)
  }

  /** Penetração total na seção x (o keyhole passou por ali). */
  passouEm(x: number): boolean {
    const i = Math.round(x - 0.5)
    return i >= 0 && i < this.passante.length && this.passante[i] === 1
  }

  /** Trocar o bocal (com o arco apagado): volta a coluna estreita. */
  trocarBocal(): boolean {
    if (this.estado === 'arco') return false
    this.bocalGasto = false
    return true
  }
}
