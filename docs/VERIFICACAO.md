# Verificação

## Alpha v1.8 — modos Fácil e Difícil, solda mais lenta e nota sem trava (branch `claude/v1.8`)

- H87: o limite de 12 mm/s no mouse e na caneta foi retirado (o ponteiro voltou a ser o da v1.7). A física do MIG foi desacelerada: metade do metal por segundo, o dobro do calor necessário por mm, o dobro do tempo de aquecimento da peça, faixa verde de 4–8 mm/s. Todos os testes de solda simulada foram refeitos com metade da velocidade e o dobro das pausas e passam com os mesmos critérios de antes.
- H88: modos Fácil e Difícil escolhidos antes de soldar (MIG e eletrodo); a mesma solda nunca vale menos no Fácil (`tests/referencia.test.ts`, `tests/defeitosEletrodo.test.ts`).
- H89: sem trava da nota (`pontuacao-v9`). Testes ajustados de propósito: torneio ("melhor" e classificações pela nota), Arcade (não aprovar não perde o desafio) e um teste novo de que a condição essencial descumprida não zera categorias nem limita o conceito.
- `npm run typecheck` e `npm test`: 46 arquivos, 470 testes passando.
- Não testado em aparelhos físicos (mesa digitalizadora, controle, dois PCs).

## Alpha v1.7 — lista de defeitos e cordão 3D do eletrodo (branch `claude/v1.7`)

- Trazidas da v1.6 organizada (pasta `v1.6/` da página inicial, PRs #25 e #26) para a alpha-v1.7 do GPT, no layout `src/`: registro do calor por passe, análise do cordão e lista de defeitos com lugar, causa e correção (H82–H85), e o cordão 3D do MIG desenhado no eletrodo no lugar da malha do depósito (H86). A nota de 0 a 1000, o depósito, o x1 em rede e o painel MIG do GPT não mudaram.
- Nenhum arquivo do eletrodo tinha mudado entre a alpha-v1.6 e a alpha-v1.7, então a passagem não teve conflito; os arquivos foram convertidos de volta para os nomes de `src/` e conferidos linha a linha.
- `npm run typecheck` e `npm test`: 46 arquivos e 465 testes passando (os da rede do GPT e `tests/defeitosEletrodo.test.ts`).
- Não testado em aparelhos físicos.

## Alpha v1.5 — treino de eletrodo após o teste do dono (branch `claude/v1.5`)

Pedido: controle de altura ruim (o arco apagava e era preciso soldar aos poucos), menu
organizado (sem protótipo no topo, escolha MIG/MAG ou eletrodo no Treino), sem botão para
soldar (abrir ao tocar a peça) e peças que fazem sentido para eletrodo.

- Simulação a 60 quadros/s com jogador de reação 0,2 s (tests/refino15.test.ts): com a
  ajuda parcial, arco aceso > 97% do tempo a vareta inteira, sem grudar, ~0,4–0,7 toque/s
  em S (80, 100 e 130 A); sem ajuda também foi possível. Toque curto desce 0,2–0,4 mm.
- Navegador (Chromium sem interface, ~3,5 quadros/s), 1366×768: menu sem o atalho do
  protótipo; Treino com o seletor MIG/MAG | Eletrodo revestido e as cinco peças; peça
  "Cordões sobre chapa" com objetivos; filete em T: arco aberto ao tocar, cordão na raiz
  (82% do trecho com uma vareta), escória quebrada e escovada; topo em V 8 mm: 100% do
  trecho coberto, sem grudar, raiz visível após a limpeza.
- Corrigido durante o teste: o cordão do eletrodo não conhecia a junta (no filete não
  aparecia na raiz); o ponteiro não encontrava as paredes a 45°; curto com ajuda total
  grudava mesmo sem empurrar.
- Limites: a taxa de quadros do navegador sem interface não permite reproduzir o controle
  manual por toques (o atraso de leitura é de ~0,6 s); esse controle foi verificado pela
  simulação acima. Não testado com pessoas, GPU real, caneta ou gamepad.

## Alpha v1.5 — refino da bancada SMAW (branch `claude/v1.5`)

Conferido no Chromium sem interface (Playwright, ~3,5 quadros/s) com o jogo em
execução local, em 1366×768, 1166×884 e 1024×768:

- Passe completo com eletrodo 2,5 mm a 90 A e compensação assistida: abertura
  por toque e afastamento, arco "adequado" a 2,5 mm, vareta consumida até o toco
  de 25 mm ("Fim da vareta"), cordão coberto por escória contínua (laranja perto
  do arco, escura ao esfriar).
- Limpeza: martelinho deixa resíduos claros; escova retira os resíduos e mostra
  o cordão metálico. Leituras finais: escória 0 mm², resíduos 0 mm².
- Arco longo (4,6 mm): medidor em âmbar com "arco longo", muitos respingos na
  vista e contador de respingos alto (268 contra 10 no arco adequado).
- Modo MIG/MAG: medidor com faixa de 5 a 25 mm; painel sem campos do eletrodo.
- Diálogo de controles com nomes legíveis (S, Espaço).
- Limites: com a taxa de quadros do navegador sem interface, o passe ficou lento
  e o cordão saiu curto; o controle manual de altura (sem compensação) foi
  verificado por testes do modelo, não por partida humana. Não testado em GPU
  real, mesa digitalizadora ou gamepad físico.

Testes: `tests/refino15.test.ts` (H68–H70, avanço medido, escória na largura do
cordão, limpeza ao longo do passe, nomes de tecla). TypeScript e todos os
testes aprovados; portátil regenerado.

## Alpha v1.4 — sobrecabeça: inspeção, gotas e layout (branch `claude/v1.4`)

Revisão visual do GPT na v1.4 integrada (três pontos), conferida no Chromium
sem interface (Playwright) com o jogo em execução local:

- **Orientação na inspeção:** a peça agora fica na mesma posição da soldagem
  (rolagem e giro, H47). Antes, a inspeção redesenhava a chapa na posição
  plana e as gotas de sobrecabeça apareciam por cima. Agora é a câmera que
  se move. Em sobrecabeça, a vista inicial e o botão "Olhar a face" (antes
  "Olhar de cima") olham a face por baixo, e a órbita pode descer abaixo da
  peça. Conferido: chapa de cabeça para baixo, gotas penduradas para baixo.
- **Desprendimento das gotas:** a gravidade das partículas passa a vir do
  mundo, convertida para os eixos da peça, e não da peça girada. As gotas
  que se soltam agora têm um corpo sólido (esfera) e cor opaca, em vez de
  pontos aditivos quase invisíveis. Elas nascem onde o gotejamento previsto
  existe perto da tocha (±4 mm). Conferido numa passada lenta em
  sobrecabeça: gota laranja caindo em direção ao piso, abaixo da tocha.
  Limite: no navegador sem interface a taxa de quadros é baixa, então
  aparecem poucas gotas por segundo de tela. Não testado em GPU real.
- **Câmera na execução:** "Centralizar" com a peça inclinada para baixo
  (▲, ângulo negativo) não fazia nada. Agora olha a face (por baixo em
  sobrecabeça), sem deixar as marcas de cabeça para baixo.
- **Sobreposição no resultado:** conferida por medição dos retângulos dos
  blocos da inspeção, das abas e do conteúdo da aba, com a aba Defeitos
  aberta, em 960×720, 1024×768, 1166×884, 1280×720, 1366×768, 1440×900 e
  1920×1080. Resultado: nenhuma sobreposição e página sem rolagem horizontal.
- Ajustes de realismo e textos didáticos anteriores da v1.4 foram mantidos.
  Pontuação inalterada (`pontuacao-v7`).

Validação: TypeScript e 364 testes em 29 arquivos aprovados; build de
produção e portátil regenerados.

## Alpha v1.4 — correções da revisão visual do GPT (branch `claude/v1.4`)

- Preparação em 1280×720: a peça de teste ficava atrás da barra de ações.
  Novo `src/estilo-espaco.css` (carregado por último): em telas baixas, título
  menor, cabeçalho da peça numa faixa, descrição da junta escondida (está na
  ficha), giro/posição/Centralizar numa linha só (o "Rotação somente X" some e
  fica a posição), altura mínima da peça 150 px e o resumo do passe rolando
  por dentro.
- Inspeção no resultado: a seção da peça encolhia por baixo das abas.
  Agora peça, controles (numa faixa compacta), abas e conteúdo ficam em
  faixas separadas; o conteúdo da aba rola por dentro e, se faltar altura, o
  cartão rola.
- Corrimão da rampa (peça de pé): a câmera começava de cima e via as bordas.
  A câmera inicial e o "Centralizar" agora sobem a elevação igual ao
  tombamento da peça (de frente para a face da junta); a posição física da
  peça e os limites da câmera não mudaram.
- Condição essencial E2: "Nenhuma perfuração prevista" virou "Evitar
  perfuração" (a evidência continua na justificativa).
- Cordão esticado em lâminas ao soldar de novo longe do primeiro (relato do
  dono, junta em T na horizontal): o segundo passe entrava na mesma fatia e o
  modelo usava um centro médio com espalhamento enorme. Agora vira um cordão
  solto (H58), com malha própria sobre a chapa ou a parede. Testes novos em
  `tests/soltos.test.ts`; conferido em 3D (T com passes na raiz, na alma e na
  base; topo com um passe a 22 mm). Pontuação `pontuacao-v7`.
- Conferido no navegador em 1280×720 e 1366×768: preparação → tentativa →
  resultado (abas Largura, Corte e Defeitos) → Treinar de novo; corrimão na
  preparação e na execução.

## Alpha v1.4 — defeitos visíveis (branch `claude/v1.4`)

- Novo `tests/defeitos.test.ts` (19 testes): referência sem defeitos;
  cratera ao fechar andando, cheia parando 400 ms e coberta por outro passe;
  gotas na sobrecabeça (e não na plana); escorrimento e sobreposição na
  vertical descendente; caimento, mordedura em cima e sobreposição embaixo na
  horizontal; mordedura com arco longo; sobreposição devagar com arco curto;
  respingos (mistura < CO₂ < CO₂ desequilibrado); porosidade (alumínio sujo,
  DBCP 20); empeno com mais calor; escamas mais juntas devagar; os mesmos
  defeitos no replay e com quadros de 7 e 33 ms; pontuação v6 (superfície,
  porosidade na fusão, essenciais iguais, cratera barata).
- No navegador (página de teste temporária, fora do repositório, em
  1400×800): referência lisa com escamas; gotas penduradas na sobrecabeça;
  ondas na vertical; borda de cima mordida e cordão caído na horizontal;
  mordedura e respingos com arco longo; respingos com CO₂ e arco curto;
  sobreposição devagar; cores do inox (palha → roxo → azul); poros abertos
  no alumínio sujo (junta em T); cratera afundada × ponta cheia parando.
- Na bancada: poça viva maior e para trás do avanço durante o passe; linha
  "Defeitos visíveis" no resumo do passe. No resultado do treino: aba
  "Defeitos" com a lista e o conselho, empeno de 3,5° na peça 3D e o corte.
- Erros achados e corrigidos: falsa mordedura na referência (regra de calor
  começava em F = 1,2; agora acima do adequado, F = 2); faixas de oxidação
  escondidas sob a chapa (altura pequena demais para a profundidade e, na
  inspeção, a chapa empenada passava por cima: agora as faixas acompanham o
  empeno).
- **Não testado**: queda de gotas do arco na sobrecabeça ao vivo (o giro da
  bancada é por tempo de botão e o navegador de teste é lento demais para
  chegar a 180°); mesa digitalizadora e controle físicos.

## Alpha v1.3 — mecânica técnica (branch `claude/v1.3`)

- `npm run typecheck` e `npm test` antes de cada commit; o resultado final
  está no fim desta seção.
- Novo `tests/referencia.test.ts` (caso de referência de HIPOTESES.md):
  metal, corrente e potência na referência; alimentação, tensão, DBCP,
  diâmetro, velocidade e técnica (cada um mexendo só no que deve);
  conservação de metal; tocha parada depositando e aquecendo; pausa sem
  salto (H49); arco fora da peça sem aquecer; 30, 60 e 144 quadros/s;
  limites da DBCP e preparo antigo sem DBCP; nota e relatório iguais no
  replay e ao vivo; buraco no cordão na pontuação v2.
- `tests/arcade.test.ts`: o teste "técnicas puxando e empurrando" passa a
  experimentar os diâmetros de arame da missão (o desafio só trava a
  técnica). Com a corrente revista, arame de 1,2 mm no inox de 2 mm perfura
  em qualquer alimentação; com 0,8 mm há solução.
- Cordão alto demais no 3D: era o exagero vertical de 3× do topo reto.
  Agora a solda e o resultado começam em 1× (escala real), conferido no
  navegador.
- Fresta do topo reto (H18 revista): o metal enche a fresta antes do
  reforço. `CONTEXTO_PADRAO` passou a ter abertura 0 (modelo das etapas
  1–4, cordão sobre chapa), então os testes daquelas etapas seguem iguais;
  testes novos em `tests/juntas.test.ts`. A didática (área do GPT) usa
  largura ∝ √área e fica aproximada no topo com abertura: ver
  `docs/NOTAS-PARA-GPT.md`.
- Cordão "dentro da chapa" com listras no 3D (relato do dono): na junta de
  topo com abertura, o modelo mandava o metal para a fresta mesmo com o
  cordão longe dela e desenhava o metal abaixo da face. Agora só o trecho
  da fresta embaixo do cordão é enchido; fora dela o cordão fica sobre a
  chapa. Teste novo em `tests/juntas.test.ts` (falhava antes da correção);
  no navegador, passe em zigue-zague fora da fresta sem listras e com a
  previsão "borda".
- Pontuação `pontuacao-v3` (0–1000, notas graduadas): testes novos em
  `tests/referencia.test.ts` (escala, nota graduada da largura, reinícios
  e metal fora do trecho); `tests/torneio.test.ts` e `tests/dados.test.ts`
  ajustados à escala de 1000. No navegador: placar "/ 1000" com notas
  inteiras, nomes novos das categorias e a aba "Execução" da explicação,
  em 1366×768 e 1280×720, sem rolagem.
- Pendências: mesa digitalizadora e controle físicos não testados; os
  números do jogo seguem sem validação experimental (só a direção das
  relações tem fonte).

## Exercícios técnicos orientados — GPT

Adicionados três roteiros ao treino (avanço, alimentação e tensão), com
consulta na preparação e no resultado. Reutilizam a comparação existente;
não alteram a física, a pontuação nem os dados persistidos.

Verificação nesta alteração:
- TypeScript: aprovado.
- Vitest: 22 arquivos, 278 testes aprovados.
- Build de produção: aprovado.
- Navegador: tentativa de acesso à prévia local bloqueada pelo ambiente.
  Pendentes a navegação manual e a conferência em 1280×720 e 1366×768.
- Portátil regenerado na integração da `alpha-v1.3` (inclui estes roteiros).

## Etapa 6 (21/10/2026): bancada, História, Arcade aleatório, técnica, visual

- `npm run build`: sem erros. `npm test`: **127 testes em 10 arquivos, todos
  passando** (novos: técnica puxando/empurrando; geração de desafios
  determinística; toda condição do Arcade com solução em todas as missões e
  níveis; avaliação das condições e combo; recordes do Arcade).
- No navegador: menu novo (atalhos 1–6); bancada nas Configurações com passe
  na peça de teste e resumo do passe; História (capítulos, bloqueios, ficha,
  bancada, tentativa oficial "puxando" com conceito S, abas da inspeção);
  Arcade (desafio aprovado com combo, três abandonos até o fim de jogo,
  condição "contra o relógio", recorde salvo e na aba Arcade de Recordes);
  bancada dentro de um torneio; tela de celular sem rolagem horizontal.
- Erro encontrado e corrigido: a bancada herdava o gás da missão anterior
  (Arcade e rodadas de torneio com materiais diferentes) e travava.
- **Controle real:** depois da correção do índice do gamepad (o jogo agora usa o
  controle conectado em qualquer posição da lista), o usuário testou com o
  próprio controle e **funcionou** (21/10/2026). Tipo de conexão e navegador
  não registrados.
- Continua **não testado** com hardware real: mesa digitalizadora e mouse em
  partida longa.

## Etapa 5

Registro do que foi conferido na etapa 5 (Arcade, torneios, julgamento,
materiais, dispositivos) — em 20/10/2026.

## Compilação e testes automáticos

- `npm run build` (TypeScript estrito + Vite): sem erros.
- `npm test` (Vitest): **95 testes em 9 arquivos, todos passando**.

| Arquivo | O que garante |
|---|---|
| `simulacao.test.ts` | Cordão igual com 0, 30, 60 e 144 quadros/s; balanço de massa |
| `processo.test.ts` | Tensão, alimentação, equilíbrio, trava dos ajustes com arco aberto |
| `avaliacao.test.ts`, `explicacao.test.ts` | Avaliação e explicação do modo original (etapas 3–4) |
| `fusao.test.ts` | Índice de fusão sintético nas faixas certas; amortecimento; borda descoberta; **aquecimento acumulado independente dos quadros**; alumínio diferente do aço; limpeza do óxido; inox deforma mais; **replay idêntico** ao original |
| `missoes.test.ts` | Só gases compatíveis; combinações recusadas; missões planejadas não jogáveis; processo, junta, tipo e posição separados; **cada missão tem solução aprovável nas duas dificuldades** |
| `torneio.test.ts` | **Alternância dos jogadores e avanço de rodadas** (rodízio); **limite de tentativas**; entregar antes do limite; ação fora da vez recusada; **entrega duplicada recusada**; tentativa interrompida conta e não é entregue; conclusão duplicada recusada; **regras de entrega** (última, melhor, escolhida; aprovada vence nota maior); **regras bloqueadas** e duplicação; dispositivo exigido e mantido; **classificação e desempates**; classificação por dispositivo; **anonimato** (lista e evidências sem nome nem id; **nota automática oculta antes da avaliação inicial**); "não avaliado"; **publicação só com tudo avaliado**; **histórico de revisões** (anterior, novo, data, motivo) e recálculo após publicação; média ponderada |
| `dados.test.ts` | **Nome salvo no recorde** (normalizado); **persistência após "recarregar"**; rankings separados por missão, dificuldade e dispositivo; novo recorde; exportação/importação com validação; migração de dados sem versão; recuperação de dados corrompidos; versão futura recusada; registro compacto preserva o replay; **treino separado das tentativas oficiais** no Arcade |
| `entrada.test.ts` | Zona morta e curva; **trajetória do controle independente da taxa de quadros**; sensibilidade; desconexão fecha o arco e pede pausa; reconhecimento do mapeamento padrão |

## Percurso no navegador (pane do Claude, Chromium)

Gestos de mouse simulados com eventos de ponteiro; telas acionadas por
clique e por teclado.

1. **Partida Arcade com registro de nome** — apelido digitado, missão
   "Suporte de prateleira" (Aprendiz), ficha com desenho, preparação
   (treino/oficial, botão oficial só após a confirmação), tentativa oficial
   (99,0, aprovada), entrega com confirmação, pontuação final, nome editado
   para "  Vic   Neves  " e salvo como "Vic Neves", tela "NOVO RECORDE!".
   Depois de **recarregar a página**: recorde na tela de Recordes, nome
   lembrado e progressão liberada (Profissional e a missão seguinte).
2. **Torneio automático com dois participantes** (2 rodadas, regra "melhor",
   rodízio) — vez de Ana, vez de Bruno com duas tentativas (a melhor foi
   entregue), passagem de turno sem dados, Bruno abriu a rodada 2.
   **Recarregamento no meio de uma tentativa oficial**: ela virou
   "interrompida", contou no limite e apareceu aviso. Classificação geral
   com desempate por menos tentativas.
3. **Torneio com professor, incluindo revisão** — dois participantes; lista
   de julgamento só com códigos; evidências sem nomes; pontuação automática
   oculta até confirmar a avaliação inicial; publicação bloqueada com uma
   entrega pendente; publicação; classificação pela nota final do professor
   com a automática como referência; **revisão da nota final após a
   publicação** (8 → 9,5, com motivo), registrada no histórico, com a
   classificação recalculada (a ordem mudou).

Também conferidos (na época): o Treino livre no modo original (removido na
etapa 8, substituído pela bancada com a peça padrão); treino de missão no alumínio (tela de execução, aquecimento,
brilho fraco do alumínio, faixa de velocidade); Configurações e teste de
dispositivo; atalho de teclado do menu; layout em largura de celular (sem
rolagem horizontal da página).

Erro encontrado e corrigido durante o percurso: o corte sintético tentava
desenhar com raio negativo quando o gráfico ainda não tinha largura.

## O que NÃO foi possível testar

- **Controle de PlayStation 4 real** (cabo ou Bluetooth) e qualquer gamepad
  físico: a lógica foi testada com um controle simulado. Mapeamento,
  detecção, desconexão e pausa precisam de teste com o hardware.
- **Mesa digitalizadora real**: pressão, inclinação e gatilho por pressão só
  foram verificados no código; a caneta não foi usada.
- **Mouse real** numa partida inteira: os gestos foram simulados; a sensação
  de controle (velocidade confortável, precisão) precisa de teste com pessoas.
- **Equivalência competitiva entre dispositivos**: não testada; por isso o
  padrão do torneio é separar a classificação por dispositivo.
- **Navegadores além do Chromium** (Firefox, Safari) e dispositivos de toque.
- **Limite de espaço do localStorage** em torneios longos (cada tentativa
  oficial guarda seu registro de eventos; tipicamente dezenas de kB).
- **Validação física** das hipóteses H27–H36 em livro-texto (ver HIPOTESES).

## Correções da revisão técnica pelo GPT (2026-10-23)

- Regressões adicionadas em tests/revisao-gpt.test.ts: pausa longa e
  repetida sem alteração térmica, temporal ou de metal; replay compacto;
  média de torneio antigo; bloqueio de mistura de versões sem mutar dados;
  magnitude de borda no topo e margem de filete; aberturas planejadas;
  explicação e comparação de juntas com fresta.
- Os objetos simulados em tests/torneio.test.ts agora usam a versão atual
  ao representar tentativas de torneios novos. O caso legado tem teste próprio.
- Atualizadas as asserções de versão de tests/referencia.test.ts para v4.
- A revisão visual em 1280×720 e 1366×768 permanece pendente: o navegador
  integrado não acessa o servidor local deste ambiente.
- Esta entrega atualiza código e documentação. O portátil e o ZIP
  previamente publicados não foram substituídos.

Validação final: TypeScript, 305 testes em 24 arquivos e build de produção aprovados.

## v1.9 (Claude)

- `npx tsc --noEmit` sem erros; `npx vitest run`: 479 testes passando.
- Navegador (Chromium com renderização por software, sem GPU): "Cordões sobre chapa" no Difícil. O cordão aparece em relevo na chapa; o resultado mostra os 4 itens com o traço dos 20 % e o selo de aprovação. Uma tentativa com escória e defeitos teve itens acima de 20 % e nota final 0, o que levou a exigir também a nota final e a escória removida.
- Não testado: mesa digitalizadora, gamepad e computadores dos alunos. O equilíbrio do eletrodo foi calibrado com o jogador simulado, não com pessoas.

## v1.9 — TIG (Claude)

- `tests/tig.test.ts` (15 testes): calor e poça, vareta só funde na poça, contaminação e afiar, furo acima da faixa, independência da taxa de quadros (30 e 144 qps), soldador simulado aprovado no Difícil nas três peças, sem vareta, rápido demais, cratera, mapa da pressão da caneta.
- Navegador (Chromium sem GPU, ~4 quadros/s): modo Só mouse e modo Mesa + mouse com eventos de caneta simulados (`pointerType: 'pen'`, com pressão) e cliques reais do mouse para a vareta. O jogo trocou para Mesa + mouse ao ver a caneta, a pressão virou corrente (75 A), a vareta fundiu na poça e o cordão apareceu em 3D. Nota de 590 numa tentativa com o robô de teste.
- Não testado: mesa digitalizadora física, Windows Ink, caneta e mouse físicos ao mesmo tempo.

## v2.0 (Claude)

- `npx tsc --noEmit` sem erros; `npx vitest run`: 488 testes passando (`tests/maquina.test.ts`: unidades, corrente, modos de transferência, arco curto, respingo no globular, fusão no spray, largura com a tensão).
- Navegador: painel com tensão em V e alimentação em m/min, corrente em A, modo de transferência (curto-circuito, globular, spray) e tensão de equilíbrio em V.
- Não testado em aparelho físico (mesa, gamepad, PCs dos alunos).
- H94: `tests/penetracao.test.ts` (7 testes) — com os ajustes de referência na chapa de 3 mm: 6 mm/s nada no avesso; 4 mm/s raiz aparente sem defeito; 3 mm/s metal pendurado; 2,5 mm/s raiz afundada; 2 mm/s furo; os níveis só crescem com o calor; filete sem avesso.
- Navegador: passe com 6, 3 e 1,8 mm/s; lista de defeitos com penetração excessiva, raiz afundada e furo nos trechos lentos; "Ver o avesso" mostra o metal pendurado.
- H94 no eletrodo: `tests/defeitosEletrodo.test.ts` — nas peças de raiz aberta e de chapa inteira, conforme o avanço fica mais lento: nada → penetração excessiva → raiz afundada → furo. No TIG: `tests/tig.test.ts` — na chapa de 1,5 mm, conforme a corrente sobe: limpo → metal pendurado (sem furo, com desconto) → furo; no T, só o furo. Navegador: eletrodo lento sobre a chapa mostra "Furo (a chapa varou)" e o buraco no 3D.
- H95–H98 (artigo de Banaee et al. 2023 como fonte): `npx vitest run` com 519 testes passando.
  - `tests/perfilParabola.test.ts`: seção parabólica, área de 2wh/3 e volume conservado a 30 e 144 quadros/s.
  - `tests/sobreposicao.test.ts`: o passo de 2w/3 dá quase plano; mais perto, morro; mais longe, vale.
  - `tests/defeitosEletrodo.test.ts`: um passe quente funde no anterior; um passe frio e rápido deixa falta de fusão entre passes.
  - `tests/humping.test.ts`: a forma muda com a alimentação e as corcovas aparecem só com avanço rápido e corrente alta.
- Navegador: no eletrodo, "Unir duas chapas" com dois passes; o botão Corte mostra a chapa, a abertura e as camadas de cada passe em escala real. O humping no 3D do MIG não foi conferido no navegador, só nos testes.
- H99/H100: `npx vitest run` com 529 testes passando (`tests/tensaoBaixa.test.ts`). Em `tests/processo.test.ts`, o teste do limite dos botões mudou de propósito: a tensão agora desce até 0 V.
- Navegador, no treino MIG/MAG da chapa de 3 mm:
  - 28 V com a tocha parada: a peça soldada mostra o furo, e a lista de defeitos traz penetração excessiva e raiz afundada;
  - 0 V: painel com 0 A e "Sem arco", sem luz de arco, e o status explica;
  - 12 V: "Arame batendo", caroço frio, sobreposição e respingos.
- H101: `npx vitest run` com 538 testes passando (`tests/consumoChapa.test.ts`). Navegador, no treino MIG/MAG da chapa de 3 mm, a 28 V com a tocha parada:
  - de cima: buraco vazado no meio da poça, com borda queimada;
  - por baixo (câmera da execução girada): dá para ver através do buraco, e o metal pendurado fica em volta dele;
  - no resultado: "Ver o avesso" mostra o furo.
- Eletrodo ("Unir duas chapas") continua sem erros com o novo recorte das chapas.
- H102: `tests/tig.test.ts` — "avançar 2 mm e tocar logo" funde a vareta sem toque frio nas três peças (falha no código antigo).
  - Navegador (~1 quadro/s, sem placa de vídeo): o Espaço não chegava ao mergulho por causa de toques entre quadros. Depois da correção, 18 toques em 18.
  - A versão anterior foi comparada com a v1.9 no mesmo roteiro com a tocha na linha: fusão 300/300 nas duas; o problema era a vareta.
- H103: `npx vitest run` com 567 testes passando (`tests/tubo.test.ts`). Navegador:
  - MIG/MAG: missão "Tubulação da horta" (treino): o tubo aparece no 3D, solda em cima, ⟲ gira o tubo e o cordão vai junto; o resultado mostra o tubo.
  - Eletrodo e TIG: peças de tubo com o INÍCIO no alto e os botões TUBO ⟲ ⟳. No TIG, com a tocha na linha, a poça forma no tubo e a vareta funde; no eletrodo, o metal sai curvado sobre o tubo.
  - Gotas e escorrimento em volta do tubo foram conferidos só nos testes.
- H104: `npx vitest run` com 578 testes passando (`tests/materiais.test.ts`). Navegador:
  - MIG/MAG, treino livre: os grupos Chapa e Espessura trocam a peça de teste (cor no 3D, selo, faixa "Material" do topo e ficha). Cobre: 1,5/2/3 mm; galvanizado bloqueia o V; médio carbono em V fica com 6 mm. "Treinar a peça" leva a chapa escolhida para a execução.
  - Eletrodo: "Unir duas chapas" em galvanizado: menu Escolha a chapa, bancada com a chapa clara e corrente sugerida pela chapa.
  - TIG: "Filete em T" em cobre (210–295 A) e alumínio (135–190 A): título e escala da fonte seguem a chapa.
- Bancada do MIG/MAG compacta (v2.0, depois do #39): chapa, espessura e junta em listas numa linha, ficha no botão Ficha e a dica de abrir o arco dentro da área de teste. No navegador a 1366 × 768, área de teste de 878 × 492 px no treino livre (era 205 px de altura com os chips e a ficha à vista); a 1600 × 1000, 718 px de altura. Caneta simulada (eventos `pen`) com o dispositivo em Mouse: a tocha aparece e solda (correção do #39). `npx vitest run` com 580 testes passando.
- H105 (brasagem): `npx vitest run` com 595 testes passando (`tests/brasagem.test.ts`, 15 testes). Navegador:
  - Treino → BRASAGEM → peça → chapa → modo abre a bancada com o maçarico, a chama (dardo e envoltório), a vareta da liga e o painel Preparo / Maçarico / Missão.
  - Chama sobre a peça: brilho de calor e mancha da chama; o fluxo passa de pasta branca a pó (100 °C); sem fluxo, o cobre escurece de óxido em volta da junta.
  - Com o brasador simulado rodando na página: filete da liga visível na borda; no resultado, "Ver a folga por dentro" mostra onde a liga molhou, e "Defeitos" aponta a causa (sobreposição fria, liga superaquecida).
  - Um robô dirigindo o mouse no navegador sem placa de vídeo (~2 quadros por segundo) não consegue controlar a chama a tempo; a técnica foi validada nos testes, no modelo.
