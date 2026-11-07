import { armazenamentoDoNavegador, novoId, Repositorio, type Colecao } from '../dados/armazenamento'
import { dadosManufaturaIniciais, validarDadosManufatura, type DadosManufatura } from '../dados/manufatura'
import { dadosFabricaIniciais, validarDadosFabrica, type DadosFabrica } from '../fabrica/ordens'
import { validarPerfis, type PerfilParticipante } from '../dados/participantes'
import { PREFERENCIAS_PADRAO, validarPreferencias, type Preferencias } from '../dados/preferencias'
import { validarListaRecordes, type Recorde } from '../dados/recordes'
import { validarListaArcade, type RecordeArcade } from '../dados/recordesArcade'
import {
  marcarInterrompidas,
  recortarBase,
  type Ambiente,
  type Avaliacao,
  type BaseTorneio,
  type Entrega,
  type TentativaRegistro,
  type Torneio,
} from '../dados/torneio'
import { esconderCenario, lugarDaTela, mostrarCenario } from './cenario'
import { h } from './dom'

/*
 * Estado da aplicação: dados carregados do navegador, gravação e navegação
 * entre telas. Cada tela é uma função que monta o DOM em `app.raiz` e pode
 * devolver uma função de limpeza.
 */

export type Tela = (app: App) => void | (() => void)

function validarListaComId<T>(dados: unknown): T[] | null {
  if (!Array.isArray(dados)) return null
  return dados.filter((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') as T[]
}

export class App {
  readonly raiz = document.getElementById('app') as HTMLElement
  readonly repo: Repositorio
  readonly persistente: boolean
  recordes: Recorde[] = []
  recordesArcade: RecordeArcade[] = []
  perfis: PerfilParticipante[] = []
  tentativas: TentativaRegistro[] = []
  entregas: Entrega[] = []
  torneios: Torneio[] = []
  avaliacoes: Avaliacao[] = []
  preferencias: Preferencias = { ...PREFERENCIAS_PADRAO }
  /** Projeto da Manufatura Aditiva (v2.1). */
  manufatura: DadosManufatura = dadosManufaturaIniciais()
  /** Ordens de serviço da fábrica (v2.2). */
  fabrica: DadosFabrica = dadosFabricaIniciais()
  readonly ambiente: Ambiente = {
    agora: () => new Date(),
    aleatorio: () => {
      const v = new Uint32Array(1)
      crypto.getRandomValues(v)
      return v[0] / 2 ** 32
    },
    novoId,
  }
  jogoPausado = false
  controlePausa: { pausar: () => void; retomar: () => void } | null = null
  escolherOutraPeca: (() => void) | null = null
  voltarArcade: () => void = () => {}
  abrirPausa: () => void = () => {}
  fecharPausa: () => void = () => {}
  private limpeza: (() => void) | null = null
  /** Pergunta antes de sair da tela atual (ex.: tentativa oficial em andamento). */
  guardaSaida: (() => Promise<boolean>) | null = null

  constructor() {
    const { armazenamento, persistente } = armazenamentoDoNavegador()
    this.repo = new Repositorio(armazenamento)
    this.persistente = persistente
    if (!persistente) this.avisar('Este navegador bloqueou o armazenamento local: nada será salvo ao fechar a página.')
    this.carregar()
  }

  private carregar(): void {
    const ler = <T>(c: Colecao, padrao: T, validar: (d: unknown) => T | null): T => {
      const r = this.repo.ler(c, padrao, validar)
      if (r.aviso) this.avisar(r.aviso)
      return r.dados
    }
    this.recordes = ler('recordes', [], validarListaRecordes)
    this.recordesArcade = ler('recordesArcade', [], validarListaArcade)
    this.perfis = ler('participantes', [], validarPerfis)
    this.tentativas = ler('tentativas', [], validarListaComId<TentativaRegistro>)
    this.entregas = ler('entregas', [], validarListaComId<Entrega>)
    this.torneios = ler('torneios', [], validarListaComId<Torneio>)
    this.avaliacoes = ler('avaliacoes', [], validarListaComId<Avaliacao>)
    this.preferencias = ler('preferencias', { ...PREFERENCIAS_PADRAO }, (d) => validarPreferencias(d))
    this.manufatura = ler('manufatura', dadosManufaturaIniciais(), validarDadosManufatura)
    this.fabrica = ler('fabrica', dadosFabricaIniciais(), validarDadosFabrica)

    // Página recarregada no meio de uma tentativa oficial: ela conta como interrompida.
    for (const t of this.torneios) {
      const r = marcarInterrompidas(this.baseDoTorneio(t.id))
      if (r.alteradas) {
        this.gravarBase(r.base)
        this.avisar(`Torneio "${t.config.nome}": ${r.alteradas} tentativa(s) em andamento foram marcadas como interrompidas e contam no limite.`)
      }
    }
  }

  salvar(colecao: Colecao): void {
    const dados: Record<Colecao, unknown> = {
      recordes: this.recordes,
      recordesArcade: this.recordesArcade,
      participantes: this.perfis,
      tentativas: this.tentativas,
      entregas: this.entregas,
      torneios: this.torneios,
      avaliacoes: this.avaliacoes,
      preferencias: this.preferencias,
      manufatura: this.manufatura,
      fabrica: this.fabrica,
    }
    const r = this.repo.gravar(colecao, dados[colecao])
    if (!r.ok) this.avisar(r.erro)
  }

  baseDoTorneio(id: string): BaseTorneio {
    const t = this.torneios.find((x) => x.id === id)
    if (!t) throw new Error('Torneio não encontrado.')
    return recortarBase(t, { participantes: this.perfis, tentativas: this.tentativas, entregas: this.entregas, avaliacoes: this.avaliacoes })
  }

  /** Grava um torneio inteiro depois de uma ação (salva após cada ação relevante). */
  gravarBase(b: BaseTorneio): void {
    const id = b.torneio.id
    this.torneios = [...this.torneios.filter((t) => t.id !== id), b.torneio]
    const ids = new Set(b.participantes.map((p) => p.id))
    this.perfis = [...this.perfis.filter((p) => !ids.has(p.id)), ...b.participantes.map((p) => ({ ...p, origem: 'torneio' as const }))]
    this.tentativas = [...this.tentativas.filter((t) => t.torneioId !== id), ...b.tentativas]
    this.entregas = [...this.entregas.filter((e) => e.torneioId !== id), ...b.entregas]
    this.avaliacoes = [...this.avaliacoes.filter((a) => a.torneioId !== id), ...b.avaliacoes]
    for (const c of ['torneios', 'participantes', 'tentativas', 'entregas', 'avaliacoes'] as Colecao[]) this.salvar(c)
  }

  excluirTorneio(id: string): void {
    const t = this.torneios.find((x) => x.id === id)
    this.torneios = this.torneios.filter((x) => x.id !== id)
    this.tentativas = this.tentativas.filter((x) => x.torneioId !== id)
    this.entregas = this.entregas.filter((x) => x.torneioId !== id)
    this.avaliacoes = this.avaliacoes.filter((x) => x.torneioId !== id)
    if (t) this.perfis = this.perfis.filter((p) => !t.participanteIds.includes(p.id))
    for (const c of ['torneios', 'participantes', 'tentativas', 'entregas', 'avaliacoes'] as Colecao[]) this.salvar(c)
  }

  avisar(texto: string): void {
    const caixa = document.getElementById('avisos')!
    const aviso = h('div', { class: 'aviso-item' }, h('span', {}, texto), h('button', { type: 'button', 'aria-label': 'Fechar aviso', on: { click: () => aviso.remove() } }, '×'))
    caixa.append(aviso)
  }

  /** Mostra uma tela (fazendo a limpeza da anterior) e põe o foco no título. */
  async ir(tela: Tela, contexto = ''): Promise<void> {
    if (this.guardaSaida && !(await this.guardaSaida())) return
    this.guardaSaida = null
    this.fecharPausa()
    this.jogoPausado = false
    this.controlePausa = null
    this.escolherOutraPeca = null
    this.limpeza?.()
    this.limpeza = null
    this.raiz.replaceChildren()
    this.raiz.classList.remove('app-cheia', 'tela-bancada', 'tela-resultado', 'tela-julgamento', 'tela-inicio')
    document.getElementById('topo-contexto')!.textContent = contexto
    const nome = contexto.toLocaleLowerCase('pt-BR')
    const rota = /fábrica/.test(nome) ? 'fabrica' : /torneio|versus|julgamento|professor/.test(nome) ? 'arcade'
      : /treino/.test(nome) ? 'treino' : /arcade/.test(nome) ? 'arcade'
      : /história|historia|missão|capítulo/.test(nome) ? 'arcade'
      : /recordes/.test(nome) ? 'recordes' : /configura/.test(nome) ? 'config' : 'inicio'
    document.querySelectorAll<HTMLElement>('[data-rota]').forEach(botao => {
      if (botao.dataset.rota === rota) botao.setAttribute('aria-current', 'page')
      else botao.removeAttribute('aria-current')
    })
    const r = tela(this)
    // A fábrica tem 3D, mas é um painel de navegação: mantém o topo e a barra lateral.
    const imersivo = !!this.raiz.querySelector('canvas') && !this.raiz.querySelector('.fabrica, .menu3d-canvas')
    document.body.classList.toggle('jogo-imersivo', imersivo)
    const paginaArcade = rota === 'arcade' && !imersivo && !document.body.classList.contains('menu-grafico')
    document.body.classList.toggle('arcade-interno', paginaArcade)
    // Cenário 3D atrás das telas de menu; telas de jogo com o próprio 3D o escondem.
    const telaDeMenu = !imersivo && (document.body.classList.contains('menu-grafico') || paginaArcade)
    if (!telaDeMenu) esconderCenario()
    else if (!this.raiz.classList.contains('menu-3d')) mostrarCenario(lugarDaTela(nome, rota))
    if (paginaArcade) this.raiz.prepend(h('button', { type: 'button', class: 'arcade-voltar', on: { click: () => this.voltarArcade() } }, '← VOLTAR AO ARCADE'))
    if (imersivo) this.raiz.append(h('button', { type: 'button', class: 'atalho-pause', 'aria-label': 'Menu / voltar', title: 'Pausar e abrir opções para voltar ou continuar', on: { click: () => this.abrirPausa() } }, '← Menu / voltar', h('kbd', {}, 'Esc')))
    if (typeof r === 'function') this.limpeza = r
    this.raiz.querySelector<HTMLElement>('.tela-titulo')?.focus()
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.raiz.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' })
    }
    window.scrollTo(0, 0)
  }
}
