// Tipos do modelo de usinagem. Unidades no nome do campo ou no comentário:
// mm, rpm, mm/volta, m/min, mm/min, min, µm, N, N·m, u.c. (unidade de custo didática).

/** Origem de um valor numérico — tudo que não for geometria/cinemática exata é sintético. */
export type OrigemDado = 'exato' | 'literatura-geral' | 'sintetico';

export interface ValorDeclarado {
  rotulo: string;
  valor: string;
  origem: OrigemDado;
  nota?: string;
}

/** Material da ferramenta: muda a curva de vida, não só um fator. */
export type ClasseFerramenta = 'metal-duro' | 'aco-rapido';

export const NOME_CLASSE: Record<ClasseFerramenta, string> = {
  'metal-duro': 'metal duro',
  'aco-rapido': 'aço rápido',
};

// ---------------------------------------------------------------- Material

export type TipoCavaco = 'curto' | 'fita' | 'apc' | 'espesso' | 'fragmentado';

/** Janela em que a geometria da ferramenta quebra o cavaco; null = sem quebra-cavaco. */
export interface JanelaCavaco {
  fMin: number;
  fMax: number;
  apMin: number;
  apMax: number;
}

export interface CondicaoCavaco {
  vc: number; // m/min
  f: number; // mm/volta
  ap: number; // mm (profundidade efetiva máxima; na furação, metade do diâmetro cortado)
  janelaQuebra: JanelaCavaco | null;
  furacao: boolean;
}

export interface ResultadoCavaco {
  tipo: TipoCavaco;
  rotulo: string;
  descricao: string;
}

/** Curva de vida sintética de Taylor estendida: T = Tref·(vcRef/vc)^expoente·(fRef/f). */
export interface CurvaVida {
  vcRef: number; // m/min para T = 10 min com f = 0,25 mm/volta
  expoente: number; // 1/n de Taylor
}

/**
 * Comportamento do material na usinagem. Cada material implementa as próprias funções —
 * não é um multiplicador único de "dificuldade".
 */
export interface ComportamentoMaterial {
  /** Forma de Kienzle kc = kc11 · h^(−mc), parâmetros sintéticos. */
  forca: { kc11: number; mc: number };
  /** Classificação qualitativa do cavaco. */
  classificarCavaco(c: CondicaoCavaco): ResultadoCavaco;
  /** Contribuição da aresta postiça para Ra (µm) em função de vc (m/min). */
  rugosidadeApc(vc: number): number;
  /** Vida de referência da aresta (min) para a classe de ferramenta. */
  vidaAresta(vc: number, f: number, classe: ClasseFerramenta): number;
  /** Multiplicador de desgaste quando a aresta corta a casca original (carepa, pele de fundição…). */
  fatorCasca(apEfetivo: number): number;
  /** Rugosidade mínima atingível (µm), sintética. */
  raMinimo: number;
  /** Parcela máxima de Ra por atrito quando ap → 0 (µm); maior em materiais que encruam. */
  raAtritoMax: number;
  /** Módulo de elasticidade (N/mm²) para a flexão da peça. */
  moduloElasticidade: number;
}

export type EsquemaMicroestrutura =
  | { tipo: 'ferrita-perlita'; fracaoPerlita: number }
  | { tipo: 'monofasico'; corGrao: string; maclas: boolean; particulas?: { cor: string; densidade: number } }
  | { tipo: 'grafita-lamelar' };

export interface Material {
  id: string;
  nome: string;
  familia: string;
  designacao: string;
  condicaoFornecimento: string;
  descricaoCondicao: string;
  composicao: ValorDeclarado[];
  propriedades: ValorDeclarado[];
  microestrutura: {
    descricao: string;
    esquema: EsquemaMicroestrutura;
    legenda: string;
    calculo?: string;
  };
  interpretacao: string[];
  casca?: { nome: string; espessura: number; descricao: string }; // mm
  /** Cores da apresentação (superfície bruta e usinada). */
  cores: { bruta: [string, string]; usinada: [string, string] };
  comportamento: ComportamentoMaterial;
}

// ---------------------------------------------------------------- Ferramentas

interface FerramentaBase {
  id: string;
  codigo: string;
  nome: string;
  classe: ClasseFerramenta;
  descricaoClasse: string;
  geometria: ValorDeclarado[];
  vbLimite: number; // mm — limite didático de desgaste de flanco
  custo: number; // u.c. por aresta (inserto) ou por broca
  observacoes: string[];
}

export interface FerramentaTornear extends FerramentaBase {
  tipo: 'tornear';
  raioPonta: number; // rε, mm
  anguloPosicao: number; // κr, graus
  anguloFolga: number; // α, graus
  anguloPonta: number; // εr, graus (forma do inserto)
  apMax: number; // mm — limite geométrico declarado
  quebraCavaco: JanelaCavaco | null;
  forcaLimite: number; // N — força de corte acima da qual a aresta lasca (sintética)
}

export interface Broca extends FerramentaBase {
  tipo: 'broca';
  diametro: number; // mm
  anguloPonta: number; // σ, graus
  comprimentoUtil: number; // mm de canal
  torqueLimite: number; // N·m (sintético) — acima disso a broca quebra
  forcaAvancoLimite: number; // N (sintético)
  sobremedida: number; // mm — furo maior que a broca (sintético)
  raBase: number; // µm — rugosidade de referência da parede (sintética)
  janelaCavaco: { fMin: number; fMax: number };
}

export type Ferramenta = FerramentaTornear | Broca;

// ---------------------------------------------------------------- Máquina

export interface Maquina {
  id: string;
  nome: string;
  rotacao: { min: number; max: number }; // rpm
  avanco: { min: number; max: number; passo: number }; // mm/volta
  profundidade: { min: number; max: number; passo: number }; // mm (radial)
  comprimentoPasso: number; // mm, resolução do comprimento do passe
  rigidezSistema: number; // N/mm — placa + árvore + carro (sintética)
  aproximacao: number; // mm percorridos em avanço antes de tocar a face
  folgaCastanhas: number; // mm de segurança até as castanhas
  diametroMinimo: number; // mm — menor diâmetro programável
  paredeMinima: number; // mm — parede mínima entre furo e diâmetro externo
  estacoes: number; // posições na torre
  tempoDescarga: number; // min por retração de pica-pau (sintético)
}

// ---------------------------------------------------------------- Encomenda

export interface PontoMedicao {
  id: string;
  z: number; // mm a partir da face livre
  descricao: string;
}

export interface Encomenda {
  id: string;
  codigo: string;
  titulo: string;
  cliente: string;
  resumo: string;
  contexto: string[];
  materialId: string;
  maquinaId: string;
  /** Ferramentas que podem ir para a torre nesta encomenda. */
  ferramentasPermitidas: string[];
  /** Torre montada no início (posição → id da ferramenta). */
  torreInicial: Record<number, string>;
  tarugo: { diametro: number; comprimentoTotal: number; comprimentoFixado: number };
  fixacao: string;
  requisitos: {
    diametro: { nominal: number; tolSup: number; tolInf: number };
    comprimento: { nominal: number; tol: number };
    ra: { max: number };
  };
  pontosMedicao: PontoMedicao[];
  instrumentos: {
    micrometro: { resolucao: number; incerteza: number; descricao: string };
    paquimetro: { resolucao: number; descricao: string };
  };
  custos: { tarugo: number; minutoMaquina: number };
  tempos: {
    naoProdutivoPorPasse: number;
    trocaAresta: number;
    preparacaoTarugo: number;
    limpezaCavaco: number;
    montagemFerramenta: number;
  };
  modoEncomenda: { orcamento: number; tarugos: number; arestas: number };
}

// ---------------------------------------------------------------- Passes

export type Operacao = 'desbaste' | 'acabamento';

export interface ParametrosPasse {
  n: number; // rpm
  f: number; // mm/volta
  ap: number; // mm, profundidade radial programada
  L: number; // mm, comprimento do passe a partir da face livre
  operacao: Operacao;
}

export interface ParametrosFuracao {
  n: number; // rpm
  f: number; // mm/volta
  P: number; // mm, profundidade do diâmetro pleno a partir da face
  q: number; // mm, profundidade entre descargas (pica-pau); 0 = contínuo
}

export type NivelCarga = 'baixa' | 'moderada' | 'alta' | 'crítica';

export interface ComponentesRa {
  geometrica: number; // f²/(32 rε)
  piso: number; // efeito do piso sintético combinado à geométrica
  apc: number;
  desgaste: number;
  atrito: number; // ap efetiva muito pequena
  lascamento: number;
  total: number;
}
