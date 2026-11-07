/**
 * GABARITO do caso "A junta que falhou" — lido apenas pela avaliação e pela devolutiva.
 *
 * Distinção usada neste caso (revisar com o professor):
 *  - Mecanismo: como a peça rompeu fisicamente → fadiga, com ruptura final dúctil.
 *  - Causa provável: a condição que fez a falha começar ali → trinca de fabricação (trinca a frio)
 *    no pé da solda, numa ZTA endurecida.
 *  - Fatores contribuintes: o que tornou essa condição possível ou acelerou o processo → material
 *    mais temperável que o especificado, procedimento sem preaquecimento/controle de hidrogênio,
 *    concentração de tensões no reinício do cordão e inspeção incapaz de detectar a trinca.
 */
import type { Gabarito } from '../tipos';

export const gabarito: Gabarito = {
  resumo: [
    'A barra foi fabricada com um aço de carbono mais alto (~0,45% C) do que o SAE 1020 especificado — a marcação da corrida na peça não coincide com o certificado.',
    'Soldada sem preaquecimento e sem controle de hidrogênio, a ZTA de grãos grosseiros do último passe resfriou rápido e formou martensita dura. No reinício do cordão (y ≈ 18–27 mm), com mordedura e pé abrupto, surgiu uma trinca a frio de ~1 mm no pé do lado B (e outra, menor, no lado A).',
    'Em serviço, a flexão alternada a ~16 Hz fez uma trinca de fadiga crescer a partir dessa trinca por cerca de dois terços da seção. O ligamento restante rompeu por sobrecarga, de forma dúctil.',
    'O impacto relatado, a porosidade da solda e o ambiente não explicam as evidências.',
  ],
  mecanismo: {
    correta: 'mec-fadiga',
    suficiencia: [{ achados: ['vf-marcas-praia', 'vf-zona-lisa', 'vf-zona-final', 'vf-catracas', 'vf-convergencia'], minimo: 2 }],
    explicacao:
      'Marcas de praia convergindo para uma origem na borda, uma zona lisa extensa e uma zona final rugosa com lábios de cisalhamento indicam crescimento progressivo de trinca sob carregamento cíclico, seguido de ruptura final por sobrecarga. Estrias de fadiga (escala microscópica) não foram observadas: exigiriam MEV.',
  },
  causa: {
    correta: 'causa-trinca-fabricacao',
    suficiencia: [
      { achados: ['vf-origem-escura', 'mg-trinca-sec-A', 'mg-trajeto-borda', 'mg-trinca-intergranular'], minimo: 1 },
      { achados: ['mg-zta-martensita', 'hv-pico-acabamento', 'doc-sem-preaquecimento', 'mg-zta-grosseira'], minimo: 1 },
    ],
    explicacao:
      'A região escura e facetada na origem (oxidada antes da propagação), o trajeto intergranular na ZTA de grãos grosseiros junto à origem e a trinca secundária no pé oposto, na mesma faixa de y, indicam uma trinca formada na fabricação. A martensita e o pico de dureza junto à face mostram uma ZTA suscetível. O hidrogênio não foi medido: a classificação como "trinca a frio" é inferência.',
  },
  fatores: {
    'fator-material': {
      verdadeiro: true,
      suficiencia: [{ achados: ['mg-mb-perlita', 'hv-mb', 'vm-marcacao'], minimo: 1 }],
      explicacao:
        'Fração de perlita de ~55% no metal de base e dureza de ~205 HV sugerem um aço de ~0,4–0,5% C; a marcação da corrida difere do certificado. Só uma análise química confirmaria.',
    },
    'fator-geometria': {
      verdadeiro: true,
      suficiencia: [{ achados: ['vc-mordedura', 'vc-reinicio', 'vf-catracas', 'vf-convergencia'], minimo: 1 }],
      explicacao: 'A origem coincide com o reinício do cordão, onde há mordedura e pé abrupto: um concentrador de tensões em região já endurecida.',
    },
    'fator-procedimento': {
      verdadeiro: true,
      suficiencia: [{ achados: ['doc-sem-preaquecimento', 'doc-consumivel', 'mg-zta-martensita', 'hv-pico-acabamento'], minimo: 1 }],
      explicacao:
        'Sem preaquecimento, a 12 °C e com consumível sem controle de umidade, um aço mais temperável fica sujeito a ZTA dura e a trincas a frio.',
    },
    'fator-inspecao': {
      verdadeiro: true,
      suficiencia: [{ achados: ['doc-inspecao', 'vc-pintura', 'doc-desenho-acabamento'], minimo: 1 }],
      explicacao: 'A inspeção visual sem remover a tinta e a falta de END após a soldagem deixaram a trinca de fabricação passar despercebida.',
    },
    'fator-ambiente': {
      verdadeiro: false,
      suficiencia: [{ achados: ['vf-sem-pites', 'vm-superficie'], minimo: 1 }],
      explicacao: 'Oxidação leve e uniforme, sem pites na origem: o ambiente não teve papel relevante identificável. Corrosão-fadiga não é totalmente excluível sem MEV.',
    },
  },
  hipoteses: {
    'mec-fadiga': { verdadeira: true, evidenciasDecisivas: ['vf-marcas-praia', 'vf-zona-lisa', 'vf-zona-final'], explicacao: 'Mecanismo real.' },
    'mec-sobrecarga': {
      verdadeira: false,
      evidenciasDecisivas: ['vf-marcas-praia', 'vf-zona-lisa', 'vf-sem-deformacao'],
      explicacao: 'Uma sobrecarga única não produz marcas de praia nem uma zona lisa ocupando dois terços da seção; também não houve deformação plástica macroscópica.',
    },
    'mec-fragil': {
      verdadeira: false,
      evidenciasDecisivas: ['vf-marcas-praia', 'vf-zona-final'],
      explicacao: 'A zona final é rugosa e tem lábios de cisalhamento (ruptura dúctil), e houve crescimento progressivo antes dela. A ZTA dura facilitou a iniciação, mas a peça não rompeu num evento frágil único.',
    },
    'mec-corrosao': {
      verdadeira: false,
      evidenciasDecisivas: ['vf-sem-pites', 'vm-superficie', 'mg-borda-transgranular'],
      explicacao: 'Sem pites na origem, oxidação leve e propagação transgranular plana, sem ramificação. Sem MEV e análise de produtos, a contribuição do meio fica pouco provável, mas não totalmente excluída.',
    },
    'causa-trinca-fabricacao': {
      verdadeira: true,
      evidenciasDecisivas: ['vf-origem-escura', 'mg-trajeto-borda', 'mg-trinca-sec-A'],
      explicacao: 'Causa real.',
    },
    'causa-impacto': {
      verdadeira: false,
      evidenciasDecisivas: ['doc-impacto', 'vf-marcas-praia', 'vf-origem-escura'],
      explicacao: 'O impacto foi a ~150 mm da junta, e a origem é uma trinca oxidada no pé da solda, com propagação progressiva. Nada liga o evento à origem.',
    },
    'causa-descontinuidade-interna': {
      verdadeira: false,
      evidenciasDecisivas: ['vf-convergencia', 'mg-macro-junta'],
      explicacao:
        'A origem é superficial, no pé do cordão; a penetração é total. Existem poros reais na zona fundida, mas longe da origem (y ≈ 52–64 mm) e sem relação com a fratura.',
    },
    'causa-subdimensionamento': {
      verdadeira: false,
      evidenciasDecisivas: ['doc-lote-anterior'],
      explicacao: 'Braços do mesmo desenho operaram mais de 3 anos sem falha. Uma verificação de tensões não fez parte dos ensaios, por isso a hipótese é enfraquecida, não refutada.',
    },
    'fator-material': { verdadeira: true, evidenciasDecisivas: ['mg-mb-perlita', 'hv-mb', 'vm-marcacao'], explicacao: 'Fator real.' },
    'fator-geometria': { verdadeira: true, evidenciasDecisivas: ['vc-mordedura', 'vc-reinicio'], explicacao: 'Fator real.' },
    'fator-ambiente': {
      verdadeira: false,
      evidenciasDecisivas: ['vf-sem-pites', 'vm-superficie'],
      explicacao: 'Sem sinais de ataque corrosivo relevante.',
    },
    'fator-procedimento': { verdadeira: true, evidenciasDecisivas: ['doc-sem-preaquecimento', 'mg-zta-martensita'], explicacao: 'Fator real.' },
    'fator-inspecao': { verdadeira: true, evidenciasDecisivas: ['doc-inspecao'], explicacao: 'Fator real.' },
  },
  achados: {
    'vf-marcas-praia': {
      corretas: ['marcas-praia'],
      relevancia: { 'mec-fadiga': 'apoia', 'mec-sobrecarga': 'enfraquece', 'mec-fragil': 'enfraquece', 'causa-impacto': 'enfraquece-fraco' },
      chave: true,
      explicacao: 'Registram posições sucessivas da frente de trinca: crescimento progressivo. Não indicam, sozinhas, a causa da iniciação.',
      comoObter: 'Inspeção visual da fratura com limpeza suave e luz rasante.',
    },
    'vf-zona-lisa': {
      corretas: ['propagacao'],
      relevancia: { 'mec-fadiga': 'apoia', 'mec-sobrecarga': 'enfraquece' },
      chave: true,
      explicacao: 'Área de propagação lenta, que dá ideia da fração da seção percorrida pela trinca antes da ruptura final.',
      comoObter: 'Visão geral da fratura (qualquer luz).',
    },
    'vf-zona-final': {
      corretas: ['final-ductil'],
      relevancia: { 'mec-fadiga': 'apoia-fraco', 'mec-fragil': 'enfraquece' },
      chave: true,
      explicacao: 'Ruptura final dúctil do ligamento restante. Seu tamanho relativo indica que a tensão nominal não era muito alta.',
      comoObter: 'Visão geral da fratura.',
    },
    'vf-sem-deformacao': {
      relevancia: { 'mec-sobrecarga': 'enfraquece-fraco' },
      explicacao: 'Sem deformação macroscópica: pouco compatível com sobrecarga dúctil generalizada.',
      comoObter: 'Visão geral da fratura.',
    },
    'vf-origem-escura': {
      corretas: ['trinca-preexistente'],
      aceitaveis: ['nao-sei'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia', 'causa-descontinuidade-interna': 'enfraquece-fraco', 'causa-impacto': 'enfraquece-fraco' },
      chave: true,
      explicacao: 'Trinca pré-existente, oxidada antes do crescimento por fadiga. Diferenciá-la de um pite exige limpeza suave e luz difusa; a confirmação viria do MEV.',
      comoObter: 'Detalhe 10× da origem (y ≈ 22 mm, borda superior), limpeza suave, luz difusa.',
    },
    'vf-catracas': {
      corretas: ['catracas'],
      relevancia: { 'mec-fadiga': 'apoia-fraco', 'fator-geometria': 'apoia-fraco' },
      explicacao: 'Várias origens próximas: típico de concentração de tensões ao longo de um trecho do pé do cordão.',
      comoObter: 'Detalhe 10× da origem, limpeza suave, luz rasante.',
    },
    'vf-convergencia': {
      relevancia: { 'causa-descontinuidade-interna': 'enfraquece', 'fator-geometria': 'apoia-fraco', 'mec-fadiga': 'apoia-fraco' },
      chave: true,
      explicacao: 'Localiza a origem na superfície, no pé do cordão — não num defeito interno.',
      comoObter: 'Detalhe 10× da borda superior perto de y ≈ 22 mm, luz rasante.',
    },
    'vf-sem-pites': {
      relevancia: { 'mec-corrosao': 'enfraquece-fraco', 'fator-ambiente': 'enfraquece' },
      explicacao: 'Ausência de corrosão significativa na origem (escala visual).',
      comoObter: 'Detalhe 10× da origem após limpeza suave.',
    },
    'vc-reinicio': {
      corretas: ['reinicio'],
      aceitaveis: ['mordedura'],
      relevancia: { 'fator-geometria': 'apoia' },
      explicacao: 'O reinício do cordão coincide em y com a origem da fratura.',
      comoObter: 'Visão geral da face do cordão.',
    },
    'vc-mordedura': {
      corretas: ['mordedura'],
      relevancia: { 'fator-geometria': 'apoia' },
      chave: true,
      explicacao: 'Entalhe geométrico no pé, concentrador de tensões, na mesma faixa de y da origem.',
      comoObter: 'Detalhe 10× do pé do cordão do lado A perto de y ≈ 22 mm, luz rasante.',
    },
    'vc-linha-pe-A': {
      corretas: ['nao-afirmar', 'trinca-superficial'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia-fraco' },
      explicacao: 'É de fato uma trinca, mas a inspeção visual não permite afirmá-lo; a confirmação veio da metalografia (ou viria de líquido penetrante).',
      comoObter: 'Detalhe 10× do pé do lado A, limpeza suave, luz rasante.',
    },
    'vc-respingos': {
      relevancia: {},
      explicacao: 'Respingos são reais, mas irrelevantes para esta falha.',
      comoObter: 'Visão geral da face do cordão.',
    },
    'vc-fratura-pe': {
      relevancia: { 'fator-geometria': 'apoia-fraco', 'causa-descontinuidade-interna': 'enfraquece-fraco' },
      explicacao: 'A fratura segue o pé do cordão, região de concentração de tensões e de ZTA.',
      comoObter: 'Visão geral da face do cordão.',
    },
    'vc-pintura': {
      relevancia: { 'fator-inspecao': 'apoia-fraco' },
      explicacao: 'A tinta cobre os pés do cordão: uma inspeção sem removê-la dificilmente veria uma trinca de ~1 mm.',
      comoObter: 'Visão geral da face do cordão, como recebida.',
    },
    'vr-raiz': {
      relevancia: { 'causa-descontinuidade-interna': 'enfraquece-fraco' },
      explicacao: 'Mostra a raiz pela superfície; não demonstra integridade interna.',
      comoObter: 'Visão geral do lado da raiz.',
    },
    'vm-marcacao': {
      relevancia: { 'fator-material': 'apoia-fraco' },
      explicacao: 'Corrida C-48731 na peça × C-48213 no certificado: a rastreabilidade do material não se confirma.',
      comoObter: 'Detalhe 10× da marcação estampada, após limpeza.',
    },
    'vm-superficie': {
      relevancia: { 'fator-ambiente': 'enfraquece-fraco', 'mec-corrosao': 'enfraquece-fraco' },
      explicacao: 'Oxidação leve, sem perda de espessura.',
      comoObter: 'Visão geral do metal de base.',
    },
    'mg-macro-junta': {
      relevancia: { 'causa-descontinuidade-interna': 'enfraquece-fraco' },
      chave: true,
      explicacao: 'Mostra penetração total e a ZTA nesta seção. Vale para o plano observado, não para todo o cordão.',
      comoObter: 'Corte transversal, ataque Nital ~5 s, 10×.',
    },
    'mg-mb-perlita': {
      corretas: ['medio-c'],
      aceitaveis: ['nao-estimar'],
      relevancia: { 'fator-material': 'apoia' },
      chave: true,
      explicacao:
        'Cerca de 55% de perlita é muito mais que o esperado para ~0,2% C. A estimativa supõe estrutura próxima do equilíbrio: é indício, não análise química.',
      comoObter: 'Campo no metal de base, longe da junta, com polimento adequado e Nital ~5 s, 100× ou 500×.',
    },
    'mg-zta-grosseira': {
      corretas: ['martensita-bainita', 'nao-identificar'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia-fraco' },
      explicacao: 'A 100× vê-se a faixa de grãos grosseiros, mas a identificação dos constituintes pede maior ampliação.',
      comoObter: 'Campo junto à linha de fusão, 100×, Nital ~5 s.',
    },
    'mg-zta-martensita': {
      corretas: ['martensita-bainita'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia', 'fator-procedimento': 'apoia-fraco', 'fator-material': 'apoia-fraco' },
      chave: true,
      explicacao:
        'Produtos de resfriamento rápido na ZTA do último passe: microestrutura suscetível a trinca a frio. A microscopia óptica não separa martensita de bainita com segurança.',
      comoObter: 'Campo junto à linha de fusão a menos de ~2,5 mm da face, 500×, Nital ~5 s, boa preparação.',
    },
    'mg-zta-revenida': {
      corretas: ['martensita-revenida'],
      aceitaveis: ['martensita-bainita'],
      relevancia: {},
      explicacao: 'Mais abaixo, a ZTA foi reaquecida pelos passes seguintes e amaciou. Explica por que um perfil profundo mostra durezas menores.',
      comoObter: 'Campo junto à linha de fusão a meia espessura, 500×.',
    },
    'mg-zta-fina': {
      corretas: ['ferrita-perlita', 'refinada'],
      relevancia: {},
      explicacao: 'Regiões refinadas da ZTA; não participaram da iniciação.',
      comoObter: 'Campo entre a faixa grosseira e o metal de base.',
    },
    'mg-zf': {
      corretas: ['colunar'],
      relevancia: {},
      explicacao: 'Estrutura de solidificação do passe de acabamento; não participou da iniciação.',
      comoObter: 'Campo no reforço do cordão.',
    },
    'mg-zf-reaq': {
      corretas: ['refinada'],
      aceitaveis: ['ferrita-perlita'],
      relevancia: {},
      explicacao: 'Zona fundida reaquecida pelos passes seguintes.',
      comoObter: 'Campo no centro do cordão, a meia espessura.',
    },
    'mg-trinca-sec-A': {
      corretas: ['trinca'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia' },
      chave: true,
      explicacao:
        'Trinca no pé do lado A, na mesma faixa de y da origem, que não cresceu por fadiga: mostra que trincas se formaram nos pés do reinício independentemente da propagação principal.',
      comoObter: 'Corte transversal entre y ≈ 19 e 25 mm; campo no pé do cordão do lado A, 100× a 500×, sem ataque ou com ataque leve.',
    },
    'mg-trinca-intergranular': {
      corretas: ['intergranular'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia' },
      explicacao: 'O trajeto intergranular na ZTA grosseira é compatível com trinca assistida por hidrogênio. O hidrogênio não foi medido.',
      comoObter: 'Mesmo campo da trinca do lado A, 500×, Nital ~5 s.',
    },
    'mg-trajeto-borda': {
      corretas: ['intergranular'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia' },
      chave: true,
      explicacao: 'O primeiro ~1 mm da fratura principal é intergranular na ZTA dura — o mesmo aspecto da trinca do lado A.',
      comoObter: 'Corte transversal pela origem (y ≈ 18–26 mm); campo na borda da fratura junto à face, 500×, Nital ~5 s.',
    },
    'mg-borda-transgranular': {
      corretas: ['transgranular'],
      relevancia: { 'mec-corrosao': 'enfraquece-fraco' },
      explicacao: 'Propagação transgranular, sem ramificação: compatível com fadiga.',
      comoObter: 'Campo na borda da fratura abaixo de ~1,2 mm de profundidade.',
    },
    'mg-poros': {
      corretas: ['porosidade'],
      relevancia: {},
      explicacao: 'Poros reais, mas longe da origem: não iniciaram a fratura. Usá-los como apoio à hipótese de descontinuidade interna é um erro de raciocínio.',
      comoObter: 'Corte transversal entre y ≈ 52 e 64 mm, com sorte na posição do plano.',
    },
    'mg-inclusoes': {
      corretas: ['inclusoes'],
      relevancia: {},
      explicacao: 'Inclusões alongadas típicas de aço laminado; sem papel identificado.',
      comoObter: 'Metal de base sem ataque, 100× ou 500×.',
    },
    'hv-pico-acabamento': {
      corretas: ['zta-endurecida'],
      exageros: ['prova-fragil'],
      relevancia: { 'causa-trinca-fabricacao': 'apoia', 'fator-procedimento': 'apoia-fraco', 'fator-material': 'apoia-fraco' },
      chave: true,
      explicacao:
        'Pico de ~480 HV (sintético) na ZTA do último passe. Indica microestrutura dura e potencialmente suscetível, mas dureza não mede tenacidade.',
      comoObter: 'Perfil transversal a ~0,5–2 mm da face, cruzando a linha de fusão do lado A, espaçamento fino o bastante para pôr pontos na faixa de ~0,6 mm.',
    },
    'hv-pico-moderado': {
      corretas: ['comprometido', 'zta-endurecida'],
      exageros: ['prova-fragil'],
      relevancia: {},
      explicacao:
        'O máximo medido ficou abaixo do pico real: trajeto profundo (ZTA revenida), espaçamento grosso ou efeito de borda. Ausência de um pico alto aqui não demonstra que ele não exista.',
      comoObter: 'Resultado de perfil profundo ou com amostragem que não pegou a faixa mais dura.',
    },
    'hv-maximo-fora-zta': {
      corretas: ['comprometido'],
      exageros: ['prova-fragil'],
      relevancia: {},
      explicacao: 'O perfil não pôs pontos na ZTA de grãos grosseiros: o máximo medido não representa a junta.',
      comoObter: 'Resultado de perfil com espaçamento grosso ou trajeto que não cruzou a junta.',
    },
    'hv-mb': {
      corretas: ['acima-baixo-c'],
      relevancia: { 'fator-material': 'apoia' },
      chave: true,
      explicacao:
        '~205 HV no metal de base é alto para um aço de baixo carbono laminado (valor de referência ilustrativo — revisar com o professor). É indício; a confirmação é química.',
      comoObter: 'Pontos do perfil a mais de 12 mm do eixo da solda.',
    },
    'doc-certificado': {
      relevancia: {},
      explicacao: 'Informa o material declarado, não o material de fato recebido.',
      comoObter: 'Solicitar o certificado do material.',
    },
    'doc-corrida': {
      relevancia: { 'fator-material': 'apoia-fraco' },
      explicacao: 'Comparado com a marcação na peça, revela divergência de corrida.',
      comoObter: 'Solicitar o certificado e comparar com a marcação estampada.',
    },
    'doc-processo': { relevancia: {}, explicacao: 'Contexto do processo.', comoObter: 'Solicitar o registro de fabricação.' },
    'doc-sem-preaquecimento': {
      relevancia: { 'fator-procedimento': 'apoia', 'causa-trinca-fabricacao': 'apoia-fraco' },
      chave: true,
      explicacao: 'Sem preaquecimento a 12 °C: resfriamento rápido da ZTA. É contexto, não prova de trinca.',
      comoObter: 'Solicitar o registro de fabricação.',
    },
    'doc-consumivel': {
      relevancia: { 'fator-procedimento': 'apoia-fraco', 'causa-trinca-fabricacao': 'apoia-fraco' },
      explicacao: 'Possível fonte de hidrogênio; não medido.',
      comoObter: 'Solicitar o registro de fabricação.',
    },
    'doc-interrupcao': {
      relevancia: { 'fator-geometria': 'apoia-fraco' },
      explicacao: 'Confirma que houve reinício do passe de acabamento.',
      comoObter: 'Solicitar o registro de fabricação.',
    },
    'doc-ciclico': {
      relevancia: { 'mec-fadiga': 'apoia-fraco' },
      explicacao: 'Carregamento cíclico de alta frequência: condição necessária para fadiga, mas não prova dela.',
      comoObter: 'Solicitar o histórico de operação.',
    },
    'doc-lote-anterior': {
      relevancia: { 'causa-subdimensionamento': 'enfraquece', 'fator-material': 'apoia-fraco' },
      chave: true,
      explicacao: 'O mesmo desenho funcionou por anos: aponta para algo diferente neste lote (material/fabricação), não para o projeto.',
      comoObter: 'Solicitar o histórico de operação.',
    },
    'doc-impacto': {
      relevancia: { 'causa-impacto': 'enfraquece-fraco' },
      explicacao: 'O impacto foi longe da junta. Sozinho não exclui dano, mas a fratura não mostra sinal de evento único.',
      comoObter: 'Solicitar o histórico de operação.',
    },
    'doc-inspecao': {
      relevancia: { 'fator-inspecao': 'apoia' },
      explicacao: 'Inspeção sem remover a tinta: não detectaria a trinca de fabricação.',
      comoObter: 'Solicitar o histórico de operação.',
    },
    'doc-desenho-material': { relevancia: {}, explicacao: 'Material especificado.', comoObter: 'Solicitar o desenho.' },
    'doc-desenho-acabamento': {
      relevancia: { 'fator-inspecao': 'apoia-fraco', 'fator-geometria': 'apoia-fraco' },
      explicacao: 'Sem requisito de acabamento nem de END: nada exigia detectar a mordedura ou a trinca.',
      comoObter: 'Solicitar o desenho.',
    },
  },
  limitacoesCorretas: ['lim-quimica', 'lim-mo-martensita', 'lim-mev', 'lim-hidrogenio', 'lim-planos', 'lim-sintetico'],
  limitacoesIncorretas: ['lim-dureza-prova', 'lim-visual-interno', 'lim-dureza-tenacidade'],
  ensaiosUteis: ['ens-quimica', 'ens-mev', 'ens-end-irmas', 'ens-procedimento', 'ens-charpy'],
  ensaiosInadequados: ['ens-drx', 'ens-dureza-carga'],
  cadeia: [
    {
      titulo: '1. Como rompeu: fadiga',
      texto: 'Marcas de praia, zona lisa extensa e zona final rugosa com lábios de cisalhamento: crescimento progressivo seguido de ruptura final dúctil.',
      achados: ['vf-marcas-praia', 'vf-zona-lisa', 'vf-zona-final'],
    },
    {
      titulo: '2. Onde começou: no pé do cordão, no reinício',
      texto: 'As marcas convergem para a borda superior em y ≈ 22 mm, onde o cordão foi reiniciado e há mordedura. Há várias origens próximas (catracas).',
      achados: ['vf-convergencia', 'vf-catracas', 'vc-reinicio', 'vc-mordedura'],
    },
    {
      titulo: '3. O que havia na origem: uma trinca de fabricação',
      texto: 'Região escura e facetada na origem, trajeto intergranular na ZTA grosseira junto a ela e trinca secundária no pé oposto, na mesma faixa de y.',
      achados: ['vf-origem-escura', 'mg-trajeto-borda', 'mg-trinca-sec-A', 'mg-trinca-intergranular'],
    },
    {
      titulo: '4. Por que a ZTA trincou: microestrutura dura e procedimento',
      texto: 'Martensita na ZTA do último passe e pico de dureza junto à face; soldagem sem preaquecimento e consumível sem controle de umidade.',
      achados: ['mg-zta-martensita', 'hv-pico-acabamento', 'doc-sem-preaquecimento', 'doc-consumivel'],
    },
    {
      titulo: '5. Por que estava dura: material diferente do especificado',
      texto: 'Perlita em ~55% do metal de base, dureza de ~205 HV e corrida divergente do certificado. Só a análise química confirma.',
      achados: ['mg-mb-perlita', 'hv-mb', 'vm-marcacao', 'doc-corrida'],
    },
    {
      titulo: '6. Por que não foi detectada',
      texto: 'Sem requisito de END e inspeção periódica sem remover a tinta.',
      achados: ['doc-inspecao', 'doc-desenho-acabamento', 'vc-pintura'],
    },
  ],
  ensaios: [
    {
      estacao: 'Inspeção visual e da fratura',
      mostra: 'Morfologia macroscópica da fratura (origem, propagação, ruptura final), geometria do cordão, marcações e estado da superfície.',
      naoMostra: 'Interior da peça; microestrutura; estrias de fadiga (exigem MEV); natureza de linhas finas (trinca × sulco) sem outro ensaio.',
    },
    {
      estacao: 'Metalografia',
      mostra: 'Microestrutura num plano, zonas da junta, trincas e poros no plano do corte, trajeto da fratura em perfil.',
      naoMostra: 'O que está fora do plano cortado; composição química; distinção segura entre martensita e bainita; teor de hidrogênio.',
    },
    {
      estacao: 'Perfil de microdureza',
      mostra: 'Variação de dureza ao longo de um trajeto, que reflete mudanças microestruturais.',
      naoMostra: 'Tenacidade, resistência à fratura ou fragilidade diretamente; regiões entre indentações ou fora do trajeto.',
    },
  ],
  amostragem: [
    {
      id: 'geral-fratura',
      descricao: 'Visão geral de uma superfície de fratura',
      peso: 2,
      regra: { tipo: 'visual', superficies: ['fratura-A', 'fratura-B'], vista: 'geral' },
    },
    {
      id: 'detalhe-origem',
      descricao: 'Detalhe da região da origem após limpeza suave',
      peso: 3,
      regra: { tipo: 'visual', superficies: ['fratura-A', 'fratura-B'], vista: 'detalhe', u: [18, 26], v: [0, 1.2], limpezas: ['suave'] },
    },
    {
      id: 'detalhe-pe',
      descricao: 'Detalhe do pé do cordão próximo à origem',
      peso: 1,
      regra: { tipo: 'visual', superficies: ['face-cordao'], vista: 'detalhe', u: [-11, -8], v: [16, 28] },
    },
    {
      id: 'corte-origem',
      descricao: 'Corte transversal passando pela região da origem (parte A)',
      peso: 3,
      regra: { tipo: 'corte', orientacao: 'transversal', parte: 'A', posicao: [17.5, 26.5], extensaoInclui: 0 },
    },
    {
      id: 'corte-comparacao',
      descricao: 'Segundo corte transversal, longe da origem, para comparação',
      peso: 1,
      regra: { tipo: 'corte', orientacao: 'transversal', parte: 'A', posicao: [35, 78], extensaoInclui: 0 },
    },
    {
      id: 'referencia-mb',
      descricao: 'Micrografia atacada do metal de base como referência',
      peso: 2,
      regra: { tipo: 'micrografia-zona', zonas: ['mb'], ampliacoes: [100, 500], ataques: ['nital-5s'] },
    },
    {
      id: 'campo-zta-face',
      descricao: 'Micrografia da ZTA de grãos grosseiros junto à face',
      peso: 2,
      regra: { tipo: 'micrografia-zona', zonas: ['zta-gg-acab'], ampliacoes: [100, 500], ataques: ['nital-5s'] },
    },
    {
      id: 'campo-borda-origem',
      descricao: 'Micrografia da borda da fratura junto à origem',
      peso: 2,
      regra: { tipo: 'micrografia-caixa', caixa: { x: [7.9, 9.9], y: [17.5, 26.5], z: [0, 1.0] }, ampliacoes: [100, 500] },
    },
    { id: 'perfil-atravessa', descricao: 'Perfil de microdureza atravessando a junta', peso: 2, regra: { tipo: 'perfil-atravessa' } },
    {
      id: 'perfil-zta-face',
      descricao: 'Indentações na ZTA grosseira do último passe (perto da face)',
      peso: 2,
      regra: { tipo: 'perfil-zona', zonas: ['zta-gg-acab'], zMax: 2.8 },
    },
    { id: 'doc-soldagem', descricao: 'Consulta ao registro de soldagem', peso: 1, regra: { tipo: 'documento', id: 'registro-soldagem' } },
    { id: 'doc-operacao', descricao: 'Consulta ao histórico de operação', peso: 1, regra: { tipo: 'documento', id: 'historico-operacao' } },
    {
      id: 'limpeza-agressiva',
      descricao: 'Limpeza agressiva de uma superfície de fratura (dano permanente)',
      peso: 3,
      penalidade: true,
      regra: { tipo: 'limpeza', superficies: ['fratura-A', 'fratura-B'], limpeza: 'agressiva' },
    },
    {
      id: 'cortou-antes',
      descricao: 'Corte pela origem na parte A antes de documentar a origem em detalhe',
      peso: 2,
      penalidade: true,
      regra: { tipo: 'corte-antes-de-documentar', parte: 'A', posicao: [17.5, 26.5], superficies: ['fratura-A', 'fratura-B'], u: [17.5, 26.5] },
    },
  ],
};
