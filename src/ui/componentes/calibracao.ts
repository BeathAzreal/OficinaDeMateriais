import { aplicarZonaMorta, descreverControle, FonteControle, type LeituraGamepad } from '../../entrada/controle'
import type { FonteEntrada } from '../../entrada/fonte'
import { FontePonteiro } from '../../entrada/ponteiro'
import type { Dispositivo } from '../../entrada/tipos'
import type { App } from '../app'
import { h, n1 } from '../dom'

/*
 * Calibração do dispositivo: ajustes salvos nas preferências e leitura ao
 * vivo do que o jogo está recebendo. Fica dentro da bancada, ao lado da peça
 * de teste — calibra-se soldando.
 */

/** Nomes do layout "standard" da Gamepad API (rótulos de PlayStation entre parênteses). */
export const NOMES_BOTOES = [
  'Botão 0 (X / Cross)', 'Botão 1 (Círculo)', 'Botão 2 (Quadrado)', 'Botão 3 (Triângulo)', 'Botão 4 (L1)', 'Botão 5 (R1)',
  'Botão 6 (L2)', 'Botão 7 (R2)', 'Botão 8 (Share)', 'Botão 9 (Options)', 'Botão 10 (L3)', 'Botão 11 (R3)',
  'Botão 12 (cima)', 'Botão 13 (baixo)', 'Botão 14 (esquerda)', 'Botão 15 (direita)', 'Botão 16 (PS)',
]

export function controlesConectados(): LeituraGamepad[] {
  if (typeof navigator.getGamepads !== 'function') return []
  return [...navigator.getGamepads()].filter((g): g is Gamepad => !!g && g.connected)
}

export interface Calibracao {
  elemento: HTMLElement
  /** Chamado a cada quadro para atualizar a leitura ao vivo. */
  atualizar: () => void
}

export function montarCalibracao(app: App, dispositivo: Dispositivo, fonte: () => FonteEntrada | null, aoMudarIndice: () => void): Calibracao {
  const prefs = app.preferencias
  const salvar = () => app.salvar('preferencias')
  const leitura = h('dl', { class: 'leitura-ao-vivo' })
  const controles = h('div', { class: 'calibracao-controles' })

  const deslizante = (rotulo: string, id: string, min: number, max: number, passo: number, valor: number, mudar: (v: number) => void) => {
    const saida = h('output', { for: id }, n1(valor))
    const entrada = h('input', { id, type: 'range', min: String(min), max: String(max), step: String(passo), value: String(valor) })
    entrada.addEventListener('input', () => {
      mudar(Number(entrada.value))
      saida.textContent = n1(Number(entrada.value))
      salvar()
    })
    return h('div', { class: 'campo-deslizante' }, h('label', { for: id }, rotulo, saida), entrada)
  }

  if (dispositivo === 'controle') {
    const lista = controlesConectados()
    const seletor = h(
      'select',
      { id: 'cal-indice' },
      lista.length ? lista.map((g) => h('option', { value: String(g.index), selected: g.index === prefs.indiceControle }, `${g.index}: ${g.id.slice(0, 48)}`)) : h('option', { value: '' }, 'Nenhum controle reconhecido'),
    )
    seletor.addEventListener('change', () => {
      prefs.indiceControle = Number(seletor.value)
      salvar()
      aoMudarIndice()
    })
    const escolhaBotao = (rotulo: string, id: string, valor: number, mudar: (v: number) => void) => {
      const s = h('select', { id }, NOMES_BOTOES.map((n, i) => h('option', { value: String(i), selected: i === valor }, n)))
      s.addEventListener('change', () => {
        mudar(Number(s.value))
        salvar()
      })
      return h('div', { class: 'campo' }, h('label', { for: id }, rotulo), s)
    }
    const inverter = h('input', { type: 'checkbox', id: 'cal-inverter', checked: prefs.controle.inverterY })
    inverter.addEventListener('change', () => {
      prefs.controle.inverterY = inverter.checked
      salvar()
    })
    // Capturar: o próximo botão pressionado vira o botão do arco.
    const capturar = h('button', { type: 'button', class: 'botao-secundario' }, 'Capturar botão do arco')
    capturar.addEventListener('click', () => {
      const inicio = performance.now()
      const antes = new Set<string>()
      for (const g of controlesConectados()) g.buttons.forEach((b, i) => b.pressed && antes.add(`${g.index}:${i}`))
      capturar.textContent = 'Pressione agora o botão desejado…'
      capturar.disabled = true
      const ouvir = () => {
        for (const g of controlesConectados()) {
          const i = g.buttons.findIndex((b, k) => (b.pressed || b.value > 0.5) && !antes.has(`${g.index}:${k}`))
          if (i >= 0) {
            prefs.controle.botaoArco = i
            salvar()
            capturar.textContent = `Botão do arco: ${NOMES_BOTOES[i] ?? `Botão ${i}`}`
            capturar.disabled = false
            const sel = document.getElementById('cal-arco') as HTMLSelectElement | null
            if (sel) sel.value = String(i)
            return
          }
        }
        if (performance.now() - inicio > 6000) {
          capturar.textContent = 'Nenhum botão detectado. Tentar de novo'
          capturar.disabled = false
          return
        }
        requestAnimationFrame(ouvir)
      }
      requestAnimationFrame(ouvir)
    })
    const info = lista.find((g) => g.index === prefs.indiceControle) ?? lista[0]
    const d = info ? descreverControle(info) : null
    controles.append(
      h('div', { class: 'campo' }, h('label', { for: 'cal-indice' }, 'Controle'), seletor),
      d
        ? h('p', { class: 'dica' }, d.padrao ? 'Mapeamento padrão reconhecido. ' : 'Mapeamento não padrão: confira os botões abaixo. ', d.pareceDualShock4 ? 'Parece um controle de PS4; o comportamento pode variar entre cabo e Bluetooth.' : '')
        : h('p', { class: 'dica' }, 'Conecte o controle e pressione um botão para o navegador reconhecê-lo.'),
      deslizante('Sensibilidade', 'cal-sens', 0.25, 2, 0.05, prefs.controle.sensibilidade, (v) => (prefs.controle.sensibilidade = v)),
      deslizante('Zona morta', 'cal-zona', 0, 0.5, 0.01, prefs.controle.zonaMorta, (v) => (prefs.controle.zonaMorta = v)),
      escolhaBotao('Abrir o arco', 'cal-arco', prefs.controle.botaoArco, (v) => (prefs.controle.botaoArco = v)),
      capturar,
      (() => {
        const s = h('select', { id: 'cal-arco-alt' }, h('option', { value: '-1', selected: prefs.controle.botaoArcoAlternativo < 0 }, 'Nenhum'), NOMES_BOTOES.map((n, i) => h('option', { value: String(i), selected: i === prefs.controle.botaoArcoAlternativo }, n)))
        s.addEventListener('change', () => {
          prefs.controle.botaoArcoAlternativo = Number(s.value)
          salvar()
        })
        return h('div', { class: 'campo' }, h('label', { for: 'cal-arco-alt' }, 'Também abre o arco'), s)
      })(),
      escolhaBotao('Precisão (mais lento)', 'cal-precisao', prefs.controle.botaoPrecisao, (v) => (prefs.controle.botaoPrecisao = v)),
      h('div', { class: 'campo' }, h('label', { for: 'cal-inverter' }, inverter, ' Inverter eixo vertical')),
    )
  } else if (dispositivo === 'caneta') {
    const usar = h('input', { type: 'checkbox', id: 'cal-pressao', checked: prefs.caneta.usarPressao })
    usar.addEventListener('change', () => {
      prefs.caneta.usarPressao = usar.checked
      salvar()
    })
    controles.append(
      h('div', { class: 'campo' }, h('label', { for: 'cal-pressao' }, usar, ' Abrir o arco só acima de uma pressão')),
      deslizante('Limiar de pressão', 'cal-limiar', 0.05, 0.95, 0.05, prefs.caneta.limiarPressao, (v) => (prefs.caneta.limiarPressao = v)),
      h('p', { class: 'dica' }, 'Sem pressão, o arco abre com a ponta encostada. A pressão nunca controla a corrente.'),
    )
  } else {
    controles.append(h('p', { class: 'dica' }, 'Mouse: o ponto da tela é o ponto da peça. Botão esquerdo abre o arco. Não há sensibilidade a ajustar.'))
  }

  const atualizar = () => {
    const f = fonte()
    if (!f) return
    const linhas: [string, string][] = [
      ['Conectado', f.conectado ? 'sim' : 'NÃO'],
      ['Gatilho', f.gatilho ? 'pressionado' : 'solto'],
    ]
    if (f instanceof FontePonteiro) linhas.push(['Último evento', f.ultimoEvento || 'nenhum ainda'])
    if (f instanceof FontePonteiro && dispositivo === 'caneta') {
      linhas.push(['Pressão', f.pressaoDisponivel && f.extras.pressao !== undefined ? n1(f.extras.pressao) : 'não informada'])
      linhas.push(['Inclinação', f.extras.inclinacaoX !== undefined ? `${f.extras.inclinacaoX}° / ${f.extras.inclinacaoY}°` : 'não informada'])
    }
    if (f instanceof FonteControle) {
      const g = f.leitura()
      linhas.push(['Controle em uso', g ? `posição ${f.indiceEmUso}: ${g.id.slice(0, 40)}` : 'nenhum — pressione um botão do controle'])
      if (g) {
        const ax = g.axes[prefs.controle.eixoX] ?? 0
        const ay = g.axes[prefs.controle.eixoY] ?? 0
        const z = aplicarZonaMorta(ax, ay, prefs.controle.zonaMorta)
        linhas.push(['Analógico', `${n1(ax)}, ${n1(ay)} → ${n1(z.x)}, ${n1(z.y)}`])
        linhas.push(['Botões', g.buttons.map((b, i) => (b.pressed ? NOMES_BOTOES[i] ?? `Botão ${i}` : null)).filter(Boolean).join(', ') || 'nenhum'])
      }
    }
    leitura.replaceChildren(...linhas.flatMap(([a, b]) => [h('dt', {}, a), h('dd', {}, b)]))
  }

  return { elemento: h('div', { class: 'calibracao' }, controles, h('h4', {}, 'Leitura ao vivo'), leitura), atualizar }
}
