import { telaRede } from '../rede/tela'
import type { App } from '../app'
import { menuOficina } from '../componentes/menuOficina'
import { telaHistoria } from './historia'
import { telaArcade } from './arcade'
import { telaTorneios } from './torneio'
import { telaMenu } from './menu'

export function telaCentralArcade(app: App): void {
  menuOficina(app, 'ARCADE', 'OFICINA / PARTIDAS', [
    { nome: 'HISTÓRIA', descricao: 'Missões e encomendas organizadas em capítulos.', abrir: () => telaHistoria(app) },
    { nome: 'DESAFIOS', descricao: 'Desafios sorteados, três vidas e recordes.', abrir: () => telaArcade(app) },
    { nome: 'DUELO ONLINE', descricao: 'Jogue pelo navegador com outra pessoa: crie uma sala e compartilhe o convite, sem instalação.', abrir: () => telaRede(app) },
    { nome: 'VERSUS', descricao: 'Disputa local por turnos, com participantes e rodadas.', abrir: () => telaTorneios(app) },
  ], { nome: 'VOLTAR AO MENU', descricao: 'Voltar ao início da oficina.', abrir: () => telaMenu(app) })
}
