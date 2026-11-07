import { confirmar } from '../dialogo'
import { h } from '../dom'
import { CHAVE_CONTROLES15, nomeTecla15, validarControles15, type Controles15, type Acao15 } from '../../dados/controles15'

export async function configurarControles15(atual: Controles15): Promise<Controles15> {
  const c = structuredClone(atual)
  const erro = h('p', { class: 'erro', role: 'alert' })
  const conteudo = h('div', { class: 'p15-config' }, h('p', {}, 'O eletrodo não tem botão: o arco abre ao tocar a peça. Câmera e orientação são independentes. Configurações exclusivas do treino de eletrodo.'))
  const nomes: Record<Acao15, string> = { acionar: 'Golpe / escovar', aproximar: 'Descer (aproximar)', afastar: 'Subir (afastar)', azMenos: 'Direção −', azMais: 'Direção +', inclMenos: 'Inclinação −', inclMais: 'Inclinação +', rolMenos: 'Rolamento −', rolMais: 'Rolamento +' }
  for (const acao of Object.keys(nomes) as Acao15[]) {
    const campo = h('input', { type: 'text', value: nomeTecla15(c.teclas[acao]), readonly: true, 'aria-label': nomes[acao], title: 'Clique e pressione uma tecla' })
    campo.addEventListener('keydown', e => {
      e.stopPropagation()
      if (e.code === 'Tab' || e.code === 'Escape') return
      e.preventDefault()
      c.teclas[acao] = e.code
      campo.value = nomeTecla15(e.code)
    })
    conteudo.append(h('label', {}, nomes[acao], campo))
  }
  const selecionar = (nome: string, valor: string, opcoes: [string, string][], alterar: (v: string) => void) => {
    const s = h('select', { 'aria-label': nome }, opcoes.map(([v, t]) => h('option', { value: v, selected: v === valor }, t)))
    s.addEventListener('change', () => alterar(s.value))
    conteudo.append(h('label', {}, nome, s))
  }
  const botoes: [string, string][] = [['0', 'Esquerdo'], ['1', 'Meio'], ['2', 'Direito']]
  selecionar('Botão da câmera', String(c.camera), botoes, v => c.camera = Number(v))
  selecionar('Botão de orientação', String(c.ferramenta), botoes, v => c.ferramenta = Number(v))
  selecionar('Roda do mouse', c.roda, [['altura', 'Distância'], ['zoom', 'Zoom']], v => c.roda = v as Controles15['roda'])
  selecionar('Analógico direito', c.analogico, [['ferramenta', 'Orientar ferramenta'], ['camera', 'Girar câmera']], v => c.analogico = v as Controles15['analogico'])
  const numero = (nome: string, valor: number, min: number, max: number, step: number, alterar: (v: number) => void) => {
    const campo = h('input', { type: 'number', value: valor, min, max, step, 'aria-label': nome })
    campo.addEventListener('input', () => alterar(Number(campo.value)))
    conteudo.append(h('label', {}, nome, campo))
  }
  numero('Sensibilidade', c.sensibilidade, 0.1, 2, 0.1, v => c.sensibilidade = v)
  numero('Velocidade máxima de altura (mm/s)', c.velocidade, 1, 10, 0.5, v => c.velocidade = v)
  numero('Botão do controle (martelinho/escova)', c.gatilho, 0, 15, 1, v => c.gatilho = v)
  numero('Zona morta do controle', c.zona, 0.05, 0.5, 0.05, v => c.zona = v)
  for (const [chave, nome] of [['caneta', 'Usar inclinação real da caneta'], ['controle', 'Habilitar controle/gamepad']] as const) {
    const campo = h('input', { type: 'checkbox', checked: c[chave] })
    campo.addEventListener('change', () => c[chave] = campo.checked)
    conteudo.append(h('label', {}, campo, nome))
  }
  conteudo.append(h('p', {}, 'Controle padrão: esquerdo move a ponta; direito orienta; direcional regula altura; LB/RB giram o punho. Caneta usa tiltX/tiltY, se disponíveis. Sem hardware de rastreamento, mouse e gamepad são aproximações dos gestos reais.'),
    erro)
  for (;;) {
    if (!await confirmar('Controles do eletrodo', conteudo, { sim: 'Salvar controles' })) return atual
    const validado = validarControles15(c)
    if (!validado) { erro.textContent = 'Use teclas e botões diferentes para cada ação e valores dentro dos limites.'; continue }
    try { localStorage.setItem(CHAVE_CONTROLES15, JSON.stringify(validado)) } catch { /* Preferência segue válida nesta sessão. */ }
    return validado
  }
}
