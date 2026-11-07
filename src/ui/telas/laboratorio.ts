import { createElement } from 'react'
import cssLaboratorio from '../../setores/laboratorio/ui/estilo.css?inline'
import { App as AppLaboratorio, type PropsLaboratorio } from '../../setores/laboratorio/ui/App'
import { montarSetor } from '../../setores/montar'
import { CASOS } from '../../setores/laboratorio/casos'
import type { Ampliacao, Carga, CasoDefinicao } from '../../setores/laboratorio/casos/tipos'
import type { Aquisicao, EstadoJogo, Modo, Resultado } from '../../setores/laboratorio/motor/tipos'
import {
  achadosDisponiveis, cortarAmostra, limparSuperficie, marcarEncontrado, novoJogo, prepararAmostra, registrarEvidencia,
  registrarMicrografia, registrarPerfil, registrarVisual,
} from '../../setores/laboratorio/motor/estado'
import { adquirirVisual } from '../../setores/laboratorio/motor/inspecao'
import { adquirirMicrografia, descreverAmostra } from '../../setores/laboratorio/motor/metalografia'
import { carregarPartida, salvarPartida } from '../../setores/laboratorio/motor/persistencia'
import { formatarHoras, formatarReais, saldo } from '../../setores/laboratorio/motor/recursos'
import { desenharSuperficie } from '../../setores/laboratorio/ui/render/superficie'
import { desenharMicrografia, desenharSecao } from '../../setores/laboratorio/ui/render/micrografia'
import { paraMm, paraPx, type Mapa } from '../../setores/laboratorio/ui/render/comum'
import { ataqueDoTempo, Cortadeira, desfoque, emFoco, LixamentoManual, pontoDeFoco, PolimentoManual, PREPARO, type GrauLixa } from '../../laboratorio/preparo'
import { criarLaboratorio3D, type Estacao } from '../../render/laboratorio3d'
import type { App } from '../app'
import { menuOficina } from '../componentes/menuOficina'
import { painelMaquina } from '../componentes/painelMaquina'
import { confirmar } from '../dialogo'
import { h, n0, n1 } from '../dom'
import '../../laboratorio.css'

/*
 * O que faz: o Laboratório de Falhas no estilo da bancada de solda (v2.2,
 * H109). As estações são feitas com as mãos (lanterna, cortadeira, lixas,
 * pano, ataque, foco, indentações) e as ações viram as escolhas do motor de
 * ensaios do caso (src/setores/laboratorio/motor), que decide o que aparece.
 * O raciocínio (hipóteses, interpretação, relatório e devolutiva) abre no
 * "escritório": a tela de texto do Laboratório anterior, com o mesmo estado.
 */

const ESTACOES: [Estacao, string][] = [['inspecao', 'VISUAL'], ['corte', 'CORTE'], ['preparo', 'PREPARO'], ['microscopio', 'MICRO'], ['microdureza', 'DUREZA']]

export interface OpcoesLaboratorio {
  aoConcluir?: PropsLaboratorio['aoConcluir']
  contexto?: string
}

/** Entrada: continuar a investigação salva ou começar uma nova (Aprender / Desafio). */
export function escolherLaboratorio(app: App, voltar: () => void, op: OpcoesLaboratorio = {}): void {
  const caso = CASOS[0]
  const salvo = carregarPartida()
  const continuar = salvo && salvo.casoId === caso.id && !salvo.concluido ? salvo : null
  const nova = async (modo: Modo) => {
    if (salvo && salvo.casoId === caso.id && !(await confirmar('Começar de novo?', 'A investigação salva deste caso será substituída.', { sim: 'Começar de novo', perigo: true }))) return
    // O tutorial do escritório descreve as telas antigas de ensaio: começa desligado.
    const e = { ...novoJogo(caso, modo), tutorialPasso: null }
    salvarPartida(e)
    telaLaboratorio(app, caso, e, voltar, op)
  }
  menuOficina(app, 'LABORATÓRIO', `FÁBRICA / LABORATÓRIO DE FALHAS / ${caso.publico.titulo.toUpperCase()}`, [
    ...(continuar ? [{ nome: 'CONTINUAR INVESTIGAÇÃO', descricao: `Modo ${continuar.modo === 'aprender' ? 'Aprender' : 'Desafio'} · ${continuar.aquisicoes.length} resultado(s) · ${continuar.evidencias.length} evidência(s) no caderno.`, abrir: () => telaLaboratorio(app, caso, continuar, voltar, op) }] : []),
    { nome: 'NOVA · MODO APRENDER', descricao: 'Dicas antes das decisões e explicação das limitações durante a investigação.', abrir: () => void nova('aprender') },
    { nome: 'NOVA · MODO DESAFIO', descricao: 'Menos orientação: as explicações completas só na devolutiva.', abrir: () => void nova('desafio') },
  ], { nome: 'VOLTAR', descricao: 'Voltar.', abrir: voltar })
}

export function telaLaboratorio(app: App, caso: CasoDefinicao, inicial: EstadoJogo, voltar: () => void, op: OpcoesLaboratorio = {}): void {
  app.ir((app) => {
    app.raiz.classList.add('app-cheia')
    let estado = inicial
    const vista = criarLaboratorio3D()
    if (!vista) { app.raiz.append(h('p', {}, 'WebGL indisponível: abra no Chrome ou Edge com aceleração gráfica.')); return }
    const canvas = vista.canvas
    let estacao: Estacao = 'inspecao'
    let aviso = '', avisoAte = 0
    const avisar = (t: string, ms = 3500) => { aviso = t; avisoAte = performance.now() + ms }
    const aplicar = (r: Resultado, ok?: string): boolean => {
      if (!r.ok) { avisar(r.erro, 5000); return false }
      estado = r.estado
      salvarPartida(estado)
      if (ok) avisar(ok, 2500)
      atualizarListas()
      return true
    }

    // Janela de trabalho sobre o 3D (a lixa, a fratura, o microscópio).
    const janela = h('canvas', { class: 'lb-janela', width: 560, height: 320 }) as HTMLCanvasElement
    const janelaTitulo = h('strong', { class: 'lb-janela-titulo' })
    const janelaCaixa = h('div', { class: 'lb-janela-caixa' }, janelaTitulo, janela)
    const estadoHud = h('strong', { class: 'p15-estado', role: 'status', 'aria-live': 'polite' })
    const recursos = h('span', { class: 'lb-recursos' })
    const hud = h('div', { class: 'p15-hud lb-hud' }, estadoHud, recursos)

    // ---------- INSPEÇÃO: lanterna (arraste na vista 3D), lupa, limpeza e foto ----------
    let elevacao = 45, azimute = 30, lupa = false
    const superficies = caso.publico.superficies
    const supSelect = h('select', { 'aria-label': 'Superfície' }, superficies.map((s) => h('option', { value: s.id }, s.nome))) as HTMLSelectElement
    const elevacaoFaixa = h('input', { type: 'range', min: 5, max: 85, value: elevacao, 'aria-label': 'Elevação da lanterna (graus)' }) as HTMLInputElement
    const luzTexto = h('output')
    elevacaoFaixa.addEventListener('input', () => { elevacao = Number(elevacaoFaixa.value); vista.lanterna(elevacao, azimute) })
    const botaoLupa = h('button', { type: 'button', on: { click: () => { lupa = !lupa; vista.lupa(lupa); botaoLupa.setAttribute('aria-pressed', String(lupa)) } } }, 'Lupa ~10× (detalhe)')
    const iluminacao = () => (elevacao < 25 ? 'rasante' : 'difusa') as 'rasante' | 'difusa'
    const pedidoVisual = () => ({ superficie: supSelect.value, vista: lupa ? 'detalhe' : 'geral', iluminacao: iluminacao() } as const)
    const limpar = async (tipo: 'suave' | 'agressiva') => {
      if (tipo === 'agressiva' && !(await confirmar('Escovar com escova de aço?', 'A escova de aço remove a sujeira, mas também apaga detalhes finos da fratura. É irreversível.', { sim: 'Escovar', perigo: true }))) return
      aplicar(limparSuperficie(caso, estado, supSelect.value, tipo), tipo === 'suave' ? 'Fratura limpa com solvente e escova macia' : 'Fratura escovada (irreversível)')
    }
    const inspecao = h('div', { class: 'lb-estacao' },
      h('label', {}, h('span', { class: 'p15-linha' }, 'Superfície'), supSelect),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Lanterna (elevação)', luzTexto), elevacaoFaixa),
      h('p', { class: 'p15-dica' }, 'Arraste com o botão esquerdo na vista 3D para mover a lanterna. Luz quase deitada sobre a fratura (rasante) realça relevo fino; luz alta (difusa) mostra cor e regiões.'),
      botaoLupa,
      h('div', { class: 'lb-linha' },
        h('button', { type: 'button', on: { click: () => void limpar('suave') } }, 'Limpar: solvente + escova macia'),
        h('button', { type: 'button', class: 'lb-perigo', on: { click: () => void limpar('agressiva') } }, 'Escova de aço')),
      h('button', { type: 'button', class: 'primario', on: { click: () => aplicar(registrarVisual(caso, estado, pedidoVisual()), 'Foto registrada') } }, 'Fotografar e registrar'))

    // ---------- CORTE: ponto na peça, orientação, disco com avanço e refrigeração ----------
    let pontoCorte: { x: number; y: number } | null = null
    const cortadeira = new Cortadeira()
    let cortando = false
    const orientacao = h('select', { 'aria-label': 'Orientação do corte' }, h('option', { value: 'transversal' }, 'Transversal (seção da junta)'), h('option', { value: 'longitudinal' }, 'Longitudinal (ao longo do cordão)')) as HTMLSelectElement
    const avancoFaixa = h('input', { type: 'range', min: 0.5, max: 5, step: 0.1, value: 2, 'aria-label': 'Avanço do disco (mm/s)' }) as HTMLInputElement
    const avancoTexto = h('output')
    const refrigerar = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const botaoCortar = h('button', { type: 'button', class: 'primario' }, 'Segure para cortar')
    const cortarPressionado = (v: boolean) => {
      if (v && !pontoCorte) { avisar('Clique na peça (janela) para marcar onde cortar'); return }
      if (v && cortadeira.travou) { avisar('O disco travou: recomece o corte'); return }
      cortando = v
    }
    botaoCortar.addEventListener('pointerdown', () => cortarPressionado(true))
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) botaoCortar.addEventListener(t, () => cortarPressionado(false))
    const corte = h('div', { class: 'lb-estacao' },
      h('p', { class: 'p15-dica' }, 'Clique na vista de cima da peça (janela) para marcar o corte. Corte longe da fratura não mostra a origem; em cima dela pode destruir o que você quer ver.'),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Orientação'), orientacao),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Avanço do disco', avancoTexto), avancoFaixa),
      h('label', { class: 'lb-check' }, refrigerar, ' Refrigeração ligada'),
      botaoCortar,
      h('button', { type: 'button', on: { click: () => { cortadeira.recomecar(); avisar('Disco pronto') } } }, 'Recomeçar corte'),
      h('p', { class: 'p15-dica' }, `Avanço rápido demais trava o disco (sem refrigeração, a metade do limite). A amostra cortada é embutida automaticamente.`))

    // ---------- PREPARO: lixas (arrastar), girar 90°, pano (mover), ataque (segurar) ----------
    let lix = new LixamentoManual(), poli = new PolimentoManual(), ataqueS = 0, atacando = false
    const riscos: { grau: GrauLixa; angulo: number }[] = []
    const amostraSelect = h('select', { 'aria-label': 'Amostra' }) as HTMLSelectElement
    const botoesLixa = PREPARO.lixas.map((g) => h('button', { type: 'button', 'data-lixa': String(g), on: { click: () => { lix.trocarLixa(g); ferramentaPreparo = 'lixa' } } }, `Lixa #${g}`))
    const botoesPasta = ([6, 1] as const).map((p) => h('button', { type: 'button', 'data-pasta': String(p), on: { click: () => { poli.trocarPasta(p); ferramentaPreparo = 'pano' } } }, `Pano ${p} µm`))
    let ferramentaPreparo: 'lixa' | 'pano' = 'lixa'
    const botaoAtaque = h('button', { type: 'button' }, 'Segure para mergulhar no Nital')
    botaoAtaque.addEventListener('pointerdown', () => { atacando = true })
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) botaoAtaque.addEventListener(t, () => { atacando = false })
    const progressoPreparo = h('ul', { class: 'lb-progresso' })
    const concluirPreparo = () => {
      if (!amostraSelect.value) { avisar('Corte uma amostra primeiro'); return }
      const l = lix.resultado
      if (!l) { avisar('Lixe pelo menos até completar a lixa #220'); return }
      if (aplicar(prepararAmostra(caso, estado, { amostraId: amostraSelect.value, lixamento: l, polimento: poli.resultado, ataque: ataqueDoTempo(ataqueS) }), 'Preparação registrada: vá ao microscópio')) {
        lix = new LixamentoManual(); poli = new PolimentoManual(); ataqueS = 0; riscos.length = 0
      }
    }
    const preparo = h('div', { class: 'lb-estacao' },
      h('label', {}, h('span', { class: 'p15-linha' }, 'Amostra embutida'), amostraSelect),
      h('p', { class: 'p15-dica' }, 'Na janela, arraste a amostra para frente e para trás sobre a lixa. Troque de lixa só quando os riscos da anterior sumirem, e gire 90° (R) a cada troca para ver isso.'),
      h('div', { class: 'lb-linha' }, ...botoesLixa),
      h('button', { type: 'button', on: { click: () => girar() } }, 'Girar a amostra 90° (R)'),
      h('div', { class: 'lb-linha' }, ...botoesPasta),
      botaoAtaque,
      progressoPreparo,
      h('button', { type: 'button', class: 'primario', on: { click: concluirPreparo } }, 'Concluir a preparação'))
    const girar = () => { lix.girar(); avisar(`Amostra girada: riscos agora a ${lix.angulo}°`, 1500) }

    // ---------- MICROSCÓPIO: objetiva, mesa (clique no mapa), foco (roda) ----------
    let ampliacao: Ampliacao = 10, foco = 0, centroMicro: { u: number; v: number } | null = null
    let ultimaMicro: string | null = null
    const preparoMicro = h('select', { 'aria-label': 'Preparação' }) as HTMLSelectElement
    const botoesObjetiva = ([10, 100, 500] as const).map((a) => h('button', { type: 'button', 'data-amp': String(a), on: { click: () => { ampliacao = a; ultimaMicro = null } } }, `${a}×`))
    const focoTexto = h('output')
    const microscopio = h('div', { class: 'lb-estacao' },
      h('label', {}, h('span', { class: 'p15-linha' }, 'Preparação'), preparoMicro),
      h('div', { class: 'lb-linha' }, ...botoesObjetiva),
      h('p', { class: 'p15-dica' }, 'Clique no mapa da seção (à esquerda na janela) para mover a mesa. Gire a roda do mouse sobre a janela para focar: quanto maior o aumento, mais estreito o foco.'),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Foco', focoTexto)),
      h('button', { type: 'button', class: 'primario', on: { click: () => capturar() } }, 'Capturar imagem'),
      h('p', { class: 'p15-dica' }, 'Depois de capturar, clique na imagem sobre o que parece uma trinca, poro ou inclusão para registrar o achado local.'))

    // ---------- MICRODUREZA: carga e pontos (clique no mapa) ----------
    let pontosHv: { u: number; v: number }[] = []
    const preparoHv = h('select', { 'aria-label': 'Preparação' }) as HTMLSelectElement
    const carga = h('select', { 'aria-label': 'Carga' }, (['HV0.1', 'HV0.5', 'HV1'] as Carga[]).map((c) => h('option', { value: c, selected: c === 'HV0.5' }, c))) as HTMLSelectElement
    const listaHv = h('ol', { class: 'lb-hv' })
    const microdureza = h('div', { class: 'lb-estacao' },
      h('label', {}, h('span', { class: 'p15-linha' }, 'Preparação'), preparoHv),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Carga'), carga),
      h('p', { class: 'p15-dica' }, 'Clique na seção (janela) para marcar as indentações, em linha atravessando metal de base, ZTA e cordão. Pontos perto demais um do outro ou da borda dão leitura falsa.'),
      h('div', { class: 'lb-linha' },
        h('button', { type: 'button', on: { click: () => { pontosHv = [] } } }, 'Limpar pontos'),
        h('button', { type: 'button', class: 'primario', on: { click: () => executarHv() } }, 'Indentar e medir')),
      listaHv)

    // ---------- CADERNO: achados → evidências; escritório ----------
    const listaResultados = h('div', { class: 'lb-resultados' })
    const caderno = h('div', { class: 'lb-estacao' },
      h('p', { class: 'p15-dica' }, 'Cada resultado mostra o que dá para ver nele. Anote no caderno o que for evidência: no escritório você liga cada uma às hipóteses e escreve o relatório.'),
      h('button', { type: 'button', class: 'primario', on: { click: () => abrirEscritorio() } }, 'Abrir o escritório: hipóteses, caderno e relatório'),
      listaResultados)

    const area = h('div', { class: 'p15-vista lb-vista' }, canvas, janelaCaixa, hud)
    const abas = painelMaquina([...ESTACOES.map(([, nome]): [string, HTMLElement] => [nome, { inspecao, corte, preparo, microscopio, microdureza }[ESTACOES.find(([, n]) => n === nome)![0]]]), ['NOTAS', caderno]])
    const painel = h('aside', { class: 'p15-painel' }, h('div', { class: 'maquina-identificacao' }, 'LABORATÓRIO DE FALHAS', h('span', {}, caso.publico.titulo)), abas,
      h('div', { class: 'p15-avaliacao' }, h('button', { type: 'button', on: { click: () => abrirEscritorio() } }, 'Escritório'), h('button', { type: 'button', on: { click: voltar } }, 'Sair')))
    const conteudo = h('section', { class: 'p15 lb' },
      h('header', { class: 'p15-cabecalho' }, h('div', {},
        h('h2', { class: 'tela-titulo', tabindex: '-1' }, 'Laboratório de Falhas'),
        h('p', {}, `${caso.publico.titulo} · modo ${estado.modo === 'aprender' ? 'Aprender' : 'Desafio'} · dados sintéticos, imagens esquemáticas`))),
      h('div', { class: 'p15-grade' }, area, painel))
    app.raiz.append(conteudo)
    // As abas levam a câmera até a estação.
    abas.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((b, i) => b.addEventListener('click', () => {
      estacao = i < ESTACOES.length ? ESTACOES[i][0] : estacao
      vista.irPara(estacao)
      janelaCaixa.hidden = i >= ESTACOES.length
    }))
    vista.lanterna(elevacao, azimute)

    // ---------- Escritório (texto: hipóteses, interpretação, relatório, devolutiva) ----------
    let fecharEscritorio: (() => void) | null = null
    function abrirEscritorio() {
      salvarPartida({ ...estado, aba: estado.concluido ? 'devolutiva' : estado.aba === 'relatorio' ? 'relatorio' : 'hipoteses' })
      const host = h('div', { class: 'lb-escritorio-conteudo' })
      const camada = h('div', { class: 'lb-escritorio', role: 'dialog', 'aria-label': 'Escritório do laboratório' },
        h('div', { class: 'lb-escritorio-barra' }, h('strong', {}, 'Escritório · hipóteses, caderno, relatório e devolutiva'),
          h('button', { type: 'button', on: { click: () => fechar() } }, '← Voltar à bancada')), host)
      app.raiz.append(camada)
      const desmontar = montarSetor(host, cssLaboratorio, createElement(AppLaboratorio, { aoConcluir: op.aoConcluir, semEnsaios: true }))
      const fechar = () => {
        desmontar(); camada.remove(); fecharEscritorio = null
        const e = carregarPartida()
        if (e && e.casoId === caso.id) estado = e
        atualizarListas()
      }
      fecharEscritorio = fechar
    }

    // ---------- Ações ----------
    function capturar() {
      const p = estado.preparos.find((x) => x.id === preparoMicro.value)
      if (!p || !centroMicro) { avisar('Escolha a preparação e clique no mapa para posicionar a mesa'); return }
      if (!emFoco(foco, pontoDeFoco(p.id, ampliacao), ampliacao)) { avisar('Imagem fora de foco: gire a roda até ficar nítida'); return }
      if (aplicar(registrarMicrografia(caso, estado, { preparoId: p.id, ampliacao, centro: centroMicro }), 'Micrografia registrada')) {
        ultimaMicro = estado.aquisicoes[estado.aquisicoes.length - 1].id
      }
    }
    function executarHv() {
      const p = estado.preparos.find((x) => x.id === preparoHv.value)
      if (!p) { avisar('Escolha uma preparação'); return }
      if (aplicar(registrarPerfil(caso, estado, { preparoId: p.id, carga: carga.value as Carga, pontos: pontosHv }), 'Perfil de microdureza registrado')) pontosHv = []
    }

    // Listas (amostras, preparações, resultados).
    function atualizarListas() {
      const opcoes = (sel: HTMLSelectElement, itens: { id: string; rotulo: string }[]) => {
        const atual = sel.value
        sel.replaceChildren(...itens.map((i) => h('option', { value: i.id }, i.rotulo)))
        if (itens.some((i) => i.id === atual)) sel.value = atual
        else if (itens.length) sel.value = itens[itens.length - 1].id
      }
      opcoes(amostraSelect, estado.amostras.map((a) => ({ id: a.id, rotulo: descreverAmostra(a) })))
      const preps = estado.preparos.map((p) => ({ id: p.id, rotulo: `${p.id} · ${p.lixamento} · ${p.polimento} · ${p.ataque}` }))
      opcoes(preparoMicro, preps); opcoes(preparoHv, preps)
      listaResultados.replaceChildren(...[...estado.aquisicoes].reverse().map((a) => itemResultado(a)))
      const ultimoHv = [...estado.aquisicoes].reverse().find((a) => a.tipo === 'microdureza')
      listaHv.replaceChildren(...(ultimoHv && ultimoHv.tipo === 'microdureza' ? ultimoHv.pontos.map((p) => h('li', {}, `${n0(p.hv)} HV em (${n1(p.u)}; ${n1(p.v)}) mm${p.alertas.length ? ' · ⚠' : ''}`)) : []))
    }
    function itemResultado(a: Aquisicao): HTMLElement {
      const disponiveis = achadosDisponiveis(a)
      return h('details', { class: 'lb-resultado' },
        h('summary', {}, `${a.id} · ${a.rotulo}`),
        a.limitacoes.length ? h('ul', { class: 'lb-limites' }, a.limitacoes.map((l) => h('li', { 'data-sev': l.severidade }, estado.modo === 'aprender' ? `${l.texto} ${l.explicacao}` : l.texto))) : null,
        disponiveis.length
          ? h('ul', { class: 'lb-achados' }, disponiveis.map((x) => {
            const ja = estado.evidencias.some((e) => e.aquisicaoId === a.id && e.chave === x.chave)
            return h('li', {}, h('span', {}, `${x.observacao}${x.qualidade === 'tenue' ? ' (pouco nítido)' : x.qualidade === 'comprometida' ? ' (comprometido)' : ''}`),
              h('button', { type: 'button', disabled: ja, on: { click: () => aplicar(registrarEvidencia(estado, { aquisicaoId: a.id, chave: x.chave, nota: '' }), 'Anotado no caderno') } }, ja ? 'no caderno' : 'Anotar'))
          }))
          : h('p', { class: 'p15-dica' }, a.tipo === 'micrografia' ? 'Nada evidente neste campo, ou procure clicando na imagem.' : 'Nada evidente com esta configuração.'))
    }

    // ---------- Janela: desenho de cada estação ----------
    const ctx = janela.getContext('2d')!
    let mapaJanela: { mapa: Mapa; x0: number; largura: number } | null = null
    let mapaMicro: { mapa: Mapa; x0: number } | null = null
    const off = document.createElement('canvas')
    function desenharJanela(agora: number) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, janela.width, janela.height)
      ctx.fillStyle = '#10161b'; ctx.fillRect(0, 0, janela.width, janela.height)
      mapaJanela = null; mapaMicro = null
      if (estacao === 'inspecao') {
        janelaTitulo.textContent = `${superficies.find((s) => s.id === supSelect.value)?.nome} · luz ${iluminacao()} (${n0(elevacao)}°) · ${lupa ? 'lupa' : 'visão geral'}`
        const aq = adquirirVisual(caso, estado, pedidoVisual(), 'previa')
        off.width = janela.width; off.height = janela.height
        desenharSuperficie(off, caso, aq, true)
        ctx.drawImage(off, 0, 0)
      } else if (estacao === 'corte') {
        janelaTitulo.textContent = cortadeira.travou ? 'Disco travado · recomece o corte' : pontoCorte ? `Corte ${orientacao.value} em x = ${n1(pontoCorte.x)} mm, y = ${n1(pontoCorte.y)} mm · ${n0((100 * cortadeira.avancoMm) / PREPARO.corte.comprimentoMm)}%` : 'Vista de cima da junta · clique onde cortar'
        desenharPecaDeCima()
      } else if (estacao === 'preparo') {
        janelaTitulo.textContent = ferramentaPreparo === 'lixa' ? `Lixa #${lix.lixa ?? '—'} · riscos a ${lix.angulo}° · arraste para lixar` : `Pano ${poli.pasta ?? '—'} µm · segure e mova para polir`
        desenharAmostra()
      } else if (estacao === 'microscopio' || estacao === 'microdureza') {
        const prep = estado.preparos.find((p) => p.id === (estacao === 'microscopio' ? preparoMicro.value : preparoHv.value))
        const amostra = prep && estado.amostras.find((a) => a.id === prep.amostraId)
        if (!prep || !amostra) { janelaTitulo.textContent = 'Corte e prepare uma amostra primeiro'; return }
        // Mapa da seção à esquerda.
        const largura = estacao === 'microscopio' ? 220 : janela.width
        off.width = largura; off.height = janela.height
        const mapa = desenharSecao(off, caso, amostra, prep)
        ctx.drawImage(off, 0, 0)
        mapaJanela = { mapa, x0: 0, largura }
        if (estacao === 'microdureza') {
          janelaTitulo.textContent = `Seção ${amostra.id} · ${pontosHv.length} ponto(s) marcados · ${carga.value}`
          ctx.fillStyle = '#ffd23f'
          for (const p of pontosHv) { const [x, y] = paraPx(mapa, p.u, p.v); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill() }
          return
        }
        if (centroMicro) { const [x, y] = paraPx(mapa, centroMicro.u, centroMicro.v); ctx.strokeStyle = '#7dffb0'; ctx.strokeRect(x - 6, y - 6, 12, 12) }
        const alvo = pontoDeFoco(prep.id, ampliacao)
        janelaTitulo.textContent = `${ampliacao}× · ${emFoco(foco, alvo, ampliacao) ? 'em foco' : 'fora de foco'} · ${prep.id}`
        focoTexto.value = n1(foco)
        const aqMostrar = ultimaMicro ? estado.aquisicoes.find((a) => a.id === ultimaMicro) : null
        const aq = aqMostrar && aqMostrar.tipo === 'micrografia' ? aqMostrar : centroMicro ? adquirirMicrografia(caso, amostra, prep, { preparoId: prep.id, ampliacao, centro: centroMicro }, 'previa') : null
        if (aq && typeof aq !== 'string') {
          off.width = janela.width - 230; off.height = janela.height
          const m = desenharMicrografia(off, caso, amostra, prep, aq)
          ctx.filter = aqMostrar ? 'none' : `blur(${desfoque(foco, alvo, ampliacao)}px)`
          ctx.drawImage(off, 230, 0)
          ctx.filter = 'none'
          // Achados locais já encontrados: um círculo em volta.
          if (aqMostrar) {
            ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2
            for (const x of aqMostrar.achados) if (aqMostrar.encontrados.includes(x.chave)) for (const mk of x.marcadores) {
              const [px, py] = paraPx(m, mk.u, mk.v)
              ctx.beginPath(); ctx.arc(230 + px, py, Math.max(8, mk.raio * m.escala), 0, 7); ctx.stroke()
            }
          }
          mapaMicro = { mapa: m, x0: 230 }
        } else if (typeof aq === 'string') { ctx.fillStyle = '#ffb3a8'; ctx.fillText(aq, 240, 160) }
      }
      void agora
    }
    function desenharPecaDeCima() {
      // Junta vista de cima: x de −40 a 40 mm, y de 0 a 80 mm (largura da barra); fratura em x ≈ 8.
      const g = caso.verdade.geometria
      const W = janela.width, H = janela.height
      const px = (x: number) => ((x + 40) / 80) * W, py = (y: number) => H - 20 - (y / g.largura) * (H - 40)
      ctx.fillStyle = '#6f777f'; ctx.fillRect(px(-40), py(g.largura), W, py(0) - py(g.largura))
      ctx.fillStyle = '#5a6168'; ctx.fillRect(px(-6), py(g.largura), px(6) - px(-6), py(0) - py(g.largura))
      ctx.strokeStyle = '#1b1f23'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(px(8), py(0)); ctx.lineTo(px(8.3), py(g.largura)); ctx.stroke()
      ctx.fillStyle = '#dfe5ea'; ctx.font = '12px Arial'
      ctx.fillText('cordão', px(-5), 16); ctx.fillText('fratura', px(9), 16); ctx.fillText('parte A ←', px(-38), 16); ctx.fillText('→ fragmento B', px(14), 16)
      for (const a of estado.amostras) {
        ctx.fillStyle = '#c93a2a88'
        if (a.orientacao === 'transversal') ctx.fillRect(px(a.extensao[0]), py(a.posicao + 2), px(a.extensao[1]) - px(a.extensao[0]), 6)
        else ctx.fillRect(px(a.posicao) - 3, py(a.extensao[1]), 6, py(a.extensao[0]) - py(a.extensao[1]))
      }
      if (pontoCorte) {
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.setLineDash([6, 4])
        ctx.beginPath()
        if (orientacao.value === 'transversal') { ctx.moveTo(0, py(pontoCorte.y)); ctx.lineTo(W, py(pontoCorte.y)) } else { ctx.moveTo(px(pontoCorte.x), 0); ctx.lineTo(px(pontoCorte.x), H) }
        ctx.stroke(); ctx.setLineDash([])
      }
    }
    function desenharAmostra() {
      const W = janela.width, H = janela.height, cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.42
      ctx.fillStyle = '#2b2b2e'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill() // baquelite
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 7); ctx.clip()
      // Superfície do metal: vai ficando espelhada com o polimento.
      const brilho = Math.min(1, poli.segundos[6] / PREPARO.poliS[6] * 0.6 + poli.segundos[1] / PREPARO.poliS[1] * 0.4)
      ctx.fillStyle = `rgb(${120 + 100 * brilho}, ${126 + 100 * brilho}, ${132 + 100 * brilho})`
      ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r)
      // Riscos de cada lixa, na direção em que ela foi usada; somem com a lixa seguinte e com o polimento.
      for (const { grau, angulo } of riscos) {
        const vis = lix.riscosVisiveis(grau) * (1 - brilho * (grau === 1200 ? 1 : 0.6))
        if (vis <= 0.02) continue
        const n = Math.round(80 * vis), largura = grau === 220 ? 2.2 : grau === 600 ? 1.2 : 0.6
        ctx.strokeStyle = `rgba(40,44,48,${0.5 * vis})`; ctx.lineWidth = largura
        for (let i = 0; i < n; i++) {
          const o = ((i * 9301 + grau * 49297) % 233280) / 233280 * 2 * r - r
          ctx.beginPath()
          if (angulo === 0) { ctx.moveTo(cx - r, cy + o); ctx.lineTo(cx + r, cy + o) } else { ctx.moveTo(cx + o, cy - r); ctx.lineTo(cx + o, cy + r) }
          ctx.stroke()
        }
      }
      // Ataque: escurece (revela) e, demais, queima.
      if (ataqueS > 0) { ctx.fillStyle = `rgba(90,70,50,${Math.min(0.55, ataqueS / 25)})`; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r) }
      ctx.restore()
    }

    // Progresso do preparo (painel).
    function atualizarProgresso() {
      const pct = (v: number) => `${n0(Math.min(1, v) * 100)}%`
      const itens = [
        ...PREPARO.lixas.map((g) => `Lixa #${g}: ${pct(lix.progresso[g])}${lix.completa(g) ? ' ✓' : ''}`),
        `Pano 6 µm: ${pct(poli.segundos[6] / PREPARO.poliS[6])} · 1 µm: ${pct(poli.segundos[1] / PREPARO.poliS[1])}`,
        `Ataque: ${n1(ataqueS)} s → ${ataqueDoTempo(ataqueS) === 'nenhum' ? 'não revelou' : ataqueDoTempo(ataqueS) === 'nital-5s' ? 'revelado' : 'sobreataque'}`,
        `Resultado: ${lix.resultado ?? 'lixa #220 incompleta'} · ${poli.resultado} · ${ataqueDoTempo(ataqueS)}`,
      ]
      const t = itens.join('|')
      if (progressoPreparo.dataset.t !== t) { progressoPreparo.dataset.t = t; progressoPreparo.replaceChildren(...itens.map((x) => h('li', {}, x))) }
      botoesLixa.forEach((b) => b.setAttribute('aria-pressed', String(ferramentaPreparo === 'lixa' && Number(b.dataset.lixa) === lix.lixa)))
      botoesPasta.forEach((b) => b.setAttribute('aria-pressed', String(ferramentaPreparo === 'pano' && Number(b.dataset.pasta) === poli.pasta)))
      botoesObjetiva.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.amp) === ampliacao)))
    }

    // ---------- Entrada ----------
    const ouvintes: (() => void)[] = []
    const ouvir = (alvo: EventTarget, tipo: string, f: EventListener, o?: AddEventListenerOptions) => { alvo.addEventListener(tipo, f, o); ouvintes.push(() => alvo.removeEventListener(tipo, f, o)) }
    // Lanterna: arrastar na vista 3D.
    let arrastando: { x: number; y: number } | null = null
    ouvir(canvas, 'pointerdown', (ev) => { const e = ev as PointerEvent; if (e.button === 0 && estacao === 'inspecao') { arrastando = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId) } })
    ouvir(canvas, 'pointermove', (ev) => {
      const e = ev as PointerEvent
      if (!arrastando) return
      elevacao = Math.max(5, Math.min(85, elevacao - (e.clientY - arrastando.y) * 0.3))
      azimute = (azimute + (e.clientX - arrastando.x) * 0.4) % 360
      arrastando = { x: e.clientX, y: e.clientY }
      elevacaoFaixa.value = String(elevacao)
      vista.lanterna(elevacao, azimute)
    })
    ouvir(canvas, 'pointerup', () => { arrastando = null })
    ouvir(canvas, 'contextmenu', (e) => e.preventDefault())
    // Janela: lixar/polir (arrastar), marcar corte, mesa do microscópio, achados, pontos de dureza.
    let ultimo: { x: number; y: number } | null = null, segurando = false, moveuEm = 0
    const ponto = (e: PointerEvent) => { const r = janela.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * janela.width, y: ((e.clientY - r.top) / r.height) * janela.height } }
    ouvir(janela, 'pointerdown', (ev) => {
      const e = ev as PointerEvent
      const p = ponto(e)
      segurando = true; ultimo = p
      try { janela.setPointerCapture(e.pointerId) } catch { /* já solto */ }
      if (estacao === 'corte') {
        const g = caso.verdade.geometria
        pontoCorte = { x: (p.x / janela.width) * 80 - 40, y: Math.max(0.5, Math.min(g.largura - 0.5, ((janela.height - 20 - p.y) / (janela.height - 40)) * g.largura)) }
        cortadeira.recomecar()
      } else if (estacao === 'microscopio' && mapaJanela && p.x < mapaJanela.largura) {
        const [u, v] = paraMm(mapaJanela.mapa, p.x, p.y); centroMicro = { u, v }; ultimaMicro = null
      } else if (estacao === 'microscopio' && mapaMicro && ultimaMicro) {
        const [u, v] = paraMm(mapaMicro.mapa, p.x - mapaMicro.x0, p.y)
        const aq = estado.aquisicoes.find((a) => a.id === ultimaMicro)
        const achado = aq?.achados.find((x) => x.modo === 'local' && x.marcadores.some((m) => Math.hypot(m.u - u, m.v - v) <= Math.max(m.raio, 6 / mapaMicro!.mapa.escala)))
        if (aq && achado && !aq.encontrados.includes(achado.chave)) { estado = marcarEncontrado(estado, aq.id, achado.chave); salvarPartida(estado); atualizarListas(); avisar('Achado local registrado: anote no caderno') }
        else if (aq) avisar('Nada de especial nesse ponto', 1500)
      } else if (estacao === 'microdureza' && mapaJanela) {
        const [u, v] = paraMm(mapaJanela.mapa, p.x, p.y); pontosHv.push({ u, v })
      }
    })
    ouvir(janela, 'pointermove', (ev) => {
      const e = ev as PointerEvent
      if (!segurando || !ultimo || estacao !== 'preparo') return
      const p = ponto(e)
      const d = Math.hypot(p.x - ultimo.x, p.y - ultimo.y) * 0.6
      ultimo = p
      moveuEm = performance.now()
      if (ferramentaPreparo === 'lixa' && lix.lixa) {
        lix.passar(d)
        if (!riscos.some((r) => r.grau === lix.lixa)) riscos.push({ grau: lix.lixa, angulo: lix.angulo })
        else riscos.find((r) => r.grau === lix.lixa)!.angulo = lix.angulo
      }
    })
    const soltarJanela = () => { segurando = false; ultimo = null }
    ouvir(janela, 'pointerup', soltarJanela)
    ouvir(janela, 'pointercancel', soltarJanela)
    ouvir(janela, 'wheel', (ev) => { const e = ev as WheelEvent; if (estacao !== 'microscopio') return; e.preventDefault(); foco += Math.sign(e.deltaY) * (ampliacao === 500 ? 0.4 : ampliacao === 100 ? 1 : 2); ultimaMicro = null }, { passive: false })
    ouvir(window, 'keydown', (ev) => {
      const e = ev as KeyboardEvent
      if ((e.target as HTMLElement)?.matches?.('input,select,textarea') || fecharEscritorio) return
      if (e.code === 'KeyR' && estacao === 'preparo') { e.preventDefault(); girar() }
    })
    const tamanho = new ResizeObserver(() => { const r = area.getBoundingClientRect(); vista.enquadrar(r.width, r.height) })
    tamanho.observe(area)

    // ---------- Laço ----------
    let pedido = 0, anterior = performance.now()
    const quadro = (agora: number) => {
      const dt = Math.min(0.1, (agora - anterior) / 1000)
      anterior = agora
      if (!fecharEscritorio) {
        // Corte: o disco avança enquanto o botão é segurado.
        if (cortando && pontoCorte && !cortadeira.pronto) {
          cortadeira.avancar(Number(avancoFaixa.value), dt, refrigerar.checked)
          if (cortadeira.travou) { cortando = false; avisar('O DISCO TRAVOU: avanço rápido demais' + (refrigerar.checked ? '' : ' (sem refrigeração o limite cai à metade)'), 4500) }
          if (cortadeira.pronto) {
            cortando = false
            aplicar(cortarAmostra(caso, estado, { orientacao: orientacao.value as 'transversal' | 'longitudinal', x: pontoCorte.x, y: pontoCorte.y }), 'Amostra cortada e embutida: vá ao preparo')
            cortadeira.recomecar()
          }
        }
        // Polimento: segurar e mover; ataque: segurar.
        if (estacao === 'preparo' && ferramentaPreparo === 'pano' && segurando) poli.polir(dt, agora - moveuEm < 150)
        if (atacando) ataqueS += dt
        vista.animar({ disco: cortando, corte: cortadeira.avancoMm / PREPARO.corte.comprimentoMm, lixando: segurando && estacao === 'preparo' && ferramentaPreparo === 'lixa', politriz: segurando && ferramentaPreparo === 'pano', mergulho: atacando ? 1 : 0, indentando: false })
        const s = saldo(estado, caso.publico.recursos)
        const r = `Orçamento R$ ${formatarReais(s.reais)} · tempo ${formatarHoras(Math.max(0, s.horas))} · ${estado.aquisicoes.length} resultado(s) · ${estado.evidencias.length} evidência(s)`
        if (recursos.textContent !== r) recursos.textContent = r
        const t = agora < avisoAte ? aviso : { inspecao: 'Inspeção visual · mova a lanterna e fotografe', corte: 'Corte · marque o ponto e segure para cortar', preparo: 'Preparo · lixe, polia e ataque', microscopio: 'Microscópio · posicione, foque e capture', microdureza: 'Microdureza · marque os pontos e indente' }[estacao]
        if (estadoHud.textContent !== t) estadoHud.textContent = t
        estadoHud.dataset.alerta = String(agora < avisoAte && /TRAVOU|fora de foco|primeiro|já/.test(aviso))
        luzTexto.value = `${n0(elevacao)}° · ${iluminacao()}`
        avancoTexto.value = `${n1(Number(avancoFaixa.value))} mm/s`
        atualizarProgresso()
        desenharJanela(agora)
        vista.desenhar(dt)
      }
      pedido = requestAnimationFrame(quadro)
    }
    atualizarListas()
    pedido = requestAnimationFrame(quadro)
    return () => { cancelAnimationFrame(pedido); fecharEscritorio?.(); tamanho.disconnect(); ouvintes.forEach((f) => f()); vista.destruir() }
  }, op.contexto ?? 'Fábrica · Laboratório')
}
