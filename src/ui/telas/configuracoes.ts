import { menuOficina } from '../componentes/menuOficina'
import { abrirPainel } from '../dialogo'
import { COLECOES, PREFIXO } from '../../dados/armazenamento'
import { dadosManufaturaIniciais } from '../../dados/manufatura'
import { PREFERENCIAS_PADRAO } from '../../dados/preferencias'
import { DISPOSITIVOS, NOME_DISPOSITIVO, type Dispositivo } from '../../entrada/tipos'
import type { App } from '../app'
import { montarControles } from '../componentes/controles'
import { montarCalibracao } from '../componentes/calibracao'
import { somArco } from '../som'
import { configurarControles15 } from '../componentes/controles15'
import { carregarControles15 } from '../../dados/controles15'
import { confirmar, pedirTexto } from '../dialogo'
import { anexar, h } from '../dom'
import { webglDisponivel } from '../../render/palco3d'
import { NOME_QUALIDADE, QUALIDADES, RESUMO_QUALIDADE, type Qualidade3D } from '../../render/qualidade3d'
import { telaMenu } from './menu'

/** Preferências do jogo, separadas da bancada de treino. */
export function montarConfiguracoes(app: App, duranteJogo = false, secoes?: string[]): HTMLElement {
    const caixa = h('div', { class: 'config-paineis' })
    const redesenhar = () => caixa.replaceChildren(...montarConfiguracoes(app, duranteJogo, secoes).childNodes)
    const dispositivo = h('select', { id: 'pref-dispositivo' }, DISPOSITIVOS.map(d => h('option', { value: d, selected: d === app.preferencias.dispositivo }, NOME_DISPOSITIVO[d])))
    dispositivo.addEventListener('change', () => {
      app.preferencias.dispositivo = dispositivo.value as Dispositivo
      app.salvar('preferencias')
      redesenhar()
    })
    const som = h('input', { type: 'checkbox', checked: app.preferencias.som })
    som.addEventListener('change', () => {
      app.preferencias.som = som.checked
      somArco.ligado = som.checked
      if (!som.checked) somArco.calar()
      app.salvar('preferencias')
      const topo = document.getElementById('botao-som')
      if (topo) topo.textContent = som.checked ? '🔊 Som' : '🔇 Som'
      topo?.setAttribute('aria-pressed', String(som.checked))
    })

    const restaurar = async () => {
      if (!(await confirmar('Restaurar calibração?', 'Sensibilidade, zona morta, botões, opções da caneta e controles da câmera e da peça voltam ao padrão.'))) return
      const p = app.preferencias
      // O visual 3D não é calibração: fica como estava.
      app.preferencias = { ...PREFERENCIAS_PADRAO, ultimoNome: p.ultimoNome, dispositivo: p.dispositivo, qualidade3d: p.qualidade3d }
      app.salvar('preferencias')
      redesenhar()
    }
    const apagarTudo = async () => {
      const texto = await pedirTexto('Apagar todos os dados?', 'Recordes, torneios, avaliações, preferências e o projeto da Manufatura Aditiva deste navegador serão apagados. Para confirmar, escreva APAGAR.')
      if (texto !== 'APAGAR') return
      for (const c of COLECOES) app.repo.apagar(c)
      app.recordes = []
      app.recordesArcade = []
      app.perfis = []
      app.tentativas = []
      app.entregas = []
      app.torneios = []
      app.avaliacoes = []
      app.preferencias = { ...PREFERENCIAS_PADRAO }
      app.manufatura = dadosManufaturaIniciais()
      app.avisar('Todos os dados deste navegador foram apagados.')
      telaMenu(app)
    }

    // Visual da soldagem (3D): a qualidade só muda o custo do desenho.
    const temWebgl = webglDisponivel()
    const qualidade = h('select', { id: 'pref-qualidade3d', disabled: !temWebgl }, QUALIDADES.map((q) => h('option', { value: q, selected: q === app.preferencias.qualidade3d }, NOME_QUALIDADE[q])))
    const resumo = h('p', { class: 'dica' }, RESUMO_QUALIDADE[app.preferencias.qualidade3d])
    qualidade.addEventListener('change', () => {
      app.preferencias.qualidade3d = qualidade.value as Qualidade3D
      resumo.textContent = RESUMO_QUALIDADE[app.preferencias.qualidade3d]
      app.salvar('preferencias')
    })
    const cartaoVisual = h(
      'section',
      { class: 'cartao opcoes-visual' },
      h('h3', {}, 'Visual da soldagem'),
      h('div', { class: 'campo' }, h('label', { for: 'pref-qualidade3d' }, 'Qualidade do 3D'), qualidade),
      resumo,
      h(
        'p',
        { class: 'dica' },
        temWebgl
          ? 'Só muda o desenho: a mira, o cordão e a pontuação não mudam. Se o 3D ficar lento, o jogo baixa a qualidade sozinho.'
          : 'Este navegador não oferece WebGL: o jogo usa um desenho 2D de reserva.',
      ),
    )

    const outros = h(
      'div',
      {},
      h(
        'div',
        { class: 'config-opcoes grade-cartoes' },
        cartaoVisual,
        h('section', { class: 'cartao' }, h('h3', {}, 'Calibração'), h('p', {}, 'O dispositivo escolhido aqui vira o padrão das partidas. Ajuste a sensibilidade e os botões abaixo; pratique depois em Treino.'), h('button', { type: 'button', class: 'botao-secundario', on: { click: restaurar } }, 'Restaurar calibração padrão')),
        h(
          'section',
          { class: 'cartao' },
          h('h3', {}, 'Dados salvos'),
          h('p', {}, `Ficam só neste navegador (chaves "${PREFIXO}…"), separados em participantes, tentativas, entregas, torneios, avaliações, recordes e preferências. As partidas online enviam os dados necessários à sala e à avaliação no servidor.`),
          h('p', { class: 'dica' }, 'Limpar os dados do site no navegador apaga tudo.'),
          h('button', { type: 'button', class: 'perigo', on: { click: apagarTudo } }, 'Apagar todos os dados'),
        ),
      ),
    )

    const calibracao = montarCalibracao(app, app.preferencias.dispositivo, () => null, redesenhar)
    calibracao.elemento.querySelector('h4')?.remove()
    anexar(caixa,
        h('section', { class: 'cartao' }, h('h3', {}, 'Som e dispositivo'),
          h('label', {}, som, ' Som do arco'),
          h('div', { class: 'campo' }, h('label', { for: 'pref-dispositivo' }, 'Dispositivo padrão'), dispositivo)),
        h('section', { class: 'cartao' }, h('h3', {}, 'Câmera e peça'), montarControles(app)),
        h('section', { class: 'cartao' }, h('h3', {}, 'Calibração do dispositivo'), calibracao.elemento),
        h('section', { class: 'cartao' }, h('h3', {}, 'Eletrodo revestido'), h('p', {}, 'Teclas de altura, orientação da vareta, câmera e ferramentas.'), h('button', { type: 'button', class: 'botao-secundario', on: { click: () => { void configurarControles15(carregarControles15()) } } }, 'Configurar controles do eletrodo')),
        outros)
    if (duranteJogo) {
      caixa.querySelector('.config-opcoes')?.children[1]?.remove()
      caixa.querySelector('.config-opcoes')?.lastElementChild?.remove()
      const seletor = caixa.querySelector<HTMLSelectElement>('#pref-dispositivo')
      if (seletor) { seletor.disabled = true; seletor.title = 'Troque o dispositivo antes de iniciar outra tentativa.' }
    }
    if (secoes) caixa.querySelectorAll('section').forEach(secao => { if (!secoes.includes(secao.querySelector('h3')?.textContent ?? '')) secao.remove() })
    return caixa
}

export function telaConfiguracoes(app: App): void {
  const abrir = (nome: string, secoes: string[]) => {
    telaConfiguracoes(app)
    const painel = montarConfiguracoes(app, false, secoes)
    void abrirPainel(nome, painel)
  }
  menuOficina(app, 'CONFIGURAÇÕES', 'OFICINA / AJUSTES', [
    { nome: 'SOM E DISPOSITIVO', descricao: 'Som do arco e dispositivo padrão das próximas partidas.', abrir: () => abrir('Som e dispositivo', ['Som e dispositivo']) },
    { nome: 'CONTROLES', descricao: 'Botões, teclas, câmera e calibração de mouse, caneta e controle.', abrir: () => abrir('Controles', ['Câmera e peça', 'Calibração do dispositivo', 'Eletrodo revestido', 'Calibração']) },
    { nome: 'VISUAL', descricao: 'Qualidade do desenho 3D.', abrir: () => abrir('Visual', ['Visual da soldagem']) },
    { nome: 'DADOS SALVOS', descricao: 'Informações e gerenciamento dos dados deste navegador.', abrir: () => abrir('Dados salvos', ['Dados salvos']) },
  ], { nome: 'VOLTAR AO MENU', descricao: 'Voltar ao início da oficina.', abrir: () => telaMenu(app) })
}
