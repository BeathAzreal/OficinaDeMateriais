import { describe, expect, it } from 'vitest'
import { aprovacaoEletrodo } from '../src/pontuacao/eletrodo'
import { pecaEletrodo, PECAS_ELETRODO } from '../src/missoes/pecasEletrodo'
import { alvoEletrodo } from '../src/modelo/depositoEletrodo'

const itens = (fracoes: number[], nota = 1000, inspecaoPendente = false) => ({ nota, inspecaoPendente, itens: fracoes.map((f, k) => ({ nome: `item ${k}`, maximo: 100, pontos: Math.round(f * 100) })) })

describe('H90 no eletrodo: Fácil só nota, Difícil com 20 % em cada item', () => {
  it('Fácil não tem aprovação, nem com item zerado', () => {
    const a = aprovacaoEletrodo(itens([0, 0, 1, 1]), 'aprendiz')
    expect(a.exigencia).toBeNull()
    expect(a.aprovada).toBe(true)
    expect(a.abaixo).toEqual([])
  })
  it('Difícil reprova o item abaixo de 20 % e aprova no limite', () => {
    const r = aprovacaoEletrodo(itens([0.19, 0.2, 1, 1]), 'profissional')
    expect(r.exigencia).toBe(0.2)
    expect(r.aprovada).toBe(false)
    expect(r.abaixo).toEqual(['item 0'])
    expect(aprovacaoEletrodo(itens([0.2, 0.2, 0.2, 0.2]), 'profissional').aprovada).toBe(true)
  })
  it('Difícil também exige 20 % na nota final e a escória removida', () => {
    const zerada = aprovacaoEletrodo(itens([0.5, 0.5, 0.5, 0.5], 0), 'profissional')
    expect(zerada.aprovada).toBe(false)
    expect(zerada.abaixo).toEqual(['Nota final'])
    const suja = aprovacaoEletrodo(itens([1, 1, 1, 1], 800, true), 'profissional')
    expect(suja.aprovada).toBe(false)
    expect(suja.escoria).toBe(true)
    expect(aprovacaoEletrodo(itens([0, 0, 0, 0], 0, true), 'aprendiz').aprovada).toBe(true)
  })
})

describe('H91: peça de cordões sobre chapa', () => {
  it('chapa inteira, alvo em relevo, e entra depois das peças antigas (índices estáveis)', () => {
    const p = pecaEletrodo('cordao-sobre-chapa')
    expect(p.aberturaMm).toBe(0)
    expect(alvoEletrodo(p).altura).toBeGreaterThan(1)
    expect(PECAS_ELETRODO[0].id).toBe('cordao-chapa')
    // H91 ficou depois das cinco peças antigas; H103 (tubo) entra depois dela, sem mudar nenhum índice.
    expect(PECAS_ELETRODO.findIndex((q) => q.id === 'cordao-sobre-chapa')).toBe(5)
    expect(PECAS_ELETRODO.at(-1)!.id).toBe('tubo-topo')
  })
})
