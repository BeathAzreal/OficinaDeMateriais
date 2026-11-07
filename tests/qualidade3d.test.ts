import { describe, expect, it } from 'vitest'
import { PREFERENCIAS_PADRAO, validarPreferencias } from '../src/dados/preferencias'
import { MonitorQuadros, PERFIS, qualidadeAbaixo, QUALIDADES } from '../src/render/qualidade3d'

describe('preferências do visual 3D', () => {
  it('padrão: qualidade média; câmera no botão do meio, peça no direito, E/B e Espaço na caneta', () => {
    expect(PREFERENCIAS_PADRAO.qualidade3d).toBe('media')
    expect(PREFERENCIAS_PADRAO.controles).toEqual({ botaoPeca: 'direito', botaoCamera: 'meio', rodaMouse: 'zoom', teclasPeca: ['e', 'b'], teclaCamera: ' ' })
  })

  it('preferências antigas (sem os campos) ganham o padrão; valores válidos são lembrados', () => {
    const antigas = validarPreferencias({ dispositivo: 'caneta', som: false })
    expect(antigas.qualidade3d).toBe('media')
    expect(antigas.dispositivo).toBe('caneta')
    const salvas = validarPreferencias({ qualidade3d: 'alta', controles: { botaoPeca: 'meio', rodaMouse: 'camera', teclasPeca: ['R'], teclaCamera: 'c' } })
    expect(salvas.qualidade3d).toBe('alta')
    expect(salvas.controles).toEqual({ botaoPeca: 'meio', botaoCamera: 'direito', rodaMouse: 'camera', teclasPeca: ['r'], teclaCamera: 'c' })
  })

  it('valores inválidos voltam ao padrão', () => {
    const p = validarPreferencias({ qualidade3d: 'ultra', inclinacao3d: 80, visual3d: false })
    expect(p.qualidade3d).toBe('media')
    // A inclinação fixa da v1.2 virou a câmera livre: o campo antigo é ignorado.
    expect('inclinacao3d' in p).toBe(false)
    // A opção antiga "visual 3D" (o jogo agora é só 3D) é ignorada.
    expect('visual3d' in p).toBe(false)
  })
})

describe('perfis de qualidade', () => {
  it('cada nível custa menos que o de cima', () => {
    for (let i = 1; i < QUALIDADES.length; i++) {
      const baixo = PERFIS[QUALIDADES[i - 1]]
      const alto = PERFIS[QUALIDADES[i]]
      expect(baixo.pixelRatioMax).toBeLessThanOrEqual(alto.pixelRatioMax)
      expect(baixo.particulas.faiscas).toBeLessThan(alto.particulas.faiscas)
      expect(baixo.mapaSombra).toBeLessThanOrEqual(alto.mapaSombra)
    }
    expect(PERFIS.baixa.sombras).toBe(false)
    expect(PERFIS.alta.pixelRatioMax).toBeLessThanOrEqual(2)
  })

  it('descer de qualidade: alta → média → baixa → nenhuma', () => {
    expect(qualidadeAbaixo('alta')).toBe('media')
    expect(qualidadeAbaixo('media')).toBe('baixa')
    expect(qualidadeAbaixo('baixa')).toBeNull()
  })
})

describe('monitor de quadros (volta para o 2D)', () => {
  const rodar = (m: MonitorQuadros, intervalos: number[], t0 = 0) => {
    let t = t0
    let ultimo = m.registrar(t)
    for (const dt of intervalos) ultimo = m.registrar((t += dt))
    return ultimo
  }

  it('60 fps está ok; 15 fps é lento (depois do aquecimento)', () => {
    expect(rodar(new MonitorQuadros(), Array(300).fill(16.7))).toBe('ok')
    expect(rodar(new MonitorQuadros(), Array(300).fill(66))).toBe('lento')
  })

  it('30 fps (o teto de alguns painéis) não é lento', () => {
    expect(rodar(new MonitorQuadros(), Array(300).fill(33.3))).toBe('ok')
  })

  it('durante o aquecimento só mede', () => {
    expect(rodar(new MonitorQuadros(), Array(20).fill(80))).toBe('medindo')
  })

  it('aba oculta (intervalos enormes) e engasgos isolados não contam', () => {
    const intervalos = [...Array(200).fill(16.7), 5000, 4000, ...Array(30).fill(16.7)]
    for (let k = 0; k < 20; k++) intervalos.push(120) // engasgos
    intervalos.push(...Array(60).fill(16.7))
    expect(rodar(new MonitorQuadros(), intervalos)).toBe('ok')
  })

  it('reiniciar recomeça o aquecimento', () => {
    const m = new MonitorQuadros()
    expect(rodar(m, Array(300).fill(66))).toBe('lento')
    m.reiniciar()
    expect(rodar(m, Array(10).fill(66), 100000)).toBe('medindo')
  })
})
