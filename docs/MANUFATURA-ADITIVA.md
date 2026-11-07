# Manufatura Aditiva — Programação Robotizada (v2.1, H106, experimental)

Menu → **MANUFATURA ADITIVA**, com duas opções:

- **Missão: parede reta:** com nota, aprovação e atividade guiada (abaixo).
- **Modo livre:** é o modo de teste, sem missão, sem nota e sem aprovação.
  - Tem o projeto salvo à parte; o da missão não muda.
  - O programa começa com um cordão só, de A a B.
  - A inspeção mostra as medidas da peça: extensão, altura máxima, área, metal, arame, energia, tempo e interpasse.
  - Mostra também o perfil visto de lado e os avisos do processo: alarme, distância da tocha, escorrimento, humping, MOVJ com arco, arco cortado e tocha inclinada.
  - Não há aba Atividade nem marcas da missão na célula.

> **Versão de teste.** A v2.1 não é estável e serve para testar funções novas. O simulador **não é réplica** do controlador do robô, da fonte de soldagem nem do robô. Ele não é um controlador certificado. É um exercício didático de programação e de fabricação por deposição a arco (WAAM).

## O que se faz

O ciclo é: preparar a célula → ensinar posições → editar o programa → validar → executar sem deposição → fabricar → inspecionar → corrigir.

A primeira missão é uma **parede reta de várias camadas**, com o sentido alternado entre as camadas, sobre um substrato de inox 316L. A missão pede:

- a parede de X 700 a X 800 mm, em Y 0;
- altura útil de 15 mm ou mais e largura de 5 mm ou mais;
- nenhuma falha;
- interpasse de até 200 °C (limite da missão, não de norma).

O **programa inicial é válido e roda, mas é reprovado**. O incremento de camada (2,8 mm) é maior que a altura real de uma camada (cerca de 2,2 mm), e a espera de 20 s é curta para as camadas de cima. A atividade guiada (aba **Atividade**) leva o jogador a medir a parede, comparar com o programa, corrigir e aprovar. Por exemplo, `ADD D000 2200` com `TIMER T=60.00` é aprovado.

## Tela

Cabe em 1280×720 e 1366×768 sem rolar a página: as listas rolam por dentro.

- **Programa e depuração** (esquerda):
  - editor do corpo do job, com números de linha, a linha em execução e os erros e avisos marcados;
  - botões **Validar**, **Sem deposição**, **Fabricar**, **Pausar**, **Continuar**, **Passo**, **Parar** e **Reiniciar**, mais o **Relógio** (×1 a ×30, que acelera só o relógio e não muda o resultado);
  - mensagens com a linha, o motivo e como corrigir;
  - **Comandos** abre a lista acessível do subconjunto, com exemplos.
- **Célula 3D e peça** (direita, em cima):
  - o robô ilustrativo, a mesa, o substrato e a parede crescendo;
  - os pontos ensinados (amarelo é o selecionado) e o caminho do TCP: laranja com arco, azul sem arco;
  - o painel com o TCP, o estado do arco, a distância do TCP ao topo, a temperatura da parede e as camadas;
  - as câmeras **Peça**, **Lado** e **Célula**.
- **Posições e parâmetros** (direita, embaixo), em abas:
  - **Posições:** a tabela C00000… com X, Y, Z, Rx, Ry e Rz. Escolha o ponto, mova a ferramenta virtual (jog por eixo, com passo) e use **Registrar no ponto**.
  - **Célula:** referência da peça, TCP, distância de trabalho (bico–peça), orientação da tocha, a missão e a diferença entre MOVJ e MOVL.
  - **Condições:** os arquivos ASF (início de arco: alimentação e correção do arco) e AEF (fim de arco: tempo e alimentação da cratera). Ficam separados do movimento.
  - **Variáveis:** B, I, D e P ao vivo, e o deslocamento (SFTON).
  - **Atividade:** o roteiro guiado.
  - **Inspeção:** a nota, as medidas, o perfil da parede, o que corrigir e a tabela das camadas.

O botão **← Menu / voltar** (Esc) pausa e abre o menu, como nos outros modos.

## Subconjunto do INFORM

O **controlador de referência é o DX200, com INFORM III**. A célula da tese da UFPE usa um robô Yaskawa Motoman MA1440. O modelo exato do controlador dessa célula não foi confirmado, por isso o DX200 está declarado como referência.

O editor trata **só o corpo do job**, de NOP a END. Os pontos C ficam na tabela de posições. O jogo **não gera nem exporta `.JBI`**: o cabeçalho (`/JOB`, `//NAME`, `//POS`…), as posições e os metadados do arquivo real não são produzidos.

| Comando | Forma aceita | Observação |
|---|---|---|
| `NOP` / `END` | primeira e última linha | END com o arco aberto corta o arco sem cratera |
| `'texto` | comentário numa linha própria | comentário no fim da linha dá erro |
| `*ROTULO` | até 8 letras, números ou `_` | o tamanho é limite do simulador |
| `MOVJ` | `MOVJ Cnnnnn VJ=x.xx` ou `MOVJ Pnnn VJ=x.xx` | VJ de 0,01 a 100 % |
| `MOVL` | `MOVL Cnnnnn V=x.x` ou `MOVL Pnnn V=x.x` | V de 0,1 a 1500 mm/s |
| `TIMER` | `TIMER T=x.xx` | segundos, resolução de 0,01 s, até 655,35 (limite do simulador) |
| `ARCON` | `ARCON ASF#(n)` | abre o arco com o arquivo de início n |
| `ARCOF` | `ARCOF` ou `ARCOF AEF#(n)` | com AEF, preenche a cratera com o robô parado |
| `SET` | `SET Bnnn valor`, `SET Pnnn Pmmm` | valor constante ou variável B, I ou D |
| `ADD` | `ADD Innn valor`, `ADD Pnnn Pmmm` | soma; com P, soma posição a posição |
| `INC` | `INC Bnnn` | soma 1 |
| `SETE` | `SETE Pnnn (e) valor` | elementos (1) X, (2) Y, (3) Z, em **mícrons**; valor constante ou D |
| `JUMP` | `JUMP *ROTULO` ou `JUMP *ROTULO IF Bnnn<valor` | comparações `=`, `<` e `>` |
| `SFTON` / `SFTOF` | `SFTON Pnnn` / `SFTOF` | deslocamento no sistema da base (o padrão) |

Variáveis: B de 0 a 255, I e D inteiras, P de posição. Os índices vão de 000 a 099 neste simulador. No arquivo do job o movimento nomeia o ponto (`MOVL C00003 V=8.0`); no pendente o ponto fica implícito. Sem o ponto, o simulador dá erro e explica isso.

**Não implementados.** Estes dão erro com o motivo e nunca são ignorados em silêncio:

- opções de movimento: `PL=`, `NWAIT`, `ACC`/`DEC`, `VR`, `UNTIL`;
- movimentos `MOVC`, `MOVS` e `IMOV`;
- `CALL`/`RET`, `WAIT`, `DOUT`/`DIN`/`PULSE`/`AOUT`;
- aritmética e lógica: `DEC`, `SUB`, `MUL`, `DIV`, `AND`/`OR`/`NOT`/`XOR`, e as comparações `<>`, `<=` e `>=`;
- condição escrita na linha do `ARCON` (`AC=`, `AV=`, `AVP=`…), `ARCSET` e `ARCCTS`/`ARCCTE`;
- `WVON`/`WVOF` (oscilação), `COMARCON`;
- `SFTON` em outro sistema (`UF#`, `TF`, `BF`, `RF`);
- `SETE` dos elementos 4 a 6 e variáveis R e S;
- condições por entrada ou saída digital e `JUMP JOB:`.

**G-code, RAPID (ABB) e KRL (KUKA)** são reconhecidos e recusados, com a explicação de que o modo usa só INFORM.

Limites do simulador:

- 400 linhas;
- 100 pontos;
- 20 000 instruções executadas;
- 2 000 saltos para trás;
- 60 minutos simulados.

Passar de um deles é **alarme**: o programa para.

### O que foi conferido e onde

Os domínios da Yaskawa e o repositório da UFPE ficaram **bloqueados** pela rede desta sessão (o proxy recusou a conexão). Os PDFs completos dos manuais **não puderam ser lidos**. O que está acima foi conferido em trechos dos documentos oficiais encontrados por busca restrita aos domínios da Yaskawa:

- a velocidade do MOVL (0,1 a 1500,0 mm/s) e o exemplo `MOVL V=…`;
- a estrutura NOP…END com `MOVJ VJ=…` e `MOVL V=…`;
- `TIMER T=…` com resolução de 0,01 s;
- `ARCON ASF#(n)` / `ARCOF AEF#(n)` e `ARCON AC=… AVP=…` (este reconhecido, não implementado);
- `SFTON Pnnn` com o sistema da base como padrão;
- `SETE Pnnn (e) valor` em mícrons, com elementos 1 a 6;
- `SET`/`ADD`/`INC`;
- `JUMP *ROTULO IF Bnn<…`;
- comentário com apóstrofo e rótulo com asterisco.

**Não confirmado, e por isso tratado como limite do simulador ou como não implementado:** a faixa exata do VJ e do TIMER, o tamanho do rótulo, `PL=`, os operadores `<>`, `<=` e `>=`, e a sintaxe de `DEC`, `SUB`, `MUL` e `DIV`.

Manuais de referência:

- *DX200 INFORM User's Manual* (Yaskawa, P/N 165301-1CD);
- *DX100 INFORM* (155493-1CD);
- manual do operador de soldagem a arco (166346-1CD).

Artigos da base de conhecimento da Yaskawa:

- DX200 INFORM Language;
- YRC1000 INFORM Language;
- MotoSim Inform Commands and Syntax;
- Changing Speed;
- Calculating Position Variable Data;
- Parallel Shift;
- ComArc Seam Tracking;
- INFORM Header Fields.

Contexto da célula: G. G. S. Figueiredo, *Desenvolvimento da manufatura aditiva por deposição a arco pelo processo GMAW-pulsado robotizado de multicamadas de aço inoxidável 316LSi*, tese, UFPE, 2024. A célula tem um robô Yaskawa Motoman MA1440, uma fonte ESAB Aristo 4004i Pulse e o painel Aristo U82. **Os números da tese não foram usados:** o PDF não pôde ser aberto.

## Aproximações (H106)

- **H106-a, cinemática:** não há modelo do MA1440. O robô 3D é ilustrativo (dois elos e um punho, cotovelo para cima) e só serve para olhar. O alcance de 1440 mm (o nominal do MA1440) é o único limite usado. MOVL leva o TCP em linha reta na velocidade V. MOVJ é **aproximado**:
  - o caminho sai da reta num arco ilustrativo (8 % da distância para o lado e 6 % para cima);
  - o tempo vem de VJ × 1000 mm/s equivalentes.

  Isso ensina que o MOVJ não é reto e não deve soldar. **Não é** o caminho do robô real. Mudança só de orientação gira a 60°/s (VR não implementado).
- **H106-b, condições de soldagem:** os arquivos ASF e AEF, no controlador do robô, guardam a alimentação do arame e a correção do arco. A fonte (painel próprio) roda a linha sinérgica, que dá corrente e tensão. A linha sinérgica é didática: I = 30 + 25 × alimentação (A) e U = 16 + 1,4 × alimentação + 0,25 × correção (V). **Não é** o programa do fabricante.
- **H106-c, deposição:** um mapa de alturas de 0,5 mm sobre o substrato.
  - Volume: Q = 0,92 × π d²/4 × alimentação, com arame de 1,2 mm.
  - Seção por milímetro: A = Q / V. Com o robô parado, conta como 2 mm/s.
  - O cordão tem seção parabólica, A = (2/3)·w·h.
  - A razão w/h começa em 2,6 na peça fria e cresce 0,32 a cada 100 °C de interpasse. Cai com a tocha alta (−3 % por mm) e sobe com a tocha baixa. No começo do arco (0,8 s) é menor, o que dá um início alto e estreito. Acima de 650 °C a poça escorre (razão × 1,8).
  - Cada camada assenta no topo **já solidificado** sob o eixo do cordão. O que transborda vira coluna cheia (a parede fica da largura do cordão); um vale ao longo do eixo continua vale.
  - O fim do cordão deixa uma cratera (0,3 × A × 1,5 w). O AEF deposita parado e a enche.
  - A abertura do arco fica 0,3 s parada, com partida suave (metade da alimentação), o que forma uma pequena bossa.
  - Com o robô parado (abertura, cratera, TIMER com arco), a poça não fica mais larga que o cordão em movimento: o metal sobe no ponto. Assim a parede termina como uma linha, sem bolo largo nas pontas.
  - Continuidade: seção abaixo de 4 mm² ou V acima de 14 mm/s parte o cordão (padrão determinístico pela distância). Com o TCP longe do topo (mais de 6 mm ou menos de −3 mm) ou em MOVJ, o depósito oscila.
  - Esses números são do jogo. **Não reaproveita** as equações de cordão único nem de passes lado a lado do MIG/MAG: a parede sai da altura que cada camada soma de verdade, comparada com o incremento que o programa manda subir.
- **H106-d, calor acumulado:** um nó só, o topo da parede.
  - Equação: dT/dt = 5 K/(s·kW) × P_arco − (T − 25)/τ, com τ = 25 s + 3 s por mm de parede.
  - Quanto mais alta a parede, mais devagar ela esfria. Por isso as camadas de cima pedem mais TIMER.
  - O passo é exato, independente do tamanho do passo.
  - **Não prevê** termopar.
- **H106-e, distância da tocha:** o TCP fica na ponta do arame, à distância de trabalho do bico. TCP no topo = arco certo.
  - Se o incremento programado for maior que a camada real, a folga cresce: arco longo, instável acima de 6 mm, e perda de arco (alarme) acima de 12 mm.
  - Se for menor, o arame mergulha (abaixo de −3 mm) e, no limite, o bocal bate (colisão).
  - Abrir o arco com o TCP a mais de 12 mm da peça é **falha de abertura** (alarme).
- **Executor:**
  - passo fixo de 10 ms, determinístico: a mesma entrada dá a mesma parede em qualquer taxa de quadros e relógio;
  - a pausa congela tudo. É pausa da simulação: na célula real, o HOLD apaga o arco;
  - **Parar** fecha o arco na hora, sem cratera;
  - **Passo** executa uma instrução inteira e pausa;
  - **Sem deposição** roda o mesmo caminho com o arco inibido.

## Inspeção e nota

A nota sai do mapa de alturas e do registro dos passes, nunca do desenho. Tem seis itens, que somam 1000:

| Item | Pontos | O que mede |
|---|---|---|
| Dimensões | 250 | altura útil, largura mínima e comprimento |
| Uniformidade | 200 | desvio da altura e inclinação do topo |
| Continuidade | 150 | falhas e cordão partido |
| Interpasse | 150 | temperatura máxima no início de cada camada |
| Programa | 100 | alarmes, arco cortado, MOVJ com arco e distância do TCP ao topo nas últimas camadas |
| Material e tempo | 150 | quanto sobra depois de aplainar o topo e cortar as pontas, e o tempo de ciclo |

A parede é **aprovada** quando:

- não há alarme e o job chegou ao END;
- a altura útil é de 15 mm ou mais e a largura de 5 mm ou mais;
- o comprimento cobre 95 % de A–B, sem falhas;
- o interpasse é de até 200 °C;
- o desvio da altura é de até 1 mm.

A lista **O que corrigir** dá onde, a causa e a correção. Exemplos:

- “Tocha subindo mais que a parede”, com o incremento sugerido pela altura medida;
- interpasse;
- escorrimento;
- topo inclinado (camadas no mesmo sentido);
- humping;
- MOVJ com arco;
- arco cortado;
- tocha inclinada;
- parede fora do lugar.

O mapa de alturas não representa a ondulação das laterais nem a microestrutura.

## Dados salvos

Coleção nova `manufatura`. Guarda o programa, os pontos, as condições, a célula e a melhor nota. Ela é validada campo a campo: o que estiver estragado volta ao padrão sem perder o resto. As coleções antigas não mudaram. “Apagar todos os dados”, em Configurações, também apaga este projeto. O modo é **só offline**: o protocolo de rede não mudou.

## Testes

`tests/manufatura.test.ts` cobre:

- o parser: formas aceitas, erros com linha e correção, estrutura, comandos não implementados, outras linguagens e limite de linhas;
- os movimentos: MOVL reto na velocidade, MOVJ fora da reta, SFTON/SETE, variáveis P, alcance e colisão;
- a sequência do arco: deposição só entre ARCON e ARCOF e no trecho percorrido, teste sem deposição, ARCON duplo, ARCON longe e END com arco, cratera com AEF;
- as repetições e os limites: 8 camadas, laço sem saída e estouro;
- pausar, continuar, passo, parar e reiniciar;
- o determinismo em 60, 23 e 2 quadros por segundo;
- a nota: o programa inicial reprova, o corrigido aprova, incremento alto ou baixo, humping, sem espera e mesmo sentido contra alternado;
- a persistência: ida e volta, campo estragado e dados antigos.

## Acabamento visual das camadas

A parede recebe faixas de deposição, sulcos arredondados e pequenas variações determinísticas de tom e rugosidade. O acabamento é calculado apenas na renderização: não muda o mapa de alturas, volume, colisões, temperatura ou pontuação. Como o mapa não guarda interfaces enterradas, as faixas aproximam a altura relativa de cada coluna e sua contagem de passes; não representam uma reconstrução metalúrgica das interfaces reais. O relevo das camadas é geométrico: as laterais são subdivididas em faixas de até 0,3 mm nas paredes usuais e recebem saliências arredondadas de aproximadamente 0,2–0,6 mm, com variação determinística por passe e posição. Os sulcos fecham entre passes e o relevo some no pé e no topo plano. Há ainda acabamento óptico fino. As interfaces continuam aproximadas; esse detalhe de representação não altera as medidas, colisões ou a quantidade de material calculadas pelo modelo.

## Redistribuição local da poça pelo calor

Complemento H106-c/d: durante os 1,5 s da janela de poça já usada pelo modelo, somente a parcela nova de metal pode ceder para células vizinhas mais baixas. A redistribuição conserva a integral de alturas do mapa (e não altera o arame consumido); depois da solidificação o depósito permanece na forma atingida. O cálculo roda no passo fixo do executor, também durante esperas, e congela com pausa/parada. A maior mobilidade é associada ao interpasse acima de 200 °C e cresce até o regime de colapso já existente (650 °C). Esses limites são didáticos, NÃO temperaturas de fusão do metal: o arco funde a poça local, enquanto o nó térmico representa o interpasse. Há pequenas diferenças determinísticas por posição e passe para representar retenção superficial; não é CFD. O mapa de alturas continua sem representar gotas destacadas ou material suspenso. O alargamento do cordão já existente é preservado; esta etapa redistribui material, sem somar volume. A forma resultante passa a ser lida pelas medidas e pela avaliação.
