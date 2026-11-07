/**
 * VERDADE do caso "A junta que falhou" — lida apenas pelo motor de ensaios.
 *
 * Condição real (resumo; a narrativa completa está em gabarito.ts):
 *  - A barra é de um aço com ~0,45% C (não o SAE 1020 declarado).
 *  - Soldada sem preaquecimento, a ZTA de grãos grosseiros do passe de acabamento ficou martensítica
 *    (~480 HV, valor sintético). No reinício do cordão (y ≈ 18–27 mm) há mordedura e pé abrupto.
 *  - Uma trinca a frio (~1 mm) formou-se no pé do lado B, na ZTA; dela partiu uma trinca de fadiga
 *    que cresceu por ~2/3 da seção; o ligamento restante rompeu por sobrecarga (dúctil).
 *  - No pé do lado A, na mesma região, há uma trinca secundária de ~0,4 mm (não propagada).
 *  - Há porosidade real na zona fundida em y ≈ 52–64 mm, sem relação com a falha.
 */
import type { CasoVerdade, Esfera } from '../tipos';
import { gerador } from '../../motor/rng';

/** Poros na zona fundida, gerados de forma fixa (semente constante). */
function gerarPoros(): Esfera[] {
  const r = gerador(5264);
  const poros: Esfera[] = [];
  for (let i = 0; i < 42; i++) {
    const z = 3.2 + r() * 5.6;
    poros.push({
      x: (r() - 0.5) * 3.6,
      y: 52 + r() * 12,
      z,
      r: 0.08 + r() * 0.2,
    });
  }
  return poros;
}

const TODAS_LIMPEZAS = ['como-recebida', 'suave', 'agressiva'] as const;
const AMBAS_LUZES = ['difusa', 'rasante'] as const;
const FRATURAS = ['fratura-A', 'fratura-B'];

export const verdade: CasoVerdade = {
  geometria: {
    tipo: 'junta-topo-v',
    comprimento: 400,
    largura: 80,
    espessura: 12,
    aberturaRaiz: 2,
    anguloBisel: 30,
    sobreposicaoFace: 1.5,
    alturaReforcoFace: 2.5,
    meiaLarguraRaiz: 2.5,
    alturaReforcoRaiz: 1.0,
    reinicio: { y: [18, 27], alturaExtra: 0.9 },
    zta: { gg: 0.6, gf: 0.8, ic: 0.8 },
    profundidadeNaoRevenida: 2.8,
    profundidadeZfAcabamento: 3.5,
    fratura: {
      xPlano: 8.15,
      profundidadeTrechoZta: 1.0,
      afastamentoZta: 0.3,
      yOrigem: [17.5, 26.5],
    },
  },
  zonas: {
    mb: { nome: 'Metal de base', estilo: 'ferrita-perlita', tamanhoGrao: 0.022, fracaoEscura: 0.55, tomMacro: 0.66, inclusoes: 30, dureza: 205 },
    'zta-ic': { nome: 'ZTA intercrítica', estilo: 'ferrita-perlita-parcial', tamanhoGrao: 0.012, fracaoEscura: 0.5, tomMacro: 0.5, inclusoes: 30, dureza: 232 },
    'zta-gf': { nome: 'ZTA de grãos finos', estilo: 'ferrita-perlita', tamanhoGrao: 0.007, fracaoEscura: 0.55, tomMacro: 0.42, inclusoes: 30, dureza: 262 },
    'zta-gg-rev': { nome: 'ZTA de grãos grosseiros reaquecida', estilo: 'martensita-revenida', tamanhoGrao: 0.09, fracaoEscura: 0, tomMacro: 0.36, inclusoes: 10, dureza: 335 },
    'zta-gg-acab': { nome: 'ZTA de grãos grosseiros do último passe', estilo: 'martensita', tamanhoGrao: 0.11, fracaoEscura: 0, tomMacro: 0.3, inclusoes: 10, dureza: 480 },
    'zf-reaq': { nome: 'Zona fundida reaquecida', estilo: 'zf-refinada', tamanhoGrao: 0.012, fracaoEscura: 0.2, tomMacro: 0.6, inclusoes: 4, dureza: 228 },
    'zf-acab': { nome: 'Zona fundida do passe de acabamento', estilo: 'zf-colunar', tamanhoGrao: 0.05, fracaoEscura: 0.1, tomMacro: 0.74, inclusoes: 4, dureza: 255 },
  },
  formas: {
    'trinca-pe-A': {
      tipo: 'trinca',
      largura: 0.006,
      transversal: {
        y: [19, 25],
        pontos: [
          [-9.46, 0.0],
          [-9.43, 0.08],
          [-9.4, 0.16],
          [-9.37, 0.22],
          [-9.34, 0.29],
          [-9.3, 0.35],
          [-9.26, 0.41],
        ],
      },
      longitudinal: {
        x: [-9.6, -9.1],
        pontos: [
          [19, 0.25],
          [20, 0.22],
          [21, 0.3],
          [22, 0.27],
          [23, 0.33],
          [24, 0.24],
          [25, 0.28],
        ],
      },
    },
    poros: { tipo: 'esferas', esferas: gerarPoros() },
  },
  achadosVisuais: [
    {
      id: 'vf-marcas-praia',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'campo',
      regiao: { u: [0, 64], v: [0, 12] },
      regras: [
        { vistas: ['geral', 'detalhe'], iluminacoes: ['rasante'], limpezas: ['suave'], qualidade: 'nitida' },
        { vistas: ['geral', 'detalhe'], iluminacoes: ['rasante'], limpezas: ['como-recebida', 'agressiva'], qualidade: 'tenue' },
        { vistas: ['geral', 'detalhe'], iluminacoes: ['difusa'], limpezas: ['suave'], qualidade: 'tenue' },
      ],
      observacao:
        'Linhas curvas aproximadamente concêntricas, com a concavidade voltada para um ponto da borda superior (face do cordão) perto de y ≈ 22 mm; ocupam cerca de dois terços da seção.',
      observacaoTenue: 'Linhas curvas pouco contrastadas (encobertas ou mal realçadas pela luz), aparentemente concêntricas em relação à borda superior perto de y ≈ 20–25 mm.',
      grupo: 'g-marcas-fratura',
    },
    {
      id: 'vf-zona-lisa',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'campo',
      regiao: { u: [0, 64], v: [0, 12] },
      regras: [
        { vistas: ['geral'], iluminacoes: [...AMBAS_LUZES], limpezas: ['suave'], qualidade: 'nitida' },
        { vistas: ['geral'], iluminacoes: [...AMBAS_LUZES], limpezas: ['como-recebida', 'agressiva'], qualidade: 'tenue' },
      ],
      observacao: 'Região plana e relativamente lisa, de tonalidade mais escura, ocupando cerca de dois terços da seção a partir do lado esquerdo e da borda superior.',
      grupo: 'g-regiao-fratura',
    },
    {
      id: 'vf-zona-final',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'campo',
      regiao: { u: [44, 80], v: [0, 12] },
      regras: [
        { vistas: ['geral', 'detalhe'], iluminacoes: [...AMBAS_LUZES], limpezas: ['como-recebida', 'suave'], qualidade: 'nitida' },
        { vistas: ['geral', 'detalhe'], iluminacoes: [...AMBAS_LUZES], limpezas: ['agressiva'], qualidade: 'tenue' },
      ],
      observacao:
        'Região de textura rugosa e mais clara no lado direito da seção (de y ≈ 45 a 80 mm, mais larga junto à face inferior), com bordas inclinadas (~45°) junto às superfícies.',
      grupo: 'g-regiao-fratura',
    },
    {
      id: 'vf-sem-deformacao',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'campo',
      regiao: { u: [0, 80], v: [0, 12] },
      regras: [{ vistas: ['geral'], iluminacoes: [...AMBAS_LUZES], limpezas: [...TODAS_LIMPEZAS], qualidade: 'nitida' }],
      observacao: 'Sem estricção nem dobramento aparente das partes; a superfície de fratura é aproximadamente perpendicular ao eixo da barra.',
    },
    {
      id: 'vf-origem-escura',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'local',
      regiao: { u: [17.5, 26.5], v: [0, 1.2] },
      marcador: { u: 22, v: 0.6, raio: 3 },
      regras: [
        { vistas: ['detalhe'], iluminacoes: ['difusa'], limpezas: ['suave'], qualidade: 'nitida' },
        { vistas: ['detalhe'], iluminacoes: ['rasante'], limpezas: ['suave'], qualidade: 'tenue' },
      ],
      observacao:
        'Pequena região semielíptica mais escura (~9 mm de comprimento e ~1 mm de profundidade) junto à borda superior, com aspecto granular/facetado, distinta da área lisa ao redor.',
      grupo: 'g-regiao-escura',
    },
    {
      id: 'vf-catracas',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'local',
      regiao: { u: [17, 27], v: [0, 1.5] },
      marcador: { u: 24.2, v: 0.5, raio: 2.5 },
      regras: [
        { vistas: ['detalhe'], iluminacoes: ['rasante'], limpezas: ['suave'], qualidade: 'nitida' },
        { vistas: ['detalhe'], iluminacoes: ['difusa'], limpezas: ['suave'], qualidade: 'tenue' },
      ],
      observacao: 'Pequenos degraus radiais na borda superior, entre y ≈ 18 e 26 mm, separando planos ligeiramente desnivelados.',
      grupo: 'g-degraus',
    },
    {
      id: 'vf-convergencia',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'local',
      regiao: { u: [14, 30], v: [0, 3] },
      marcador: { u: 21, v: 0.3, raio: 3.5 },
      regras: [
        { vistas: ['detalhe'], iluminacoes: ['rasante'], limpezas: ['suave'], qualidade: 'nitida' },
        { vistas: ['detalhe'], iluminacoes: ['rasante'], limpezas: ['como-recebida'], qualidade: 'tenue' },
        { vistas: ['detalhe'], iluminacoes: ['difusa'], limpezas: ['suave'], qualidade: 'tenue' },
        { vistas: ['geral'], iluminacoes: ['rasante'], limpezas: ['suave'], qualidade: 'tenue' },
      ],
      observacao: 'As linhas curvas convergem para a borda superior, junto ao pé do cordão do lado B; no ponto de convergência não há cavidade interna visível.',
    },
    {
      id: 'vf-sem-pites',
      estacao: 'visual',
      superficies: FRATURAS,
      modo: 'campo',
      regiao: { u: [12, 32], v: [0, 4] },
      regras: [{ vistas: ['detalhe'], iluminacoes: [...AMBAS_LUZES], limpezas: ['suave'], qualidade: 'nitida' }],
      observacao: 'Junto à borda superior não há cavidades de corrosão nem camada espessa de produtos de corrosão; a oxidação é leve e uniforme.',
    },
    {
      id: 'vc-reinicio',
      estacao: 'visual',
      superficies: ['face-cordao'],
      modo: 'local',
      regiao: { u: [-10, 10], v: [18, 27] },
      marcador: { u: 0, v: 22.5, raio: 7 },
      regras: [{ vistas: ['geral', 'detalhe'], iluminacoes: [...AMBAS_LUZES], limpezas: [...TODAS_LIMPEZAS], qualidade: 'nitida' }],
      observacao: 'Entre y ≈ 18 e 27 mm o cordão é mais alto e irregular, com sobreposição de material e pé mais abrupto.',
      grupo: 'g-geometria-pe',
    },
    {
      id: 'vc-mordedura',
      estacao: 'visual',
      superficies: ['face-cordao'],
      modo: 'local',
      regiao: { u: [-10.5, -8.5], v: [14, 30] },
      marcador: { u: -9.7, v: 22, raio: 3 },
      regras: [
        { vistas: ['detalhe'], iluminacoes: ['rasante'], limpezas: ['suave', 'agressiva'], qualidade: 'nitida' },
        { vistas: ['detalhe'], iluminacoes: ['rasante'], limpezas: ['como-recebida'], qualidade: 'tenue' },
        { vistas: ['detalhe'], iluminacoes: ['difusa'], limpezas: ['suave', 'agressiva'], qualidade: 'tenue' },
      ],
      observacao: 'Sulco contínuo junto ao pé do cordão do lado A, com profundidade aparente de ~0,5 mm, ao longo de ~15 mm (y ≈ 14–30 mm).',
      grupo: 'g-geometria-pe',
    },
    {
      id: 'vc-linha-pe-A',
      estacao: 'visual',
      superficies: ['face-cordao'],
      modo: 'local',
      regiao: { u: [-10, -9], v: [19, 25] },
      marcador: { u: -9.45, v: 20.5, raio: 1.6 },
      regras: [{ vistas: ['detalhe'], iluminacoes: ['rasante'], limpezas: ['suave'], qualidade: 'tenue' }],
      observacao: 'Linha fina e escura, descontínua, acompanhando o pé do cordão do lado A por ~6 mm (y ≈ 19–25 mm).',
      grupo: 'g-linha-fina',
    },
    {
      id: 'vc-respingos',
      estacao: 'visual',
      superficies: ['face-cordao'],
      modo: 'campo',
      regiao: { u: [-35, 35], v: [0, 80] },
      regras: [{ vistas: ['geral'], iluminacoes: [...AMBAS_LUZES], limpezas: [...TODAS_LIMPEZAS], qualidade: 'nitida' }],
      observacao: 'Pequenas gotas metálicas aderidas à superfície ao lado do cordão.',
    },
    {
      id: 'vc-fratura-pe',
      estacao: 'visual',
      superficies: ['face-cordao'],
      modo: 'campo',
      regiao: { u: [8, 11], v: [0, 80] },
      regras: [{ vistas: ['geral'], iluminacoes: [...AMBAS_LUZES], limpezas: [...TODAS_LIMPEZAS], qualidade: 'nitida' }],
      observacao: 'A separação ocorreu rente ao pé do cordão do lado B, acompanhando-o por toda a largura.',
    },
    {
      id: 'vc-pintura',
      estacao: 'visual',
      superficies: ['face-cordao'],
      modo: 'campo',
      regiao: { u: [-35, 35], v: [0, 80] },
      regras: [{ vistas: ['geral'], iluminacoes: [...AMBAS_LUZES], limpezas: ['como-recebida'], qualidade: 'nitida' }],
      observacao: 'Pintura íntegra na maior parte da superfície, descascada só a poucos milímetros da fratura; os pés do cordão estão cobertos de tinta.',
    },
    {
      id: 'vr-raiz',
      estacao: 'visual',
      superficies: ['raiz-cordao'],
      modo: 'campo',
      regiao: { u: [-5, 5], v: [0, 80] },
      regras: [{ vistas: ['geral', 'detalhe'], iluminacoes: [...AMBAS_LUZES], limpezas: [...TODAS_LIMPEZAS], qualidade: 'nitida' }],
      observacao: 'Cordão de raiz contínuo e regular ao longo de toda a largura, sem falta de penetração visível pela superfície.',
    },
    {
      id: 'vm-marcacao',
      estacao: 'visual',
      superficies: ['metal-base'],
      modo: 'local',
      regiao: { u: [-130, -110], v: [34, 46] },
      marcador: { u: -120, v: 40, raio: 7 },
      regras: [
        { vistas: ['detalhe'], iluminacoes: [...AMBAS_LUZES], limpezas: ['suave', 'agressiva'], qualidade: 'nitida' },
        { vistas: ['detalhe'], iluminacoes: [...AMBAS_LUZES], limpezas: ['como-recebida'], qualidade: 'tenue' },
      ],
      observacao: 'Marcação estampada legível: corrida "C-48731".',
      observacaoTenue: 'Marcação estampada parcialmente encoberta pela tinta: "C-48?31".',
    },
    {
      id: 'vm-superficie',
      estacao: 'visual',
      superficies: ['metal-base'],
      modo: 'campo',
      regiao: { u: [-195, -35], v: [0, 80] },
      regras: [{ vistas: ['geral'], iluminacoes: [...AMBAS_LUZES], limpezas: [...TODAS_LIMPEZAS], qualidade: 'nitida' }],
      observacao: 'Pintura com desgaste localizado; onde falta tinta há oxidação superficial leve, sem perda de espessura nem pites visíveis a olho nu.',
    },
  ],
  achadosMetalografia: [
    {
      id: 'mg-macro-junta',
      estacao: 'metalografia',
      modo: 'campo',
      orientacoes: ['transversal'],
      caixa: { x: [-3, 3] },
      regras: [
        { ampliacoes: [10], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [10], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao:
        'Cordão em V com penetração total nesta seção; contorno da zona fundida nítido, sem falta de fusão aparente; faixa de tonalidade diferente, com ~2 mm de largura, contornando o cordão.',
    },
    {
      id: 'mg-mb-perlita',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['mb'],
      regras: [
        { ampliacoes: [100, 500], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [100, 500], ataques: ['nital-30s'], qualidade: 'comprometida' },
      ],
      observacao: 'Grãos claros equiaxiais e regiões escuras (lamelares a 500×); a área escura ocupa aproximadamente 50–60% do campo.',
      grupo: 'g-fracao-perlita',
    },
    {
      id: 'mg-zta-grosseira',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['zta-gg-acab', 'zta-gg-rev'],
      regras: [
        { ampliacoes: [100], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [100], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao: 'Faixa de grãos grosseiros e escuros adjacente à linha de fusão, com estrutura interna acicular pouco resolvida nesta ampliação.',
      grupo: 'g-micro-campo',
    },
    {
      id: 'mg-zta-martensita',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['zta-gg-acab'],
      regras: [
        { ampliacoes: [500], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [500], ataques: ['nital-30s'], qualidade: 'comprometida' },
      ],
      observacao: 'Grãos grosseiros (contornos de grão austenítico prévio de ~0,1 mm) com estrutura interna em ripas/agulhas paralelas, sem ferrita poligonal visível.',
      grupo: 'g-micro-campo',
    },
    {
      id: 'mg-zta-revenida',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['zta-gg-rev'],
      regras: [
        { ampliacoes: [500], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [500], ataques: ['nital-30s'], qualidade: 'comprometida' },
      ],
      observacao: 'Grãos grosseiros com estrutura em ripas de contraste mais difuso e pontilhado fino no interior.',
      grupo: 'g-micro-campo',
    },
    {
      id: 'mg-zta-fina',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['zta-gf', 'zta-ic'],
      regras: [
        { ampliacoes: [100, 500], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [100, 500], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao: 'Grãos claros e escuros muito finos, menores que os do metal de base.',
      grupo: 'g-micro-campo',
    },
    {
      id: 'mg-zf',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['zf-acab'],
      regras: [
        { ampliacoes: [100, 500], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [100, 500], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao: 'Grãos colunares alongados, contornados por faixas claras, com interior de agulhas finas entrelaçadas.',
      grupo: 'g-micro-campo',
    },
    {
      id: 'mg-zf-reaq',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['zf-reaq'],
      regras: [
        { ampliacoes: [100, 500], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [100, 500], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao: 'Grãos finos e equiaxiais, majoritariamente claros, com pequenas regiões escuras.',
      grupo: 'g-micro-campo',
    },
    {
      id: 'mg-trinca-sec-A',
      estacao: 'metalografia',
      modo: 'local',
      formaId: 'trinca-pe-A',
      linhaFina: true,
      regras: [
        { ampliacoes: [500], ataques: ['nenhum', 'nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [100], ataques: ['nenhum', 'nital-5s'], qualidade: 'tenue' },
        { ampliacoes: [500], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao: 'Trinca fina partindo da superfície no pé do cordão do lado A, com ~0,4 mm de profundidade e trajeto sinuoso.',
      grupo: 'g-linhas-micro',
    },
    {
      id: 'mg-trinca-intergranular',
      estacao: 'metalografia',
      modo: 'campo',
      orientacoes: ['transversal'],
      caixa: { x: [-9.7, -9.1], y: [19, 25], z: [0, 0.45] },
      regras: [{ ampliacoes: [500], ataques: ['nital-5s'], qualidade: 'nitida' }],
      observacao: 'Com ataque, o trajeto da trinca do pé do lado A acompanha os contornos dos grãos grosseiros.',
      grupo: 'g-borda',
      requer: 'mg-trinca-sec-A',
    },
    {
      id: 'mg-trajeto-borda',
      estacao: 'metalografia',
      modo: 'campo',
      orientacoes: ['transversal'],
      caixa: { x: [7.9, 9.9], y: [17.5, 26.5], z: [0, 1.0] },
      regras: [
        { ampliacoes: [500], ataques: ['nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [100], ataques: ['nital-5s'], qualidade: 'tenue' },
        { ampliacoes: [500], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao:
        'Junto à face, o perfil da fratura é serrilhado e acompanha contornos de grãos grosseiros vizinhos à linha de fusão no primeiro ~1 mm.',
      grupo: 'g-borda',
    },
    {
      id: 'mg-borda-transgranular',
      estacao: 'metalografia',
      modo: 'campo',
      orientacoes: ['transversal'],
      caixa: { x: [7.9, 9.9], z: [1.2, 12] },
      regras: [{ ampliacoes: [100, 500], ataques: ['nital-5s'], qualidade: 'nitida' }],
      observacao: 'Perfil da fratura relativamente plano, cortando os grãos sem seguir contornos.',
      grupo: 'g-borda',
    },
    {
      id: 'mg-poros',
      estacao: 'metalografia',
      modo: 'local',
      formaId: 'poros',
      regras: [
        { ampliacoes: [10, 100, 500], ataques: ['nenhum', 'nital-5s'], qualidade: 'nitida' },
        { ampliacoes: [10, 100, 500], ataques: ['nital-30s'], qualidade: 'tenue' },
      ],
      observacao: 'Cavidades arredondadas, de contorno liso (≈0,1–0,5 mm), no interior da zona fundida.',
      grupo: 'g-cavidades',
    },
    {
      id: 'mg-inclusoes',
      estacao: 'metalografia',
      modo: 'campo',
      zonas: ['mb', 'zta-ic', 'zta-gf'],
      regras: [
        { ampliacoes: [100, 500], ataques: ['nenhum'], qualidade: 'nitida' },
        { ampliacoes: [500], ataques: ['nital-5s'], qualidade: 'tenue' },
      ],
      observacao: 'Partículas cinzentas pequenas e alongadas na direção do comprimento da barra.',
      grupo: 'g-inclusoes',
    },
  ],
  achadosDureza: [
    { id: 'hv-pico-acabamento', estacao: 'microdureza', leitura: 'maximo', zonas: ['zta-gg-acab'], hvMin: 380, grupo: 'g-dureza-pico' },
    { id: 'hv-pico-moderado', estacao: 'microdureza', leitura: 'maximo', zonas: ['zta-gg-acab', 'zta-gg-rev', 'zta-gf'], grupo: 'g-dureza-pico' },
    { id: 'hv-maximo-fora-zta', estacao: 'microdureza', leitura: 'maximo', zonas: ['mb', 'zta-ic', 'zf-acab', 'zf-reaq'], grupo: 'g-dureza-pico' },
    { id: 'hv-mb', estacao: 'microdureza', leitura: 'media-afastada', zonas: ['mb'], grupo: 'g-dureza-mb' },
  ],
  superficieFratura: {
    origem: { u: 22, v: 0 },
    raioU: 42,
    raioV: 14,
    regiaoEscura: { u: [17.5, 26.5], profundidade: 1.0 },
    marcasPraia: [0.16, 0.27, 0.38, 0.5, 0.62, 0.74, 0.86, 0.95],
    catracas: [18.6, 20.9, 24.2, 25.8],
    larguraLabios: 0.8,
  },
  superficieExterna: {
    marcacao: { x: -120, y: 40, texto: 'C-48731' },
    mordeduraA: { y: [14, 30] },
    linhaPeA: { y: [19, 25] },
  },
  variacaoFase: { 'HV0.1': 0.16, 'HV0.5': 0.06, HV1: 0.03 },
};
