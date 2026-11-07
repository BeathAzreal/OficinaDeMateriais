import { copiaPose, foraDoAlcance, LIMITES, MISSAO_PAREDE, ORIENTACAO_VERTICAL, SUBSTRATO, type Pose } from '../../modelo/manufatura/celula'
import { ARQUIVOS_MAX, FAIXA_ALIMENTACAO, FAIXA_CORRECAO, FAIXA_CRATERA, LINHA_SINERGICA, sinergia, vazaoDeposito } from '../../modelo/manufatura/condicoes'
import { Deposito } from '../../modelo/manufatura/deposicao'
import { Controlador, type EstadoExecucao, type Evento, type ModoExecucao } from '../../modelo/manufatura/executor'
import { AJUDA_COMANDOS, lerPrograma, nomePonto, type Diagnostico, type Programa } from '../../modelo/manufatura/inform'
import { PROGRAMA_INICIAL, PROGRAMA_LIVRE, type ProjetoManufatura } from '../../modelo/manufatura/missao'
import { avaliarParede, inspecionarLivre, type AvaliacaoParede, type InspecaoLivre } from '../../pontuacao/manufatura'
import { criarVistaCelula } from '../../render/celulaRobo'
import type { App } from '../app'
import { montarAbas } from '../componentes/abas'
import { menuOficina } from '../componentes/menuOficina'
import { criarEditorInform } from '../componentes/editorInform'
import { abrirPainel, confirmar } from '../dialogo'
import { h } from '../dom'
import '../../estilo-manufatura.css'
import { telaMenu } from './menu'

/*
 * Manufatura Aditiva — Programação Robotizada (v2.1, experimental). Três
 * áreas: programa e depuração; posições e parâmetros; célula 3D e peça.
 * A tela só monta e lê o modelo (src/modelo/manufatura); a nota sai do
 * modelo, nunca do desenho.
 */

const VELOCIDADES = [1, 4, 10, 30]
const PASSOS_MM = [0.1, 1, 10, 50]
const PASSOS_GRAUS = [1, 5, 15]
const NOME_ESTADO: Record<EstadoExecucao, string> = {
  pronto: 'Pronto', executando: 'Executando', pausado: 'Pausado', concluido: 'Concluído', parado: 'Parado', alarme: 'ALARME',
}

const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const copiarProjeto = (p: ProjetoManufatura): ProjetoManufatura => JSON.parse(JSON.stringify(p)) as ProjetoManufatura

interface Atividade { celula: boolean; validou: boolean; testou: boolean; fabricou: boolean; inspecionou: boolean; aprovou: boolean }

/** Missão da parede (com nota e atividade guiada) ou modo livre (teste, sem missão nem nota). */
export type ModoManufatura = 'missao' | 'livre'

export function telaEscolhaManufatura(app: App): void {
  menuOficina(app, 'MANUFATURA ADITIVA', 'OFICINA / PROGRAMAÇÃO ROBOTIZADA (EXPERIMENTAL)', [
    { nome: 'MISSÃO: PAREDE RETA', descricao: 'Parede de várias camadas com nota, aprovação e atividade guiada.', abrir: () => telaManufatura(app, 'missao') },
    { nome: 'MODO LIVRE', descricao: 'Teste à vontade: sem missão, sem nota. Programe, fabrique e veja as medidas da peça.', abrir: () => telaManufatura(app, 'livre') },
  ], { nome: 'VOLTAR AO MENU', descricao: 'Voltar ao início da oficina.', abrir: () => telaMenu(app) })
}

export function telaManufatura(app: App, modo: ModoManufatura = 'missao'): void {
  const livre = modo === 'livre'
  app.ir((app) => {
    app.raiz.classList.add('app-cheia')
    app.escolherOutraPeca = () => telaEscolhaManufatura(app)
    const vista = criarVistaCelula({ missao: !livre })
    if (!vista) {
      app.raiz.append(h('p', {}, 'WebGL indisponível: abra a Manufatura Aditiva no Chrome ou Edge com aceleração gráfica.'))
      return
    }
    const projeto = copiarProjeto(livre ? app.manufatura.livre : app.manufatura.projeto)
    let programa: Programa = ler()
    let deposito = new Deposito()
    let controlador: Controlador | null = null
    let ultimoEstado: EstadoExecucao | null = null
    let jog: Pose = copiaPose(projeto.pontos[0]?.pose ?? { x: 600, y: 0, z: 200, ...ORIENTACAO_VERTICAL })
    let selecionado = Math.min(1, projeto.pontos.length - 1)
    let velocidade = 4
    let avaliacao: AvaliacaoParede | null = null
    let pausadoPeloMenu = false
    const atividade: Atividade = { celula: false, validou: false, testou: false, fabricou: false, inspecionou: false, aprovou: false }

    function ler(): Programa {
      return lerPrograma(projeto.programa, { pontos: projeto.pontos.length, arquivosAsf: projeto.condicoes.inicio.length, arquivosAef: projeto.condicoes.fim.length })
    }

    // Gravação no navegador (com espera curta para não gravar a cada tecla).
    let timerSalvar = 0
    const salvar = (agora = false) => {
      clearTimeout(timerSalvar)
      const gravar = () => { app.manufatura = { ...app.manufatura, [livre ? 'livre' : 'projeto']: copiarProjeto(projeto) }; app.salvar('manufatura') }
      if (agora) gravar(); else timerSalvar = window.setTimeout(gravar, 600)
    }

    // ---------------- Programa e depuração ----------------
    const idMensagens = 'ma-mensagens'
    const editor = criarEditorInform('Programa INFORM: corpo do job, de NOP a END', idMensagens)
    editor.definir(projeto.programa)
    const mensagens = h('ol', { class: 'ma-mensagens', id: idMensagens, 'aria-live': 'polite' })
    const resumoValidacao = h('p', { class: 'ma-resumo-validacao', role: 'status' })
    const estadoTexto = h('strong', { class: 'ma-estado' })
    const linhaTexto = h('span', {})
    const tempoTexto = h('span', {})

    const botao = (texto: string, titulo: string, acao: () => void, classe = '') => h('button', { type: 'button', class: classe, title: titulo, on: { click: acao } }, texto)
    const bValidar = botao('Validar', 'Lê o programa e mostra os erros com a linha, a causa e a correção', () => validar(true))
    const bTeste = botao('▶ Sem deposição', 'Executa o job com o arco inibido: confere caminho, pontos e colisões sem depositar', () => iniciar('teste'))
    const bFabricar = botao('▶ Fabricar', 'Executa o job com o arco: deposita a parede num substrato novo', () => void fabricar(), 'ma-fabricar')
    const bPausar = botao('❚❚ Pausar', 'Congela a simulação', () => controlador?.pausar())
    const bContinuar = botao('▶ Continuar', 'Continua de onde parou', () => controlador?.continuar())
    const bPasso = botao('⏭ Passo', 'Executa a próxima instrução e pausa (sem deposição se nada estiver rodando)', () => passo())
    const bParar = botao('■ Parar', 'Para o job: o arco fecha na hora, sem preencher a cratera', () => controlador?.parar(), 'ma-parar')
    const bReiniciar = botao('↺ Reiniciar', 'Descarta a execução e volta o programa ao início (a peça fica)', () => reiniciar())
    const seletorVelocidade = h('select', { 'aria-label': 'Velocidade da simulação (não muda o resultado)', title: 'Velocidade da simulação: só acelera o relógio, não muda o resultado' },
      VELOCIDADES.map((v) => h('option', { value: String(v), selected: v === velocidade }, `×${v}`))) as HTMLSelectElement
    seletorVelocidade.addEventListener('change', () => { velocidade = Number(seletorVelocidade.value) })

    const listaMensagens = (diags: Diagnostico[], eventos: Evento[]) => {
      const itens: HTMLElement[] = []
      for (const e of eventos.filter((x) => x.tipo !== 'info' || eventos.length < 40).slice(-60)) {
        itens.push(h('li', { class: `ma-msg ma-msg-${e.tipo}` },
          h('button', { type: 'button', class: 'ma-msg-linha', on: { click: () => editor.irParaLinha(e.linha) }, disabled: !e.linha }, e.linha ? `L${e.linha}` : '—'),
          h('span', {}, `${e.tipo === 'alarme' ? 'ALARME: ' : ''}${e.texto}`, h('small', {}, ` (${n1(e.tempo)} s)`))))
      }
      for (const d of diags) {
        itens.push(h('li', { class: `ma-msg ma-msg-${d.gravidade}` },
          h('button', { type: 'button', class: 'ma-msg-linha', on: { click: () => editor.irParaLinha(d.linha) } }, `L${d.linha}`),
          h('span', {}, h('b', {}, d.gravidade === 'erro' ? 'Erro: ' : 'Aviso: '), d.mensagem, h('br'), h('small', {}, `Como corrigir: ${d.correcao}`))))
      }
      mensagens.replaceChildren(...itens)
    }

    function validar(explicito: boolean): boolean {
      programa = ler()
      editor.marcarDiagnosticos(programa.diagnosticos)
      const erros = programa.diagnosticos.filter((d) => d.gravidade === 'erro').length
      const avisos = programa.diagnosticos.length - erros
      const executaveis = programa.instrucoes.filter((i) => i.op !== 'COMENTARIO' && i.op !== 'ROTULO').length
      resumoValidacao.textContent = erros
        ? `${erros} erro(s) e ${avisos} aviso(s): corrija os erros para executar.`
        : `Programa válido: ${executaveis} instruções${avisos ? `, ${avisos} aviso(s)` : ''}.`
      resumoValidacao.dataset.ok = String(!erros)
      if (!controlador) listaMensagens(programa.diagnosticos, [])
      if (explicito && !erros) { atividade.validou = true; desenharAtividade() }
      return !erros
    }
    let timerValidar = 0
    editor.aoMudar(() => {
      projeto.programa = editor.texto()
      salvar()
      clearTimeout(timerValidar)
      timerValidar = window.setTimeout(() => validar(false), 250)
    })

    const novoControlador = (modo: ModoExecucao) => {
      controlador = new Controlador({ programa, pontos: projeto.pontos.map((p) => ({ ...p, pose: copiaPose(p.pose) })), condicoes: JSON.parse(JSON.stringify(projeto.condicoes)), celula: { ...projeto.celula }, modo, deposito, inicio: copiaPose(jog) })
      ultimoEstado = null
    }

    function iniciar(modo: ModoExecucao): void {
      if (controlador && (controlador.estado === 'executando' || controlador.estado === 'pausado')) return
      if (!validar(true)) { editor.irParaLinha(programa.diagnosticos.find((d) => d.gravidade === 'erro')?.linha ?? 1); return }
      novoControlador(modo)
      controlador!.executar()
      atualizarTudo()
    }

    async function fabricar(): Promise<void> {
      if (controlador && (controlador.estado === 'executando' || controlador.estado === 'pausado')) return
      if (deposito.volumeTotal > 0 && !(await confirmar('Fabricar de novo?', 'A fabricação começa num substrato novo: a parede atual sai da mesa (a última inspeção continua na aba Inspeção).', { sim: 'Substrato novo e fabricar' }))) return
      deposito = new Deposito()
      iniciar('fabricar')
    }

    function passo(): void {
      if (!controlador || ['concluido', 'parado', 'alarme'].includes(controlador.estado)) {
        if (!validar(true)) return
        novoControlador('teste')
      }
      controlador!.passo()
      atualizarTudo()
    }

    function reiniciar(): void {
      if (controlador?.estado === 'executando' || controlador?.estado === 'pausado') controlador.parar()
      if (controlador) jog = copiaPose(controlador.pose)
      controlador = null
      ultimoEstado = null
      editor.marcarLinha(null)
      validar(false)
      atualizarTudo()
    }

    const ferramentasPrograma = h('div', { class: 'ma-ferramentas', role: 'toolbar', 'aria-label': 'Depuração do programa' },
      bValidar, bTeste, bFabricar, h('span', { class: 'ma-sep', 'aria-hidden': 'true' }), bPausar, bContinuar, bPasso, bParar, bReiniciar,
      h('label', { class: 'ma-velocidade' }, 'Relógio', seletorVelocidade))
    const ajudaComandos = () => {
      const tabela = h('table', { class: 'ma-tabela-ajuda' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Comando'), h('th', { scope: 'col' }, 'Forma aceita'), h('th', { scope: 'col' }, 'Exemplo'), h('th', { scope: 'col' }, 'O que faz'))),
        h('tbody', {}, AJUDA_COMANDOS.map((c) => h('tr', {}, h('th', { scope: 'row' }, c.comando), h('td', {}, h('code', {}, c.forma)), h('td', {}, h('code', {}, c.exemplo)), h('td', {}, c.explicacao)))))
      void abrirPainel('Comandos INFORM aceitos', h('div', { class: 'ma-ajuda' },
        h('p', {}, 'Subconjunto do INFORM III com o controlador DX200 (Yaskawa Motoman) como referência. O editor trata só do corpo do job (de NOP a END); os pontos C ficam na tabela de posições. Nada é exportado como arquivo .JBI: cabeçalho, posições e metadados do arquivo real não são gerados.'),
        tabela,
        h('p', {}, 'Unidades: V em mm/s (0,1 a 1500), VJ em % (0,01 a 100), TIMER em segundos (0,01 s), elementos de posição do SETE em mícrons (1 mm = 1000). Variáveis B (0 a 255), I e D (inteiras), P (posição): 000 a 099 neste simulador.'),
        h('p', {}, 'Não implementados (dão erro com o motivo, nunca são ignorados): PL, NWAIT, ACC/DEC, VR, UNTIL, MOVC, MOVS, IMOV, CALL, WAIT, DOUT/DIN, DEC, SUB, MUL, DIV, operações lógicas, comparações <>, <= e >=, ARCON com condição na linha (AC=, AV=...), ARCSET, oscilação (WVON), SFTON em outro sistema (UF#, TF), variáveis R e S. G-code, RAPID (ABB) e KRL (KUKA) são reconhecidos e recusados.')))
    }
    const restaurarExemplo = async () => {
      const exemplo = livre ? PROGRAMA_LIVRE : PROGRAMA_INICIAL
      if (!(await confirmar('Restaurar o programa de exemplo?', `O texto do editor volta ao programa inicial ${livre ? 'do modo livre (um cordão)' : 'da missão'}. Pontos e condições não mudam.`))) return
      editor.definir(exemplo)
      projeto.programa = exemplo
      salvar()
      validar(false)
    }
    const areaPrograma = h('section', { class: 'ma-programa', 'aria-label': 'Programa e depuração' },
      h('header', { class: 'ma-cab' }, h('h2', { class: 'tela-titulo', tabindex: '-1' }, 'Programa e depuração'), livre ? h('span', { class: 'ma-modo', title: 'Sem missão, sem nota' }, 'MODO LIVRE') : null,
        h('div', { class: 'ma-cab-botoes' }, botao('Comandos', 'Lista dos comandos aceitos, com exemplos', ajudaComandos), botao('Exemplo', 'Volta ao programa inicial da missão', () => void restaurarExemplo()))),
      ferramentasPrograma,
      h('p', { class: 'ma-linha-estado', role: 'status' }, estadoTexto, linhaTexto, tempoTexto),
      editor.elemento,
      resumoValidacao,
      mensagens)

    // ---------------- Posições e parâmetros ----------------
    const corpoPontos = h('tbody')
    const tabelaPontos = h('table', { class: 'ma-tabela' },
      h('caption', {}, 'Posições ensinadas do job (sistema da base, mm e graus). Clique numa linha para escolher o ponto.'),
      h('thead', {}, h('tr', {}, ['Ponto', 'Nome', 'X', 'Y', 'Z', 'Rx', 'Ry', 'Rz'].map((c) => h('th', { scope: 'col' }, c)))), corpoPontos)
    const desenharPontos = () => {
      corpoPontos.replaceChildren(...projeto.pontos.map((p, i) => {
        const linha = h('tr', { class: i === selecionado ? 'ma-sel' : '', tabindex: '0', 'aria-selected': String(i === selecionado), on: { click: () => { selecionado = i; desenharPontos() }, keydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionado = i; desenharPontos() } } } },
          h('th', { scope: 'row' }, nomePonto(i)), h('td', {}, p.nome || '—'),
          ...[p.pose.x, p.pose.y, p.pose.z].map((v) => h('td', {}, n2(v))), ...[p.pose.rx, p.pose.ry, p.pose.rz].map((v) => h('td', {}, n2(v))))
        return linha
      }))
      rotuloSelecionado.textContent = `${nomePonto(selecionado)} · ${projeto.pontos[selecionado]?.nome || 'sem nome'}`
    }
    const rotuloSelecionado = h('strong', {})
    const campoJog = {} as Record<keyof Pose, HTMLInputElement>
    const eixos: (keyof Pose)[] = ['x', 'y', 'z', 'rx', 'ry', 'rz']
    let passoMm = 1, passoGraus = 5
    const avisoJog = h('p', { class: 'ma-dica', role: 'status' })
    const moverJog = (eixo: keyof Pose, delta: number) => {
      if (rodando()) return
      jog = { ...jog, [eixo]: Math.round((jog[eixo] + delta) * 1000) / 1000 }
      atualizarJog()
    }
    const atualizarJog = () => {
      for (const e of eixos) if (document.activeElement !== campoJog[e]) campoJog[e].value = n2(jog[e]).replace(/\./g, '')
      const fora = foraDoAlcance(jog)
      const topo = deposito.dentro(jog.x, jog.y) ? deposito.topoNoRaio(jog.x, jog.y, 1) : null
      avisoJog.textContent = fora ? `Fora do alcance: o ponto ${fora}.` : topo !== null ? `TCP ${n1(jog.z - topo)} mm acima do topo da peça neste ponto.` : 'TCP fora de cima do substrato.'
    }
    const linhasJog = eixos.map((e) => {
      const rot = e.startsWith('r')
      const campo = h('input', { type: 'text', inputmode: 'decimal', class: 'ma-num', 'aria-label': `${e.toUpperCase()} da ferramenta (${rot ? 'graus' : 'mm'})` }) as HTMLInputElement
      campo.addEventListener('change', () => {
        const v = Number(campo.value.replace(',', '.'))
        if (Number.isFinite(v) && !rodando()) jog = { ...jog, [e]: v }
        atualizarJog()
      })
      campoJog[e] = campo
      return h('div', { class: 'ma-jog-eixo' }, h('span', {}, e.toUpperCase()),
        h('button', { type: 'button', 'aria-label': `${e.toUpperCase()} menos`, on: { click: () => moverJog(e, -(rot ? passoGraus : passoMm)) } }, '−'),
        campo,
        h('button', { type: 'button', 'aria-label': `${e.toUpperCase()} mais`, on: { click: () => moverJog(e, rot ? passoGraus : passoMm) } }, '+'))
    })
    const seletorPassoMm = h('select', { 'aria-label': 'Passo do jog em mm' }, PASSOS_MM.map((p) => h('option', { value: String(p), selected: p === passoMm }, `${n1(p)} mm`))) as HTMLSelectElement
    seletorPassoMm.addEventListener('change', () => { passoMm = Number(seletorPassoMm.value) })
    const seletorPassoGraus = h('select', { 'aria-label': 'Passo do jog em graus' }, PASSOS_GRAUS.map((p) => h('option', { value: String(p), selected: p === passoGraus }, `${p}°`))) as HTMLSelectElement
    seletorPassoGraus.addEventListener('change', () => { passoGraus = Number(seletorPassoGraus.value) })
    const registrar = () => {
      if (rodando() || !projeto.pontos[selecionado]) return
      const fora = foraDoAlcance(jog)
      if (fora) { avisoJog.textContent = `Não registrado: o ponto ${fora}.`; return }
      projeto.pontos[selecionado] = { ...projeto.pontos[selecionado], pose: copiaPose(jog) }
      salvar(); desenharPontos(); validar(false)
      avisoJog.textContent = `${nomePonto(selecionado)} registrado.`
    }
    const irAoPonto = () => { if (!rodando() && projeto.pontos[selecionado]) { jog = copiaPose(projeto.pontos[selecionado].pose); atualizarJog() } }
    const novoPonto = () => {
      if (rodando() || projeto.pontos.length >= LIMITES.pontos) return
      projeto.pontos.push({ nome: '', pose: copiaPose(jog) })
      selecionado = projeto.pontos.length - 1
      salvar(); desenharPontos(); validar(false)
    }
    const renomear = (campo: HTMLInputElement) => {
      if (!projeto.pontos[selecionado]) return
      projeto.pontos[selecionado].nome = campo.value.slice(0, 40)
      salvar(); desenharPontos()
    }
    const campoNome = h('input', { type: 'text', maxlength: '40', 'aria-label': 'Nome do ponto selecionado (só para a tabela)', placeholder: 'nome do ponto' }) as HTMLInputElement
    campoNome.addEventListener('change', () => renomear(campoNome))
    const excluirUltimo = async () => {
      if (rodando() || projeto.pontos.length <= 1) return
      const n = projeto.pontos.length - 1
      if (!(await confirmar(`Excluir ${nomePonto(n)}?`, 'O último ponto da tabela sai. Linhas do programa que usam esse ponto passam a dar erro.'))) return
      projeto.pontos.pop()
      selecionado = Math.min(selecionado, projeto.pontos.length - 1)
      salvar(); desenharPontos(); validar(false)
    }
    const abaPosicoes = h('div', { class: 'ma-aba ma-aba-posicoes' },
      h('div', { class: 'ma-rolagem' }, tabelaPontos),
      h('div', { class: 'ma-jog' },
        h('p', { class: 'ma-jog-titulo' }, 'Ferramenta virtual (TCP) · ponto ', rotuloSelecionado),
        h('div', { class: 'ma-jog-eixos' }, linhasJog),
        h('div', { class: 'ma-jog-passos' }, h('label', {}, 'Passo', seletorPassoMm), h('label', {}, 'Giro', seletorPassoGraus)),
        h('div', { class: 'ma-jog-acoes' },
          botao('Ir ao ponto', 'Leva a ferramenta virtual até o ponto selecionado', irAoPonto),
          botao('Registrar no ponto', 'Grava a posição da ferramenta virtual no ponto selecionado (como MODIFY + ENTER no pendente)', registrar, 'ma-fabricar'),
          botao('Novo ponto', 'Acrescenta um ponto com a posição da ferramenta virtual', novoPonto),
          botao('Excluir último', 'Remove o último ponto da tabela', () => void excluirUltimo())),
        h('label', { class: 'ma-nome' }, 'Nome', campoNome),
        avisoJog))

    // Célula: referência da peça, TCP, distância de trabalho e missão.
    const campoCtwd = h('input', { type: 'number', min: '8', max: '25', step: '0.5', value: String(projeto.celula.ctwdMm), class: 'ma-num' }) as HTMLInputElement
    campoCtwd.addEventListener('change', () => {
      const v = Number(campoCtwd.value)
      if (Number.isFinite(v)) projeto.celula.ctwdMm = Math.max(8, Math.min(25, v))
      campoCtwd.value = String(projeto.celula.ctwdMm)
      salvar()
    })
    const pecaNova = async () => {
      if (rodando() || (deposito.volumeTotal > 0 && !(await confirmar('Trocar o substrato?', 'A parede atual sai da mesa.')))) return
      deposito = new Deposito()
      controlador = null
      atualizarTudo()
    }
    const abaCelula = h('div', { class: 'ma-aba ma-texto' },
      h('dl', { class: 'ma-ficha' },
        h('dt', {}, 'Referência da peça'), h('dd', {}, `Substrato de ${SUBSTRATO.material}, ${SUBSTRATO.xMax - SUBSTRATO.xMin} × ${SUBSTRATO.yMax - SUBSTRATO.yMin} × ${SUBSTRATO.espessuraMm} mm, de X ${SUBSTRATO.xMin} a ${SUBSTRATO.xMax} e Y ${SUBSTRATO.yMin} a ${SUBSTRATO.yMax}. O topo dele está em Z = 0 no sistema da base (a mesa foi posta assim).`),
        h('dt', {}, 'TCP'), h('dd', {}, 'Na ponta do arame, à distância de trabalho do bico de contato. TCP no topo da peça = arco na distância certa.'),
        h('dt', {}, 'Distância de trabalho (bico–peça)'), h('dd', {}, h('label', { class: 'ma-inline' }, campoCtwd, ' mm'), ' O bocal bate na peça quando ela sobe acima dele.'),
        h('dt', {}, 'Orientação da tocha'), h('dd', {}, 'Vertical: Rx 180°, Ry 0°. Inclinar mais de 15° conta na inspeção.'),
        livre ? h('dt', {}, 'Modo livre') : null, livre ? h('dd', {}, 'Sem missão, sem nota e sem aprovação. Fabrique o que quiser sobre o substrato; a inspeção mostra as medidas da peça e os avisos do processo (distância da tocha, calor, cordão partido…).') : null,
        livre ? null : h('dt', {}, 'Missão'), livre ? null : h('dd', {}, `Parede de X ${MISSAO_PAREDE.xInicio} a ${MISSAO_PAREDE.xFim} mm em Y ${MISSAO_PAREDE.y}; altura útil de ${MISSAO_PAREDE.alturaMinMm} mm ou mais, largura de ${MISSAO_PAREDE.larguraMinMm} mm ou mais, sem falhas, interpasse até ${MISSAO_PAREDE.interpasseMaxC} °C (limite da missão). Velocidade de soldagem e incremento de camada ficam no programa.`),
        h('dt', {}, 'MOVJ e MOVL'), h('dd', {}, 'MOVL leva o TCP em linha reta na velocidade V (mm/s): é o movimento de soldar. MOVJ move as juntas: o caminho do TCP não é reto. Sem a cinemática do robô, o simulador desenha um arco ilustrativo e estima o tempo por VJ; não é o caminho do robô real.'),
        h('dt', {}, 'Robô'), h('dd', {}, `Ilustrativo, com o alcance de ${LIMITES.alcanceMm} mm do MA1440 como limite dos pontos. Não é réplica do robô nem do controlador.`)),
      h('div', { class: 'ma-jog-acoes' },
        livre ? null : botao('Conferi a célula', 'Marca na atividade que você leu a célula', () => { atividade.celula = true; desenharAtividade() }),
        botao('Substrato novo', 'Tira a parede da mesa', () => void pecaNova())))

    // Condições: arquivos do controlador (ASF/AEF) e a fonte, separados.
    const corpoCondicoes = h('div', { class: 'ma-condicoes' })
    const campoCondicao = (valor: number, faixa: { min: number; max: number }, passo: string, rotulo: string, aplicar: (v: number) => void) => {
      const c = h('input', { type: 'number', min: String(faixa.min), max: String(faixa.max), step: passo, value: String(valor), class: 'ma-num', 'aria-label': rotulo }) as HTMLInputElement
      c.addEventListener('change', () => {
        const v = Number(c.value)
        if (Number.isFinite(v)) aplicar(Math.max(faixa.min, Math.min(faixa.max, v)))
        salvar(); desenharCondicoes(); validar(false)
      })
      return c
    }
    const desenharCondicoes = () => {
      const c = projeto.condicoes
      const asf = c.inicio.map((a, i) => {
        const s = sinergia(a.alimentacaoMMin, a.correcaoArco), q = vazaoDeposito(a.alimentacaoMMin)
        return h('tr', {}, h('th', { scope: 'row' }, `ASF#(${i + 1})`),
          h('td', {}, campoCondicao(a.alimentacaoMMin, FAIXA_ALIMENTACAO, '0.1', `Alimentação do ASF ${i + 1} (m/min)`, (v) => { a.alimentacaoMMin = v })),
          h('td', {}, campoCondicao(a.correcaoArco, FAIXA_CORRECAO, '1', `Correção do arco do ASF ${i + 1}`, (v) => { a.correcaoArco = Math.round(v) })),
          h('td', {}, `${Math.round(s.correnteA)} A · ${n1(s.tensaoV)} V`), h('td', {}, `${Math.round(q)} mm³/s`), h('td', {}, `${n1(q / 8)} mm²`))
      })
      const aef = c.fim.map((a, i) => h('tr', {}, h('th', { scope: 'row' }, `AEF#(${i + 1})`),
        h('td', {}, campoCondicao(a.crateraS, FAIXA_CRATERA, '0.1', `Tempo de cratera do AEF ${i + 1} (s)`, (v) => { a.crateraS = v })),
        h('td', {}, campoCondicao(a.alimentacaoMMin, FAIXA_ALIMENTACAO, '0.1', `Alimentação na cratera do AEF ${i + 1} (m/min)`, (v) => { a.alimentacaoMMin = v }))))
      corpoCondicoes.replaceChildren(
        h('table', { class: 'ma-tabela' }, h('caption', {}, 'Início de arco (no controlador do robô). Corrente e tensão vêm da linha sinérgica da fonte.'),
          h('thead', {}, h('tr', {}, ['Arquivo', 'Alimentação m/min', 'Correção do arco', 'Fonte (sinérgico)', 'Metal', 'Seção a 8 mm/s'].map((t) => h('th', { scope: 'col' }, t)))), h('tbody', {}, asf)),
        h('div', { class: 'ma-jog-acoes' },
          botao('+ ASF', 'Novo arquivo de início de arco', () => { if (c.inicio.length < ARQUIVOS_MAX && !rodando()) { c.inicio.push({ ...c.inicio[c.inicio.length - 1] }); salvar(); desenharCondicoes(); validar(false) } }),
          botao('− ASF', 'Remove o último arquivo de início', () => { if (c.inicio.length > 1 && !rodando()) { c.inicio.pop(); salvar(); desenharCondicoes(); validar(false) } })),
        h('table', { class: 'ma-tabela' }, h('caption', {}, 'Fim de arco: preenchimento da cratera com o robô parado.'),
          h('thead', {}, h('tr', {}, ['Arquivo', 'Tempo de cratera s', 'Alimentação m/min'].map((t) => h('th', { scope: 'col' }, t)))), h('tbody', {}, aef)),
        h('div', { class: 'ma-jog-acoes' },
          botao('+ AEF', 'Novo arquivo de fim de arco', () => { if (c.fim.length < ARQUIVOS_MAX && !rodando()) { c.fim.push({ ...c.fim[c.fim.length - 1] }); salvar(); desenharCondicoes(); validar(false) } }),
          botao('− AEF', 'Remove o último arquivo de fim', () => { if (c.fim.length > 1 && !rodando()) { c.fim.pop(); salvar(); desenharCondicoes(); validar(false) } })),
        h('p', { class: 'ma-dica' }, `Fonte de soldagem (painel da própria fonte, separado do robô): ${LINHA_SINERGICA.nome}. Os números da linha sinérgica são do jogo, não do fabricante. Movimento (MOVL/MOVJ e V=) fica no programa; condição de soldagem fica nestes arquivos.`))
    }
    const abaCondicoes = h('div', { class: 'ma-aba ma-rolagem' }, corpoCondicoes)

    // Variáveis (lidas do executor).
    const corpoVariaveis = h('div', { class: 'ma-variaveis' })
    const desenharVariaveis = () => {
      const c = controlador
      const lista = (tipo: 'B' | 'I' | 'D') => h('div', {}, h('h3', {}, tipo), h('ul', {}, Array.from({ length: 6 }, (_, i) => h('li', {}, `${tipo}${String(i).padStart(3, '0')} = ${c ? c[tipo][i] : 0}`))))
      const pos = h('div', {}, h('h3', {}, 'P (mm)'), h('ul', {}, Array.from({ length: 4 }, (_, i) => {
        const p = c?.P[i]
        return h('li', {}, `P${String(i).padStart(3, '0')} = ${p ? `${n2(p.x)}, ${n2(p.y)}, ${n2(p.z)}` : '0, 0, 0'}`)
      })))
      const d = c?.deslocamento
      corpoVariaveis.replaceChildren(lista('B'), lista('I'), lista('D'), pos,
        h('p', { class: 'ma-dica' }, d ? `Deslocamento ligado (SFTON): ${n2(d.x)}, ${n2(d.y)}, ${n2(d.z)} mm.` : 'Deslocamento desligado (SFTOF).', ' As variáveis começam em zero a cada execução.'))
    }
    const abaVariaveis = h('div', { class: 'ma-aba ma-rolagem' }, corpoVariaveis)

    // Atividade guiada.
    const corpoAtividade = h('ol', { class: 'ma-atividade' })
    function desenharAtividade(): void {
      const passos: [boolean, string, string][] = [
        [atividade.celula, 'Prepare a célula', 'Leia a aba Célula: referência da peça, TCP, distância de trabalho e a missão. Depois, “Conferi a célula”.'],
        [atividade.validou, 'Valide o programa', 'Clique em Validar. Leia o programa: onde a camada começa, onde o arco abre e quanto a tocha sobe por camada (ADD D000 …, em mícrons).'],
        [atividade.testou, 'Execute sem deposição', 'Rode até o END com o arco inibido. Use Passo para seguir linha a linha e veja o caminho azul e laranja na célula.'],
        [atividade.fabricou, 'Fabrique', 'Fabrique a parede. Acompanhe a distância do TCP ao topo e a temperatura no painel da célula.'],
        [atividade.inspecionou, 'Inspecione', 'Na aba Inspeção, compare a altura que cada camada somou com o incremento programado e veja o interpasse de cada camada.'],
        [atividade.aprovou, 'Corrija e aprove', 'Ajuste o incremento (ADD D000) e a espera (TIMER) pelo que mediu, fabrique de novo e aprove a parede.'],
      ]
      const primeiraAberta = passos.findIndex(([feito]) => !feito)
      corpoAtividade.replaceChildren(...passos.map(([feito, titulo, texto], i) => h('li', { class: feito ? 'ma-feito' : i === primeiraAberta ? 'ma-agora' : '' },
        h('strong', {}, `${feito ? '✓ ' : ''}${titulo}`), h('span', {}, texto))))
    }
    const melhorTexto = h('p', { class: 'ma-dica' })
    const abaAtividade = h('div', { class: 'ma-aba ma-rolagem' }, corpoAtividade, melhorTexto)

    // Inspeção.
    const corpoInspecao = h('div', { class: 'ma-inspecao' }, h('p', { class: 'ma-dica' }, 'Fabrique a parede para ver a inspeção: dimensões, uniformidade, continuidade, material, tempo e o que corrigir.'))
    const desenharInspecao = (a: AvaliacaoParede, c: Controlador) => {
      const m = a.medidas
      const perfil = h('canvas', { width: 560, height: 150, class: 'ma-perfil', 'aria-label': 'Perfil da parede: altura do topo ao longo de X' }) as HTMLCanvasElement
      const g = perfil.getContext('2d')
      if (g) {
        const xs = m.amostras, hMax = Math.max(MISSAO_PAREDE.alturaMinMm + 4, ...xs.map((s) => s.alturaMm)) * 1.1
        const px = (x: number) => 30 + ((x - xs[0].x) / (xs[xs.length - 1].x - xs[0].x)) * 520, py = (v: number) => 135 - (v / hMax) * 120
        g.fillStyle = '#141b20'; g.fillRect(0, 0, 560, 150)
        g.fillStyle = '#5d6d77'
        g.beginPath(); g.moveTo(px(xs[0].x), py(0))
        for (const s of xs) g.lineTo(px(s.x), py(s.alturaMm))
        g.lineTo(px(xs[xs.length - 1].x), py(0)); g.fill()
        g.strokeStyle = '#ffc440'; g.setLineDash([4, 3])
        g.beginPath(); g.moveTo(px(xs[0].x), py(MISSAO_PAREDE.alturaMinMm)); g.lineTo(px(xs[xs.length - 1].x), py(MISSAO_PAREDE.alturaMinMm)); g.stroke()
        for (const x of [MISSAO_PAREDE.xInicio + MISSAO_PAREDE.margemPontasMm, MISSAO_PAREDE.xFim - MISSAO_PAREDE.margemPontasMm]) { g.beginPath(); g.moveTo(px(x), 10); g.lineTo(px(x), 138); g.stroke() }
        g.setLineDash([])
        g.fillStyle = '#cfd6da'; g.font = '11px Consolas, monospace'
        g.fillText(`${MISSAO_PAREDE.alturaMinMm} mm (mín.)`, 34, py(MISSAO_PAREDE.alturaMinMm) - 4)
        g.fillText(`X ${xs[0].x}`, 30, 148); g.textAlign = 'right'; g.fillText(`X ${xs[xs.length - 1].x}`, 550, 148)
      }
      const camadas = h('table', { class: 'ma-tabela' }, h('caption', {}, 'Camadas: interpasse no ARCON e altura do TCP sobre o topo (o incremento acompanha a parede?)'),
        h('thead', {}, h('tr', {}, ['Camada', 'Linha', 'Interpasse', 'TCP–topo no início', 'Comprimento', 'Fechamento'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, c.passes.map((p) => h('tr', {}, h('th', { scope: 'row' }, String(p.numero)), h('td', {}, `L${p.linha}`), h('td', {}, `${Math.round(p.interpasseC)} °C`), h('td', {}, `${n1(p.folgaInicialMm)} mm`), h('td', {}, `${Math.round(p.comprimentoMm)} mm`), h('td', {}, p.fechamento)))))
      corpoInspecao.replaceChildren(
        h('div', { class: `ma-nota ${a.aprovada ? 'ma-ok' : 'ma-falha'}` }, h('strong', {}, `${a.nota} / 1000`), h('span', {}, a.aprovada ? 'PAREDE APROVADA' : 'PAREDE REPROVADA')),
        h('ul', { class: 'ma-itens' }, a.itens.map((i) => h('li', {}, h('b', {}, `${i.nome}: ${i.pontos}/${i.maximo}`), ` — ${i.detalhe}`))),
        h('p', {}, `Medidas: altura útil ${n1(m.alturaUtilMm)} mm (média ${n1(m.alturaMediaMm)}), largura ${n1(m.larguraMinMm)}–${n1(m.larguraMediaMm)} mm, comprimento ${Math.round(m.comprimentoMm)} mm, ${a.camadas} camadas, ${n2(a.alturaPorCamadaMm)} mm por camada. Arame ${n1(a.arameG)} g, energia ${Math.round(a.energiaKJ)} kJ, ciclo ${Math.round(a.tempoS)} s (arco aberto ${Math.round(a.tempoArcoS)} s).`),
        perfil,
        h('h3', {}, 'O que corrigir'),
        h('ul', { class: 'ma-achados' }, a.achados.map((x) => h('li', { class: x.grave ? 'ma-grave' : '' }, h('b', {}, x.nome), ` (${x.onde}). `, x.causa, ' ', h('em', {}, `Correção: ${x.correcao}`)))),
        camadas,
        h('p', { class: 'ma-dica' }, 'Modelo didático (H106): tendências, não previsão metalúrgica. O mapa de alturas não representa a ondulação das laterais nem a microestrutura.'))
    }
    const abaInspecao = h('div', { class: 'ma-aba ma-rolagem' }, corpoInspecao)
    if (livre) corpoInspecao.replaceChildren(h('p', { class: 'ma-dica' }, 'Modo livre: sem missão e sem nota. Fabrique para ver as medidas da peça, o perfil e os avisos do processo.'))
    const desenharInspecaoLivre = (a: InspecaoLivre, c: Controlador) => {
      const perfil = h('canvas', { width: 560, height: 150, class: 'ma-perfil', 'aria-label': 'Perfil da peça visto de lado: o topo mais alto em cada X' }) as HTMLCanvasElement
      const g = perfil.getContext('2d')
      if (g && a.perfil.length > 1) {
        const xs = a.perfil, hMax = Math.max(5, a.alturaMaxMm) * 1.1
        const px = (x: number) => 30 + ((x - xs[0].x) / (xs[xs.length - 1].x - xs[0].x)) * 520, py = (v: number) => 135 - (v / hMax) * 120
        g.fillStyle = '#141b20'; g.fillRect(0, 0, 560, 150)
        g.fillStyle = '#5d6d77'
        g.beginPath(); g.moveTo(px(xs[0].x), py(0))
        for (const s of xs) g.lineTo(px(s.x), py(s.alturaMm))
        g.lineTo(px(xs[xs.length - 1].x), py(0)); g.fill()
        g.fillStyle = '#cfd6da'; g.font = '11px Consolas, monospace'
        g.fillText(`${n1(a.alturaMaxMm)} mm`, 34, py(a.alturaMaxMm) - 4)
        g.fillText(`X ${Math.round(xs[0].x)}`, 30, 148); g.textAlign = 'right'; g.fillText(`X ${Math.round(xs[xs.length - 1].x)}`, 550, 148)
      }
      const e = a.extensao
      const passes = h('table', { class: 'ma-tabela' }, h('caption', {}, 'Passes com arco: interpasse no ARCON e altura do TCP sobre o topo'),
        h('thead', {}, h('tr', {}, ['Passe', 'Linha', 'Interpasse', 'TCP–topo no início', 'Comprimento', 'Fechamento'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, c.passes.map((p) => h('tr', {}, h('th', { scope: 'row' }, String(p.numero)), h('td', {}, `L${p.linha}`), h('td', {}, `${Math.round(p.interpasseC)} °C`), h('td', {}, `${n1(p.folgaInicialMm)} mm`), h('td', {}, `${Math.round(p.comprimentoMm)} mm`), h('td', {}, p.fechamento)))))
      corpoInspecao.replaceChildren(
        h('div', { class: 'ma-nota' }, h('strong', {}, 'MODO LIVRE'), h('span', {}, 'sem nota: só as medidas')),
        h('p', {}, e
          ? `Peça de X ${Math.round(e.xMin)} a ${Math.round(e.xMax)} mm e Y ${Math.round(e.yMin)} a ${Math.round(e.yMax)} mm; altura máxima ${n1(a.alturaMaxMm)} mm; ${a.passes} passe(s), cerca de ${n2(a.alturaPorCamadaMm)} mm por passe empilhado; área ocupada ${Math.round(a.areaOcupadaMm2)} mm².`
          : 'Nenhum metal sobre o substrato.'),
        h('p', {}, `Metal ${Math.round(a.volumeMm3)} mm³, arame ${n1(a.arameG)} g, energia ${Math.round(a.energiaKJ)} kJ, tempo ${Math.round(a.tempoS)} s (arco aberto ${Math.round(a.tempoArcoS)} s), ${c.passes.length > 1 ? `interpasse máximo ${Math.round(a.interpasseMaxC)} °C` : 'interpasse: só há um passe'}.`),
        perfil,
        h('h3', {}, 'Avisos do processo'),
        h('ul', { class: 'ma-achados' }, a.achados.length
          ? a.achados.map((x) => h('li', { class: x.grave ? 'ma-grave' : '' }, h('b', {}, x.nome), ` (${x.onde}). `, x.causa, ' ', h('em', {}, `Correção: ${x.correcao}`)))
          : h('li', {}, 'Nenhum aviso.')),
        passes,
        h('p', { class: 'ma-dica' }, 'Modelo didático (H106): tendências, não previsão metalúrgica.'))
    }

    const listaAbas: [string, HTMLElement][] = [['Posições', abaPosicoes], ['Célula', abaCelula], ['Condições', abaCondicoes], ['Variáveis', abaVariaveis], ...(livre ? [] : [['Atividade', abaAtividade] as [string, HTMLElement]]), ['Inspeção', abaInspecao]]
    const abas = montarAbas(listaAbas, 'Posições e parâmetros')
    const abaDaInspecao = listaAbas.length - 1
    const areaParametros = h('section', { class: 'ma-parametros', 'aria-label': 'Posições e parâmetros' }, abas.lista, ...abas.corpos)
    abas.lista.addEventListener('click', () => { if (!abas.corpos[abaDaInspecao].hidden && avaliacao) { atividade.inspecionou = true; desenharAtividade() } })

    // ---------------- Célula 3D ----------------
    const hudEstado = h('strong', { class: 'ma-hud-estado', role: 'status', 'aria-live': 'polite' })
    const hudTcp = h('output', {}), hudArco = h('output', {}), hudFolga = h('output', {}), hudTemp = h('output', {}), hudCamada = h('output', {})
    const hud = h('div', { class: 'ma-hud' }, hudEstado,
      h('dl', {}, h('dt', {}, 'TCP'), h('dd', {}, hudTcp), h('dt', {}, 'Arco'), h('dd', {}, hudArco), h('dt', {}, 'TCP–topo'), h('dd', {}, hudFolga), h('dt', {}, 'Parede'), h('dd', {}, hudTemp), h('dt', {}, 'Camadas'), h('dd', {}, hudCamada)))
    const botoesVista = h('div', { class: 'ma-vistas', role: 'group', 'aria-label': 'Câmera' },
      botao('Peça', 'Câmera na parede', () => vista.vista('peca')), botao('Lado', 'Câmera de lado, para ver o perfil', () => vista.vista('lado')), botao('Célula', 'Câmera na célula inteira', () => vista.vista('celula')))
    const areaVista = h('section', { class: 'ma-vista', 'aria-label': 'Célula 3D e peça' }, vista.canvas, hud, botoesVista,
      h('p', { class: 'ma-legenda' }, livre ? 'Robô ilustrativo · laranja: caminho com arco · azul: sem arco · amarelo: ponto selecionado' : 'Robô ilustrativo · laranja: caminho com arco · azul: sem arco · amarelo: pontos e limites da missão'))

    app.raiz.append(h('div', { class: 'ma' }, areaPrograma, h('div', { class: 'ma-direita' }, areaVista, areaParametros)))

    function rodando(): boolean {
      return !!controlador && (controlador.estado === 'executando' || controlador.estado === 'pausado')
    }

    // ---------------- Atualização ----------------
    function atualizarTudo(): void {
      const c = controlador
      const estado = c?.estado ?? 'pronto'
      const ativo = rodando()
      editor.somenteLeitura(ativo)
      bValidar.disabled = ativo; bTeste.disabled = ativo; bFabricar.disabled = ativo
      bPausar.disabled = estado !== 'executando'
      bContinuar.disabled = estado !== 'pausado'
      bParar.disabled = !ativo
      bReiniciar.disabled = !c
      bPasso.disabled = estado === 'executando'
      areaParametros.classList.toggle('ma-travado', ativo)
      estadoTexto.textContent = c ? `${NOME_ESTADO[estado]}${c.modo === 'teste' ? ' · sem deposição' : ' · fabricando'}` : 'Pronto'
      estadoTexto.dataset.estado = estado
      linhaTexto.textContent = c?.linhaAtual ? ` · linha ${c.linhaAtual}` : ''
      tempoTexto.textContent = c ? ` · ${n1(c.tempo)} s simulados · ${c.executadas} instruções` : ''
      editor.marcarLinha(c && estado !== 'concluido' ? c.linhaAtual : null)
      if (c) listaMensagens(programa.diagnosticos.filter((d) => d.gravidade === 'aviso'), c.eventos)
      const pose = c ? c.pose : jog
      hudEstado.textContent = estadoTexto.textContent
      hudEstado.dataset.estado = estado
      hudTcp.textContent = `X ${n1(pose.x)} · Y ${n1(pose.y)} · Z ${n1(pose.z)}`
      hudArco.textContent = c?.arcoAceso ? 'ABERTO' : c?.arco ? 'inibido (teste)' : 'fechado'
      hudArco.dataset.arco = String(!!c?.arcoAceso)
      const topo = deposito.dentro(pose.x, pose.y) ? deposito.topoNoRaio(pose.x, pose.y, 1) : null
      const folga = c?.arcoAceso && c.ultimaFolgaMm !== null ? c.ultimaFolgaMm : topo !== null ? pose.z - topo : null
      hudFolga.textContent = folga === null ? '—' : `${n1(folga)} mm`
      hudFolga.dataset.alerta = String(folga !== null && (c?.arcoAceso ?? false) && (folga > 6 || folga < -3))
      hudTemp.textContent = c ? `${Math.round(c.termico.temperaturaC)} °C` : '—'
      hudCamada.textContent = String(c?.passes.length ?? 0)
      desenharVariaveis()
      if (!ativo) atualizarJog()
    }

    const aoTerminar = (c: Controlador) => {
      if (c.modo === 'teste') {
        if (c.estado === 'concluido') { atividade.testou = true; desenharAtividade() }
        return
      }
      jog = copiaPose(c.pose)
      if (livre) {
        desenharInspecaoLivre(inspecionarLivre(c), c)
        abas.escolher(abaDaInspecao)
        return
      }
      if (c.estado === 'concluido' || c.estado === 'alarme' || c.estado === 'parado') {
        avaliacao = avaliarParede(c)
        atividade.fabricou = true
        desenharInspecao(avaliacao, c)
        abas.escolher(abaDaInspecao)
        atividade.inspecionou = true
        if (avaliacao.aprovada) atividade.aprovou = true
        const melhor = app.manufatura.melhor
        if (!melhor || avaliacao.nota > melhor.nota || (avaliacao.aprovada && !melhor.aprovada)) {
          app.manufatura = { ...app.manufatura, melhor: { nota: avaliacao.nota, aprovada: avaliacao.aprovada, data: new Date().toISOString() } }
          app.salvar('manufatura')
        }
        desenharMelhor()
        desenharAtividade()
      }
    }
    const desenharMelhor = () => {
      const m = app.manufatura.melhor
      melhorTexto.textContent = m ? `Melhor parede neste navegador: ${m.nota} / 1000${m.aprovada ? ' (aprovada)' : ''}.` : 'Nenhuma parede fabricada ainda.'
    }

    // Laço de quadros: o executor tem passo fixo; aqui só se entrega o tempo real × velocidade.
    let anterior = performance.now(), quadro = 0, ultimoDom = 0
    const DT_MAX = 0.25
    const laco = (agora: number) => {
      const dt = Math.min(DT_MAX, Math.max(0, (agora - anterior) / 1000))
      anterior = agora
      const c = controlador
      if (c && c.estado === 'executando' && !app.jogoPausado) c.avancar(dt * velocidade)
      if (c && c.estado !== ultimoEstado) {
        ultimoEstado = c.estado
        if (['concluido', 'alarme', 'parado'].includes(c.estado)) aoTerminar(c)
        atualizarTudo()
        ultimoDom = agora
      } else if (agora - ultimoDom > 120) { atualizarTudo(); ultimoDom = agora }
      vista.atualizar({ pose: c ? c.pose : jog, arco: !!c?.arcoAceso, ctwdMm: projeto.celula.ctwdMm, pontos: projeto.pontos, selecionado, rastro: c?.rastro ?? [], deposito, temperaturaC: c?.termico.temperaturaC ?? 25 })
      vista.desenhar()
      quadro = requestAnimationFrame(laco)
    }
    const observador = new ResizeObserver(() => vista.ajustarTamanho(areaVista.clientWidth, areaVista.clientHeight))
    observador.observe(areaVista)
    app.controlePausa = {
      pausar: () => { pausadoPeloMenu = controlador?.estado === 'executando'; controlador?.pausar() },
      retomar: () => { if (pausadoPeloMenu) controlador?.continuar(); pausadoPeloMenu = false },
    }

    desenharPontos()
    desenharCondicoes()
    desenharAtividade()
    desenharMelhor()
    validar(false)
    atualizarTudo()
    vista.vista('celula')
    quadro = requestAnimationFrame(laco)
    return () => {
      cancelAnimationFrame(quadro)
      observador.disconnect()
      clearTimeout(timerValidar)
      salvar(true)
      vista.destruir()
    }
  }, livre ? 'Manufatura aditiva · modo livre' : 'Manufatura aditiva')
}
