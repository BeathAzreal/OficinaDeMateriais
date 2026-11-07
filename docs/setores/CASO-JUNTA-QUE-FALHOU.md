# Caso 1 — "A junta que falhou" (contém a solução)

> Documento para professores. Não divulgue aos estudantes antes da atividade.

## Cenário apresentado

Braço tensor BT-07 de uma peneira vibratória: barra chata 80 × 12 mm em aço SAE 1020 (declarado), emendada no centro por solda de topo
em V (60°), 3 passes com arame tubular. Rompeu junto à solda após ~8 meses de flexão alternada a ~16 Hz. Dois braços do mesmo lote seguem em operação.

## Condição real da peça

- O aço tem ~0,45 % C (não é o declarado). A marcação na peça (C-48731) difere do certificado (C-48213).
- Sem preaquecimento (12 °C) e com consumível sem controle de umidade, a ZTA de grãos grosseiros do **último passe** ficou martensítica
  (~480 HV sintético); mais abaixo, os passes seguintes revenem a ZTA (~335 HV).
- No **reinício do cordão** (y ≈ 18–27 mm) há reforço mais alto, pé abrupto e **mordedura**.
- Ali se formou uma **trinca a frio** de ~1 mm no pé do lado B, ao longo da ZTA grosseira (trajeto intergranular), e uma trinca menor
  (~0,4 mm, y ≈ 19–25 mm) no pé do lado A.
- Porosidade real na zona fundida em y ≈ 52–64 mm, sem relação com a falha.

| Categoria | No caso |
| --- | --- |
| **Mecanismo** | Fadiga (crescimento progressivo sob flexão alternada) com ruptura final dúctil do ligamento restante |
| **Causa provável** | Trinca de fabricação (a frio) no pé da solda, numa ZTA endurecida |
| **Fatores contribuintes** | Material diferente do especificado; procedimento sem preaquecimento/controle de hidrogênio; concentração de tensões no reinício (mordedura, pé abrupto); inspeção sem remover a tinta e sem END |
| **Não contribuíram** | Impacto em manutenção (a ~150 mm da junta), porosidade, ambiente, subdimensionamento (lote anterior durou > 3 anos) |

## Evidências disponíveis e como obtê-las

| Evidência | Estação e condições | Mostra | Não mostra |
| --- | --- | --- | --- |
| Marcas de praia, zona lisa (~2/3), zona final rugosa com lábios | Visual da fratura, limpeza suave, luz rasante | Crescimento progressivo e ruptura final dúctil | Estrias, número de ciclos, causa da iniciação |
| Convergência na borda superior em y ≈ 22 mm; catracas | Detalhe ~10× da origem, luz rasante | Origem superficial no pé do cordão, várias origens | Natureza do defeito inicial |
| Região escura facetada (~9 × 1 mm) na origem | Detalhe ~10×, limpeza suave, luz difusa | Trinca pré-existente oxidada (indício) | Hidrogênio; confirmação exige MEV |
| Mordedura e reinício do cordão | Visual da face do cordão (detalhe, luz rasante) | Concentrador geométrico na mesma faixa de y | Interior |
| Linha fina no pé do lado A | Detalhe, limpeza suave, luz rasante | Algo linear — **não dá para afirmar** que é trinca | — |
| Marcação "C-48731" | Detalhe do metal de base após limpeza | Rastreabilidade divergente do certificado | Composição |
| Penetração total, ZTA de ~2 mm | Corte transversal, Nital, 10× | Integridade **daquele plano** | Outros planos |
| Martensita na ZTA grosseira junto à face | 500×, Nital ~5 s, z < 2,8 mm | Produto de resfriamento rápido | Distinção segura martensita/bainita |
| Trinca no pé A, intergranular | Corte transversal entre y ≈ 19 e 25 mm, 100–500× | Trincas no reinício independentes da propagação | Hidrogênio |
| Trajeto intergranular na borda da fratura junto à origem | Corte pela origem (y ≈ 18–26 mm), borda, 500× | Mesmo aspecto da trinca do lado A | — |
| Perlita ~55 % no metal de base | 100/500×, Nital ~5 s | Indício de ~0,4–0,5 % C | Composição (exige análise química) |
| Pico ~480 HV a z ≈ 0,5 mm | Perfil HV0,5 perto da face, espaçamento fino | Região endurecida | Tenacidade ou fragilidade |
| ~205 HV no metal de base | Pontos > 12 mm do eixo | Indício de material diferente | Composição |
| Documentos | Bancada (tempo) | Contexto: sem preaquecimento, consumível, lote anterior, impacto, inspeção | O que de fato aconteceu na peça |

## Armadilhas previstas

- Limpar a fratura com escova de aço (apaga a origem, cria riscos que imitam marcas).
- Cortar pela origem na parte A antes de documentá-la (a face B ainda pode salvar a investigação).
- Tomar arrancamentos de preparação por porosidade; riscos de lixamento por trincas.
- Atacar demais e concluir "estrutura escura = martensita" no metal de base.
- Fazer o perfil a meia espessura ou com espaçamento de 1 mm e concluir que "não há região dura".
- Concluir fragilidade direto da dureza.
- Usar os poros reais (longe da origem) como apoio à hipótese de descontinuidade interna.
- Ver o impacto registrado e concluir "sobrecarga" sem olhar a fratura.

## Hipóteses alternativas e o que as enfraquece

| Hipótese | Enfraquecida por |
| --- | --- |
| Sobrecarga única | Marcas de praia, zona lisa extensa, ausência de deformação macroscópica |
| Fratura frágil em evento único | Crescimento progressivo prévio e zona final dúctil com lábios |
| Trincamento assistido pelo meio | Sem pites, oxidação leve, propagação transgranular sem ramificação (não excluída sem MEV) |
| Impacto em manutenção | Local do impacto (~150 mm), origem oxidada no pé da solda, propagação progressiva |
| Descontinuidade interna | Origem superficial, penetração total; poros reais estão longe da origem |
| Subdimensionamento | Lote anterior de mesmo desenho durou > 3 anos (não há cálculo de tensões no jogo) |
| Ambiente corrosivo | Sem pites nem produtos espessos |

## Próximos ensaios considerados úteis

Análise química do metal de base; MEV da origem; END (líquido penetrante/partículas magnéticas) nos pés de solda dos braços em operação;
revisão e qualificação do procedimento de soldagem; Charpy da ZTA em junta reproduzida. Considerados inadequados: DRX da superfície pintada;
"repetir a microdureza com carga maior para confirmar a fragilidade".
