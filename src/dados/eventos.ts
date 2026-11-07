import type { Ajustes } from '../modelo/processo'
import type { EventoTentativa } from '../modelo/simulacao'

/*
 * Forma compacta do registro de eventos de uma tentativa, para salvar no
 * navegador. A pontuação oficial é calculada a partir do replay DESTA forma
 * compacta, de modo que o professor inspeciona exatamente os mesmos dados
 * usados pela avaliação automática.
 */

export interface EventosCompactos {
  versao: 1
  /** Instante do primeiro evento (ms); os demais são relativos a ele. */
  t0: number
  /** ['i'|'m'|'f', t, x, y], ['a', alimentação, tensão] ou ['p', rolagem, giro] (graus, H47). */
  lista: (['i' | 'm' | 'f', number, number, number] | ['a', number, number] | ['p', number, number])[]
}

const r = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas

export function compactar(eventos: readonly EventoTentativa[]): EventosCompactos {
  const primeiro = eventos.find((e) => 't' in e) as { t: number } | undefined
  const t0 = primeiro ? primeiro.t : 0
  const codigo = { inicio: 'i', mover: 'm', fim: 'f' } as const
  return {
    versao: 1,
    t0,
    lista: eventos.map((e) =>
      e.tipo === 'ajustes'
        ? (['a', e.ajustes.alimentacao, e.ajustes.tensao] as ['a', number, number])
        : e.tipo === 'posicao'
          ? (['p', e.rolagemGraus, e.giroGraus] as ['p', number, number])
          : ([codigo[e.tipo], r(e.t - t0, 2), r(e.x, 3), r(e.y, 3)] as ['i' | 'm' | 'f', number, number, number]),
    ),
  }
}

export function descompactar(c: EventosCompactos): EventoTentativa[] {
  const tipo = { i: 'inicio', m: 'mover', f: 'fim' } as const
  return c.lista.map((e) => {
    if (e[0] === 'a') {
      const ajustes: Ajustes = { alimentacao: e[1], tensao: e[2] }
      return { tipo: 'ajustes', ajustes }
    }
    if (e[0] === 'p') return { tipo: 'posicao', rolagemGraus: e[1], giroGraus: e[2] }
    const [k, t, x, y] = e
    return { tipo: tipo[k], t, x, y }
  })
}

/** Confere a estrutura (dados importados ou salvos podem estar corrompidos). */
export function eventosValidos(c: unknown): c is EventosCompactos {
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  if (o.versao !== 1 || typeof o.t0 !== 'number' || !Array.isArray(o.lista)) return false
  return o.lista.every(
    (e) =>
      Array.isArray(e) &&
      (((e[0] === 'a' || e[0] === 'p') && e.length === 3 && e.slice(1).every((v: unknown) => typeof v === 'number' && Number.isFinite(v))) ||
        (['i', 'm', 'f'].includes(e[0]) && e.length === 4 && e.slice(1).every((v: unknown) => typeof v === 'number' && Number.isFinite(v)))),
  )
}
