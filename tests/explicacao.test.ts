import { describe, expect, it } from 'vitest'
import { comparar, decomporLargura } from '../src/didatica/comparacao'
import { explicar } from '../src/didatica/explicacao'
import type { Tentativa } from '../src/modelo/avaliacao'
import type { Ajustes } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'

interface Opcoes {
  ajustes?: Ajustes
  velocidade?: (x: number) => number
  lateral?: (x: number) => number
  /** Pausa (ms) sem leituras quando a tocha passa por x = 70. */
  pausaMs?: number
  /** Passos de quadro a intercalar (ms); 0 = sem quadros. */
  quadroMs?: number
}

/** Uma tentativa completa: um passe de 10 a 140 mm, avaliada no fim. */
function tentativa(o: Opcoes = {}): { sim: Simulacao; t: Tentativa } {
  const sim = new Simulacao()
  if (o.ajustes) sim.definirAjustes(o.ajustes)
  const vel = o.velocidade ?? (() => 12)
  const lat = o.lateral ?? (() => 0)
  let t = 0
  let x = 10
  let pausou = false
  let quadro = 0
  const avancar = (ate: number) => {
    if (!o.quadroMs) return
    while (quadro < ate) {
      sim.avancarTempo(quadro)
      quadro += o.quadroMs
    }
  }
  sim.iniciarArco({ t, x, y: lat(x) })
  while (x < 140) {
    t += 8
    if (!pausou && x >= 70 && o.pausaMs) {
      t += o.pausaMs
      pausou = true
    }
    x += vel(x) * 0.008
    avancar(t)
    sim.moverTocha({ t, x, y: lat(x) })
  }
  sim.encerrarArco({ t, x, y: lat(x) })
  return { sim, t: sim.finalizar()! }
}

describe('velocidade efetiva por trecho (H20)', () => {
  it('o tempo de permanência soma o tempo de arco', () => {
    const { sim, t } = tentativa()
    expect(sim.percurso.total()).toBeCloseTo(t.tempoArcoMs, 6)
  })

  it('não depende da taxa de quadros', () => {
    const sem = tentativa({ pausaMs: 1500 }).t.movimento!
    const com = tentativa({ pausaMs: 1500, quadroMs: 1000 / 37 }).t.movimento!
    sem.trechos.forEach((tr, i) => expect(com.trechos[i].permanenciaMs).toBeCloseTo(tr.permanenciaMs, 6))
  })

  it('velocidade constante é medida como constante', () => {
    const mov = tentativa().t.movimento!
    expect(mov.velocidadeMediaMms).toBeCloseTo(12, 1)
    expect(mov.cvVelocidade).toBeLessThan(0.02)
    expect(mov.pausas).toHaveLength(0)
  })

  it('uma parada vira pausa no trecho certo', () => {
    const mov = tentativa({ pausaMs: 2000 }).t.movimento!
    expect(mov.pausas).toHaveLength(1)
    expect(mov.pausas[0].inicioMm).toBeLessThanOrEqual(70)
    expect(mov.pausas[0].fimMm).toBeGreaterThan(70)
  })
})

describe('explicação por regras (H21–H23)', () => {
  it('é determinística e termina sempre nos limites do modelo', () => {
    const { t } = tentativa()
    const a = explicar(t)
    expect(explicar(t)).toEqual(a)
    expect(a[a.length - 1].tema).toBe('limites')
  })

  it('velocidade estável → regularidade explicada como estável', () => {
    const itens = explicar(tentativa().t)
    const reg = itens.find((i) => i.tema === 'regularidade')!
    expect(reg.texto).toContain('estável')
    expect(itens.some((i) => i.tema === 'pausas')).toBe(false)
  })

  it('velocidade oscilando → cita trecho lento, rápido e o contrafactual', () => {
    const t = tentativa({ velocidade: (x) => (Math.floor(x / 15) % 2 === 0 ? 7 : 17) }).t
    const reg = explicar(t).find((i) => i.tema === 'regularidade')!
    expect(reg.texto).toContain('mais lento')
    expect(reg.texto).toContain('Se você tivesse andado sempre')
  })

  it('parada → item de pausa; desequilíbrio → aviso do jogo', () => {
    const itens = explicar(tentativa({ pausaMs: 2000, ajustes: { alimentacao: 8, tensao: 3 } }).t)
    expect(itens.some((i) => i.tema === 'pausas')).toBe(true)
    expect(itens.find((i) => i.tema === 'equilibrio')!.titulo).toContain('curto')
  })

  it('tocha fora da junta → alinhamento cita o desvio máximo', () => {
    const al = explicar(tentativa({ lateral: () => 4 }).t).find((i) => i.tema === 'alinhamento')!
    expect(al.titulo).toContain('deslocado')
    expect(al.texto).toContain('chegando a')
  })

  it('sem cordão suficiente → explicação curta', () => {
    const sim = new Simulacao()
    sim.iniciarArco({ t: 0, x: 10, y: 0 })
    sim.encerrarArco({ t: 100, x: 11, y: 0 })
    const itens = explicar(sim.finalizar()!)
    expect(itens.map((i) => i.tema)).toEqual(['continuidade', 'limites'])
  })
})

describe('comparação com a tentativa anterior (H24, H25)', () => {
  it('duas tentativas iguais → tudo igual', () => {
    const c = comparar(tentativa().t, tentativa().t)!
    expect(c.linhas.every((l) => l.juizo === 'igual')).toBe(true)
    expect(c.frases).toEqual(['As duas tentativas ficaram praticamente iguais pelos critérios do jogo.'])
  })

  it('mais devagar → largura maior, atribuída à velocidade', () => {
    const c = comparar(tentativa().t, tentativa({ velocidade: () => 8 }).t)!
    expect(c.linhas.find((l) => l.rotulo === 'Largura média')!.juizo).toBe('maior')
    const frase = c.frases.find((f) => f.startsWith('A largura média'))!
    expect(frase).toContain('velocidade média')
    expect(frase).not.toContain('alimentação')
  })

  it('regularidade melhor é ligada à velocidade mais estável', () => {
    const irregular = tentativa({ velocidade: (x) => (Math.floor(x / 15) % 2 === 0 ? 7 : 17) }).t
    const c = comparar(irregular, tentativa().t)!
    expect(c.linhas.find((l) => l.rotulo.startsWith('Variação da largura'))!.juizo).toBe('melhor')
    expect(c.frases[0]).toContain('acompanha a variação da sua velocidade')
  })

  it('largura igual por compensação é explicada', () => {
    // 20 % mais arame a 20 % mais velocidade: mesma seção, mesma largura.
    // (Arco ainda equilibrado: fora do equilíbrio o cordão muda pela H44.)
    const c = comparar(tentativa().t, tentativa({ ajustes: { alimentacao: 6, tensao: 5.5 }, velocidade: () => 14.4 }).t)!
    expect(c.linhas.find((l) => l.rotulo === 'Largura média')!.juizo).toBe('igual')
    expect(c.frases.some((f) => f.includes('por compensação'))).toBe(true)
  })

  it('a decomposição reproduz a razão de larguras do modelo', () => {
    const a = { alimentacao: 5, tensao: 5.5 }
    const b = { alimentacao: 8, tensao: 8 }
    const ta = tentativa({ ajustes: a }).t
    const tb = tentativa({ ajustes: b, velocidade: () => 15 }).t
    const produto = decomporLargura(a, b, ta.movimento!.velocidadeMediaMms, tb.movimento!.velocidadeMediaMms).reduce(
      (p, f) => p * f.fator,
      1,
    )
    const razao = tb.avaliacao.medidas!.largura.media / ta.avaliacao.medidas!.largura.media
    expect(produto).toBeCloseTo(razao, 1)
  })
})
