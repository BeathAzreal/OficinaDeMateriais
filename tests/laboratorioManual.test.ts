import { describe, expect, it } from 'vitest'
import { ataqueDoTempo, Cortadeira, desfoque, emFoco, LixamentoManual, pontoDeFoco, PolimentoManual, PREPARO } from '../src/laboratorio/preparo'
import { limitacoesPreparo } from '../src/setores/laboratorio/motor/metalografia'

/** Passa a lixa até completar (girando antes, como manda a regra). */
function lixarTudo(l: LixamentoManual, grau: 220 | 600 | 1200, girar = true) {
  l.trocarLixa(grau)
  if (girar) l.girar()
  for (let i = 0; i < 400 && !l.completa(grau); i++) l.passar(20)
}

describe('Laboratório: ações manuais (H109)', () => {
  it('sequência completa 220 → 600 → 1200 dá "lixa-1200" e apaga os riscos das anteriores', () => {
    const l = new LixamentoManual()
    lixarTudo(l, 220); lixarTudo(l, 600); lixarTudo(l, 1200)
    expect(l.resultado).toBe('lixa-1200')
    expect(l.riscosVisiveis(220)).toBe(0)
    expect(l.riscosVisiveis(600)).toBe(0)
  })

  it('pular a lixa 600 conta como "lixa-220": com polimento, o motor acusa arrancamento', () => {
    const l = new LixamentoManual()
    lixarTudo(l, 220); lixarTudo(l, 1200)
    expect(l.resultado).toBe('lixa-220')
    const lim = limitacoesPreparo({ lixamento: l.resultado!, polimento: 'diamante-6-1', ataque: 'nital-5s' })
    expect(lim.map((x) => x.id)).toContain('mg-arrancamento')
  })

  it('sem girar 90° ao trocar de lixa, precisa de muito mais passadas', () => {
    const contar = (girar: boolean) => {
      const l = new LixamentoManual()
      lixarTudo(l, 220)
      l.trocarLixa(600)
      if (girar) l.girar()
      let n = 0
      while (!l.completa(600)) { l.passar(20); n++ }
      return n
    }
    expect(contar(false)).toBeGreaterThan(1.5 * contar(true))
  })

  it('polimento só conta com movimento; 6 µm e depois 1 µm', () => {
    const p = new PolimentoManual()
    p.trocarPasta(6)
    p.polir(20, false)
    expect(p.resultado).toBe('nenhum')
    p.polir(PREPARO.poliS[6], true)
    expect(p.resultado).toBe('diamante-6')
    p.trocarPasta(1); p.polir(PREPARO.poliS[1], true)
    expect(p.resultado).toBe('diamante-6-1')
  })

  it('ataque pelo tempo: rápido demais não revela, longo demais é sobreataque', () => {
    expect(ataqueDoTempo(1)).toBe('nenhum')
    expect(ataqueDoTempo(5)).toBe('nital-5s')
    expect(ataqueDoTempo(20)).toBe('nital-30s')
    expect(limitacoesPreparo({ lixamento: 'lixa-1200', polimento: 'diamante-6-1', ataque: ataqueDoTempo(20) }).map((x) => x.id)).toContain('mg-sobreataque')
  })

  it('foco: tolerância mais apertada no aumento maior; fora dela a imagem borra', () => {
    const alvo = pontoDeFoco('AM-01/P1', 500)
    expect(alvo).toBe(pontoDeFoco('AM-01/P1', 500))
    expect(emFoco(alvo + 0.5, alvo, 500)).toBe(true)
    expect(emFoco(alvo + 1.5, alvo, 500)).toBe(false)
    expect(emFoco(alvo + 1.5, alvo, 10)).toBe(true)
    expect(desfoque(alvo + 5, alvo, 500)).toBeGreaterThan(0)
  })

  it('cortadeira: avanço rápido trava o disco; sem refrigeração trava mais cedo', () => {
    const c = new Cortadeira()
    c.avancar(PREPARO.corte.avancoMaxMmS * 0.8, 0.1, false)
    expect(c.travou).toBe(true)
    const d = new Cortadeira()
    for (let t = 0; t < 20 && !d.pronto; t += 0.1) d.avancar(PREPARO.corte.avancoMaxMmS * 0.8, 0.1, true)
    expect(d.pronto).toBe(true)
    expect(d.travou).toBe(false)
  })
})
