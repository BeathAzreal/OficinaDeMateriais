import type { Tentativa } from '../modelo/avaliacao'

/** A decomposição antiga só vale para o cordão de referência sobre chapa. */
export function exigeExplicacaoContextual(t: Tentativa): boolean {
  const c = t.contexto
  return !!c && (c.aberturaMm > 0 || (c.junta ?? 'topo') !== 'topo' ||
    c.material !== 'aco-carbono' || c.diametroArameMm !== 1 || c.gas !== 'ar-co2' ||
    (c.tecnica ?? 'neutra') !== 'neutra' || (c.movimento ?? 'reto') !== 'reto' ||
    (c.dbcpMm ?? 15) !== 15 || !!c.posicaoInicial?.rolagemGraus || !!c.posicaoInicial?.giroGraus)
}
