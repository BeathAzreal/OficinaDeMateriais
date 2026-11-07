import { MISSAO_PAREDE } from '../modelo/manufatura/celula'
import { CELULA_MM, type Deposito } from '../modelo/manufatura/deposicao'
import type { Controlador, Passe } from '../modelo/manufatura/executor'

/*
 * Inspeção e nota da parede (H106-e). Tudo sai do mapa de alturas e do
 * registro dos passes; o 3D só desenha. As exigências (altura, largura,
 * interpasse) são da MISSÃO, para o treino, não de norma.
 */

export interface AmostraParede { x: number; alturaMm: number; larguraMm: number }

export interface MedidasParede {
  amostras: AmostraParede[]
  /** Menor altura no trecho útil: o que sobra depois de usinar o topo plano. */
  alturaUtilMm: number
  alturaMediaMm: number
  desvioAlturaMm: number
  /** Inclinação do topo no trecho útil (mm a cada 100 mm). */
  inclinacaoMm100: number
  larguraMinMm: number
  larguraMediaMm: number
  /** Trecho com parede (altura acima de metade da mediana). */
  inicioMm: number
  fimMm: number
  comprimentoMm: number
  /** Trechos do trecho útil onde a parede falha (abaixo de 60 % da mediana). */
  falhas: { x0: number; x1: number }[]
  volumeDepositadoMm3: number
  /**
   * Fração da parede que sobra depois de usinar: o topo é aplainado na
   * altura mínima e as pontas (início e fim de cordão) são cortadas.
   * A ondulação das laterais não entra: o mapa de alturas não a representa.
   */
  aproveitamento: number
}

export interface ItemNota { nome: string; pontos: number; maximo: number; detalhe: string }
export interface Achado { nome: string; onde: string; causa: string; correcao: string; grave: boolean }

export interface AvaliacaoParede {
  medidas: MedidasParede
  itens: ItemNota[]
  nota: number
  aprovada: boolean
  achados: Achado[]
  camadas: number
  interpasseMaxC: number
  tempoS: number
  tempoArcoS: number
  arameG: number
  energiaKJ: number
  /** Altura média que cada camada somou (mm), para comparar com o incremento. */
  alturaPorCamadaMm: number
}

const mediana = (v: number[]) => {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function medirParede(dep: Deposito): MedidasParede {
  const m = MISSAO_PAREDE
  const amostras: AmostraParede[] = []
  for (let x = m.xInicio - 15; x <= m.xFim + 15; x += 1) {
    let topo = 0
    for (let y = m.y - 15; y <= m.y + 15; y += CELULA_MM) topo = Math.max(topo, dep.alturaEm(x + 0.25, y + 0.25))
    let largura = 0
    if (topo > 0.2) for (let y = m.y - 15; y <= m.y + 15; y += CELULA_MM) if (dep.alturaEm(x + 0.25, y + 0.25) >= 0.5 * topo) largura += CELULA_MM
    amostras.push({ x, alturaMm: topo, larguraMm: largura })
  }
  const util = amostras.filter((a) => a.x >= m.xInicio + m.margemPontasMm && a.x <= m.xFim - m.margemPontasMm)
  const alturas = util.map((a) => a.alturaMm)
  const med = mediana(amostras.map((a) => a.alturaMm).filter((h) => h > 0.2))
  const media = alturas.reduce((s, h) => s + h, 0) / Math.max(1, alturas.length)
  const desvio = Math.sqrt(alturas.reduce((s, h) => s + (h - media) ** 2, 0) / Math.max(1, alturas.length))
  // Reta pelos mínimos quadrados: a inclinação mostra um lado crescendo mais que o outro.
  const xm = util.reduce((s, a) => s + a.x, 0) / Math.max(1, util.length)
  let num = 0, den = 0
  for (const a of util) { num += (a.x - xm) * (a.alturaMm - media); den += (a.x - xm) ** 2 }
  const inclinacao = den > 0 ? (num / den) * 100 : 0
  const com = amostras.filter((a) => med > 0 && a.alturaMm >= 0.5 * med)
  const inicio = com.length ? com[0].x : 0, fim = com.length ? com[com.length - 1].x : 0
  const falhas: { x0: number; x1: number }[] = []
  let aberta: { x0: number; x1: number } | null = null
  for (const a of util) {
    const falha = med <= 0.2 || a.alturaMm < 0.6 * med
    if (falha) { if (aberta) aberta.x1 = a.x; else { aberta = { x0: a.x, x1: a.x }; falhas.push(aberta) } }
    else aberta = null
  }
  const alturaUtil = alturas.length ? Math.min(...alturas) : 0
  const larguraMin = util.length ? Math.min(...util.map((a) => a.larguraMm)) : 0
  const larguraMedia = util.reduce((s, a) => s + a.larguraMm, 0) / Math.max(1, util.length)
  const comprimento = com.length ? fim - inicio : 0
  const aproveitamento = media > 0 && comprimento > 0 ? (alturaUtil / media) * Math.min(1, (util.length - 1) / comprimento) : 0
  return {
    amostras, alturaUtilMm: alturaUtil, alturaMediaMm: media, desvioAlturaMm: desvio, inclinacaoMm100: inclinacao,
    larguraMinMm: larguraMin, larguraMediaMm: larguraMedia, inicioMm: inicio, fimMm: fim, comprimentoMm: comprimento,
    falhas, volumeDepositadoMm3: dep.volumeTotal, aproveitamento: Math.max(0, aproveitamento),
  }
}

const rampa = (v: number, zero: number, cheio: number) => Math.max(0, Math.min(1, (v - zero) / (cheio - zero)))
const mm = (v: number) => v.toFixed(1).replace('.', ',')

/** Distância total (mm) andada com um defeito em todos os passes. */
function comDefeito(passes: Passe[], d: keyof Passe['defeitos']): number {
  return passes.reduce((s, p) => s + (p.defeitos[d] ?? 0), 0)
}

export function avaliarParede(c: Controlador): AvaliacaoParede {
  const m = MISSAO_PAREDE
  const med = medirParede(c.deposito)
  const passes = c.passes
  const camadas = passes.filter((p) => p.comprimentoMm > 20).length
  const interpasseMax = passes.slice(1).reduce((s, p) => Math.max(s, p.interpasseC), 0)
  const alarme = c.eventos.find((e) => e.tipo === 'alarme')
  const tempoArco = passes.reduce((s, p) => s + (p.tFim - p.tInicio), 0)
  const alturaPorCamada = camadas ? med.alturaMediaMm / camadas : 0
  const achados: Achado[] = []

  const descontinuo = comDefeito(passes, 'descontinuo') + comDefeito(passes, 'humping')
  const instavel = comDefeito(passes, 'instavel') + comDefeito(passes, 'mergulho')
  const escorreu = comDefeito(passes, 'escorrimento')
  const movj = comDefeito(passes, 'movj')
  const semCratera = passes.filter((p) => p.fechamento === 'END' || p.fechamento === 'parada').length

  const dim = 0.5 * rampa(med.alturaUtilMm, 0, m.alturaMinMm) + 0.25 * rampa(med.larguraMinMm, 0, m.larguraMinMm) + 0.25 * rampa(med.comprimentoMm, 50, (m.xFim - m.xInicio) * 0.95)
  const uni = 0.7 * (1 - rampa(med.desvioAlturaMm, m.desvioAlturaBomMm, 2)) + 0.3 * (1 - rampa(Math.abs(med.inclinacaoMm100), 0.5, 4))
  const comprimentoUtil = m.xFim - m.xInicio - 2 * m.margemPontasMm
  const continuidade = (1 - Math.min(1, med.falhas.reduce((s, f) => s + f.x1 - f.x0 + 1, 0) / 10)) * (1 - Math.min(1, descontinuo / Math.max(1, comprimentoUtil * Math.max(1, camadas)) * 3))
  const termico = (1 - rampa(interpasseMax, m.interpasseMaxC, 2 * m.interpasseMaxC)) * (escorreu > 0 ? 0.5 : 1)
  const ultimos = passes.slice(-3)
  const folgaFinal = ultimos.length ? ultimos.reduce((s, p) => s + p.folgaInicialMm, 0) / ultimos.length : 0
  const programa = alarme ? 0 : Math.max(0, 1 - 0.25 * semCratera - (movj > 0 ? 0.3 : 0) - 0.6 * rampa(Math.abs(folgaFinal), 1.5, 6) - Math.min(0.3, instavel / 300))
  const eficiencia = 0.65 * rampa(med.aproveitamento, 0.4, 0.75) + 0.35 * (1 - rampa(c.tempo, 700, 1500))
  const itens: ItemNota[] = [
    { nome: 'Dimensões', maximo: 250, pontos: Math.round(250 * dim), detalhe: `altura útil ${mm(med.alturaUtilMm)} mm (mín. ${m.alturaMinMm}), largura mín. ${mm(med.larguraMinMm)} mm (mín. ${m.larguraMinMm}), comprimento ${mm(med.comprimentoMm)} mm` },
    { nome: 'Uniformidade', maximo: 200, pontos: Math.round(200 * uni), detalhe: `desvio da altura ${mm(med.desvioAlturaMm)} mm; inclinação ${mm(med.inclinacaoMm100)} mm a cada 100 mm` },
    { nome: 'Continuidade', maximo: 150, pontos: Math.round(150 * continuidade), detalhe: med.falhas.length ? `${med.falhas.length} falha(s) na parede` : descontinuo > 0 ? `${mm(descontinuo)} mm de cordão partido` : 'parede contínua' },
    { nome: 'Interpasse', maximo: 150, pontos: Math.round(150 * termico), detalhe: `máximo de ${interpasseMax.toFixed(0)} °C no início de uma camada (limite da missão: ${m.interpasseMaxC} °C)` },
    { nome: 'Programa', maximo: 100, pontos: Math.round(100 * programa), detalhe: alarme ? `alarme: ${alarme.texto}` : `TCP ${mm(folgaFinal)} mm do topo nas últimas camadas${semCratera || movj ? '; arco fechado sem cratera ou MOVJ com arco' : ''}` },
    { nome: 'Material e tempo', maximo: 150, pontos: Math.round(150 * eficiencia), detalhe: `${Math.round(med.aproveitamento * 100)} % da parede sobra depois de usinar topo e pontas; ciclo de ${Math.round(c.tempo)} s` },
  ]
  const nota = itens.reduce((s, i) => s + i.pontos, 0)
  const aprovada = !alarme && c.estado === 'concluido' && med.alturaUtilMm >= m.alturaMinMm && med.larguraMinMm >= m.larguraMinMm &&
    med.comprimentoMm >= (m.xFim - m.xInicio) * 0.95 && !med.falhas.length && interpasseMax <= m.interpasseMaxC && med.desvioAlturaMm <= 1

  // Achados: onde, causa e como corrigir. Primeiro os do processo, depois os da missão.
  achados.push(...achadosDoProcesso(c, alturaPorCamada, med.falhas.length > 0))
  if (interpasseMax > m.interpasseMaxC) {
    const pior = passes.slice(1).reduce((a, b) => (b.interpasseC > a.interpasseC ? b : a))
    achados.push({ nome: 'Interpasse acima do limite', onde: `camada ${pior.numero}: ${pior.interpasseC.toFixed(0)} °C no ARCON`, causa: 'A parede guarda calor; quanto mais alta, mais devagar ela esfria pelo substrato.', correcao: 'Aumente o TIMER entre camadas (as de cima pedem mais tempo) ou diminua a energia (alimentação).', grave: false })
  }
  if (Math.abs(med.inclinacaoMm100) > 1) achados.push({ nome: 'Topo inclinado', onde: `um lado ${mm(Math.abs(med.inclinacaoMm100))} mm mais alto a cada 100 mm`, causa: 'Cada camada começa mais alta e fria e termina mais baixa e quente. No mesmo sentido, isso se soma.', correcao: 'Alterne o sentido entre camadas (ida e volta).', grave: false })
  if (med.comprimentoMm < (m.xFim - m.xInicio) * 0.95 && !alarme) achados.push({ nome: 'Parede curta ou fora do lugar', onde: `de X ${med.inicioMm} a ${med.fimMm} mm`, causa: `A missão pede a parede de X ${m.xInicio} a ${m.xFim} mm, em Y ${m.y}.`, correcao: 'Confira os pontos de início e fim na tabela de posições.', grave: true })
  if (!achados.length) achados.push({ nome: 'Nenhum problema encontrado', onde: '—', causa: 'A parede atende à missão.', correcao: 'Tente reduzir o tempo de ciclo sem passar do interpasse.', grave: false })

  return { medidas: med, itens, nota, aprovada, achados, camadas, interpasseMaxC: interpasseMax, tempoS: c.tempo, tempoArcoS: tempoArco, arameG: c.arameG, energiaKJ: c.energiaKJ, alturaPorCamadaMm: alturaPorCamada }
}

/**
 * Achados que não dependem da missão (servem também ao modo livre): alarme,
 * parada, distância da tocha que deriva camada a camada, escorrimento,
 * cordão partido, arco fora da distância, MOVJ com arco, arco cortado e
 * tocha inclinada.
 */
export function achadosDoProcesso(c: Controlador, alturaPorCamada: number, temFalhas = false): Achado[] {
  const passes = c.passes
  const achados: Achado[] = []
  const alarme = c.eventos.find((e) => e.tipo === 'alarme')
  const descontinuo = comDefeito(passes, 'descontinuo') + comDefeito(passes, 'humping')
  const instavel = comDefeito(passes, 'instavel') + comDefeito(passes, 'mergulho')
  const escorreu = comDefeito(passes, 'escorrimento')
  const movj = comDefeito(passes, 'movj')
  const semCratera = passes.filter((p) => p.fechamento === 'END' || p.fechamento === 'parada').length
  const ultimos = passes.slice(-3)
  const folgaFinal = ultimos.length ? ultimos.reduce((s, p) => s + p.folgaInicialMm, 0) / ultimos.length : 0
  if (alarme) achados.push({ nome: 'Programa interrompido por alarme', onde: `linha ${alarme.linha}`, causa: alarme.texto, correcao: 'Corrija a linha indicada e fabrique de novo. Rode antes sem deposição para conferir o caminho.', grave: true })
  if (c.estado === 'parado') achados.push({ nome: 'Fabricação parada pelo operador', onde: 'no meio do job', causa: 'Parar fecha o arco sem preencher a cratera e deixa a peça incompleta.', correcao: 'Use Pausar para observar; Parar só em emergência.', grave: true })
  if (ultimos.length >= 2) {
    const sugestao = Math.round(alturaPorCamada * 10) * 100
    if (folgaFinal > 2.5) achados.push({ nome: 'Tocha subindo mais que a parede', onde: `camadas ${ultimos[0].numero} a ${ultimos[ultimos.length - 1].numero}: TCP ${mm(folgaFinal)} mm acima do topo`, causa: `O incremento programado é maior que a altura que cada camada soma (cerca de ${mm(alturaPorCamada)} mm). O arco alonga, fica instável e pode apagar.`, correcao: `Meça a parede e use um incremento perto da altura real da camada, por exemplo ADD D000 ${sugestao} (${mm(sugestao / 1000)} mm).`, grave: folgaFinal > 6 })
    else if (folgaFinal < -1.5) achados.push({ nome: 'Parede subindo mais que a tocha', onde: `camadas ${ultimos[0].numero} a ${ultimos[ultimos.length - 1].numero}: TCP ${mm(-folgaFinal)} mm abaixo do topo`, causa: `O incremento programado é menor que a altura que cada camada soma (cerca de ${mm(alturaPorCamada)} mm). O arame mergulha na poça e o bocal pode bater.`, correcao: `Aumente o incremento para perto da altura real da camada, por exemplo ADD D000 ${sugestao}.`, grave: folgaFinal < -4 })
  }
  if (escorreu > 0) achados.push({ nome: 'Escorrimento lateral', onde: 'camadas superaquecidas', causa: 'A parede passou de 650 °C (número do modelo) e a poça escorreu pela lateral: parede mais larga e mais baixa.', correcao: 'Espere a parede esfriar entre camadas (TIMER).', grave: false })
  if (descontinuo > 0) achados.push({ nome: 'Cordão partido (humping)', onde: `${mm(descontinuo)} mm no total`, causa: 'Velocidade de soldagem alta para a alimentação: pouco metal por milímetro, e a poça se parte em gotas.', correcao: 'Baixe o V= do MOVL de solda ou aumente a alimentação no arquivo ASF.', grave: temFalhas })
  if (instavel > 0 && !achados.some((a) => a.nome.startsWith('Tocha') || a.nome.startsWith('Parede subindo'))) achados.push({ nome: 'Arco fora da distância de trabalho', onde: `${mm(instavel)} mm de cordão`, causa: 'O TCP passou longe do topo da peça (alto ou baixo demais).', correcao: 'Acerte a altura dos pontos e o incremento por camada.', grave: false })
  if (movj > 0) achados.push({ nome: 'MOVJ com arco aberto', onde: `${mm(movj)} mm de cordão`, causa: 'No MOVJ o caminho não é reto e a velocidade de soldagem não é controlada.', correcao: 'Solde só com MOVL.', grave: false })
  if (semCratera > 0) achados.push({ nome: 'Arco cortado sem cratera', onde: `${semCratera} passe(s)`, causa: 'O arco foi fechado por END ou por parada, sem ARCOF.', correcao: 'Feche o arco com ARCOF AEF#(1) antes de sair do cordão.', grave: false })
  const inclinada = passes.find((p) => p.inclinacaoMaxGraus > 15)
  if (inclinada) achados.push({ nome: 'Tocha inclinada', onde: `passe ${inclinada.numero}: ${inclinada.inclinacaoMaxGraus.toFixed(0)}° da vertical`, causa: 'Com a tocha muito inclinada o cordão fica assimétrico e a proteção piora.', correcao: 'Reensine os pontos com a tocha mais perto da vertical (Rx 180°, Ry 0°).', grave: false })
  return achados
}

/** Inspeção do modo livre: medidas da peça, sem missão, sem nota e sem aprovação. */
export interface InspecaoLivre {
  passes: number
  alturaMaxMm: number
  /** Retângulo (mm, base) que contém o metal depositado; null se nada foi depositado. */
  extensao: { xMin: number; xMax: number; yMin: number; yMax: number } | null
  areaOcupadaMm2: number
  /** Topo mais alto em cada X do substrato (perfil visto de lado). */
  perfil: { x: number; alturaMm: number }[]
  volumeMm3: number
  arameG: number
  energiaKJ: number
  tempoS: number
  tempoArcoS: number
  interpasseMaxC: number
  alturaPorCamadaMm: number
  achados: Achado[]
}

export function inspecionarLivre(c: Controlador): InspecaoLivre {
  const d = c.deposito
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, alturaMax = 0, celulas = 0
  const topoPorX = new Float32Array(d.nx)
  for (let j = 0; j < d.ny; j++) for (let i = 0; i < d.nx; i++) {
    const h = d.altura[j * d.nx + i]
    if (h <= 0.2) continue
    const x = d.x0 + (i + 0.5) * CELULA_MM, y = d.y0 + (j + 0.5) * CELULA_MM
    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y)
    alturaMax = Math.max(alturaMax, h)
    if (h > topoPorX[i]) topoPorX[i] = h
    celulas++
  }
  const perfil: { x: number; alturaMm: number }[] = []
  for (let i = 0; i < d.nx; i += 2) perfil.push({ x: d.x0 + (i + 0.5) * CELULA_MM, alturaMm: topoPorX[i] })
  const passes = c.passes.filter((p) => p.comprimentoMm > 5).length
  const alturaPorCamada = passes ? alturaMax / passes : 0
  const achados = achadosDoProcesso(c, alturaPorCamada)
  if (!celulas && c.estado === 'concluido') achados.push({ nome: 'Nada foi depositado', onde: '—', causa: 'O programa não abriu o arco sobre o substrato.', correcao: 'Use ARCON ASF#(1) com o TCP no topo da peça e ARCOF depois do movimento de soldar.', grave: false })
  return {
    passes, alturaMaxMm: alturaMax, extensao: celulas ? { xMin, xMax, yMin, yMax } : null, areaOcupadaMm2: celulas * CELULA_MM * CELULA_MM,
    perfil, volumeMm3: d.volumeTotal, arameG: c.arameG, energiaKJ: c.energiaKJ, tempoS: c.tempo,
    tempoArcoS: c.passes.reduce((s, p) => s + (p.tFim - p.tInicio), 0),
    interpasseMaxC: c.passes.slice(1).reduce((s, p) => Math.max(s, p.interpasseC), 0), alturaPorCamadaMm: alturaPorCamada, achados,
  }
}

