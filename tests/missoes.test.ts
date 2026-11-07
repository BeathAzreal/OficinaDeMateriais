import { describe, expect, it } from 'vitest'
import { gasCompativel, GASES, type GasId } from '../src/modelo/material'
import { areaParaLargura } from '../src/modelo/juntas'
import { correnteRelativa, equilibrioArco, razaoEfetiva, taxaDeposicao } from '../src/modelo/processo'
import {
  contextoDaMissao,
  DIFICULDADES,
  MISSOES,
  PLANEJADAS,
  requisitosEfetivos,
  validarPreparo,
  type Dificuldade,
  type Missao,
  type Preparo,
} from '../src/missoes/catalogo'
import { executar, jeitosDeSoldar } from './util'

/** Procura uma configuração aprovada: tensão perto do equilíbrio e velocidade pela largura-alvo. */
function procurarSolucao(m: Missao, d: Dificuldade) {
  const req = requisitosEfetivos(m, d)
  const larguraAlvo = (req.larguraMinMm + req.larguraMaxMm) / 2
  let melhor: { total: number; descricao: string } | null = null
  for (const diametroArameMm of m.consumiveis.diametrosMm) {
    for (const gas of m.consumiveis.gases) {
      const preparo: Preparo = { diametroArameMm, gas, oxidoRemovido: true }
      const ctx = contextoDaMissao(m, preparo)
      for (let alimentacao = 1; alimentacao <= 10; alimentacao += 1) {
        const eq = equilibrioArco({ alimentacao, tensao: 5 }, ctx).tensaoEquilibrio
        for (const dv of [-0.5, 0, 0.5]) {
          const tensao = Math.round(Math.min(10, Math.max(1, eq + dv)) * 2) / 2
          const a = { alimentacao, tensao }
          const area = areaParaLargura(m.geometria.junta, ctx, larguraAlvo, razaoEfetiva(a, ctx))
          const vBase = taxaDeposicao(a, ctx) / area
          for (const f of [0.85, 1, 1.15]) {
            for (const acel of m.material === 'aluminio' ? [0, 0.3, 0.5] : [0]) {
              for (const jeito of jeitosDeSoldar(m)) {
                const r = executar(m, d, preparo, a, vBase * f, acel, jeito)
                if (r.aprovada && (!melhor || r.total > melhor.total)) {
                  melhor = { total: r.total, descricao: `d=${diametroArameMm} ${gas} W=${alimentacao} V=${tensao} v=${(vBase * f).toFixed(1)} acel=${acel} I=${correnteRelativa(a, ctx).toFixed(2)} ${JSON.stringify(jeito)}` }
                  // Basta uma solução boa: a busca completa ficou grande com posições e sentidos.
                  if (melhor.total > 80) return melhor
                }
              }
            }
          }
        }
      }
    }
  }
  return melhor
}

describe('catálogo de missões', () => {
  it('só oferece gases compatíveis com o material', () => {
    for (const m of MISSOES) {
      for (const g of m.consumiveis.gases) expect(gasCompativel(g, m.material)).toBe(true)
    }
  })

  it('recusa combinações fora da missão ou incompatíveis', () => {
    const al = MISSOES.find((m) => m.material === 'aluminio')!
    for (const gas of Object.keys(GASES) as GasId[]) {
      const erros = validarPreparo(al, { diametroArameMm: 1, gas, oxidoRemovido: true })
      expect(erros.length === 0).toBe(gas === 'ar')
    }
    // Os três diâmetros da máquina valem em toda missão; um que a máquina não tem é recusado.
    expect(() => contextoDaMissao(al, { diametroArameMm: 0.8, gas: 'ar', oxidoRemovido: true })).not.toThrow()
    expect(() => contextoDaMissao(al, { diametroArameMm: 1.6, gas: 'ar', oxidoRemovido: true })).toThrow()
  })

  it('missões planejadas não aparecem como jogáveis', () => {
    for (const p of PLANEJADAS) expect(MISSOES.some((m) => m.id === p.id)).toBe(false)
  })

  it('separa processo, junta, tipo de solda e posição', () => {
    for (const m of MISSOES) {
      expect(new Set([m.processo, m.junta, m.tipoSolda, m.posicao]).size).toBe(4)
    }
  })
})

describe('cada missão tem solução viável', () => {
  for (const m of MISSOES) {
    for (const d of DIFICULDADES) {
      it(`${m.id} / ${d}`, () => {
        const s = procurarSolucao(m, d)
        expect(s, `nenhuma configuração aprovou ${m.id} ${d}`).not.toBeNull()
        expect(s!.total).toBeGreaterThan(70)
      }, 60000)
    }
  }
})
