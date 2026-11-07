# Hipóteses do modelo

Este jogo usa um **modelo qualitativo simplificado**. Ele serve para mostrar
*tendências* ("mais devagar → cordão mais largo"), não para prever valores.
Nenhum número do código veio de norma, catálogo ou medição; todos estão em
`src/modelo/parametros.ts` e foram escolhidos para o jogo ficar jogável.

Cada hipótese tem um código (H1, H2...) que aparece nos comentários do código.

- **Etapa 1:** movimento da tocha e formação do cordão (H1–H8).
- **Etapa 2:** tensão e velocidade de alimentação do arame (H1 revista, H3
  revista, H9–H12).
- **Etapa 3:** avaliação ao fim da tentativa — regularidade, largura e corte
  transversal esquemático (H13–H19).
- **Etapa 4:** explicação de como os ajustes e o movimento afetaram o
  resultado, e comparação com a tentativa anterior (H20–H25).
- **Etapa 5:** materiais, consumíveis, calor e fusão para missões, Arcade e
  torneios (H26–H37). A pontuação está em [PONTUACAO.md](PONTUACAO.md) e as
  missões em [MISSOES.md](MISSOES.md).

## Unidades

- Comprimentos em **"mm do jogo"**: a peça virtual tem 150 mm de comprimento e
  duas chapas de 50 mm de largura. A escala mm ↔ pixel é só de desenho.
- A taxa de deposição está em **"mm³/s do jogo"**. É um número de calibração,
  não um valor de processo.
- **Tensão e alimentação são posições de botão de 1 a 10**, como o mostrador
  de muitas máquinas. Elas **não** correspondem a volts nem a m/min. Converter
  para unidades reais exigiria escolher arame, gás e máquina, e dados medidos
  — coisa que o jogo não tem.

## Hipóteses

| Código | O que o jogo assume | Por que é aceitável agora | O que precisa de validação |
|---|---|---|---|
| **H1** *(revista na etapa 2)* | O volume de metal depositado por segundo é **proporcional à alimentação do arame** e não depende da tensão. Alimentação 5 = 100 mm³/s do jogo (era 140 até a revisão do reforço, H3 revista). | É conservação de massa: com o diâmetro do arame fixo, o volume que entra na poça por segundo é a velocidade do arame × a seção do arame. | Supõe que a fração do arame que vira cordão (rendimento de deposição) é sempre a mesma. Na prática respingos e perdas variam, inclusive com a tensão. Quanto variam deve vir de literatura ou ensaio. |
| **H2** | **Balanço de massa:** área da seção do cordão = taxa de deposição ÷ velocidade de avanço. | O metal que sai do arame fica na peça. | Ignora perdas e ignora o metal de base que se funde e se mistura (diluição). Descreve só o metal *acima* da chapa. |
| **H3** *(revista na etapa 2)* | A seção é um domo parabólico com **altura = razão × largura**. A razão agora depende da tensão (H9). Para a mesma área, largura ∝ 1/√razão. | Permite ir de "área" para "largura" com uma regra simples. | Na realidade a forma depende de muito mais (corrente, molhamento, ângulo da tocha, gás). O expoente −1/2 entre largura e velocidade é consequência da hipótese, **não** um resultado conhecido. |
| **H4** | Cada depósito se espalha ao longo da junta por uma gaussiana de σ = 2 mm. | Suaviza o cordão e evita "degraus" de pixel. | É artifício numérico. **Não** representa o tamanho real da poça de fusão. |
| **H5** | O mouse só manda leituras quando se mexe. Se passou mais de 50 ms entre duas leituras, a tocha ficou parada e só depois se deslocou (em até 50 ms). | Distingue "parado" de "andando devagar" sem depender dos quadros. | É sobre o *mouse*, não sobre soldagem. Atrasos maiores que 50 ms transformam um trecho curto em salto. |
| **H6** | Velocidade de avanço = deslocamento **ao longo da junta** numa janela de 200 ms ÷ 200 ms. | Média curta: reage rápido sem tremer demais. | Escolha de interface. Para avaliação final pode ser melhor medir por distância. |
| **H7** | O cordão é guardado como **uma única linha** ao longo de x: em cada posição há uma largura, um centro e uma forma média. | Basta para uma junta reta em um passe. | Não representa cordões lado a lado nem voltas sobre a mesma posição x. Se dois passes com tensões diferentes caem no mesmo lugar, a forma vira uma média ponderada pelo volume — simplificação sem base física. |
| **H8** | Brilho do metal quente, escamas, clarão do arco e respingos desenhados são **efeitos visuais**. | Deixam a cena legível. | Não são campo de temperatura, modelo de solidificação nem contagem de respingos. Não devem ser usados para avaliar nada. |
| **H9** *(nova)* | **Mais tensão → cordão mais achatado e mais largo**; menos tensão → mais estreito e mais alto (convexo). No jogo: razão altura/largura cai linearmente de 0,34 (tensão 1) a 0,16 (tensão 10); 0,25 na referência (H3 revista; antes 0,48 → 0,22). A tensão **não muda a quantidade** de metal (H1), só a forma. | É a tendência qualitativa que costuma ser ensinada: tensão maior → arco mais longo → o calor e o metal se espalham numa faixa mais larga. | A direção da tendência deve ser confirmada em fonte de referência. A forma linear e os extremos 0,34 e 0,16 são **inventados para o jogo**. Também simplifica: na prática tensão e alimentação interagem, e a forma não depende só da tensão. |
| **H10** *(nova)* | Para cada alimentação existe uma **tensão de equilíbrio do jogo**: `1,5 + 0,8 × alimentação`. Abaixo dela o arco é "curto demais"; acima, "longo demais"; até 1 ponto de diferença é "equilibrado". | Mostra a ideia de que tensão e alimentação precisam ser ajustadas *juntas*: mais arame pede mais tensão. | A ideia de "par ajustado" é ensinada na prática de MIG/MAG; **a reta e a tolerância são inventadas**. Na prática o ponto certo depende de arame, gás, modo de transferência e máquina. Até a etapa 8 o desequilíbrio **só gerava um aviso e um efeito visual**; desde a etapa 9 ele deixa o cordão irregular (H44). |
| **H11** *(nova)* | A faixa-alvo de velocidade do jogo **acompanha a alimentação**: a meta é um tamanho de seção fixo (o mesmo da etapa 1), então a faixa é 8–16 mm/s × (alimentação ÷ 5). | Decorre de H1 + H2: mais metal por segundo exige andar mais rápido para o mesmo tamanho de cordão. | A meta em si é arbitrária e não é recomendação de processo. |
| **H12** *(nova)* | Tensão e alimentação **não podem ser mudadas com o arco aberto**. | Cada trecho do cordão fica com ajustes bem definidos, e a avaliação futura fica mais simples. | Escolha de jogo. Na prática há máquinas com ajuste durante a solda. |

## Avaliação ao fim da tentativa (etapa 3)

A avaliação **só mede a geometria do cordão calculada pelo modelo**: largura,
altura, posição do centro e continuidade. Ela não sabe nada sobre o que
acontece dentro da peça.

| Código | O que o jogo assume | Por que é aceitável agora | O que precisa de validação |
|---|---|---|---|
| **H13** | A avaliação é **puramente geométrica**: usa as fatias do cordão (H2, H3, H7) e nada mais. Nenhum número dela fala de penetração, fusão, resistência ou defeitos internos. | É o que o modelo realmente calcula. | Uma avaliação de qualidade de verdade exige ensaios (visual normatizado, macrografia, ensaios destrutivos ou não destrutivos), que o jogo não simula. |
| **H14** | **Região avaliada:** do primeiro ao último ponto com cordão de pelo menos 1 mm de largura, descontando 5 mm em cada ponta. Dentro dela, trechos abaixo de 1 mm contam como **interrupções**. | As pontas do cordão no modelo são só a "cauda" do espalhamento numérico (H4, σ = 2 mm); 5 mm ≈ 2,5 σ evita medir esse artifício como se fosse irregularidade. | 1 mm e 5 mm são escolhas do jogo. Início e fim de cordão reais (cratera, falta de enchimento) não são modelados. |
| **H15** | **Regularidade** = coeficiente de variação da largura (desvio-padrão ÷ média) na região avaliada. Faixas do jogo: até 5 % "muito regular", até 12 % "regular", acima disso "irregular". | É uma medida simples e sem unidade: dá para comparar cordões de tamanhos diferentes. | As faixas são **arbitrárias**. Como largura ∝ √área (H3), a variação de largura é cerca de metade da variação de área — ou seja, depende da hipótese de forma. O espalhamento H4 alisa oscilações menores que uns 2 mm, então o jogo só "enxerga" irregularidade em escala maior que isso. |
| **H16** | **Alinhamento** = distância entre o centro do cordão e a linha da junta. Faixa do jogo: média até 1 mm "centrado", até 2,5 mm "levemente deslocado", acima "deslocado". Também medimos em quanto da junta o cordão **cobre a linha da junta** na vista de cima. | Mostra o efeito de a mão não seguir a junta. | Faixas arbitrárias. **Cobrir a linha da junta na vista de cima não significa que as duas chapas foram fundidas e unidas** — isso dependeria de penetração, que não é modelada. |
| **H17** | **Seção no alvo:** fração do comprimento avaliado em que a área da seção está dentro do alvo do jogo (8,75 a 17,5 mm², o mesmo alvo de H11). | Liga o resultado à faixa verde de velocidade. | O alvo é do jogo, não um requisito de projeto. |
| **H18** | **Corte transversal esquemático:** desenha o domo parabólico de H3 (largura, altura e deslocamento calculados) sobre duas chapas. A **espessura das chapas é ilustrativa** e a região abaixo do cordão aparece como "não modelada". | Mostra exatamente o que o modelo sabe — e deixa visível o que ele não sabe. | O desenho **não** mostra penetração, zona fundida, zona termicamente afetada nem defeitos. A forma real de um cordão não é necessariamente parabólica. |
| **H19** | Depois de avaliada, a tentativa fica **encerrada**: não dá para soldar mais nela, só começar outra. | A avaliação corresponde sempre ao cordão mostrado. | Escolha de jogo. |

**Importante:** um cordão "muito regular" e "centrado" no jogo pode, numa
solda real, ter falta de fusão, porosidade ou trincas. A tela de resultado
repete esse aviso.

## Explicação e comparação (etapa 4)

A explicação **não é gerada por IA**: são regras fixas, escritas no código,
que percorrem as mesmas relações que o modelo usa (H1, H2, H3, H9). Por isso,
*dentro do modelo*, a atribuição de causas é exata — o cordão do jogo só pode
mudar por esses caminhos. Numa solda real há outras causas (ângulo da tocha,
distância do bico à peça, gás, preparação da junta...), e o texto sempre
diz "no modelo" para não confundir as duas coisas.

| Código | O que o jogo assume | Por que é aceitável agora | O que precisa de validação |
|---|---|---|---|
| **H20** | **Velocidade efetiva por trecho:** a região avaliada é dividida em trechos de 5 mm; velocidade efetiva = 5 mm ÷ tempo de arco que a tocha passou dentro do trecho (tempo de permanência). Pausas e voltas para trás aumentam o tempo e, portanto, *diminuem* a velocidade efetiva. | É exatamente o que importa para o depósito: por H1 + H2, área ≈ taxa × tempo de permanência por mm (a menos do espalhamento H4). Também não depende dos quadros, porque o tempo vem da mesma integração que deposita o metal. | 5 mm é escolha do jogo. Num ensaio real a velocidade de avanço costuma ser medida de outra forma (comprimento ÷ tempo do passe). |
| **H21** | **Explicação por regras:** cada tema (quantidade de metal, regularidade, pausas, alinhamento, continuidade, forma, equilíbrio) tem uma regra que lê as medidas e escreve uma frase. As frases citam números do próprio modelo. | Transparente e testável: dá para ler a regra no código e conferir. | As regras só conhecem as causas do modelo. Não servem como diagnóstico de solda real. |
| **H22** | **Limiares das regras** (todos arbitrários): pausa = trecho com velocidade efetiva abaixo de **40 % da mediana dos trechos da própria tentativa**; variação de velocidade "relevante" a partir de 10 %. | Evitam comentar flutuações pequenas. A pausa é relativa porque a velocidade "normal" muda muito com a alimentação (H11): um limite fixo em mm/s marcaria como pausa um passe lento e constante com pouco arame. | Escolhas de jogo. Um passe inteiro muito lento não aparece como pausa — aparece na regra de quantidade de metal. |
| **H23** | **Contrafactuais** ("se você tivesse andado sempre na sua média...", "com tensão 2 pontos maior...") aplicam H2, H3 e H9 com os demais fatores fixos. | Mostram o tamanho de cada efeito *no modelo*. | Valem só dentro do modelo; não são previsão para solda real. |
| **H24** | **Comparação** sempre com a **tentativa avaliada imediatamente anterior** (tentativas recomeçadas sem avaliação não contam). "Melhor/pior" só aparece onde o jogo tem critério: regularidade (variação menor), alinhamento (desvio menor), seção no alvo (fração maior) e interrupções (menos). Largura, altura e velocidade não têm "melhor" — só "maior/menor". Diferenças menores que 2 pontos percentuais (regularidade, alvo) ou 0,3 mm (larguras, desvio) são tratadas como "igual". | Evita julgar o que não tem critério e evita comentar ruído. | Critérios e tolerâncias são do jogo. |
| **H25** | **Decomposição da mudança de largura média:** como no modelo largura ∝ √(taxa ÷ (velocidade × razão altura/largura)), a razão entre as larguras médias de duas tentativas é aproximadamente o produto de três fatores — alimentação, velocidade média e tensão — e o jogo mostra quanto cada um contribuiu. Também aparece quando a largura ficou igual mas dois ou mais fatores mudaram e se compensaram. Só é feita quando cada tentativa usou um único ajuste. | Consequência direta de H1, H2, H3 e H9. | "Aproximadamente": a média das larguras não é exatamente a largura na velocidade média, e pausas pesam diferente. Fora do modelo, não vale. |

## Relações conhecidas que o jogo **ainda não usa**

Registradas aqui para uma etapa futura. Todas são
tendências qualitativas que precisam ser conferidas em fonte de referência
antes de entrar no jogo:

- Em fontes de **tensão constante** (o caso comum em MIG/MAG), aumentar a
  alimentação do arame faz a máquina fornecer **mais corrente**.
- Mais corrente tende a dar **mais penetração** no metal de base.
- Para corrente e tensão fixas, andar mais devagar aumenta a energia
  entregue por milímetro de solda (aporte térmico).
- Tensão desequilibrada em relação à alimentação tende a aumentar respingos e
  instabilidade do arco.

Se essas relações entrarem um dia (por exemplo, uma penetração *relativa*
desenhada no corte), o corte continuará **esquemático** e não permitirá
afirmar se a solda tem ou não defeitos internos.

## Fontes consultadas

Consulta feita em 17/10/2026. Foi conferida **só a direção** das tendências
(sobe/desce), nunca os números do jogo. Nada no código foi alterado por causa
desta seção.

**Como ler:** cada item diz se a fonte **confirma**, **matiza** (confirma, mas
com ressalvas) ou **contradiz** a hipótese, e o que **segue sem fonte**.
"Confirma" vale para a direção *mantendo os demais fatores fixos*, que é como o
jogo usa a tendência. Nenhuma fonte contradisse uma hipótese.

**Limites da consulta:**

- As fontes são apostilas técnicas de fabricantes (ESAB, Sumig), um instituto
  de pesquisa (EWI), uma matéria da AWS, uma FAQ do TWI e um artigo da UFSC.
  Não são artigos revisados por pares sobre cada tendência.
- **Os livros-texto não foram abertos** (por exemplo, Marques, Modenesi e
  Bracarense, *Soldagem: Fundamentos e Tecnologia*, UFMG, 2011; AWS *Welding
  Handbook*). Vale conferir neles na biblioteca antes de tratar algo como
  fechado.
- Os gráficos das apostilas são casos específicos (por exemplo, aço com
  Ar-25 % CO₂ em curto-circuito; alumínio com argônio em spray). Servem para a
  direção, não para a faixa.
- Páginas citadas = número impresso no rodapé do PDF.

### Referências

- **[ESAB]** FORTES, Cleber (trad. e adapt.); VAZ, Cláudio Turani (rev.).
  *Soldagem MIG/MAG*. [S.l.]: ESAB Brasil, 2005 (última revisão em
  25/01/2005). Apostila. Cópia consultada em
  <https://www2.ufjf.br/profab/files/2016/09/ESAB-Apostila-MIG-MAG.pdf>.
- **[SUMIG]** SUMIG. *Soldagem a arco elétrico sob proteção gasosa: processo
  MIG/MAG*. Caxias do Sul: Sumig, rev. 07/2014. Manual. Disponível em
  <https://www.sumig.com/arquivo-catalogo/13_Apostilas/Apostila_Sumig_Processo%20MIG_MAG.pdf>.
- **[EWI]** EWI. *Gas Metal Arc Welding Basics, Part 1: Welding Current &
  Voltage*. 3 fev. 2024. Página técnica, sem autor indicado. Disponível em
  <https://ewi.org/gas-metal-arc-welding-basics-welding-current-welding-voltage>.
- **[AWS-CALOR]** FUNDERBURK, R. Scott. Key Concepts in Welding Engineering: a
  look at heat input. *Welding Innovation*, v. XVI, n. 1, 1999. Disponível em
  <https://app.aws.org/mwf/attachments//64/225564/keyconcepts2.pdf>.
- **[TWI]** TWI. *What is the difference between heat input and arc energy?*
  (FAQ técnica, sem data na página). Disponível em
  <https://twi-global.com/technical-knowledge/faqs/faq-what-is-the-difference-between-heat-input-and-arc-energy>.
- **[UFSC]** SCHWEDERSKY, Mateus Barancelli; DUTRA, Jair Carlos. *Um estudo da
  eficiência térmica dos principais processos de soldagem a arco*.
  Florianópolis: UFSC/LABSOLDA, 2011 (artigo de congresso; o nome do evento
  não foi conferido). Disponível em
  <https://labsolda.ufsc.br/publicacoes/artigos/2011_consolda_mateus.pdf>.

### H1 — taxa de deposição proporcional à alimentação do arame

**Veredito: confirma a proporcionalidade; matiza o rendimento "sempre igual".**

- **Confirma.** A [ESAB] (p. 76) calcula a taxa de deposição em kg/h
  diretamente da velocidade do arame (m/min) dividida pelos metros de arame por
  quilo. Ou seja, é a velocidade do arame convertida em massa, sem depender da
  tensão. Nesse trecho ela também diz que, no MIG/MAG, só uma parte pequena
  do metal se perde em respingos.
- **Matiza.** A [ESAB] (p. 32 e 36) diz que o CO₂ puro tem eficiência de
  deposição menor por causa dos respingos, e que misturas com menos CO₂
  melhoram essa eficiência. Então o rendimento muda com **gás e modo de
  transferência**; ele não é uma constante do processo.
- **Sem fonte:** se o rendimento de deposição muda **com a tensão** (a dúvida
  que a linha de H1 levanta). Nenhuma fonte consultada trata disso. A frase
  "respingos e perdas variam, inclusive com a tensão" continua sendo só
  hipótese.
- **Sem fonte:** qualquer valor numérico de rendimento. O jogo continua
  tratando como 100 % do arame virando cordão.

### H9 — mais tensão: cordão mais largo e achatado; menos tensão: mais estreito e convexo

**Veredito: confirma a direção, em três fontes independentes.**

- A [ESAB] (p. 79) diz que, ao subir a tensão (o comprimento do arco), a
  altura do cordão diminui e a largura aumenta, o topo fica mais achatado e o
  metal molha melhor a chapa. Ela destaca que o **tamanho total (a área) do
  cordão fica igual**; só a forma muda. Isso apoia o que H1 e H9 assumem:
  tensão muda a forma, não a quantidade de metal.
- A [SUMIG] (p. 11) explica pelo arco: tensão maior aumenta o cone do arco,
  aquece uma área maior e dá um cordão mais largo e mais baixo.
- A [EWI] diz que, subindo a tensão, o cordão fica mais achatado e a relação
  largura/profundidade aumenta.
- Lado "menos tensão": a [ESAB] lista tensão do arco muito baixa como causa de
  cordão convexo (p. 123) e de "gota fria", com molhamento ruim (p. 113).
- **Matiza:** a [ESAB] (p. 79–80) mostra que a forma também depende da
  extensão do eletrodo e da técnica (empurrando ou puxando). O jogo só tem a
  tensão como controle de forma. Pelas mesmas fontes, o tamanho do cordão
  depende de corrente e velocidade, e estes mexem pouco na forma (largura e
  altura sobem ou descem juntas) — o que combina com H3 para uma tensão fixa.
- **Sem fonte:** a forma **linear** da razão altura/largura e os extremos
  0,34 e 0,16. Os gráficos consultados mostram um caso só e não permitem dizer
  se a tendência vale em toda a faixa de tensão.

### H10 — tensão e alimentação ajustadas juntas; desequilíbrio piora estabilidade e respingos

**Veredito: confirma a ideia do "par ajustado" e a instabilidade; a parte dos
respingos só aparece de forma indireta.**

- A [ESAB] (p. 20, com o gráfico da p. 20) diz que, quando a corrente e a taxa
  de fusão do arame sobem, a tensão também precisa subir um pouco para manter o
  arco estável. É exatamente "mais arame pede mais tensão".
- A [SUMIG] (p. 4) diz que, para cada tensão de trabalho, existe uma
  velocidade de arame que deixa o arco e a transferência mais estáveis, com
  pouco respingo.
- A [ESAB] (p. 118) cita arco errático quando a tensão está muito baixa **ou**
  muito alta, o que sustenta os dois lados do aviso do jogo ("curto demais" e
  "longo demais"). Do lado baixo, ela lista também início de cordão ruim e
  quebra do arame (p. 123).
- **Matiza:** a [ESAB] (p. 18–19) explica que a fonte de tensão constante
  corrige sozinha o comprimento do arco e que a alimentação pode variar numa
  faixa considerável antes de dar problema. Ou seja, o "equilíbrio" real é uma
  **faixa**, e o ponto certo muda com o gás (a [ESAB] mostra curvas diferentes
  por gás, p. 20). O jogo já trata assim (tolerância de 1 ponto), mas a
  largura dessa faixa é inventada.
- **Sem fonte:** "desequilíbrio **aumenta os respingos**". Nenhuma fonte
  consultada mediu respingos contra a diferença entre tensão e alimentação; a
  [SUMIG] só sugere isso ao falar de "pouco respingo" no par ajustado. Também
  sem fonte: a reta `1,5 + 0,8 × alimentação` e a tolerância de 1 ponto.

### Relações que o jogo ainda não usa

**Alimentação do arame → corrente (fonte de tensão constante).
Veredito: confirma.**

- A [ESAB] (p. 18 e 65–66), a [SUMIG] (p. 3) e a [EWI] dizem a mesma coisa: em
  fonte de tensão constante, a corrente não é ajustada direto; ela segue a
  velocidade do arame, e mais arame dá mais corrente.
- **Matiza:** a relação depende do diâmetro e do tipo do arame e da extensão
  do eletrodo (a [ESAB], p. 66–68, mostra curvas por diâmetro e diz que
  esticar a extensão reduz a corrente para a mesma alimentação). Em arame fino
  e corrente alta a curva deixa de ser reta, por aquecimento do arame pela
  própria corrente. O jogo não tem arame nem extensão, então só pode usar a
  direção, não uma conversão.

**Corrente → penetração. Veredito: confirma, com ressalvas importantes.**

- A [ESAB] (p. 72) diz que a penetração é diretamente proporcional à corrente
  e que ela é o fator mais importante para a penetração. A [SUMIG] (p. 10) e a
  [EWI] concordam.
- **Matiza:** (1) a [ESAB] (p. 77–78) diz que, para a **mesma corrente**,
  depositar mais metal (por exemplo, com extensão maior e arame mais rápido)
  *reduz* a penetração, porque o metal extra amortece o arco. (2) Tensão e
  velocidade de soldagem têm efeito com **pico**: a penetração é máxima num
  valor e cai dos dois lados ([ESAB], p. 73; [SUMIG], p. 11). (3) A [EWI]
  indica que, em torno de 190 A (para certas combinações de metal e gás), a
  mudança do modo de transferência pode dar penetração em forma de dedo.
  Consequência para o jogo: se um dia houver penetração relativa, ela deve
  seguir a **corrente**, não a alimentação sozinha, e não deve ser crescente
  para sempre com a velocidade.
- **Sem fonte:** qualquer escala numérica de penetração.

**Velocidade de soldagem → aporte térmico. Veredito: confirma.**

- A [AWS-CALOR] define o aporte como potência (tensão × corrente) dividida
  pela velocidade de avanço, com fórmula em kJ por mm ou por polegada. Para
  tensão e corrente fixas, andar mais devagar aumenta a energia por
  milímetro, e andar mais rápido diminui.
- A [TWI] diz que o aporte é a energia do arco multiplicada por um fator de
  eficiência do processo, e dá 0,8 como valor usual para MIG/MAG.
- **Matiza:** a [UFSC] acha eficiência do arco de cerca de 0,84 para MIG/MAG,
  mas avisa que **não existe um valor único** por processo; um dos estudos que
  ela reúne mostra a eficiência diferente conforme o modo de transferência
  (maior em curto-circuito, menor em spray). A [AWS-CALOR] lembra que o aporte
  serve para comparar procedimentos do mesmo processo. Além disso, mais aporte
  por milímetro **não** significa mais penetração sem limite: velocidade muito
  baixa deixa a poça funcionando como isolante e a penetração cai ([ESAB],
  p. 73; [SUMIG], p. 11).
- **Sem fonte:** qualquer valor de aporte para o jogo (o jogo não tem volts nem
  amperes).

### Segunda consulta (20/10/2026): hipóteses da etapa 5

Mesma regra da primeira: foi conferida **só a direção** das tendências, nunca
os números do jogo, e **nada no código foi alterado**. Cobre H27, H28, H29,
H33, H35 e H36. As demais (H26, H30, H31, H32, H34 e H37) não foram objeto
desta consulta. Nenhuma fonte contradisse uma hipótese; três delas ficaram
com ressalvas que vale conhecer (H27 no inox, H33 em transferência por spray
e H36 em aporte muito alto).

| Hipótese | Veredito | Em uma linha |
|---|---|---|
| H27 gases | **Confirma** (alumínio, aço carbono) e **matiza** (inox) | Argônio puro para alumínio e CO₂ ou misturas para aço carbono batem. Para inox, "CO₂ puro nunca" bate, mas a ESAB prefere argônio com 1–2 % de O₂. |
| H27 diâmetros | **Confirma a faixa** | 0,8 a 1,2 mm está dentro do que as apostilas listam. Qual diâmetro vai em qual missão fica sem fonte. |
| H28 corrente | **Confirma a direção** | Mais alimentação e mais diâmetro dão mais corrente. A proporção e o expoente 2 seguem sem fonte. |
| H29 respingo | **Confirma** com ressalva | CO₂ puro respinga mais. Mas o respingo cai aos poucos com o teor de CO₂, e o jogo trata todas as misturas como iguais. |
| H33 penetração | **Confirma** o pico com a velocidade; **matiza** o gás | CO₂ penetra mais em curto-circuito. Em spray, misturas ricas em argônio também penetram fundo. |
| H35 materiais | **Confirma** as ordens e o óxido; **sem fonte** "esquenta muito" | Condutividade, dilatação e limpeza do óxido batem. O aquecimento acumulado maior no alumínio não apareceu em nenhuma fonte. |
| H36 deformação | **Confirma** com ressalva | Mais aporte e inox deformando mais batem, mas a deformação sobe só até um limite e depois cai. |

#### Referências novas desta consulta

- **[PARK]** PARK, Sang-Cheol; BANG, Hee-Seon; SEONG, Woo-Jae. Effects of
  Material Properties on Angular Distortion in Wire Arc Additive Manufacturing:
  Experimental and Computational Analyses. *Materials*, Basel, v. 13, n. 6,
  art. 1399, 2020. DOI 10.3390/ma13061399. Artigo revisado por pares.
  Disponível em <https://pmc.ncbi.nlm.nih.gov/articles/PMC7142524/>. Apesar do
  título, os ensaios são cordões sobre chapa (FCAW nos aços e GMAW pulsado no
  alumínio) e uma simulação por elementos finitos; não há deposição em
  camadas. Lido no texto completo.
- **[ASSDA]** ASSDA (Australian Stainless Steel Development Association).
  *Thermal Expansion and Design of Stainless Steel Fabrications* (FAQ 10).
  Criado em 16/04/2018 e atualizado em 16/05/2023, sem autor individual.
  Disponível em
  <https://assda.asn.au/blog/293-thermal-expansion-and-design-of-stainless-steel-fabrications>.
  Seção "Distortion during welding".
- **[AWS-INOX]** CAMPBELL, Richard D. Stainless Q&A: Why is there so much
  distortion when welding austenitic stainless steels? *Welding Journal*
  (AWS), set. 2025. Disponível em
  <https://www.aws.org/magazines-and-media/welding-journal/wj-sept-25-stainless-qa-why-is-there-so-much-distortion-when-welding-austenitic-stainless-steels/>.
  **Só o começo da resposta está aberto**; o resto é para assinantes.
- **[TWI-AL]** TWI. *How Do I Weld Aluminium? A Definitive Guide to the
  Welding Process* (FAQ técnica, sem data na página). Disponível em
  <https://www.twi-global.com/technical-knowledge/faqs/aluminium-welding>.
- **[TOTALMATERIA]** TOTAL MATERIA. *Fusion Welding of Aluminum and Its Alloys:
  Part One*. ago. 2005, sem autor indicado. Disponível em
  <https://www.totalmateria.com/zh/articles/fusion-welding-of-aluminum-and-its-alloys-1>.
- **[TWI-DIST]** TWI. FAQ sobre técnicas de soldagem para reduzir a distorção
  (título conforme o endereço da página: *which welding techniques can be used
  to minimise distortion*; sem data). Disponível em
  <https://twi-global.com/technical-knowledge/faqs/faq-which-welding-techniques-can-be-used-to-minimise-distortion>.
  Diferente da [TWI] da primeira consulta, que trata de aporte e energia do arco.
- **[FAHOR]** ABELING, Ariel; LANG, Marco Henrique; LERMEN, Richard Thomas.
  *Análise da distorção em chapas de aço AISI 304 soldadas através do processo
  TIG*. In: 4ª Semana Internacional de Engenharia e Economia FAHOR,
  Horizontina (RS), 5–7 nov. 2014. Artigo de graduação. Disponível em
  <https://www.fahor.com.br/publicacoes/sief/2014/Analise_da_distocao_em_chapas_de.pdf>.
  Usado **só como ponteiro**: ele repete uma afirmação de Modenesi (2001,
  *Soldabilidade dos Aços Inoxidáveis*, SENAI-SP), que **não foi aberto**.

[ESAB] e [SUMIG] são as mesmas da primeira consulta (páginas = número impresso
no rodapé). Foram relidas, desta vez nos capítulos de gases, arames, corrente,
penetração e defeitos.

**Limites desta consulta:**

- [ASSDA], [AWS-INOX], [TWI-AL] e [TOTALMATERIA] foram lidas por meio de um
  resumo automático da página, não linha a linha. Quem for citar em trabalho
  deve abrir a página e conferir a frase.
- Páginas técnicas de associações e de empresas (ASSDA, TWI, Total Materia)
  não são artigos revisados por pares. Só [PARK] é.
- Os livros-texto continuam **sem abrir** (Marques, Modenesi e Bracarense,
  2011; *AWS Welding Handbook*). Para H35 e H36 eles são a fonte natural.
- As figuras das apostilas não foram lidas em números; só o texto.

### H27 — gases por material e diâmetros de arame

**Veredito: confirma alumínio e aço carbono; matiza o inox; confirma a faixa de
diâmetros.**

- **Alumínio com argônio puro (MIG) — confirma.** A [ESAB] (p. 30) diz que o
  argônio puro é o gás usual de metais não ferrosos como o alumínio. A mesma
  apostila (p. 28–29) avisa que CO₂ e gases com oxigênio não devem ser usados
  em alumínio, porque formam óxido. A [TWI-AL] também indica argônio puro para
  MIG e TIG de alumínio.
- **Nomes MIG × MAG — confirma.** A [SUMIG] (p. 5–6) usa MIG para gás inerte e
  MAG para gás ativo (CO₂, argônio + CO₂, argônio + O₂), com o mesmo sentido do
  jogo.
- **Aço carbono com CO₂ puro ou argônio + CO₂ (MAG) — confirma.** A [ESAB]
  (p. 32) diz que o CO₂ puro é muito usado em aços. Ela e a [SUMIG] (p. 6)
  tratam as misturas de argônio com CO₂ como alternativa de menos respingo. A
  [ESAB] (p. 36) chama a mistura de 21–25 % de CO₂ de padrão de fato no
  curto-circuito em aço doce.
- **Inox — matiza.**
  - Confirma: o CO₂ puro não serve. A [ESAB] (p. 97) diz que ele "jamais deve
    ser utilizado" em inox.
  - Matiza: para inox, a [ESAB] prefere, em spray, argônio com 1 % de O₂ (ou
    2 %, se faltar molhamento) e, em curto-circuito, a mistura de hélio com
    pouco argônio e 2,5 % de CO₂ (p. 97 e 42; a p. 97 escreve O₂ nesse ponto,
    mas a p. 42 e a Tabela IV dizem CO₂). Argônio + 25 % de CO₂ só entra
    em solda de um passe sem exigência de resistência à corrosão (p. 97).
  - Apoia o "pouco CO₂": a [ESAB] (p. 41–42) cita misturas com 1–3 % de CO₂
    para inox e explica que o teor é mantido baixo para o aço não pegar carbono
    (o que prejudica a resistência à corrosão). Na p. 35 ela diz que argônio +
    CO₂ tem "aplicação limitada" em inox.
  - Conclusão: "argônio com baixo teor de CO₂" tem apoio, mas **não é a primeira
    escolha** dessa fonte. A [SUMIG] não trata de gás para inox.
- **Diâmetros — confirma a faixa.** A [SUMIG] (p. 7) diz que os arames sólidos
  vão de 0,6 a 1,6 mm. As tabelas da [ESAB] (p. 8 e 23) listam de 0,76 a
  1,6 mm, e a p. 36 cita 0,8 e 0,9 mm como típicos do curto-circuito em aço.
  Os três valores do jogo (0,8; 1,0; 1,2 mm) estão dentro da faixa.
- **Sem fonte:** qual diâmetro "pertence" a qual missão ou espessura, e os
  teores de CO₂ citados nas missões como valores exatos.

### H28 — corrente segue a alimentação e o diâmetro do arame

**Veredito: confirma a direção; matiza a proporção.**

- **Alimentação → corrente — confirma** (já na primeira consulta: [ESAB] p. 65–66,
  [SUMIG] p. 3). A [SUMIG] diz que a corrente é ajustada pela velocidade do
  arame.
- **Diâmetro → corrente — confirma.** A [ESAB] (p. 66) mostra curvas por
  diâmetro e afirma que, para a mesma alimentação, arame mais grosso dá corrente
  maior.
- **Matiza:** a curva só é quase reta em corrente baixa. Com arame fino e
  corrente alta ela entorta, por aquecimento do próprio arame ([ESAB], p. 66–67).
  O comprimento livre do arame também mexe na corrente ([ESAB], p. 67).
- **Sem fonte:** o expoente 2 do diâmetro e a constante 5 → 1,0. As curvas da
  [ESAB] existem, mas as figuras não foram lidas em números.

### H29 — CO₂ puro respinga mais que as misturas

**Veredito: confirma a direção; matiza o "igual para todas as misturas".**

- **Confirma.** A [ESAB] (p. 29) diz que o respingo tende a subir quando a
  mistura é rica em CO₂. Na p. 32 ela atribui ao CO₂ puro respingo alto e baixa
  eficiência de deposição, e na p. 35 diz que adicionar argônio ao CO₂ reduz o
  respingo. A [SUMIG] (p. 6) concorda: misturas de argônio respingam menos, e
  com 85 % ou mais de argônio em spray o respingo é desprezível.
- **Matiza:** a [ESAB] (p. 36) diz que menos CO₂ melhora a eficiência de
  deposição, e na p. 37 que a mistura de 50 % de CO₂ já se comporta quase como
  CO₂ puro em corrente alta. Ou seja, a perda varia **aos poucos** com o teor de
  CO₂. O jogo usa 1,00 para todas as misturas e só 0,94 para o CO₂ puro.
- **Sem fonte:** o valor 0,94 e qualquer percentual de perda por respingo.

### H33 — gás e penetração; pico com a velocidade

**Veredito: confirma o pico com a velocidade; matiza "CO₂ penetra mais".**

- **Pico com a velocidade — confirma** (também na primeira consulta). A
  [ESAB] (p. 73) diz que a penetração é máxima numa velocidade e cai se a
  velocidade for menor ou maior: devagar demais, o metal acumulado amortece o
  arco; rápido demais, falta tempo para fundir. A [SUMIG] (p. 11) diz o mesmo.
  Isso é o que o "amortecimento" do jogo representa.
- **CO₂ → mais penetração — confirma em curto-circuito.** A [SUMIG] (p. 6) diz
  que a penetração do CO₂ puro é bem maior que a das misturas nesse modo. A
  [ESAB] (p. 32) lista "penetração profunda" como vantagem do CO₂, e (p. 36–38)
  diz que mais CO₂ na mistura dá mais penetração e mais fusão lateral.
- **Matiza — em spray.** A [SUMIG] (p. 6) diz que, em spray, as misturas ricas
  em argônio também dão penetração elevada. A [ESAB] (p. 30–31) descreve o
  argônio como produtor de penetração funda em forma de "dedo", mais estreita.
  O CO₂ puro nem entra em spray ([SUMIG], p. 9). Então "CO₂ penetra mais que
  mistura de argônio" vale com cuidado, e depende do modo de transferência, que o
  jogo não modela.
- **Sem fonte:** o fator 1,10, o índice F, as faixas 1 / 2 / 2,6 e a fórmula
  inteira do aporte necessário. O jogo continua tratando F como **resultado
  sintético**.
- **Bônus, só direção:** a [ESAB] (p. 113) dá como causas de falta de fusão
  apontar o arco para o meio de uma junta larga, velocidade muito baixa ou
  tensão muito baixa, e óxido de alumínio. Isso combina com H34 e com H35.

### H35 — materiais: condutividade, dilatação e óxido do alumínio

**Veredito: confirma as ordens de propriedades e a limpeza do óxido; o "esquenta
muito" do alumínio segue sem fonte.**

- **Condutividade térmica: alumínio ≫ aço carbono > inox austenítico —
  confirma.**
  - [PARK]: a liga de alumínio ensaiada conduz cerca de 4,4 vezes mais que o
    aço carbono (seção 4.3); o inox ficou em cerca de 0,6 vez o aço carbono
    (seção 4.8).
  - [ASSDA]: o inox austenítico conduz algo em torno de 30 % do aço carbono.
  - [TOTALMATERIA] e [TWI-AL]: o alumínio conduz de 3 a 5 vezes mais que o aço
    e por isso pede mais aporte de calor. A [ESAB] (p. 100) também cita a alta
    condutividade do alumínio.
  - Matiza: o tamanho da razão do inox muda de uma fonte para outra (0,6 contra
    cerca de 0,3), porque depende da liga e da temperatura. Só a **ordem**
    é segura.
- **Dilatação: inox maior que aço carbono — confirma.** A [ASSDA] cita 17
  contra 12 µm/m·°C. A [PARK] fala em cerca de 1,5 vez. A [FAHOR] repete a
  afirmação de Modenesi (2001) de que o inox tem dilatação alta e difusividade
  térmica baixa.
- **Óxido do alumínio — confirma.** A [ESAB] (p. 89 e 113–114) diz que limpar é
  "extremamente importante" no alumínio, que o óxido é refratário e insolúvel,
  que atrapalha a fusão, e que a melhor defesa é tirá-lo logo antes de soldar.
  A [TWI-AL] e a [TOTALMATERIA] dizem a mesma coisa.
- **Matiza (óxido):** a [ESAB] (p. 33 e 105) explica que o próprio arco quebra
  parte da película à frente da poça (com argônio e a tocha "empurrando"), mas
  isso não substitui a limpeza antes. As fontes divergem na temperatura de
  fusão do óxido (cerca de 1.927 °C na [ESAB]; cerca de 2.060 °C na [TWI-AL]);
  o jogo não usa esse número.
- **Inox "precisa de menos aporte" — apoio só indireto.** A [ASSDA] diz que o
  calor fica concentrado no inox e recomenda usar a menor corrente que dê boa
  solda.
- **Sem fonte:** que a chapa de alumínio **acumula** mais calor ao longo do
  passe (g, τ e e da tabela de parâmetros). As fontes dizem o contrário no
  detalhe: a alta condutividade espalha o calor depressa. A única pista a favor
  é que o pré-aquecimento às vezes ajuda em seções grossas ([TOTALMATERIA]).
  Também sem fonte: o fator 0,6 sem limpeza e todos os valores da tabela.

### H36 — mais aporte, mais deformação; inox deforma mais

**Veredito: confirma as duas direções; matiza "sempre cresce com o aporte".**

- **Inox deforma mais que aço carbono — confirma.** A [PARK] relata que o inox
  teve a maior distorção angular entre todos os materiais ensaiados. A
  [AWS-INOX] diz que os aços da série 300 distorcem bem mais que os aços
  carbono e liga isso à condutividade e à dilatação. A [ASSDA] e a [FAHOR]
  dizem o mesmo.
- **Matiza (causa):** a [PARK] (seções 4.3 e 4.8) conclui que a **dilatação**
  é a propriedade que mais explica o efeito do inox e que a condutividade pesa
  pouco. A explicação comum ("o calor fica concentrado") é plausível, mas essa
  fonte não a escolhe como causa principal.
- **Mais aporte → mais deformação — confirma, com limite.** A [PARK] mostra a
  distorção angular subindo com o aporte (energia por mm, ajustada pela espessura)
  **até um limiar**. Acima dele ela cai. O limiar depende do material: ficou
  mais baixo no alumínio e mais alto no inox e nos aços. O jogo, que faz D
  crescer sempre com o aporte, representa só o trecho de baixo.
- **Alumínio:** a [PARK] diz que ele segue uma tendência parecida com a do
  inox, com limiar mais baixo. A [TWI-AL] avisa que o excesso de calor pode
  causar distorção no alumínio. A ordem do jogo (inox > alumínio > aço carbono)
  é coerente com isso, mas só como direção.
- **Fora do pedido, só um aviso:** a [TWI-DIST] fala de tamanho de solda e
  número de passes, mas **não** trata de aporte térmico nem de materiais.
- **Sem fonte:** os valores f (1,0 / 1,7 / 1,2), a divisão por 2,07 e as
  faixas de nota (até 1 / 2 ou mais). A [PARK] também traz uma inconsistência
  interna de rótulos nas tabelas de aporte; por isso não se usou nenhum número
  dela.

### O que segue sem fonte

Nada abaixo foi confirmado, e nada disso deve ser apresentado como dado real:

- Todos os **números** do jogo: 100 mm³/s na alimentação 5, razão 0,34 → 0,16,
  reta `1,5 + 0,8 × alimentação`, tolerância de 1 ponto, faixa de 8–16 mm/s.
- A **linearidade** de H9 em toda a faixa de tensão.
- O efeito da **tensão sobre o rendimento de deposição** (H1).
- O efeito do **desequilíbrio sobre a quantidade de respingos** (H10).
- Qualquer conversão dos botões de 1 a 10 para volts, m/min ou ampères.
- A forma **parabólica** do cordão (H3) e a dependência largura ∝ 1/√velocidade
  (H2 + H3): esta consulta não tratou disso. A [ESAB] (p. 79) só confirma, em
  geral, que andar mais devagar aumenta largura e altura.
- Os itens H4–H8 e H11–H25 não foram objeto da primeira consulta.

Acrescentado pela segunda consulta (etapa 5):

- Todos os **números** da etapa 5: tabela de parâmetros por material (n, e, g,
  τ, f), fatores 0,94 e 1,10 do gás, 0,6 sem limpeza, constantes de H28, H31,
  H33 e H36, faixas de F e de D.
- O **expoente 2** do diâmetro do arame (H28) e a constante de normalização da
  corrente relativa.
- A ideia de que a chapa de **alumínio acumula mais calor** ao longo do passe
  (H32/H35). As fontes consultadas só dizem que o calor escoa rápido.
- A **escolha de diâmetro por missão** (H27) e os teores de CO₂ como valores
  exatos.
- A **queda da deformação acima de um limiar de aporte** existe na literatura
  ([PARK]); o jogo não a representa.
- Não consultados: H26, H30, H31, H32, H34 e H37. H30 só tem apoio indireto
  (a mesma [ESAB] p. 20 de H10), H31 repete a definição de aporte da primeira
  consulta e H34 só ganhou o "bônus" de direção citado em H33.
- **Livros-texto** ainda não abertos; vale conferir H35 e H36 neles.

## Materiais, consumíveis, calor e fusão (etapa 5)

A etapa 5 (missões, Arcade e torneios) precisa de uma nota de **integridade
prevista**. Para isso o modelo ganhou grandezas novas. Todas continuam em
unidades relativas do jogo; nenhuma é volt, ampère, kJ/mm ou °C. A regra
"a aparência não indica qualidade interna" continua valendo: a integridade
prevista vem do **aporte de calor, da cobertura das bordas e da preparação**
— nunca da aparência do cordão — e é sempre rotulada como **resultado
sintético do modelo**.

O que é **fixo**, **configurável** ou **controlado durante a execução**:

| Grandeza | Situação nesta versão |
|---|---|
| Percurso da tocha, velocidade de avanço, abrir/fechar o arco | **Controlados** durante a execução (mouse, caneta ou controle) |
| Tensão e alimentação do arame (botões 1–10) | **Configuráveis** na preparação; travados com o arco aberto (H12) |
| Diâmetro do arame e gás de proteção | **Configuráveis** entre as opções compatíveis da missão (H27) |
| Limpeza do óxido (alumínio) | **Configurável** na preparação (H35) |
| Polaridade | **Fixa**: corrente contínua, eletrodo positivo (CC+), a usual em MIG/MAG com arame sólido |
| Ângulo de trabalho | **Fixo**: tocha perpendicular à chapa no sentido transversal |
| Técnica (ângulo de deslocamento) | **Configurável** na bancada desde a etapa 6: empurrando, neutra ou puxando (H38); fixa durante a tentativa |
| Movimento da tocha (tecimento) | **Retirado da bancada** na etapa 11: a tocha segue a junta em linha reta. Oscilações feitas à mão continuam contando (H39) |
| Tipo de junta | **Definido pela missão** (ou escolhido na peça de teste) desde a etapa 11: topo reto, topo em V, em T, sobreposta ou de canto (H46). A junta é sempre reta; os formatos curvos de H41 só existem em dados antigos |
| Giro da peça e tombamento | **Controlados** com o arco **fechado** desde a etapa 11 (H42, H47); peças presas na estrutura não mexem |
| Distância bico–peça / extensão do eletrodo | **Fixa** e não modelada |
| Vazão de gás | **Fixa** e considerada adequada; não modelada |
| Posição de soldagem | **Resultado** do giro e do tombamento da peça (H47): plana, horizontal, vertical ou sobrecabeça |

| Código | O que o jogo assume | Por que é aceitável agora | O que precisa de validação |
|---|---|---|---|
| **H26** | Só **MIG/MAG** é jogável. Eletrodo revestido e TIG aparecem como "não disponíveis". | O jogo só tem modelo para MIG/MAG; oferecer os outros seria só trocar o nome de um comportamento copiado. | Modelos próprios (corrente constante, eletrodo consumível revestido, eletrodo não consumível) antes de liberar. |
| **H27** | Cada missão oferece só **combinações compatíveis**: aço carbono com mistura argônio + CO₂ ou CO₂ puro (MAG); inox austenítico com argônio e baixo teor de CO₂ (MAG); alumínio com argônio puro (MIG). Diâmetros de arame entre 0,8, 1,0 e 1,2 mm conforme a missão. | Gás inerte para alumínio e gás ativo para aços é o que se ensina na prática; o jogo usa os nomes MIG (gás inerte) e MAG (gás ativo) com esse sentido. | Conferir as combinações e os teores na apostila [ESAB] (capítulo de gases) ou em livro-texto. Os teores citados nas missões são descritivos, não exigência normativa. |
| **H28** *(revista na v1.3)* | **Corrente relativa** derivada da relação de fusão do arame: o volume de arame por segundo V = (alimentação ÷ 5) × (diâmetro ÷ 1,0 mm)² precisa ser fundido por V = (1 − r)·I + r·(DBCP ÷ 15)·I² ÷ d², com r = 0,3, e I é a raiz positiva. Na referência (alimentação 5, arame 1,0 mm, DBCP 15 mm) I = 1. Ela continua **derivada**, não é um controle. Até a v1.2 era I = V (corrente igual à quantidade de metal). | Em fonte de tensão constante a corrente é a que funde o arame na velocidade em que ele chega ([ESAB], [SUMIG], [EWI]). A forma "parte proporcional a I mais parte proporcional a L·I²" é a equação de taxa de fusão de Lesnewich (1958) [LESNEWICH]: o arco funde ∝ I e o arame livre esquenta por efeito Joule ∝ L·I²/A. Consequências com direção documentada: a corrente cresce menos que a alimentação, e mais DBCP pede menos corrente para o mesmo arame [EWI-CTWD]. | A fração r = 0,3 e a normalização são **do jogo**; os coeficientes reais dependem do arame, do gás e da máquina, e não há ampères. A relação vale para fonte de tensão constante (não para pulsado). |
| **H3 revista** *(reforço realista)* | O cordão estava alto demais: um cordão de 8 mm de largura no topo de 3 mm tinha cerca de 2,9 mm de reforço, quase a espessura da chapa. A razão altura/largura passou de 0,35 para **0,25** na referência (faixa da tensão 0,34 → 0,16) e o metal por segundo de 140 para **100 mm³/s**, na mesma proporção, para as larguras ficarem iguais. O mesmo cordão de 8 mm passa a ter cerca de 2,1 mm de reforço (a 10 mm/s na referência, cerca de 1,6 mm). A junta em V, que precisa encher o chanfro, teve a velocidade de referência baixada de 7 para 5 mm/s. | Referência de ordem de grandeza: a ISO 5817 aceita reforço até cerca de 1 mm + 0,15 × largura no nível intermediário (C), ≈ 2,2 mm para 8 mm de largura. | Os números continuam do jogo; a norma serve só de ordem de grandeza, não de critério de aprovação. |
| **H29** | **Taxa de deposição** Q = 100 × (alimentação ÷ 5) × (diâmetro ÷ 1,0)² × η, com η (rendimento relativo) = 1,00 para as misturas e para o argônio e 0,94 para CO₂ puro. O desequilíbrio tensão × alimentação (H10) **não** altera η: continua só como aviso. | Conservação de massa (H1) mais perdas por respingo do gás: CO₂ puro dá mais respingo ([ESAB] p. 32 e 36 — direção confirmada). O desequilíbrio ficou de fora porque "desequilíbrio aumenta respingo" segue sem fonte, e porque a [ESAB] (p. 79) indica que a tensão não muda a área do cordão. | O valor 0,94 é do jogo. |
| **H30** | O equilíbrio de H10 passa a usar a corrente: tensão de equilíbrio = 1,5 + 4 × I. Com arame de 1,0 mm é a mesma reta de antes. | "Mais corrente pede mais tensão" ([ESAB] p. 20). | A reta continua inventada. |
| **H31** | **Potência relativa** P = I × (tensão ÷ 5,5) e **aporte relativo** por mm = P × tempo de permanência por mm. | É a forma da definição de aporte térmico (tensão × corrente ÷ velocidade) em [AWS-CALOR]. | A eficiência do arco é tratada como constante ([TWI] e [UFSC] mostram que ela varia). Unidades relativas, sem kJ/mm. |
| **H32** | **Aquecimento acumulado da peça**: um único valor T por peça, que sobe com a potência e esfria com o tempo: dT/dt = (g × P − T) ÷ τ, com g e τ do material. Resolvido de forma exata, então não depende dos quadros. Desde a v1.3, arco aberto **fora da peça** não aquece a peça (só conta tempo de arco). | Captura a ideia de que a chapa vai esquentando ao longo do passe, e que isso pesa muito mais no alumínio. | Não há distribuição de temperatura no espaço, nem °C. Os valores de g e τ são do jogo. |
| **H33** | **Índice de fusão** F (sintético) em cada posição = aporte efetivo ÷ aporte necessário × amortecimento × fator do gás × fator de limpeza. Aporte efetivo = aporte × (1 + e × T). Aporte necessário = 0,01677 × espessura × n do material. Amortecimento = 1 ÷ (1 + (seção ÷ 25 mm²)²). Faixas: F < 1 **falta de fusão prevista**; 1 a 2 **adequada**; 2 a 2,6 **fusão excessiva**; acima de 2,6 **perfuração prevista**. Fator do gás: CO₂ puro 1,10; demais 1,00. | Mais aporte → mais fusão; chapa mais grossa pede mais. O amortecimento representa o metal acumulado sob o arco, que reduz a fusão quando se anda devagar demais — a penetração tem um pico com a velocidade ([ESAB] p. 73 e 77–78; [SUMIG] p. 11). CO₂ costuma dar mais penetração que misturas ricas em argônio. | É a hipótese mais forte da etapa. Ignora o pico de penetração com a tensão, o modo de transferência e a geometria real da poça. A direção "CO₂ → mais penetração" e todos os números precisam de fonte. **Não é previsão de solda real.** |
| **H34** | **Bordas da junta**: o cordão só "pega" as duas chapas se cobrir as duas bordas: |centro| + abertura ÷ 2 + 0,5 mm ≤ largura ÷ 2. | Representa o erro mais comum de mão: soldar ao lado da junta. | Margem de 0,5 mm é do jogo. |
| **H35** | **Materiais** com parâmetros próprios (tabela abaixo). Alumínio: precisa de mais aporte (o calor escoa rápido), esquenta muito ao longo do passe e exige **remover o óxido** (sem limpeza, F × 0,6). Inox austenítico: precisa de menos aporte (o calor fica concentrado) e **deforma mais**. Aço carbono: referência. | Ordem de condutividade térmica alumínio ≫ aço carbono > inox austenítico, e dilatação do inox maior que a do aço carbono, são conhecimento básico de materiais. A camada de óxido do alumínio é o motivo da limpeza antes de soldar. | Os números da tabela são **do jogo**. A ordem das propriedades deve ser conferida em livro-texto de materiais ou de soldagem. |
| **H36** | **Deformação** (índice D): D = (aporte médio ÷ aporte necessário) × f do material ÷ 2,07. Até 1 não perde pontos; em 2 ou mais perde todos. | Mais calor do que o necessário → mais deformação; inox deforma mais. | Um número só; não há forma, direção nem medida de empenamento. |
| **H37** | As **extremidades** (2 mm de cada lado do trecho exigido) não entram na integridade. | O modelo não representa cratera nem início de cordão. | Escolha do jogo. |
| **H38** *(etapa 6)* | **Técnica de deslocamento.** *Puxando* (tocha inclinada para trás, arco apontado para o metal já depositado): cordão mais alto e estreito (razão altura/largura × 1,12) e mais fusão (F × 1,12). *Empurrando* (tocha inclinada para a frente): cordão mais largo e baixo (× 0,88) e menos fusão (F × 0,90). *Neutra*: o modelo das etapas anteriores. A quantidade de metal não muda. | É a tendência ensinada para MIG/MAG; a [ESAB] (p. 79–80) mostra que a forma do cordão depende da técnica empurrando/puxando (ver "Fontes consultadas", H9). | Os fatores 1,12, 0,88 e 0,90 são **do jogo**. Desde a v1.3 o ângulo de avanço tem valor: ±20° da normal à face (faixa usual de 10–20°), usado na tocha 3D e no relatório; o modelo continua com só três posições. No alumínio, a prática costuma recomendar empurrar (melhor proteção gasosa e limpeza); o jogo mostra isso como **dica**, sem modelar proteção gasosa. |
| **H39** *(etapa 7)* | **Movimento da tocha (tecimento).** Além da linha reta, a tocha pode oscilar de lado sobre a junta: *zigue-zague*, *meia-lua* (para um instante nas pontas) ou *círculos*. O modelo não acompanha a poça no espaço: guarda, em cada posição da junta, o **espalhamento lateral** σ da tocha (desvio-padrão da posição lateral, ponderado pelo metal depositado). Oscilação feita à mão entra pelo σ medido; a escolhida na bancada soma σ = A × k, com amplitude A = 2 mm e k = 0,58 (zigue-zague, distribuição uniforme), 0,80 (meia-lua, mais tempo nas pontas) e 0,71 (círculos). Efeitos: (1) **largura** w = √(w₀² + 12σ²), onde w₀ é a largura de H3; (2) **a área não muda** (H2), então o reforço cai: altura = área ÷ (⅔ w); (3) o calor se espalha na largura: F × (w₀ ÷ w)^0,5. A cobertura das bordas (H34) usa a nova largura. | Tecer o cordão para alargá-lo, achatá-lo e cobrir melhor as bordas, à custa de avançar mais devagar e de concentrar menos o calor no centro, é a tendência ensinada em cursos de soldagem. Separar o efeito em "espalhamento lateral" mantém o balanço de massa e vale para qualquer dispositivo. | A amplitude, os valores de k, o fator 12 (largura de uma distribuição uniforme = √12 σ) somado em quadratura e o expoente 0,5 são **do jogo**. Não há frequência de oscilação no modelo: o vaivém desenhado na tela é **só visual**. Não representa mordedura, sobreposição de escamas, nem a diferença real entre padrões — só a direção "mais largo, mais baixo, menos fusão no centro". Conferir em livro-texto ou apostila antes de usar como regra. |
| **H40** *(etapa 7)* | **Cores dos materiais** são só visuais (H8): aço carbono mais escuro e azulado (carepa de laminação), inox prateado levemente quente, alumínio claro e fosco. O cordão segue a cor do material. | Ajuda a reconhecer o material num relance; o nome do material também aparece sempre (a informação não depende só da cor). | Cores escolhidas pelo jogo, sem fidelidade fotográfica. |
| **H41** *(etapa 8)* | **Formato da junta.** Além da reta, a junta pode ser uma **curva em S**, um **canto arredondado** (L) ou **circular** (quase uma volta, como uma tampa). Todas têm 150 mm de comprimento e raio de curvatura de pelo menos 15 mm. O modelo continua unidimensional: a posição da tocha é convertida para (s, n) — **s** é a distância percorrida **ao longo da junta** e **n** o desvio lateral, medido na perpendicular — pelo ponto mais próximo da linha da junta. Tudo o que vem depois (depósito, fusão, velocidade, pontuação) é o modelo de antes, em (s, n). | Num cordão sobre uma curva suave, o que importa para o jogo é andar na velocidade certa **ao longo** da junta e ficar em cima dela; com raio ≥ 15 mm, o ponto mais próximo é único até 15 mm de distância da junta. Assim a reta reproduz exatamente as etapas anteriores e as curvas reaproveitam o modelo sem números novos. | A curvatura **não muda** a física: não há acúmulo de calor extra no lado de dentro da curva nem no canto, nem efeito de borda de chapa. Uma tocha a mais de 15 mm da junta pode ser projetada no trecho "errado" (não muda o resultado: lá não há cordão). No controle, o analógico anda ao longo da junta (direita = avançar), o que deixa a curva mais fácil que no mouse — diferença de dispositivo a medir. |
| **H42** *(etapa 8)* | **Girar a peça** (v1.3: arrastar com o botão direito do mouse, ou segurar E/B e mover a caneta; botões na tela; direcional do controle a 60°/s; "Como chegou" volta à posição inicial; só com o arco fechado). A câmera é livre em volta da peça (botão do meio, Espaço com a caneta ou analógico direito), também só com o arco fechado. Com o arco aberto nada gira: ninguém posiciona a peça e solda ao mesmo tempo. O giro muda **só a vista e o caminho que a mão faz**; a solda continua em posição plana. Com o mouse ou a caneta parados e a peça girando, o jogo gera leituras a cada quadro (a posição da tocha na peça muda). O zoom não muda com o giro (a peça não encolhe); girada, as pontas podem sair da tela. A peça gira em torno do centro da chapa ou, na junta circular, do centro do círculo. | Girar a peça para trabalhar numa posição confortável é prática comum; a posição plana não muda porque o eixo do giro é perpendicular à chapa. | As leituras geradas pelo giro saem nos quadros da tela, então o resultado de um passe feito **girando** depende um pouco da taxa de quadros (o resto do jogo não depende). No controle o giro é só visual (o analógico já anda ao longo da junta). |
| **H43** *(etapa 8)* | **Peça mais viva** (só visual, como H8): faíscas saindo do arco (um pouco mais com CO₂ puro e com o arco fora do equilíbrio), fumaça subindo, poça brilhante sob a tocha e um halo de calor na chapa em volta do trecho recém-soldado, que cresce com o aquecimento acumulado (H32) e é fraco no alumínio. | Deixa a cena legível e reage ao que o jogador faz. "CO₂ dá mais respingo" tem a mesma fonte de H29. | Nada disso entra no modelo nem na avaliação: não é contagem de respingo, campo de temperatura nem previsão de qualidade. As faíscas são sorteadas a cada quadro. |
| **H44** *(etapa 9)* | **Arco fora do equilíbrio deixa o cordão irregular.** Até aqui o desequilíbrio de H10 só gerava aviso. Agora cada depósito leva uma **instabilidade** I = mín(1, (|desvio| − 1) ÷ 3), com desvio = tensão − tensão de equilíbrio (zero dentro da tolerância de 1 ponto). Em cada posição da junta, a instabilidade média (ponderada pelo metal) faz a largura oscilar ao longo do cordão: w' = w × (1 + 0,28 × I × r(x)), com r(x) um padrão fixo e suave entre −1 e 1 (o mesmo em toda tentativa). A **área não muda** (H2): onde alarga, abaixa. Arco **curto** (tensão baixa) puxa o padrão para gotas mais altas e estreitas; arco **longo** (tensão alta), para cordão mais largo e baixo. Como a largura varia, a regularidade (e a nota) piora. | A [ESAB] (p. 118) cita **arco errático** com tensão muito baixa ou muito alta; a [SUMIG] (p. 4) liga o par tensão × alimentação à estabilidade. Cordão irregular é a consequência visível de um arco instável. O padrão fixo r(x) deixa o resultado igual no replay e com qualquer taxa de quadros. | O 0,28, a escala de 3 pontos e o padrão r(x) são **do jogo**. Não há respingo contado, mordedura, falta de fusão na margem nem curto-circuito simulado: só a irregularidade de largura. |
| **H45** *(etapa 9)* | **Som do arco** (só sensorial, como H8): com o arco equilibrado, o chiado contínuo de "bacon fritando"; arco **curto**, estalos fortes e irregulares (o arame batendo na poça); arco **longo**, chiado mais agudo e zumbido, com estalos esparsos. O volume e a mistura acompanham o desvio de H10 a cada quadro. Pode ser desligado no botão de som do topo. Na tela, o clarão também muda: curto pisca e engasga, longo fica maior e "passeia". | Soldadores regulam a tensão muito pelo som do arco; o som em equilíbrio parecido com fritura é descrição comum de prática em MIG/MAG. Dá ao botão de tensão uma resposta imediata. | O som é **sintetizado** (ruído filtrado), não é gravação nem medida; não entra no modelo nem na nota. A descrição "bacon fritando" é de prática, sem fonte formal aqui. |
| **H46** *(etapa 11)* | **Tipos de junta.** As cinco juntas básicas da prática, menos a de aresta: **topo reto** (bordas retas com abertura, a referência: a seção de sempre, H3), **topo em V** (chanfro de 60° com face de raiz de 1 mm, em chapa grossa), **em T**, **sobreposta** e **de canto externa** (as três com solda de ângulo, o *filete*, num entalhe de 90°). O metal é o mesmo de sempre (H2); muda a **forma**: no **V** ele enche primeiro o chanfro (área = abertura × espessura + (espessura − raiz)² × tg 30°) e só o que sobra vira reforço, que passa das bordas do V em pelo menos 1,4 mm; se faltar metal, o V fica **aberto** (novo estado "chanfro não preenchido", que não conta como íntegro) e o jeito é andar devagar ou fazer outro passe por cima. No **filete** a seção é um triângulo de pernas z (área z²/2) mais uma convexidade pela tensão: razão de H9 − 0,25 (tensão baixa → convexo; alta → plano ou côncavo); mirar fora da raiz deixa uma perna maior que a outra, e uma perna com menos da metade da outra conta como "borda" (uma chapa mal fundida). A largura do desenho, no filete, é a **face** do cordão. O aporte necessário (H33) ganha um fator da junta: topo 1; V 1,1; T 1,3; sobreposta 1,55; canto 1,1. | Os cinco tipos básicos (topo, T, canto, sobreposta e aresta) são a classificação usual atribuída à AWS ([UTI], [RSI]); o chanfro em V para chapa grossa e a solda de ângulo no T, na sobreposta e no canto são as preparações típicas de cada um. Encher o chanfro antes de haver reforço é balanço de massa; mais de um passe em chapa grossa é a prática. Uma junta em T espalha o calor para mais chapa que um topo, por isso pede mais aporte. | O ângulo do chanfro, a face de raiz, a sobra de 1,4 mm, a convexidade, o critério das pernas e **todos os fatores de fusão** são **do jogo**, calibrados para que cada missão tenha solução (teste `tests/missoes.test.ts`). Não há passes de raiz e acabamento distintos (o metal só se soma), penetração na raiz, mordedura, nem a junta de aresta. |
| **H47** *(etapa 11)* | **Posição de soldagem pela gravidade.** A peça pode ser **tombada** de 0° (face da junta para cima) a 180° (de cabeça para baixo) e **girada** no próprio plano (H42), sempre com o arco fechado; a câmera fica de frente para a junta e quem gira é o mundo (bancada, sol, gravidade). Da direção da gravidade nos eixos da junta (ao longo t, de lado n, para fora da face w) vêm o nome da posição — **plana** (até 30° da plana), **sobrecabeça** (até 45° dela), senão **vertical** ou **horizontal** — e o efeito na poça, por depósito: razão altura/largura × (1 + 0,35·cabeça + 0,25·subindo − 0,25·descendo + 0,1·lado); fusão × (1 − 0,2·cabeça + 0,15·subindo − 0,3·descendo); e o metal escorre 0,8 mm × (gravidade de lado) para baixo. "Cabeça" = gravidade para fora da face; "subindo/descendo" = avanço contra ou a favor da gravidade ao longo da junta. Na plana nada muda (as etapas anteriores ficam iguais). A posição entra no registro (evento `posição`, gravado ao abrir o arco), então o replay e a pontuação dão o mesmo resultado. Missões podem prender a peça na estrutura (ex.: corrimão em pé, na vertical). Os nomes seguem AWS/ASME (1G–4G, 1F–4F) e ISO 6947 (PA a PG). | As posições e seus códigos são os usuais ([WELDNOTE], [FRONIUS]). Na vertical a poça escorre para baixo e na sobrecabeça o metal tende a pingar, o que pede poça menor ([CURSA]); na vertical **ascendente** a prática fala em corrente menor e avanço subindo para não superaquecer ([UNLP]). A direção "descendo funde menos, subindo funde mais" é conhecimento de prática, **sem fonte numérica aqui**. | **Todos os números são do jogo.** Não há gota que cai, cordão escorrido fora da junta, nem a prática de baixar a corrente fora da plana (o jogador ajusta). As buscas não trouxeram dado de penetração ou convexidade por posição: conferir em livro-texto ou em norma (AWS D1.1, ISO 6947) antes de usar como regra. |
| **H18 revista** *(v1.3)* | **A fresta da junta de topo enche primeiro.** Com abertura a > 0 entre as bordas de espessura e, o metal ocupa primeiro a fresta (área a × e) e só o que sobra vira reforço acima da face, com a mesma forma de H3/H9: largura = largura sem fresta × √(sobra ÷ metal), altura pela área (2/3 · largura · altura = sobra), nunca mais estreito que a fresta. Com menos metal que a fresta, a superfície fica abaixo da face ("junta não enchida"). É o mesmo balanço de massa do chanfro em V (H46). Sem abertura (o contexto padrão das etapas 1–4) nada muda. | Balanço de massa: o metal que entra na junta não pode estar também no reforço. No caso de referência (3 mm, abertura 1 mm) a fresta leva 3 mm² de ~14 mm²: reforço ~20 % menor com o mesmo metal. | Supõe a fresta cheia por igual, sem penetração nem diluição das bordas (o metal da chapa que funde não entra na conta). O 3D continua desenhando só o reforço (a fresta não aparece de cima). As explicações da didática que usam "largura ∝ √área" ficam aproximadas no topo com abertura (nota para o GPT). |
| **H48** *(v1.3)* | **Distância bico de contato–peça (DBCP/CTWD).** Escolhida na bancada (10, 15 ou 20 mm; 15 é a referência e o valor dos dados antigos) e fixa na tentativa. Entra só na corrente (H28): mais DBCP → mais aquecimento resistivo do arame livre → menos corrente para o mesmo arame → menos potência e menos fusão (H31, H33). **Não muda a quantidade de metal** (H1) nem a forma pela tensão (H9). Definições usadas no jogo: DBCP = do bico de contato até a peça; comprimento do arco = da ponta do arame até a poça (não calculado; a tocha 3D desenha 3 mm); altura da tocha na tela = DBCP + o comprimento do bocal (só desenho). | Fabricante indica DBCP de cerca de 10–12 mm para curto-circuito [LINCOLN-LTW1]; o efeito "mais DBCP, menos corrente e menos penetração" em tensão constante está em [EWI-CTWD] e decorre de [LESNEWICH]. | Os números do efeito são do jogo. Não modela proteção gasosa pior com DBCP longa, respingo no bocal com DBCP curta, nem DBCP variando durante o passe (a mão não controla a altura no mouse). |
| **H49** *(v1.3)* | **Pausa e perda de foco não viram solda.** Pausar a tentativa, esconder a janela ou tirar o foco dela fecha o arco **no último instante já consolidado** (`interromperArco`), e não no relógio atual. Sem isso, o tempo parado seria somado como tocha parada depositando (um salto de metal e de calor). | Consistência temporal: o modelo só deve integrar tempo em que o jogador estava soldando. | O arco fecha até ~50 ms antes do evento (a margem de H5). Na bancada o arco fecha; na tentativa oficial a pausa abre. |
| **H50** *(v1.4)* | **Gravidade visível na poça.** Cada fatia do cordão guarda a gravidade média que agiu quando o metal caiu ali (para fora da face, de lado e ao longo do avanço). Com o tamanho da poça P = (metal acima da face ÷ 10 mm²) × (0,6 + 0,4 × F): na **sobrecabeça** a poça grande pinga (gotas penduradas no cordão e gotas caindo do arco); na **vertical** escorre em ondas (descendo, a partir de P ≈ 0,9, e o metal corre à frente do arco, gerando sobreposição; subindo, a partir de P ≈ 1); na **horizontal** o perfil pende para a chapa de baixo, com a borda de cima mordida e a de baixo sobreposta. | Direções da prática: poça grande fora da plana escorre, pinga ou cai para baixo; na vertical descendente o metal tende a correr à frente da poça. | **Limiares e intensidades são do jogo.** Não há metal líquido simulado: são regras sobre a poça média de cada fatia. |
| **H51** *(v1.4)* | **Defeitos calculados depois, do registro.** Todos os defeitos visíveis (H50–H57) saem de uma análise feita sobre o cordão, o percurso, o registro e os eventos que a simulação já guarda (`src/modelo/defeitos.ts`). Gotas, respingos e poros têm posições de um sorteio **fixo** por fatia. | O mesmo registro dá os mesmos defeitos: no replay, na nota e com qualquer taxa de quadros (testes em `tests/defeitos.test.ts`). | Os defeitos não mudam o metal depositado: largura, reforço e fusão continuam vindo de H1–H49. |
| **H52** *(v1.4)* | **Mordedura.** Profundidade = 0,6 mm × (0,35 × arco longo + 0,3 × avanço rápido acima de 1,3× a velocidade de referência da junta + 0,35 × fusão acima de F = 2), mais até 0,4 mm na borda de cima na horizontal. Vira defeito acima de 10 % da espessura (mínimo 0,2 mm). | Tensão alta, avanço rápido e calor demais na borda são as causas usuais de mordedura; a ISO 5817 usa limites dessa ordem (nível C) só como ordem de grandeza. | Fórmula e pesos do jogo. Não depende do ângulo de trabalho da tocha (não modelado). |
| **H53** *(v1.4)* | **Sobreposição (metal sobre a chapa sem fundir).** Avanço lento (abaixo de 0,7× a referência) com calor que não acompanha (F abaixo de 2,1), arco curto e devagar, vertical descendente e a borda de baixo na horizontal. No 3D a borda do cordão fica "enrolada"; no corte, uma linha vermelha marca a borda sem fusão. | Velocidade baixa, arco curto e poça correndo à frente do arco são causas usuais de sobreposição. | Índice do jogo; não mede o comprimento real da falta de fusão. |
| **H54** *(v1.4)* | **Respingos presos.** Densidade por mm = 0,35 × (gás × (1 + 1,5 × módulo da instabilidade) + DBCP longa − 1,15), com gás = 1,6 no CO₂ puro e 1 nas misturas. Posições por sorteio fixo, de 0,5 a 10,5 mm da borda. Vira defeito acima de 2 por 10 mm. | Mesma direção de H29 e H43: CO₂ puro e arco fora do equilíbrio respingam mais. | Números do jogo; o tamanho e a aderência reais dependem da transferência metálica (não modelada). |
| **H55** *(v1.4)* | **Cratera no fim do passe.** Cada fechamento de arco deixa uma cratera (o cordão afunda nos últimos ~3 mm), a menos que a tocha fique parada até 0,5 mm do fim por 250 ms antes de fechar, ou que outro passe cubra o lugar depois. | Encher a cratera parando um instante no fim é prática comum; cratera aberta é ponto de trinca. | Tempo de enchimento do jogo. Não há trinca de cratera calculada. |
| **H56** *(v1.4)* | **Aparência: escamas, poça viva e oxidação.** Escamas marcadas a cada 120 ms de arco (espaçamento = velocidade × intervalo; devagar → juntas) com o vértice apontando para onde a tocha passou. A poça desenhada cresce com o calor (F), fica atrás do avanço e pende para o lado da gravidade. Faixas de oxidação na chapa com largura proporcional a F: aço carbono discreto (marrom → azulado), inox na sequência palha → roxo → azul, alumínio com faixa clara de limpeza e fuligem escura. | Escamas mais juntas com avanço lento e a sequência de cores do inox com o calor são observações de oficina. | **Só aparência**: as cores não medem temperatura; as escamas não vêm de solidificação calculada. |
| **H57** *(v1.4)* | **Porosidade e empeno.** Risco de poros = 0,55 (alumínio sem remover o óxido) + até 0,5 (arco longo) + 0,1–0,2 (DBCP 18–20 mm) + 0,15 (argônio puro em aço) + 0,15 × sobrecabeça. Poros aparecem no corte e, com risco alto, abertos na superfície. Empeno angular = 1,2° × índice de deformação D (H36), até 6°: no topo e no V as chapas dobram na borda da junta (só na peça fria da inspeção). | Gás mal protegido, arco longo e superfície suja dão porosidade; mais calor por mm, mais empeno (H36). | Números do jogo. Não há vazão de gás, vento nem umidade; o empeno é só angular (sem flecha longitudinal). |
| **H58** *(v1.4)* | **Outro ponto de solda vira outro cordão.** O cordão é guardado em fatias ao longo da junta, com um centro lateral por fatia. Um depósito a até 8 mm da linha da junta é sempre do cordão da junta (tecimento largo incluído); mais longe, só se continuar o cordão que já está ali (até 0,75 × a largura dele, mínimo 5 mm). Senão vira um **cordão solto**, com forma própria, apoiado na superfície onde caiu (chapa ou parede do filete). Antes, os dois lugares viravam um centro médio com um espalhamento enorme, e o cordão se esticava em lâminas. | Soldar em outro lugar da chapa faz outro cordão; o cordão da junta não muda por causa dele. | O metal solto conta no total e como metal fora do trecho (Execução); não tem escamas, defeitos nem fusão própria calculados. No máximo 12 cordões soltos. |

Parâmetros por material (todos do jogo, relativos):

| Material | n (aporte necessário) | e (efeito do aquecimento) | g | τ (s) | f (deformação) | Limpeza obrigatória |
|---|---|---|---|---|---|---|
| Aço de baixo carbono | 1,00 | 0,30 | 0,25 | 12 | 1,0 | não |
| Inox austenítico | 0,85 | 0,25 | 0,35 | 18 | 1,7 | não |
| Liga de alumínio | 1,80 | 0,80 | 0,30 | 8 | 1,2 | sim (óxido) |

Efeitos visuais ligados ao material (só visuais, H8): o alumínio quase não
muda de cor ao aquecer; o inox ganha uma faixa de coloração térmica ao lado
do cordão, mais larga quanto maior o aporte.

### Fontes consultadas na v1.3 (H28 revista, H48)

- [LESNEWICH] A. Lesnewich, *Control of melting rate and metal transfer in gas-shielded metal-arc welding, Part I*, Welding Journal 37(8), 1958, p. 343s–353s. Não foi aberto: a forma W = a·I + b·L·I² aparece citada em patentes e textos de modelagem de GMAW (ex.: patente US 8884190, https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8884190), que também dizem que a e b dependem do diâmetro e da liga do arame.
- [EWI-CTWD] EWI, *Gas metal arc welding basics: travel speed and contact-to-work distance (CTWD)* — https://ewi.org/gas-metal-arc-welding-basics-travel-speed-and-contact-to-work-distance-ctwd/ (mais CTWD, mais aquecimento I²R do arame, menos corrente; o inverso com menos CTWD).
- [LINCOLN-LTW1] Lincoln Electric, manual LTW1 — https://www.manualslib.com/manual/94911/Lincoln-Electric-Ltw1.html (CTWD de cerca de 10–12 mm).
- Aporte térmico: energia do arco U·I ÷ v e fator de rendimento k = 0,8 para MIG/MAG (EN 1011-1; hoje ISO/TR 17671-1 e ISO/TR 18491), conforme Kemppi, *Calculation of heat input in MIG/MAG welding* — https://kemppi.com/en/blogs/calculation-of-heat-input-in-mig-mag-welding. O jogo usa só a **forma** (H31): k constante, unidades relativas.

As normas e o artigo de 1958 não foram abertos; as fontes sustentam a
**direção** das relações e a forma da equação, não os números do jogo.

### Fontes consultadas na etapa 11 (H46, H47)

- [UTI] Universal Technical Institute, *The 5 basic weld joint types explained* — https://www.uti.edu/blog/welding/joint-types
- [RSI] Refrigeration School, *The 5 basic types of welding joints explained* — https://www.rsi.edu/blog/welding/the-5-basic-types-of-welding-joints-explained/
- [WELDNOTE] *Welding positions, ISO, ASME, AWS* — https://weldnote.com/en/2016/06/15/welding-positions-iso-asme-aws.html
- [FRONIUS] Fronius, pôster *Welding positions* (EN ISO 6947) — https://fronius.com/~/downloads/Perfect%20Welding/Posters/PW_POS_welding-positions-poster_EN.pdf
- [CURSA] *Posiciones de soldadura y accesibilidad* — https://cursa.app/es/pagina/posiciones-de-soldadura-y-accesibilidad-plana-horizontal-vertical-y-sobrecabeza
- [UNLP] apostila da Universidad Nacional de La Plata (posição vertical ascendente) — https://unlp.edu.ar/frontend/media/88/29588/5bb7dd2633aaa9cafb9b71dbe29a46f6.pdf

São páginas de escolas, fabricante e material didático; a norma em si (AWS A3.0, ISO 6947) não foi aberta.

## Caso de referência (v1.3)

Usado para conferir as relações (`tests/referencia.test.ts`), sem limitar o
jogo a ele: **MIG/MAG, aço de baixo carbono 3,0 mm, junta de topo reto com
abertura de 1,0 mm, posição plana** (missão "Suporte de prateleira");
arame de 1,0 mm, argônio + CO₂, técnica neutra (0°), DBCP 15 mm; tensão 5,5
e alimentação 5 (botões); passe reto de 10 a 140 mm a 10 mm/s.

Nele, por construção, volume de arame, corrente e potência relativos valem 1
e o metal sai a 100 mm³/s do jogo. Os testes conferem, a partir daí:

| Mudança | Metal por s | Corrente | Forma | Fusão (índice) |
|---|---|---|---|---|
| Alimentação × 2 | × 2 | sobe menos que × 2 | igual | depende da velocidade |
| Tensão ↑ | igual | igual | mais achatada | ↑ (potência) |
| DBCP 10 → 20 mm | igual | ↓ | igual | ↓ |
| Arame 0,8 → 1,2 mm (mesma alimentação) | ↑ | ↑ | igual | — |
| Velocidade ↑ | igual | igual | cordão mais estreito | ↓ |
| Puxando × empurrando | igual | igual | mais alto × mais baixo | ↑ × ↓ |

E também: conservação (metal no cordão = taxa × tempo de arco sobre a peça),
tocha parada depositando e aquecendo, pausa sem salto (H49), arco fora da
peça sem aquecer (H32), o mesmo gesto a 30, 60 e 144 quadros/s, replay e
nota iguais ao vivo, e o passe de referência aprovado.

## Auditoria técnica da v1.3 (resumo)

| Achado | Situação |
|---|---|
| A "corrente relativa" era a própria quantidade de metal (I = V) | Corrigido: H28 revista + H48 |
| Arco aberto fora da peça aquecia a peça | Corrigido (H32) |
| Pausa fechava o arco no relógio atual (tempo parado virava metal); sem pausa por perda de foco | Corrigido (H49) |
| Buraco no cordão perdia em integridade, extensão, E3 **e** largura | Corrigido na pontuação v2 (PONTUACAO.md) |
| Movimento da tocha (H39) segue no modelo, mas saiu da bancada na v1.2 | Mantido para dados antigos; sem controle na tela |
| Formato da junta (H41) segue no modelo, mas a junta é sempre reta desde a v1.2 | Mantido para dados antigos |
| A eficiência dá metade dos pontos pelo gás escolhido (preparo, não execução) | Mantido e documentado (PONTUACAO.md) |
| Fusão excessiva (integridade) e deformação usam o mesmo calor | Mantido: são fenômenos diferentes (local × global), documentado |
| No topo reto todo o metal ficava acima da chapa, nada na fresta: reforço alto demais | Corrigido: H18 revista (a fresta enche primeiro) |
| O 3D do topo reto desenhava o cordão com **exagero vertical de 3×** (na solda e no resultado): parecia três vezes mais alto do que o modelo calcula | Corrigido: escala real (1×) por padrão; o exagero (até 6×) fica só como opção na inspeção |

## O que o modelo **não** representa (e não deve fingir que representa)

- Penetração **real**, diluição, zona termicamente afetada. A etapa 5 só tem um
  índice de fusão **sintético** (H33), mostrado sempre como tal.
- Descontinuidades internas reais: trincas e inclusões. Porosidade,
  mordedura, sobreposição, cratera e afins (H50–H57) são **previstos por
  regras do jogo**, não calculados de física; as previsões de "falta de
  fusão" e "perfuração" também são do modelo (H33, H34).
- Modo de transferência metálica, vazão de gás, indutância, comprimento do
  arco, ângulo de trabalho da tocha (supõe-se a tocha na bissetriz do
  filete e a prumo no topo), forma real do empenamento. A DBCP (H48) e o
  ângulo de avanço (H38) entram só como escolhas fixas da bancada.
- Corrente elétrica em ampères (só existe a corrente relativa de H28).
- Buracos curtos no cordão: o espalhamento numérico de 2 mm (H4) cobre
  boa parte de uma interrupção de alguns milímetros; só interrupções acima
  de ~10 mm aparecem inteiras como "sem cordão".

Por isso, **a aparência do cordão neste jogo não indica qualidade interna**, e
a integridade prevista é um resultado sintético do modelo.

## Como o resultado não depende da taxa de quadros

1. As posições vêm dos eventos do mouse, cada um com o próprio instante
   (`event.timeStamp`). Leituras agrupadas pelo navegador são recuperadas com
   `getCoalescedEvents()`.
2. O metal é depositado **ao longo do trecho entre duas leituras**, na
   proporção do tempo gasto nele — não "um pouco por quadro".
3. O laço de desenho só avisa a simulação de que o relógio andou (para a tocha
   parada continuar depositando). Ele consolida apenas até "agora − 50 ms", e
   por isso uma leitura atrasada não muda o que já foi calculado.
4. O teste `tests/simulacao.test.ts` roda a mesma trajetória sem quadros e com
   30, 60 e 144 quadros/s e confere que o cordão sai igual.

## Ideias para validar (quando for a hora)

- Comparar a tendência largura × velocidade de avanço (H2 + H3) com dados de
  literatura sobre geometria de cordão em MIG/MAG para aço carbono, mantendo
  arame e gás fixos.
- Confirmar a direção de H9 (tensão → largura/altura) e ver se ela vale em
  toda a faixa ou só perto do ponto de equilíbrio.
- Verificar como o rendimento de deposição (H1) muda com a tensão.
- Trocar a reta de H10 por dados de um arame e gás específicos, se o jogo
  passar a usar unidades reais.
- Comparar o critério de regularidade (H15) com o que se usa de fato em
  inspeção visual de cordões, e com que resolução se mede a largura.

## Correção da revisão técnica (GPT, autorizada pelo dono)

H49: a pausa da tentativa congela o relógio lógico do processo, inclusive
o resfriamento. Ao retomar, o intervalo pausado é subtraído das leituras;
os eventos gravados já usam esse tempo lógico. O replay não precisa de
um evento novo e continua compatível com registros compactos antigos.
Esperar com o arco fechado, sem pausar, continua permitindo resfriamento.

H34/H46: a margem de cobertura é calculada pela mesma função na análise
e no relatório. No topo/V desconta abertura na face e margem de borda;
no filete mede a perna menor menos metade da maior. Valor negativo
indica que o critério não foi atendido.

A avaliação carrega opcionalmente seu contexto. Para juntas com fresta,
outros materiais, consumíveis, técnicas ou posições, a didática mostra
medidas e fatores sem usar a decomposição antiga da largura pela raiz
da área total. As explicações históricas sobre chapa sem fresta permanecem.


### Visualização e fixação — revisão do menu Alpha v1.4

O palco gira a peça em X em torno da orelha presa na garra, sem girar a sala. A câmera é independente, com arco horizontal de 180° e elevação de 0° a 180°. O limite de movimento é calculado por volumes simplificados de colisão das chapas com o suporte; não é uma simulação mecânica da garra. As equações de gravidade e pontuação permanecem as mesmas. Consulte `CAMERA-E-PECA.md` para as limitações.

## Protótipo v1.5 — H59 a H62

O acionamento por botão, abertura do eletrodo por contato, consumo da vareta e integração em passo fixo estão documentados em [PROTOTIPO-V15.md](PROTOTIPO-V15.md). São hipóteses de interação com números sintéticos, sem pontuação ou física SMAW calibrada. As hipóteses anteriores continuam descrevendo somente o jogo MIG/MAG herdado.

### Evolução SMAW v1.5 — H63 a H66

Corrente, consumo dependente da corrente, aderência, escória superficial com resfriamento/limpeza e orientação independente são descritos em [PROTOTIPO-V15.md](PROTOTIPO-V15.md). H63 substitui o consumo e depósito SMAW fixos de H61–H62, sem reutilizar a previsão de fusão MIG. Não há certificação ou qualidade interna validada.

### H67 — limpeza com ferramentas

O martelinho quebra crosta fria e deixa resíduos; a escova de aço retira somente os resíduos soltos. Nenhuma etapa remove metal ou opera sobre escória quente. Limiares sintéticos e migração do padrão de altura estão em PROTOTIPO-V15.md.

### H68–H70 — abertura riscando, comprimento do arco e compensação assistida

Riscar a ponta reduz a chance de grudar; o arco é classificado em curto, adequado e longo pelo diâmetro da alma e muda a forma do cordão e os respingos; a compensação assistida mantém o comprimento do arco enquanto a vareta queima. Detalhes e limites em [PROTOTIPO-V15.md](PROTOTIPO-V15.md).

### H71–H73 — arco tolerante, abertura ao tocar e ponta no canto do filete

Arco esticado aguenta um instante e reacende a quente; o primeiro toque abre o arco sem botão, e curto breve sem empurrar se desfaz; a distância é medida até a superfície real da junta e a ponta assenta na raiz do filete. Detalhes em [PROTOTIPO-V15.md](PROTOTIPO-V15.md).



### H74 — Acompanhamento manual do consumo no eletrodo (v1.6)
Ao segurar a descida, o comando compensa a componente vertical do consumo que a assistência ainda não cobre, e acrescenta a correção pedida pelo jogador. A compensação só existe com comando ativo e arco aberto. A velocidade configurada continua sendo a velocidade de correção, com mínimo jogável de 3 mm/s. A corrente, o consumo, o volume depositado, o limite do arco e a aderência permanecem no modelo anterior. É uma assistência de interação, não resposta calibrada de uma mão humana. Testes cobrem corrente alta, preferências antigas lentas, ausência de comando e taxas de quadros.

### H75 — Apresentação industrial e limpeza do SMAW (v1.6)
As peças representam trechos simplificados de conjuntos industriais em aço carbono (8–12 mm): emenda, sapata, longarina, caixão e reforço. Orelhas furadas e travessas fora do trecho acessível são acabamento visual; não qualificam uma junta real nem acrescentam regiões soldáveis. A fonte SMAW é uma inversora CC sem cilindro de gás. Correntes são parâmetros didáticos, não recomendações de procedimento. Ondulações foscas do metal, crosta fissurada, relevo e lascas são visuais e não alteram pontuação ou volume. Direções lateral, diagonal e superior mudam o movimento do martelo; a remoção continua condicionada à posição, resfriamento e uso posterior da escova, pela mesma máscara física anterior.


### H76 — União de duas peças e golpe automático (v1.6)
A direção do martelo é sorteada a cada clique, entre as duas direções diferentes da anterior. É somente animação; o resultado da limpeza não depende do sorteio. O primeiro trabalho começa com duas chapas e abertura de 2 mm, sem reforço transversal anterior à solda. O conserto de grade representa uma barra chata de 40 × 6,3 mm separada em duas metades com abertura de 1,5 mm, dentro de um quadro com outras barras. A geometria, a fixação, o limite do ponteiro e do controle usam essa largura; somente o trecho da barra quebrada recebe solda. O domínio interno de 150 mm é preservado para os buffers do cordão, com trecho acessível central de 40 mm. Os acabamentos dos dois componentes diferem para tornar visível a união. O modelo de processo permanece qualitativo.


### H77 — Avaliação visual parcial do treino SMAW
A avaliação separa a nota didática de 0 a 1000 dos limites dimensionais 502/503 da ISO 5817:2023 (B/C/D). A ISO 17637:2016 orienta a preparação e a consulta visual; escória remanescente impede a nota final. Não se atribui conformidade global, integridade interna ou qualificação de soldador. Pesos e fator de cobertura são do jogo e aparecem explicados na interface. Dados do arco e aderência servem como dicas, sem falsa equivalência com critérios ISO. Fontes, escopo e limitações estão em AVALIACAO-SMAW.md.


### H78 — movimento livre do eletrodo na borda
Removidos o assento automático na raiz do filete, a mira e o risco guia. O ponteiro continua fora dos limites, mas deixa de gerar contato: a borda não conta como interseção com a face. A aderência física por arco curto permanece. Zoom por +/− (inclusive teclado numérico), com arco fechado.


### H79 — depósito local e avaliação SMAW sobre a mesma superfície
O eletrodo passa a usar `DepositoEletrodo`: células de 1 × 0,5 mm, com volume conservado e distribuição gaussiana limitada ao entorno da ponta (três sigmas). O metal novo favorece pontos mais baixos dessa poça local; metal frio não é movido. Não se usa a seção pré-formada do MIG nem se transporta metal para a raiz por proximidade. A base considera o fundo da abertura e as paredes do chanfro. É um modelo de altura, sem fluido 3D, diluição, fusão das bordas, gravidade ou perfuração. Uma raiz retentora didática mantém metal em frestas abertas: não representa penetração real ou suporte de cobre especificado. A acumulação usa os subpassos fixos do acionamento, sem depender da frequência de renderização.

Metal, escória, martelo, escova, ponta, arco e avaliação leem a mesma altura local, inclusive negativa dentro da junta. A crosta fica 0,10–0,28 mm acima do metal; não é presa ao topo da chapa. O 3D usa a malha real do depósito e a escória tem resolução compatível. O MIG e suas regras permanecem com o modelo anterior. Metas e pesos didáticos por peça, escopo ISO e limites estão em AVALIACAO-SMAW.md. A raiz do V é avaliada como raiz; não como enchimento completo do chanfro.


### H80 — sólido 3D do metal e acabamento
O depósito SMAW tem agora malha fechada: superfície, fundo e paredes laterais do material acumulado. A base é a geometria real da abertura; a superfície vem do campo local, sem exagero da espessura. As caudas abaixo de 0,025 mm não geram faces visuais. Até 1,2 mm acima do perfil-alvo a distribuição favorece o preenchimento dos pontos baixos; acima dessa margem didática ela preserva a coroa convexa; continuar depositando aumenta o reforço local. Um micro-relevo de escamas limitado a 0,06 mm modifica só o acabamento visual, e a escória acompanha esse mesmo acabamento. Testes conferem cada aresta com exatamente duas faces e volume orientado positivo para topo, V e filete. O modelo continua sendo um campo de altura didático; não é uma simulação de fluido volumétrica.

### H81 — encerrar tentativa e receber pontuação
O eletrodo passa a seguir o fluxo do MIG: soldar, encerrar por botão ou Enter, receber nota automática inteira de 0 a 1000 e conceitos S/A/B/C/D, examinar os critérios e iniciar outra tentativa. Os pesos geométricos continuam específicos do processo SMAW, sem inventar parâmetros MIG. A referência ISO C é fixa no exercício. Escória remanescente não bloqueia o placar: desconta até 200 pontos, proporcional à fração de escória não removida, e impede declarar a inspeção visual liberada. Ocultar a escória na inspeção é apenas visual e não altera a nota. O resultado congela a simulação, mantendo câmera e zoom; a ferramenta e partículas não obstruem a inspeção.



### H82–H86 — calor por passe, defeitos e cordão 3D do eletrodo (v1.6, Claude)

Somados ao depósito (H79) e à nota de 0 a 1000 (H81), sem mudar nenhum dos dois: o calor que cada passe pôs em cada meio milímetro da junta (aporte em kJ/mm) comparado com o calor de referência da peça; daí falta de fusão, fusão fraca, calor em excesso e perfuração da raiz aberta; defeitos de superfície (mordedura, sobreposição, poros, cratera, inclusão de escória, respingos, abertura fora da junta, eletrodo grudado) desenhados sobre o metal; e a lista, no resultado, com o lugar, a causa e como corrigir; o cordão na tela é o cordão 3D do MIG, alimentado com o mesmo metal (H86). Detalhes e calibração em [PROTOTIPO-V15.md](PROTOTIPO-V15.md).

### H87 — solda mais lenta pela física, não pelo mouse (v1.8, Claude)

O mouse e a caneta continuam como antes: o ponto da tela é o ponto da peça, sem limite nem redução. O que mudou foi a física do MIG/MAG, para a solda certa pedir metade da velocidade de avanço:

- `MODELO.taxaDeposicaoMm3s` de 100 para 50: o arame deposita metade do metal por segundo, então o mesmo cordão pede metade da velocidade;
- `FUSAO.necessidadePorMm` de 0,01677 para 0,03354: cada mm de junta pede o dobro de calor para fundir, então a fusão certa pede o dobro de tempo sobre cada mm;
- `tauAquecimentoS` de cada material em dobro (aço 24 s, inox 36 s, alumínio 16 s): a peça aquece e esfria no ritmo de um passe que agora dura o dobro;
- faixa verde de velocidade (`VELOCIDADE.alvoMinMms`/`alvoMaxMms`) de 8–16 para 4–8 mm/s, velocidade típica de cada junta pela metade, escala do velocímetro de 40 para 20 mm/s;
- escamas a cada 240 ms (eram 120) e 500 ms para encher a cratera (eram 250), para o cordão sair igual ao de antes na velocidade nova;
- controle (gamepad): velocidade máxima de 15 mm/s (era 30), para o mesmo ponto do analógico dar a mesma solda.

Andar na velocidade antiga agora deixa cordão fino e falta de fusão. Todos os testes de solda simulada foram refeitos com metade da velocidade e o dobro das pausas e dão os mesmos resultados de antes: o modelo é o mesmo, só com o tempo esticado em duas vezes. Números do jogo, não de norma.

### H88 — modos de pontuação Fácil e Difícil (v1.8, Claude)

O jogador escolhe Fácil ou Difícil antes de soldar, no MIG/MAG e no eletrodo. No MIG os dois níveis já existiam (Aprendiz e Profissional) com pouca diferença na nota; agora têm esses nomes e o Fácil tem faixas de tolerância duas vezes mais largas. No eletrodo, o Fácil compara com o nível D da ISO 5817 e desconta pouco pelos defeitos; o Difícil, com o nível B, e cada defeito grave custa 100 pontos. Tabelas em [PONTUACAO.md](PONTUACAO.md). Critérios do jogo, didáticos, não de norma.

### H89 — nota sem trava (v1.8, Claude)

Pedido do dono: "considere todas as pontuações independente da nota". A condição essencial descumprida (integridade mínima, perfuração, trecho sem cordão, óxido) continua sendo mostrada como "não aprovada", mas não zera Controle térmico e Execução, não limita o conceito a C, não põe aprovadas à frente nos rankings e torneios, não faz perder o desafio do Arcade e não trava a História (a missão seguinte libera ao entregar). Versão da nota: `pontuacao-v9`.

### H90 — Fácil só nota; Difícil com mínimo por categoria; desafios e História no Difícil (v1.9, Claude)

Pedido do dono: "no fácil a pontuação vai ser desbloqueada e não tem aprovação, apenas pontuação pura (mesmo se tirar 0 em alguma categoria), já no difícil você precisa de pelo menos 20 % em cada um dos 5 tipos de avaliação. Nos desafios precisa ser difícil exclusivo… pelo menos 40 % em cada uma das avaliações, e o modo história também."

- **Fácil** (`aprendiz`): `exigencia = null`. Não há condição essencial nem selo de aprovada/reprovada; vale a soma das 5 categorias.
- **Difícil** (`profissional`): `exigencia = 0,2`. Aprovada só com pelo menos 20 % dos pontos em cada categoria (integridade, desenho, regularidade, deformação, eficiência). As condições essenciais antigas (E1–E4) saem; cada categoria vira uma condição com o id dela.
- **Desafios do Arcade e Modo História**: sempre no Difícil, com `EXIGENCIA.desafio = 0,4`. O desafio é perdido abaixo de 40 % em qualquer categoria; na História a missão seguinte só abre com a anterior aprovada assim.
- **Eletrodo**: Fácil só nota; Difícil pede 20 % em cada um dos 4 itens e também na nota final (escória e defeitos descontam dela), com a escória removida.

A nota continua contando inteira, aprovada ou não (H89). Versão da nota: `pontuacao-v10`.

### H91 — eletrodo sem assistência na altura (v1.9, Claude)

Pedido do dono: "Ele tem uma assistência que faz ficar muito fácil, não está 3D como antes, precisa de um balanceamento para a mecânica de precisar fazer o movimento e descer enquanto vai consumindo o eletrodo."

- A opção "Ajuda na altura" saiu da bancada. A descida é só a do jogador, com a mesma rampa de W (toque curto desce pouco, segurar acelera até 6 mm/s); não soma mais o consumo da vareta.
- Consumo da vareta 1,5 mm/s na corrente base (era 3), para o jogador conseguir acompanhar com toques em S. Com 180 A a vareta queima a ~3,8 mm/s e segurar S ainda ganha.
- `RENDIMENTO15.deposicao` de 0,7 para 2,8: com o consumo menor, o metal por mm de vareta sobe para o cordão aparecer em relevo.
- Peça nova "Cordões sobre chapa" (chapa inteira, sem abertura): o cordão fica todo por cima. Alvo: miolo de um diâmetro de largura com pelo menos 1,5 mm de altura.
- Teste com jogador simulado (`tests/eletrodoMao.test.ts`, reação de 0,15 s): com atenção ele solda a vareta inteira sem grudar a 80, 90 e 100 A; sem controle o arco apaga em menos de 4 s.

Números do jogo, calibrados por simulação; não foram medidos com jogadores nem em equipamento real.

### H92 — TIG com mesa digitalizadora e mouse (v1.9, Claude)

Pedido do dono: "Crie o TIG para o game, tente colocar a mesa digitalizadora junto com o mouse para isso."

O TIG pede duas mãos: tocha numa, vareta de adição na outra, e o pé no pedal. No jogo:

- **Mesa + mouse (duas mãos):** a caneta é a tocha (posição na peça; a pressão é o pedal; inclinar a caneta inclina a tocha). O mouse é a mão da vareta: o clique esquerdo mergulha a vareta na poça e a roda sobe e desce a tocha. O navegador separa os dois pelo tipo de ponteiro (`pen` e `mouse`), que chegam ao mesmo tempo. O jogo passa para este modo sozinho na primeira vez que vê a caneta.
- **Só mouse:** o mouse é a tocha e segurar o botão esquerdo é o pedal (a corrente sobe em 0,35 s e desce em 0,6 s); Espaço mergulha a vareta; W/S ou a roda mudam a altura.
- Um toque rápido (tecla ou clique) vale pelo menos 0,15 s de mergulho, para não se perder entre dois quadros.

Modelo (`src/modelo/tig.ts`), todo didático:

- Calor do arco = 0,65 × corrente × tensão (10 V + 0,6 V por mm de arco), espalhado como uma gaussiana que abre com o arco longo; condução no plano da chapa (campo de 150 × 40 mm, células de 1 × 0,5 mm) e perda para o resto da peça. A poça é onde a temperatura passa do ponto de fusão.
- O tungstênio não se consome. Encostado na poça (≤ 0,3 mm) ele contamina: o arco fica instável até o jogador afiar (só com o arco apagado). Arco curto demais (< 1,1 mm) faz a vareta tocar o tungstênio.
- A vareta desce para a borda da frente da poça. Só funde se tocar a poça; na chapa fria ela só bate (defeito). Fundir a vareta tira calor da poça.
- Furo quando o calor passa do que a chapa fina aguenta; cratera quando o arco é cortado de uma vez com a poça grande.
- O arco é medido até o topo do metal já posto: o cordão crescendo encurta o arco, e o jogador precisa subir a tocha.

Nota de 0 a 1000: fusão no trecho 300, adição e reforço 200, largura regular 200, escamas regulares 150, limpeza do processo 150; furo desconta 40 (Fácil) ou 120 (Difícil). Fácil só nota; Difícil aprova com 20 % em cada item e na nota final, como no eletrodo (H90).

Calibração: um soldador simulado (pedal cheio, 2 mm/s, toque de vareta a cada 0,7 s) faz as três peças com mais de 600 pontos e é aprovado no Difícil; sem vareta fica sem reforço nem escamas; andando a 9 mm/s não funde; corrente 25 A acima da faixa fura a chapa de 1,5 mm. Não foi testado com uma mesa digitalizadora de verdade: o caminho da caneta foi conferido no navegador com eventos de caneta simulados (com pressão).

### H93 — máquina MIG em volts e m/min, com efeito na solda (v2.0, Claude)

Pedido do dono: "Precisamos melhorar a configuração... deixar mais realista que faça efeito na solda, um principal problema é a tensão e alimentação... já que vai até 30 V."

- **Unidades reais no painel.** Tensão de 14 a 30 V e alimentação de 1 a 15 m/min, em passos de 0,5. Por dentro o jogo continua com as posições de botão de 1 a 10 (escala linear: 1 → 14 V e 1 m/min; 10 → 30 V e 15 m/min), então o que fica salvo nos registros não muda. A referência antiga (5 / 5,5) vira 7,2 m/min e 22 V.
- **Corrente em ampères.** A corrente relativa (H28/H48) passa a aparecer em A: 170 A na referência com arame de 1,0 mm. Ela continua não sendo um botão: vem da alimentação, do diâmetro do arame e da DBCP.
- **Modo de transferência** (`modoTransferencia`):
  - **curto-circuito:** até 22,5 V, abaixo da corrente de transição;
  - **spray:** com argônio na mistura, corrente acima da transição (190 A × diâmetro do arame em mm) e pelo menos 24 V;
  - **globular:** o resto. Com CO₂ puro nunca há spray.
- **Efeitos na solda:**
  - **globular:** instabilidade mínima de 0,4 no arco, então mais respingo e cordão irregular;
  - **spray:** 25 % a mais do calor vai para a fusão (penetração), sem aumentar o calor total da peça (U·I já conta);
  - **arco curto** (tensão baixa para o arame): até 35 % a menos de fusão, o metal deita sem fundir as bordas;
  - **desequilíbrio:** o efeito do arco fora do equilíbrio satura em 2 pontos de botão (~3,6 V), e não mais em 3;
  - **tensão de equilíbrio no spray:** com argônio e acima da transição, sobe para ~25 V.
- **Arcade:** a "máquina pré-ajustada" fica nos passos do painel, nunca no globular, e prefere o curto-circuito.

Calibração por simulação (`tests/maquina.test.ts`). Números do jogo, não de catálogo de fabricante nem de procedimento; as direções (o que piora o quê) seguem a literatura de MIG/MAG. Versão da nota: `pontuacao-v11`.

### H94 — passar da chapa em níveis, até varar (v2.0, Claude)

Pedido do dono: "pensar em furar a peça, com vários níveis que podem acontecer, de apenas passar o material e não fazer um buraco até o ponto que ele realmente vara e faz um buraco."

Pelo índice de fusão F de cada fatia (H33, já relativo à espessura), no topo e no V:

| F | Nível | O que aparece |
|---|---|---|
| até 1,6 | normal | nada no avesso |
| 1,6 a 2,1 | raiz aparente | um filete de metal no avesso (até 0,3 mm); não é defeito |
| 2,1 a 2,6 | penetração excessiva | o metal passa e pendura no avesso (até ~1,9 mm), com gotas; vira defeito a partir de 1 mm, na ordem do limite de raiz da ISO 5817 |
| 2,35 a 2,6 | raiz afundada | a poça cai pela raiz e a face fica côncava (até 65 % mais baixa) |
| acima de 2,6 | furo | a chapa vara: buraco escuro atravessando a chapa, de 1 mm a 85 % da largura do cordão |

No filete não há avesso livre: só o furo conta. Os três defeitos entram na nota de superfície (Desenho) e a raiz afundada tira até metade da integridade da fatia; o furo já zerava a fusão da fatia (perfuração).

No resultado, o botão **Ver o avesso** mostra a raiz, o metal pendurado e os furos; a câmera da inspeção agora pode descer abaixo da peça. Números do jogo, não de procedimento.

**Eletrodo e TIG (H94, continuação).** Os mesmos níveis, com o 3D e a lista de defeitos de cada processo:

- **Eletrodo:** pelo calor do passe em relação ao da peça (H82). Na raiz aberta vale o primeiro passe; na chapa fechada, o mais quente, com 15 % a mais de folga.
  - raiz aparente a partir de 1,4×;
  - metal pendurado de 1,6× até 2,3×;
  - raiz afundada a partir de 2,1×;
  - furo acima de 2,3×.
  - "Raiz afundada" e "Furo" pedem reparo.
- **TIG:** pelo pico de temperatura de cada seção em fração do limite de furo.
  - raiz aparente a partir de 0,80;
  - metal pendurado a partir de 0,86;
  - raiz afundada a partir de 0,93;
  - furo no limite (como antes).
  - Metal pendurado e raiz afundada descontam por trecho: 10 e 25 pontos no Fácil, 30 e 60 no Difícil, com teto de 60 e 180.
- **Filete:** em nenhum dos dois há avesso livre; só o furo conta.

### H95 — seção parabólica no eletrodo e no TIG (v2.0, Claude)

Fonte científica: Banaee, Kapil, Marefat e Sharma (2023), "Generalised overlapping model for multi-material wire arc additive manufacturing (WAAM)", *Virtual and Physical Prototyping* 18(1), e2210541.

- **Publicado (eq. 1, p. 4):** a seção do cordão é uma parábola, y = h(1 − 4n²/w²), entre −w/2 e w/2. Nos ensaios do artigo (GMAW pulsado, arame de 1,2 mm, cordão sobre chapa), o erro de área foi menor que 4 % (p. 9).
- **Dedução:** integrando a parábola, a área é A = 2wh/3. Nos dados da Tabela 3 do artigo, 2wh/3 dividido pela área de arame que entrou (π·0,6²·WFS/TS) fica entre 0,86 e 1,04: os dados conservam massa (conta nossa, não publicada no artigo).
- **No jogo:**
  - O MIG já usava essa parábola (H3).
  - O eletrodo e o TIG trocam a gaussiana pela parábola na lateral. Ao longo do avanço fica um espalhamento curto, só para não aparecer degrau.
  - O volume entra inteiro e uma vez só: os pesos são normalizados.
- **Largura do passe (adaptação do jogo):**
  - Eletrodo: 4 × o desvio-padrão da gaussiana de antes, para manter a calibração. Cresce com o arco longo e a instabilidade, e com o diâmetro (fator diâmetro ÷ 2,5 mm).
  - TIG: a largura da poça, de 2,5 a 8 mm.
  - Os coeficientes do artigo não foram transferidos: os processos e as condições são outros.
- **Regra de pontos baixos:** o metal novo procura os pontos baixos só dentro da junta, abaixo da face (enche abertura e chanfro). Acima da face vale a parábola. Antes, essa regra achatava a coroa até 1,2 mm acima do alvo.
- **Testes:** `tests/perfilParabola.test.ts`:
  - forma da parábola;
  - área igual a 2wh/3 com tolerância de 3 % (amostragem da grade de 0,5 mm);
  - volume exato;
  - o mesmo resultado a 30 e a 144 quadros/s;
  - largura maior com diâmetro maior e com arco longo.

### H96 — passes lado a lado: vale, plano ou morro (v2.0, Claude)

- **No jogo (eletrodo e TIG):** o passe novo assenta a sua parábola (H95) sobre a superfície que encontra, inclusive sobre os passes anteriores. O volume é conservado, e acima da face não há regra extra de escorrimento.
- **Resultado** com dois passes iguais e o primeiro frio (60 s, como no artigo), medido no meio entre os centros:

| Distância entre centros | Meio ÷ pico | Leitura |
|---|---|---|
| 2w/3 | +9 % | morro leve |
| 0,75 × 2w/3 | +48 % | morro |
| 1,3 × 2w/3 | −53 % | vale |

- **Comparação com o artigo** (Banaee et al., 2023):
  - distância menor que a crítica dá morro e maior dá vale (Fig. 10, p. 12);
  - na distância do MMFOM, d = (w₁ + w₂)/3, que com materiais iguais é 2w/3 (eq. 6), os ensaios "invariavelmente" deram um morro leve (Fig. 13, p. 15).
- **Regra descartada:** testei uma regra de escorrimento para os vales. Ela compensava demais (transformava 2w/3 em vale) e foi retirada.
- **Metal frio:** cada célula registra o metal já solidificado (sem receber metal há mais de 2 s). O registro serve para separar os passes no corte e na fusão entre passes.
- **Limites:** o artigo é de GMAW pulsado, posição plana, cordão sobre chapa. A distância 2w/3 é referência, não garantia de fusão: os ensaios mostram que a superfície plana não garantiu união (Fig. 14).
- **Testes:** `tests/sobreposicao.test.ts`.

### H97 — camadas, fusão entre passes e corte (v2.0, Claude)

- **Camadas:** cada célula do depósito (eletrodo e TIG) guarda as camadas que recebeu, de baixo para cima. Para cada uma: o passe, a espessura e o vale que ela encheu. Uma camada nova começa quando a célula recebe metal depois de solidificada.
- **Vale:** quanto a célula estava abaixo do metal **depositado e frio** dos dois lados, na mesma seção. A chapa e a abertura da junta não contam como paredes, nem o simples flanco de um morro.
- **Fusão entre passes (hipótese do jogo):** a camada funde na de baixo se o calor da passagem mais quente depois que ela começou chegar a 0,8 × o calor de referência da peça, mais 0,15 por mm de vale (até 2 mm). Camadas com menos de 0,2 mm não contam.
- **Origem da regra:** vem do mecanismo descrito por Banaee et al. (2023, pp. 16–17): com calor, o metal do passe novo sobe e enche o vão; sem calor, espalha para os lados e não liga. Também confere com a observação do artigo de que a superfície plana por fora não garantiu união por dentro (Fig. 14). Os números são do jogo, e o artigo não dá um modelo geral de falta de fusão.
- **Defeito:** "Falta de fusão entre passes" (pede reparo) onde mais de 30 % da interface de uma fatia não fundiu, num trecho de pelo menos 2 mm.
- **Corte:** o botão **Corte** no resultado do eletrodo desenha, em escala real, a chapa, as camadas de cada passe (uma cor por passe) e em vermelho as interfaces sem fundir. É o mesmo estado que a análise usou, sem defeito inventado na tela.
- **Testes:** em `tests/defeitosEletrodo.test.ts`, um segundo passe com calor funde no primeiro (menos de 10 % de interface sem fundir) e um passe rápido, frio, não liga (mais de 50 %, defeito grave). A técnica boa nas cinco peças continua sem defeito.

### H98 — forma pela alimentação e humping no MIG (v2.0, Claude)

- **Forma pela alimentação:** a razão altura/largura passa a ser `razão pela tensão (H9) × fator da alimentação`. O fator é `(alimentação ÷ referência)^−0,2`, limitado entre 0,8 e 1,1. Na alimentação de referência ele vale 1, e nada muda.
- **Origem:** a direção vem da Tabela 3 de Banaee et al. (2023). Na mesma velocidade, h/w caiu de 0,39 (1,8 m/min) para 0,28 (4,6 m/min), um expoente de cerca de 0,35. O jogo usa 0,2 e um teto de 1,1 porque o arame e a máquina são outros. Com o teto de 1,25, a condição "puxando" do inox-equipamento no Arcade ficou sem solução no Difícil. Os coeficientes das regressões do artigo **não** foram transferidos.
- **Comparação de tentativas:** a decomposição da largura (H25) põe o efeito da alimentação na forma junto com o da taxa, e o fator da tensão usa só a parte da tensão. O produto continua exato.
- **Humping (hipótese do jogo):** corcovas com pescoços estreitos entre elas, onde a tocha passou rápido **e** com corrente alta. O índice por fatia é o produto de `(vRel − 1,5) ÷ 0,8` e `(I − 190·d) ÷ (70·d)`, cada parte limitada a 0…1. Aqui vRel é a velocidade relativa à de referência da junta, I a corrente dos ajustes de quando a tocha passou (pelo registro) e d o diâmetro do arame em mm. O artigo cita o humping como limite da velocidade alta, mas a regra e os números são do jogo.
- **Defeito:** "Cordão em corcovas (humping)" quando o índice passa de 0,3 num trecho de pelo menos 3 mm. Tira da nota de superfície como o escorrimento. No 3D, a altura do cordão ondula com período de 7 mm, e o volume médio fica o mesmo.
- **Testes:** os testes ficam em `tests/humping.test.ts` e verificam:
  - o fator vale 1 na referência e cai com a alimentação;
  - um cordão com o dobro de arame no dobro da velocidade sai mais baixo para a largura;
  - não há humping na corrente de referência andando rápido, nem com corrente alta no ritmo certo;
  - há humping com corrente alta andando rápido;
  - o resultado é o mesmo a 30 e a 144 quadros/s.

### H99 — tocha parada fura a chapa (v2.0, Claude)

- **O problema:** o amortecimento do H33 (`1 ÷ (1 + (seção ÷ 25 mm²)²)`) crescia sem limite com o metal acumulado. Com a tocha parada, o índice de fusão subia até uns 2 s e depois **caía**. A 22 V ele era 2,4 em 2 s e 1,4 em 8 s, e por isso a chapa nunca furava: o metal só escorria.
- **A regra nova:** o metal acumulado protege só até 50 mm² de seção. Daí em diante o calor da tocha parada continua entrando e atravessa a chapa.
- **O que vale nos testes:** chapa de 3 mm, alimentação de referência, tocha parada:
  - a 22 V, fura em cerca de 7 s;
  - a 26–30 V, fura em 1–2 s;
  - a 18 V (curto-circuito, pouco calor), não fura em 2 s;
  - na chapa de 8 mm, não fura em 8 s.
- **O que continua igual:** andando devagar demais a penetração ainda cai, como na fonte do H33 (o teste de 1 mm/s contra 2,5 mm/s continua valendo). Os números são do jogo.

### H100 — tensão de 0 a 30 V (v2.0, Claude)

- **Painel e formato salvo:** o painel vai de 0 a 30 V. O botão 1 continua sendo 14 V e o 10 continua sendo 30 V, então registros salvos e replays valem o mesmo. Abaixo de 14 V o valor interno fica abaixo de 1, e o formato não muda.
- **Abaixo de 10 V, sem arco:** o gatilho solta arame, mas o arco não se forma. Não há corrente, calor, metal, luz nem som de arco. O status avisa: "o arame só sai e bate na chapa".
- **De 10 a 14 V, arame batendo (stubbing):** o arco quase não se sustenta.
  - O calor cai em linha até zero em 10 V.
  - O metal que vira cordão cai para 60–100 % (o resto vira pedaço solto e respingo).
  - O cordão fica alto e estreito (razão até 0,45).
  - Arco curto e frio deita o metal sem fundir as bordas (sobreposição) mesmo na velocidade certa, e respinga.
- **De 14 V para cima:** nada mudou.
- **Arcade:** a máquina pré-ajustada continua só em curto-circuito ou spray.
- **Origem dos números:** a direção vem da prática do MIG/MAG (tensão baixa demais faz o arame bater e mergulhar na poça; sem tensão não abre arco). Os limites de 10 e 14 V são do jogo, não de catálogo de fabricante.
- **Testes:** `tests/tensaoBaixa.test.ts` cobre o H99 e o H100.

### H101 — a chapa consumida pelo calor, em estágios, e furada de verdade (v2.0, Claude)

- **O que derreteu não volta:** a simulação guarda, a cada 100 ms de tempo de arco e no fim do passe, o índice de fusão das fatias a até 12 mm da tocha. O pico guardado nunca diminui. A análise usa o maior entre o índice final e o pico, então metal que chega depois não "desfaz" a fusão nem fecha o buraco. Por isso andar muito devagar (1 mm/s) também fura a chapa de 3 mm: com 2,5× o calor por mm, o índice sobe só ~4 % sobre o de 2,5 mm/s. O teste do amortecimento mudou de propósito para isso.
- **Calor para os lados:** o índice F é o calor no meio da poça. Para os lados ele cai como `F·exp(−3,3·(2d/w)²)`, com w a mancha de calor (a largura da poça, até 8 mm). Cada ponto da chapa passa pelos estágios conforme o calor que chegou nele:
  - raiz aparente no avesso;
  - metal vazando e pendurado (a faixa do avesso que vazou acompanha esse calor);
  - face afundando;
  - **buraco**, que nasce pequeno no ponto mais quente e alarga com mais calor: `largura = w·√(ln(F ÷ limite) ÷ 3,3)`.
- **Material e espessura:** os dois já entram no calor necessário (H33/H35: espessura × fator do material). Além disso, o alumínio quase não avisa: raiz aparente, metal pendurado e afundamento ficam numa faixa estreita, logo antes do furo, porque ele conduz o calor para longe, não muda de cor e cai de uma vez. Na chapa de 8 mm, o tempo parado que fura a de 3 mm não fura.
- **No 3D, durante a solda e no resultado:** no topo e no V há um mapa da chapa (células de 0,5 mm) que recorta a chapa, o cordão, o brilho do metal quente e o metal do avesso onde o metal caiu.
  - Dá para ver através do buraco, de cima e de baixo (a câmera da execução já desce até o avesso).
  - Em volta fica a borda queimada; por dentro, a parede escura da chapa.
  - Por baixo, o metal pendurado forma um lábio em volta do buraco.
  - Enquanto vaza, gotas de metal se soltam do avesso e caem.
  - Vale também para o eletrodo e o TIG, que já calculam a largura do furo.
  - No filete continua o cilindro escuro.
- **Testes:** `tests/consumoChapa.test.ts` cobre:
  - a ordem dos estágios e o alumínio sem aviso;
  - o buraco que nasce pequeno e só cresce;
  - o metal vazando antes de furar;
  - a chapa grossa e o material;
  - a independência da taxa de quadros;
  - o mapa recortando o ponto mais quente.
- O teste de `tests/penetracao.test.ts` que pedia furo maior que 0,5 mm a 2 mm/s agora pede furo maior que 0, porque o buraco nasce pequeno.
- Os números são do jogo; não é simulação de metal líquido.

### H102 — a vareta do TIG funde no ritmo do jogador (v2.0, Claude)

- **O defeito:** a ponta da vareta ficava a 0,8 mm à frente da *tocha*. Quem segue a instrução ("avance um passo a cada toque") move a tocha e toca logo depois. A poça ainda ficou para trás, e a vareta batia na chapa fria. Com passo de 2 mm, quase todo toque virava "vareta na chapa fria" e o reforço ficava em zero.
- **Onde a vareta vai agora:** como o soldador faz, a vareta vai à borda da frente da *poça*.
  - Se o ponto de antes, logo à frente do tungstênio, estiver fundido, ela fica nele, como antes.
  - Se estiver frio, ela procura a poça logo atrás, até 4 mm atrás do tungstênio.
  - Sem poça nenhuma, continua batendo na chapa fria.
  - Durante um mergulho a vareta fica no mesmo ponto.
- **Folga ao fundir:** um toque que já começou fundindo continua enquanto a ponta estiver a pelo menos 85 % da temperatura de fusão. Antes, o metal frio da vareta esfriava a célula e cortava o toque em 40–80 ms, e cada toque punha menos de 1 mm de vareta.
- **Calibração:** com mais metal frio entrando, a poça esfria um pouco. Por isso a raiz aparente no avesso (H94) passou de 0,80 para 0,78 do limite de furo.
- **Toques perdidos em PC lento:** com poucos quadros por segundo, a tecla (ou o clique da vareta) podia descer e subir entre dois quadros, e o toque sumia. No navegador sem placa de vídeo, só 1 de 18 toques chegava. Agora o toque fica guardado até o próximo quadro e, a partir dele, a vareta mergulha pelo menos 150 ms: no mesmo teste, 18 de 18.
- **Testes:** em `tests/tig.test.ts`, "avançar 2 mm e tocar logo" funde a vareta sem nenhum toque frio e com reforço na faixa nas três peças, e falha no código antigo. "Sem poça, a vareta bate" continua valendo.
- Os números são do jogo.

### H103 — tubo com tubo, de topo (v2.0, Claude)

- **A peça:** emenda de topo de dois tubos de 1½" (no jogo, Ø 47,7 mm), soldada em volta. A junta de 150 mm do jogo é a volta do tubo desenrolada, então o modelo (cordão, calor, fusão, defeitos, nota) é o mesmo da junta de topo reto.
- **Gravidade em volta (MIG/MAG):** no ponto a φ graus do alto, a gravidade nos eixos da junta é `{t: sen φ · cos f, n: sen f, w: −cos φ · cos f}`, com f o tombamento.
  - Em cima a posição é plana; no lado, vertical (descendo ou subindo conforme o sentido); embaixo, sobrecabeça.
  - Com o eixo do tubo de pé (tombado 90°), a volta inteira é horizontal (2G).
  - A simulação usa a gravidade do ponto em que deposita, então gotas e escorrimento aparecem onde o tubo está.
  - Com o tubo fixo (5G) e a poça grande, pinga embaixo e escorre nos lados. Girando o tubo a cada 45° para soldar sempre perto do alto (1G), não.
- **Girar o tubo:** no tubo, o "giro" da posição da peça é a rotação no próprio eixo. Os campos salvos são os mesmos; o formato dos registros não muda.
  - No MIG/MAG, ⟲ ⟳ da barra de posição giram o tubo (com o arco fechado).
  - No eletrodo e no TIG há botões TUBO ⟲ ⟳ na bancada.
- **Desenho:** a peça plana é enrolada no cilindro no vertex shader (`curvaTubo.ts`): a = x/R + giro, X = (R + y)·sen a, Y = (R + y)·cos a − R.
  - Chapas (com extrusão subdividida), cordão, defeitos, marcas, faixas de calor, metal do eletrodo e escória curvam.
  - Tocha, mira, alicate, vareta, poça, luz e rótulos ficam rígidos, postos e inclinados no ponto do tubo.
  - Faíscas, respingos e gotas nascem no tubo e caem com a gravidade de verdade.
  - No tubo não há exagero vertical nem empeno, e a sombra projetada é desligada (o mapa de sombra veria a peça plana).
- **Entrada:** o raio da câmera acerta o cilindro e volta para a junta desenrolada (MIG). No eletrodo e no TIG, cada ponto do raio é desenrolado antes de comparar com a superfície.
- **Onde está:**
  - MIG/MAG: a missão "Tubulação da horta comunitária", antes só planejada, vira jogável (também no treino de missões, no arcade e na rede, que usa as missões de aço carbono).
  - Eletrodo: peça "Tubo com tubo — emenda de topo".
  - TIG: peça "Tubo com tubo — inox 2 mm".
  - As peças novas entram no fim das listas e não mudam o índice das outras.
- **Limite:** os modelos do eletrodo e do TIG não têm gravidade. No tubo eles mudam o desenho e o giro, mas não o escorrimento em volta.
- **Testes:** `tests/tubo.test.ts` cobre:
  - as posições em volta, o eixo de pé (2G), o 5G e o 1G;
  - a curvatura (ida e volta, raio de cima no alto do tubo, pose rígida).
- Os números são do jogo.

### H104 — chapas com características próprias, trocáveis no treino (v2.0, Claude)

- **Chapas novas** (`src/modelo/material.ts`), além do aço carbono, do inox austenítico e do alumínio:
  - **Aço galvanizado:** aço carbono fino coberto de zinco. Estoque de 1,2 a 2 mm. Sem esmerilhar o zinco da borda, a fusão cai (o mesmo fator do óxido do alumínio, H35) e sobra poro (0,6 de porosidade de base). Não vai ao TIG (o zinco contamina o tungstênio).
  - **Aço médio carbono (SAE 1045):** chapa grossa (4 a 8 mm). Pede 10 % a mais de calor que o aço carbono, custa a esquentar (ganho 0,18) e guarda o calor (τ = 40 s); a peça quente funde bem melhor (e = 0,45). Deforma pouco (0,8).
  - **Inox ferrítico (430):** chapa bem fina (1 a 2 mm). É a chapa que mais rápido esquenta (ganho 0,4); deforma menos que o inox austenítico (1,2) e também colore.
  - **Cobre:** pede o maior calor do jogo (2,4 vezes o do aço), esquenta a peça inteira e esfria rápido (τ = 12 s); peça quente funde muito mais (e = 1). Os estágios antes do furo são estreitos, como no alumínio. MIG com argônio puro.
- **Ficha da chapa:** cada material tem um resumo, o comportamento do calor, os pontos que o distinguem e o estoque de espessuras. A ficha mostra níveis de 1 a 5 (calor para fundir, esquenta rápido, guarda o calor, deforma) **calculados dos próprios números do modelo**, para a ficha nunca contradizer a física. Nenhuma chapa tem a mesma ficha de outra.
- **Troca no treino:**
  - **MIG/MAG, treino livre:** a bancada tem os grupos **Chapa** e **Espessura**. A chapa traz o gás, o arame, a limpeza (óxido ou zinco) e o estoque dela. Na troca, fica a espessura atual se o estoque tiver; senão, a mais perto da de teste da junta. O chanfro em V só aparece para chapas de 4 mm ou mais; numa chapa só fina ele fica bloqueado e a junta volta ao topo.
  - **Eletrodo e TIG:** depois da peça vem **Escolha a chapa** (a da peça vem primeiro). A geometria da peça fica a mesma; o material traz a física dele.
    - Eletrodo: a corrente sugerida (e com ela o aporte de referência da análise, H82) acompanha o calor que a chapa pede (`necessidadeFusao`). O galvanizado põe metade do poro do zinco (o revestimento segura o resto; não há como limpar no jogo).
    - TIG: calor por volume, difusividade, perda e temperatura de fusão vêm da chapa. O limite de furo acompanha a temperatura de fusão na mesma proporção do aço. A corrente sugerida acompanha `fatorCorrente`, medido no próprio modelo: a corrente que dá a mesma largura fundida que o aço carbono no filete de 3 mm a 2 mm/s (inox 0,8; alumínio 1,35; cobre 2,1). Os valores do aço carbono e do inox não mudaram. A escala de corrente da fonte cresce quando a chapa pede mais de 200 A.
  - Missões, Arcade, História, torneio e rede continuam com a chapa da encomenda.
- **Limites:** a difusividade do TIG é metade da real (para caber na grade de 1 × 0,5 mm). O alumínio no TIG real pede corrente alternada; o jogo não muda a polaridade. O médio carbono não tem trinca por têmpera no modelo: o pré-aquecimento só aparece como fusão melhor com a peça quente. O eletrodo não acumula calor de um passe para o outro.
- **Testes:** `tests/materiais.test.ts` (catálogo, fichas únicas, toda chapa × junta × espessura monta contexto válido, cobre pede mais calor e inox menos, ferrítico esquenta mais e médio carbono menos, zinco faz poro, corrente do eletrodo e do TIG pela chapa, cobre no TIG).
- Os números são do jogo.

### Complemento H101 — aquecimento fora da junta (MIG/MAG)

Cada cordão solto possui aporte e picos de fusão próprios. O calor de um depósito fora da junta não é transferido ao cordão da junta. A chapa plana fora da junta usa a referência de topo sem abertura, com o mesmo material e espessura. O mapa compõe os furos de todos os cordões, sem deslocá-los nem apagar os anteriores. O tempo fora da junta continua contando para eficiência. Modelo didático por faixas de cordão, não uma solução térmica contínua 2D.
### H105 — brasagem forte com maçarico (v2.0, Claude)

- **O processo:** junta sobreposta; o metal de base não funde. O maçarico aquece a junta, a vareta encostada na borda derrete pelo calor **da peça** e a liga entra na folga por capilaridade. Detalhes, controles e peças em [`BRASAGEM.md`](BRASAGEM.md).
- **Calor:** o campo do TIG (H92), com uma chama gaussiana larga no lugar do arco. Na sobreposição o calor vai para as duas chapas (o dobro da massa).
  - Bico de 1 a 5: potência na peça de 1,1 a 6,2 kW.
  - Largura da chama: σ = 2,2 + 0,32 × (distância − dardo) + 0,6 × bico (mm).
  - Rendimento: cai acima de 15 mm de distância.
  - Chama: neutra ×1; oxidante ×1,1 e oxida três vezes mais; carburante ×0,85 e oxida menos.
- **Liga** (temperaturas de catálogo): a mobilidade vai de zero no solidus a cheia 20 °C acima do liquidus.
  - A vareta só derrete pela peça acima do solidus.
  - Sobre a peça fria, se a chama dá nela 35 % ou mais do calor do centro, ela derrete na chama e cai em bolinhas que não molham (contadas como liga embolada).
- **Molhamento:** a liga só molha onde a superfície está limpa.
  - Com fluxo, ele precisa estar na faixa ativa. Ativo, o fluxo dissolve o óxido e se gasta (60 s o branco, 90 s o bórax; a chama oxidante gasta três vezes mais rápido). Acima da faixa, ele queima em 0,8 s.
  - Ainda pasta ou pó, o fluxo protege do ar (oxida 8 % do normal).
  - Sem fluxo, o metal oxida acima de 400 °C (300 °C no cobre).
  - O cobre-fósforo no cobre limpa sozinho, exceto com chama oxidante.
- **Capilaridade:** a liga do filete entra na folga e corre para as células vizinhas que molham, mais depressa para as mais quentes. Velocidade: 25 mm/s × f(folga) × mobilidade.
  - f(folga) é uma gaussiana no logaritmo, com máximo em 0,075 mm (desvio 0,45).
  - Acima de 0,15 mm a capilaridade não segura a coluna de liga e as células enchem só em parte (vazios).
  - Abaixo do solidus a liga trava (solidifica).
  - Filete acima de 4 mm² escorre.
- **Defeitos:**
  - zinco da liga fervendo acima do superaquecimento (poros);
  - metal de base fundido (acima da fusão);
  - zinco do galvanizado fervido acima de 907 °C (faixa sem proteção);
  - cobre-fósforo no aço (fosfeto de ferro, junta frágil).
- **Calibração:** com um brasador simulado com a técnica de oficina, a junta de aço com prata e bico 2 enche cerca de 75 % em uns 40 s, e a de cobre com cobre-fósforo, com bico 5, em uns 25 s. Com bico 3 o cobre não chega à faixa. Folga de 0,3 mm deixa vazios (cerca de 10 %). O latão só enche com o lado de dentro da sobreposição quente.
- **Testes:** `tests/brasagem.test.ts`:
  - dados de catálogo coerentes;
  - folga certa contra folga larga;
  - sem fluxo a liga embola;
  - vareta na chama vira bolinhas;
  - fluxo queimado com bico grande parado;
  - cobre-fósforo no cobre sem fluxo e no aço (frágil);
  - latão queima mais zinco que a prata no galvanizado;
  - o latão pede o lado de dentro quente;
  - o resultado não depende da taxa de quadros.
- Potências, velocidades e vidas do fluxo são números do jogo; temperaturas de ligas, fluxos e metais são de catálogo.

### H106 — manufatura aditiva por deposição a arco, programada em INFORM (v2.1, Claude, experimental)

- **O modo:** programa de robô (subconjunto do INFORM III, controlador de referência DX200) que fabrica uma parede de várias camadas. Detalhes, fontes, limites e o que não está implementado em [`MANUFATURA-ADITIVA.md`](MANUFATURA-ADITIVA.md). Não é réplica do controlador, da fonte nem do robô.
- **H106-a, cinemática:** sem o modelo do MA1440. MOVL em linha reta na velocidade V. MOVJ aproximado:
  - arco ilustrativo fora da reta, de 8 % da distância para o lado e 6 % para cima;
  - tempo por VJ × 1000 mm/s equivalentes;
  - orientação sozinha a 60°/s.

  O alcance de 1440 mm é o único limite do robô.
- **H106-b, condições:** os arquivos ASF/AEF (controlador) levam a alimentação e a correção do arco. A linha sinérgica da fonte é didática: I = 30 + 25·alim (A) e U = 16 + 1,4·alim + 0,25·correção (V).
- **H106-c, deposição:**
  - Q = 0,92·π·1,2²/4·alim e seção A = Q/V (robô parado = 2 mm/s).
  - Parábola A = (2/3)·w·h; w/h = 2,6 na peça fria, +0,32 por 100 °C, −3 %/mm de tocha alta. Início do arco (0,8 s) mais estreito; acima de 650 °C, escorre (×1,8).
  - O cordão assenta no topo solidificado sob o eixo.
  - Cratera de 0,3·A·1,5w no fim, que o AEF enche.
  - Robô parado: largura limitada à do cordão em movimento; abertura com metade da alimentação (partida suave).
  - A < 4 mm² ou V > 14 mm/s partem o cordão.
- **H106-d, calor:** um nó, dT/dt = 5 K/(s·kW)·P − (T − 25)/τ, com τ = 25 s + 3 s/mm de parede. Passo exato.
- **H106-e, distância da tocha:**
  - TCP na ponta do arame;
  - folga acima de 6 mm: arco instável; acima de 12 mm: perda de arco (alarme);
  - abaixo de −3 mm: o arame mergulha; bocal abaixo do topo: colisão (alarme).
- **Executor:** passo fixo de 10 ms (determinístico, independe da taxa de quadros e do relógio da tela). Limites de 400 linhas, 20 000 instruções, 2 000 saltos para trás e 60 min simulados.
- **Calibração:** com 5 m/min e V = 8 mm/s, a camada soma cerca de 2,2 mm, com 7 a 8 mm de largura.
  - O programa inicial (incremento de 2,8 mm, espera de 20 s) termina com o TCP cerca de 6 mm acima do topo e interpasse perto de 380 °C: reprovado.
  - Com 2,2 mm e 60 s: TCP perto do topo, interpasse de cerca de 160 °C, aprovado.
  - Sem espera, passa de 650 °C e escorre.
  - No mesmo sentido, o topo inclina mais que alternando.
- **Testes:** `tests/manufatura.test.ts`.
- Os números são do jogo, calibrados para as tendências. **Não** são da tese da UFPE (o PDF não pôde ser aberto), nem do fabricante, nem medição.


### Complemento H106 — escoamento local da poça na manufatura

A parcela nova depositada pode migrar para vizinhos mais baixos durante a janela de solidificação de 1,5 s. O interpasse influencia a mobilidade, sem representar a temperatura local de fusão. A etapa roda no passo fixo, conserva a integral de alturas e o arame registrado, respeita o metal já solidificado e deixa a forma final permanente ao esfriar. Modelo de altura, sem gotas destacadas nem material pendurado. Limites e hipóteses em `docs/MANUFATURA-ADITIVA.md`.


### H107 — soldagem a plasma (PAW), keyhole e microplasma (v2.2, Claude)

Na mesma chapa e no mesmo calor do TIG (H92), o plasma muda (`src/modelo/plasma.ts`):

- **H107-a, coluna constrita:** o tungstênio fica recuado num bocal de cobre. O calor chega com σ = 0,75 + 0,05·L − 0,15·gás (mm), que quase não muda com a distância L (no TIG, σ = 0,9 + 0,35·L). Tensão de 20 + 0,4·L V.
- **H107-b, arco piloto:** o arco transferido abre até 9 mm e se mantém até 14 mm (TIG: 5 e 8 mm).
- **H107-c, sem contaminação, com arco duplo:** quem encosta (≤ 0,8 mm) é o bocal, e o arco passa por ele (arco duplo). O mesmo acontece acima de 230 A (limite do furo do bocal no jogo). O bocal fica gasto: σ + 0,9 mm até trocar.
- **H107-d, keyhole:**
  - abre quando a seção sob a tocha passa de 92 % do limite de furo do TIG para a chapa e o gás de plasma é de pelo menos 0,8 L/min; fecha abaixo de 80 %;
  - diâmetro = pedal·(1 + 0,8·gás) mm, mais 2,5 mm por segundo com a tocha parada (< 1,2 mm/s);
  - fecha atrás se o diâmetro ficar abaixo de 1,4 + 0,55·espessura (mm); acima disso fica um furo (com gás alto, uma sequência de furos: corte);
  - a seção que o keyhole atravessa tem penetração total;
  - no fim, o keyhole só fecha com a corrente descendo em rampa por pelo menos 0,45 s; cortar de vez deixa um furo.
- **Calibração (testes):**
  - inox 4 mm: keyhole estável com 120–180 A e 2–4 mm/s (1,5 L/min);
  - aço carbono 5 mm: 150–220 A;
  - 0,5 L/min não abre; 3,5 L/min corta;
  - inox 1 mm com 0,3–0,5 L/min: funde sem furar até cerca de 20 A (microplasma).
- **Nota:** fusão no trecho, penetração total (keyhole) ou cordão estreito (microplasma), largura regular, keyhole estável e bocal/arco, com desconto por furo como no TIG.
- **Testes:** `tests/plasma.test.ts`.
- **Base qualitativa:** o comportamento (coluna constrita, arco piloto, keyhole, rampa de descida, arco duplo, microplasma em chapa fina) segue a literatura de soldagem, por exemplo o *Welding Handbook* da AWS (vol. 2, capítulo de soldagem a plasma) e S. Kou, *Welding Metallurgy* (2ª ed.). Os números são do jogo, calibrados para essas tendências: não são de procedimento nem de fabricante.


### H108 — torno convencional operado nas manivelas (v2.2, Claude)

Refaz a Usinagem no estilo da bancada de solda: o jogador move a ferramenta e a física responde em tempo real (`src/torno/modelo.ts`). O conteúdo da Usinagem anterior (materiais, encomenda OM-01, fórmulas) serviu de guia; o código é novo.

- **H108-a, peça:** perfil de raio r(z) em células de 0,05 mm, com z medido da face da placa. A ponta (raio rε) corta à frente, do lado da placa; atrás dela a aresta corta reta por 3 mm. Para o faceamento limpar a face até o centro, a ponta passa até 1,5 mm do centro, e o avanço transversal para sozinho em −rε.
- **H108-b, corte:**
  - avanço por volta f = |v|/(n/60);
  - vc = π·D·n/1000;
  - seção do cavaco = f × engajamento na direção do movimento (longitudinal: profundidade radial, medida pelo material à frente da ponta; transversal: largura axial em contato);
  - força de Kienzle Fc = kc11·f^(−mc)·A;
  - potência = Fc·vc/60.
- **H108-c, limites:**
  - motor de 4 kW, cheio a partir de 710 rpm (abaixo, proporcional à rotação): acima disso, o eixo para (sobrecarga);
  - profundidade acima de 4 mm ou Fc acima de 3,8 kN quebra a pastilha;
  - encostar com o eixo parado, ligar o eixo com a ferramenta encostada ou bater na placa também quebra.
- **H108-d, desgaste:** Taylor do jogo. VB chega a 0,3 mm em `vidaRefS`·(vcRef/vc)^expoente segundos de corte (240 s a 200 m/min no aço 1045), e a carepa dobra o desgaste. Acima de 0,6 mm, a aresta lasca.
- **H108-e, rugosidade:**
  - Ra = max(Ra mínima, f²/(8rε)) × (1 + aresta postiça) × (1 + 2·VB) × 2,5 se vibrar × 3 se lascada;
  - aresta postiça na janela de vc baixa de cada material (dados da Usinagem anterior);
  - a causa dominante fica registrada por célula, para a inspeção.
- **H108-f, deflexão:** a peça sai acima da ponta por Fp/k (Fp = 0,4·Fc, k = 20 N/µm do carro), mais Fp·L³/(3EI) da peça em balanço, mais 0,1·VB. No desbaste, alguns centésimos; no acabamento leve, quase nada. É a razão de medir antes do passe final.
- **H108-g, vibração:** com esbeltez L/D > 2,5 e seção acima de 0,6/(L/D − 1,5) mm², a peça vibra.
- **H108-h, cavaco:** fita (aço, alumínio, inox), que vira espiral quebrada acima do avanço de quebra; curto no latão; azulado acima da vc de azular (aço, inox).
- **Medição:** micrômetro 0,01 mm, paquímetro 0,02 mm e rugosímetro 0,1 µm, só com o eixo parado (medir com a peça girando conta como falha de segurança).
- **Nota (0–1000):** diâmetro na tolerância 300, comprimento até o ressalto 150, acabamento 200, face e região bruta 100, ferramenta e segurança 150, parâmetros e tempo 100. O Difícil aprova com 20 % em cada item.
- **Testes:** `tests/torno.test.ts` (OM-01 bem feita aprovada no Difícil; deflexão; Ra pelo avanço; aresta postiça; quebras; sobrecarga; vibração; segurança; independência da taxa de quadros).
- Números do jogo, com a ordem de grandeza de dados de usinagem (Kienzle, Taylor, Ra teórica). Não são de catálogo de ferramenta nem de máquina.


### H109 — Laboratório de Falhas com as mãos (v2.2, Claude)

O Laboratório foi refeito no estilo da bancada de solda: as estações são feitas com as mãos, e as ações viram as escolhas do motor de ensaios do caso (`src/setores/laboratorio/motor`, já testado), que continua decidindo o que aparece. O conteúdo do caso "A junta que falhou" (ficha, verdade, gabarito) não mudou.

- **Inspeção:** a lanterna é arrastada na vista 3D. Elevação abaixo de 25° conta como luz rasante; acima, difusa. Com a lupa, a vista é de detalhe. A limpeza é com solvente e escova macia (suave) ou com escova de aço (agressiva, irreversível). A prévia ao vivo usa o próprio motor (sem custo); fotografar registra.
- **Corte:** o ponto é marcado na vista de cima e o disco avança enquanto o botão é segurado. Acima de 3 mm/s o disco trava; sem refrigeração, acima de 1,5 mm/s. O corte tem 14 mm.
- **Lixamento:** arraste na lixa. Cada lixa exige uma distância de passadas (900, 1100 e 1300 mm de arraste para as #220, #600 e #1200). Sem girar a amostra 90° na troca de lixa, rende 55 %. O motor recebe a última lixa de uma sequência sem saltos: pular a #600 conta como "lixa-220", e com polimento o motor acusa arrancamento.
- **Polimento:** pano com movimento por 8 s (6 µm) e 6 s (1 µm).
- **Ataque:** com Nital, menos de 2 s não revela, 2 a 12 s revela e mais de 12 s é sobreataque.
- **Microscópio:** a mesa é posicionada no mapa da seção. O ponto de foco é fixo para cada preparação e aumento, com tolerância de 4, 2 e 0,8 unidades a 10×, 100× e 500×, e a imagem borra fora dele. Só captura em foco. Clicar na imagem capturada marca os achados locais.
- **Microdureza:** pontos clicados na seção e carga escolhida.
- **Raciocínio:** hipóteses, interpretação, relatório e devolutiva continuam no "escritório" (a tela de texto do Laboratório anterior, sem a aba de ensaios), com o mesmo estado salvo.
- **Testes:** `tests/laboratorioManual.test.ts`.
- Tempos e distâncias são do jogo. Não são procedimento de laboratório.

### H110 — Solda subaquática molhada (v2.2, Claude)

Treino → SUBAQUÁTICA. Eletrodo revestido na água (solda molhada), na mesma bancada do eletrodo, com o fundo do mar no lugar da oficina.

- **Escuro:** quase nada chega da superfície. A lanterna do capacete é a luz principal: segure F e arraste para apontar (no celular, 🔦 Mirar luz). A água turva (névoa) esconde o que está longe. O arco ilumina só em volta da poça.
- **Chave da corrente:** o mergulhador pede "liga" ou "desliga" (C) e o ajudante na superfície confirma em cerca de 0,9 s. Sem corrente o arco não abre. Trocar a vareta com a corrente ligada é choque: −150 pontos por choque e reprovação no Difícil.
- **Corrente:** a água rouba calor do arco. A fonte precisa de 1,15 + 0,005 × profundidade (m) vezes a corrente que chega ao arco (17 % a mais a 4 m, 24 % a 18 m).
- **Poro:** soma ao poro do eletrodo 0,04 + 0,006 × profundidade + 0,35 × (arco − 1 diâmetro)/0,6, limitado a 0…1. O arco tem de ser bem curto, quase arrastando.
- **Dureza da ZTA:** t8/5 no ar = 10 s por kJ/mm de aporte; na água, 22 % disso (um pouco menos ainda com a profundidade). Dureza = martensita (884 C + 294) misturada com 180 HV pela fração 1 − e^(−t8/5/τ), τ = 2 + 12 (CE − 0,25). Um segundo passe por cima tira 40 HV (revenimento). Limite do jogo: 350 HV; acima, desconta 4 pontos por HV (até 200) e reprova no Difícil.
- **Risco de trinca por hidrogênio:** pela dureza mais 1,5 HV por metro de profundidade (baixo < 300, médio ≤ 360, alto acima).
- **Peças:** cais a 4 m (cordões sobre chapa), casco de balsa a 8 m (remendo sobreposto) e perna de plataforma a 18 m (filete em T, aço com CE 0,44: pede mais calor ou revenimento).
- **Testes:** `tests/subaquatica.test.ts`.
- Números didáticos, calibrados para o jogo. Não substituem procedimento qualificado de solda molhada (por exemplo, AWS D3.6M) nem treinamento de mergulho.
