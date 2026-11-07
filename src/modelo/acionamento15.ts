/** H59–H62: protótipo de interação, sem calibração de processo ou pontuação. */
export type Processo15 = 'mig' | 'eletrodo'
import { Escoria15 } from './escoria15'
export type EstadoArco15 = 'desligado' | 'pronto' | 'contato' | 'arco' | 'afastado' | 'fim' | 'grudado'
/**
 * H91 (v1.9): a vareta queima a 1,5 mm/s na corrente de referência (era 3), para o
 * jogador conseguir avançar com o mouse e descer com S ao mesmo tempo, sem ajuda.
 */
export const VARETA15 = { inicialMm: 120, reservaMm: 25, consumoMmS: 1.5, contatoMm: 0.35, arcoMaxMm: 5 }
const PASSO = 1 / 120
/** H68: ponta deslizando acima desta velocidade conta como "riscar" a abertura. */
export const RISCO15 = { velocidadeMmS: 8, fatorAderencia: 0.25 }
export type FaixaArco15 = 'curto' | 'adequado' | 'longo'
/**
 * H71: arco esticado e reacendimento a quente. Passar do limite não apaga na
 * hora: até `esticadoFator` × limite o arco aguenta `esticadoS`; com a ponta
 * ainda quente (até `quenteS` depois de apagar) ele reacende sem novo toque.
 */
export const ARCO15 = { esticadoFator: 1.5, esticadoS: 0.35, quenteS: 1.5, aberturaToque: 0.8 }
/** H72: altura por teclas com rampa — toque curto move pouco, segurar acelera. */
export function velocidadeAltura15(seguradoS: number, maximaMmS: number): number {
  if (!(seguradoS > 0) || !(maximaMmS > 0)) return 0
  const minima = Math.min(2, maximaMmS)
  return minima + (maximaMmS - minima) * Math.min(1, seguradoS / 0.5)
}
/**
 * H74 (v1.6) somava o consumo da vareta à descida enquanto S estava apertado.
 * H91 (v1.9): sem essa ajuda. A descida é só a do jogador (mesma rampa de W); quem
 * acompanha o consumo é a mão, com toques em S. Os parâmetros antigos ficaram para
 * não mudar quem chama.
 */
export function velocidadeDescida15(seguradoS: number, maximaMmS: number, _consumoMmS: number, _assistencia: number, _cosInclinado: number, _arcoAberto: boolean): number {
  if (!(seguradoS > 0)) return 0
  // Teto de 6 mm/s: segurando S a mão sempre ganha da queima, mesmo a 180 A (~3,8 mm/s).
  return velocidadeAltura15(seguradoS, Math.max(6, maximaMmS))
}
/** H69: forma do depósito pelo comprimento do arco (razão altura/largura e instabilidade). */
export interface FormaDeposito15 {
  razao: number
  instabilidade: number
  /** Energia do arco neste passo (J, já com o rendimento térmico, H82). Só a análise usa. */
  energiaJ?: number
  /** Duração do passo (s) e tempo de arco acumulado no fim dele (s). */
  dtS?: number
  tempoArcoS?: number
  /** Comprimento do arco em diâmetros da alma (H69). */
  razaoArco?: number
}
/**
 * Metal depositado ÷ volume da alma consumida e, para a análise do calor
 * (H82), rendimento térmico do arco: a fração da energia que entra na peça.
 */
export const RENDIMENTO15 = {
  /**
   * H91 (v1.9): metal depositado por volume de alma queimada (era 0,7). Inclui o pó de
   * ferro do revestimento e a escala do jogo: a vareta queima mais devagar que a real,
   * mas o metal por segundo (≈ 21 mm³/s com Ø 2,5 a 90 A) fica perto do de um eletrodo real.
   */
  deposicao: 2.8,
  termico: 0.8,
}

export class Acionamento15 {
  pressionado = false
  naPeca = true
  /** H76: largura efetivamente soldável no domínio longitudinal da bancada. */
  limitesX = { min: 0, max: 150 }
  restanteMm = VARETA15.inicialMm
  alturaMm: number
  tempoArcoS = 0
  volumeMm3 = 0
  trocas = 0
  correnteA = 90
  diametroMm = 2.5
  azimuteGraus = 0
  inclinacaoGraus = 0
  rolamentoGraus = 0
  xMm = 75
  yMm = 0
  energiaJ = 0
  grudadas = 0
  grudado = false
  /** H70: modo assistido total. Desce o porta-eletrodo na mesma taxa do consumo; o arco não muda sozinho. */
  compensar = false
  /**
   * H70: ajuda parcial (0–1): fração do consumo que a bancada compensa. Com 0,8
   * o arco cresce devagar e o jogador corrige com toques; 0 é o eletrodo real.
   */
  assistencia = 0
  /** Avanço da ponta sobre a chapa, suavizado (mm/s). Só leitura. */
  velocidadeMmS = 0
  /** Contador sintético de respingos (H69). */
  respingos = 0
  /** H72: a bancada abre o arco ao tocar a peça (sem botão); quem empurra contra a chapa ainda gruda. */
  abrirAoTocar = false
  /** Tempo de arco em cada faixa de comprimento (H69). */
  readonly tempoFaixaS: Record<FaixaArco15, number> = { curto: 0, adequado: 0, longo: 0 }
  /**
   * Altura (mm) da superfície da peça a um desvio lateral n da junta. Na chapa
   * plana é 0; no filete na posição plana as paredes sobem a 45°. A distância
   * do arco é medida até ela, não até o plano da raiz.
   */
  superficie: (n: number) => number = () => 0
  readonly escoria = new Escoria15()
  private tempoContato = 0
  private contato = false
  private fracao = 0
  private xAntes = this.xMm
  private yAntes = this.yMm
  private riscando = false
  private esticadoS = 0
  private desdeArcoS = Infinity

  constructor(readonly processo: Processo15) {
    this.alturaMm = processo === 'eletrodo' ? this.restanteMm + 10 : 15
  }

  get cosInclinado(): number { return Math.cos(this.inclinacaoGraus * Math.PI / 180) }
  get distanciaMm(): number { return this.alturaMm - (this.processo === 'eletrodo' ? this.restanteMm * this.cosInclinado : 0) - this.superficie(this.yMm) }
  get correnteRelativa(): number { return this.correnteA / (36 * this.diametroMm) }
  get consumoMmS(): number { return VARETA15.consumoMmS * this.correnteRelativa ** 1.35 }
  get tensaoV(): number { return this.estado === 'arco' ? 20 + 2 * this.distanciaMm : 0 }
  /** Maior distância com arco sustentado (H60). */
  get arcoMaxMm(): number { return this.processo === 'mig' ? 25 : Math.min(VARETA15.arcoMaxMm, this.diametroMm * 2) }
  /** Comprimento do arco em diâmetros da alma: a regra prática é ficar perto de 1 (H69). */
  get razaoArco(): number { return this.distanciaMm / this.diametroMm }
  get faixaArco(): FaixaArco15 | null {
    if (this.processo !== 'eletrodo' || this.estado !== 'arco') return null
    const r = this.razaoArco
    return r < 0.5 ? 'curto' : r <= 1.3 ? 'adequado' : 'longo'
  }
  /** Arco além do limite, prestes a apagar (H71). */
  get esticado(): boolean { return this.processo === 'eletrodo' && this.estado === 'arco' && this.distanciaMm > this.arcoMaxMm }
  /** Ponta ainda quente: reacende sem novo toque (H71). */
  get pontaQuente(): boolean { return this.desdeArcoS < ARCO15.quenteS }
  /** H69: arco curto deixa o cordão mais alto e estreito; arco longo, mais baixo, largo e irregular. */
  get forma(): FormaDeposito15 {
    const r = this.razaoArco
    return {
      razao: Math.max(0.16, Math.min(0.34, 0.25 + 0.09 * (1 - r))),
      instabilidade: Math.max(0, Math.min(1, (r - 1.1) / 0.8)),
    }
  }

  regular(corrente: number, diametro = this.diametroMm): void {
    if (this.pressionado || !Number.isFinite(corrente)) return
    this.correnteA = Math.max(40, Math.min(180, corrente))
    this.diametroMm = diametro === 3.2 ? 3.2 : 2.5
  }

  orientar(azimute: number, inclinacao: number, rolamento: number): void {
    if (this.grudado || ![azimute, inclinacao, rolamento].every(Number.isFinite)) return
    const distancia = this.distanciaMm
    this.azimuteGraus = ((azimute % 360) + 360) % 360
    this.inclinacaoGraus = Math.max(0, Math.min(85, inclinacao))
    this.rolamentoGraus = ((rolamento % 360) + 360) % 360
    this.definirDistancia(distancia)
  }

  desgrudar(): boolean {
    if (!this.grudado || this.pressionado) return false
    this.grudado = false
    this.tempoContato = 0
    this.contato = false
    this.definirDistancia(3)
    return true
  }

  definirDistancia(mm: number): void {
    if (!Number.isFinite(mm) || this.grudado) return
    this.alturaMm = (this.processo === 'eletrodo' ? this.restanteMm * this.cosInclinado : 0) + this.superficie(this.yMm) + Math.max(0, Math.min(35, mm))
  }

  get estado(): EstadoArco15 {
    if (this.grudado) return 'grudado'
    if (this.processo === 'eletrodo' && this.restanteMm <= VARETA15.reservaMm + 1e-8) return 'fim'
    if (!this.pressionado) return 'desligado'
    if (!this.naPeca) return 'afastado'
    if (this.processo === 'mig') return this.distanciaMm >= 5 && this.distanciaMm <= 25 ? 'arco' : 'afastado'
    if (this.distanciaMm <= VARETA15.contatoMm) return 'contato'
    const max = this.arcoMaxMm, d = this.distanciaMm
    const sustenta = d <= max || (d <= max * ARCO15.esticadoFator && this.esticadoS < ARCO15.esticadoS)
    // Arco esticado só se mantém aceso; reacender a quente exige voltar para dentro do limite.
    if (this.correnteRelativa >= 0.55 && ((this.contato && sustenta) || (this.pontaQuente && d <= max))) return 'arco'
    return 'pronto'
  }

  /** Passo fixo: consumo e tempo de arco não dependem da taxa de quadros. */
  avancar(segundos: number, velocidadeAlturaMmS = 0, depositar?: (volumeMm3: number, forma?: FormaDeposito15) => void): void {
    if (!Number.isFinite(segundos) || segundos <= 0 || !Number.isFinite(velocidadeAlturaMmS)) return
    // Velocidade da ponta entre chamadas: avanço do cordão e "riscar" para abrir (H68).
    const instantanea = Math.hypot(this.xMm - this.xAntes, this.yMm - this.yAntes) / segundos
    this.riscando = instantanea > RISCO15.velocidadeMmS
    this.velocidadeMmS += (instantanea - this.velocidadeMmS) * Math.min(1, segundos / 0.3)
    this.fracao += segundos
    while (this.fracao + 1e-12 >= PASSO) {
      this.fracao -= PASSO
      this.escoria.esfriar(PASSO)
      this.definirDistancia(this.distanciaMm + velocidadeAlturaMmS * PASSO)
      if (this.processo === 'eletrodo' && this.pressionado && this.naPeca && this.distanciaMm <= VARETA15.contatoMm && this.estado !== 'fim') {
        this.tempoContato += PASSO * (this.riscando ? RISCO15.fatorAderencia : 1)
        if (!this.grudado && this.tempoContato >= (this.correnteRelativa < 0.65 ? 0.15 : 0.65)) {
          this.grudado = true
          this.grudadas++
        } else if (!this.grudado && this.abrirAoTocar && !this.contato && this.correnteRelativa >= 0.55) {
          // H72: o primeiro toque abre o arco (a ponta recua até um arco curto). Empurrar
          // de novo contra a poça com o arco aberto é curto-circuito e conta para grudar.
          this.contato = true
          this.tempoContato = 0
          this.definirDistancia(Math.max(VARETA15.contatoMm + 0.05, ARCO15.aberturaToque * this.diametroMm))
        } else if (!this.grudado && this.abrirAoTocar && this.contato && velocidadeAlturaMmS >= 0) {
          // H72: curto breve com o arco já aberto. Sem empurrar, a ponta queima de volta e o arco volta sozinho.
          this.restanteMm = Math.max(VARETA15.reservaMm, this.restanteMm - this.consumoMmS * PASSO)
        }
      } else this.tempoContato = 0
      if (!this.pressionado || !this.naPeca) this.contato = false
      else if (this.processo === 'eletrodo' && this.distanciaMm <= VARETA15.contatoMm) this.contato = true
      else if (this.processo === 'eletrodo' && this.distanciaMm > this.arcoMaxMm * ARCO15.esticadoFator) this.contato = false
      if (this.processo === 'eletrodo') {
        this.esticadoS = this.estado === 'arco' && this.distanciaMm > this.arcoMaxMm ? this.esticadoS + PASSO : 0
        if (this.esticadoS >= ARCO15.esticadoS) this.contato = false
      }
      if (this.estado !== 'arco') {
        this.desdeArcoS += PASSO
        continue
      }
      this.desdeArcoS = 0
      const faixa = this.faixaArco
      if (faixa) this.tempoFaixaS[faixa] += PASSO
      const tensaoAntes = this.tensaoV
      let dt = PASSO
      if (this.processo === 'eletrodo') {
        dt = Math.min(dt, (this.restanteMm - VARETA15.reservaMm) / this.consumoMmS)
        const gasto = this.consumoMmS * dt
        this.restanteMm = Math.max(VARETA15.reservaMm, this.restanteMm - gasto)
        this.alturaMm -= gasto * this.cosInclinado * (this.compensar ? 1 : Math.max(0, Math.min(1, this.assistencia)))
        const lado = gasto * Math.sin(this.inclinacaoGraus * Math.PI / 180)
        this.xMm += lado * Math.cos(this.azimuteGraus * Math.PI / 180)
        this.yMm += lado * Math.sin(this.azimuteGraus * Math.PI / 180)
        this.naPeca = this.xMm >= this.limitesX.min && this.xMm <= this.limitesX.max && Math.abs(this.yMm) <= 50
      }
      this.tempoArcoS += dt
      // Só traço visual de depósito. Não usa as regras MIG como física SMAW.
      const volume = this.processo === 'mig' ? 64 * dt : Math.PI * (this.diametroMm / 2) ** 2 * this.consumoMmS * RENDIMENTO15.deposicao * dt
      this.volumeMm3 += volume
      if (this.processo === 'eletrodo') {
        const forma = this.forma
        this.energiaJ += this.correnteA * tensaoAntes * dt
        this.respingos += (0.5 + 20 * forma.instabilidade) * dt
        // A escória cobre a largura do cordão, não só o ponto da ponta.
        this.escoria.depositar(this.xMm, this.yMm, volume, 1.5 * this.diametroMm)
        depositar?.(volume, { ...forma, energiaJ: RENDIMENTO15.termico * this.correnteA * tensaoAntes * dt, dtS: dt, tempoArcoS: this.tempoArcoS, razaoArco: this.razaoArco })
      } else depositar?.(volume)
    }
    this.xAntes = this.xMm
    this.yAntes = this.yMm
  }

  /** Desenergiza: a ponta deixa de contar como quente para reacender (H71). */
  soltar(): void { this.pressionado = false; this.contato = false; this.desdeArcoS = Infinity; this.esticadoS = 0 }

  /** Reposiciona a ponta sem contar como deslocamento (troca de vareta, novo ensaio). */
  posicionar(x: number, y: number): void {
    this.xMm = this.xAntes = x
    this.yMm = this.yAntes = y
  }

  trocarVareta(): boolean {
    if (this.processo !== 'eletrodo' || this.pressionado || this.grudado) return false
    this.restanteMm = VARETA15.inicialMm
    this.alturaMm = this.restanteMm * this.cosInclinado + this.superficie(this.yMm) + 10
    this.contato = false
    this.trocas++
    return true
  }
}
