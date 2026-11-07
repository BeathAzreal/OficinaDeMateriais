/**
 * Tipos do estado da partida: dados obtidos pelo jogador.
 * Nada aqui guarda a "verdade" do caso; os resultados são saídas do modelo de aquisição.
 */
import type {
  Ampliacao,
  Ataque,
  Carga,
  Iluminacao,
  Limpeza,
  Lixamento,
  Orientacao,
  Polimento,
  Qualidade,
  VistaVisual,
  Faixa,
} from '../casos/tipos';

export type Modo = 'aprender' | 'desafio';
export type Aba = 'bancada' | 'hipoteses' | 'ensaios' | 'relatorio' | 'devolutiva';
export type Severidade = 'info' | 'atencao' | 'grave';

/** Limitação específica e explicável gerada por uma configuração. */
export interface Limitacao {
  id: string;
  severidade: Severidade;
  texto: string;
  /** Explicação didática (mostrada já no modo Aprender; no Desafio, só na devolutiva). */
  explicacao: string;
}

/** Achado visível num resultado. `chave` identifica o achado dentro da aquisição. */
export interface AchadoVisivel {
  chave: string;
  achadoId: string;
  modo: 'campo' | 'local';
  qualidade: Qualidade;
  observacao: string;
  grupo?: string;
  /** Marcadores em mm no plano da imagem (achados locais); vazio para achados de campo. */
  marcadores: { u: number; v: number; raio: number }[];
  /** Como desenhar os marcadores de um achado local (micrografias). */
  forma?: 'linha' | 'circulos';
  /** Chave de um achado local que precisa ser encontrado antes deste ficar disponível. */
  requer?: string;
}

export interface Custo {
  reais: number;
  horas: number;
}

export interface RegistroGasto {
  id: string;
  descricao: string;
  custo: Custo;
  instante: number;
}

export interface Amostra {
  id: string;
  orientacao: Orientacao;
  parte: 'A' | 'B';
  /** y do plano (transversal) ou x do plano (longitudinal), mm. */
  posicao: number;
  /** Extensão ao longo do plano: x (transversal) ou y (longitudinal), mm. */
  extensao: Faixa;
  /** Meia-espessura da fatia removida da peça (mm). */
  meiaFatia: number;
  criadaEm: number;
}

export interface Preparo {
  id: string;
  amostraId: string;
  tentativa: number;
  lixamento: Lixamento;
  polimento: Polimento;
  ataque: Ataque;
  limitacoes: Limitacao[];
}

interface AquisicaoBase {
  id: string;
  criadaEm: number;
  rotulo: string;
  achados: AchadoVisivel[];
  /** Chaves dos achados locais que o jogador já encontrou clicando na imagem. */
  encontrados: string[];
  limitacoes: Limitacao[];
  semente: number;
}

export interface AquisicaoVisual extends AquisicaoBase {
  tipo: 'visual';
  superficie: string;
  vista: VistaVisual;
  /** Janela visível (mm) no plano (u, v) da superfície. */
  janela: { u: Faixa; v: Faixa };
  iluminacao: Iluminacao;
  limpeza: Limpeza;
  /** Regiões (u, v) removidas por cortes no momento da aquisição. */
  removidos: { u: Faixa; v: Faixa; amostraId: string }[];
}

export interface AquisicaoMicrografia extends AquisicaoBase {
  tipo: 'micrografia';
  amostraId: string;
  preparoId: string;
  ampliacao: Ampliacao;
  centro: { u: number; v: number };
  janela: { u: Faixa; v: Faixa };
}

export interface Indentacao {
  u: number;
  v: number;
  hv: number;
  /** Diagonal média (mm). */
  diagonal: number;
  /** Ids das limitações que afetam este ponto. */
  alertas: string[];
}

export interface AquisicaoMicrodureza extends AquisicaoBase {
  tipo: 'microdureza';
  amostraId: string;
  preparoId: string;
  carga: Carga;
  pontos: Indentacao[];
}

export interface AquisicaoDocumento extends AquisicaoBase {
  tipo: 'documento';
  documentoId: string;
}

export type Aquisicao = AquisicaoVisual | AquisicaoMicrografia | AquisicaoMicrodureza | AquisicaoDocumento;

export type Vinculo = 'apoia' | 'enfraquece' | 'inconclusiva';

export interface Evidencia {
  id: string;
  aquisicaoId: string;
  chave: string;
  achadoId: string;
  /** Observação: texto fixo do resultado, com identificação da amostra e parâmetros. */
  observacao: string;
  origem: string;
  qualidade: Qualidade;
  grupo?: string;
  interpretacaoId?: string;
  nota: string;
  vinculos: Record<string, Vinculo>;
  criadaEm: number;
}

export interface RegistroHipotese {
  selecionada: boolean;
  apoiaria: string;
  enfraqueceria: string;
}

export type StatusAlternativa = 'apoiada' | 'enfraquecida' | 'descartada' | 'nao-avaliada';

export interface Relatorio {
  mecanismo: string | null;
  justificativaMecanismo: string;
  causa: string | null;
  justificativaCausa: string;
  fatores: string[];
  evidencias: string[];
  alternativas: Record<string, StatusAlternativa>;
  limitacoes: string[];
  limitacaoLivre: string;
  proximosEnsaios: string[];
}

export interface EstadoJogo {
  versao: 1;
  casoId: string;
  modo: Modo;
  iniciadoEm: number;
  aba: Aba;
  tutorialPasso: number | null;
  gastos: RegistroGasto[];
  hipoteses: Record<string, RegistroHipotese>;
  limpezas: Record<string, Limpeza>;
  amostras: Amostra[];
  preparos: Preparo[];
  aquisicoes: Aquisicao[];
  evidencias: Evidencia[];
  relatorio: Relatorio;
  concluido: boolean;
  contador: number;
}

export type Resultado<T = EstadoJogo> = { ok: true; estado: T; novoId?: string } | { ok: false; erro: string };
