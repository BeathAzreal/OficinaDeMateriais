import { poroAgua } from './subaquatica'
/**
 * Análise do cordão do eletrodo (H82–H84): mede o depósito (depositoEletrodo.ts)
 * e calcula fusão pelo calor de cada passe, mordedura, sobreposição, poros,
 * crateras, inclusão de escória e respingos, no formato que o 3D já desenha.
 * Limites didáticos em LIMITES.
 */
import { sorteioFixo, type AnaliseDefeitos } from './defeitos'
import type { DepositoEletrodo } from './depositoEletrodo'
import { INFO_JUNTA } from './juntas'
import { aporteAlvoKJmm, materialEletrodo, type PecaEletrodo } from '../missoes/pecasEletrodo'
import { MATERIAIS } from './material'
import type { RegistroPasse } from './registroPasse'

export const LIMITES = {
  /** Fusão (aporte do passe ÷ aporte de referência da peça, H82). */
  fusaoFaltaAbaixo: 0.6,
  fusaoFracaAbaixo: 0.8,
  fusaoExcessoAcima: 1.7,
  /** Aporte acima disto (× referência) perfura a borda fina ou a raiz aberta. */
  perfuracaoAcima: 2.3,
  /**
   * H94 (v2.0): níveis antes do furo, no mesmo aporte relativo. Raiz aparente
   * (normal), metal pendurado no avesso, raiz afundada. Chapa sem abertura
   * aguenta 15 % a mais em tudo (inclusive o furo).
   */
  raizAparenteAcima: 1.4,
  penduradoAcima: 1.6,
  afundaAcima: 2.1,
  fatorChapaFechada: 1.15,
  /**
   * H97 (hipótese do jogo): a camada de um passe funde na de baixo se o calor da passagem
   * mais quente depois que ela começou (× referência) chegar a `entrePassesBase` mais `entrePassesPorMm`
   * por mm de vale que ela teve de encher (até 2 mm). Camadas finas (< 0,2 mm) não contam.
   */
  entrePassesBase: 0.8,
  entrePassesPorMm: 0.15,
  /** Fração da interface sem fundir (por espessura) que já é defeito. */
  entrePassesDefeito: 0.3,
  /** Mordedura máxima pelo modelo e a partir de quanto vira defeito (mm, H84). */
  mordeduraMaxMm: 0.8,
  mordeduraLimiteMm: 0.5,
  /** Arco médio (em diâmetros da alma) a partir do qual o revestimento já não protege bem a poça (H84). */
  arcoPorosoAcima: 1.5,
  /** Espaçamento das escamas no tempo (ms): eletrodo forma escamas mais espaçadas que o MIG (H56). */
  intervaloEscamaMs: 190,
  /** Fim de passe sem parar este tempo (ms) perto do ponto final deixa cratera (H55). */
  enchimentoCrateraMs: 300,
  /** Raio (mm) ao redor de uma abertura a frio que fica sujeito a poro de partida (H84). */
  raioPartidaMm: 3,
  /** Metal posto sobre escória fria (mm³ por fatia) que conta como inclusão (H65/H84). */
  inclusaoMinimaMm3: 0.15,
} as const

const lim01 = (v: number) => Math.max(0, Math.min(1, v))

/** O que a análise do eletrodo dá além do formato do 3D. */
export interface AnaliseEletrodo {
  defeitos: AnaliseDefeitos
  /** Fusão do passe mais frio, do mais quente e do primeiro em cada fatia (× referência; 0 = sem calor). */
  fusaoMin: Float32Array
  fusaoMax: Float32Array
  fusaoPrimeiro: Float32Array
  /** Metal sobre escória fria em cada fatia (indicador de inclusão). */
  inclusao: Float32Array
  /** Poro de partida em cada fatia (0…1), já somado à porosidade. */
  partida: Float32Array
  /** H97: fração (por espessura) das interfaces entre passes que não fundiu, em cada fatia. */
  entrePasses: Float32Array
  aporteAlvoKJmm: number
}

/** Corte do cordão numa posição x: largura, centro e altura do metal acima da chapa (mm). */
export interface SecaoDeposito { xMm: number; larguraMm: number; yCentroMm: number; alturaMm: number }

/** Mede o cordão numa posição x: a faixa contínua de metal que passa pela parte mais grossa. */
export function secaoDoDeposito(dep: DepositoEletrodo, xMm: number): SecaoDeposito {
  const passo = dep.dy, minimo = 0.1
  let yMax = 0, eMax = 0
  for (let y = -dep.alcanceY; y <= dep.alcanceY; y += passo) {
    const e = dep.espessura(xMm, y)
    if (e > eMax) { eMax = e; yMax = y }
  }
  if (eMax < minimo) return { xMm, larguraMm: 0, yCentroMm: 0, alturaMm: 0 }
  let e = yMax, d = yMax
  while (e - passo > -dep.alcanceY && dep.espessura(xMm, e - passo) > minimo) e -= passo
  while (d + passo < dep.alcanceY && dep.espessura(xMm, d + passo) > minimo) d += passo
  return { xMm, larguraMm: d - e + passo, yCentroMm: (e + d) / 2, alturaMm: eMax }
}

export function analisarEletrodo(peca: PecaEletrodo, dep: DepositoEletrodo, reg: RegistroPasse): AnaliseEletrodo {
  const n = reg.nPosicoes, passo = reg.passoMm
  const novo = () => new Float32Array(n)
  const a: AnaliseDefeitos = {
    n, passoMm: passo,
    caimento: novo(), rolos: novo(), gotejamento: novo(),
    mordeduraMenos: novo(), mordeduraMais: novo(), sobreposicaoMenos: novo(), sobreposicaoMais: novo(),
    cratera: novo(), porosidade: novo(), calor: novo(), escamaFase: novo(), escamaDir: new Int8Array(n),
    penetracaoMm: novo(), afundamento: novo(), furoMm: novo(), gotasAvesso: [], larguraAvessoMm: novo(), humping: novo(),
    gotas: [], respingos: [], poros: [], empenoGraus: 0,
    limiteMordeduraMm: LIMITES.mordeduraLimiteMm, ocorrencias: [],
  }
  const alvo = aporteAlvoKJmm(peca)
  const fusaoMin = novo(), fusaoMax = novo(), fusaoPrimeiro = novo(), inclusao = novo(), partida = novo()
  const filete = INFO_JUNTA[peca.junta].familia === 'filete'
  // H104: o eletrodo não tem como limpar a chapa no jogo; o revestimento segura metade do poro do zinco (ou do óxido).
  const material = MATERIAIS[materialEletrodo(peca)]
  const poroChapa = material.exigeLimpeza ? 0.5 * (material.limpeza?.porosidade ?? 0) : 0
  // Poro de partida (H84): abrir o arco a frio e seguir em frente deixa o começo poroso;
  // voltar por cima do ponto de abertura (técnica de recuar) refunde e elimina.
  for (const ab of reg.aberturas) {
    if (ab.aQuente) continue
    const i0 = reg.indiceEm(ab.xMm - LIMITES.raioPartidaMm), i1 = reg.indiceEm(ab.xMm + LIMITES.raioPartidaMm)
    const refundido = reg.ultimaPassagemMs[reg.indiceEm(ab.xMm)] > ab.tMs + 800
    if (refundido) continue
    for (let i = i0; i <= i1; i++) partida[i] = Math.max(partida[i], 0.6)
  }
  for (let i = 0; i < n; i++) {
    const s = secaoDoDeposito(dep, (i + 0.5) * passo)
    const p = reg.aportePorPasse(i)
    fusaoMin[i] = p.min / alvo
    fusaoMax[i] = p.max / alvo
    fusaoPrimeiro[i] = p.primeiro / alvo
    a.calor[i] = fusaoMax[i]
    inclusao[i] = reg.sobreEscoriaMm3[i]
    if (s.larguraMm < 1) continue
    const arco = reg.arcoMedio(i), instab = reg.instabilidadeMedia(i)
    const tempo = reg.tempoS[i]
    const vLocal = tempo > 0 ? passo / tempo : 4
    // Escamas (H56): pelo tempo de arco em que a ponta passou por cima.
    a.escamaFase[i] = (reg.tempoArcoNaPassagem[i] * 1000) / LIMITES.intervaloEscamaMs
    a.escamaDir[i] = reg.sentido[i] || 1
    // Mordedura (H84): arco longo e calor demais cavam a borda da chapa.
    const u = 0.5 * lim01((arco - 1.3) / 0.6) + 0.5 * lim01((fusaoMax[i] - LIMITES.fusaoExcessoAcima) / 0.6)
    const mm = LIMITES.mordeduraMaxMm * u
    a.mordeduraMenos[i] = mm
    a.mordeduraMais[i] = filete ? mm * 0.8 : mm
    // Sobreposição (H84): metal frio e lento rola sobre a chapa sem fundir.
    const frio = lim01((LIMITES.fusaoFracaAbaixo + 0.1 - fusaoMax[i]) / 0.4)
    const lento = lim01((2.2 - vLocal) / 1.2)
    const o = frio * (0.35 + 0.65 * lento)
    a.sobreposicaoMenos[i] = o
    a.sobreposicaoMais[i] = o
    // Porosidade (H84): arco longo tira a proteção do revestimento; partida a frio; zinco da chapa (H104).
    const poro = lim01(0.7 * lim01((arco - LIMITES.arcoPorosoAcima) / 0.6) + 0.3 * lim01(instab - 0.3) + partida[i] + poroChapa + (peca.subaquatica ? poroAgua(peca.subaquatica.profundidadeM, arco) : 0))
    a.porosidade[i] = poro
    const meia = s.larguraMm / 2
    if (poro > 0.25 && sorteioFixo(i, 160) < 0.45 * poro * passo * 2) {
      a.poros.push({
        xMm: s.xMm, nMm: s.yCentroMm + (sorteioFixo(i, 161) - 0.5) * 0.6 * s.larguraMm,
        wMm: 0.7 * Math.max(0.3, s.alturaMm) * sorteioFixo(i, 163), raioMm: 0.15 + 0.3 * sorteioFixo(i, 164) * poro,
        superficie: poro > 0.45 && sorteioFixo(i, 165) < 0.45 * poro,
      })
    }
    // Respingos presos (H69): o eletrodo sempre solta alguns; arco longo, muitos.
    const esperado = (0.03 + 0.5 * instab) * passo
    for (let k = 0; k < 2; k++) {
      if (sorteioFixo(i, 110 + k) >= esperado - k) continue
      const lado: -1 | 1 = sorteioFixo(i, 120 + k) < 0.5 ? -1 : 1
      const dist = 0.5 + 9 * sorteioFixo(i, 130 + k) ** 2
      a.respingos.push({ xMm: s.xMm + (sorteioFixo(i, 140 + k) - 0.5) * passo, nMm: s.yCentroMm + lado * (meia + dist), raioMm: 0.2 + 0.3 * sorteioFixo(i, 150 + k), lado, distMm: dist })
    }
  }
  // Crateras (H55): fim de passe sem encher, a menos que outro passe tenha coberto depois.
  for (const pa of reg.paradas) {
    if (pa.motivo === 'grudou') continue
    const c0 = lim01(1 - pa.permanenciaMs / LIMITES.enchimentoCrateraMs)
    if (c0 <= 0) continue
    const i = reg.indiceEm(pa.xMm)
    const s = secaoDoDeposito(dep, (i + 0.5) * passo)
    if (s.larguraMm < 1.5 || reg.ultimaPassagemMs[i] > pa.tMs + 1) continue
    const r = Math.ceil(3 / passo)
    for (let k = Math.max(0, i - r); k <= Math.min(n - 1, i + r); k++) {
      const x = (k + 0.5) * passo
      a.cratera[k] = Math.max(a.cratera[k], c0 * Math.exp(-(((x - pa.xMm) / 1.4) ** 2)))
    }
  }
  // H94: passar da chapa em níveis. Na raiz aberta vale o primeiro passe (os seguintes já têm metal por baixo);
  // na chapa fechada, o passe mais quente. No filete não há avesso livre.
  if (!filete) {
    const raizAberta = peca.aberturaMm > 0
    const k = raizAberta ? 1 : LIMITES.fatorChapaFechada
    for (let i = 0; i < n; i++) {
      const f = (raizAberta ? fusaoPrimeiro[i] : fusaoMax[i]) / k
      if (f <= 0) continue
      const raiz = 0.3 * lim01((f - LIMITES.raizAparenteAcima) / (LIMITES.penduradoAcima - LIMITES.raizAparenteAcima))
      const excesso = lim01((f - LIMITES.penduradoAcima) / (LIMITES.perfuracaoAcima - LIMITES.penduradoAcima))
      a.penetracaoMm[i] = raiz + 1.6 * excesso
      a.afundamento[i] = lim01((f - LIMITES.afundaAcima) / (LIMITES.perfuracaoAcima - LIMITES.afundaAcima))
      if (f > LIMITES.perfuracaoAcima) a.furoMm[i] = Math.min(6, 1 + 4 * (f - LIMITES.perfuracaoAcima))
      if (excesso > 0.3 && sorteioFixo(i, 170) < 0.4 * excesso * passo) {
        a.gotasAvesso.push({ xMm: (i + 0.5) * passo, nMm: (sorteioFixo(i, 171) - 0.5) * 2, raioMm: 0.6 + excesso * (0.6 + 0.6 * sorteioFixo(i, 172)) })
      }
    }
  }
  // Marcas de abertura fora da junta e de eletrodo grudado: um pingo de metal na chapa.
  const fora = (ab: { xMm: number; yMm: number }) => Math.abs(ab.yMm) > 6 || ab.xMm < peca.inicioMm - 4 || ab.xMm > peca.fimMm + 4
  for (const ab of reg.aberturas) if (!ab.aQuente && fora(ab)) a.respingos.push({ xMm: ab.xMm, nMm: ab.yMm, raioMm: 0.9 })
  for (const g of reg.grudadas) a.respingos.push({ xMm: g.xMm, nMm: g.yMm, raioMm: 1.1 })
  // H97: fusão entre passes, camada por camada (o corte mostra o mesmo resultado).
  const entrePasses = novo(), pesoInterface = novo()
  for (const [k, lista] of dep.camadas) {
    const i = reg.indiceEm(dep.x(k % dep.nx))
    for (let c = 1; c < lista.length; c++) {
      const camada = lista[c]
      if (camada.espessuraMm < 0.2) { camada.fundiu = true; continue }
      // O calor que conta é o da passagem mais quente depois que a camada começou (ela pode refundir a interface).
      const calor = reg.calorDepoisDe(i, camada.tInicioMs) / alvo
      camada.fundiu = calor >= LIMITES.entrePassesBase + LIMITES.entrePassesPorMm * Math.min(2, camada.vale)
      pesoInterface[i] += camada.espessuraMm
      if (!camada.fundiu) entrePasses[i] += camada.espessuraMm
    }
  }
  for (let i = 0; i < n; i++) entrePasses[i] = pesoInterface[i] > 0 ? entrePasses[i] / pesoInterface[i] : 0
  return { defeitos: a, fusaoMin, fusaoMax, fusaoPrimeiro, inclusao, partida, entrePasses, aporteAlvoKJmm: alvo }
}
