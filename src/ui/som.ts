/*
 * Som do arco (H45): só sensorial, não entra no modelo nem na nota.
 * Três vozes sintetizadas com ruído filtrado, misturadas pelo desvio da
 * tensão em relação ao equilíbrio (H10):
 *   equilibrado → chiado contínuo de "fritura";
 *   curto (tensão baixa) → estalos fortes e irregulares;
 *   longo (tensão alta) → chiado agudo com zumbido.
 */

const DURACAO_S = 2
const VOLUME = 0.22

type Voz = 'equilibrado' | 'curto' | 'longo'

/** Sorteio com semente fixa: o som é sempre o mesmo, sem depender de Math.random. */
function sorteador(semente: number): () => number {
  let s = semente
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Estalos: impulsos de ruído com decaimento exponencial, a uma taxa média por segundo. */
function estalos(dados: Float32Array, sr: number, taxa: number, amp: [number, number], tauMs: number, r: () => number, rajadas = false): void {
  let t = 0
  while (t < dados.length) {
    // Rajadas: a taxa oscila devagar (o arame "engasga" e volta).
    const fator = rajadas ? 0.3 + 1.7 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / sr / 0.37)) : 1
    t += Math.max(1, Math.round((-Math.log(1 - r()) / (taxa * fator)) * sr))
    const a = amp[0] + (amp[1] - amp[0]) * r()
    const n = Math.round((tauMs / 1000) * sr * 5)
    for (let k = 0; k < n && t + k < dados.length; k++) dados[t + k] += a * (r() * 2 - 1) * Math.exp(-k / ((tauMs / 1000) * sr))
  }
}

function gerar(voz: Voz, sr: number): Float32Array {
  const d = new Float32Array(Math.round(DURACAO_S * sr))
  const r = sorteador(voz === 'equilibrado' ? 7 : voz === 'curto' ? 11 : 13)
  if (voz === 'equilibrado') {
    for (let i = 0; i < d.length; i++) d[i] = 0.05 * (r() * 2 - 1)
    estalos(d, sr, 380, [0.15, 0.7], 0.6, r)
  } else if (voz === 'curto') {
    for (let i = 0; i < d.length; i++) d[i] = 0.02 * (r() * 2 - 1)
    estalos(d, sr, 28, [0.6, 1], 4, r, true)
    // "Tum" grave de cada curto-circuito.
    let t = 0
    while (t < d.length) {
      t += Math.round((0.03 + 0.09 * r()) * sr)
      const n = Math.round(0.03 * sr)
      for (let k = 0; k < n && t + k < d.length; k++) d[t + k] += 0.5 * Math.sin((2 * Math.PI * 85 * k) / sr) * Math.exp(-k / (0.008 * sr))
    }
  } else {
    for (let i = 0; i < d.length; i++) d[i] = 0.2 * (r() * 2 - 1) + 0.07 * Math.sin((2 * Math.PI * 120 * i) / sr)
    estalos(d, sr, 60, [0.1, 0.35], 0.8, r)
  }
  // Emendas suaves para o laço não estalar.
  const borda = Math.round(0.01 * sr)
  for (let k = 0; k < borda; k++) {
    d[k] *= k / borda
    d[d.length - 1 - k] *= k / borda
  }
  return d
}

class SomArco {
  ligado = true
  private ctx: AudioContext | null = null
  private mestre: GainNode | null = null
  private vozes = new Map<Voz, GainNode>()
  private tocando = false

  private iniciar(): boolean {
    if (this.ctx) return true
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    try {
      const ctx = new Ctor()
      const mestre = ctx.createGain()
      mestre.gain.value = 0
      mestre.connect(ctx.destination)
      const filtros: Record<Voz, BiquadFilterNode> = {
        equilibrado: Object.assign(ctx.createBiquadFilter(), { type: 'bandpass' as BiquadFilterType }),
        curto: Object.assign(ctx.createBiquadFilter(), { type: 'lowpass' as BiquadFilterType }),
        longo: Object.assign(ctx.createBiquadFilter(), { type: 'highpass' as BiquadFilterType }),
      }
      filtros.equilibrado.frequency.value = 2600
      filtros.equilibrado.Q.value = 0.7
      filtros.curto.frequency.value = 2800
      filtros.longo.frequency.value = 1400
      for (const voz of ['equilibrado', 'curto', 'longo'] as const) {
        const dados = gerar(voz, ctx.sampleRate)
        const buffer = ctx.createBuffer(1, dados.length, ctx.sampleRate)
        buffer.getChannelData(0).set(dados)
        const fonte = ctx.createBufferSource()
        fonte.buffer = buffer
        fonte.loop = true
        const ganho = ctx.createGain()
        ganho.gain.value = 0
        fonte.connect(filtros[voz]).connect(ganho).connect(mestre)
        fonte.start()
        this.vozes.set(voz, ganho)
      }
      this.ctx = ctx
      this.mestre = mestre
      return true
    } catch {
      return false
    }
  }

  /**
   * Chamado a cada quadro. `desvio` = tensão − tensão de equilíbrio (H10);
   * `tolerancia` é a faixa considerada equilibrada.
   */
  atualizar(soldando: boolean, desvio: number, tolerancia: number): void {
    const ativo = soldando && this.ligado
    if (!ativo && !this.tocando) return
    if (!this.iniciar()) return
    const ctx = this.ctx!
    if (ctx.state === 'suspended') void ctx.resume()
    const agora = ctx.currentTime
    this.tocando = ativo
    this.mestre!.gain.setTargetAtTime(ativo ? VOLUME : 0, agora, ativo ? 0.02 : 0.04)
    if (!ativo) return
    const curto = Math.min(1, Math.max(0, (-desvio - tolerancia * 0.5) / 2.5))
    const longo = Math.min(1, Math.max(0, (desvio - tolerancia * 0.5) / 2.5))
    const alvo: Record<Voz, number> = { equilibrado: Math.max(0.12, 1 - Math.max(curto, longo)), curto: curto * 1.3, longo: longo * 1.1 }
    for (const [voz, g] of this.vozes) g.gain.setTargetAtTime(alvo[voz], agora, 0.08)
  }

  /** Silencia já (ao sair de uma tela). */
  calar(): void {
    if (this.ctx && this.mestre) this.mestre.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02)
    this.tocando = false
  }
}

/** Um só som para o jogo inteiro. */
export const somArco = new SomArco()
