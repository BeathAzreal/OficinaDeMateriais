/**
 * Grupos de interpretação padrão (usados pelos artefatos de preparação gerados pelo motor)
 * e definição desses artefatos. Casos podem acrescentar grupos próprios em `publico.gruposInterpretacao`.
 */
import type { CasoDefinicao, GrupoInterpretacao } from '../casos/tipos';

export const GRUPOS_PADRAO: GrupoInterpretacao[] = [
  {
    id: 'g-marcas-fratura',
    pergunta: 'O que essas marcas indicam?',
    opcoes: [
      { id: 'marcas-praia', texto: 'Marcas de praia: posições sucessivas da frente de uma trinca que avançou em etapas' },
      { id: 'marcas-ferramenta', texto: 'Marcas de usinagem ou de ferramenta anteriores à falha' },
      { id: 'riscos-limpeza', texto: 'Riscos produzidos por limpeza ou manuseio (artefato)' },
      { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
    ],
  },
  {
    id: 'g-cavidades',
    pergunta: 'O que são essas cavidades?',
    opcoes: [
      { id: 'porosidade', texto: 'Porosidade: gás aprisionado durante a solidificação' },
      { id: 'arrancamento', texto: 'Arrancamentos/pites produzidos na preparação (artefato)' },
      { id: 'pite-corrosao', texto: 'Pites de corrosão' },
      { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
    ],
  },
  {
    id: 'g-linhas-micro',
    pergunta: 'O que são essas linhas?',
    opcoes: [
      { id: 'trinca', texto: 'Trincas' },
      { id: 'riscos', texto: 'Riscos de lixamento/polimento (artefato)' },
      { id: 'contornos', texto: 'Contornos de grão' },
      { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
    ],
  },
  {
    id: 'g-contraste',
    pergunta: 'A que se deve esse aspecto?',
    opcoes: [
      { id: 'sobreataque', texto: 'Ataque excessivo (artefato de preparação)' },
      { id: 'micro-escura', texto: 'Microestrutura realmente escura (ex.: martensita)' },
      { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
    ],
  },
];

/** Achados de artefato gerados pelo próprio motor (não pela verdade do caso). */
export const ARTEFATOS = {
  riscosLixamento: {
    id: 'art-riscos-lixamento',
    grupo: 'g-linhas-micro',
    observacao: 'Linhas retas e paralelas atravessando todo o campo, independentemente dos grãos e das zonas.',
  },
  arrancamento: {
    id: 'art-arrancamento',
    grupo: 'g-cavidades',
    observacao: 'Pequenas cavidades escuras, de contorno irregular, espalhadas por todas as regiões do campo.',
  },
  sobreataque: {
    id: 'art-sobreataque',
    grupo: 'g-contraste',
    observacao: 'Imagem muito escura, com contornos espessos; constituintes claros e escuros pouco distinguíveis.',
  },
  riscosEscova: {
    id: 'art-riscos-escova',
    grupo: 'g-marcas-fratura',
    observacao: 'Riscos retilíneos e paralelos cruzando toda a superfície, sem relação com as demais marcas.',
  },
} as const;

export function todosGrupos(caso: CasoDefinicao): GrupoInterpretacao[] {
  return [...GRUPOS_PADRAO, ...caso.publico.gruposInterpretacao];
}

export function grupoPorId(caso: CasoDefinicao, id: string | undefined): GrupoInterpretacao | undefined {
  if (!id) return undefined;
  return todosGrupos(caso).find((g) => g.id === id);
}
