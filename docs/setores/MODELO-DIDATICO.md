# Modelo didático e simplificações

O jogo não simula um laboratório real. Ele usa **dados sintéticos** e **imagens esquemáticas** definidos de antemão
para treinar o raciocínio de investigação: escolher o que investigar, onde e como amostrar, como preparar,
que parâmetros usar, como interpretar e quais são os limites de cada dado.

## 1. As quatro camadas

| Camada | Onde está | O que contém | Quem lê |
| --- | --- | --- | --- |
| **1. Estado verdadeiro da peça** | `src/casos/<caso>/verdade.ts` | Geometria da junta, zonas microestruturais e suas durezas, trincas, poros, superfície de fratura, regras de visibilidade de cada achado | Só o motor |
| **2. Modelo de aquisição, amostragem e preparação** | `src/motor/*` | Como limpeza, luz, corte, lixamento, polimento, ataque, ampliação, carga e espaçamento transformam a verdade em resultado; limitações geradas | Interface (via ações) |
| **3. Dados obtidos pelo jogador** | `EstadoJogo` (`src/motor/tipos.ts`) | Aquisições com amostra e parâmetros, achados visíveis com qualidade, evidências, vínculos, relatório | Interface e avaliação |
| **4. Interpretação e avaliação** | `src/avaliacao/avaliar.ts` + `gabarito.ts` | Interpretações aceitas, relevância de cada achado para cada hipótese, critérios de amostragem, devolutiva | Só a avaliação |

A interface só usa a parte `publico` do caso. A verdade e o gabarito ficam em arquivos separados e não são exibidos durante a partida
(estão no código-fonte e no `localStorage` apenas como identificadores de achados).

## 2. Reprodutibilidade

- Toda variação vem de *hashes* das condições (superfície, janela, luz, limpeza, preparação, posição, carga). As mesmas condições
  produzem o mesmo resultado; outra preparação da mesma amostra muda só os artefatos.
- Configurações inadequadas **não** produzem resultados aleatórios: produzem limitações específicas (ex.: "3 indentações a menos de
  3 diagonais de uma vizinha"), mudam a **qualidade** do achado (nítida / tênue / comprometida) ou o tornam invisível, sempre por uma regra explícita.

## 3. Regras de cada estação

### Inspeção visual
- Cada achado tem regras do tipo *(vista, luz, limpeza) → qualidade*. Ex.: as marcas de praia ficam nítidas com limpeza suave e luz
  rasante, tênues como recebidas ou com luz difusa; a região escura da origem só aparece no detalhe, após limpeza suave.
- Limpeza agressiva é irreversível: apaga detalhes finos e cria riscos (artefato que pode ser confundido com marcas reais).
- Cortes removem a região correspondente da superfície (a face B continua disponível).
- A superfície externa nunca informa integridade interna (limitação sempre presente).

### Metalografia
- O corte é um plano: transversal (`y` fixo, mostra MB–ZTA–ZF) ou longitudinal (`x` fixo). Feições 3D (poros, trinca) só aparecem se cruzam o plano.
- **Riscos**: nível tabelado por lixamento × polimento (0 a 3). Ficam visíveis quando o nível passa de um limiar por ampliação
  (10×: 2,5; 100×: 1,0; 500×: 0,25). O excesso sobre o limiar rebaixa ou compromete achados de campo e rebaixa feições finas (trincas).
- **Arrancamentos**: surgem quando se pula do #220 direto ao polimento (cavidades irregulares em todas as zonas — imitam porosidade).
- **Ataque**: sem ataque → só trincas, poros e inclusões; ~5 s → microestrutura; ~30 s → imagem escura, frações comprometidas, trincas finas mascaradas.
- **Ampliação**: 10× mostra forma do cordão e zonas; 100× separa fases claras/escuras e grãos; 500× resolve lamelas e ripas.
- Campos com centro fora da amostra são recusados (sem custo).

### Microdureza Vickers
- `d = √(1,8544 · F / HV)` (F em kgf, d em mm) — relação geométrica da indentação Vickers.
- HV medido = HV verdadeiro (média numa vizinhança do tamanho da marca) × variação de fase (só ferrita/perlita, maior com carga baixa)
  × vieses (espaçamento < 3 d: +2 a +9 %; sobreposição: +15 %; borda < 2,5 d: −10 %) × ruído de leitura determinístico
  (desvio de 1,5–4 % conforme a carga; +6 % sem polimento, +2 % com riscos residuais, +3 % com ataque excessivo).
- Limitações: espaçamento, sobreposição, borda, superfície, ataque, trajeto que não atravessa a junta, nenhuma marca na faixa de grãos
  grosseiros, carga baixa no metal de base, poucos pontos, corte longitudinal.
- Marcas anteriores na mesma preparação contam para o espaçamento; uma nova preparação "zera" a superfície.

## 4. Simplificações assumidas

- Geometria idealizada: bisel reto, larguras fixas da ZTA (0,6 + 0,8 + 0,8 mm), fronteira abrupta entre ZTA revenida e não revenida (z = 2,8 mm).
- Zonas com dureza constante e transição curta (~0,1 mm); nenhuma variação ao longo do cordão (exceto o reinício).
- A fratura é um plano com um trecho inicial na ZTA; não há modelagem de crescimento de trinca, tensões ou número de ciclos.
- Microestruturas desenhadas por padrões procedurais (grãos de Voronoi, lamelas e ripas senoidais). Não representam morfologia quantitativa.
- Inspeção visual sem modelagem óptica: só regras de visibilidade.
- Sem MEV, análise química, END, ensaio de impacto ou tração — aparecem apenas como "próximos ensaios".
- Custos e tempos são valores de jogo, escolhidos para criar escolhas, não preços reais.

## 5. Valores numéricos usados (sintéticos)

| Item | Valor no jogo | Situação |
| --- | --- | --- |
| Dureza do metal de base (~0,45 % C, laminado) | 205 HV | Ilustrativo — **revisar** |
| Referência implícita "aço de baixo carbono laminado" | ~130–160 HV (só no texto de interpretação) | Ilustrativo — **revisar** |
| ZTA grãos grosseiros, último passe (martensítica) | 480 HV | Ilustrativo — **revisar** |
| ZTA grãos grosseiros reaquecida | 335 HV | Ilustrativo — **revisar** |
| ZTA grãos finos / intercrítica | 262 / 232 HV | Ilustrativo |
| Zona fundida (acabamento / reaquecida) | 255 / 228 HV | Ilustrativo |
| Fração de perlita no metal de base | ~55 % | Coerente com ~0,45 % C em equilíbrio (regra da alavanca aproximada) — **revisar** |
| Variação por fase (HV0,1 / HV0,5 / HV1) | ±16 / ±6 / ±3 % (escala) | Ilustrativo |
| Espaçamento mínimo entre marcas / distância à borda | 3 d / 2,5 d | **Regra prática do jogo**; conferir a norma aplicável |
| Campo de visão (10× / 100× / 500×) | 25,6 / 1,28 / 0,256 mm de largura | Ilustrativo (depende do microscópio e da câmera) |
| Frequência e horas de operação | ~16 Hz, ~16 h/dia, 8 meses | Fictício |

Nenhum limite de aceitação, norma ou referência bibliográfica é citado como fonte dos valores.
Classificações de aço (SAE 1020) e o reagente Nital são nomes reais usados apenas como contexto.

## 6. O que a avaliação faz (e não faz)

Dimensões e pesos: coerência (35 %), amostragem (20 %), preparação e parâmetros (15 %), reconhecimento de limitações (15 %), uso de recursos (15 %).

- **Coerência**: conclusão correta só vale muito se houver evidências válidas citadas; correta sem dados é tratada como palpite;
  "dados insuficientes" vale muito quando os dados obtidos de fato não sustentavam a conclusão e pouco quando sustentavam.
  Também considera vínculos evidência–hipótese, interpretações e situação das alternativas.
- **Amostragem**: critérios declarativos do gabarito (documentou a origem? cortou pela origem? tem referência do metal de base?
  o perfil atravessa a junta e passa perto da face?) e penalidades (limpeza agressiva da fratura, cortar antes de documentar).
- **Preparação/parâmetros**: limitações graves ou de atenção nos resultados usados como evidência descontam mais que nos não usados.
- **Limitações**: afirmações corretas e indevidas, próximos ensaios, artefatos tomados por feições reais, exageros
  (ex.: "a dureza prova a fragilidade") e dados comprometidos usados como apoio.
- **Recursos**: cobertura das evidências-chave, repetições idênticas e aquisições inúteis. Gastar pouco não é premiado em si.

Não há correção de texto livre nem uso de IA.

## 7. Pontos que exigem revisão por um professor

1. **Taxonomia** mecanismo × causa × fator contribuinte adotada no caso (ver `gabarito.ts`): a "causa provável" é a trinca de fabricação
   em ZTA endurecida; material e procedimento são fatores. Outra leitura possível trataria material/procedimento como causa-raiz.
2. Plausibilidade de **trinca a frio** com arame tubular sem controle de umidade e aço ~0,45 % C sem preaquecimento a 12 °C.
3. Valores de dureza da tabela acima e a referência implícita para aço de baixo carbono.
4. Estimativa de teor de carbono pela fração de perlita como **indício** (estrutura fora do equilíbrio, segregação).
5. Regra prática de espaçamento (3 d) e distância à borda (2,5 d) e os vieses atribuídos a cada violação.
6. Visibilidade das feições na inspeção visual (ex.: região oxidada visível só com luz difusa após limpeza suave).
7. Afirmação de que a fratura final dúctil pequena indica tensão nominal moderada.
8. Escolha das evidências-chave e dos pesos da avaliação.
9. Textos das opções de interpretação, especialmente as "aceitáveis" e as "exageradas".
