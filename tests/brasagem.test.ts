import { describe, expect, it } from 'vitest'
import { FLUXOS, LIGAS, ModeloBrasagem, fatorFolga, type PreparoBrasagem } from '../src/modelo/brasagem'
import { pecaBrasagem, pecaBrasagemEm, PECAS_BRASAGEM, type PecaBrasagem } from '../src/missoes/pecasBrasagem'
import { avaliarBrasagem, inspecionarBrasagem, juntaFragil, zincoQueimadoMm } from '../src/pontuacao/brasagem'
import { materiaisDoProcesso } from '../src/modelo/material'

/*
 * Brasagem (H105): o que um brasador sabe da prática, no modelo. Os passes
 * usam um "brasador" simulado com a técnica de oficina: chama varrendo a
 * sobreposição até a cor de trabalho, afastando-se quando passa da faixa, e
 * vareta encostada na borda quando a peça (não a chama) está quente.
 */

interface Jeito { fps?: number; afastar?: boolean; dentro?: number; segundos?: number; varetaNaChama?: boolean }

function brasar(peca: PecaBrasagem, prep: Partial<PreparoBrasagem> = {}, j: Jeito = {}) {
  const m = new ModeloBrasagem(peca, { ...peca.recomendado, ...prep })
  const dt = 1 / (j.fps ?? 60), L = peca.sobreposicaoMm
  const [, t1] = m.liga.trabalhoC
  m.distanciaMm = 15
  let t = 0, x = peca.inicioMm + 1
  while (x < peca.fimMm && t < (j.segundos ?? 300)) {
    const tv = m.temperaturaC(x, 0.25)
    if (j.varetaNaChama) { m.xMm = x; m.yMm = 0.25 } else {
      m.xMm = x + 3 + 6 * Math.sin(t * 3)
      m.yMm = -L * (j.dentro ?? 0.7) + L * 0.5 * Math.sin(t * 4.3)
    }
    m.naPeca = j.afastar === false || Math.max(m.temperaturaC(x, 0), m.temperaturaC(x + 3, -L / 2)) < t1 - 15
    m.varetaXMm = x
    m.encostarVareta = j.varetaNaChama ? true : tv >= m.liga.liquidusC + 5 && m.fileteEm(x) < 1
    if (m.fileteEm(x) > 0.7 && m.profundidadeEm(x) > L * 0.8) x += 3 * dt
    else if (tv > m.liga.trabalhoC[0] && m.fileteEm(x) > 1.5) x += 1.5 * dt
    m.avancar(dt)
    t += dt
  }
  m.encostarVareta = false
  m.naPeca = false
  for (let k = 0; k < 40; k++) m.avancar(0.25)
  return m
}

const preenchimento = (p: PecaBrasagem, m: ModeloBrasagem) => avaliarBrasagem(p, m, 'aprendiz').preenchimento

describe('dados de catálogo (H105)', () => {
  it('ligas: solidus < faixa de trabalho, liquidus dentro ou abaixo dela, < superaquecimento; o fluxo cobre a faixa', () => {
    for (const l of Object.values(LIGAS)) {
      expect(l.solidusC).toBeLessThan(l.liquidusC)
      // O cobre-fósforo (AWS BCuP-2) trabalha a 732–843 °C, já abaixo do liquidus: corre pastoso no cobre.
      expect(l.solidusC).toBeLessThan(l.trabalhoC[0])
      expect(l.liquidusC).toBeLessThanOrEqual(l.trabalhoC[1])
      expect(l.trabalhoC[0]).toBeLessThan(l.trabalhoC[1])
      expect(l.trabalhoC[1]).toBeLessThan(l.superaquecimentoC)
      const [a0, a1] = FLUXOS[l.fluxo].ativoC
      expect(a0).toBeLessThan(l.solidusC)
      expect(a1).toBeGreaterThanOrEqual(l.trabalhoC[1])
    }
  })

  it('a capilaridade é máxima perto de 0,075 mm e cai para folga apertada ou larga', () => {
    expect(fatorFolga(0.075)).toBeCloseTo(1)
    expect(fatorFolga(0.02)).toBeLessThan(0.3)
    expect(fatorFolga(0.3)).toBeLessThan(0.1)
  })

  it('a brasagem é oferecida no aço, no inox, no galvanizado e no cobre', () => {
    expect(materiaisDoProcesso('brasagem').sort()).toEqual(['aco-carbono', 'aco-galvanizado', 'cobre', 'inox-austenitico'])
  })
})

describe('brasagem na prática (H105)', () => {
  const aco = pecaBrasagem('bras-aco-prata')

  it('com a técnica certa a prata enche a folga e a nota é boa', () => {
    const m = brasar(aco)
    expect(preenchimento(aco, m)).toBeGreaterThan(0.6)
    expect(m.furos).toHaveLength(0)
    expect(avaliarBrasagem(aco, m, 'aprendiz').nota).toBeGreaterThan(550)
  }, 60000)

  it('o resultado não depende da taxa de quadros', () => {
    const a = preenchimento(aco, brasar(aco, {}, { fps: 60 }))
    const b = preenchimento(aco, brasar(aco, {}, { fps: 30 }))
    expect(Math.abs(a - b)).toBeLessThan(0.12)
  }, 60000)

  it('sem fluxo a prata não molha o aço: embola e a folga fica vazia', () => {
    const m = brasar(aco, { fluxo: false }, { segundos: 60 })
    expect(preenchimento(aco, m)).toBeLessThan(0.05)
    expect(m.emboladas).toBeGreaterThan(0)
    expect(inspecionarBrasagem(aco, m).some((d) => d.nome === 'Folga com vazios' && /fluxo/i.test(d.causa))).toBe(true)
  }, 60000)

  it('folga larga deixa vazios; a folga certa enche', () => {
    const certa = preenchimento(aco, brasar(aco))
    const larga = { ...aco, folgaMm: 0.3 }
    expect(preenchimento(larga, brasar(larga, {}, { segundos: 120 }))).toBeLessThan(certa - 0.3)
  }, 60000)

  it('a chama em cima da vareta com a peça fria derrete a liga em bolinhas', () => {
    const m = brasar(aco, {}, { varetaNaChama: true, segundos: 3 })
    expect(m.varetaNaChama).toBeGreaterThan(0)
    expect(m.embolada.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })

  it('chama parada com bico grande no aço fino queima o fluxo', () => {
    const m = new ModeloBrasagem(aco, { ...aco.recomendado, bico: 5 })
    m.xMm = 75; m.yMm = 0; m.distanciaMm = 6; m.naPeca = true
    for (let t = 0; t < 8; t += 1 / 60) m.avancar(1 / 60)
    expect(m.fluxoQueimado).toBeGreaterThan(0)
  })

  it('cobre-fósforo no cobre dispensa fluxo, mas pede o bico grande', () => {
    const cobre = pecaBrasagem('bras-cobre')
    expect(cobre.recomendado.fluxo).toBe(false)
    expect(preenchimento(cobre, brasar(cobre))).toBeGreaterThan(0.6)
    const fraco = brasar(cobre, { bico: 3 }, { segundos: 90 })
    expect(preenchimento(cobre, fraco)).toBeLessThan(0.1)
  }, 60000)

  it('cobre-fósforo no aço deixa a junta frágil (fosfeto de ferro)', () => {
    const m = brasar(aco, { liga: 'cu-p', fluxo: true }, { segundos: 60 })
    expect(juntaFragil(m)).toBe(true)
    expect(inspecionarBrasagem(aco, m)[0].nome).toMatch(/frágil/)
    expect(avaliarBrasagem(aco, m, 'profissional').descontos.fragil).toBeGreaterThan(0)
  }, 60000)

  it('no galvanizado, o latão (900 °C) queima mais zinco que a prata (750 °C)', () => {
    const galv = pecaBrasagem('bras-galv-prata')
    const zinco = (m: ModeloBrasagem) => Math.max(...Array.from({ length: 50 }, (_, i) => zincoQueimadoMm(m, galv.inicioMm + i + 0.5)))
    const prata = zinco(brasar(galv))
    const latao = zinco(brasar(galv, { liga: 'latao', bico: 4 }, { dentro: 1.3, segundos: 120 }))
    expect(latao).toBeGreaterThan(prata + 2)
  }, 60000)

  it('o latão pede a sobreposição quente por dentro: só a borda quente não basta', () => {
    const latao = pecaBrasagem('bras-aco-latao')
    const soBorda = preenchimento(latao, brasar(latao, {}, { dentro: 0.4, segundos: 120 }))
    const porDentro = preenchimento(latao, brasar(latao, {}, { dentro: 1.3, segundos: 120 }))
    expect(porDentro).toBeGreaterThan(soBorda + 0.25)
  }, 60000)
})

describe('peças e troca de chapa (H105)', () => {
  it('toda peça e toda chapa da brasagem montam um modelo', () => {
    for (const p of PECAS_BRASAGEM) for (const mat of materiaisDoProcesso('brasagem')) {
      const q = pecaBrasagemEm(p, mat)
      expect(() => new ModeloBrasagem(q, q.recomendado)).not.toThrow()
      // Aço nunca recebe cobre-fósforo como recomendação.
      if (mat !== 'cobre') expect(LIGAS[q.recomendado.liga].fosforo).toBe(false)
    }
  })

  it('no cobre a recomendação vira o bico 5', () => {
    expect(pecaBrasagemEm(pecaBrasagem('bras-aco-prata'), 'cobre').recomendado.bico).toBe(5)
  })
})
