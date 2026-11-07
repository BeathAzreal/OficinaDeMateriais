import { telaRede } from './ui/rede/tela'
import { instalarPause } from './ui/componentes/pause'
import { instalarToque } from './ui/toque'
import './estilo.css'
import './estilo-app.css'
import './estilo-v14.css'
import './estilo-oficina.css'
import './estilo-espaco.css'
import './estilo-prototipo15.css'
import './hud-maquina.css'
import { App } from './ui/app'
import { icone } from './ui/componentes/icones'
import { telaHistoria } from './ui/telas/historia'
import { telaCentralArcade } from './ui/telas/centralArcade'
import { telaTreino } from './ui/telas/treino'
import { telaTorneios } from './ui/telas/torneio'
import { telaRecordes } from './ui/telas/recordes'
import { telaConfiguracoes } from './ui/telas/configuracoes'
import { telaMenu } from './ui/telas/menu'
import { telaFabrica } from './ui/telas/fabrica'
import { abrirPainel } from './ui/dialogo'
import { h } from './ui/dom'
import { somArco } from './ui/som'

/*
 * Ponto de entrada: carrega os dados deste navegador e abre o menu.
 * O treino livre usa a mesma bancada e execução das missões, com a peça padrão.
 */
const app = new App()
instalarPause(app)
instalarToque()
app.voltarArcade = () => telaCentralArcade(app)
const rotas: Record<string, (app: App) => void> = {
  inicio: telaMenu, fabrica: (app) => telaFabrica(app), historia: telaHistoria, arcade: telaCentralArcade, treino: telaTreino,
  torneio: telaTorneios, recordes: (app) => telaRecordes(app), config: telaConfiguracoes,
}
document.querySelectorAll<HTMLButtonElement>('[data-rota]').forEach(botao => {
  const rota = botao.dataset.rota!
  botao.querySelector('.nav-icone')?.append(icone(rota === 'inicio' ? 'maquina' : rota))
  botao.addEventListener('click', () => rotas[rota]?.(app))
})
document.getElementById('botao-menu')!.addEventListener('click', () => telaMenu(app))
document.getElementById('botao-inicio')!.addEventListener('click', () => telaMenu(app))
document.getElementById('botao-info')!.addEventListener('click', () =>
  abrirPainel(
    'Sobre o modelo',
    h(
      'div',
      { class: 'texto-sobre' },
      h('p', {}, 'Este é um jogo didático com um modelo qualitativo simplificado de MIG/MAG. Os números são do jogo, não valores de processo.'),
      h('p', {}, 'A aparência do cordão não indica qualidade interna. A "integridade prevista" e o corte transversal são resultados sintéticos do modelo, não ensaios.'),
      h('p', {}, 'Requisitos das missões são objetivos didáticos fictícios; o jogo não segue norma nem concede certificação.'),
      h('p', {}, 'As hipóteses e as fontes consultadas estão em docs/HIPOTESES.md, no projeto.'),
    ),
  ),
)
// Som do arco (H45): liga/desliga no topo, lembrado nas preferências.
const botaoSom = document.getElementById('botao-som')!
const mostrarSom = () => {
  somArco.ligado = app.preferencias.som
  botaoSom.textContent = app.preferencias.som ? '🔊 Som' : '🔇 Som'
  botaoSom.setAttribute('aria-pressed', String(app.preferencias.som))
  if (!app.preferencias.som) somArco.calar()
}
botaoSom.addEventListener('click', () => {
  app.preferencias.som = !app.preferencias.som
  app.salvar('preferencias')
  mostrarSom()
})
mostrarSom()
if (new URLSearchParams(location.search).get('rede') === '1') telaRede(app)
else telaMenu(app)
