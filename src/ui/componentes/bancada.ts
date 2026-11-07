import { painelMaquina } from './painelMaquina'
import { abrirPainel } from '../dialogo'
import { montarControles } from './controles'
import { GRAUS_POR_PIXEL, Gestos } from '../../entrada/gestos'
import { criarFonte } from '../../entrada/fabrica'
import { fichaMaterial, seloMaterial } from './material'
import type { FonteEntrada } from '../../entrada/fonte'
import { DISPOSITIVOS, NOME_DISPOSITIVO, type Dispositivo } from '../../entrada/tipos'
import {
  comJunta,
  comMaterial,
  contextoDaMissao,
  espessurasPara,
  descreverJunta,
  preparoPadrao,
  requisitosEfetivos,
  validarPreparo,
  type Dificuldade,
  type Missao,
  type Preparo,
} from '../../missoes/catalogo'
import { analisarFusao, DESCRICAO_ESTADO, type EstadoFusao } from '../../modelo/fusao'
import { analisarDefeitos, CONSELHO_DEFEITO, NOME_DEFEITO } from '../../modelo/defeitos'
import { GASES, MATERIAIS, materiaisDoProcesso, type MaterialId } from '../../modelo/material'
import { DBCP, EQUILIBRIO, PECA } from '../../modelo/parametros'
import {
  alimentacaoMMin,
  botaoDaAlimentacao,
  botaoDaTensao,
  correnteA,
  EXPLICA_TRANSFERENCIA,
  MAQUINA,
  modoTransferencia,
  NOME_TRANSFERENCIA,
  tensaoV,
  textoTensao,
  equilibrioArco,
  INFO_TECNICA,
  razaoEfetiva,
  taxaDeposicao,
  TECNICAS,
  type Ajustes,
  type ContextoProcesso,
  type Tecnica,
} from '../../modelo/processo'
import { semArco, Simulacao } from '../../modelo/simulacao'
import { desenharCena } from '../../render/cena'
import { Escamas, Particulas } from '../../render/efeitos'
import { geometriaDa } from '../../modelo/junta'
import { INFO_JUNTA, TIPOS_JUNTA, type TipoJunta } from '../../modelo/juntas'
import { Vista } from '../../render/vista'
import type { App } from '../app'
import { h, n0, n1, pct, substituir } from '../dom'
import { controlesConectados, montarCalibracao, type Calibracao } from './calibracao'
import { somArco } from '../som'
import { montarGiro } from './giro'
import { montarVisual3D } from './visual3d'
import { FontePonteiro } from '../../entrada/ponteiro'
import { icone } from './icones'

/*
 * Bancada: o painel da máquina ao lado de uma PEÇA DE TESTE do mesmo
 * material, onde se solda à vontade para regular tensão, alimentação,
 * técnica e o dispositivo. Nada feito na peça de teste conta.
 */

export interface ConfiguracaoTentativa {
  preparo: Preparo
  ajustes: Ajustes
  contexto: ContextoProcesso
  dispositivo: Dispositivo
}

export interface OpcoesBancada {
  serralheria?: boolean
  oficinaTreino?: boolean
  missao: Missao
  dificuldade: Dificuldade
  dispositivos?: Dispositivo[]
  inicial?: Partial<ConfiguracaoTentativa>
  /** Itens travados por regra (desafios do Arcade). */
  travas?: { ajustes?: Ajustes; preparo?: Partial<Preparo> }
  /** Deixa escolher o tipo de junta da peça de teste (Configurações, treino livre, H46). */
  escolherJunta?: boolean
  /** H104: deixa trocar a chapa (material e espessura) da peça de teste (treino livre). */
  escolherMaterial?: boolean
}

export interface Bancada {
  elemento: HTMLElement
  configuracao: () => ConfiguracaoTentativa
  problemas: () => string[]
  aoMudar: (() => void) | null
  destruir: () => void
}

const SIGLA: Record<EstadoFusao, string> = {
  adequada: 'ok',
  falta: 'falta',
  excessiva: 'excesso',
  perfuracao: 'furo',
  enchimento: 'não cheia',
  borda: 'borda',
  'sem-cordao': 'vazio',
}

export function montarBancada(app: App, op: OpcoesBancada): Bancada {
  let m = op.missao
  const material = MATERIAIS[m.material]
  const req = requisitosEfetivos(m, op.dificuldade)
  const travas = op.travas ?? {}
  // A configuração anterior pode ser de outra missão (Arcade, rodadas de torneio):
  // só aproveita arame e gás se esta missão também os oferecer.
  const padrao = preparoPadrao(m)
  const anterior = op.inicial?.preparo
  let preparo: Preparo = {
    ...padrao,
    tecnica: anterior?.tecnica ?? padrao.tecnica,
    dbcpMm: anterior?.dbcpMm ?? padrao.dbcpMm,
    diametroArameMm: anterior && m.consumiveis.diametrosMm.includes(anterior.diametroArameMm) ? anterior.diametroArameMm : padrao.diametroArameMm,
    gas: anterior && m.consumiveis.gases.includes(anterior.gas) ? anterior.gas : padrao.gas,
    oxidoRemovido: anterior && material.exigeLimpeza ? anterior.oxidoRemovido : padrao.oxidoRemovido,
    ...travas.preparo,
  }
  let ajustes: Ajustes = travas.ajustes ?? op.inicial?.ajustes ?? { alimentacao: 5, tensao: 5.5 }
  const permitidos = op.dispositivos ?? DISPOSITIVOS
  let dispositivo: Dispositivo =
    op.inicial?.dispositivo && permitidos.includes(op.inicial.dispositivo)
      ? op.inicial.dispositivo
      : permitidos.includes(app.preferencias.dispositivo)
        ? app.preferencias.dispositivo
        : permitidos[0]
  const id = Math.random().toString(36).slice(2, 8)
  const bancada: Bancada = {
    elemento: h('div'),
    configuracao: () => ({ preparo, ajustes, contexto: contextoDaMissao(m, preparo), dispositivo }),
    problemas: () => {
      const p = validarPreparo(m, preparo)
      if (dispositivo === 'controle' && controlesConectados().length === 0) p.push('Conecte o controle ou escolha outro dispositivo.')
      return p
    },
    aoMudar: null,
    destruir: () => {},
  }
  const avisar = () => bancada.aoMudar?.()

  // ------------------------------------------------------------ painel da máquina
  const chip = <T extends string | number>(grupo: string, valor: T, rotulo: string, ativo: boolean, escolher: (v: T) => void, travado = false, titulo = '') => {
    const b = h('button', { type: 'button', class: `chip${ativo ? ' ativo' : ''}`, 'aria-pressed': String(ativo), disabled: travado, title: titulo }, rotulo)
    b.addEventListener('click', () => {
      escolher(valor)
      for (const outro of b.parentElement!.querySelectorAll('.chip')) {
        outro.classList.toggle('ativo', outro === b)
        outro.setAttribute('aria-pressed', String(outro === b))
      }
    })
    b.dataset.grupo = grupo
    b.dataset.valor = String(valor)
    return b
  }
  const grupo = (titulo: string, ...filhos: (Node | null)[]) => h('div', { class: 'grupo-maquina' }, h('span', { class: 'rotulo-maquina' }, titulo), h('div', { class: 'linha-chips', role: 'group', 'aria-label': titulo }, filhos))

  const trocaContexto = () => {
    reiniciarPeca()
    atualizarLeituras()
    avisar()
    visual.recriar()
  }

  const arame = grupo(
    'Arame (diâmetro)',
    ...m.consumiveis.diametrosMm.map((d) =>
      chip('diam', d, `${n1(d)} mm`, d === preparo.diametroArameMm, (v) => {
        preparo = { ...preparo, diametroArameMm: v }
        trocaContexto()
      }, travas.preparo?.diametroArameMm !== undefined),
    ),
  )
  // H104: gás, limpeza e dica dependem da chapa; na troca de chapa (treino livre) são refeitos.
  const montarGas = () => grupo(
    'Gás de proteção',
    ...m.consumiveis.gases.map((g) =>
      chip('gas', g, `${GASES[g].nome} · ${GASES[g].processo}`, g === preparo.gas, (v) => {
        preparo = { ...preparo, gas: v }
        trocaContexto()
      }, travas.preparo?.gas !== undefined),
    ),
  )
  const gas = h('div', { style: 'display:contents' }, montarGas())
  const resumoTecnica = h('p', { class: 'dica dica-tecnica' }, INFO_TECNICA[preparo.tecnica ?? 'neutra'].resumo)
  const tecnica = grupo(
    'Técnica (inclinação da tocha)',
    ...TECNICAS.map((t: Tecnica) => {
      const b = chip('tec', t, '', (preparo.tecnica ?? 'neutra') === t, (v) => {
        preparo = { ...preparo, tecnica: v }
        resumoTecnica.textContent = INFO_TECNICA[v].resumo
        trocaContexto()
      }, travas.preparo?.tecnica !== undefined)
      b.append(icone(`tecnica-${t}`), h('span', {}, INFO_TECNICA[t].nome))
      b.classList.add('chip-icone')
      return b
    }),
  )
  // H48: distância bico de contato–peça. Muda a corrente (e o calor), não a quantidade de metal.
  const dbcp = grupo(
    'Distância bico–peça (DBCP)',
    ...DBCP.opcoesMm.map((mm) =>
      chip('dbcp', mm, `${mm} mm`, (preparo.dbcpMm ?? DBCP.referenciaMm) === mm, (v) => {
        preparo = { ...preparo, dbcpMm: v }
        trocaContexto()
      }, travas.preparo?.dbcpMm !== undefined, mm < DBCP.referenciaMm ? 'Mais perto: mais corrente e mais calor com o mesmo arame' : mm > DBCP.referenciaMm ? 'Mais longe: menos corrente e menos calor com o mesmo arame' : 'Referência do jogo'),
    ),
  )
  const montarDica = () => m.material === 'aluminio' ? h('p', { class: 'dica' }, 'Dica: no alumínio costuma-se empurrar a tocha (proteção gasosa). É só dica.') : null
  const dicaAluminio = h('div', { style: 'display:contents' }, montarDica())

  const montarLimpeza = () => {
    const mat = MATERIAIS[m.material]
    if (!mat.exigeLimpeza) return null
    const c = h('input', { type: 'checkbox', id: `bc-limpeza-${id}`, checked: preparo.oxidoRemovido })
    c.addEventListener('change', () => {
      preparo = { ...preparo, oxidoRemovido: c.checked }
      trocaContexto()
    })
    return h('div', { class: 'grupo-maquina' }, h('span', { class: 'rotulo-maquina' }, 'Preparação da junta'), h('label', { for: c.id, class: 'interruptor' }, c, h('span', {}, mat.limpeza?.acao ?? 'Remover o óxido (escova de inox)')))
  }
  const limpeza = h('div', { style: 'display:contents' }, montarLimpeza())

  // H93 (v2.0): o painel regula em volts e m/min; por dentro (e no registro) continuam as posições de botão.
  const ESCALAS = {
    tensao: { min: MAQUINA.tensaoMinV, max: MAQUINA.tensaoMaxV, passo: MAQUINA.passoV, unidade: 'V', real: tensaoV, botao: botaoDaTensao },
    alimentacao: { min: MAQUINA.alimentacaoMinMMin, max: MAQUINA.alimentacaoMaxMMin, passo: MAQUINA.passoMMin, unidade: 'm/min', real: alimentacaoMMin, botao: botaoDaAlimentacao },
  } as const
  const mostrador = (rotulo: string, chave: keyof Ajustes) => {
    const travado = !!travas.ajustes
    const e = ESCALAS[chave]
    const led = h('output', { class: 'led' }, n1(e.real(ajustes[chave])))
    const entrada = h('input', { type: 'range', id: `bc-${chave}-${id}`, min: String(e.min), max: String(e.max), step: String(e.passo), value: String(e.real(ajustes[chave])), disabled: travado, 'aria-label': `${rotulo} (${e.unidade})` })
    const aplicar = (real: number) => {
      if (sim.arcoAberto) return
      const valor = Math.min(e.max, Math.max(e.min, Math.round(real / e.passo) * e.passo))
      ajustes = { ...ajustes, [chave]: e.botao(valor) }
      entrada.value = String(valor)
      led.textContent = n1(valor)
      sim.definirAjustes(ajustes)
      atualizarLeituras()
      avisar()
    }
    entrada.addEventListener('input', () => aplicar(Number(entrada.value)))
    const menos = h('button', { type: 'button', class: 'botao-redondo', disabled: travado, 'aria-label': `Diminuir ${rotulo}` }, '−')
    const mais = h('button', { type: 'button', class: 'botao-redondo', disabled: travado, 'aria-label': `Aumentar ${rotulo}` }, '+')
    menos.addEventListener('click', () => aplicar(e.real(ajustes[chave]) - e.passo))
    mais.addEventListener('click', () => aplicar(e.real(ajustes[chave]) + e.passo))
    entradasAjuste.push(entrada, menos, mais)
    return h('div', { class: 'mostrador' }, h('label', { for: entrada.id, class: 'rotulo-maquina' }, `${rotulo} (${e.unidade})`), h('div', { class: 'mostrador-linha' }, menos, led, mais), entrada)
  }
  const entradasAjuste: (HTMLInputElement | HTMLButtonElement)[] = []
  const tensao = mostrador('Tensão', 'tensao')
  const alimentacao = mostrador('Alimentação do arame', 'alimentacao')

  const medCorrente = h('div', { class: 'medidor-preenchimento' })
  const txtCorrente = h('span', {})
  const txtMetal = h('span', {})
  const agulha = h('div', { class: 'agulha' })
  const txtEquilibrio = h('span', {})
  const txtTransferencia = h('strong', {})
  const forma = h('div', { class: 'forma-secao' })
  const atualizarLeituras = () => {
    const ctx = contextoDaMissao(m, preparo)
    const i = correnteA(ajustes, ctx)
    medCorrente.style.width = `${Math.min(100, (i / 350) * 100)}%`
    txtCorrente.textContent = `≈ ${n0(i)} A`
    txtMetal.textContent = `${n1(taxaDeposicao(ajustes, ctx))} mm³/s`
    const eq = equilibrioArco(ajustes, ctx)
    agulha.style.left = `${Math.min(100, Math.max(0, 50 + (eq.desvio / 4) * 50))}%`
    const vEq = textoTensao(eq.tensaoEquilibrio)
    txtEquilibrio.textContent = eq.condicao === 'equilibrado' ? `equilibrado (≈ ${vEq})` : `arco ${eq.condicao} · equilíbrio ≈ ${vEq}`
    txtEquilibrio.dataset.condicao = eq.condicao
    const modo = modoTransferencia(ajustes, ctx)
    txtTransferencia.textContent = NOME_TRANSFERENCIA[modo]
    txtTransferencia.dataset.modo = modo
    txtTransferencia.title = EXPLICA_TRANSFERENCIA[modo]
    // Mini corte: domo com a forma atual (altura relativa à largura).
    const r = razaoEfetiva(ajustes, ctx)
    forma.innerHTML = `<svg viewBox="0 0 100 40" aria-hidden="true"><line x1="0" y1="32" x2="100" y2="32" stroke="currentColor" opacity=".5"/><path d="M15 32 Q50 ${32 - 2 * r * 70} 85 32 Z" fill="currentColor" opacity=".85"/></svg><span>altura ≈ ${pct(r)} da largura</span>`
  }

  const maquina = h(
    'section',
    { class: 'painel-maquina', 'aria-label': 'Máquina de solda' },
    // Processo: só MIG/MAG tem modelo próprio nesta versão (eletrodo revestido e TIG ainda não).
    h('header', { class: 'maquina-topo' }, icone('maquina'), h('div', {}, h('strong', {}, 'Máquina MIG/MAG'), h('small', {}, 'Tensão constante · CC+ fixa · preparo MIG/MAG'))),
    h(
      'div',
      { class: 'maquina-grade' },
      h('div', { class: 'maquina-coluna' }, arame, gas, limpeza),
      h('div', { class: 'maquina-coluna' }, tecnica, resumoTecnica, dbcp, dicaAluminio),
    ),
    h('div', { class: 'mostradores' }, tensao, alimentacao),
    h(
      'div',
      { class: 'leituras' },
      h('div', { class: 'leitura' }, h('span', { class: 'rotulo-maquina', title: 'Numa fonte de tensão constante a corrente vem da alimentação, do arame e da DBCP: não é um botão' }, 'Corrente'), h('div', { class: 'medidor' }, medCorrente), txtCorrente),
      h('div', { class: 'leitura leitura-transferencia' }, h('span', { class: 'rotulo-maquina' }, 'Transferência'), txtTransferencia),
      h('div', { class: 'leitura' }, h('span', { class: 'rotulo-maquina' }, 'Metal por segundo'), txtMetal),
      h('div', { class: 'leitura' }, h('span', { class: 'rotulo-maquina' }, 'Equilíbrio do arco'), h('div', { class: 'escala-equilibrio' }, h('span', {}, 'curto'), h('div', { class: 'trilho' }, h('div', { class: 'zona-ok' }), agulha), h('span', {}, 'longo')), txtEquilibrio),
      h('div', { class: 'leitura' }, h('span', { class: 'rotulo-maquina' }, 'Forma da seção'), forma),
    ),
    travas.ajustes ? h('p', { class: 'aviso-trava' }, icone('cadeado'), ' Máquina pré-ajustada neste desafio: você controla só a tocha.') : null,
  )

  // ------------------------------------------------------------ peça de teste
  const canvas = h('canvas', { class: 'tela-teste', 'aria-label': 'Peça de teste: solde aqui para conferir os ajustes' })
  const areaPeca = h('div', { class: 'peca-teste-area' }, canvas)
  const opcoesGiro = () => ({ inicial: { rolagemGraus: m.montagem.rolagemGraus, giroGraus: m.montagem.giroGraus }, fixa: m.montagem.fixa, familia: INFO_JUNTA[m.geometria.junta].familia, tubo: !!m.geometria.tubo })
  const giro = montarGiro(opcoesGiro())
  const hudVel = h('strong', {}, '0,0')
  const hudLarg = h('strong', {}, '—')
  const hudCalor = h('div', { class: 'medidor-preenchimento calor' })
  const sobreGiro = h('div', { class: 'giro-sobre', title: 'Peça articulada na garra lateral: rotação limitada pelo suporte. Use a câmera para inspecionar. Posicionar a câmera só com o arco fechado: arraste com o botão direito (peça) ou o do meio (câmera), ou segure E/B (peça) ou Espaço (câmera) movendo a caneta; mude em Controles. No controle: direcional (peça) e analógico direito (câmera).' }, giro.elemento)
  areaPeca.append(
    sobreGiro,
    h(
      'div',
      { class: 'hud-sobre' },
      h('span', { class: 'hud-item' }, 'Velocidade ', hudVel, ' mm/s'),
      h('span', { class: 'hud-item' }, 'Largura ', hudLarg),
      h('span', { class: 'hud-item' }, 'Calor ', h('span', { class: 'medidor mini' }, hudCalor)),
    ),
  )
  const resumoPasse = h('div', { class: 'resumo-passe', 'aria-live': 'polite' }, h('p', { class: 'dica' }, 'Faça um passe na peça de teste: o resultado aparece aqui.'))

  const vista = new Vista()
  // H46: a junta é sempre reta; o tipo de junta muda a seção, não o traçado.
  vista.geometria = geometriaDa('reta')
  // Visual 3D da peça de teste: o mesmo da execução (preferências, qualidade, volta para o 2D).
  const visual = montarVisual3D({
    serralheria: op.serralheria,
    oficinaTreino: op.oficinaTreino,
    app,
    area: areaPeca,
    canvas,
    vista,
    peca: () => ({ contexto: sim.contexto, geometria: vista.geometria, oficinaTreino: op.oficinaTreino, serralheria: op.serralheria }),
    aoMudarMapa: () => {
      if (fonte instanceof FontePonteiro) fonte.reamostrar(performance.now())
    },
  })
  // Câmera junto do giro: um só painel no canto, nada por cima da peça.
  sobreGiro.append(visual.elemento)
  // Câmera livre e giro da peça por gestos (gestos.ts), só com o arco fechado.
  const gestos = new Gestos({
    alvo: canvas,
    controles: () => app.preferencias.controles,
    pode: () => !sim.arcoAberto,
    mover: (g, dx, dy) => (g === 'peca' ? giro.aplicar(dx * GRAUS_POR_PIXEL, dy * GRAUS_POR_PIXEL) : visual.orbitar(dx, dy)),
    aproximar: (d) => visual.aproximar(d),
    aoTerminar: () => {
      if (fonte instanceof FontePonteiro) fonte.reamostrar(performance.now())
    },
  })
  const escamas = new Escamas()
  const particulas = new Particulas()
  let sim = new Simulacao(contextoDaMissao(m, preparo))
  sim.definirAjustes(ajustes)
  let fonte: FonteEntrada | null = null
  let calibracao: Calibracao | null = null
  let inicioPasse = 0
  let arcoAntes = false

  const reiniciarPeca = () => {
    fonte?.desligar()
    sim = new Simulacao(contextoDaMissao(m, preparo))
    sim.definirAjustes(ajustes)
    inicioPasse = 0
    fonte?.ligar(sim)
    resumoPasse.replaceChildren(h('p', { class: 'dica' }, 'Peça limpa. Faça um passe para ver o resultado.'))
  }

  const ligarFonte = () => {
    fonte?.desligar()
    fonte = criarFonte(dispositivo, canvas, visual.mapa, app.preferencias, { x: 15, y: 0 }, { xMin: -5, xMax: PECA.comprimentoMm + 5, yMin: -PECA.larguraChapaMm, yMax: PECA.larguraChapaMm })
    fonte.ligar(sim)
  }

  /** Mede o passe que acabou de terminar (só o trecho percorrido nele). */
  const analisarPasse = () => {
    const pontos = sim.registro.slice(inicioPasse)
    inicioPasse = sim.registro.length
    if (pontos.length < 5) return
    const xs = pontos.map((p) => p.x)
    const x0 = Math.min(...xs) + 4
    const x1 = Math.max(...xs) - 4
    if (x1 - x0 < 10) {
      resumoPasse.replaceChildren(h('p', { class: 'dica' }, 'Passe curto demais para medir. Faça pelo menos uns 2 cm.'))
      return
    }
    const ctx = contextoDaMissao(m, preparo)
    const fusaoToda = analisarFusao(sim.cordao, sim.percurso, ctx)
    const fusao = fusaoToda.filter((p) => p.xMm >= x0 && p.xMm <= x1)
    // Defeitos visíveis deste passe (H50–H57), contando as pontas (a cratera fica no fim).
    const defeitos = analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: ctx, registro: sim.registro, eventos: sim.eventos, fusao: fusaoToda }).ocorrencias.filter((o) => o.fimMm >= x0 - 4 && o.inicioMm <= x1 + 4)
    const tiposDefeito = [...new Set(defeitos.map((o) => o.tipo))]
    const secoes = fusao.map((p) => sim.cordao.secao(sim.cordao.indiceEm(p.xMm)))
    const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)
    const larg = media(secoes.map((s) => s.larguraMm))
    const alt = media(secoes.map((s) => s.alturaMm))
    const contagem = new Map<EstadoFusao, number>()
    for (const p of fusao) contagem.set(p.estado, (contagem.get(p.estado) ?? 0) + 1)
    const principal = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const tempo = sim.percurso.permanenciaEntre(x0, x1) / 1000
    const vel = tempo > 0 ? (x1 - x0) / tempo : 0
    const veredito = (ok: boolean, texto: string) => h('span', { class: `selo-mini ${ok ? 'ok' : 'falha'}` }, ok ? '✔ ' : '✖ ', texto)
    substituir(
      resumoPasse,
      h('h4', {}, 'Último passe ', h('small', {}, '· resultado sintético do modelo, só para regular')),
      h(
        'ul',
        { class: 'chips-resultado' },
        h('li', {}, h('span', {}, 'Largura'), h('strong', {}, `${n1(larg)} mm`), veredito(larg >= req.larguraMinMm && larg <= req.larguraMaxMm, larg < req.larguraMinMm ? 'estreito' : larg > req.larguraMaxMm ? 'largo' : `${n1(req.larguraMinMm)}–${n1(req.larguraMaxMm)}`)),
        h('li', {}, h('span', {}, 'Reforço'), h('strong', {}, `${n1(alt)} mm`), veredito(alt <= req.reforcoMaxMm, alt <= req.reforcoMaxMm ? `≤ ${n1(req.reforcoMaxMm)}` : 'alto')),
        h('li', {}, h('span', {}, 'Fusão prevista'), h('strong', {}, SIGLA[principal]), veredito(principal === 'adequada', `${pct((contagem.get('adequada') ?? 0) / fusao.length)} adequada`)),
        h('li', {}, h('span', {}, 'Velocidade média'), h('strong', {}, `${n1(vel)} mm/s`)),
      ),
      (() => {
        // H44: arco fora do equilíbrio deixa o cordão irregular — diga como corrigir.
        const eq = equilibrioArco(ajustes, ctx)
        return eq.condicao === 'equilibrado'
          ? null
          : h('p', { class: 'dica dica-arco' }, eq.condicao === 'curto' ? `Arco curto demais (${textoTensao(ajustes.tensao)}, equilíbrio perto de ${textoTensao(eq.tensaoEquilibrio)}): o arame bate na poça, estala, respinga e o metal deita sem fundir as bordas. Suba a tensão ou baixe a alimentação.` : `Arco longo demais (${textoTensao(ajustes.tensao)}, equilíbrio perto de ${textoTensao(eq.tensaoEquilibrio)}): chiado, respingo, cordão achatado com mordedura e poros. Baixe a tensão ou suba a alimentação.`)
      })(),
      tiposDefeito.length ? h('p', { class: 'dica dica-defeitos' }, `Defeitos visíveis: ${tiposDefeito.map((t) => NOME_DEFEITO[t].toLowerCase()).join('; ')}. ${CONSELHO_DEFEITO[tiposDefeito[0]]}`) : null,
      principal !== 'adequada' ? h('p', { class: 'dica' }, `Previsão predominante: ${DESCRICAO_ESTADO[principal]}. ${principal === 'falta' ? `Mais calor por mm: mais tensão, mais alimentação, andar mais devagar ou puxar a tocha${sim.contexto.posicaoFixa ? '' : '; ou posicione a peça na plana ou subindo'}.` : principal === 'excessiva' || principal === 'perfuracao' ? 'Menos calor por mm: reduza alimentação ou tensão, ande mais rápido ou empurre a tocha.' : principal === 'borda' ? (INFO_JUNTA[m.geometria.junta].familia === 'filete' ? 'Mire na raiz (o canto): fora dela uma perna fica curta.' : 'Mantenha a tocha sobre a linha da junta ou alargue o cordão (mais devagar).') : principal === 'enchimento' ? 'O V não encheu: ande mais devagar ou faça outro passe por cima.' : ''}`) : null,
    )
    const detalhesPasse = resumoPasse.cloneNode(true) as HTMLElement
    detalhesPasse.className = 'resultado-passe-painel'
    resumoPasse.replaceChildren(h('button', { type: 'button', class: 'botao-fantasma', on: { click: () => { app.abrirPausa(); void abrirPainel('Análise do último passe', detalhesPasse.cloneNode(true) as HTMLElement) } } }, 'Consultar análise do último passe'))
  }

  // ------------------------------------------------------------ dispositivo
  const statusDispositivo = h('span', { class: 'status-dispositivo' })
  const gaveta = h('div', { class: 'gaveta', hidden: true })
  const botaoCalibrar = h('button', { type: 'button', class: 'botao-fantasma navegacao-de-partida', 'aria-expanded': 'false' }, icone('ajuste'), ' Calibrar')
  const segmentos = h('div', { class: 'segmentado', role: 'radiogroup', 'aria-label': 'Dispositivo de entrada' })
  const desenharSegmentos = () => {
    const temControle = controlesConectados().length > 0
    segmentos.replaceChildren(
      ...DISPOSITIVOS.map((d) => {
        const naoPermitido = !permitidos.includes(d)
        const b = h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(d === dispositivo),
            class: d === dispositivo ? 'ativo' : '',
            disabled: naoPermitido,
            title: naoPermitido ? 'Não permitido nesta prova' : NOME_DISPOSITIVO[d],
          },
          icone(d),
          h('span', {}, d === 'caneta' ? 'Caneta' : d === 'controle' ? 'Controle' : 'Mouse'),
          d === 'controle' ? h('span', { class: `ponto ${temControle ? 'ligado' : ''}`, 'aria-label': temControle ? 'conectado' : 'não conectado' }) : null,
        )
        b.addEventListener('click', () => {
          dispositivo = d
          app.preferencias.dispositivo = d
          app.salvar('preferencias')
          ligarFonte()
          desenharSegmentos()
          if (!gaveta.hidden) abrirCalibracao()
          avisar()
        })
        return b
      }),
    )
    statusDispositivo.textContent =
      dispositivo === 'controle' && !temControle
        ? 'Nenhum controle reconhecido. Conecte e PRESSIONE QUALQUER BOTÃO do controle com esta página aberta (o navegador só mostra o controle depois disso).'
        : dispositivo === 'controle'
          ? 'Analógico esquerdo move a tocha; R2 ou X abrem o arco (mude em Calibrar).'
          : dispositivo === 'caneta'
            ? 'Encoste a caneta para abrir o arco.'
            : 'Segure o botão esquerdo (ou encoste a caneta) para abrir o arco.'
  }
  const abrirCalibracao = () => {
    calibracao = montarCalibracao(app, dispositivo, () => fonte, () => ligarFonte())
    gaveta.replaceChildren(calibracao.elemento)
  }
  botaoCalibrar.addEventListener('click', () => {
    gaveta.hidden = !gaveta.hidden
    botaoCalibrar.setAttribute('aria-expanded', String(!gaveta.hidden))
    if (!gaveta.hidden) abrirCalibracao()
    else calibracao = null
  })
  const aoConectar = () => {
    desenharSegmentos()
    avisar()
  }
  window.addEventListener('gamepadconnected', aoConectar)
  window.addEventListener('gamepaddisconnected', aoConectar)
  // H49: sem foco, o arco da peça de teste fecha sem somar o tempo parado.
  const semFoco = () => sim.interromperArco()
  document.addEventListener('visibilitychange', semFoco)
  window.addEventListener('blur', semFoco)

  // Peça de teste numa faixa só (chapa, espessura e junta em listas): a área de teste fica com o espaço.
  // A descrição da junta e o resumo da chapa ficam na dica (title); a ficha da chapa abre num painel (H104).
  const selo = h('span', { style: 'display:contents' }, seloMaterial(m.material, m.geometria.espessuraMm))
  const lista = (rotulo: string, aoMudar: (v: string) => void) => {
    const s = h('select', { 'aria-label': rotulo })
    s.addEventListener('change', () => aoMudar(s.value))
    return s
  }
  const campo = (rotulo: string, ...filhos: Node[]) => h('label', { class: 'campo-peca' }, h('span', { class: 'rotulo-maquina' }, rotulo), filhos)
  const opcoes = (s: HTMLSelectElement, itens: { valor: string; texto: string; desativado?: boolean }[], atual: string) =>
    s.replaceChildren(...itens.map((i) => h('option', { value: i.valor, selected: i.valor === atual, disabled: i.desativado }, i.texto)))
  const listaChapa = lista('Chapa', (v) => {
    m = comMaterial(m, v as MaterialId, m.geometria.espessuraMm)
    const gases = m.consumiveis.gases
    preparo = { ...preparo, gas: gases.includes(preparo.gas) ? preparo.gas : gases[0], oxidoRemovido: false }
    gas.replaceChildren(montarGas())
    const novaLimpeza = montarLimpeza()
    limpeza.replaceChildren(...(novaLimpeza ? [novaLimpeza] : []))
    const novaDica = montarDica()
    dicaAluminio.replaceChildren(...(novaDica ? [novaDica] : []))
    atualizarPeca()
    giro.reiniciar(opcoesGiro())
    trocaContexto()
  })
  const listaEspessura = lista('Espessura da chapa', (v) => {
    m = comMaterial(m, m.material, Number(v))
    atualizarPeca()
    trocaContexto()
  })
  const listaJunta = lista('Tipo de junta', (v) => {
    m = comJunta(m, v as TipoJunta)
    // H104: a espessura vem do estoque da chapa escolhida.
    if (op.escolherMaterial) m = comMaterial(m, m.material)
    atualizarPeca()
    giro.reiniciar(opcoesGiro())
    trocaContexto()
  })
  const juntaFixa = h('strong', {})
  const botaoFicha = h('button', { type: 'button', class: 'botao-fantasma', title: 'Características da chapa: calor, aquecimento, deformação' }, icone('info'), ' Ficha')
  botaoFicha.addEventListener('click', () => abrirPainel(MATERIAIS[m.material].nome, fichaMaterial(m.material, { espessuraMm: m.geometria.espessuraMm })))
  /** Listas, selo e dicas da peça atual. */
  function atualizarPeca(): void {
    selo.replaceChildren(seloMaterial(m.material, m.geometria.espessuraMm))
    selo.title = MATERIAIS[m.material].ficha.resumo
    juntaFixa.textContent = INFO_JUNTA[m.geometria.junta].nome
    juntaFixa.title = listaJunta.title = descreverJunta(m)
    opcoes(listaJunta, TIPOS_JUNTA.map((f: TipoJunta) => {
      const cabe = !op.escolherMaterial || espessurasPara(m.material, f).length > 0
      return { valor: f, texto: INFO_JUNTA[f].nome + (cabe ? '' : ' · chapa fina demais'), desativado: !cabe }
    }), m.geometria.junta)
    if (!op.escolherMaterial) return
    opcoes(listaChapa, materiaisDoProcesso('MIG/MAG').map((id: MaterialId) => ({ valor: id, texto: MATERIAIS[id].nomeCurto })), m.material)
    listaChapa.title = MATERIAIS[m.material].ficha.resumo
    opcoes(listaEspessura, espessurasPara(m.material, m.geometria.junta).map((e) => ({ valor: String(e), texto: `${n1(e)} mm` })), String(m.geometria.espessuraMm))
  }
  const linhaPeca = h(
    'div',
    { class: 'linha-peca' },
    op.escolherMaterial ? [campo('Chapa', listaChapa), campo('Espessura', listaEspessura)] : null,
    op.escolherJunta ? campo('Junta', listaJunta) : h('span', { class: 'campo-peca' }, h('span', { class: 'rotulo-maquina' }, 'Junta'), juntaFixa),
    botaoFicha,
  )
  atualizarPeca()
  const pecaTeste = h(
    'section',
    { class: 'peca-teste', 'aria-label': 'Peça de teste' },
    h(
      'header',
      { class: 'peca-teste-topo' },
      // Com a lista de chapas à vista o selo seria repetido.
      h('div', { class: 'peca-teste-nome' }, h('strong', {}, 'Peça de teste'), op.escolherMaterial ? null : selo, h('small', {}, 'nada aqui conta')),
      linhaPeca,
      h(
        'div',
        { class: 'barra-dispositivo' },
        segmentos,
        botaoCalibrar,
        h('button', { type: 'button', class: 'botao-fantasma', 'data-ajuste-partida': true, title: 'Botões e teclas da câmera e do giro da peça', on: { click: () => abrirPainel('Controles da câmera e da peça', montarControles(app)) } }, icone('ajuste'), ' Controles'),
        h('button', { type: 'button', class: 'botao-fantasma', on: { click: reiniciarPeca } }, icone('limpar'), ' Limpar'),
      ),
    ),
    gaveta,
    areaPeca,
    resumoPasse,
  )

  // Como abrir o arco com o dispositivo escolhido: dentro da área de teste, não numa linha a mais.
  areaPeca.querySelector('.hud-sobre')?.append(h('span', { class: 'hud-item hud-dica' }, statusDispositivo))

  const fontePainel = h('div', { class: 'fonte-com-leituras' }, maquina.querySelector('.mostradores'), maquina.querySelector('.leituras'))
  const preparoPainel = h('div', {}, maquina.querySelector('.maquina-grade'), maquina.querySelector('.aviso-trava'))
  maquina.append(painelMaquina([['FONTE E LEITURAS', fontePainel], ['PREPARO', preparoPainel]]))
  bancada.elemento = h('div', { class: 'bancada' }, maquina, pecaTeste)

  // ------------------------------------------------------------ laço da peça de teste
  const redimensionar = () => {
    const { width, height } = areaPeca.getBoundingClientRect()
    if (width === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
    vista.ajustar(width, height)
    visual.ajustarTamanho(width, height)
  }
  const observador = new ResizeObserver(redimensionar)
  observador.observe(areaPeca)

  app.controlePausa = { pausar: () => { sim.pausar(performance.now()); fonte?.desligar(); somArco.calar() }, retomar: () => { sim.retomar(performance.now()); ligarFonte() } }
  let pedido = 0
  // Alguns navegadores não avisam a conexão do controle: confere periodicamente.
  let controlesVistos = controlesConectados().length
  let ultimaChecagem = 0
  const quadro = () => {
    const agora = performance.now()
    if (app.jogoPausado) { pedido = requestAnimationFrame(quadro); return }
    if (agora - ultimaChecagem > 500) {
      ultimaChecagem = agora
      const n = controlesConectados().length
      if (n !== controlesVistos) {
        controlesVistos = n
        aoConectar()
      }
    }
    fonte?.atualizar(agora)
    giro.limitar((g, r) => visual.permitePosicao(g, r))
    giro.atualizar(agora, vista, fonte, sim.arcoAberto)
    // H47: a posição da peça entra no modelo (gravada ao abrir o arco).
    sim.definirPosicao(giro.posicao)
    sim.avancarTempo(agora)
    if (arcoAntes && !sim.arcoAberto) analisarPasse()
    if (!arcoAntes && sim.arcoAberto) inicioPasse = Math.max(0, sim.registro.length - 1)
    arcoAntes = sim.arcoAberto
    for (const e of entradasAjuste) e.disabled = !!travas.ajustes || sim.arcoAberto
    const estado = sim.estado(agora)
    escamas.atualizar(sim.registro)
    const pos = fonte?.posicao ?? null
    const ctx2d = canvas.getContext('2d')!
    if (visual.ativo) {
      // O canvas 2D fica transparente: só recebe o ponteiro.
      ctx2d.clearRect(0, 0, vista.larguraCss, vista.alturaCss)
      const p = pos ?? estado.posicao
      const desvio = equilibrioArco(estado.ajustes, sim.contexto).desvio
      visual.desenhar({ cordao: sim.cordao, registro: sim.registro, eventos: sim.eventos, posicao: p, arcoAberto: estado.arcoAberto && !semArco(sim), sobreAPeca: estado.sobreAPeca, desvio, agoraMs: agora, aquecimento: estado.aquecimento, percurso: sim.percurso, rolagemGraus: giro.posicao.rolagemGraus, ponteiroDentro: pos !== null, angulo: vista.angulo })
      // Som do arco (H45) com a mesma regra de cena.ts.
      somArco.atualizar(!!(p && estado.arcoAberto && !semArco(sim) && estado.sobreAPeca), desvio, EQUILIBRIO.tolerancia)
    } else desenharCena(ctx2d, vista, {
      cordao: sim.cordao,
      estado: { ...estado, posicao: pos ?? estado.posicao },
      escamas,
      agoraMs: agora,
      ponteiroDentro: pos !== null,
      contexto: sim.contexto,
      percurso: sim.percurso,
      particulas,
      som: somArco,
    })
    hudVel.textContent = n1(estado.velocidades.avancoMms)
    if (pos) {
      const s = sim.cordao.secao(sim.cordao.indiceEm(pos.x))
      hudLarg.textContent = s.larguraMm > 0.3 ? `${n1(s.larguraMm)} mm` : '—'
    }
    hudCalor.style.width = `${Math.min(100, (estado.aquecimento / 1.2) * 100)}%`
    calibracao?.atualizar()
    pedido = requestAnimationFrame(quadro)
  }

  requestAnimationFrame(() => {
    redimensionar()
    ligarFonte()
    visual.iniciar()
    desenharSegmentos()
    atualizarLeituras()
    pedido = requestAnimationFrame(quadro)
  })

  bancada.destruir = () => {
    cancelAnimationFrame(pedido)
    observador.disconnect()
    gestos.destruir()
    giro.destruir()
    somArco.calar()
    visual.destruir()
    fonte?.desligar()
    window.removeEventListener('gamepadconnected', aoConectar)
    window.removeEventListener('gamepaddisconnected', aoConectar)
    document.removeEventListener('visibilitychange', semFoco)
    window.removeEventListener('blur', semFoco)
  }
  return bancada
}
