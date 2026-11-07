/**
 * Parte PÚBLICA do caso "A junta que falhou": tudo aqui pode aparecer na interface.
 * Cenário fictício. Nomes de empresas, números de corrida e valores são inventados para o jogo.
 */
import type { CasoPublico } from '../tipos';

export const publico: CasoPublico = {
  titulo: 'A junta que falhou',
  subtitulo: 'Braço tensor de peneira vibratória rompido junto à solda',
  ficha: {
    peca: 'Braço tensor BT-07 da peneira vibratória PV-3 (beneficiamento de agregados).',
    materialDeclarado: 'Aço SAE 1020 laminado a quente (conforme desenho e certificado).',
    geometria: 'Barra chata 80 × 12 mm, ~400 mm de comprimento, com emenda central por solda de topo em V (60°), penetração total.',
    processo: 'Corte e chanfro; soldagem semiautomática com arame tubular em 3 passes; pintura de acabamento.',
    condicoesUso: 'Flexão alternada imposta pela vibração da peneira. Ambiente externo, com poeira e umidade ocasional, à temperatura ambiente.',
  },
  historico: [
    'Após cerca de 8 meses de operação, o braço rompeu junto à solda durante o turno. Não houve feridos.',
    'O operador não percebeu ruído anormal antes da ruptura.',
    'As duas partes foram recolhidas e entregues ao laboratório sem limpeza. A parte A contém o cordão; o fragmento B é o restante da barra.',
    'Outros dois braços do mesmo lote continuam em operação.',
  ],
  objetivo:
    'Propor o mecanismo de falha, a causa provável e os fatores contribuintes, com base em evidências; indicar limitações e próximos ensaios para que a empresa decida o que fazer com os braços ainda em operação.',
  recursos: { orcamento: 3000, tempoH: 30 },
  desenho: {
    comprimento: 400,
    largura: 80,
    espessura: 12,
    meiaLarguraCordao: 9.4,
    xFraturaFace: 9.7,
  },
  superficies: [
    {
      id: 'fratura-A',
      nome: 'Superfície de fratura — parte A',
      tipo: 'fratura',
      parte: 'A',
      descricao: 'Face da fratura na parte que contém o cordão.',
      eixoU: { rotulo: 'y — largura (mm)', faixa: [-2, 82] },
      eixoV: { rotulo: 'z — profundidade a partir da face do cordão (mm)', faixa: [-2, 14] },
    },
    {
      id: 'fratura-B',
      nome: 'Superfície de fratura — fragmento B',
      tipo: 'fratura',
      parte: 'B',
      descricao: 'Face correspondente no fragmento B (mesma orientação de y da parte A).',
      eixoU: { rotulo: 'y — largura (mm)', faixa: [-2, 82] },
      eixoV: { rotulo: 'z — profundidade a partir da face do cordão (mm)', faixa: [-2, 14] },
    },
    {
      id: 'face-cordao',
      nome: 'Face do cordão e pés da solda',
      tipo: 'externa',
      parte: 'A',
      descricao: 'Vista de cima da região do cordão, lado do acabamento.',
      eixoU: { rotulo: 'x — distância ao eixo da solda (mm)', faixa: [-35, 35] },
      eixoV: { rotulo: 'y — largura (mm)', faixa: [-2, 82] },
    },
    {
      id: 'raiz-cordao',
      nome: 'Lado da raiz',
      tipo: 'externa',
      parte: 'A',
      descricao: 'Vista de baixo da região do cordão, lado da raiz.',
      eixoU: { rotulo: 'x — distância ao eixo da solda (mm)', faixa: [-35, 35] },
      eixoV: { rotulo: 'y — largura (mm)', faixa: [-2, 82] },
    },
    {
      id: 'metal-base',
      nome: 'Metal de base e marcações',
      tipo: 'externa',
      parte: 'A',
      descricao: 'Superfície da barra afastada da solda, onde fica a marcação estampada.',
      eixoU: { rotulo: 'x — distância ao eixo da solda (mm)', faixa: [-195, -35] },
      eixoV: { rotulo: 'y — largura (mm)', faixa: [-2, 82] },
    },
  ],
  documentos: [
    {
      id: 'certificado',
      titulo: 'Certificado do material',
      origem: 'Setor de compras (fornecedor da barra)',
      fatos: [
        {
          achadoId: 'doc-certificado',
          texto: 'Aço declarado: SAE 1020 laminado a quente. Composição informada: C 0,18%; Mn 0,62%; Si 0,20%; P 0,018%; S 0,012%.',
        },
        { achadoId: 'doc-corrida', texto: 'Número da corrida no certificado: C-48213.' },
      ],
    },
    {
      id: 'registro-soldagem',
      titulo: 'Registro de fabricação da junta',
      origem: 'Caldeiraria terceirizada',
      fatos: [
        { achadoId: 'doc-processo', texto: 'Soldagem semiautomática com arame tubular e proteção gasosa, em 3 passes (raiz, enchimento e acabamento).' },
        {
          achadoId: 'doc-sem-preaquecimento',
          texto: 'Preaquecimento: não aplicado. Temperatura ambiente anotada: 12 °C. Temperatura entre passes: não registrada.',
        },
        {
          achadoId: 'doc-consumivel',
          texto: 'Arame tubular armazenado em almoxarifado sem controle de umidade; tempo de exposição da bobina não registrado. Limpeza do chanfro: não registrada.',
        },
        {
          achadoId: 'doc-interrupcao',
          texto: 'Observação do soldador: o passe de acabamento foi interrompido uma vez para troca de bobina; posição da retomada não registrada.',
        },
      ],
    },
    {
      id: 'historico-operacao',
      titulo: 'Histórico de operação e manutenção',
      origem: 'Manutenção da unidade',
      fatos: [
        { achadoId: 'doc-ciclico', texto: 'A peneira opera ~16 h/dia; o motor vibrador gira a ~960 rpm (~16 Hz). O braço trabalha em flexão alternada.' },
        {
          achadoId: 'doc-lote-anterior',
          texto: 'Braços do lote anterior (mesmo desenho, outro fornecedor de barra) operaram mais de 3 anos sem falha.',
        },
        {
          achadoId: 'doc-impacto',
          texto: 'Há ~2 meses, uma ferramenta caiu sobre a extremidade oposta do braço (a ~150 mm da junta); nenhuma marca foi registrada.',
        },
        { achadoId: 'doc-inspecao', texto: 'Inspeção visual trimestral, sem remoção da pintura; a última, há 3 meses, não registrou trincas.' },
      ],
    },
    {
      id: 'desenho',
      titulo: 'Desenho de fabricação BT-07 rev. B',
      origem: 'Engenharia',
      fatos: [
        { achadoId: 'doc-desenho-material', texto: 'Material especificado: aço SAE 1020. Solda de topo em V, penetração total.' },
        {
          achadoId: 'doc-desenho-acabamento',
          texto: 'Não há requisito de acabamento do pé do cordão nem de ensaio não destrutivo após a soldagem.',
        },
      ],
    },
  ],
  hipoteses: [
    {
      id: 'mec-fadiga',
      categoria: 'mecanismo',
      titulo: 'Fadiga',
      descricao: 'Uma trinca cresceu progressivamente sob carregamento cíclico até a ruptura final do ligamento restante.',
    },
    {
      id: 'mec-sobrecarga',
      categoria: 'mecanismo',
      titulo: 'Sobrecarga única',
      descricao: 'A peça rompeu de uma vez, por uma carga acima da sua resistência, com fratura dúctil.',
    },
    {
      id: 'mec-fragil',
      categoria: 'mecanismo',
      titulo: 'Fratura frágil em evento único',
      descricao: 'Ruptura súbita por clivagem, sem crescimento prévio de trinca.',
    },
    {
      id: 'mec-corrosao',
      categoria: 'mecanismo',
      titulo: 'Trincamento assistido pelo meio',
      descricao: 'Corrosão sob tensão ou corrosão-fadiga, com papel decisivo do ambiente.',
    },
    {
      id: 'causa-trinca-fabricacao',
      categoria: 'causa',
      titulo: 'Trinca de fabricação no pé da solda',
      descricao: 'Uma trinca formada durante ou logo após a soldagem, numa região endurecida da ZTA, serviu de ponto de partida.',
    },
    {
      id: 'causa-impacto',
      categoria: 'causa',
      titulo: 'Dano por impacto na manutenção',
      descricao: 'O impacto registrado há dois meses iniciou a falha.',
    },
    {
      id: 'causa-descontinuidade-interna',
      categoria: 'causa',
      titulo: 'Descontinuidade interna da solda',
      descricao: 'Poros, inclusões de escória ou falta de fusão no interior do cordão iniciaram a trinca.',
    },
    {
      id: 'causa-subdimensionamento',
      categoria: 'causa',
      titulo: 'Subdimensionamento do projeto',
      descricao: 'As tensões de serviço são altas demais para a seção, mesmo com material e solda adequados.',
    },
    {
      id: 'fator-material',
      categoria: 'fator',
      titulo: 'Material diferente do especificado',
      descricao: 'Aço com teor de carbono maior que o do SAE 1020 declarado, mais temperável.',
    },
    {
      id: 'fator-geometria',
      categoria: 'fator',
      titulo: 'Concentração de tensões no pé do cordão',
      descricao: 'Mordedura, reinício do cordão ou reforço irregular elevando a tensão local.',
    },
    {
      id: 'fator-ambiente',
      categoria: 'fator',
      titulo: 'Ambiente corrosivo',
      descricao: 'Umidade e contaminantes acelerando o dano.',
    },
    {
      id: 'fator-procedimento',
      categoria: 'fator',
      titulo: 'Procedimento de soldagem inadequado ao material',
      descricao: 'Sem preaquecimento e sem controle de hidrogênio para um aço mais temperável.',
    },
    {
      id: 'fator-inspecao',
      categoria: 'fator',
      titulo: 'Inspeção periódica ineficaz',
      descricao: 'A inspeção em serviço não detectaria trincas pequenas sob a pintura.',
    },
  ],
  gruposInterpretacao: [
    {
      id: 'g-regiao-fratura',
      pergunta: 'Como interpretar esta região da fratura?',
      opcoes: [
        { id: 'propagacao', texto: 'Região de propagação lenta e progressiva de trinca' },
        { id: 'final-ductil', texto: 'Ruptura final do ligamento restante por sobrecarga, com lábios de cisalhamento' },
        { id: 'clivagem', texto: 'Fratura frágil por clivagem em um único evento' },
        { id: 'corrosao', texto: 'Região atacada por corrosão' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
    {
      id: 'g-regiao-escura',
      pergunta: 'O que a região escura junto à borda pode ser?',
      opcoes: [
        { id: 'trinca-preexistente', texto: 'Trinca pré-existente, oxidada antes da propagação seguinte' },
        { id: 'pite', texto: 'Pite ou produto de corrosão localizada' },
        { id: 'mancha', texto: 'Mancha de limpeza ou manuseio (artefato)' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
    {
      id: 'g-degraus',
      pergunta: 'O que esses degraus indicam?',
      opcoes: [
        { id: 'catracas', texto: 'Marcas de catraca: várias origens próximas que se uniram' },
        { id: 'labios', texto: 'Lábios de cisalhamento da ruptura final' },
        { id: 'riscos', texto: 'Riscos de manuseio' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
    {
      id: 'g-geometria-pe',
      pergunta: 'Como classificar esta feição do cordão?',
      opcoes: [
        { id: 'mordedura', texto: 'Mordedura: entalhe junto ao pé do cordão (concentrador de tensões)' },
        { id: 'reinicio', texto: 'Reinício do cordão (parada e retomada), com geometria irregular' },
        { id: 'trinca', texto: 'Trinca' },
        { id: 'sem-efeito', texto: 'Irregularidade sem efeito relevante' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
    {
      id: 'g-linha-fina',
      pergunta: 'O que é essa linha fina?',
      opcoes: [
        { id: 'trinca-superficial', texto: 'Trinca superficial' },
        { id: 'sombra', texto: 'Sombra do sulco da mordedura' },
        { id: 'risco', texto: 'Risco de manuseio' },
        { id: 'nao-afirmar', texto: 'Não é possível afirmar apenas pela inspeção visual' },
      ],
    },
    {
      id: 'g-fracao-perlita',
      pergunta: 'O que a fração de constituinte escuro sugere?',
      opcoes: [
        { id: 'baixo-c', texto: 'Compatível com aço de ~0,2% C, como o declarado' },
        { id: 'medio-c', texto: 'Compatível com aço de ~0,4–0,5% C, se a estrutura estiver próxima do equilíbrio' },
        { id: 'nao-estimar', texto: 'Não é possível estimar o teor de carbono por esta imagem' },
      ],
    },
    {
      id: 'g-micro-campo',
      pergunta: 'Que constituintes você identifica?',
      opcoes: [
        { id: 'ferrita-perlita', texto: 'Ferrita e perlita' },
        { id: 'martensita-bainita', texto: 'Martensita e/ou bainita (produtos de resfriamento rápido)' },
        { id: 'martensita-revenida', texto: 'Martensita revenida (reaquecida por passes seguintes)' },
        { id: 'colunar', texto: 'Estrutura de solidificação (grãos colunares) da zona fundida' },
        { id: 'refinada', texto: 'Estrutura refinada por reaquecimento' },
        { id: 'nao-identificar', texto: 'Não é possível identificar com esta imagem' },
      ],
    },
    {
      id: 'g-borda',
      pergunta: 'Como descrever o trajeto?',
      opcoes: [
        { id: 'intergranular', texto: 'Predominantemente intergranular (ao longo de contornos de grão)' },
        { id: 'transgranular', texto: 'Transgranular (atravessando os grãos)' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
    {
      id: 'g-inclusoes',
      pergunta: 'O que são essas partículas?',
      opcoes: [
        { id: 'inclusoes', texto: 'Inclusões não metálicas alongadas pela laminação' },
        { id: 'poros', texto: 'Poros' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
    {
      id: 'g-dureza-pico',
      pergunta: 'O que esse valor máximo permite dizer?',
      opcoes: [
        {
          id: 'zta-endurecida',
          texto: 'Indica região endurecida, compatível com produtos de resfriamento rápido; sozinho, não prova fragilidade',
        },
        { id: 'prova-fragil', texto: 'Prova que a junta era frágil e explica sozinho a falha' },
        { id: 'normal', texto: 'Valor esperado em qualquer junta soldada; não é relevante' },
        { id: 'comprometido', texto: 'Valor possivelmente afetado pela configuração do ensaio' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
    {
      id: 'g-dureza-mb',
      pergunta: 'O que a dureza do metal de base sugere?',
      opcoes: [
        {
          id: 'acima-baixo-c',
          texto: 'Acima do que se esperaria para aço de baixo carbono laminado (indício, não prova, de material diferente)',
        },
        { id: 'compativel-baixo-c', texto: 'Compatível com o aço declarado' },
        { id: 'nao-sei', texto: 'Não sei interpretar com os dados atuais' },
      ],
    },
  ],
  relatorio: {
    limitacoes: [
      { id: 'lim-quimica', texto: 'A composição química não foi medida: a suspeita de material diferente vem da microestrutura e da dureza.' },
      { id: 'lim-mo-martensita', texto: 'A microscopia óptica não distingue com segurança martensita de bainita; a identificação é provável, não confirmada.' },
      { id: 'lim-mev', texto: 'Não houve fractografia em MEV: estrias de fadiga e micromecanismos não foram observados diretamente.' },
      { id: 'lim-hidrogenio', texto: 'O hidrogênio não foi medido; a trinca a frio é inferida pela morfologia e pelo contexto.' },
      { id: 'lim-planos', texto: 'Cada corte é um plano isolado; outras regiões do cordão podem ter descontinuidades não observadas.' },
      { id: 'lim-sintetico', texto: 'Dados sintéticos e imagens esquemáticas: a conclusão vale para o exercício e não substitui ensaios reais.' },
      { id: 'lim-dureza-prova', texto: 'A dureza elevada na ZTA comprova, sozinha, que a fratura foi frágil.' },
      { id: 'lim-visual-interno', texto: 'A inspeção visual externa demonstrou que não há defeitos internos na solda.' },
      { id: 'lim-dureza-tenacidade', texto: 'Os valores de dureza permitem calcular diretamente a tenacidade da ZTA.' },
    ],
    proximosEnsaios: [
      { id: 'ens-quimica', texto: 'Análise química do metal de base (por exemplo, espectrometria de emissão óptica).' },
      { id: 'ens-mev', texto: 'Fractografia em microscópio eletrônico de varredura (MEV) na região da origem.' },
      { id: 'ens-end-irmas', texto: 'Ensaio não destrutivo (líquido penetrante ou partículas magnéticas) nos pés de solda dos braços em operação.' },
      { id: 'ens-procedimento', texto: 'Revisão e qualificação do procedimento de soldagem (preaquecimento, controle de hidrogênio).' },
      { id: 'ens-charpy', texto: 'Ensaio de impacto Charpy na ZTA de uma junta reproduzida com o mesmo material e procedimento.' },
      { id: 'ens-tracao', texto: 'Ensaio de tração do metal de base.' },
      { id: 'ens-drx', texto: 'Difração de raios X da superfície pintada.' },
      { id: 'ens-dureza-carga', texto: 'Repetir a microdureza com carga maior para confirmar a fragilidade.' },
    ],
  },
  tutorial: [
    {
      titulo: 'Bem-vindo ao Laboratório de Falhas',
      texto:
        'Você vai investigar uma peça que falhou em serviço. As imagens são esquemáticas e os dados são sintéticos: a atividade treina o raciocínio de investigação e não certifica competência prática de laboratório.',
    },
    {
      titulo: 'A bancada',
      aba: 'bancada',
      texto:
        'Examine a peça: clique nas regiões para ver a posição e as coordenadas. Leia a ficha e o histórico. Documentos extras podem ser solicitados; custam só tempo.',
    },
    {
      titulo: 'Hipóteses antes dos ensaios',
      aba: 'hipoteses',
      texto:
        'Registre hipóteses e, para cada uma, o que você esperaria observar se ela fosse verdadeira e o que a enfraqueceria. Selecionar uma hipótese não revela se ela está certa.',
    },
    {
      titulo: 'Três estações de ensaio',
      aba: 'ensaios',
      texto:
        'Cada estação mostra custo, tempo e finalidade. O equipamento certo não basta: o local amostrado, a preparação e os parâmetros decidem se o dado é útil. Cortes e limpezas são irreversíveis.',
    },
    {
      titulo: 'O caderno de investigação',
      texto:
        'O caderno (à direita) guarda cada resultado com a identificação da amostra e os parâmetros. Registre observações (o que se vê) separadas das interpretações (o que se conclui) e associe cada evidência às hipóteses.',
    },
    {
      titulo: 'Relatório e devolutiva',
      aba: 'relatorio',
      texto:
        'No relatório, proponha mecanismo, causa e fatores, cite evidências e reconheça limitações. "Dados insuficientes" é aceito quando justificado. A solução só aparece na devolutiva, depois de concluir.',
    },
  ],
  dicas: {
    bancada: [
      'Separe o que é fato registrado (ficha, documentos) do que é suposição.',
      'Observe onde a peça rompeu em relação ao cordão: no pé, no centro da solda ou no metal de base?',
      'Documentos custam tempo, mas podem orientar onde amostrar.',
    ],
    hipoteses: [
      'Mecanismo descreve COMO a peça rompeu; causa descreve POR QUE a falha começou ali; fatores contribuintes facilitaram ou aceleraram o processo.',
      'Hipóteses concorrentes ajudam a escolher ensaios que as diferenciem.',
    ],
    visual: [
      'Documente a superfície de fratura antes de cortar: o corte destrói a região.',
      'Limpeza agressiva pode apagar detalhes finos de forma permanente.',
      'Luz rasante realça o relevo; luz difusa ajuda a comparar tonalidades.',
      'Olhar a superfície não mostra o interior da peça.',
    ],
    metalografia: [
      'Escolha o corte pela pergunta: passando pela origem? longe dela, para comparar? no metal de base, como referência?',
      'O corte transversal à junta mostra metal de base, ZTA e zona fundida lado a lado.',
      'Sem ataque, trincas e poros aparecem com bom contraste; com ataque, aparece a microestrutura.',
      'Pular etapas de lixamento ou polir pouco deixa riscos e arrancamentos que podem imitar defeitos.',
    ],
    microdureza: [
      'Regra prática adotada neste jogo: ≥ 3 diagonais entre indentações e ≥ 2,5 diagonais até a borda. Confira a norma aplicável com o professor.',
      'Regiões estreitas exigem espaçamento pequeno — e, para isso, carga menor.',
      'Em juntas multipasse, a ZTA do último passe não é reaquecida pelos passes seguintes: a profundidade do trajeto importa.',
      'Dureza é indício: não se converte diretamente em resistência ou em fragilidade.',
    ],
    relatorio: [
      'Cite evidências do caderno para cada conclusão.',
      'Uma conclusão correta sem evidência vale pouco.',
      'Diga o que seus ensaios não mostram.',
    ],
  },
};
