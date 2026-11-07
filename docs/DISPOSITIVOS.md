# Dispositivos de entrada

Uma camada comum (`src/entrada/fonte.ts`) entrega à simulação sempre a mesma
coisa: leituras `{ t, x, y }` em **milímetros da peça** e em **milissegundos
do relógio de alto desempenho**, mais abrir e fechar o arco. A simulação não
sabe qual dispositivo está em uso.

| Dispositivo | API | Como move a tocha | Como abre o arco |
|---|---|---|---|
| Mouse | Pointer Events (`pointerType = "mouse"`) | Posição absoluta | Botão esquerdo |
| Mesa digitalizadora | Pointer Events (`pointerType = "pen"`) | Posição absoluta | Ponta encostada; opcionalmente, pressão acima de um limiar |
| Controle (gamepad) | Gamepad API | O analógico esquerdo controla a **velocidade** | Botão configurável (padrão R2 = botão 7) |

## Independência de quadros e de frequência de eventos

- **Mouse e caneta:** cada leitura usa `event.timeStamp`; leituras agrupadas
  pelo navegador são recuperadas com `getCoalescedEvents()`. O depósito é
  calculado no tempo real entre leituras (ver HIPOTESES, H5).
- **Controle:** a Gamepad API só pode ser consultada (não gera eventos de
  movimento). A posição é integrada em **passos fixos de 8 ms** do relógio
  real. Com o analógico estável, a trajetória é a mesma a 25 ou a 125 quadros
  por segundo (teste em `tests/entrada.test.ts`). Mudanças entre duas
  consultas são atribuídas ao instante da consulta — erro de no máximo um
  quadro, inevitável quando se consulta o controle.

## Calibração e teste

Na **bancada** (Configurações e preparação de cada tentativa), ao lado da peça
de teste — calibra-se soldando:

- leitura ao vivo: conectado, gatilho, posição, pressão e inclinação da
  caneta (quando informadas), analógico bruto e depois da zona morta, botões
  pressionados;
- controle: escolha do controle, **sensibilidade** (0,25 a 2 × 30 mm/s),
  **zona morta** radial (0 a 0,5, com reescala e curva quadrática),
  **mapeamento** do botão do arco e do botão de precisão (velocidade × 0,4),
  inverter eixo vertical;
- caneta: usar ou não a pressão como gatilho, e o limiar.

**Sensibilidade não se aplica a mouse e caneta**, que usam posição absoluta.

**A pressão da caneta nunca controla a corrente.** Em MIG/MAG a corrente
segue a alimentação do arame (H28); ligar pressão a corrente seria uma
mecânica sem justificativa física. Pressão e inclinação são opcionais: sem
elas, a caneta funciona por contato.

**Contato da caneta com qualquer driver.** Mesas digitalizadoras e telas com
caneta nem sempre se identificam igual: algumas mandam `pen` no hover e
`mouse` (ou `touch`) quando a ponta encosta. No modo caneta o jogo aceita os
três tipos e considera "encostada" quando o botão primário está pressionado
ou, para `pen`, quando há pressão maior que zero (sem ser o botão lateral).
Passar por cima sem encostar não abre o arco. As áreas da peça usam
`touch-action: none` para o sistema não transformar o traço em rolagem ou
gesto (o que cancelaria o ponteiro e fecharia o arco). Se a caneta ainda não
soldar, a leitura ao vivo mostra o **último evento** recebido (tipo, tipo de
ponteiro, botões e pressão) — é o dado que diz o que o driver está mandando.

## Qual controle é usado

O navegador nem sempre coloca o controle na posição 0 da lista: depois de
desconectar e reconectar, ele pode ir para 1, 2 etc. O jogo usa o controle
escolhido na calibração se ele estiver conectado; senão, continua com o que
já estava em uso; senão, pega **o primeiro controle conectado**. A leitura ao
vivo mostra a posição em uso.

O arco abre com o botão configurado (padrão R2) **ou** com um botão
alternativo (padrão X / Cross). Gatilhos que só informam valor analógico
contam como pressionados acima de 50 %. Em "Calibrar", o botão **Capturar
botão do arco** usa o próximo botão que você apertar.

O navegador só mostra o controle depois que algum botão dele é pressionado
com a página aberta; a bancada confere a lista a cada meio segundo e avisa
quando o controle aparece.

## Desconexão

Se o controle ativo some durante a execução: o arco é fechado, a tela entra
em **pausa** e só deixa continuar quando o controle volta. Numa tentativa
oficial, a pausa não encerra nem anula a tentativa.

## Controle de PlayStation 4

O jogo **não promete** compatibilidade universal. O que ele faz:

- reconhece o layout `standard` do navegador e avisa quando o mapeamento não
  é padrão;
- sugere ("parece um controle de PlayStation 4") pelo identificador do
  dispositivo, sem garantir;
- permite remapear os botões e testar antes de jogar.

Por cabo USB e em navegadores baseados em Chromium o mapeamento costuma ser o
padrão; por Bluetooth e em outros navegadores pode variar.

## Torneios e dispositivos

O torneio pode **exigir um mesmo dispositivo** ou **separar a classificação
por dispositivo** (padrão). No modo separado, cada participante mantém o
dispositivo da primeira tentativa até o fim. O jogo não supõe que mouse,
caneta e controle sejam equivalentes em competição — isso não foi testado.

## Juntas curvas e giro da peça (etapa 8)

- **Mouse e caneta** seguem a junta na tela: o jogo converte a posição para
  "distância ao longo da junta" e "desvio lateral" (H41).
- **Controle:** o analógico anda **ao longo da junta** (direita = avançar,
  cima/baixo = desvio lateral), em qualquer formato. É mais fácil que seguir
  a curva com o mouse — diferença entre dispositivos ainda não medida.
- **Girar a peça:** desde a v1.3, veja a seção "Câmera, giro e pausa"
  abaixo. As teclas Q/E/W/S e o giro com o arco aberto saíram.

## Câmera, giro e pausa (Alpha v1.3)

| Ação | Mouse | Caneta (mesa) | Controle |
|---|---|---|---|
| Soldar | botão esquerdo | ponta encostada | gatilho configurado |
| Câmera em volta da peça | arrastar com o botão do meio; roda aproxima | segurar **Espaço** e mover | analógico direito |
| Girar e tombar a peça | arrastar com o botão direito | segurar **E** ou **B** e mover | direcional |

- Câmera e peça **só se mexem com o arco fechado**; com uma tecla de gesto
  apertada a caneta não abre o arco. Botões, roda e teclas mudam em
  **Controles** (bancada).
- **A câmera não muda nada do modelo**: ela só muda que ponto da peça fica
  sob o ponteiro. O modelo recebe sempre a posição na junta (s, n) e a
  posição da peça (H47); a técnica e a DBCP são fixas na tentativa.
- **Perda de foco (H49):** esconder a janela ou tirar o foco dela durante a
  tentativa oficial **pausa**; na bancada, o arco da peça de teste fecha.
  Nos dois casos o arco fecha no último instante já calculado, então o
  tempo parado não vira solda.
- **Não testado em aparelho físico nesta versão:** mesa digitalizadora e
  controle (os testes usaram mouse e teclado simulados no navegador).
