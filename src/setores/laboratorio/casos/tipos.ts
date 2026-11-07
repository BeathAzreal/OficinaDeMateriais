/**
 * Tipos de definição de um caso.
 *
 * Um caso tem três partes, mantidas separadas de propósito:
 *  - `publico`: o que a interface pode mostrar (ficha, documentos, hipóteses, opções do relatório).
 *  - `verdade`: o estado real da peça. Só o motor de ensaios (src/motor) lê esta parte.
 *  - `gabarito`: chave de avaliação e devolutiva. Só src/avaliacao lê esta parte.
 *
 * Coordenadas da peça (mm), usadas em todo o motor:
 *  x — ao longo do comprimento da barra; x = 0 é o eixo da solda; x < 0 é o lado A.
 *  y — ao longo da largura da barra (0 a `largura`).
 *  z — profundidade a partir da face do cordão (z = 0 na face, z = espessura na raiz).
 *      Valores negativos de z ficam no reforço do cordão, acima da face.
 */

export type Faixa = [number, number];

export type Orientacao = 'transversal' | 'longitudinal';
export type Ampliacao = 10 | 100 | 500;
export type Lixamento = 'lixa-220' | 'lixa-600' | 'lixa-1200';
export type Polimento = 'nenhum' | 'diamante-6' | 'diamante-6-1';
export type Ataque = 'nenhum' | 'nital-5s' | 'nital-30s';
export type Iluminacao = 'difusa' | 'rasante';
export type Limpeza = 'como-recebida' | 'suave' | 'agressiva';
export type VistaVisual = 'geral' | 'detalhe';
export type Carga = 'HV0.1' | 'HV0.5' | 'HV1';
/** Qualidade com que um achado aparece num resultado. */
export type Qualidade = 'nitida' | 'tenue' | 'comprometida';

// ---------------------------------------------------------------------------
// Parte pública
// ---------------------------------------------------------------------------

export type CategoriaHipotese = 'mecanismo' | 'causa' | 'fator';

export interface Hipotese {
  id: string;
  categoria: CategoriaHipotese;
  titulo: string;
  descricao: string;
}

export interface FatoDocumento {
  /** Id do achado correspondente (usado pela avaliação; não é exibido). */
  achadoId: string;
  texto: string;
}

export interface Documento {
  id: string;
  titulo: string;
  origem: string;
  fatos: FatoDocumento[];
}

export interface OpcaoInterpretacao {
  id: string;
  texto: string;
}

export interface GrupoInterpretacao {
  id: string;
  pergunta: string;
  opcoes: OpcaoInterpretacao[];
}

export interface OpcaoRelatorio {
  id: string;
  texto: string;
}

export type TipoSuperficie = 'fratura' | 'externa';

/** Superfície examinável na estação de inspeção visual. */
export interface SuperficieDef {
  id: string;
  nome: string;
  tipo: TipoSuperficie;
  parte: 'A' | 'B';
  descricao: string;
  /** Eixos do plano da imagem: rótulo e faixa visível na visão geral (mm). */
  eixoU: { rotulo: string; faixa: Faixa };
  eixoV: { rotulo: string; faixa: Faixa };
}

export interface PassoTutorial {
  titulo: string;
  texto: string;
  /** Aba a exibir durante o passo. */
  aba?: 'bancada' | 'hipoteses' | 'ensaios' | 'relatorio';
}

export interface CasoPublico {
  titulo: string;
  subtitulo: string;
  ficha: {
    peca: string;
    materialDeclarado: string;
    geometria: string;
    processo: string;
    condicoesUso: string;
  };
  historico: string[];
  objetivo: string;
  recursos: { orcamento: number; tempoH: number };
  /** Dimensões externas visíveis a olho nu (para desenhar a peça). */
  desenho: {
    comprimento: number;
    largura: number;
    espessura: number;
    /** Meia-largura do cordão na face (mm). */
    meiaLarguraCordao: number;
    /** Posição aproximada da fratura na face (mm), lado B do cordão. */
    xFraturaFace: number;
  };
  superficies: SuperficieDef[];
  documentos: Documento[];
  hipoteses: Hipotese[];
  gruposInterpretacao: GrupoInterpretacao[];
  relatorio: {
    limitacoes: OpcaoRelatorio[];
    proximosEnsaios: OpcaoRelatorio[];
  };
  tutorial: PassoTutorial[];
  /** Dicas exibidas no modo Aprender antes das decisões, por estação. */
  dicas: Record<'bancada' | 'hipoteses' | 'visual' | 'metalografia' | 'microdureza' | 'relatorio', string[]>;
}

// ---------------------------------------------------------------------------
// Verdade (somente motor)
// ---------------------------------------------------------------------------

export interface GeometriaJuntaTopo {
  tipo: 'junta-topo-v';
  comprimento: number;
  largura: number;
  espessura: number;
  aberturaRaiz: number;
  /** Ângulo do bisel de cada lado (graus). */
  anguloBisel: number;
  /** Quanto o passe de acabamento avança além da aresta do bisel, na face (mm). */
  sobreposicaoFace: number;
  alturaReforcoFace: number;
  meiaLarguraRaiz: number;
  alturaReforcoRaiz: number;
  /** Trecho de reinício do cordão (reforço mais alto). */
  reinicio: { y: Faixa; alturaExtra: number };
  /** Larguras das sub-regiões da ZTA medidas a partir da linha de fusão (mm). */
  zta: { gg: number; gf: number; ic: number };
  /** Profundidade até onde a ZTA de grãos grosseiros não foi revenida por passes seguintes (mm). */
  profundidadeNaoRevenida: number;
  /** Profundidade da fronteira entre passe de acabamento e passes reaquecidos na ZF (mm). */
  profundidadeZfAcabamento: number;
  fratura: {
    /** Plano principal da fratura abaixo do trecho inicial (mm). */
    xPlano: number;
    /** Até esta profundidade a fratura acompanha a ZTA de grãos grosseiros. */
    profundidadeTrechoZta: number;
    /** Afastamento da linha de fusão nesse trecho (mm). */
    afastamentoZta: number;
    /** Faixa de y em que o trecho inicial é intergranular (região da origem). */
    yOrigem: Faixa;
  };
}

export type EstiloMicro =
  | 'ferrita-perlita'
  | 'ferrita-perlita-parcial'
  | 'martensita'
  | 'martensita-revenida'
  | 'zf-colunar'
  | 'zf-refinada';

export interface ZonaDef {
  nome: string;
  estilo: EstiloMicro;
  /** Tamanho característico de grão (mm). */
  tamanhoGrao: number;
  /** Fração de constituinte escuro (perlita) para estilos ferrita-perlita. */
  fracaoEscura: number;
  /** Tom no macroataque, 0 (escuro) a 1 (claro). */
  tomMacro: number;
  /** Densidade de inclusões visíveis (por mm²). */
  inclusoes: number;
  /** Dureza "verdadeira" sintética (HV). */
  dureza: number;
}

export interface Esfera {
  x: number;
  y: number;
  z: number;
  r: number;
}

export type Forma3D =
  | { tipo: 'esferas'; esferas: Esfera[] }
  | {
      tipo: 'trinca';
      /** Largura da abertura (mm). */
      largura: number;
      /** Traço no corte transversal (u = x, v = z) válido para y na faixa. */
      transversal?: { y: Faixa; pontos: [number, number][] };
      /** Traço no corte longitudinal (u = y, v = z) válido para x na faixa. */
      longitudinal?: { x: Faixa; pontos: [number, number][] };
    };

export interface RegraVisual {
  vistas: VistaVisual[];
  iluminacoes: Iluminacao[];
  limpezas: Limpeza[];
  qualidade: Qualidade;
}

export interface AchadoVisual {
  id: string;
  estacao: 'visual';
  superficies: string[];
  /** 'campo': observação de conjunto; 'local': precisa ser encontrada clicando na imagem. */
  modo: 'campo' | 'local';
  /** Região onde o achado existe, nas coordenadas (u, v) da superfície. */
  regiao: { u: Faixa; v: Faixa };
  marcador?: { u: number; v: number; raio: number };
  regras: RegraVisual[];
  observacao: string;
  observacaoTenue?: string;
  grupo?: string;
}

export interface RegraMetalografia {
  ampliacoes: Ampliacao[];
  ataques: Ataque[];
  qualidade: Qualidade;
}

export interface AchadoMetalografia {
  id: string;
  estacao: 'metalografia';
  modo: 'campo' | 'local';
  /** Para 'campo': zona no centro do campo. */
  zonas?: string[];
  /** Para 'campo': o campo precisa cruzar esta caixa 3D. */
  caixa?: { x?: Faixa; y?: Faixa; z?: Faixa };
  orientacoes?: Orientacao[];
  /** Para 'local': forma desenhável em `formas`. */
  formaId?: string;
  /** Feição fina que riscos de preparação podem imitar ou encobrir. */
  linhaFina?: boolean;
  regras: RegraMetalografia[];
  observacao: string;
  grupo?: string;
  /** Só fica disponível depois que o jogador localizar este achado local na mesma imagem. */
  requer?: string;
}

export interface AchadoDureza {
  id: string;
  estacao: 'microdureza';
  /** 'maximo': o ponto de maior dureza do perfil; 'media-afastada': média dos pontos longe do eixo. */
  leitura: 'maximo' | 'media-afastada';
  zonas: string[];
  hvMin?: number;
  hvMax?: number;
  grupo?: string;
}

export interface CasoVerdade {
  geometria: GeometriaJuntaTopo;
  zonas: Record<string, ZonaDef>;
  formas: Record<string, Forma3D>;
  achadosVisuais: AchadoVisual[];
  achadosMetalografia: AchadoMetalografia[];
  achadosDureza: AchadoDureza[];
  /** Descrição da superfície de fratura usada para desenhá-la (coordenadas u = y, v = z). */
  superficieFratura: {
    origem: { u: number; v: number };
    /** Semieixos da elipse que delimita a zona de propagação. */
    raioU: number;
    raioV: number;
    regiaoEscura: { u: Faixa; profundidade: number };
    marcasPraia: number[];
    catracas: number[];
    larguraLabios: number;
  };
  /** Feições desenhadas nas superfícies externas. */
  superficieExterna: {
    marcacao: { x: number; y: number; texto: string };
    mordeduraA: { y: Faixa };
    linhaPeA: { y: Faixa };
  };
  /** Variação local de dureza no metal de base por fase atingida (fração, por carga). */
  variacaoFase: Record<Carga, number>;
}

// ---------------------------------------------------------------------------
// Gabarito (somente avaliação)
// ---------------------------------------------------------------------------

export type Relevancia = 'apoia' | 'enfraquece' | 'apoia-fraco' | 'enfraquece-fraco';

export interface GabaritoAchado {
  /** Interpretações consideradas corretas (ids do grupo). */
  corretas?: string[];
  /** Interpretações aceitáveis, com crédito parcial. */
  aceitaveis?: string[];
  /** Interpretações que exageram a conclusão (penalizam o reconhecimento de limitações). */
  exageros?: string[];
  relevancia: Record<string, Relevancia>;
  artefato?: boolean;
  /** Achado-chave para a cadeia de evidências. */
  chave?: boolean;
  /** O que este achado mostra e o que não mostra (texto da devolutiva). */
  explicacao: string;
  /** Como obtê-lo (texto da devolutiva). */
  comoObter: string;
}

export interface GrupoSuficiencia {
  achados: string[];
  minimo: number;
}

export interface GabaritoConclusao {
  correta: string;
  /** Todos os grupos precisam ser satisfeitos para os dados serem considerados suficientes. */
  suficiencia: GrupoSuficiencia[];
}

/** Regras declarativas verificadas sobre o que o jogador fez (ver src/avaliacao/amostragem.ts). */
export type RegraAmostragem =
  | { tipo: 'visual'; superficies: string[]; vista: VistaVisual; u?: Faixa; v?: Faixa; limpezas?: Limpeza[] }
  | { tipo: 'corte'; orientacao: Orientacao; parte: 'A' | 'B'; posicao: Faixa; extensaoInclui?: number }
  | { tipo: 'micrografia-zona'; zonas: string[]; ampliacoes: Ampliacao[]; ataques: Ataque[] }
  | { tipo: 'micrografia-caixa'; caixa: { x?: Faixa; y?: Faixa; z?: Faixa }; ampliacoes: Ampliacao[] }
  | { tipo: 'perfil-atravessa' }
  | { tipo: 'perfil-zona'; zonas: string[]; zMax?: number }
  | { tipo: 'documento'; id: string }
  | { tipo: 'limpeza'; superficies: string[]; limpeza: Limpeza }
  | { tipo: 'corte-antes-de-documentar'; parte: 'A' | 'B'; posicao: Faixa; superficies: string[]; u: Faixa };

export interface CriterioAmostragem {
  id: string;
  descricao: string;
  peso: number;
  /** Penalidade: se a regra for satisfeita, desconta `peso`. */
  penalidade?: boolean;
  regra: RegraAmostragem;
}

export interface Gabarito {
  resumo: string[];
  mecanismo: GabaritoConclusao & { explicacao: string };
  causa: GabaritoConclusao & { explicacao: string };
  fatores: Record<string, { verdadeiro: boolean; suficiencia: GrupoSuficiencia[]; explicacao: string }>;
  hipoteses: Record<string, { verdadeira: boolean; evidenciasDecisivas: string[]; explicacao: string }>;
  achados: Record<string, GabaritoAchado>;
  limitacoesCorretas: string[];
  limitacoesIncorretas: string[];
  ensaiosUteis: string[];
  ensaiosInadequados: string[];
  cadeia: { titulo: string; texto: string; achados: string[] }[];
  ensaios: { estacao: string; mostra: string; naoMostra: string }[];
  amostragem: CriterioAmostragem[];
}

export interface CasoDefinicao {
  id: string;
  versao: number;
  publico: CasoPublico;
  verdade: CasoVerdade;
  gabarito: Gabarito;
}
