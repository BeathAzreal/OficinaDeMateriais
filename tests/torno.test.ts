import { describe, expect, it } from 'vitest'
import { ModeloTorno, TORNO } from '../src/torno/modelo'
import { PECAS_TORNO, type PecaTorno } from '../src/torno/pecas'
import { avaliarTorno, comprimentoUsinado, inspecionarTorno, micrometro } from '../src/torno/avaliacao'
import { aprovacaoEletrodo } from '../src/pontuacao/eletrodo'

const peca = (id: string) => PECAS_TORNO.find((p) => p.id === id)!
const novo = (p: PecaTorno) => new ModeloTorno({ material: p.material, diametroMm: p.diametroBrutoMm, balancoMm: p.balancoMm })
const DT = 1 / 60

/** Operador de teste: posiciona fora do material, liga o eixo e usa o avanço automático. */
class Operador {
  constructor(readonly m: ModeloTorno) {}
  rapido(z: number, r: number) { this.m.vZ = 0; this.m.vR = 0; this.m.zFerramenta = z; this.m.rFerramenta = r }
  marcha(rpm: number, f: number) { if (this.m.eixoLigado) this.m.alternarEixo(); this.m.trocarRotacao(rpm); this.m.avancoMmVolta = f }
  ligar() { if (!this.m.eixoLigado) this.m.alternarEixo() }
  ate(cond: () => boolean, max = 600) { for (let t = 0; t < max && !cond(); t += DT) this.m.avancar(DT) }
  facear(remover: number) {
    const m = this.m, z = m.zFace - remover
    this.rapido(z + 2, m.raioBruto + 2); this.ligar()
    this.rapido(z, m.raioBruto + 1)
    m.automatico = 'transversal'
    this.ate(() => m.automatico === null)
    m.automatico = null
    this.rapido(z + 3, 0)
  }
  /** Passe longitudinal: ponta no raio `r` da face até `comprimento` mm dentro. */
  passe(r: number, comprimento: number) {
    const m = this.m, face = m.zFace
    this.ligar()
    this.rapido(face + 2, r)
    m.automatico = 'longitudinal'
    this.ate(() => m.zFerramenta - m.raioPonta <= face - comprimento)
    m.automatico = null
    this.rapido(m.zFerramenta, r + 1.5)
    this.rapido(face + 2, r + 1.5)
  }
}

function eixoOm01(p = peca('om01-eixo')) {
  const m = novo(p), op = new Operador(m)
  op.marcha(1800, 0.2)
  op.facear(1)
  op.passe(19, 50); op.passe(18.3, 50)
  // Mede (eixo parado) e acaba no diâmetro alvo: 35,98 no meio da tolerância.
  op.marcha(1800, 0.08)
  const medido = micrometro(m, 25)
  const ajuste = (medido - 36.6) / 2
  op.passe(35.98 / 2 - ajuste, 50)
  if (m.eixoLigado) m.alternarEixo()
  return { m, p }
}

describe('Torno convencional (H108)', () => {
  it('OM-01 bem feita: na tolerância, Ra ≤ 1,6, ressalto a 50 mm, aprovada no Difícil', () => {
    const { m, p } = eixoOm01()
    const r = avaliarTorno(p, m, 'profissional')
    expect(r.medidas.diametroMin).toBeGreaterThanOrEqual(35.95)
    expect(r.medidas.diametroMax).toBeLessThanOrEqual(36)
    expect(r.medidas.raMax!).toBeLessThanOrEqual(1.6)
    expect(Math.abs((comprimentoUsinado(m) ?? 0) - 50)).toBeLessThanOrEqual(0.5)
    expect(r.nota).toBeGreaterThan(850)
    expect(aprovacaoEletrodo(r, 'profissional').aprovada).toBe(true)
    expect(inspecionarTorno(p, m).filter((d) => d.grave)).toHaveLength(0)
  })

  it('no desbaste a peça sai maior que a ponta (deflexão); no acabamento leve, quase igual', () => {
    const p = peca('om01-eixo'), m = novo(p), op = new Operador(m)
    op.marcha(1800, 0.25)
    op.passe(18.5, 40)
    const desbaste = micrometro(m, 20) - 37
    op.marcha(1800, 0.08)
    op.passe(18.3, 40)
    const acabamento = micrometro(m, 20) - 36.6
    expect(desbaste).toBeGreaterThan(acabamento)
    expect(acabamento).toBeLessThan(0.02)
  })

  it('Ra segue o avanço (f²/8rε): avanço alto deixa a superfície áspera', () => {
    const p = peca('om01-eixo')
    const ra = (f: number) => { const m = novo(p), op = new Operador(m); op.marcha(1800, f); op.passe(19.5, 30); return m.raEm(m.zFace - 15)! }
    expect(ra(0.3)).toBeGreaterThan(3 * ra(0.08))
  })

  it('rotação baixa no aço: aresta postiça piora o acabamento', () => {
    const p = peca('om01-eixo')
    const ra = (rpm: number) => { const m = novo(p), op = new Operador(m); op.marcha(rpm, 0.08); op.passe(19.5, 30); return m.raEm(m.zFace - 15)! }
    expect(ra(450)).toBeGreaterThan(2 * ra(1800))
  })

  it('ligar o eixo com a ferramenta encostada quebra a ferramenta; trocar a aresta só com o eixo parado', () => {
    const p = peca('om01-eixo'), m = novo(p)
    m.zFerramenta = 60; m.rFerramenta = 19
    m.alternarEixo()
    expect(m.quebrada).toBe(true)
    expect(m.quebras).toBe(1)
    expect(m.trocarAresta()).toBe(true)
    expect(m.quebrada).toBe(false)
  })

  it('encostar com o eixo parado quebra; bater na placa conta como colisão', () => {
    const p = peca('om01-eixo'), m = novo(p)
    m.zFerramenta = 60; m.rFerramenta = 21; m.vR = -2
    for (let t = 0; t < 2; t += DT) m.avancar(DT)
    expect(m.quebras).toBe(1)
    const n = novo(p)
    n.trocarRotacao(1800); n.zFerramenta = 5; n.rFerramenta = 25; n.alternarEixo(); n.vZ = -5
    for (let t = 0; t < 3; t += DT) n.avancar(DT)
    expect(n.colisoes).toBe(1)
    expect(n.eixoLigado).toBe(false)
  })

  it('profundidade além da pastilha quebra a ferramenta; carga demais em rotação baixa para o motor', () => {
    const p = peca('om01-eixo')
    const a = novo(p), op = new Operador(a)
    op.marcha(1800, 0.1); op.passe(20 - TORNO.apMaxMm - 0.5, 10)
    expect(a.quebras).toBe(1)
    // Desbaste pesado em rotação alta: a potência passa da do motor e o eixo para.
    const b = novo(p), opb = new Operador(b)
    opb.marcha(1800, 0.3); opb.passe(17, 10)
    expect(b.sobrecargas).toBeGreaterThan(0)
    expect(b.eixoLigado).toBe(false)
  })

  it('peça esbelta (alumínio) vibra com corte pesado na ponta e não vibra com passe leve', () => {
    const p = peca('pino-aluminio')
    const pesado = novo(p), a = new Operador(pesado)
    a.marcha(1800, 0.25); a.passe(10.5, 20)
    expect(pesado.episodiosVibracao).toBeGreaterThan(0)
    const leve = novo(p), b = new Operador(leve)
    b.marcha(1800, 0.08); b.passe(12, 20)
    expect(leve.episodiosVibracao).toBe(0)
  })

  it('medir com o eixo girando é recusado e conta na segurança', () => {
    const m = novo(peca('om01-eixo'))
    m.alternarEixo()
    expect(m.podeMedir()).toBe(false)
    expect(m.medicoesInseguras).toBe(1)
    m.alternarEixo()
    expect(m.podeMedir()).toBe(true)
  })

  it('não dá para trocar a marcha com o eixo girando', () => {
    const m = novo(peca('om01-eixo'))
    m.alternarEixo()
    expect(m.trocarRotacao(90)).toBe(false)
  })

  it('o resultado não depende da taxa de quadros', () => {
    const p = peca('om01-eixo')
    const rodar = (dt: number) => { const m = novo(p); m.trocarRotacao(1120); m.zFerramenta = 77; m.rFerramenta = 19; m.alternarEixo(); m.vZ = -3; for (let t = 0; t < 10; t += dt) m.avancar(dt); return [m.zFace, m.diametroEm(50), m.vb] }
    const a = rodar(1 / 30), b = rodar(1 / 144)
    for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], 4)
  })
})
