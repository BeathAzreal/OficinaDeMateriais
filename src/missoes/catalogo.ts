import { ARAMES, GASES, MATERIAIS, gasCompativel, gasesDoMaterial, type GasId, type MaterialId } from '../modelo/material'
import { DBCP, PECA } from '../modelo/parametros'
import type { FormatoJunta } from '../modelo/junta'
import { GIRO_INICIAL_TUBO_GRAUS, INFO_JUNTA, TIPOS_JUNTA, type TipoJunta } from '../modelo/juntas'
import type { ContextoProcesso, Movimento, Tecnica } from '../modelo/processo'

/*
 * Catálogo de missões (docs/MISSOES.md). Situações e requisitos FICTÍCIOS,
 * criados como objetivos didáticos — não são requisitos de norma.
 */

export type Dificuldade = 'aprendiz' | 'profissional'

export const DIFICULDADES: Dificuldade[] = ['aprendiz', 'profissional']
/**
 * H88: os dois modos de pontuação, escolhidos antes de soldar. Os ids
 * ('aprendiz', 'profissional') ficam os mesmos para não mudar recordes salvos.
 */
export const NOME_DIFICULDADE: Record<Dificuldade, string> = { aprendiz: 'Fácil', profissional: 'Difícil' }

export interface Missao {
  id: string
  /** Muda se a missão mudar; entra na chave dos rankings. */
  versao: number
  titulo: string
  setor: 'Indústria' | 'Comércio' | 'Sociedade'
  contexto: string
  finalidade: string
  material: MaterialId
  condicaoFornecimento: string
  /** `formato` só existe em dados antigos (H41): a junta agora é sempre reta. */
  geometria: { comprimentoMm: number; larguraChapaMm: number; espessuraMm: number; aberturaMm: number; junta: TipoJunta; formato?: FormatoJunta; tubo?: { diametroMm: number } }
  /** Como a peça chega para soldar e se pode ser tombada/girada (H47). */
  montagem: { rolagemGraus: number; giroGraus: number; fixa: boolean }
  processo: 'MIG/MAG'
  junta: string
  tipoSolda: string
  posicao: string
  /** Trecho que precisa ser soldado (mm ao longo da junta). */
  trecho: { inicioMm: number; fimMm: number }
  /** Medidas do desenho (objetivos didáticos). No filete, a largura é a da face do cordão. */
  requisitos: { larguraMinMm: number; larguraMaxMm: number; reforcoMaxMm: number; alinhamentoMm: number }
  consumiveis: { diametrosMm: number[]; gases: GasId[] }
  equipamentos: string[]
  tentativas: Record<Dificuldade, number>
  integridadeMinima: Record<Dificuldade, number>
  /** Aberturas previstas pelo roteiro; ausente = um passe. */
  aberturasPlanejadas?: number
  desafio: string
}

/** Missões listadas mas NÃO jogáveis: o modelo ainda não cobre o que pedem. */
export interface MissaoPlanejada {
  id: string
  titulo: string
  contexto: string
  motivo: string
}

/** Diâmetros de arame da máquina: todos ficam à escolha em todas as missões. */
export const DIAMETROS_ARAME_MM = [0.8, 1, 1.2]

const GEOMETRIA_BASE = { comprimentoMm: PECA.comprimentoMm, larguraChapaMm: PECA.larguraChapaMm }
const EQUIPAMENTOS = [
  'Fonte de tensão constante (tensão de 14 a 30 V, alimentação de 1 a 15 m/min)',
  'Tocha MIG/MAG com bico e regulador de gás',
  'Polaridade fixa: corrente contínua, eletrodo positivo (CC+)',
]
const COMUM = { processo: 'MIG/MAG' as const, equipamentos: EQUIPAMENTOS }
/** Peça sobre um posicionador: pode ser tombada e girada com o arco fechado. */
const LIVRE = (junta: TipoJunta) => ({ rolagemGraus: INFO_JUNTA[junta].rolagemInicialGraus, giroGraus: 0, fixa: false })

export const MISSOES: Missao[] = [
  {
    id: 'suporte-carbono',
    versao: 1,
    titulo: 'Suporte de prateleira',
    setor: 'Indústria',
    contexto:
      'Uma serralheria fabrica suportes para as prateleiras do almoxarifado de uma escola. ' +
      'Você une as duas chapas que formam a base de um suporte.',
    finalidade: 'Base de suporte que sustenta caixas de material escolar.',
    material: 'aco-carbono',
    condicaoFornecimento: 'Chapa laminada, cortada em guilhotina, superfície limpa e sem óleo.',
    geometria: { ...GEOMETRIA_BASE, espessuraMm: 3, aberturaMm: 1, junta: 'topo' },
    montagem: LIVRE('topo'),
    ...COMUM,
    junta: 'Junta de topo (bordas frente a frente, com abertura)',
    tipoSolda: 'Solda em chanfro reto (bordas retas), por um lado',
    posicao: 'Plana (a peça está num posicionador)',
    trecho: { inicioMm: 10, fimMm: 140 },
    requisitos: { larguraMinMm: 6, larguraMaxMm: 9, reforcoMaxMm: 3, alinhamentoMm: 1.5 },
    consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2', 'co2'] },
    tentativas: { aprendiz: 5, profissional: 3 },
    integridadeMinima: { aprendiz: 0.85, profissional: 0.95 },
    desafio: 'Missão de referência: equilibrar o tamanho do cordão e a fusão.',
  },
  {
    id: 'inox-equipamento',
    versao: 3,
    titulo: 'Tampo de mesa de preparo',
    setor: 'Comércio',
    contexto:
      'Uma empresa de equipamentos para cozinhas prepara a mesa de uma cozinha comunitária. ' +
      'Você une as chapas de inox do tampo.',
    finalidade: 'Tampo plano de mesa de preparo de alimentos.',
    material: 'inox-austenitico',
    condicaoFornecimento: 'Chapa de inox austenítico laminada a frio, com película protetora retirada.',
    geometria: { ...GEOMETRIA_BASE, espessuraMm: 2, aberturaMm: 0.5, junta: 'topo' },
    montagem: LIVRE('topo'),
    ...COMUM,
    junta: 'Junta de topo (bordas frente a frente, com abertura pequena)',
    tipoSolda: 'Solda em chanfro reto, por um lado',
    posicao: 'Plana (a peça está num posicionador)',
    trecho: { inicioMm: 15, fimMm: 135 },
    requisitos: { larguraMinMm: 5, larguraMaxMm: 7.5, reforcoMaxMm: 2.5, alinhamentoMm: 1.2 },
    consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2-baixo'] },
    tentativas: { aprendiz: 5, profissional: 3 },
    integridadeMinima: { aprendiz: 0.85, profissional: 0.95 },
    desafio: 'Fundir sem colocar calor demais: o inox deforma mais que o aço carbono.',
  },
  {
    id: 'mobiliario-chapa-fina',
    versao: 3,
    titulo: 'Assento de banco',
    setor: 'Sociedade',
    contexto:
      'Uma oficina monta bancos metálicos para a biblioteca pública do bairro. ' +
      'O assento é uma chapa fina sobreposta à travessa: você solda a borda de cima.',
    finalidade: 'Assento de banco de leitura, sem cantos vivos nem furos.',
    material: 'aco-carbono',
    condicaoFornecimento: 'Chapa fina laminada a frio, superfície limpa.',
    geometria: { ...GEOMETRIA_BASE, espessuraMm: 1.5, aberturaMm: 0, junta: 'sobreposta' },
    montagem: LIVRE('sobreposta'),
    ...COMUM,
    junta: 'Junta sobreposta (uma chapa por cima da outra)',
    tipoSolda: 'Solda de ângulo (filete) na borda da chapa de cima',
    posicao: 'Chega na horizontal (2F); o posicionador permite tombar para a plana',
    trecho: { inicioMm: 20, fimMm: 130 },
    requisitos: { larguraMinMm: 4.5, larguraMaxMm: 6.5, reforcoMaxMm: 1.5, alinhamentoMm: 1.2 },
    consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2'] },
    tentativas: { aprendiz: 5, profissional: 3 },
    integridadeMinima: { aprendiz: 0.85, profissional: 0.95 },
    desafio: 'Chapa fina: ande rápido para não furar a borda de cima, sem deixar de fundir a de baixo.',
  },
  {
    id: 'aluminio-componente',
    versao: 3,
    titulo: 'Suporte de painel solar',
    setor: 'Sociedade',
    contexto:
      'Uma oficina fabrica suportes leves para os painéis solares de um posto de saúde. ' +
      'Você solda a nervura em pé sobre a base de alumínio.',
    finalidade: 'Peça leve de suporte, exposta ao tempo.',
    material: 'aluminio',
    condicaoFornecimento: 'Chapa de liga de alumínio com a camada natural de óxido na superfície.',
    geometria: { ...GEOMETRIA_BASE, espessuraMm: 3, aberturaMm: 0, junta: 't' },
    montagem: LIVRE('t'),
    ...COMUM,
    junta: 'Junta em T (nervura em pé sobre a base)',
    tipoSolda: 'Solda de ângulo (filete), por um lado',
    posicao: 'Chega na horizontal (2F); o posicionador permite tombar para a plana',
    trecho: { inicioMm: 10, fimMm: 140 },
    requisitos: { larguraMinMm: 6, larguraMaxMm: 9, reforcoMaxMm: 1.8, alinhamentoMm: 1.5 },
    consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar'] },
    tentativas: { aprendiz: 6, profissional: 4 },
    integridadeMinima: { aprendiz: 0.85, profissional: 0.95 },
    desafio: 'Pede muito calor no começo; a peça esquenta e é preciso acelerar. O óxido deve ser removido.',
  },
  {
    id: 'estrutura-leve',
    aberturasPlanejadas: 2,
    versao: 1,
    titulo: 'Estrutura metálica leve',
    setor: 'Sociedade',
    contexto:
      'Uma serralheria monta o quadro da cobertura de um ponto de ônibus. ' +
      'Você emenda duas chapas grossas da viga, chanfradas em V.',
    finalidade: 'Emenda de viga que segura a cobertura.',
    material: 'aco-carbono',
    condicaoFornecimento: 'Chapa grossa com as bordas chanfradas a 30° (V de 60°) e face de raiz de 1 mm.',
    geometria: { ...GEOMETRIA_BASE, espessuraMm: 6, aberturaMm: 1, junta: 'v' },
    montagem: LIVRE('v'),
    ...COMUM,
    junta: 'Junta de topo com chanfro em V (60°)',
    tipoSolda: 'Solda em chanfro em V, por um lado; o V precisa ficar cheio',
    posicao: 'Plana (a peça está num posicionador)',
    trecho: { inicioMm: 10, fimMm: 140 },
    requisitos: { larguraMinMm: 7.5, larguraMaxMm: 10, reforcoMaxMm: 3, alinhamentoMm: 1.5 },
    consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2', 'co2'] },
    tentativas: { aprendiz: 6, profissional: 4 },
    integridadeMinima: { aprendiz: 0.8, profissional: 0.9 },
    desafio: 'Encher o V: um passe devagar ou dois passes (raiz e acabamento). Rápido demais deixa o chanfro aberto.',
  },
  {
    id: 'corrimao-inox',
    versao: 1,
    titulo: 'Corrimão da rampa',
    setor: 'Sociedade',
    contexto:
      'A rampa de acesso do posto de saúde ganha um corrimão de inox. O montante já está chumbado no chão: ' +
      'você solda a junta de canto do perfil em pé, sem poder girar a peça.',
    finalidade: 'Corrimão de acessibilidade, liso ao toque e sem furos.',
    material: 'inox-austenitico',
    condicaoFornecimento: 'Perfil de inox montado no lugar, limpo com escova de inox.',
    geometria: { ...GEOMETRIA_BASE, espessuraMm: 2, aberturaMm: 0, junta: 'canto' },
    // Chumbado no chão: junta na vertical, sem posicionador.
    montagem: { rolagemGraus: 90, giroGraus: 90, fixa: true },
    ...COMUM,
    junta: 'Junta de canto externa (L), já presa na estrutura',
    tipoSolda: 'Solda de ângulo por fora do canto',
    posicao: 'Vertical (3F), peça fixa: escolha subir ou descer',
    trecho: { inicioMm: 15, fimMm: 135 },
    requisitos: { larguraMinMm: 4.5, larguraMaxMm: 7, reforcoMaxMm: 2, alinhamentoMm: 1.2 },
    consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2-baixo'] },
    tentativas: { aprendiz: 6, profissional: 4 },
    integridadeMinima: { aprendiz: 0.8, profissional: 0.9 },
    desafio: 'Na vertical a poça escorre: subindo funde mais; descendo funde pouco. A peça não gira.',
  },
  {
    id: 'tubulacao-horta',
    versao: 1,
    titulo: 'Tubulação da horta comunitária',
    setor: 'Sociedade',
    contexto:
      'A irrigação da horta comunitária do bairro usa tubos de aço. ' +
      'Você emenda dois tubos de topo, soldando a volta inteira da junta.',
    finalidade: 'Emenda de tubo de irrigação, sem vazamento.',
    material: 'aco-carbono',
    condicaoFornecimento: 'Tubo de aço carbono de 1½" (no jogo, Ø 47,7 mm), parede de 3 mm, cortado reto e com as pontas limpas.',
    // H103: a junta de 150 mm é a volta do tubo desenrolada; o tubo chega com a emenda da volta no alto.
    geometria: { ...GEOMETRIA_BASE, espessuraMm: 3, aberturaMm: 1, junta: 'topo', tubo: { diametroMm: PECA.comprimentoMm / Math.PI } },
    montagem: { rolagemGraus: 0, giroGraus: GIRO_INICIAL_TUBO_GRAUS, fixa: false },
    ...COMUM,
    junta: 'Emenda de topo de dois tubos (bordas frente a frente, com abertura)',
    tipoSolda: 'Solda circunferencial em chanfro reto, por fora',
    posicao: 'Tubo deitado num posicionador (1G): gire o tubo para soldar sempre perto do alto',
    trecho: { inicioMm: 2, fimMm: 148 },
    requisitos: { larguraMinMm: 6, larguraMaxMm: 9, reforcoMaxMm: 3, alinhamentoMm: 1.5 },
    consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2', 'co2'] },
    tentativas: { aprendiz: 5, profissional: 3 },
    integridadeMinima: { aprendiz: 0.85, profissional: 0.95 },
    // Oito trechos de ~45°: entre um e outro o tubo gira com o arco fechado.
    aberturasPlanejadas: 8,
    desafio: 'Dar a volta inteira no tubo: solde um trecho perto do alto, feche o arco e gire o tubo (⟲ ⟳). Sem girar, o metal escorre no lado e pinga embaixo.',
  },
]

export const PLANEJADAS: MissaoPlanejada[] = [
  {
    id: 'tabela-basquete',
    titulo: 'Pé da tabela de basquete',
    contexto: 'Reparo do pé da tabela de basquete da praça, com chapa grossa e eletrodo revestido.',
    motivo: 'Pede eletrodo revestido; só o MIG/MAG tem modelo.',
  },
]

export function buscarMissao(id: string): Missao | undefined {
  return MISSOES.find((m) => m.id === id)
}

/** Requisitos ajustados à dificuldade (docs/MISSOES.md). No Fácil, 1 mm de folga na largura e no alinhamento (H88). */
export function requisitosEfetivos(m: Missao, d: Dificuldade) {
  const folga = d === 'aprendiz' ? 1 : 0
  return {
    larguraMinMm: m.requisitos.larguraMinMm - folga,
    larguraMaxMm: m.requisitos.larguraMaxMm + folga,
    reforcoMaxMm: m.requisitos.reforcoMaxMm,
    alinhamentoMm: m.requisitos.alinhamentoMm + folga,
    integridadeMinima: m.integridadeMinima[d],
    tentativas: m.tentativas[d],
  }
}

/** Escolhas feitas na preparação. */
export interface Preparo {
  diametroArameMm: number
  gas: GasId
  oxidoRemovido: boolean
  /** H38. Ausente = neutra. */
  tecnica?: Tecnica
  /** H39. Ausente = linha reta. */
  movimento?: Movimento
  /** H48: distância bico de contato–peça (mm). Ausente = 15 mm (referência). */
  dbcpMm?: number
}

export function preparoPadrao(m: Missao): Preparo {
  return { diametroArameMm: m.consumiveis.diametrosMm[0], gas: m.consumiveis.gases[0], oxidoRemovido: false, tecnica: 'neutra', movimento: 'reto', dbcpMm: DBCP.referenciaMm }
}

/** Erros se a combinação não for permitida pela missão (nunca deve passar para a simulação). */
export function validarPreparo(m: Missao, p: Preparo): string[] {
  const erros: string[] = []
  if (!m.consumiveis.diametrosMm.includes(p.diametroArameMm)) erros.push('Diâmetro de arame não previsto na missão.')
  if (!m.consumiveis.gases.includes(p.gas)) erros.push('Gás não previsto na missão.')
  if (!gasCompativel(p.gas, m.material)) erros.push('Gás incompatível com o material.')
  if (p.dbcpMm !== undefined && !DBCP.opcoesMm.includes(p.dbcpMm)) erros.push('Distância bico–peça fora das opções da bancada.')
  return erros
}

export function contextoDaMissao(m: Missao, p: Preparo): ContextoProcesso {
  const erros = validarPreparo(m, p)
  if (erros.length) throw new Error(erros.join(' '))
  return {
    material: m.material,
    espessuraMm: m.geometria.espessuraMm,
    aberturaMm: m.geometria.aberturaMm,
    diametroArameMm: p.diametroArameMm,
    gas: p.gas,
    // Só o alumínio (óxido) e o galvanizado (zinco) exigem limpeza; nos outros a superfície já vem limpa.
    oxidoRemovido: MATERIAIS[m.material].exigeLimpeza ? p.oxidoRemovido : true,
    tecnica: p.tecnica ?? 'neutra',
    // H39: o movimento da tocha saiu da bancada; o modelo segue aceitando dados antigos.
    movimento: 'reto',
    junta: m.geometria.junta,
    posicaoInicial: { rolagemGraus: m.montagem.rolagemGraus, giroGraus: m.montagem.giroGraus },
    posicaoFixa: m.montagem.fixa,
    dbcpMm: p.dbcpMm ?? DBCP.referenciaMm,
    ...(m.geometria.tubo ? { tubo: { diametroMm: m.geometria.tubo.diametroMm } } : {}),
  }
}

export function descreverJunta(m: Missao): string {
  const j = INFO_JUNTA[m.geometria.junta]
  return `${j.nome}. ${m.montagem.fixa ? 'Peça presa na estrutura: não gira.' : j.resumo}`
}

/** Sorteia um tipo de junta (H46). */
export function juntaAleatoria(aleatorio: () => number = Math.random): TipoJunta {
  return TIPOS_JUNTA[Math.min(TIPOS_JUNTA.length - 1, Math.floor(aleatorio() * TIPOS_JUNTA.length))]
}

/**
 * A peça de teste com outro tipo de junta (treino livre): espessura e
 * abertura da junta (o V pede chapa grossa) e a peça chega como de costume.
 */
export function comJunta(m: Missao, junta: TipoJunta): Missao {
  const j = INFO_JUNTA[junta]
  return { ...m, geometria: { ...m.geometria, junta, espessuraMm: j.espessuraTesteMm, aberturaMm: j.aberturaTesteMm }, montagem: LIVRE(junta) }
}

/** H104: o chanfro em V só cabe em chapa a partir desta espessura (mm). */
export const ESPESSURA_MINIMA_V_MM = 4

/** H104: espessuras do estoque da chapa que servem para a junta. */
export function espessurasPara(material: MaterialId, junta: TipoJunta): number[] {
  return MATERIAIS[material].ficha.espessurasMm.filter((e) => junta !== 'v' || e >= ESPESSURA_MINIMA_V_MM)
}

/**
 * H104: a peça de teste em outra chapa (treino livre). O material traz o
 * gás, o arame e o estoque de espessuras dele; fica a espessura pedida, se o
 * estoque tiver, ou a mais perto da de teste da junta. Chapa só fina não
 * aceita o V: a junta volta para o topo.
 */
export function comMaterial(m: Missao, material: MaterialId, espessuraMm?: number): Missao {
  let base = m
  if (espessurasPara(material, base.geometria.junta).length === 0) base = comJunta(base, 'topo')
  const junta = base.geometria.junta
  const estoque = espessurasPara(material, junta)
  const alvo = espessuraMm ?? INFO_JUNTA[junta].espessuraTesteMm
  const espessura = estoque.includes(alvo) ? alvo : estoque.reduce((a, b) => (Math.abs(b - alvo) < Math.abs(a - alvo) ? b : a))
  return {
    ...base,
    material,
    condicaoFornecimento: `Sobra de chapa: ${MATERIAIS[material].nome.toLowerCase()}, ${espessura.toLocaleString('pt-BR')} mm.`,
    geometria: { ...base.geometria, espessuraMm: espessura },
    consumiveis: { ...base.consumiveis, gases: gasesDoMaterial(material) },
  }
}

/** H104: a peça de teste do treino livre a partir do contexto de uma tentativa (chapa, espessura e junta). */
export function pecaLivre(ctx: Pick<ContextoProcesso, 'material' | 'espessuraMm' | 'junta'>): Missao {
  return comMaterial(comJunta(PECA_PADRAO, ctx.junta ?? 'topo'), ctx.material, ctx.espessuraMm)
}

export function descreverConsumiveis(m: Missao): string[] {
  return [
    `${ARAMES[m.material]}, diâmetro ${m.consumiveis.diametrosMm.map((d) => d.toLocaleString('pt-BR', { minimumFractionDigits: 1 })).join(' ou ')} mm`,
    ...m.consumiveis.gases.map((g) => `Gás: ${GASES[g].nome} (${GASES[g].processo})`),
  ]
}

/**
 * Peça padrão da bancada de configuração: sobra de chapa de aço carbono de
 * 3 mm, com os requisitos da missão de referência como guia. Não é missão:
 * não aparece no catálogo, não pontua e não vai para ranking.
 */
export const PECA_PADRAO: Missao = {
  ...MISSOES[0],
  id: 'peca-padrao',
  titulo: 'Peça padrão de teste',
  contexto: 'Sobra de chapa de aço carbono de 3 mm, para regular a máquina e testar o dispositivo.',
  finalidade: 'Ajuste de parâmetros. Nada aqui conta.',
  consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2', 'co2'] },
  desafio: 'Regule a máquina e confira largura, reforço e fusão prevista.',
}
