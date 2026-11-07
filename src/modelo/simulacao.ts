import { avaliar, type Tentativa } from './avaliacao'
import { Cordao } from './cordao'
import { efeitoPosicao, gravidade, gravidadeTubo, juntaDe, POSICAO_PLANA, type GravidadeJunta, type PosicaoPeca } from './juntas'
import type { GravidadePoca } from './cordao'
import { MATERIAIS } from './material'
import { analisarMovimento } from './movimento'
import { EQUILIBRIO, MODELO, PECA, PICO_FUSAO, TRAJETORIA } from './parametros'
import { registrarPicosFusao } from './fusao'
import { Percurso } from './percurso'
import {
  AJUSTES_PADRAO,
  CONTEXTO_PADRAO,
  equilibrioArco,
  EFEITO_TRANSFERENCIA,
  modoTransferencia,
  espalhamentoDoMovimento,
  limitarAjustes,
  potenciaRelativa,
  razaoEfetiva,
  taxaDeposicao,
  type Ajustes,
  type ContextoProcesso,
} from './processo'
import { inicioDoDeslocamento, type Amostra } from './trajetoria'
import { EstimadorVelocidade, type Velocidades } from './velocidade'

/** Ponto da trajetória gravado enquanto o arco está aberto (para análise posterior). */
export interface PontoRegistro {
  t: number
  x: number
  y: number
  /** Tempo de arco acumulado até este ponto. */
  tempoArcoMs: number
  /** Ajustes da máquina usados neste trecho. */
  ajustes: Ajustes
}

/**
 * Registro mínimo para reproduzir uma tentativa (replay): as leituras com o
 * arco aberto, as aberturas e fechamentos, e as trocas de ajuste.
 */
export type EventoTentativa =
  | { tipo: 'inicio' | 'mover' | 'fim'; t: number; x: number; y: number }
  | { tipo: 'ajustes'; ajustes: Ajustes }
  /** Peça tombada/girada (H47); gravado ao abrir o arco, se mudou. */
  | { tipo: 'posicao'; rolagemGraus: number; giroGraus: number }

export interface EstadoTocha {
  arcoAberto: boolean
  /** A tentativa foi avaliada e não aceita mais solda (H19). */
  tentativaEncerrada: boolean
  ajustes: Ajustes
  posicao: { x: number; y: number } | null
  sobreAPeca: boolean
  velocidades: Velocidades
  tempoArcoMs: number
  /** Aquecimento acumulado da peça (H32), relativo. */
  aquecimento: number
}

/**
 * H44: instabilidade do arco com estes ajustes, de −1 (curto demais) a 1
 * (longo demais); zero dentro da tolerância do equilíbrio (H10).
 */
export function instabilidadeArco(a: Ajustes, ctx: ContextoProcesso): number {
  const { desvio } = equilibrioArco(a, ctx)
  const excesso = Math.max(0, Math.abs(desvio) - EQUILIBRIO.tolerancia)
  // H93 (v2.0): satura com 2 pontos de botão (~3,6 V) fora da tolerância (era 3): o desequilíbrio aparece mais cedo.
  const doEquilibrio = excesso === 0 ? 0 : Math.sign(desvio) * Math.min(1, excesso / 2)
  // H93: o globular é instável mesmo com o arco no equilíbrio.
  const base = EFEITO_TRANSFERENCIA[modoTransferencia(a, ctx)].instabilidade
  // Dentro da tolerância e sem base é exatamente 0 (nunca −0).
  if (base === 0 || Math.abs(doEquilibrio) >= base) return doEquilibrio
  return doEquilibrio < 0 ? -base : base
}

/**
 * H93: fator do calor que funde a junta: o modo de transferência (o spray
 * concentra o calor e penetra mais; a potência U·I já conta o resto) e o arco curto, em que o arame "afoga" na poça e o metal
 * deita sobre a chapa sem fundir as bordas (colagem).
 */
export function fatorFusaoAjustes(a: Ajustes, ctx: ContextoProcesso): number {
  const instab = instabilidadeArco(a, ctx)
  return EFEITO_TRANSFERENCIA[modoTransferencia(a, ctx)].calor * (1 - 0.35 * Math.max(0, -instab))
}

/** H100: com a tensão abaixo do limite o gatilho solta arame, mas o arco não se forma (sem luz, som nem metal). */
export function semArco(sim: { readonly ajustes: Ajustes; readonly contexto: ContextoProcesso }): boolean {
  return modoTransferencia(sim.ajustes, sim.contexto) === 'sem-arco'
}

/** Gravidade nos eixos da poça (H50), com o mesmo sentido de avanço de efeitoPosicao (H47). */
export function gravidadePoca(g: GravidadeJunta, sentido: number): GravidadePoca {
  return { cabeca: Math.max(0, g.w), lado: g.n, descida: g.t * Math.sign(sentido) }
}

export function sobreAPeca(x: number, y: number): boolean {
  return x >= 0 && x <= PECA.comprimentoMm && Math.abs(y) <= PECA.larguraChapaMm
}

/**
 * Núcleo da simulação. Não conhece canvas, DOM nem mouse: recebe leituras
 * { t, x, y } e devolve o estado. Por isso pode ser testada sem navegador.
 *
 * Ideia central: enquanto o arco está aberto, a tocha deposita metal a uma
 * taxa constante no tempo, proporcional à alimentação do arame (H1). O metal
 * cai onde a tocha está. Se ela anda devagar, o mesmo volume se acumula em
 * menos comprimento → cordão mais largo. A tensão muda só a forma (H9).
 */
/** Cordão na forma da junta do contexto (H46). */
function novoCordao(ctx: ContextoProcesso): Cordao {
  const junta = juntaDe(ctx)
  // Também no topo reto: o metal enche a fresta antes de virar reforço (v1.3).
  return new Cordao(undefined, undefined, undefined, { junta, dimensoes: { espessuraMm: ctx.espessuraMm, aberturaMm: ctx.aberturaMm } })
}

export class Simulacao {
  cordao: Cordao
  /** Tudo o que é preciso para reproduzir a tentativa. */
  eventos: EventoTentativa[] = []
  /** Tempo de arco por posição da junta (H20). */
  percurso = new Percurso()
  registro: PontoRegistro[] = []
  private ajustesAtuais: Ajustes = AJUSTES_PADRAO
  private readonly estimador = new EstimadorVelocidade()
  private ultima: Amostra | null = null
  private arco = false
  /** Até que instante o depósito já foi calculado. */
  private tConsolidado = 0
  private tempoArcoMs = 0
  private aberturasDeArco = 0
  private encerrada = false
  private tempoPausadoMs = 0
  private inicioPausaMs: number | null = null

  /** H49: congela o tempo de processo, inclusive o resfriamento. */
  pausar(agoraMs: number): void {
    if (this.inicioPausaMs !== null) return
    this.interromperArco()
    this.inicioPausaMs = agoraMs
  }

  retomar(agoraMs: number): void {
    if (this.inicioPausaMs === null) return
    this.tempoPausadoMs += Math.max(0, agoraMs - this.inicioPausaMs)
    this.inicioPausaMs = null
  }

  instanteDeProcesso(t: number): number {
    return (this.inicioPausaMs ?? t) - this.tempoPausadoMs
  }
  /** Aquecimento acumulado T (H32) e o instante a que ele se refere. */
  private aquecimento = 0
  private tAquecimento: number | null = null
  /** H101: próximo instante (tempo de arco) em que o pico de fusão perto da tocha é registrado. */
  private proximoPicoMs: number = PICO_FUSAO.intervaloMs
  /** Posição da peça (H47): a atual e a última gravada nos eventos. */
  private posicaoAtual: PosicaoPeca
  private posicaoGravada: PosicaoPeca
  private gravidadeAtual: GravidadeJunta

  constructor(readonly contexto: ContextoProcesso = CONTEXTO_PADRAO) {
    this.cordao = novoCordao(contexto)
    this.eventos.push({ tipo: 'ajustes', ajustes: this.ajustesAtuais })
    this.posicaoAtual = this.posicaoGravada = { ...(contexto.posicaoInicial ?? POSICAO_PLANA) }
    this.gravidadeAtual = gravidade(this.posicaoAtual)
  }

  /** Gravidade nos eixos da junta no ponto x (H47; no tubo, muda em volta, H103). */
  gravidadeEm(xMm: number): GravidadeJunta {
    const tubo = this.contexto.tubo
    return tubo ? gravidadeTubo(this.posicaoAtual, xMm, tubo.diametroMm, PECA.comprimentoMm / 2) : this.gravidadeAtual
  }

  get posicao(): PosicaoPeca {
    return this.posicaoAtual
  }

  /**
   * Tomba/gira a peça (H47). Recusado com o arco aberto (a peça não se mexe
   * durante o passe) ou com a peça presa na estrutura; devolve se aceitou.
   */
  definirPosicao(p: PosicaoPeca): boolean {
    if (this.arco || this.contexto.posicaoFixa) return false
    this.posicaoAtual = { rolagemGraus: p.rolagemGraus, giroGraus: p.giroGraus }
    this.gravidadeAtual = gravidade(this.posicaoAtual)
    return true
  }

  get arcoAberto(): boolean {
    return this.arco
  }

  get ajustes(): Ajustes {
    return this.ajustesAtuais
  }

  get tentativaEncerrada(): boolean {
    return this.encerrada
  }

  /** Tempo total com o arco aberto (ms), consolidado. */
  get tempoDeArcoMs(): number {
    return this.tempoArcoMs
  }

  /** Muda tensão/alimentação. Recusado com o arco aberto (H12); devolve se aceitou. */
  definirAjustes(a: Ajustes): boolean {
    if (this.arco) return false
    this.ajustesAtuais = limitarAjustes(a)
    this.eventos.push({ tipo: 'ajustes', ajustes: this.ajustesAtuais })
    return true
  }

  /** Nova leitura de posição (com ou sem arco). */
  moverTocha(a: Amostra): void {
    if (this.inicioPausaMs !== null) return
    a = { ...a, t: this.instanteDeProcesso(a.t) }
    if (this.arco && this.ultima) this.integrarAte(a)
    this.ultima = a
    this.estimador.adicionar(a)
    if (this.arco) {
      this.registrar(a)
      this.eventos.push({ tipo: 'mover', t: a.t, x: a.x, y: a.y })
    }
  }

  iniciarArco(a: Amostra): void {
    if (this.inicioPausaMs !== null) return
    if (this.arco || this.encerrada) {
      this.moverTocha(a)
      return
    }
    this.moverTocha(a)
    a = { ...a, t: this.instanteDeProcesso(a.t) }
    // A posição só importa com o arco aberto: grava quando muda, antes do início.
    const p = this.posicaoAtual
    if (p.rolagemGraus !== this.posicaoGravada.rolagemGraus || p.giroGraus !== this.posicaoGravada.giroGraus) {
      this.eventos.push({ tipo: 'posicao', rolagemGraus: p.rolagemGraus, giroGraus: p.giroGraus })
      this.posicaoGravada = p
    }
    this.arco = true
    this.aberturasDeArco++
    this.tConsolidado = a.t
    this.esfriarAte(a.t)
    this.registrar(a)
    this.eventos.push({ tipo: 'inicio', t: a.t, x: a.x, y: a.y })
  }

  encerrarArco(a: Amostra): void {
    if (!this.arco) return
    this.moverTocha(a)
    a = { ...a, t: this.instanteDeProcesso(a.t) }
    // O 'mover' acima já registrou a posição final; 'fim' só fecha o arco.
    this.eventos.push({ tipo: 'fim', t: a.t, x: a.x, y: a.y })
    // H101: o estado no fim do passe também conta como pico.
    registrarPicosFusao(this.cordao, this.percurso, this.contexto, a.x, PICO_FUSAO.raioMm)
    this.arco = false
  }

  /**
   * Fecha o arco SEM consolidar o tempo que passou desde a última leitura
   * consolidada (H49): pausa, perda de foco ou janela escondida. Fechar com
   * encerrarArco(agora) depositaria, de uma vez, todo o tempo parado da
   * pausa como se a tocha tivesse ficado ali soldando.
   */
  interromperArco(): void {
    if (!this.arco || !this.ultima) return
    const p = this.ultima
    this.encerrarArco({ t: Math.max(this.tConsolidado, p.t) + this.tempoPausadoMs, x: p.x, y: p.y })
  }

  /**
   * Chamado a cada quadro com o relógio atual. Se o mouse não mandou leituras,
   * a tocha está parada e continua depositando no mesmo lugar.
   *
   * Só consolidamos até (agora − duração máxima de deslocamento): uma leitura
   * que ainda vai chegar não pode mudar o que já foi calculado. Assim o
   * resultado é o mesmo com qualquer taxa de quadros.
   */
  avancarTempo(agoraMs: number): void {
    if (!this.arco || !this.ultima) return
    if (this.inicioPausaMs !== null) return
    const limite = this.instanteDeProcesso(agoraMs) - TRAJETORIA.duracaoMaxDeslocamentoMs
    if (limite > this.tConsolidado) {
      this.depositarParado(this.ultima, this.tConsolidado, limite)
      this.tConsolidado = limite
    }
  }

  estado(agoraMs: number): EstadoTocha {
    const p = this.ultima
    return {
      arcoAberto: this.arco,
      tentativaEncerrada: this.encerrada,
      ajustes: this.ajustesAtuais,
      posicao: p ? { x: p.x, y: p.y } : null,
      sobreAPeca: p ? sobreAPeca(p.x, p.y) : false,
      velocidades: this.estimador.medir(this.instanteDeProcesso(agoraMs)),
      tempoArcoMs: this.tempoArcoMs,
      aquecimento: this.aquecimento,
    }
  }

  /**
   * Encerra e avalia a tentativa (H19). Só com o arco fechado; devolve null
   * se o arco estiver aberto. Depois disso, nada mais é depositado até
   * reiniciar().
   */
  finalizar(): Tentativa | null {
    if (this.arco) return null
    this.encerrada = true
    const ajustesUsados: Ajustes[] = []
    for (const p of this.registro) {
      const ultimo = ajustesUsados[ajustesUsados.length - 1]
      if (!ultimo || ultimo.alimentacao !== p.ajustes.alimentacao || ultimo.tensao !== p.ajustes.tensao) {
        ajustesUsados.push(p.ajustes)
      }
    }
    const avaliacao = avaliar(this.cordao)
    return {
      avaliacao,
      contexto: this.contexto,
      movimento: analisarMovimento(this.percurso, avaliacao),
      ajustesUsados,
      tempoArcoMs: this.tempoArcoMs,
      aberturasDeArco: this.aberturasDeArco,
    }
  }

  /** Nova tentativa: chapa limpa. A posição da tocha e os ajustes são mantidos. */
  reiniciar(): void {
    this.cordao = novoCordao(this.contexto)
    this.percurso = new Percurso()
    this.registro = []
    this.eventos = [{ tipo: 'ajustes', ajustes: this.ajustesAtuais }]
    // O registro novo começa da posição de entrega: a atual, se for outra, é gravada no próximo arco.
    this.posicaoGravada = { ...(this.contexto.posicaoInicial ?? POSICAO_PLANA) }
    this.aquecimento = 0
    this.tAquecimento = null
    this.arco = false
    this.encerrada = false
    this.aberturasDeArco = 0
    this.tempoArcoMs = 0
    this.proximoPicoMs = PICO_FUSAO.intervaloMs
    this.estimador.limpar()
    if (this.ultima) this.estimador.adicionar(this.ultima)
  }

  private integrarAte(a1: Amostra): void {
    const a0 = this.ultima!
    const tMov = Math.max(inicioDoDeslocamento(a0, a1), this.tConsolidado)
    if (tMov > this.tConsolidado) this.depositarParado(a0, this.tConsolidado, tMov)
    if (a1.t > tMov) this.depositarTrecho(a0, a1, tMov, a1.t)
    this.tConsolidado = Math.max(this.tConsolidado, a1.t)
  }

  /** Com o arco fechado a peça só esfria (H32). */
  private esfriarAte(t: number): void {
    if (this.tAquecimento === null) {
      this.tAquecimento = t
      return
    }
    if (t <= this.tAquecimento) return
    const tau = MATERIAIS[this.contexto.material].tauAquecimentoS
    this.aquecimento *= Math.exp(-(t - this.tAquecimento) / 1000 / tau)
    this.tAquecimento = t
  }

  /**
   * Avança o aquecimento de t0 a t1 com potência constante, de forma EXATA
   * (H32), e devolve ∫(1 + e·T) dt em segundos. Como a solução é exata,
   * dividir o intervalo em pedaços diferentes dá o mesmo resultado.
   */
  private aquecer(t0: number, t1: number, potencia: number): number {
    this.esfriarAte(t0)
    const m = MATERIAIS[this.contexto.material]
    const dt = (t1 - t0) / 1000
    const final = m.ganhoAquecimento * potencia
    const decaimento = Math.exp(-dt / m.tauAquecimentoS)
    const integralT = final * dt + (this.aquecimento - final) * m.tauAquecimentoS * (1 - decaimento)
    this.aquecimento = final + (this.aquecimento - final) * decaimento
    this.tAquecimento = t1
    return dt + m.efeitoAquecimento * integralT
  }

  private depositarParado(p: Amostra, t0: number, t1: number): void {
    this.tempoArcoMs += t1 - t0
    // Arco fora da peça não aquece a peça (H32): ela só esfria.
    if (!sobreAPeca(p.x, p.y)) {
      this.esfriarAte(t1)
      return
    }
    const potencia = potenciaRelativa(this.ajustesAtuais, this.contexto)
    // H93: o modo de transferência e o arco curto mudam quanto do calor funde a junta, não o calor total da peça.
    const fusaoAjustes = fatorFusaoAjustes(this.ajustesAtuais, this.contexto)
    const integral = this.aquecer(t0, t1, potencia)
    const volume = (taxaDeposicao(this.ajustesAtuais, this.contexto) * (t1 - t0)) / 1000
    // H47: parada, só pesa a gravidade de lado e para fora da face (sem subir nem descer).
    const g = this.gravidadeEm(p.x)
    const ef = efeitoPosicao(g, 0)
    const destino = this.cordao.depositar(p.x, p.y + ef.desvioMm, volume, t1, razaoEfetiva(this.ajustesAtuais, this.contexto) * ef.razao, espalhamentoDoMovimento(this.contexto), instabilidadeArco(this.ajustesAtuais, this.contexto), gravidadePoca(g, 0))
    this.registrarCalor(destino, p.x, p.y, t1 - t0, (potencia * (t1 - t0)) / 1000, potencia * integral * ef.fusao * fusaoAjustes)
    this.picoSePreciso(p.x)
  }

  /** H101: calor no depósito atingido; tempo e eficiência continuam registrados na junta. */
  private registrarCalor(destino: Cordao, x: number, y: number, dt: number, bruto: number, efetivo: number): void {
    this.percurso.registrar(x, y, dt, destino.solto ? 0 : bruto, destino.solto ? 0 : efetivo)
    if (destino.solto) destino.termico.registrar(x, y, dt, bruto, efetivo)
  }

  /** H101: a cada intervalo de tempo de arco, guarda o índice de fusão perto da tocha. */
  private picoSePreciso(xMm: number): void {
    if (this.tempoArcoMs < this.proximoPicoMs) return
    registrarPicosFusao(this.cordao, this.percurso, this.contexto, xMm, PICO_FUSAO.raioMm)
    for (const solto of this.cordao.soltos) registrarPicosFusao(solto, solto.termico, { ...this.contexto, junta: 'topo', aberturaMm: 0 }, xMm, PICO_FUSAO.raioMm)
    this.proximoPicoMs = (Math.floor(this.tempoArcoMs / PICO_FUSAO.intervaloMs) + 1) * PICO_FUSAO.intervaloMs
  }

  /** Divide o trecho em pedaços curtos e deposita um pouco em cada um. */
  private depositarTrecho(p0: Amostra, p1: Amostra, t0: number, t1: number): void {
    this.tempoArcoMs += t1 - t0
    const n = Math.max(1, Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y) / MODELO.subdivisaoMaxMm))
    const dt = (t1 - t0) / n
    const volume = (taxaDeposicao(this.ajustesAtuais, this.contexto) * dt) / 1000
    // H47: a gravidade depende de a tocha estar subindo ou descendo ao longo da junta.
    // H103: no tubo a gravidade muda em volta; o trecho é curto (um quadro), vale a do meio.
    const g = this.gravidadeEm((p0.x + p1.x) / 2)
    const ef = efeitoPosicao(g, p1.x - p0.x)
    const razao = razaoEfetiva(this.ajustesAtuais, this.contexto) * ef.razao
    const potencia = potenciaRelativa(this.ajustesAtuais, this.contexto)
    // H93: o modo de transferência e o arco curto mudam quanto do calor funde a junta, não o calor total da peça.
    const fusaoAjustes = fatorFusaoAjustes(this.ajustesAtuais, this.contexto)
    const sigma = espalhamentoDoMovimento(this.contexto)
    const instab = instabilidadeArco(this.ajustesAtuais, this.contexto)
    const gp = gravidadePoca(g, p1.x - p0.x)
    for (let j = 0; j < n; j++) {
      const f = (j + 0.5) / n
      const x = p0.x + (p1.x - p0.x) * f
      const y = p0.y + (p1.y - p0.y) * f
      if (!sobreAPeca(x, y)) {
        this.esfriarAte(t0 + (j + 1) * dt)
        continue
      }
      const integral = this.aquecer(t0 + j * dt, t0 + (j + 1) * dt, potencia)
      const destino = this.cordao.depositar(x, y + ef.desvioMm, volume, t0 + (j + 1) * dt, razao, sigma, instab, gp)
      this.registrarCalor(destino, x, y, dt, (potencia * dt) / 1000, potencia * integral * ef.fusao * fusaoAjustes)
    }
    this.picoSePreciso(p1.x)
  }

  private registrar(a: Amostra): void {
    this.registro.push({ t: a.t, x: a.x, y: a.y, tempoArcoMs: this.tempoArcoMs, ajustes: this.ajustesAtuais })
  }
}
