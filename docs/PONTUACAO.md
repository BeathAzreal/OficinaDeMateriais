# Pontuação automática — versão `pontuacao-v3` (0 a 1000)

> **v3 (Alpha v1.3).** Escala de **0 a 1000** e notas **graduadas** pelo
> tamanho do desvio. Pesos (somando 100), condições essenciais, regra de
> aprovação e desempate **iguais** às versões anteriores; cada ponto de peso
> vale 10 pontos. O que mudou desde a v1 está em "Versão das regras".

A pontuação é uma **proposta didática**. Ela só mede o que o modelo do jogo
calcula (ver [HIPOTESES.md](HIPOTESES.md)). Nenhum item é medido por
aparência da imagem: tudo vem dos números do modelo. **Não é qualificação
profissional nem previsão certificada de resistência.**

| Categoria | Peso padrão | Pontos máximos |
|---|---|---|
| Fusão prevista (integridade) | 40 | 400 |
| Geometria do cordão | 25 | 250 |
| Regularidade da largura | 15 | 150 |
| Controle térmico | 10 | 100 |
| Execução | 10 | 100 |

Os pesos podem ser mudados **antes** de um torneio começar (somando 100); a
nota máxima de cada categoria é peso × 10. O Arcade usa sempre os pesos
padrão. Cada resultado guarda os pesos e a versão das regras.

**Nota graduada.** Em vez de contar só "dentro/fora", cada posição da junta
ganha de 0 a 1 conforme a distância ao critério, e a categoria usa a média.
Assim duas soldas que estariam empatadas na v1 (as duas "fora da faixa")
se separam: quem errou por 0,2 mm perde pouco; quem errou por 2 mm perde
tudo. As distâncias de corte (`TOLERANCIAS` em `src/pontuacao/regras.ts`)
são **critérios do jogo**, inspirados na ideia de níveis de aceitação por
desvio (ex.: ISO 5817), sem reproduzir os limites de nenhuma norma.

## Trecho avaliado

Cada missão define um **trecho exigido** (por exemplo, de 10 a 140 mm). A
fusão, a largura, o reforço, o alinhamento e a regularidade são medidos no
trecho exigido **menos 2 mm em cada ponta** (H37).

## Categorias

### Fusão prevista — integridade (400)

- **Definição:** quanto da junta o modelo prevê fundida na medida certa,
  posição por posição.
- **Dados usados:** índice de fusão sintético F (aporte, aquecimento,
  espessura, material, gás, técnica, DBCP — H31 a H35, H48), cobertura das
  bordas (H34, H46) e enchimento da junta (H46 e, no topo reto, a fresta).
- **Regra (nota por posição):**

  | Estado previsto | Nota |
  |---|---|
  | adequada (1 ≤ F ≤ 2) | 1 |
  | falta de fusão (F < 1) | (F − 0,6) ÷ 0,4, entre 0 e 1 |
  | fusão excessiva (2 < F ≤ 2,6) | (2,6 − F) ÷ 0,6 |
  | junta não enchida | 0,5 × enchimento |
  | perfuração, borda descoberta, sem cordão | 0 |

  Pontos = peso × 10 × média das notas. A **fração íntegra** (só posições
  adequadas) continua sendo a condição essencial E1.
- **Limitações:** F é **sintético**. Não representa porosidade, trincas,
  inclusões, diluição nem penetração real.

### Geometria do cordão (250)

- **Dados usados:** extensão, largura, altura e centro do cordão (mm).
- **Regra:** extensão 7/25 = fração do trecho exigido com cordão. Nas
  posições **com cordão**, cada uma de 0 a 1:
  - largura (8/25): 1 dentro da faixa do desenho; cai até 0 a **1,5 mm**
    além do limite (para menos ou para mais);
  - reforço (5/25): 1 até o reforço máximo; cai até 0 a **1,0 mm** acima.
    Metal **abaixo da face** (junta não enchida) também perde: 0 a 1,0 mm
    abaixo;
  - alinhamento (5/25): 1 com o centro até a tolerância; cai até 0 a
    **1,0 mm** além.
- **Limitações:** as tolerâncias são **objetivos didáticos do jogo**. A
  forma vem do modelo (H3, H9, H46).

### Regularidade da largura (150)

- **Regra:** pontos = peso × 10 × (0,20 − variação) ÷ 0,17, entre 0 e o
  máximo. Variação (coeficiente de variação da largura) de até 3 % ganha
  tudo; 20 % ou mais, nada.
- **Limitações:** o espalhamento numérico (H4) alisa oscilações menores que
  uns 2 mm.

### Controle térmico (100)

- **Regra:** pontos = peso × 10 × (2 − D), entre 0 e o máximo, com D o
  índice de deformação (H36).
- **Limitações:** não há medida de empenamento, só um índice.

### Execução (100)

- **Definição:** como o passe foi executado.
- **Regra:** três partes, cada uma entre 0 e 1:
  - **arco sobre a junta (40 %)**: fração do tempo de arco com a tocha no
    trecho (5 mm de folga) e a até 10 mm da junta: (fração − 0,70) ÷ 0,30;
  - **reinícios de arco (30 %)**: 1 − reinícios ÷ 3 (reinícios = aberturas
    de arco − 1). Na prática, cada parada e retomada é um ponto de início e
    fim de cordão a mais;
  - **metal no trecho (30 %)**: metal dentro do trecho pedido ÷ metal na
    peça: (fração − 0,80) ÷ 0,20.
- **Mudou desde a v2:** o rendimento do gás saiu da nota (era uma escolha
  de preparo, não de execução); ele continua agindo no metal depositado
  (H29) e aparece em `medidas.rendimento`.
- **Limitações:** o reinício é contado, não modelado (o jogo não prevê
  cratera nem sobreposição).

## Condições essenciais (aprovação)

Cada missão lista suas condições essenciais (iguais desde a v1):

| Código | Condição | Fácil | Difícil |
|---|---|---|---|
| E1 | Integridade prevista no trecho avaliado | ≥ 85 % | ≥ 95 % |
| E2 | Nenhuma perfuração prevista (F > 2,6 em 1 mm ou mais) | sim | sim |
| E3 | Cordão contínuo no trecho exigido (sem trecho de 1 mm ou mais sem cordão) | sim | sim |
| E4 | Óxido removido antes de soldar (só missões de alumínio) | sim | sim |

> **Desde a v1.8 (`pontuacao-v9`, H89) não há mais trava:** a entrega não aprovada recebe todos os pontos que fez, o conceito vem só da nota, os rankings e torneios ordenam pela nota e o Arcade e a História não bloqueiam por aprovação. O texto abaixo descreve as regras até a `pontuacao-v8`.

**Se alguma condição essencial falhar, a entrega é "não aprovada"** e:

Na tela, a categoria zerada mostra **quanto valeria** (barra tracejada e
"Valeria X — zerada porque a solda não foi aprovada"), e logo abaixo do selo
"Não aprovada" aparece uma dica do motivo mais provável (falta de fusão →
andar mais devagar; perfuração → mais rápido; óxido; trecho sem cordão).
Isso é só apresentação: a regra e o total não mudam.

- as categorias **Controle térmico e Execução ficam zeradas** (penalidade
  registrada com justificativa), para que economia ou rapidez não compensem;
- nos rankings, **toda entrega aprovada fica acima de qualquer não aprovada**,
  qualquer que seja a nota.

## Desempate

Ordem padrão (Arcade e torneios):

1. aprovada antes de não aprovada;
2. maior nota total;
3. maior nota de fusão prevista (integridade);
4. maior nota de geometria do cordão;
5. menos tentativas usadas (só torneios);
6. registro mais antigo (Arcade).

Em torneios dá para escolher, antes de começar, a variante "desenho antes de
integridade" nos itens 3 e 4.

## Conceito (S, A, B, C, D)

A partir da etapa 6 a tela mostra um **conceito estilo arcade**, que é só uma
forma de apresentar a nota total: S ≥ 950, A ≥ 850, B ≥ 700, C ≥ 500, D
abaixo (na escala de 1000; as mesmas frações de antes).
Uma entrega **não aprovada fica no máximo com C**, para o conceito não
esconder uma condição essencial descumprida. O conceito não entra em ranking
nem em desempate.

## Arcade (desafios aleatórios)

No modo Arcade, cada desafio usa a pontuação atual (v3, 0–1000) da missão sorteada. O desafio
é **concluído** se a solda for aprovada **e** a condição extra for cumprida
(arco aberto uma só vez; tempo de arco até o limite; técnica exigida; ajustes
pré-definidos sem alteração). Pontos do desafio = nota × multiplicador do
combo (1 + 0,25 por acerto seguido, até ×2). Desafio não concluído: zero
pontos, perde uma vida, combo zera. Regras: `arcade-v1`
(`src/arcade/desafios.ts`); um teste garante que toda condição sorteável tem
solução.

## Versão das regras

Todo resultado guarda `versaoPontuacao` (hoje `"pontuacao-v3"`), os pesos e
o detalhamento. Se as regras mudarem, a versão muda; resultados antigos
**não são recalculados**, e os rankings separam versões diferentes (a chave
de ranking inclui a versão). Recordes `pontuacao-v1` e `v2` (0–100)
continuam guardados, mas não se misturam com os da v3 (0–1000).

### O que mudou na `pontuacao-v3` (Alpha v1.3)

1. Escala de 0 a 1000 (peso × 10 por categoria); total inteiro.
2. Notas graduadas por distância ao critério na fusão e na geometria.
3. Falta de enchimento (metal abaixo da face) perde no reforço.
4. Execução = arco sobre a junta, reinícios e metal no trecho (sem o
   rendimento do gás).
5. O modelo passou a encher a fresta da junta de topo antes do reforço
   (HIPOTESES.md, H18 revista): reforço e largura um pouco menores com o
   mesmo metal.
6. No torneio com professor, a nota do professor (0–10) vale × 100 para
   ficar na escala de 1000 na média ponderada.

### O que mudou na `pontuacao-v2` (Alpha v1.3)

1. **Largura na faixa** (8 dos 25 pontos de Atendimento ao desenho) passa a
   ser medida **só onde há cordão**. Na v1 um trecho sem cordão perdia em
   Integridade (sem cordão não é íntegro), em Extensão (7/25), na condição
   essencial E3 **e de novo** na largura. Agora a falta de cordão conta na
   Integridade, na Extensão e em E3, cada uma com um papel diferente (junta
   unida, encomenda atendida, requisito obrigatório); a largura avalia só o
   cordão que existe. Reforço e alinhamento já eram assim.
2. **O modelo mudou** (H28 revista, H48 e H49 em HIPOTESES.md): a corrente
   cresce menos que a alimentação e depende da DBCP; o arco fora da peça não
   aquece; pausa não vira solda. O mesmo registro pode dar outra nota na
   v2 — por isso a versão mudou, mesmo com os pesos iguais.

### Critérios mantidos de propósito (e por quê)

- **Fusão excessiva (Integridade) × Deformação.** As duas vêm do calor, mas
  medem coisas diferentes: a primeira é local (índice de fusão acima de 2 em
  cada posição); a segunda é o calor médio de todo o trecho ponderado pelo
  material (H36). Um passe pode ter pontos excessivos e deformação baixa, e
  vice-versa.
- **Eficiência.** Metade dela é o rendimento do gás escolhido (H29): uma
  decisão de preparo, não de execução. Fica porque escolher CO₂ puro tem
  consequência real (mais respingo). Com essencial descumprida, a eficiência
  é zerada (economia não compensa falha crítica).

## Dados técnicos para a didática (`relatorio-tecnico-v1`)

`src/pontuacao/relatorio.ts` monta, a partir do **mesmo registro** que gera
a nota, um relatório estruturado (`RelatorioTecnico`, sem frases prontas).
Use `relatorioDoRegistro(...)` em `src/pontuacao/oficial.ts` (replay + nota +
relatório) ou `relatorioTecnico(...)` com o cordão e o percurso já
calculados. Campos:

| Campo | O que é | Tipo de informação |
|---|---|---|
| `preparo` | material, espessura, abertura, junta, arame, gás, técnica e ângulo de avanço, DBCP, limpeza | valor usado |
| `regulagens[]` | cada par tensão × alimentação usado com o arco aberto: volume de arame, metal por segundo, corrente, potência, forma e estabilidade do arco | valor calculado |
| `posicoes[]` | posições de soldagem usadas (H47) | valor usado |
| `trechos[]` | de 10 em 10 mm no trecho pedido: `observacao` (largura, altura, centro, área, índice de fusão, estado), `fatores` (velocidade efetiva e relativa, aporte ÷ necessário, desvio da tocha) e `desvios` (frações fora da faixa) | observação × fator calculado |
| `ocorrencias[]` | os trechos com problema da nota, com magnitude e limiar, condição (código da hipótese) e limitação | ocorrência |
| `consumo` | tempo de arco, tempo sobre a junta, aberturas de arco, metal no cordão e no trecho, arame correspondente | valor calculado |
| `indices` | fração íntegra e índice de deformação | índice sintético |
| `limitacoes[]` | o que o modelo não permite concluir (códigos estáveis) | limitação |

Regras para quem escreve as explicações: os `fatores` são **candidatos**,
não a causa; um trecho largo pode ter permanência maior **e** aporte maior
ao mesmo tempo. O relatório não muda a nota nem o formato salvo.

## Correção pontuacao-v4

Mantém escala de 0 a 1000 e notas graduadas da v3. A missão em V admite
duas aberturas planejadas (raiz e acabamento); as demais admitem uma.
Reinícios excedentes = máximo de zero e aberturas realizadas menos as
planejadas. Não há reconhecimento físico de passes: trata-se de uma
franquia explícita do roteiro, não de inspeção de raiz/acabamento.
O campo medidas.reiniciosArco passa a indicar esses reinícios excedentes.

A versão das regras subiu para pontuacao-v4 para separar os novos recordes.
Pontuações históricas mantêm os valores salvos e sua escala de origem.
O placar usa essa escala ao mostrar o máximo e o conceito.

## pontuacao-v5 (reforço realista)

As regras de nota não mudaram. Mudou o modelo do cordão (H3 revista em
HIPOTESES.md): o mesmo passe agora dá um reforço menor: um cordão de 8 mm de
largura passa de cerca de 2,9 mm para cerca de 2,1 mm de reforço. Como a mesma solda passa a ter outra nota, a
versão subiu para pontuacao-v5, e os recordes anteriores ficam separados.

## pontuacao-v6 (defeitos visíveis, Alpha v1.4)

Os defeitos visíveis previstos (H50–H57 em HIPOTESES.md, `src/modelo/defeitos.ts`)
entram na nota:

- **Geometria do cordão** ganha um quinto item, **superfície**: extensão 7/30,
  largura 8/30, reforço 5/30, alinhamento 5/30 e superfície 5/30. Cada posição
  com cordão vale de 0 a 1 e perde com mordedura (a partir de metade do limite),
  sobreposição, escorrimento, gotas, cratera e caimento forte; respingos acima
  de 2 por 10 mm tiram mais até 0,3.
- **Fusão prevista**: a nota de cada posição é multiplicada por
  (1 − 0,6 × risco de porosidade) × (1 − 0,4 × sobreposição).
- Os essenciais E1–E4 não mudaram; a cratera aparece, mas custa pouco (só a ponta).
- A pontuação precisa dos eventos do registro para achar as crateras
  (`EntradaPontuacao.eventos`; `pontuarRegistro` já passa).
- O relatório técnico subiu para `relatorio-tecnico-v2`, com o campo
  `defeitos` (ocorrências, respingos, poros, gotas e empeno).

A mesma solda muda de nota, então a versão subiu para pontuacao-v6 e os
recordes anteriores ficam separados.

## pontuacao-v7 (cordões soltos)

Metal de um cordão solto (H58: solda feita longe da junta e do cordão que já
estava ali) não entra mais na seção da junta: conta como metal fora do
trecho no aproveitamento da **Execução**. Antes ele esticava o cordão da
junta até o lugar novo. A mesma tentativa pode mudar de nota, então a versão
subiu para pontuacao-v7.

## pontuacao-v8 — modos Fácil e Difícil (v1.8, H88)

O jogador escolhe o modo antes de soldar (missões, treino livre, treino de missão, Arcade e X1 já pediam o nível; agora os nomes são Fácil e Difícil). Os ids salvos continuam `aprendiz` (Fácil) e `profissional` (Difícil), então recordes antigos continuam legíveis; como as regras mudaram, a versão da nota passou para `pontuacao-v8` e tentativas antigas não são reavaliadas.

| Parâmetro (`src/pontuacao/regras.ts`) | Fácil (`TOLERANCIAS_FACIL`) | Difícil (`TOLERANCIAS`) |
|---|---|---|
| Largura fora da faixa até zerar | 3 mm | 1,5 mm |
| Reforço acima do máximo / falta de enchimento até zerar | 2 mm | 1 mm |
| Alinhamento fora até zerar | 2 mm | 1 mm |
| Índice de fusão que zera a posição (falta) | 0,4 | 0,6 |
| Nota mínima de uma posição com fusão excessiva (antes de perfurar) | 0,5 | 0 |
| Variação da largura que zera a regularidade | 30 % | 20 % |
| Índice de deformação que zera o controle térmico | 3 | 2 |
| Tempo de arco sobre a junta abaixo do qual zera essa parte da execução | 50 % | 70 % |
| Reinícios até zerar | 6 | 3 |
| Metal no trecho abaixo do qual zera | 60 % | 80 % |
| Folga na faixa de largura e no alinhamento pedidos | 1 mm | 0 |

Perfuração e as condições essenciais valem igual nos dois modos (a integridade mínima já era diferente por missão). Na referência (`tests/referencia.test.ts`), a mesma solda nunca vale menos no Fácil, e um passe lento demais vale cerca de 130 pontos a mais no Fácil.

**Eletrodo (`src/pontuacao/eletrodo.ts`, `MODOS_ELETRODO`):** a nota de 0 a 1000 da v1.6 recebe o modo escolhido antes de soldar.

| | Fácil | Difícil |
|---|---|---|
| Comparação ISO 5817 (reforço h/b) | nível D | nível B |
| Preenchimento a partir do qual a nota não é reduzida | 60 % | 90 % |
| Desconto máximo pela escória que restar | 100 | 200 |
| Desconto por defeito grave (falta de fusão, perfuração, inclusão, sobreposição) | 25 cada, até 75 | 100 cada, até 300 |
| Desconto por defeito leve | 0 | 15 cada, até 90 |

## pontuacao-v9 — física mais lenta e sem trava (v1.8, H87 e H89)

- **Sem trava (H89):** a condição essencial descumprida continua aparecendo ("não aprovada", com o motivo), mas não tira mais pontos: Controle térmico e Execução não são zerados, o conceito (S, A, B, C, D) vem só da nota, os rankings, a regra "melhor" do torneio e as classificações ordenam pela nota, o desafio do Arcade não é perdido por não aprovar, e a missão seguinte da História libera ao entregar.
- **Física mais lenta (H87):** a solda certa pede metade da velocidade de antes (faixa verde de 4 a 8 mm/s na alimentação de referência). As faixas do Fácil e do Difícil não mudaram; mudou o que a física pede.

## pontuacao-v10 — Fácil só nota, Difícil com mínimo por categoria (v1.9, H90)

| Onde | Modo | Aprovação |
|---|---|---|
| Treino e missões MIG/MAG | Fácil | Nenhuma: só a nota |
| Treino e missões MIG/MAG | Difícil | ≥ 20 % dos pontos em cada uma das 5 categorias |
| Desafios do Arcade | só Difícil | ≥ 40 % em cada categoria; abaixo disso o desafio é perdido |
| Modo História | só Difícil | ≥ 40 % em cada categoria para abrir a missão seguinte |
| Eletrodo | Fácil | Nenhuma: só a nota |
| Eletrodo | Difícil | ≥ 20 % em cada um dos 4 itens e na nota final, escória removida |

- `EXIGENCIA = { dificil: 0.2, desafio: 0.4 }` e `exigenciaDe(d)` em `src/pontuacao/regras.ts`; `pontuarRegistro` aceita a exigência como último argumento.
- `essenciais` traz uma condição por categoria (id = id da categoria). No Fácil é vazia.
- O resultado mostra um traço no mínimo de cada barra e, no Fácil, o selo "pontuação pura, sem aprovação".
- A nota é a mesma da v9 (nada nas categorias mudou); muda só quem é aprovado. Recordes antigos continuam lidos; os de versão anterior ficam marcados como tal.

## pontuacao-v11 — máquina MIG com efeito na solda (v2.0, H93)

As categorias e a regra de aprovação são as da v10. Muda o que chega nelas: o modo de transferência e o arco curto mudam a fusão (Integridade), o globular e o arco fora do equilíbrio aumentam respingo, mordedura e irregularidade (Desenho, Regularidade e defeitos). Registros da v10 continuam lidos e aparecem como de versão anterior.
