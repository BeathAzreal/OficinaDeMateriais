/**
 * Materiais e gases do jogo (H27, H35, H104). Todos os números são relativos e do
 * jogo; o que vem de fora é só a ORDEM das propriedades (ver docs/HIPOTESES.md).
 */

export type MaterialId =
  | 'aco-carbono'
  | 'inox-austenitico'
  | 'aluminio'
  | 'aco-galvanizado'
  | 'aco-medio-carbono'
  | 'inox-ferritico'
  | 'cobre'

/** Processos do jogo em que uma chapa pode ser soldada (H104) ou brasada (H105). */
export type ProcessoChapa = 'MIG/MAG' | 'eletrodo' | 'TIG' | 'brasagem'

export interface Material {
  id: MaterialId
  nome: string
  /** n: multiplica o aporte necessário para fundir (H33, H35). */
  necessidadeFusao: number
  /** e: quanto o aquecimento acumulado facilita a fusão (H32). */
  efeitoAquecimento: number
  /** g: ganho do aquecimento acumulado por unidade de potência (H32). */
  ganhoAquecimento: number
  /** τ: tempo característico de aquecimento e resfriamento da peça, em s (H32). H87 (v1.8): o dobro, porque o passe dura o dobro. */
  tauAquecimentoS: number
  /** f: tendência a deformar (H36). */
  fatorDeformacao: number
  /** A superfície precisa de limpeza do óxido antes de soldar (H35). */
  exigeLimpeza: boolean
  /** H104: o que a limpeza tira (óxido, zinco) e quanto poro fica sem ela. Só quando `exigeLimpeza`. */
  limpeza?: { acao: string; rotulo: string; porosidade: number }
  /** H104: nome curto para rótulos e chips. */
  nomeCurto: string
  /** H104: processos em que o jogo oferece esta chapa no treino. */
  processos: readonly ProcessoChapa[]
  /**
   * H104: o que a chapa tem de próprio, para o jogador ler antes de soldar.
   * `espessurasMm` são as chapas do estoque da bancada livre do MIG/MAG.
   */
  ficha: { resumo: string; calor: string; espessurasMm: readonly number[]; pontos: readonly string[] }
  /**
   * H104: o mesmo material no TIG (H92): calor por volume (J/mm³K),
   * difusividade (mm²/s, metade da real para caber na grade do jogo), perda
   * para o resto da peça (1/s), subida de temperatura que funde (K) e quanto
   * da corrente do aço carbono a mesma poça pede (medido no modelo: mesma
   * largura fundida no filete de 3 mm a 2 mm/s). Ausente = não vai ao TIG.
   */
  tig?: { rhoC: number; alfa: number; perda: number; fusaoK: number; fatorCorrente: number }
  /** Só aparência (H8). */
  aparencia: {
    chapaClara: string
    chapaEscura: string
    /** Camadas do cordão, da borda para a crista (H40). */
    cordao: readonly [string, string, string, string]
    /** O metal quase não muda de cor ao aquecer (alumínio). */
    brilhoFraco: boolean
    /** Faixa de coloração térmica ao lado do cordão (inox). */
    tintaTermica: boolean
  }
}

export const MATERIAIS: Record<MaterialId, Material> = {
  'aco-carbono': {
    id: 'aco-carbono',
    nome: 'Aço de baixo carbono',
    necessidadeFusao: 1,
    efeitoAquecimento: 0.3,
    ganhoAquecimento: 0.25,
    tauAquecimentoS: 24,
    fatorDeformacao: 1,
    exigeLimpeza: false,
    nomeCurto: 'Aço carbono',
    processos: ['MIG/MAG', 'eletrodo', 'TIG', 'brasagem'],
    ficha: {
      resumo: 'A referência da oficina: funde com calor médio e avisa antes de furar.',
      calor: 'Calor acumulado da peça: o aço carbono esquenta e esfria num ritmo médio.',
      espessurasMm: [1.5, 3, 6],
      pontos: ['A raiz aparece no avesso e o metal pendura antes do furo.', 'Deforma pouco com o calor certo.'],
    },
    tig: { rhoC: 0.0038, alfa: 6, perda: 0.45, fusaoK: 1450, fatorCorrente: 1 },
    aparencia: { chapaClara: '#77808b', chapaEscura: '#545c66', cordao: ['#474d55', '#6c737b', '#959ca4', '#c8cdd2'], brilhoFraco: false, tintaTermica: false },
  },
  'inox-austenitico': {
    id: 'inox-austenitico',
    nome: 'Aço inoxidável austenítico',
    necessidadeFusao: 0.85,
    efeitoAquecimento: 0.25,
    ganhoAquecimento: 0.35,
    tauAquecimentoS: 36,
    fatorDeformacao: 1.7,
    exigeLimpeza: false,
    nomeCurto: 'Inox austenítico',
    processos: ['MIG/MAG', 'eletrodo', 'TIG', 'brasagem'],
    ficha: {
      resumo: 'Conduz pouco o calor: ele fica perto do cordão, a peça entorta e colore.',
      calor: 'O inox guarda o calor perto do cordão e demora a esfriar: o fim do passe sai mais quente.',
      espessurasMm: [1.5, 2, 3],
      pontos: ['Funde com um pouco menos de calor que o aço carbono.', 'Deforma bem mais: ande no ritmo e não demore.', 'Deixa a faixa colorida (palha, roxo, azul) ao lado do cordão.'],
    },
    tig: { rhoC: 0.0039, alfa: 4, perda: 0.35, fusaoK: 1450, fatorCorrente: 0.8 },
    aparencia: { chapaClara: '#d3d1cb', chapaEscura: '#aba79f', cordao: ['#726c62', '#a09a8f', '#cbc6bc', '#efede8'], brilhoFraco: false, tintaTermica: true },
  },
  aluminio: {
    id: 'aluminio',
    nome: 'Liga de alumínio',
    necessidadeFusao: 1.8,
    efeitoAquecimento: 0.8,
    ganhoAquecimento: 0.3,
    tauAquecimentoS: 16,
    fatorDeformacao: 1.2,
    exigeLimpeza: true,
    limpeza: { acao: 'Remover o óxido (escova de inox)', rotulo: 'Óxido removido', porosidade: 0.55 },
    nomeCurto: 'Alumínio',
    processos: ['MIG/MAG', 'TIG'],
    ficha: {
      resumo: 'Leva o calor para longe: pede muito calor no começo e quase não avisa antes de cair.',
      calor: 'O alumínio esquenta muito ao longo do passe: a fusão aumenta com o calor acumulado.',
      espessurasMm: [2, 3, 5],
      pontos: ['Pede quase o dobro do calor do aço para fundir.', 'Não muda de cor ao aquecer: a poça cai de uma vez.', 'Tire o óxido antes, senão a fusão cai e sobra poro.', 'No TIG de verdade o alumínio pede corrente alternada; o jogo não muda a polaridade.'],
    },
    tig: { rhoC: 0.0024, alfa: 44, perda: 2, fusaoK: 620, fatorCorrente: 1.35 },
    aparencia: { chapaClara: '#e6ebf1', chapaEscura: '#c2cbd6', cordao: ['#97a2ae', '#bcc6d1', '#dbe2ea', '#f8fafc'], brilhoFraco: true, tintaTermica: false },
  },
  'aco-galvanizado': {
    id: 'aco-galvanizado',
    nome: 'Aço galvanizado',
    necessidadeFusao: 1,
    efeitoAquecimento: 0.3,
    ganhoAquecimento: 0.28,
    tauAquecimentoS: 22,
    fatorDeformacao: 1.1,
    exigeLimpeza: true,
    limpeza: { acao: 'Remover o zinco da borda (esmerilhadeira)', rotulo: 'Zinco removido', porosidade: 0.6 },
    nomeCurto: 'Galvanizado',
    processos: ['MIG/MAG', 'eletrodo', 'brasagem'],
    ficha: {
      resumo: 'Aço carbono fino coberto de zinco: o zinco ferve no arco e enche o cordão de poro.',
      calor: 'Chapa fina de aço: esquenta rápido e fura cedo se a tocha parar.',
      espessurasMm: [1.2, 1.5, 2],
      pontos: ['Só vem em chapa fina: calor baixo e passo firme.', 'Esmerilhe o zinco da borda: sem isso a fusão cai e sobra poro.', 'No TIG o zinco contamina o tungstênio: o jogo não oferece.'],
    },
    aparencia: { chapaClara: '#a7aeb3', chapaEscura: '#80878d', cordao: ['#4a5057', '#6f767e', '#989fa7', '#cbd0d5'], brilhoFraco: false, tintaTermica: false },
  },
  'aco-medio-carbono': {
    id: 'aco-medio-carbono',
    nome: 'Aço médio carbono (SAE 1045)',
    necessidadeFusao: 1.1,
    efeitoAquecimento: 0.45,
    ganhoAquecimento: 0.18,
    tauAquecimentoS: 40,
    fatorDeformacao: 0.8,
    exigeLimpeza: false,
    nomeCurto: 'Médio carbono',
    processos: ['MIG/MAG', 'eletrodo', 'TIG'],
    ficha: {
      resumo: 'Chapa grossa e dura: custa a esquentar, mas depois guarda o calor por muito tempo.',
      calor: 'O aço médio carbono demora a esquentar e guarda o calor: o começo do passe sai frio, o fim funde melhor.',
      espessurasMm: [4, 6, 8],
      pontos: ['Pede um pouco mais de calor que o aço carbono comum.', 'Começo frio: a peça quente funde bem melhor (pré-aquecimento).', 'Deforma pouco: a massa grossa segura a peça.'],
    },
    tig: { rhoC: 0.0038, alfa: 6.5, perda: 0.5, fusaoK: 1450, fatorCorrente: 1.05 },
    aparencia: { chapaClara: '#666b71', chapaEscura: '#464b51', cordao: ['#41464d', '#646b73', '#8c939b', '#bfc4ca'], brilhoFraco: false, tintaTermica: false },
  },
  'inox-ferritico': {
    id: 'inox-ferritico',
    nome: 'Aço inoxidável ferrítico (430)',
    necessidadeFusao: 0.9,
    efeitoAquecimento: 0.25,
    ganhoAquecimento: 0.4,
    tauAquecimentoS: 30,
    fatorDeformacao: 1.2,
    exigeLimpeza: false,
    nomeCurto: 'Inox ferrítico',
    processos: ['MIG/MAG', 'eletrodo', 'TIG'],
    ficha: {
      resumo: 'Inox de chapa bem fina (eletrodomésticos, coifas): esquenta muito rápido.',
      calor: 'O inox ferrítico esquenta muito rápido: em poucos centímetros a peça já está quente.',
      espessurasMm: [1, 1.5, 2],
      pontos: ['Esquenta mais rápido que qualquer outra chapa do jogo.', 'Deforma menos que o inox austenítico, mais que o aço carbono.', 'Também colore ao lado do cordão.'],
    },
    tig: { rhoC: 0.0038, alfa: 5, perda: 0.4, fusaoK: 1450, fatorCorrente: 0.88 },
    aparencia: { chapaClara: '#c2c5c6', chapaEscura: '#999d9f', cordao: ['#6c6a66', '#9a9893', '#c6c4bf', '#ebeae6'], brilhoFraco: false, tintaTermica: true },
  },
  cobre: {
    id: 'cobre',
    nome: 'Cobre',
    necessidadeFusao: 2.4,
    efeitoAquecimento: 1,
    ganhoAquecimento: 0.35,
    tauAquecimentoS: 12,
    fatorDeformacao: 1.3,
    exigeLimpeza: false,
    nomeCurto: 'Cobre',
    processos: ['MIG/MAG', 'TIG', 'brasagem'],
    ficha: {
      resumo: 'O metal que mais conduz calor: espalha tudo pela peça e esfria assim que o arco sai.',
      calor: 'O cobre espalha o calor pela peça inteira e esfria rápido: só funde bem com a peça já quente.',
      espessurasMm: [1.5, 2, 3],
      pontos: ['Pede o maior calor do jogo para fundir.', 'Peça quente funde muito mais: o começo é o mais difícil.', 'Como o alumínio, quase não avisa antes de furar.'],
    },
    tig: { rhoC: 0.0034, alfa: 35, perda: 0.8, fusaoK: 1060, fatorCorrente: 2.1 },
    aparencia: { chapaClara: '#c98a5e', chapaEscura: '#9c6440', cordao: ['#7a4428', '#a8623a', '#cf8a5c', '#efc09a'], brilhoFraco: false, tintaTermica: false },
  },
}

export type GasId = 'ar-co2' | 'co2' | 'ar' | 'ar-co2-baixo'

export interface Gas {
  id: GasId
  nome: string
  /** MIG = gás inerte; MAG = gás ativo. */
  processo: 'MIG' | 'MAG'
  /** η: rendimento de deposição relativo (H29). */
  rendimento: number
  /** Fator do gás no índice de fusão (H33). */
  fatorFusao: number
  /** Materiais para os quais o jogo oferece este gás (H27). */
  materiais: MaterialId[]
}

export const GASES: Record<GasId, Gas> = {
  'ar-co2': {
    id: 'ar-co2',
    nome: 'Mistura argônio + CO₂',
    processo: 'MAG',
    rendimento: 1,
    fatorFusao: 1,
    materiais: ['aco-carbono', 'aco-galvanizado', 'aco-medio-carbono'],
  },
  co2: {
    id: 'co2',
    nome: 'CO₂ puro',
    processo: 'MAG',
    rendimento: 0.94,
    fatorFusao: 1.1,
    materiais: ['aco-carbono', 'aco-galvanizado', 'aco-medio-carbono'],
  },
  'ar-co2-baixo': {
    id: 'ar-co2-baixo',
    nome: 'Argônio com baixo teor de CO₂',
    processo: 'MAG',
    rendimento: 1,
    fatorFusao: 1,
    materiais: ['inox-austenitico', 'inox-ferritico'],
  },
  ar: {
    id: 'ar',
    nome: 'Argônio puro',
    processo: 'MIG',
    rendimento: 1,
    fatorFusao: 1,
    materiais: ['aluminio', 'cobre'],
  },
}

/** Arames sólidos: cada material tem o seu (H27). */
export const ARAMES: Record<MaterialId, string> = {
  'aco-carbono': 'Arame sólido de aço carbono',
  'inox-austenitico': 'Arame sólido de inox austenítico',
  aluminio: 'Arame sólido de liga de alumínio',
  'aco-galvanizado': 'Arame sólido de aço carbono',
  'aco-medio-carbono': 'Arame sólido de aço carbono',
  'inox-ferritico': 'Arame sólido de inox (liga 309)',
  cobre: 'Arame sólido de cobre desoxidado',
}

export function gasCompativel(gas: GasId, material: MaterialId): boolean {
  return GASES[gas].materiais.includes(material)
}

/** H104: chapas que o jogo oferece num processo, na ordem do catálogo. */
export function materiaisDoProcesso(p: ProcessoChapa): MaterialId[] {
  return (Object.keys(MATERIAIS) as MaterialId[]).filter((id) => MATERIAIS[id].processos.includes(p))
}

/** H104: gases do jogo para um material, na ordem do catálogo. */
export function gasesDoMaterial(material: MaterialId): GasId[] {
  return (Object.keys(GASES) as GasId[]).filter((g) => GASES[g].materiais.includes(material))
}
