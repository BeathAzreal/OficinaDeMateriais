import { describe, expect, it } from 'vitest'
import { Acionamento15, velocidadeAltura15 } from '../src/modelo/acionamento15'
import { Escoria15 } from '../src/modelo/escoria15'
import { nomeTecla15 } from '../src/dados/controles15'

function aberto(distancia = 2.5) {
  const m = new Acionamento15('eletrodo')
  m.pressionado = true
  m.definirDistancia(0)
  m.avancar(1 / 120)
  m.definirDistancia(distancia)
  m.avancar(1 / 120)
  return m
}

describe('refino da bancada SMAW (H68–H70)', () => {
  it('H68: riscar a ponta na chapa demora mais para grudar do que bater parado', () => {
    const parado = new Acionamento15('eletrodo'), riscando = new Acionamento15('eletrodo')
    for (const m of [parado, riscando]) { m.pressionado = true; m.definirDistancia(0) }
    for (let i = 0; i < 48; i++) {
      parado.avancar(1 / 60)
      riscando.xMm += 0.5 // 30 mm/s
      riscando.avancar(1 / 60)
    }
    expect(parado.estado).toBe('grudado')
    expect(riscando.estado).toBe('contato')
    riscando.definirDistancia(2.5)
    riscando.avancar(1 / 60)
    expect(riscando.estado).toBe('arco')
  })

  it('H69: classifica o arco pelo diâmetro da alma', () => {
    expect(aberto(0.8).faixaArco).toBe('curto')
    expect(aberto(2.5).faixaArco).toBe('adequado')
    expect(aberto(4.5).faixaArco).toBe('longo')
    const solto = new Acionamento15('eletrodo')
    expect(solto.faixaArco).toBeNull()
  })

  it('H69: arco longo deposita cordão mais baixo e instável e gera mais respingos', () => {
    const formas: Record<string, { razao: number; instabilidade: number }[]> = { curto: [], longo: [] }
    const curto = aberto(1), longo = aberto(4.5)
    curto.avancar(0.5, -curto.consumoMmS, (_, f) => formas.curto.push(f!))
    longo.avancar(0.5, -longo.consumoMmS, (_, f) => formas.longo.push(f!))
    expect(formas.curto.length).toBeGreaterThan(0)
    expect(formas.longo[0].razao).toBeLessThan(formas.curto[0].razao)
    expect(formas.longo[0].instabilidade).toBeGreaterThan(formas.curto[0].instabilidade)
    expect(longo.respingos).toBeGreaterThan(curto.respingos)
  })

  it('H70: compensação mantém a distância enquanto a vareta é consumida', () => {
    const livre = aberto(2.5), assistido = aberto(2.5)
    assistido.compensar = true
    livre.avancar(3)
    assistido.avancar(3)
    expect(livre.estado).not.toBe('arco')
    expect(assistido.estado).toBe('arco')
    expect(assistido.distanciaMm).toBeCloseTo(2.5, 1)
    // H91: consumo de 1,5 mm/s → 3 s gastam ~4,5 mm.
    expect(assistido.restanteMm).toBeLessThan(116)
  })

  it('mede o avanço da ponta e posicionar não conta como deslocamento', () => {
    const m = aberto(2.5)
    m.compensar = true
    for (let i = 0; i < 60; i++) { m.xMm += 0.1; m.avancar(1 / 60) }
    expect(m.velocidadeMmS).toBeGreaterThan(4)
    expect(m.velocidadeMmS).toBeLessThan(7)
    m.posicionar(10, 0)
    m.avancar(1 / 60)
    expect(m.velocidadeMmS).toBeLessThan(6)
  })

  it('escória cobre a largura do cordão e conserva o volume entre as células', () => {
    const larga = new Escoria15(), ponto = new Escoria15()
    larga.depositar(75, 0, 2, 4)
    ponto.depositar(75, 0, 2)
    expect(larga.quantidade.filter(q => q > 0).length).toBeGreaterThan(4)
    expect(larga.cobertura).toBeCloseTo(ponto.cobertura)
    expect(larga.areaMm2).toBeCloseTo(larga.cobertura * 9)
    expect(larga.fracaoQuente).toBe(1)
    larga.esfriar(6)
    expect(larga.fracaoQuente).toBe(0)
  })

  it('cordão inteiro coberto pode ser limpo com martelinho e escova ao longo do caminho', () => {
    const m = aberto(2.5)
    m.compensar = true
    for (let i = 0; i < 300; i++) { m.xMm += 0.05; m.avancar(1 / 60) }
    m.soltar()
    m.avancar(6)
    for (let x = 70; x <= 95; x += 3) m.escoria.martelar(x, 0)
    for (let x = 70; x <= 95; x += 3) m.escoria.escovar(x, 0)
    expect(m.escoria.cobertura).toBeLessThan(1e-9)
  })

  it('mostra teclas com nomes legíveis', () => {
    expect(nomeTecla15('Space')).toBe('Espaço')
    expect(nomeTecla15('KeyS')).toBe('S')
    expect(nomeTecla15('Digit4')).toBe('4')
    expect(nomeTecla15('ArrowUp')).toBe('↑')
  })
})

describe('altura sem botão e arco tolerante (H71–H72)', () => {
  it('H72: rampa de altura — toque curto move pouco, segurar chega à velocidade máxima', () => {
    expect(velocidadeAltura15(0, 6)).toBe(0)
    expect(velocidadeAltura15(0.05, 6)).toBeLessThan(2.5)
    expect(velocidadeAltura15(0.6, 6)).toBeCloseTo(6)
    expect(velocidadeAltura15(5, 6)).toBeCloseTo(6)
    expect(velocidadeAltura15(0.3, 0.8)).toBeLessThanOrEqual(0.8)
  })

  it('H72: com abrirAoTocar, o toque abre o arco mesmo descendo; continuar empurrando contra a poça gruda', () => {
    const toque = new Acionamento15('eletrodo'), empurra = new Acionamento15('eletrodo')
    for (const m of [toque, empurra]) { m.abrirAoTocar = true; m.pressionado = true; m.definirDistancia(0.2) }
    toque.avancar(1 / 60, -6)
    expect(toque.estado).toBe('arco')
    expect(toque.faixaArco).toBe('adequado')
    for (let i = 0; i < 120; i++) empurra.avancar(1 / 60, -6)
    expect(empurra.estado).toBe('grudado')
    expect(empurra.tempoArcoS).toBeGreaterThan(0)
  })

  it('H71: arco esticado aguenta um instante e apaga; voltar logo reacende sem novo toque', () => {
    const m = aberto(2.5)
    m.definirDistancia(6)
    m.avancar(0.1)
    expect(m.estado).toBe('arco')
    expect(m.esticado).toBe(true)
    m.avancar(0.4)
    expect(m.estado).toBe('pronto')
    m.avancar(0.3)
    expect(m.estado).toBe('pronto')
    m.definirDistancia(2.5)
    m.avancar(1 / 60)
    expect(m.estado).toBe('arco')
  })

  it('H71: ponta fria não reacende sozinha; acima de 1,5 × o limite apaga na hora', () => {
    const m = aberto(2.5)
    m.definirDistancia(8)
    m.avancar(1 / 60)
    expect(m.estado).toBe('pronto')
    m.avancar(2)
    m.definirDistancia(2.5)
    m.avancar(1 / 60)
    expect(m.estado).toBe('pronto')
  })

  it('conta o tempo de arco por faixa de comprimento', () => {
    const m = aberto(2.5)
    m.compensar = true
    m.avancar(1)
    expect(m.tempoFaixaS.adequado).toBeGreaterThan(0.9)
    expect(m.tempoFaixaS.longo).toBe(0)
  })
})

describe('jogabilidade da altura com toques curtos (H70–H72)', () => {
  /**
   * Jogador simulado a 60 quadros/s: vê a distância com atraso de reação e
   * segura S quando o arco passa de `alto`, soltando abaixo de `baixo`.
   */
  function jogar(corrente: number, assistencia: number, alto = 3, baixo = 2.2, reacaoS = 0.2) {
    const m = new Acionamento15('eletrodo')
    m.abrirAoTocar = true
    m.assistencia = assistencia
    m.regular(corrente)
    m.posicionar(5, 0)
    m.pressionado = true
    m.definirDistancia(0.2)
    let segurado = 0, apertando = false, espera = -1, quadrosArco = 0, quadros = 0, toques = 0
    const dt = 1 / 60
    for (let i = 0; i < 60 * 40 && m.estado !== 'fim'; i++) {
      if (!apertando && espera < 0 && m.distanciaMm > alto) espera = reacaoS
      if (espera >= 0) { espera -= dt; if (espera < 0) { apertando = true; toques++ } }
      if (apertando && m.distanciaMm < baixo) apertando = false
      segurado = apertando ? segurado + dt : 0
      m.xMm += 2.5 * dt
      m.avancar(dt, -velocidadeAltura15(segurado, 6))
      quadros++
      if (m.estado === 'arco') quadrosArco++
    }
    const t = m.tempoFaixaS
    return { m, fracaoArco: quadrosArco / quadros, adequado: t.adequado / (t.curto + t.adequado + t.longo), toques, segundos: quadros * dt }
  }

  it('com a ajuda parcial, poucos toques em S mantêm o arco a vareta inteira, sem grudar', () => {
    for (const a of [80, 100, 130]) {
      const r = jogar(a, 0.8)
      expect(r.m.grudadas).toBe(0)
      expect(r.fracaoArco).toBeGreaterThan(0.97)
      expect(r.adequado).toBeGreaterThan(0.8)
      // Um toque a cada segundo ou mais: dá para soldar sem martelar a tecla.
      expect(r.toques / r.segundos).toBeLessThan(1.2)
    }
  })

  it('sem ajuda (eletrodo real) ainda é possível, segurando S mais vezes', () => {
    const r = jogar(90, 0)
    expect(r.m.grudadas).toBe(0)
    expect(r.fracaoArco).toBeGreaterThan(0.95)
    expect(r.toques / r.segundos).toBeGreaterThan(jogar(90, 0.8).toques / jogar(90, 0.8).segundos)
  })

  it('um toque curto desce poucos décimos de milímetro', () => {
    const m = new Acionamento15('eletrodo')
    m.definirDistancia(3)
    let segurado = 0
    for (let i = 0; i < 6; i++) { segurado += 1 / 60; m.avancar(1 / 60, -velocidadeAltura15(segurado, 6)) }
    expect(3 - m.distanciaMm).toBeGreaterThan(0.15)
    expect(3 - m.distanciaMm).toBeLessThan(0.45)
  })
})

describe('superfície da junta', () => {
  it('no filete a distância é medida até a parede a 45°, não até o plano da raiz', () => {
    const m = new Acionamento15('eletrodo')
    m.superficie = n => Math.abs(n)
    m.posicionar(75, 0)
    m.definirDistancia(3)
    m.posicionar(75, 2)
    expect(m.distanciaMm).toBeCloseTo(1)
    m.definirDistancia(3)
    expect(m.distanciaMm).toBeCloseTo(3)
  })
})

describe('curto breve (H72)', () => {
  it('encostar na poça e soltar S: a ponta queima de volta e o arco volta, mesmo com ajuda total', () => {
    const m = new Acionamento15('eletrodo')
    m.abrirAoTocar = true
    m.compensar = true
    m.pressionado = true
    m.definirDistancia(0.2)
    m.avancar(1 / 60)
    expect(m.estado).toBe('arco')
    for (let i = 0; i < 30; i++) m.avancar(1 / 60, -6)
    expect(m.estado).toBe('contato')
    for (let i = 0; i < 30; i++) m.avancar(1 / 60, 0)
    expect(m.estado).toBe('arco')
    expect(m.grudadas).toBe(0)
  })
})
