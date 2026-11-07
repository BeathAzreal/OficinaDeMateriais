/**
 * Lista de defeitos do eletrodo (H85): lugar (mm), causa provável e como corrigir.
 * Não mexe na nota de 0 a 1000 (eletrodo.ts). Textos em TEXTO.
 */
import { LIMITES, secaoDoDeposito, type AnaliseEletrodo } from '../modelo/analiseEletrodo'
import type { DepositoEletrodo } from '../modelo/depositoEletrodo'
import type { PecaEletrodo } from '../missoes/pecasEletrodo'
import type { RegistroPasse } from '../modelo/registroPasse'

export type TipoDefeitoEletrodo =
  | 'falta-de-fusao' | 'falta-de-fusao-entre-passes' | 'fusao-fraca' | 'excesso-de-calor' | 'penetracao-excessiva' | 'raiz-afundada' | 'perfuracao'
  | 'mordedura' | 'sobreposicao' | 'porosidade' | 'cratera' | 'inclusao-de-escoria'
  | 'respingos' | 'abertura-fora' | 'grudou'

export const TEXTO: Record<TipoDefeitoEletrodo, { nome: string; causa: string; corrigir: string }> = {
  'falta-de-fusao': { nome: 'Falta de fusão (colagem)', causa: 'Calor de menos para a junta: avanço rápido ou corrente baixa. O metal "colou" sem fundir a chapa.', corrigir: 'Avance mais devagar ou suba a corrente para a faixa sugerida.' },
  'falta-de-fusao-entre-passes': { nome: 'Falta de fusão entre passes', causa: 'O passe novo não teve calor para fundir o passe de baixo: o metal deitou por cima, sem ligar. Vale fundo entre passes pede ainda mais calor.', corrigir: 'Passe seguinte mais lento ou com mais corrente, e passes mais próximos para não deixar vale fundo.' },
  'fusao-fraca': { nome: 'Fusão fraca', causa: 'Calor no limite de baixo: o cordão fica alto e mal ligado às bordas.', corrigir: 'Reduza um pouco a velocidade de avanço.' },
  'excesso-de-calor': { nome: 'Calor em excesso', causa: 'Avanço muito lento ou corrente alta: cordão largo, mordedura e deformação.', corrigir: 'Avance mais rápido ou baixe a corrente.' },
  'penetracao-excessiva': { nome: 'Penetração excessiva', causa: 'Calor demais na raiz: o metal atravessou e ficou pendurado no avesso.', corrigir: 'Avance um pouco mais rápido ou baixe a corrente.' },
  'raiz-afundada': { nome: 'Raiz afundada', causa: 'A poça ficou pesada e caiu pela raiz: a face do cordão afundou.', corrigir: 'Avance mais rápido, encurte o arco e baixe a corrente.' },
  'perfuracao': { nome: 'Furo (a chapa varou)', causa: 'Calor demais: o metal atravessou a junta e abriu um buraco.', corrigir: 'Avance mais rápido, encurte o arco e baixe a corrente.' },
  'mordedura': { nome: 'Mordedura', causa: 'Arco longo ou calor demais cavam a borda da chapa ao lado do cordão.', corrigir: 'Mantenha o arco perto do diâmetro da alma e não demore no mesmo ponto.' },
  'sobreposicao': { nome: 'Sobreposição', causa: 'Metal frio e lento rolou sobre a chapa sem fundir a borda.', corrigir: 'Aumente o calor do passe: mais corrente ou avanço constante, sem parar.' },
  'porosidade': { nome: 'Porosidade', causa: 'Arco longo deixa ar entrar na poça; abrir o arco a frio e seguir em frente também deixa poros no começo.', corrigir: 'Arco curto. Na abertura, abra um pouco à frente e volte por cima do início.' },
  'cratera': { nome: 'Cratera não preenchida', causa: 'O arco apagou de uma vez no fim do passe, deixando um buraco.', corrigir: 'No fim, pare a ponta um instante sobre a poça antes de afastar.' },
  'inclusao-de-escoria': { nome: 'Inclusão de escória (prevista)', causa: 'Soldou por cima de escória fria que não foi limpa.', corrigir: 'Entre um passe e outro, quebre a escória com o martelinho e escove.' },
  'respingos': { nome: 'Respingos em excesso', causa: 'Arco longo espalha gotas de metal ao redor do cordão.', corrigir: 'Encurte o arco.' },
  'abertura-fora': { nome: 'Abertura de arco fora da junta', causa: 'O arco foi aberto na chapa, longe de onde o cordão passa: deixa marca e endurece o local.', corrigir: 'Abra o arco dentro da junta, à frente do início, e volte.' },
  'grudou': { nome: 'Eletrodo grudado', causa: 'A ponta foi empurrada contra a poça ou a corrente estava baixa.', corrigir: 'Não force a ponta para baixo depois de abrir; confira a corrente.' },
}

/** Defeitos que, numa inspeção visual de verdade, pediriam reparo do trecho. */
const GRAVES = new Set<TipoDefeitoEletrodo>(['falta-de-fusao', 'falta-de-fusao-entre-passes', 'raiz-afundada', 'perfuracao', 'inclusao-de-escoria', 'sobreposicao'])

export interface DefeitoEncontrado {
  tipo: TipoDefeitoEletrodo
  nome: string
  inicioMm: number
  fimMm: number
  /** Quantas vezes (poros, aberturas, grudadas) ou quantos trechos. */
  quantidade: number
  /** Em quantos trechos separados apareceu (o defeito ocupa de inicioMm a fimMm no total). */
  trechos: number
  causa: string
  corrigir: string
  /** Pediria reparo do trecho (aparece primeiro na lista). */
  grave: boolean
}

export interface InspecaoEletrodo {
  defeitos: DefeitoEncontrado[]
  /** Calor médio dos passes no trecho e o de referência da peça (kJ/mm). */
  aporteMedioKJmm: number
  aporteAlvoKJmm: number
  /** Passes que cobriram o meio do trecho (mediana). */
  passes: number
}

/** Lista os defeitos do trecho exigido, do mais grave para o mais leve e da esquerda para a direita. */
export function inspecionarDefeitos(peca: PecaEletrodo, dep: DepositoEletrodo, reg: RegistroPasse, analise: AnaliseEletrodo): InspecaoEletrodo {
  const passo = reg.passoMm
  const i0 = reg.indiceEm(peca.inicioMm), i1 = reg.indiceEm(peca.fimMm)
  const a = analise.defeitos
  const defeitos: DefeitoEncontrado[] = []
  const add = (tipo: TipoDefeitoEletrodo, inicioMm: number, fimMm: number, quantidade = 1) =>
    defeitos.push({ tipo, ...TEXTO[tipo], inicioMm, fimMm, quantidade, trechos: 1, grave: GRAVES.has(tipo) })
  /** Junta trechos contínuos de fatias que cumprem `cond` (com tolerância de 1 mm de buraco). */
  const trechos = (cond: (i: number) => boolean, minimoMm = 1) => {
    const lista: [number, number][] = []
    let ini = -1, ultimo = -1
    for (let i = i0; i <= i1 + 1; i++) {
      const v = i <= i1 && cond(i)
      if (v) { if (ini < 0) ini = i; ultimo = i }
      else if (ini >= 0 && (i - ultimo) * passo > 1) {
        if ((ultimo - ini + 1) * passo >= minimoMm) lista.push([ini * passo, (ultimo + 1) * passo])
        ini = -1
      }
    }
    if (ini >= 0 && (ultimo - ini + 1) * passo >= minimoMm) lista.push([ini * passo, (ultimo + 1) * passo])
    return lista
  }
  const largura = Array.from({ length: reg.nPosicoes }, (_, i) => i >= i0 && i <= i1 ? secaoDoDeposito(dep, (i + 0.5) * passo).larguraMm : 0)
  const tem = (i: number) => largura[i] >= 2

  // Fusão pelo calor de cada passe (H82): vale o passe mais quente da fatia; um retoque rápido por cima não desfaz a fusão.
  let somaAporte = 0, nAporte = 0
  const passes: number[] = []
  for (let i = i0; i <= i1; i++) {
    if (!tem(i)) continue
    const p = reg.aportePorPasse(i)
    somaAporte += p.max; nAporte++
    passes.push(p.passes)
  }
  for (const [x, y] of trechos((i) => tem(i) && analise.fusaoMax[i] < LIMITES.fusaoFaltaAbaixo, 2)) add('falta-de-fusao', x, y)
  for (const [x, y] of trechos((i) => analise.entrePasses[i] > LIMITES.entrePassesDefeito, 2)) add('falta-de-fusao-entre-passes', x, y)
  for (const [x, y] of trechos((i) => tem(i) && analise.fusaoMax[i] >= LIMITES.fusaoFaltaAbaixo && analise.fusaoMax[i] < LIMITES.fusaoFracaAbaixo, 3)) add('fusao-fraca', x, y)
  // H94: passar da chapa em níveis (a análise já escolheu o passe que conta: o primeiro na raiz aberta).
  const fura = (i: number) => a.furoMm[i] > 0
  const pendura = (i: number) => a.penetracaoMm[i] > 1
  const afunda = (i: number) => a.afundamento[i] > 0.3 && !fura(i)
  for (const [x, y] of trechos(fura, 1)) add('perfuracao', x, y)
  for (const [x, y] of trechos(afunda, 1)) add('raiz-afundada', x, y)
  for (const [x, y] of trechos((i) => pendura(i) && !fura(i), 1)) add('penetracao-excessiva', x, y)
  for (const [x, y] of trechos((i) => tem(i) && analise.fusaoMax[i] > LIMITES.fusaoExcessoAcima && !fura(i) && !pendura(i), 5)) add('excesso-de-calor', x, y)

  // Defeitos de superfície (H84).
  for (const [x, y] of trechos((i) => Math.max(a.mordeduraMenos[i], a.mordeduraMais[i]) > LIMITES.mordeduraLimiteMm, 1)) add('mordedura', x, y)
  for (const [x, y] of trechos((i) => tem(i) && Math.max(a.sobreposicaoMenos[i], a.sobreposicaoMais[i]) > 0.35, 2)) add('sobreposicao', x, y)
  const poros = a.poros.filter((p) => p.superficie && p.xMm >= peca.inicioMm && p.xMm <= peca.fimMm)
  if (poros.length) {
    const xs = poros.map((p) => p.xMm)
    add('porosidade', Math.min(...xs), Math.max(...xs), poros.length)
  }
  for (const [x, y] of trechos((i) => a.cratera[i] > 0.3, 0.5)) add('cratera', x, y)
  for (const [x, y] of trechos((i) => analise.inclusao[i] > LIMITES.inclusaoMinimaMm3, 0.5)) add('inclusao-de-escoria', x, y)
  const cobertas = largura.filter((l) => l >= 2).length
  const respingos = a.respingos.filter((r) => r.raioMm < 0.8 && r.xMm >= peca.inicioMm - 5 && r.xMm <= peca.fimMm + 5).length
  if (cobertas && respingos / (cobertas * passo) * 10 > 2) add('respingos', peca.inicioMm, peca.fimMm, respingos)
  for (const ab of reg.aberturas) {
    if (!ab.aQuente && (Math.abs(ab.yMm) > 6 || ab.xMm < peca.inicioMm - 4 || ab.xMm > peca.fimMm + 4)) add('abertura-fora', ab.xMm, ab.xMm)
  }
  if (reg.grudadas.length) add('grudou', Math.min(...reg.grudadas.map((g) => g.xMm)), Math.max(...reg.grudadas.map((g) => g.xMm)), reg.grudadas.length)

  // Um defeito por tipo: trechos repetidos viram um só, do primeiro ao último.
  const porTipo = new Map<TipoDefeitoEletrodo, DefeitoEncontrado>()
  for (const d of defeitos) {
    const j = porTipo.get(d.tipo)
    if (!j) { porTipo.set(d.tipo, { ...d }); continue }
    j.inicioMm = Math.min(j.inicioMm, d.inicioMm); j.fimMm = Math.max(j.fimMm, d.fimMm)
    j.quantidade += d.quantidade; j.trechos++
  }
  defeitos.length = 0
  defeitos.push(...porTipo.values())
  defeitos.sort((x, y) => Number(y.grave) - Number(x.grave) || x.inicioMm - y.inicioMm)
  return {
    defeitos,
    aporteMedioKJmm: nAporte ? somaAporte / nAporte : 0,
    aporteAlvoKJmm: analise.aporteAlvoKJmm,
    passes: passes.length ? passes.sort((x, y) => x - y)[Math.floor(passes.length / 2)] : 0,
  }
}
