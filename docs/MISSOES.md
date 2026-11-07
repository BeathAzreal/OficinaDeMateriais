# Missões

As missões são **situações didáticas fictícias**. Os requisitos (faixas de
largura, reforço máximo, tolerâncias) são **objetivos do jogo**, não
requisitos de norma, e nenhuma missão concede certificação. Os desenhos são
esquemas próprios do jogo e **não seguem** as convenções normalizadas de
símbolos de soldagem.

## Como cada missão é descrita

Cada missão separa explicitamente:

- **Processo:** MIG/MAG (soldagem a arco com arame sólido e proteção gasosa).
  O nome MIG é usado com gás inerte (argônio, para alumínio) e MAG com gás
  ativo (misturas com CO₂ ou CO₂ puro, para aços).
- **Junta:** como as peças estão posicionadas — topo reto, topo em V, em T,
  sobreposta ou de canto (H46).
- **Tipo de solda:** solda em chanfro (topo reto ou V) ou solda de ângulo
  (filete, nas juntas em T, sobreposta e de canto), feita por um lado.
- **Posição:** como a peça chega e se ela pode ser girada e tombada num
  posicionador ou está presa na estrutura (H47).

## Catálogo jogável (etapa 11)

| Id | Contexto | Material | Espessura | Junta (H46) | Como chega (H47) | Desafio principal |
|---|---|---|---|---|---|---|
| `suporte-carbono` | Suporte de prateleira para o almoxarifado de uma escola | Aço de baixo carbono | 3,0 mm | Topo reto | Plana, posicionador | Referência: equilibrar tamanho do cordão e fusão |
| `inox-equipamento` | Tampo de mesa de preparo da cozinha comunitária | Inox austenítico | 2,0 mm | Topo reto | Plana, posicionador | Fundir sem colocar calor demais: o inox deforma mais |
| `mobiliario-chapa-fina` | Assento de banco da biblioteca (chapa sobre a travessa) | Aço de baixo carbono | 1,5 mm | Sobreposta (filete) | Horizontal (2F), posicionador | Chapa fina: rápido para não furar a borda de cima |
| `aluminio-componente` | Suporte de painel solar do posto de saúde (nervura em pé) | Liga de alumínio | 3,0 mm | Em T (filete) | Horizontal (2F), posicionador | Muito calor no começo; acelerar; remover o óxido |
| `estrutura-leve` | Emenda da viga da cobertura de um ponto de ônibus | Aço de baixo carbono | 6,0 mm | Topo em V (60°) | Plana, posicionador | Encher o V: um passe devagar ou dois passes |
| `corrimao-inox` | Corrimão da rampa do posto de saúde, já chumbado | Inox austenítico | 2,0 mm | De canto (filete) | **Vertical (3F), peça fixa** | Escolher subir (funde mais) ou descer (funde menos) |

Os três diâmetros de arame (0,8, 1,0 e 1,2 mm) ficam à escolha em todas as
missões; os gases continuam os compatíveis com o material (H27).

No modo História os capítulos alternam o material (aço carbono → inox → aço
carbono → alumínio → aço carbono → inox). A junta é a da missão (já não há
traçado sorteado, H41); no Arcade ela vem da missão sorteada e no Torneio, da
peça escolhida para a rodada, a mesma para todos. Com posicionador, a peça
pode ser girada e tombada com o arco fechado (H47); presa na estrutura, não.

O **Treino livre** usa a mesma interface das missões (bancada, execução,
pontuação, inspeção), com a peça padrão (aço carbono 3 mm, no modo escolhido antes — Fácil ou Difícil —, trecho
10–140 mm) e o tipo de junta escolhido na bancada (cada um com a espessura de teste dele: o V em chapa de 6 mm), mais a explicação e a
comparação com a tentativa anterior da etapa 4. Não conta. A interface
antiga das etapas 1–4 foi removida (etapa 8).

Cada missão tem dois modos de pontuação, escolhidos antes de soldar (v1.8, H88; os ids salvos continuam `aprendiz` e `profissional`):

| | Fácil | Difícil |
|---|---|---|
| Tentativas | 5 (alumínio: 6) | 3 (alumínio: 4) |
| Faixa de largura | a do desenho, ampliada 1 mm de cada lado | a do desenho |
| Tolerância de alinhamento | a do desenho + 1 mm | a do desenho |
| Faixas da nota graduada | duas vezes mais largas (`TOLERANCIAS_FACIL`) | `TOLERANCIAS` |
| Integridade mínima (E1) | 85 % | 95 % |

O que diferencia os materiais **não é cor nem multiplicador de dificuldade**:
são os parâmetros de H35 (aporte necessário, aquecimento acumulado,
deformação, limpeza do óxido), que mudam a física do jogo. Ver
[HIPOTESES.md](HIPOTESES.md).

Cada missão tem ao menos uma configuração viável — um teste automático
(`tests/missoes.test.ts`) procura ajustes e velocidade constante que aprovam
cada missão em cada dificuldade.

## Combinações que o jogo não oferece

- Alumínio com gás ativo (CO₂ ou misturas com CO₂).
- Inox com CO₂ puro ou com misturas ricas em CO₂.
- Aço carbono com arame de inox ou de alumínio (e vice-versa).
- Polaridade CC− (eletrodo negativo) com arame sólido: a polaridade é fixa em
  CC+.

## Planejadas (não jogáveis)

Aparecem no catálogo como "em preparação", sem botão de jogar, porque o
modelo ainda não cobre o que pedem:

- **Tubulação da horta comunitária** — solda em tubo, com a peça girando
  durante o passe: o modelo só tem chapas paradas.
- **Pé da tabela de basquete** — eletrodo revestido: só o MIG/MAG tem modelo.

## Processos não disponíveis

**Eletrodo revestido** e **TIG** aparecem no menu de preparação como não
disponíveis. Seus controles (tipo e diâmetro do eletrodo, corrente,
polaridade; corrente contínua ou alternada, gás) e comportamentos precisam de
modelos próprios — copiar o comportamento do MIG/MAG com outro nome seria
enganoso (H26).

## Exercícios técnicos orientados (Alpha v1.3)

Em Treino → Treino livre → Exercícios técnicos há três roteiros:
controle do avanço, alimentação e deposição, tensão e forma.
Todos usam a peça padrão de aço carbono de 3 mm, junta de topo,
abertura de 1 mm e dificuldade Aprendiz. Não criam missões oficiais,
recordes ou critérios novos de aprovação.

O aluno faz uma referência e usa “Treinar de novo” para comparar.
Os ajustes são preservados entre tentativas; o roteiro pede manter as
demais condições. Os controles não ficam bloqueados e a velocidade é
manual: portanto, a comparação não comprova causalidade isolada.
O roteiro permanece consultável na preparação e no resultado.
A escolha de outro exercício inicia uma sessão sem tentativa anterior.

São orientações para explorar o modelo atual, sem mudar física,
pontuação, consumíveis ou armazenamento. A futura revisão do modelo
deve ser acompanhada de revisão desses roteiros.


## Roteiros de aprendizado — Alpha v1.4

As seis encomendas agora têm habilidade principal, preparação, execução, inspeção e um experimento de treino em `src/missoes/aprendizagem.ts`. O roteiro aparece na ficha comum e pode ser consultado antes do desbloqueio. Não muda limites, tentativas ou requisitos físicos.

O resumo de progressão deriva as contagens das aprovações existentes e recomenda a próxima missão Aprendiz liberada. Depois recomenda os níveis Profissional pendentes. Missões inexistentes não são liberadas; dados antigos e chaves desconhecidas são preservados e não contam como capítulo concluído. Completar todas as etapas permite repetir o catálogo. Aprovação não equivale a certificação.

## v1.8 — História sem trava (H89)

A missão seguinte da História libera quando a anterior é **entregue** no modo Fácil, aprovada ou não; o modo Difícil de uma missão libera quando ela é entregue no Fácil. Perfis antigos continuam valendo (a lista salva tem o mesmo nome e formato).

## v1.9 — História só no Difícil, com 40 % por categoria (H90)

A História passa a ser jogada só no Difícil. A missão seguinte abre quando a anterior é **aprovada** com pelo menos 40 % dos pontos em cada uma das 5 categorias. A lista salva no perfil tem o mesmo nome e formato; só contam as aprovações do Difícil, então quem passou missões só no Fácil numa versão anterior refaz essas missões no Difícil.
