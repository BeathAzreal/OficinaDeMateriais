import type { PosicaoPeca } from '../src/modelo/juntas'
import type { Ajustes } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'
import { contextoDaMissao, type Dificuldade, type Missao, type Preparo } from '../src/missoes/catalogo'
import { pontuar } from '../src/pontuacao/regras'

export interface OpcoesPasse {
  /** Posição da peça (H47); ausente = a de entrega da missão. */
  posicao?: PosicaoPeca
  /** +1 do início para o fim; −1 do fim para o início (subir, na junta vertical). */
  sentido?: 1 | -1
  /** Mínimo por categoria (H90); ausente = o do modo. */
  exigencia?: number | null
}

/** Executa um passe com velocidade que pode crescer linearmente (aceleração). */
export function executar(m: Missao, d: Dificuldade, preparo: Preparo, ajustes: Ajustes, v0: number, aceleracao = 0, op: OpcoesPasse = {}) {
  const ctx = contextoDaMissao(m, preparo)
  const sim = new Simulacao(ctx)
  sim.definirAjustes(ajustes)
  if (op.posicao) sim.definirPosicao(op.posicao)
  const sentido = op.sentido ?? 1
  const xa = m.trecho.inicioMm - 4
  const xb = m.trecho.fimMm + 3
  const [x0, x1] = sentido > 0 ? [xa, xb] : [xb, xa]
  let t = 0
  let x = x0
  sim.iniciarArco({ t, x, y: 0 })
  while (sentido > 0 ? x < x1 : x > x1) {
    t += 8
    x += sentido * v0 * (1 + (aceleracao * Math.abs(x - x0)) / Math.abs(x1 - x0)) * 0.008
    sim.moverTocha({ t, x, y: 0 })
  }
  sim.encerrarArco({ t, x, y: 0 })
  return pontuar({ missao: m, dificuldade: d, contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.estado(t).tempoArcoMs, exigencia: op.exigencia })
}

/** Jeitos de soldar a missão que um jogador tentaria: como chegou ou na plana; ida ou volta. */
export function jeitosDeSoldar(m: Missao): OpcoesPasse[] {
  const posicoes = m.montagem.fixa ? [undefined] : [undefined, { rolagemGraus: 0, giroGraus: 0 }]
  return posicoes.flatMap((posicao) => [{ posicao, sentido: 1 as const }, { posicao, sentido: -1 as const }])
}
