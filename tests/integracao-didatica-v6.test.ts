import { expect, it } from 'vitest'
import { MISSOES, contextoDaMissao, preparoPadrao } from '../src/missoes/catalogo'
import { Simulacao } from '../src/modelo/simulacao'
import { compactar } from '../src/dados/eventos'
import { relatorioDoRegistro } from '../src/pontuacao/oficial'
import { devolverTentativa } from '../src/didatica/devolutiva'
import { roteiroDaMissao } from '../src/missoes/aprendizagem'

for (const m of MISSOES) {
  it(`integra feedback e roteiro com relatório de defeitos v6: ${m.id}`, () => {
    const contexto = contextoDaMissao(m, { ...preparoPadrao(m), oxidoRemovido: true })
    const sim = new Simulacao(contexto)
    sim.definirAjustes({ alimentacao: 5, tensao: 5.5 })
    sim.iniciarArco({ t: 1000, x: 10, y: 0 })
    for (let i = 1; i <= 100; i++) sim.moverTocha({ t: 1000 + i * 100, x: 10 + i * 1.2, y: 0 })
    sim.encerrarArco({ t: 11000, x: 130, y: 0 })
    const { resultado, relatorio } = relatorioDoRegistro(m, 'aprendiz', contexto, compactar(sim.eventos))
    const antes = structuredClone(resultado)
    const feedback = devolverTentativa(resultado)
    expect(resultado.versao).toBe('pontuacao-v11')
    expect(resultado.categorias.find(c => c.id === 'desenho')!.detalhes.some(d => d.rotulo === 'Superfície')).toBe(true)
    expect(relatorio.defeitos).toBeDefined()
    expect(Object.values(feedback).every(t => t.length > 0)).toBe(true)
    expect(roteiroDaMissao(m).habilidade.length).toBeGreaterThan(15)
    expect(resultado).toEqual(antes)
  })
}
