import { describe, expect, it } from 'vitest'
import { AJUSTES, MODELO } from '../src/modelo/parametros'
import {
  tensaoV,
  AJUSTES_PADRAO,
  equilibrioArco,
  faixaVelocidadeAlvo,
  razaoAlturaLargura,
  taxaDeposicao,
  type Ajustes,
} from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'

/** Um passe reto a velocidade constante, com leituras a cada 8 ms. */
function passe(ajustes: Ajustes, vMms = 6): Simulacao { // v1.8 (H87): metade da velocidade de antes
  const sim = new Simulacao()
  sim.definirAjustes(ajustes)
  let t = 0
  let x = 10
  sim.iniciarArco({ t, x, y: 0 })
  while (x < 120) {
    t += 8
    x += vMms * 0.008
    sim.moverTocha({ t, x, y: 0 })
  }
  sim.encerrarArco({ t, x, y: 0 })
  return sim
}

const meio = (sim: Simulacao) => sim.cordao.secao(sim.cordao.indiceEm(65))

describe('ajustes de referência', () => {
  it('reproduzem o modelo da etapa 1', () => {
    expect(taxaDeposicao(AJUSTES_PADRAO)).toBeCloseTo(MODELO.taxaDeposicaoMm3s, 9)
    expect(razaoAlturaLargura(AJUSTES_PADRAO)).toBeCloseTo(MODELO.razaoAlturaLargura, 9)
    expect(equilibrioArco(AJUSTES_PADRAO).condicao).toBe('equilibrado')
  })
})

describe('alimentação do arame (H1)', () => {
  it('o dobro de alimentação deposita o dobro de volume', () => {
    const v4 = passe({ alimentacao: 4, tensao: 5 }).cordao.volumeTotal()
    const v8 = passe({ alimentacao: 8, tensao: 5 }).cordao.volumeTotal()
    expect(v8 / v4).toBeCloseTo(2, 9)
  })

  it('o dobro de alimentação no dobro da velocidade dá a mesma seção', () => {
    const a = meio(passe({ alimentacao: 4, tensao: 5 }, 4)).areaMm2
    const b = meio(passe({ alimentacao: 8, tensao: 5 }, 8)).areaMm2
    expect(b / a).toBeCloseTo(1, 2)
  })
})

describe('tensão (H9)', () => {
  it('não muda a quantidade de metal', () => {
    const baixa = meio(passe({ alimentacao: 5, tensao: 3 })).areaMm2
    const alta = meio(passe({ alimentacao: 5, tensao: 8 })).areaMm2
    expect(alta).toBeCloseTo(baixa, 6)
  })

  it('mais tensão → cordão mais largo e mais baixo', () => {
    const baixa = meio(passe({ alimentacao: 5, tensao: 3 }))
    const alta = meio(passe({ alimentacao: 5, tensao: 8 }))
    expect(alta.larguraMm).toBeGreaterThan(baixa.larguraMm)
    expect(alta.alturaMm).toBeLessThan(baixa.alturaMm)
  })
})

describe('equilíbrio tensão × alimentação (H10)', () => {
  it('classifica arco curto, equilibrado e longo', () => {
    expect(equilibrioArco({ alimentacao: 8, tensao: 4 }).condicao).toBe('curto')
    expect(equilibrioArco({ alimentacao: 8, tensao: 8 }).condicao).toBe('equilibrado')
    expect(equilibrioArco({ alimentacao: 3, tensao: 7 }).condicao).toBe('longo')
  })

  it('mais alimentação pede mais tensão', () => {
    expect(equilibrioArco({ alimentacao: 8, tensao: 5 }).tensaoEquilibrio).toBeGreaterThan(
      equilibrioArco({ alimentacao: 3, tensao: 5 }).tensaoEquilibrio,
    )
  })
})

describe('faixa-alvo (H11)', () => {
  it('acompanha a alimentação', () => {
    const f = faixaVelocidadeAlvo({ alimentacao: 10, tensao: 5 })
    expect(f.minMms).toBeCloseTo(8, 9)
    expect(f.maxMms).toBeCloseTo(16, 9)
  })
})

describe('ajustes travados com o arco aberto (H12)', () => {
  it('recusa mudança durante a solda e aceita depois', () => {
    const sim = new Simulacao()
    sim.iniciarArco({ t: 0, x: 10, y: 0 })
    expect(sim.definirAjustes({ alimentacao: 9, tensao: 9 })).toBe(false)
    expect(sim.ajustes).toEqual(AJUSTES_PADRAO)
    sim.encerrarArco({ t: 100, x: 12, y: 0 })
    expect(sim.definirAjustes({ alimentacao: 9, tensao: 9 })).toBe(true)
  })

  it('limita os valores à faixa dos botões', () => {
    const sim = new Simulacao()
    sim.definirAjustes({ alimentacao: 50, tensao: -30 })
    // H100: a tensão desce até 0 V (abaixo do botão 1); a alimentação para no 1.
    expect(sim.ajustes.alimentacao).toBe(AJUSTES.maximo)
    expect(tensaoV(sim.ajustes.tensao)).toBeCloseTo(0, 9)
    sim.definirAjustes({ alimentacao: -5, tensao: 50 })
    expect(sim.ajustes).toEqual({ alimentacao: AJUSTES.minimo, tensao: AJUSTES.maximo })
  })
})
