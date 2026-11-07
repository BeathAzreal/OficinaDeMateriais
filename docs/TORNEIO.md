# Torneio local por turnos

As regras ficam num motor puro (`src/dados/torneio.ts`), testado sem
navegador; as telas só chamam as ações e gravam o resultado.

## Configuração (antes de começar)

Nome; participantes (2 ou mais, sem nomes repetidos); rodadas
personalizadas — **material e espessura** da peça (aço de baixo carbono 3,0
ou 1,5 mm, inox austenítico 2,0 mm, liga de alumínio 3,0 mm), **rota** (o
traçado da junta, H41: reta, curva em S, canto, circular, ou **sorteada**),
dificuldade e **limite máximo** de tentativas por jogador. Cada peça usa os
consumíveis e os limites do desenho da missão do catálogo com aquele
material (aparecem embaixo da rodada); nada de novo é inventado. ordem dos
jogadores (fixa, rodízio ou sorteio por rodada); modo **sem** ou **com**
professor; regra da entrega final; critério de desempate; dispositivo
(exigir um, ou separar por dispositivo); pesos da pontuação automática; e, no
modo com professor, a regra de classificação.

Ao iniciar, as regras ficam **bloqueadas**. Para mudar, use "Duplicar
configuração", que cria um torneio novo com as mesmas regras editáveis.

Dentro de uma rodada todos têm as mesmas condições: mesma peça, **mesma
rota** (a "sorteada" é sorteada uma vez, ao iniciar, e vale para todos; ela
aparece na tela "Vez de …"), mesma dificuldade, mesmo limite de tentativas, mesma regra de entrega e a mesma
regra de dispositivo.

## Fluxo de cada vez

1. Tela "Vez de …" (rodada, posição, missão, regra de entrega).
2. Ficha da missão com desenho e requisitos.
3. Preparação obrigatória: consumíveis, parâmetros, dispositivo (com teste),
   confirmação. A **regra de entrega em vigor aparece antes de soldar**.
4. Tentativas oficiais (até o limite) e, se quiser, **treinos**, que não são
   registrados no torneio.
5. Entrega: a regra escolhe a tentativa (última, melhor pela nota
   automática, ou escolhida pelo jogador). Confirmação obrigatória.
6. Gravação.
7. Passagem de turno, **sem nenhum dado da tentativa anterior**.
8. Próximo participante. Ao fim da rodada, segue para a próxima.

## Sem professor

Classificação só pela pontuação automática. **Entregas aprovadas ficam acima
de qualquer não aprovada**, e numa entrega não aprovada as notas de
deformação e eficiência são zeradas (ver PONTUACAO.md). A tela mostra nota
total, notas por categoria, condições essenciais, penalidades com
justificativa e o critério de desempate.

Classificação geral: número de entregas aprovadas, depois soma das notas,
depois integridade e desenho (na ordem escolhida), depois menos tentativas.

## Com professor

Três notas mantidas separadas: **pontuação automática**, **avaliação inicial
do professor** (ficha comum) e **nota geral final do professor**.

Julgamento, por rodada:

1. cada entrega recebe um **código anônimo aleatório** (gerado na entrega,
   nunca mostrado ao jogador);
2. a ordem de avaliação é **embaralhada**;
3. as telas de julgamento não mostram nome, ordem de execução, dispositivo,
   horário nem ranking;
4. o professor vê a solda (replay do registro), o percurso, o perfil de
   largura, o corte sintético, a velocidade por trecho e os parâmetros;
5. registra a **avaliação inicial** (cada item de 0 a 10 ou "não avaliado");
6. só depois disso a **pontuação automática por categoria** é revelada;
7. registra a **nota final** (0 a 10) com **justificativa** obrigatória;
8. os resultados só podem ser **publicados** quando todas as entregas da
   rodada tiverem nota final.

**Revisões** guardam valor anterior, valor novo, data e motivo (obrigatório).
Revisões depois da publicação recalculam a classificação e entram no
histórico do torneio.

Classificação configurável:

- **pela nota final do professor** (padrão neste modo; a automática aparece
  como referência separada);
- pela nota automática;
- por **média ponderada**: a nota do professor (0–10) é convertida para a
  escala da pontuação automática (0–1000 na `pontuacao-v3`) e combinada com a automática pelos pesos mostrados na tela. Aviso
  exibido: a nota final do professor já pode considerar o sistema, então a
  média pode repetir critérios.

O julgamento por código é apresentado como **medida para reduzir vieses**.
Num aplicativo local não há anonimato completo nem proteção contra fraude.

## Compatibilidade após pontuacao-v4

Novos torneios registram versaoPontuacao. Em torneios antigos, a versão é
inferida dos resultados. Para exibir a classificação, notas v1/v2 são
normalizadas de 0–100 para 0–1000 antes de combinar com a nota docente.
Os resultados salvos não são reavaliados nem alterados.

Não é permitido iniciar uma nova tentativa em um torneio que já usa
outras regras: é necessário duplicar sua configuração. Isso evita misturar
v3/v4 ou notas de escalas diferentes na mesma disputa. Torneios antigos
ainda sem resultados podem começar com as regras atuais.


## Organização e comparabilidade — revisão didática Alpha v1.4

O painel oferece um resumo de entregas pendentes, avaliações finais faltantes e publicação por rodada, sem revelar notas antes da publicação. Uma competição com dispositivos separados mantém os grupos existentes. Versões distintas de pontuação nas rodadas visíveis geram aviso: normalizar a escala não torna modelos tecnicamente equivalentes.

A ordenação e a atribuição de posições agora usam o mesmo comparador. Em modo professor, a nota automática desempata notas iguais do professor antes dos demais critérios. Empates reais conservam a mesma posição. Aprovação continua tendo precedência no modo automático. Critérios físicos e cálculo da pontuação permanecem intactos.
