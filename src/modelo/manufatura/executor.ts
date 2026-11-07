import { copiaPose, distancia, foraDoAlcance, inclinacaoTocha, LIMITES, normalizarAngulo, POSE_ZERO, SUBSTRATO, type Pose, type PontoEnsinado } from './celula'
import { massaArameG, sinergia, vazaoDeposito, type Condicoes } from './condicoes'
import { Deposito, FOLGA, type DefeitoDeposito } from './deposicao'
import { nomePonto, nomeVariavel, FAIXAS, type Alvo, type Instrucao, type Programa, type Valor, type Variavel } from './inform'
import { Termico } from './termico'

/*
 * Executor do job (H106). Máquina de estados com passo FIXO de 10 ms: o
 * resultado não depende da taxa de quadros nem do multiplicador de
 * velocidade da tela, só do programa, dos pontos e das condições. A pausa
 * congela tudo (é pausa da simulação: na célula real, o HOLD apaga o arco);
 * parar fecha o arco na hora, sem preencher a cratera.
 *
 * Cinemática (H106-a): não há modelo do MA1440. MOVL leva o TCP em linha
 * reta na velocidade V. MOVJ é APROXIMADO: o caminho sai da reta (um arco
 * ilustrativo) e o tempo vem de VJ × uma velocidade equivalente do
 * simulador. Isso ensina que o MOVJ não é reto, não reproduz o robô real.
 */

export const PASSO_S = 0.01
/** 100 % de VJ equivale a esta velocidade do TCP (aproximação do simulador). */
export const VJ_EQUIVALENTE_MM_S = 1000
/** Rotação da tocha quando só a orientação muda (VR não implementado). */
export const ROTACAO_GRAUS_S = 60
/** Tempo com o robô parado enquanto o arco abre. */
export const IGNICAO_S = 0.3
/** Na abertura o arame entra devagar (partida suave): fração da alimentação do ASF. */
export const PARTIDA_SUAVE = 0.5
/** Raio do bocal da tocha, para a colisão. */
export const BOCAL_RAIO_MM = 9
/** Mesa sob o substrato. */
export const MESA = { xMin: 520, xMax: 980, yMin: -260, yMax: 260, topoZ: -SUBSTRATO.espessuraMm }

const MAX_PASSOS_POR_CHAMADA = 6000
const INSTRUCOES_POR_PASSO = 500
const MAX_EVENTOS = 400
const MAX_RASTRO = 30000

export interface Celula {
  /** Distância do bico de contato à peça (mm); o TCP fica na ponta do arame. */
  ctwdMm: number
}
export const CELULA_PADRAO: Celula = { ctwdMm: 15 }

export type EstadoExecucao = 'pronto' | 'executando' | 'pausado' | 'concluido' | 'parado' | 'alarme'
export type ModoExecucao = 'teste' | 'fabricar'

export interface Evento {
  tempo: number
  linha: number
  tipo: 'info' | 'aviso' | 'alarme'
  texto: string
}

/** Um trecho com o arco aberto (uma camada, se o programa for bem feito). */
export interface Passe {
  numero: number
  linha: number
  tInicio: number
  tFim: number
  interpasseC: number
  /** Altura do TCP sobre o topo no ARCON: com a parede crescendo, mede se o incremento acompanha. */
  folgaInicialMm: number
  folgaMinMm: number
  folgaMaxMm: number
  folgaMediaMm: number
  zTcpMm: number
  assentoMm: number
  comprimentoMm: number
  inicio: { x: number; y: number }
  fim: { x: number; y: number }
  /** Distância (mm) andada com cada defeito. */
  defeitos: Partial<Record<DefeitoDeposito, number>>
  arameG: number
  energiaKJ: number
  fechamento: 'ARCOF' | 'ARCOF com AEF' | 'END' | 'parada' | 'alarme' | 'aberto'
  inclinacaoMaxGraus: number
}

interface Movimento {
  tipo: 'MOVL' | 'MOVJ'
  de: Pose
  para: Pose
  duracao: number
  t: number
  comprimento: number
}
interface Espera {
  tipo: 'espera'
  resta: number
  motivo: 'timer' | 'ignicao' | 'cratera'
}

export interface ParametrosExecucao {
  programa: Programa
  pontos: PontoEnsinado[]
  condicoes: Condicoes
  celula: Celula
  modo: ModoExecucao
  /** Peça atual: no teste só serve para colisão; na fabricação recebe o metal. */
  deposito: Deposito
  /** Onde a tocha está ao começar. */
  inicio: Pose
}

const valorInteiro = (n: number) => Math.trunc(n)

export class Controlador {
  readonly programa: Programa
  readonly pontos: PontoEnsinado[]
  readonly condicoes: Condicoes
  readonly celula: Celula
  readonly modo: ModoExecucao
  readonly deposito: Deposito
  readonly termico = new Termico()
  estado: EstadoExecucao = 'pronto'
  /** Índice da instrução atual em programa.instrucoes. */
  pc = 0
  tempo = 0
  executadas = 0
  saltosParaTras = 0
  readonly B = new Array<number>(LIMITES.variaveis).fill(0)
  readonly I = new Array<number>(LIMITES.variaveis).fill(0)
  readonly D = new Array<number>(LIMITES.variaveis).fill(0)
  readonly P: Pose[] = Array.from({ length: LIMITES.variaveis }, () => copiaPose(POSE_ZERO))
  deslocamento: Pose | null = null
  pose: Pose
  /** Arco pedido pelo programa (no teste fica inibido: não sai metal). */
  arco = false
  asf = 1
  tArco = 0
  sArco = 0
  readonly eventos: Evento[] = []
  readonly passes: Passe[] = []
  /** Caminho do TCP: x, y, z e 1/0 (arco) a cada amostra. */
  readonly rastro: number[] = []
  arameG = 0
  energiaKJ = 0
  alturaParedeMm = 0
  ultimoDefeito: DefeitoDeposito | null = null
  ultimaFolgaMm: number | null = null
  private atividade: Movimento | Espera | null = null
  private acumulado = 0
  private pararNoFim = false
  private ultimaLarguraMm = 6
  private ultimaSecaoMm2 = 10
  private direcao = { x: 1, y: 0 }
  private avisados = new Set<string>()
  private passe: Passe | null = null
  private amostrasFolga = 0

  constructor(p: ParametrosExecucao) {
    this.programa = p.programa
    this.pontos = p.pontos
    this.condicoes = p.condicoes
    this.celula = p.celula
    this.modo = p.modo
    this.deposito = p.deposito
    this.pose = copiaPose(p.inicio)
    this.amostrar(true)
  }

  /** Linha do editor da instrução atual (para destacar). */
  get linhaAtual(): number | null {
    return this.programa.instrucoes[this.pc]?.linha ?? null
  }

  get emMovimento(): boolean {
    return !!this.atividade
  }

  get arcoAceso(): boolean {
    return this.arco && this.modo === 'fabricar'
  }

  executar(): void {
    if (!this.programa.valido) return
    if (this.estado === 'pronto' || this.estado === 'pausado') { this.pararNoFim = false; this.estado = 'executando' }
  }

  /** Avança uma instrução e pausa no fim dela (movimento inteiro, se for um). */
  passo(): void {
    if (!this.programa.valido) return
    if (this.estado === 'pronto' || this.estado === 'pausado') { this.pararNoFim = true; this.estado = 'executando' }
  }

  pausar(): void {
    if (this.estado === 'executando') this.estado = 'pausado'
  }

  continuar(): void {
    this.executar()
  }

  /** Parada: o arco fecha na hora, sem preencher a cratera. */
  parar(): void {
    if (this.estado === 'concluido' || this.estado === 'parado' || this.estado === 'alarme') return
    this.fecharMovimento()
    if (this.arco) this.fecharArco('parada')
    this.estado = 'parado'
    this.evento('aviso', 'Programa parado pelo operador. O arco foi fechado sem preencher a cratera.')
  }

  /** Avança o tempo real `dt` (s): só passos fixos inteiros. */
  avancar(dt: number): void {
    if (this.estado !== 'executando' || !(dt > 0)) return
    this.acumulado += dt
    let n = 0
    while (this.acumulado >= PASSO_S - 1e-9 && this.estado === 'executando' && n < MAX_PASSOS_POR_CHAMADA) {
      this.acumulado -= PASSO_S
      this.passoFixo()
      n++
    }
    if (n >= MAX_PASSOS_POR_CHAMADA || this.estado !== 'executando') this.acumulado = 0
  }

  /** Roda até o fim (testes e conferência); devolve o estado final. */
  rodarAteOFim(): EstadoExecucao {
    this.executar()
    let guarda = 0
    while (this.estado === 'executando' && guarda++ < LIMITES.tempoSimuladoS / PASSO_S + 10) this.passoFixo()
    return this.estado
  }

  private passoFixo(): void {
    let k = 0
    while (!this.atividade && this.estado === 'executando') {
      if (++k > INSTRUCOES_POR_PASSO) break
      this.executarInstrucao()
    }
    if (this.estado !== 'executando' || !this.atividade) return
    this.tempo += PASSO_S
    if (this.tempo > LIMITES.tempoSimuladoS) return this.alarme(`O programa passou de ${LIMITES.tempoSimuladoS / 60} minutos simulados (limite do simulador).`)
    const potencia = this.arcoAceso ? sinergia(this.alimentacaoAtual(), this.condicoes.inicio[this.asf - 1].correcaoArco).potenciaW : 0
    this.termico.avancar(PASSO_S, potencia, this.alturaParedeMm)
    if (this.atividade.tipo === 'espera') this.avancarEspera(this.atividade)
    else this.avancarMovimento(this.atividade)
    if (this.modo === 'fabricar') this.deposito.escoar(PASSO_S, this.tempo)
  }

  private alimentacaoAtual(): number {
    if (this.atividade?.tipo === 'espera' && this.atividade.motivo === 'cratera') {
      const aef = this.aefPendente
      if (aef) return this.condicoes.fim[aef - 1].alimentacaoMMin
    }
    if (this.atividade?.tipo === 'espera' && this.atividade.motivo === 'ignicao') return PARTIDA_SUAVE * this.condicoes.inicio[this.asf - 1].alimentacaoMMin
    return this.condicoes.inicio[this.asf - 1].alimentacaoMMin
  }

  private aefPendente: number | null = null

  private avancarEspera(e: Espera): void {
    if (this.arcoAceso) this.depositar(0, false)
    if (this.estado !== 'executando') return
    e.resta -= PASSO_S
    if (e.resta > 1e-9) return
    this.atividade = null
    if (e.motivo === 'cratera') this.fecharArco('ARCOF com AEF')
    this.concluirInstrucao()
  }

  private avancarMovimento(m: Movimento): void {
    m.t += PASSO_S
    const s = Math.min(1, m.t / m.duracao)
    const antes = this.pose
    this.pose = interpolar(m, s)
    const andou = distancia(antes, this.pose)
    const plano = Math.hypot(this.pose.x - antes.x, this.pose.y - antes.y)
    if (plano > 1e-6) this.direcao = { x: (this.pose.x - antes.x) / plano, y: (this.pose.y - antes.y) / plano }
    if (this.colidiu()) return
    if (this.arcoAceso) {
      this.sArco += andou
      this.depositar(andou / PASSO_S, m.tipo === 'MOVJ')
      if (this.passe) this.passe.comprimentoMm += andou
      if (this.estado !== 'executando') return
    }
    this.amostrar(false)
    if (s >= 1) {
      this.pose = copiaPose(m.para)
      this.atividade = null
      this.amostrar(true)
      this.concluirInstrucao()
    }
  }

  private colidiu(): boolean {
    const p = this.pose
    // O bocal fica um pouco recuado do bico: encosta quando a peça sobe acima dele.
    const bocalZ = p.z + this.celula.ctwdMm - 3
    const topoPeca = this.deposito.topoNoRaio(p.x, p.y, BOCAL_RAIO_MM)
    const sobreSubstrato = p.x > SUBSTRATO.xMin - BOCAL_RAIO_MM && p.x < SUBSTRATO.xMax + BOCAL_RAIO_MM && p.y > SUBSTRATO.yMin - BOCAL_RAIO_MM && p.y < SUBSTRATO.yMax + BOCAL_RAIO_MM
    const sobreMesa = p.x > MESA.xMin && p.x < MESA.xMax && p.y > MESA.yMin && p.y < MESA.yMax
    const chao = sobreSubstrato ? topoPeca : sobreMesa ? MESA.topoZ : -800
    if (bocalZ < chao) {
      this.alarme(`Colisão: o bocal da tocha tocou ${sobreSubstrato ? (topoPeca > 0.05 ? 'a parede' : 'o substrato') : sobreMesa ? 'a mesa' : 'o chão'} em X ${p.x.toFixed(1)}, Y ${p.y.toFixed(1)}, Z ${p.z.toFixed(1)} mm.`)
      return true
    }
    return false
  }

  private depositar(v: number, movj: boolean): void {
    const p = this.pose
    if (!this.deposito.dentro(p.x, p.y)) return this.alarme('O arco saiu de cima do substrato e apagou (sem peça embaixo, não há retorno de corrente).')
    const alimentacao = this.alimentacaoAtual()
    const volume = vazaoDeposito(alimentacao) * PASSO_S
    const r = this.deposito.depositar({ x: p.x, y: p.y, z: p.z, volume, v, s: this.sArco, tArco: this.tArco, temperaturaC: this.termico.temperaturaC, movj, tempo: this.tempo, dt: PASSO_S, ux: this.direcao.x, uy: this.direcao.y, larguraParadoMm: this.ultimaLarguraMm })
    this.tArco += PASSO_S
    this.arameG += massaArameG(alimentacao, PASSO_S)
    const pot = sinergia(alimentacao, this.condicoes.inicio[this.asf - 1].correcaoArco).potenciaW
    this.energiaKJ += pot * PASSO_S / 1000
    this.ultimaFolgaMm = r.folgaMm
    this.ultimoDefeito = r.defeitos[0] ?? null
    if (this.passe) {
      const ps = this.passe
      ps.arameG += massaArameG(alimentacao, PASSO_S)
      ps.energiaKJ += pot * PASSO_S / 1000
      ps.folgaMinMm = Math.min(ps.folgaMinMm, r.folgaMm)
      ps.folgaMaxMm = Math.max(ps.folgaMaxMm, r.folgaMm)
      ps.folgaMediaMm += r.folgaMm
      this.amostrasFolga++
      ps.inclinacaoMaxGraus = Math.max(ps.inclinacaoMaxGraus, inclinacaoTocha(p))
      for (const d of r.defeitos) ps.defeitos[d] = (ps.defeitos[d] ?? 0) + Math.max(v * PASSO_S, 0.01)
      ps.fim = { x: p.x, y: p.y }
    }
    if (r.perdeuArco) return this.alarme(`Perda de arco: o TCP ficou ${r.folgaMm.toFixed(1)} mm acima do topo da parede. O incremento programado está subindo mais que a parede cresce.`)
    if (r.larguraMm > 0 && v > 0.5) { this.ultimaLarguraMm = r.larguraMm; this.ultimaSecaoMm2 = r.secaoMm2 }
    this.alturaParedeMm = Math.max(this.alturaParedeMm, p.z - r.folgaMm + r.alturaCordaoMm)
    if (r.folgaMm < FOLGA.mergulho) this.avisarUmaVez('mergulho', 'aviso', 'O arame está mergulhando na poça: a parede cresceu mais que o incremento programado (tocha baixa).')
    if (r.folgaMm > FOLGA.instavel) this.avisarUmaVez('instavel', 'aviso', 'Arco longo e instável: o TCP está alto demais sobre a parede (incremento maior que a altura da camada).')
    if (r.defeitos.includes('escorrimento')) this.avisarUmaVez('escorrimento', 'aviso', `Parede a ${this.termico.temperaturaC.toFixed(0)} °C: a poça escorre pela lateral. Espere esfriar entre camadas (TIMER).`)
  }

  private amostrar(forcar: boolean): void {
    const n = this.rastro.length
    const p = this.pose
    const arco = this.arco ? 1 : 0
    if (!forcar && n >= 4) {
      const dx = p.x - this.rastro[n - 4], dy = p.y - this.rastro[n - 3], dz = p.z - this.rastro[n - 2]
      if (dx * dx + dy * dy + dz * dz < 1 && this.rastro[n - 1] === arco) return
    }
    if (n >= MAX_RASTRO * 4) return
    this.rastro.push(p.x, p.y, p.z, arco)
  }

  private evento(tipo: Evento['tipo'], texto: string): void {
    if (this.eventos.length >= MAX_EVENTOS) return
    this.eventos.push({ tempo: this.tempo, linha: this.linhaAtual ?? 0, tipo, texto })
  }

  private avisarUmaVez(chave: string, tipo: Evento['tipo'], texto: string): void {
    const k = `${chave}@${this.linhaAtual}`
    if (this.avisados.has(k)) return
    this.avisados.add(k)
    this.evento(tipo, texto)
  }

  private alarme(texto: string): void {
    this.fecharMovimento()
    if (this.arco) this.fecharArco('alarme')
    this.estado = 'alarme'
    this.evento('alarme', texto)
  }

  private fecharMovimento(): void {
    if (this.atividade?.tipo === 'MOVL' || this.atividade?.tipo === 'MOVJ') this.amostrar(true)
    this.atividade = null
  }

  private concluirInstrucao(): void {
    this.pc++
    if (this.pararNoFim && this.estado === 'executando') { this.pararNoFim = false; this.estado = 'pausado' }
  }

  private valor(v: Valor): number {
    if (v.tipo === 'const') return v.valor
    return this.lerVariavel(v.ref)
  }

  lerVariavel(r: Variavel): number {
    return this[r.tipo][r.n]
  }

  private gravar(r: Variavel, valor: number): boolean {
    const f = FAIXAS[r.tipo]
    if (valor < f.min || valor > f.max) {
      this.alarme(`Estouro: ${nomeVariavel(r)} ficaria ${valor}, fora da faixa ${f.min} a ${f.max}.`)
      return false
    }
    this[r.tipo][r.n] = valorInteiro(valor)
    return true
  }

  private destino(alvo: Alvo): Pose | null {
    let p: Pose
    if (alvo.tipo === 'C') {
      const ponto = this.pontos[alvo.n]
      if (!ponto) { this.alarme(`O ponto ${nomePonto(alvo.n)} não existe na tabela.`); return null }
      p = copiaPose(ponto.pose)
    } else p = copiaPose(this.P[alvo.n])
    if (this.deslocamento) {
      const d = this.deslocamento
      p = { x: p.x + d.x, y: p.y + d.y, z: p.z + d.z, rx: p.rx + d.rx, ry: p.ry + d.ry, rz: p.rz + d.rz }
    }
    const fora = foraDoAlcance(p)
    if (fora) { this.alarme(`Posição fora do alcance: o destino ${fora}.`); return null }
    return p
  }

  private executarInstrucao(): void {
    const ins: Instrucao | undefined = this.programa.instrucoes[this.pc]
    if (!ins) {
      // Sem END (não deveria passar na validação): encerra como o END.
      this.concluir()
      return
    }
    if (ins.op === 'COMENTARIO' || ins.op === 'ROTULO') { this.pc++; return }
    if (++this.executadas > LIMITES.instrucoesExecutadas) return this.alarme(`O programa executou mais de ${LIMITES.instrucoesExecutadas} instruções (limite do simulador). Confira se o laço tem saída.`)
    switch (ins.op) {
      case 'NOP':
        break
      case 'END':
        if (this.arco) {
          this.evento('aviso', 'END com o arco aberto: o arco foi cortado sem preencher a cratera.')
          this.fecharArco('END')
        }
        this.concluir()
        return
      case 'MOVJ':
      case 'MOVL': {
        const para = this.destino(ins.alvo)
        if (!para) return
        const de = copiaPose(this.pose)
        const reta = distancia(de, para)
        const giro = Math.max(Math.abs(normalizarAngulo(para.rx - de.rx)), Math.abs(normalizarAngulo(para.ry - de.ry)), Math.abs(normalizarAngulo(para.rz - de.rz)))
        let duracao: number, comprimento = reta
        if (ins.op === 'MOVL') duracao = Math.max(reta / ins.v, giro / ROTACAO_GRAUS_S)
        else {
          comprimento = reta * 1.08
          const fator = ins.vj / 100
          duracao = Math.max(comprimento / (VJ_EQUIVALENTE_MM_S * fator), giro / (180 * fator))
          if (this.arco) this.avisarUmaVez('movj', 'aviso', 'MOVJ com o arco aberto: o caminho é curvo e a velocidade de soldagem não é controlada.')
        }
        if (duracao < PASSO_S / 2) break
        this.atividade = { tipo: ins.op, de, para, duracao, t: 0, comprimento }
        return
      }
      case 'TIMER':
        if (this.arco) this.avisarUmaVez('timer', 'aviso', 'TIMER com o arco aberto: o robô para e o metal se acumula num ponto.')
        this.atividade = { tipo: 'espera', resta: ins.t, motivo: 'timer' }
        return
      case 'ARCON':
        this.abrirArco(ins.asf)
        return
      case 'ARCOF':
        if (!this.arco) { this.evento('info', 'ARCOF sem arco aberto: nada a fazer.'); break }
        if (this.modo === 'teste') { this.arco = false; this.amostrar(true); break }
        if (ins.aef !== null && this.condicoes.fim[ins.aef - 1].crateraS > 0) {
          this.aefPendente = ins.aef
          this.atividade = { tipo: 'espera', resta: this.condicoes.fim[ins.aef - 1].crateraS, motivo: 'cratera' }
          return
        }
        this.fecharArco('ARCOF')
        break
      case 'SET':
        if (!this.gravar(ins.destino, this.valor(ins.valor))) return
        break
      case 'ADD':
        if (!this.gravar(ins.destino, this.lerVariavel(ins.destino) + this.valor(ins.valor))) return
        break
      case 'INC':
        if (!this.gravar(ins.destino, this.lerVariavel(ins.destino) + 1)) return
        break
      case 'SETP':
        this.P[ins.destino.n] = copiaPose(this.P[ins.origem.n])
        break
      case 'ADDP': {
        const a = this.P[ins.destino.n], b = this.P[ins.origem.n]
        this.P[ins.destino.n] = { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z, rx: a.rx + b.rx, ry: a.ry + b.ry, rz: a.rz + b.rz }
        break
      }
      case 'SETE': {
        const mm = this.valor(ins.valor) / 1000
        const p = this.P[ins.destino.n]
        this.P[ins.destino.n] = { ...p, [ins.elemento === 1 ? 'x' : ins.elemento === 2 ? 'y' : 'z']: mm }
        break
      }
      case 'JUMP': {
        let salta = true
        if (ins.condicao) {
          const a = this.lerVariavel(ins.condicao.ref), b = this.valor(ins.condicao.valor)
          salta = ins.condicao.comparacao === '=' ? a === b : ins.condicao.comparacao === '<' ? a < b : a > b
        }
        if (salta) {
          const alvo = this.programa.rotulos.get(ins.rotulo)
          if (alvo === undefined) return this.alarme(`O rótulo *${ins.rotulo} não existe.`)
          if (alvo <= this.pc && ++this.saltosParaTras > LIMITES.saltosParaTras) return this.alarme(`Mais de ${LIMITES.saltosParaTras} repetições (limite do simulador). Confira a condição de saída do laço.`)
          this.pc = alvo
          if (this.pararNoFim) { this.pararNoFim = false; this.estado = 'pausado' }
          return
        }
        break
      }
      case 'SFTON':
        this.deslocamento = copiaPose(this.P[ins.p.n])
        break
      case 'SFTOF':
        this.deslocamento = null
        break
    }
    this.concluirInstrucao()
  }

  private abrirArco(asf: number): void {
    if (this.arco) return this.alarme('ARCON com o arco já aberto.')
    if (!this.condicoes.inicio[asf - 1]) return this.alarme(`O arquivo ASF#(${asf}) não existe.`)
    const p = this.pose
    const assento = this.deposito.dentro(p.x, p.y) ? this.deposito.assento(p.x, p.y, this.tempo) : null
    const folga = assento === null ? null : p.z - assento
    if (this.modo === 'teste') {
      this.arco = true
      this.asf = asf
      this.amostrar(true)
      if (folga === null) this.evento('aviso', 'Teste: na fabricação o arco não abriria aqui, fora do substrato.')
      else if (folga > FOLGA.perdeArco) this.evento('aviso', `Teste: na fabricação o arco não abriria aqui: o TCP está ${folga.toFixed(1)} mm acima da peça.`)
      else this.evento('info', `ARCON ASF#(${asf}) com o arco inibido (teste sem deposição). TCP a ${folga.toFixed(1)} mm do topo.`)
      this.concluirInstrucao()
      return
    }
    if (folga === null) return this.alarme('Falha na abertura do arco: o TCP não está sobre o substrato.')
    if (folga > FOLGA.perdeArco) return this.alarme(`Falha na abertura do arco: o TCP está ${folga.toFixed(1)} mm acima da peça e o arame não a alcança.`)
    this.arco = true
    this.asf = asf
    this.tArco = 0
    this.sArco = 0
    this.deposito.camadaAtual++
    this.amostrar(true)
    this.passe = {
      numero: this.passes.length + 1, linha: this.linhaAtual ?? 0, tInicio: this.tempo, tFim: this.tempo,
      interpasseC: this.termico.temperaturaC, folgaInicialMm: folga, folgaMinMm: folga, folgaMaxMm: folga, folgaMediaMm: 0,
      zTcpMm: p.z, assentoMm: assento ?? 0, comprimentoMm: 0, inicio: { x: p.x, y: p.y }, fim: { x: p.x, y: p.y },
      defeitos: {}, arameG: 0, energiaKJ: 0, fechamento: 'aberto', inclinacaoMaxGraus: inclinacaoTocha(p),
    }
    this.passes.push(this.passe)
    this.amostrasFolga = 0
    this.atividade = { tipo: 'espera', resta: IGNICAO_S, motivo: 'ignicao' }
  }

  private fecharArco(como: Passe['fechamento']): void {
    if (!this.arco) return
    this.arco = false
    this.aefPendente = null
    this.amostrar(true)
    if (this.modo !== 'fabricar' || !this.passe) return
    // Cratera: a poça que fica para trás solidifica afundada (H106-c).
    const largura = this.ultimaLarguraMm
    const comprimento = 1.5 * largura
    this.deposito.cratera(this.pose.x, this.pose.y, this.direcao.x, this.direcao.y, comprimento, largura / 2, 0.3 * this.ultimaSecaoMm2 * comprimento, this.tempo)
    const ps = this.passe
    ps.tFim = this.tempo
    ps.fechamento = como
    ps.folgaMediaMm /= Math.max(1, this.amostrasFolga)
    this.passe = null
  }

  private concluir(): void {
    this.fecharMovimento()
    this.estado = 'concluido'
    this.evento('info', `Fim do job em ${this.tempo.toFixed(1)} s.`)
  }
}

function interpolar(m: Movimento, s: number): Pose {
  const a = m.de, b = m.para
  const lerp = (u: number, v: number) => u + (v - u) * s
  const ang = (u: number, v: number) => u + normalizarAngulo(v - u) * s
  const p: Pose = { x: lerp(a.x, b.x), y: lerp(a.y, b.y), z: lerp(a.z, b.z), rx: ang(a.rx, b.rx), ry: ang(a.ry, b.ry), rz: ang(a.rz, b.rz) }
  if (m.tipo === 'MOVJ') {
    // Caminho ilustrativo do MOVJ: sai da reta para o lado e para cima (H106-a).
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    const h = Math.hypot(b.x - a.x, b.y - a.y)
    const curva = Math.sin(Math.PI * s)
    if (h > 1e-6) {
      p.x += (-(b.y - a.y) / h) * 0.08 * d * curva
      p.y += ((b.x - a.x) / h) * 0.08 * d * curva
    }
    p.z += 0.06 * d * curva
  }
  return p
}
