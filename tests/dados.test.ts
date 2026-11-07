import { describe, expect, it } from 'vitest'
import { MemoriaChaveValor, PREFIXO, Repositorio } from '../src/dados/armazenamento'
import { compactar, descompactar, eventosValidos } from '../src/dados/eventos'
import {
  chaveRanking,
  criarRecorde,
  ehNovoRecorde,
  exportarRecordes,
  importarRecordes,
  normalizarNome,
  posicaoNoRanking,
  ranking,
  validarListaRecordes,
  type Recorde,
} from '../src/dados/recordes'
import { MISSOES } from '../src/missoes/catalogo'
import { Simulacao } from '../src/modelo/simulacao'
import { reproduzir } from '../src/modelo/replay'
import { CONTEXTO_PADRAO } from '../src/modelo/processo'

const m = MISSOES[0]

function rec(nome: string, total: number, extra: Partial<Recorde> = {}, data = new Date('2026-10-20T10:00:00Z')): Recorde {
  return criarRecorde(
    {
      total,
      aprovada: true,
      categorias: { integridade: total * 0.4, desenho: total * 0.25, regularidade: 0, deformacao: 0, eficiencia: 0 },
      missaoId: m.id,
      missaoVersao: m.versao,
      missaoTitulo: m.titulo,
      dificuldade: 'aprendiz',
      processo: 'MIG/MAG',
      material: m.material,
      dispositivo: 'mouse',
      versaoPontuacao: 'pontuacao-v1',
      ...extra,
    },
    nome,
    data,
  )
}

describe('recordes do Arcade', () => {
  it('guarda o nome informado (normalizado) junto da pontuação', () => {
    const r = rec('  Ana   Souza ', 88)
    expect(r.nome).toBe('Ana Souza')
    expect(r.total).toBe(88)
    expect(() => rec('   ', 50)).toThrow()
    expect(normalizarNome('x'.repeat(40))).toHaveLength(24)
  })

  it('persiste após "recarregar" (novo repositório sobre o mesmo armazenamento)', () => {
    const ls = new MemoriaChaveValor()
    const r = rec('Bia', 91)
    new Repositorio(ls).gravar('recordes', [r])
    const lido = new Repositorio(ls).ler('recordes', [] as Recorde[], validarListaRecordes)
    expect(lido.dados).toEqual([r])
    expect(lido.dados[0].nome).toBe('Bia')
  })

  it('separa rankings por missão, dificuldade e dispositivo; destaca novo recorde', () => {
    const a = rec('Ana', 80)
    const b = rec('Bruno', 90)
    const c = rec('Caio', 99, { dispositivo: 'controle' })
    const d = rec('Duda', 99, { dificuldade: 'profissional' })
    const todos = [a, b, c, d]
    expect(ranking(todos, chaveRanking(a)).map((r) => r.nome)).toEqual(['Bruno', 'Ana'])
    expect(posicaoNoRanking(todos, a)).toBe(2)
    expect(ehNovoRecorde(todos, b)).toBe(true)
    expect(ehNovoRecorde(todos, c)).toBe(true)
    expect(new Set(todos.map(chaveRanking)).size).toBe(3)
  })

  it('exporta e importa com validação, sem duplicar e recusando registros inválidos', () => {
    const a = rec('Ana', 80)
    const b = rec('Bruno', 90)
    const texto = exportarRecordes([a, b], new Date())
    const obj = JSON.parse(texto)
    // Nota acima da escala (1000 na pontuacao-v3) é inválida.
    obj.recordes.push({ ...a, id: 'outro', total: 5000 }, { foo: 1 })
    const r = importarRecordes(JSON.stringify(obj), [a])
    expect(r.erro).toBeUndefined()
    expect(r.novos.map((x) => x.nome)).toEqual(['Bruno'])
    expect(r.repetidos).toBe(1)
    expect(r.recusados.map((x) => x.indice)).toEqual([2, 3])
    expect(importarRecordes('{nada', []).erro).toMatch(/JSON/)
    expect(importarRecordes('{"formato":"outro","recordes":[]}', []).erro).toMatch(/exportação/)
  })
})

describe('repositório versionado', () => {
  it('migra dados sem envelope (versão 0) e regrava com versão', () => {
    const ls = new MemoriaChaveValor()
    ls.setItem(`${PREFIXO}recordes`, JSON.stringify([rec('Ana', 70)]))
    const lido = new Repositorio(ls).ler('recordes', [] as Recorde[], validarListaRecordes)
    expect(lido.dados).toHaveLength(1)
    expect(JSON.parse(ls.getItem(`${PREFIXO}recordes`)!).esquema).toBe(1)
  })

  it('recupera de dados corrompidos guardando uma cópia e avisando', () => {
    const ls = new MemoriaChaveValor()
    ls.setItem(`${PREFIXO}torneios`, '{isto não é json')
    const lido = new Repositorio(ls).ler('torneios', [] as unknown[])
    expect(lido.dados).toEqual([])
    expect(lido.aviso).toMatch(/cópia/)
    expect([...Array(ls.length).keys()].some((i) => ls.key(i)!.includes('corrompido/torneios'))).toBe(true)
  })

  it('recusa versão de esquema futura sem quebrar', () => {
    const ls = new MemoriaChaveValor()
    ls.setItem(`${PREFIXO}recordes`, JSON.stringify({ esquema: 99, colecao: 'recordes', salvoEm: '', dados: [] }))
    expect(new Repositorio(ls).ler('recordes', [] as Recorde[]).aviso).toMatch(/versão/)
  })
})

describe('registro compacto da tentativa', () => {
  it('ida e volta preserva o replay', () => {
    const sim = new Simulacao(CONTEXTO_PADRAO)
    let t = 1000.123
    sim.iniciarArco({ t, x: 10, y: 0.2 })
    for (let x = 10; x < 60; x += 0.1) sim.moverTocha({ t: (t += 8), x, y: 0.2 })
    sim.encerrarArco({ t, x: 60, y: 0.2 })
    const c = compactar(sim.eventos)
    expect(eventosValidos(JSON.parse(JSON.stringify(c)))).toBe(true)
    const volta = reproduzir(CONTEXTO_PADRAO, descompactar(c))
    expect(volta.cordao.volumeTotal()).toBeCloseTo(sim.cordao.volumeTotal(), 3)
    expect(eventosValidos({ versao: 1, t0: 0, lista: [['m', 1, 'x', 2]] })).toBe(false)
  })
})

describe('Arcade: treino separado das tentativas oficiais', () => {
  it('treino não consome tentativa nem pode ser entregue; o limite é respeitado', async () => {
    const { registrarExecucao, entregaveis, restantesArcade } = await import('../src/dados/arcade')
    let s = { limite: 2, tentativas: [] as { numero: number; resultado: number | null }[] }
    s = registrarExecucao(s, { numero: 1, resultado: 99 }, false)
    expect(s.tentativas).toHaveLength(0)
    s = registrarExecucao(s, { numero: 1, resultado: null }, true)
    s = registrarExecucao(s, { numero: 2, resultado: 70 }, true)
    expect(restantesArcade(s)).toBe(0)
    expect(entregaveis(s).map((t) => t.resultado)).toEqual([70])
    expect(() => registrarExecucao(s, { numero: 3, resultado: 80 }, true)).toThrow()
  })
})
