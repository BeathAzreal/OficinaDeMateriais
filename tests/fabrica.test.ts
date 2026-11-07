import { describe, expect, it } from 'vitest'
import {
  ORDENS,
  dadosFabricaIniciais,
  liberarOrdem,
  notaDaOrdem,
  podeLiberar,
  progressoDa,
  proximaEtapa,
  registrarEtapa,
  reiniciarOrdem,
  situacaoEtapa,
  validarDadosFabrica,
  type RegistroEtapa,
} from '../src/fabrica/ordens'
import { NOTA_MINIMA_LABORATORIO, registroDaSoldagem, registroDaUsinagem, registroDoLaboratorio } from '../src/fabrica/registros'
import { MISSAO_OS01_EMENDA } from '../src/fabrica/missaoOs'
import { MATERIAIS } from '../src/modelo/material'
import { cssParaSombra } from '../src/setores/montar'

const OS = ORDENS[0]
const EM = '2026-11-01T10:00:00.000Z'
const ok = (nota: number): RegistroEtapa => ({ nota, conforme: true, resumo: 'ok', em: EM })
const ruim = (nota: number): RegistroEtapa => ({ nota, conforme: false, resumo: 'ruim', em: EM })

function tudoFeito() {
  let d = dadosFabricaIniciais()
  for (const e of OS.etapas) d = registrarEtapa(d, OS.id, e.id, ok(80))
  return d
}

describe('Ordens de serviço da fábrica', () => {
  it('a OS-01 passa pelo laboratório, pela usinagem e pela soldagem, nessa ordem', () => {
    expect(OS.etapas.map((e) => e.setor)).toEqual(['laboratorio', 'usinagem', 'soldagem'])
    expect(new Set(ORDENS.flatMap((o) => o.etapas.map((e) => `${o.id}/${e.id}`))).size).toBe(ORDENS.flatMap((o) => o.etapas).length)
  })

  it('a próxima etapa é a primeira sem resultado conforme', () => {
    let d = dadosFabricaIniciais()
    expect(proximaEtapa(OS, progressoDa(d, OS.id))?.id).toBe('analise-falha')
    d = registrarEtapa(d, OS.id, 'analise-falha', ruim(40))
    expect(situacaoEtapa(progressoDa(d, OS.id), 'analise-falha')).toBe('nao-conforme')
    expect(proximaEtapa(OS, progressoDa(d, OS.id))?.id).toBe('analise-falha')
    d = registrarEtapa(d, OS.id, 'analise-falha', ok(70))
    expect(proximaEtapa(OS, progressoDa(d, OS.id))?.id).toBe('usinar-pino')
  })

  it('refazer uma etapa guarda o melhor resultado (conforme vale mais que nota alta)', () => {
    let d = registrarEtapa(dadosFabricaIniciais(), OS.id, 'usinar-pino', ok(60))
    d = registrarEtapa(d, OS.id, 'usinar-pino', ruim(95))
    expect(progressoDa(d, OS.id).etapas['usinar-pino'].nota).toBe(60)
    d = registrarEtapa(d, OS.id, 'usinar-pino', ok(90))
    expect(progressoDa(d, OS.id).etapas['usinar-pino'].nota).toBe(90)
  })

  it('a qualidade só libera com todas as etapas conformes, e a OS liberada fica fechada', () => {
    let d = registrarEtapa(dadosFabricaIniciais(), OS.id, 'analise-falha', ok(80))
    expect(podeLiberar(OS, progressoDa(d, OS.id))).toBe(false)
    expect(liberarOrdem(d, OS.id, EM)).toBe(d)
    d = tudoFeito()
    expect(podeLiberar(OS, progressoDa(d, OS.id))).toBe(true)
    d = liberarOrdem(d, OS.id, EM, ['a', 'b', 'c'])
    const p = progressoDa(d, OS.id)
    expect(p.liberadaEm).toBe(EM)
    expect(p.respostas).toEqual(['a', 'b', 'c'])
    expect(registrarEtapa(d, OS.id, 'soldar-emenda', ok(100))).toBe(d)
    expect(notaDaOrdem(OS, p)).toBe(80)
    expect(progressoDa(reiniciarOrdem(d, OS.id), OS.id).liberadaEm).toBeNull()
  })

  it('recusa etapa desconhecida e dados salvos inválidos', () => {
    expect(() => registrarEtapa(dadosFabricaIniciais(), OS.id, 'nao-existe', ok(1))).toThrow()
    expect(validarDadosFabrica(null)).toBeNull()
    expect(validarDadosFabrica({ versao: 2, ordens: [] })).toBeNull()
    expect(validarDadosFabrica({ versao: 1, ordens: [{ ordemId: 'x', etapas: {}, liberadaEm: null }, { lixo: true }] })?.ordens).toHaveLength(1)
  })
})

describe('Registro de cada setor na OS', () => {
  it('laboratório: aceito a partir da nota mínima', () => {
    expect(registroDoLaboratorio(NOTA_MINIMA_LABORATORIO, EM).conforme).toBe(true)
    expect(registroDoLaboratorio(NOTA_MINIMA_LABORATORIO - 1, EM).conforme).toBe(false)
    expect(registroDoLaboratorio(140, EM).nota).toBe(100)
  })

  it('usinagem: dimensões 50, rugosidade 30 e orçamento 20; conforme é o do cliente', () => {
    const base = { conformeDimensoes: true, superficie: { conforme: true, raMax: 1.2 }, custos: { total: 100 }, orcamento: 200, conformeGeral: true }
    expect(registroDaUsinagem(base, EM)).toMatchObject({ nota: 100, conforme: true })
    const r = registroDaUsinagem({ ...base, superficie: { conforme: false, raMax: 2.4 }, custos: { total: 300 }, conformeGeral: false }, EM)
    expect(r).toMatchObject({ nota: 50, conforme: false })
    expect(r.resumo).toContain('2,40 µm')
  })

  it('soldagem: 0 a 1000 vira 0 a 100 e vale a aprovação do Difícil', () => {
    expect(registroDaSoldagem(734, true, EM)).toMatchObject({ nota: 73, conforme: true })
    expect(registroDaSoldagem(900, false, EM).conforme).toBe(false)
  })

  it('a emenda da OS usa o aço médio carbono numa espessura do estoque', () => {
    const m = MATERIAIS[MISSAO_OS01_EMENDA.material]
    expect(m.processos).toContain('MIG/MAG')
    expect(m.ficha.espessurasMm).toContain(MISSAO_OS01_EMENDA.geometria.espessuraMm)
  })
})

describe('Setores em React dentro do jogo', () => {
  it('o CSS de página inteira passa a valer na raiz da sombra', () => {
    const css = cssParaSombra(':root{--a:1}\nbody{margin:0}\nhtml, body {x:1}\n.body{y:1}\n.app body .x{z:1}')
    expect(css).toContain(':host{--a:1}')
    expect(css).toContain(':host{margin:0}')
    expect(css).toContain(':host, :host {x:1}')
    expect(css).toContain('.body{y:1}')
  })
})
