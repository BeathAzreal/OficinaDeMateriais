# Oficina de Soldagem — Alpha v2.2 (versão de teste)

> ⚠️ **A v2.2 não é estável e serve apenas para testar funções novas.** Para jogar, use a [Alpha v2.0](../v2.0/Oficina-de-Soldagem-Alpha-v2.0.zip).

**LABORATÓRIO DE FALHAS refeito** (Fábrica → Laboratório). O laboratório agora é uma bancada em 3D com as estações feitas à mão.
- **Inspeção:** você arrasta a lanterna (luz rasante mostra as marcas de praia), usa a lupa e escolhe a limpeza.
- **Corte:** marca o ponto e segura o disco (rápido demais, ele trava).
- **Preparo:** lixa #220 → #600 → #1200 arrastando a amostra e girando 90° a cada troca (pular a #600 gera arrancamento); depois pano de 6 e 1 µm e ataque com Nital no cronômetro (demais vira sobreataque).
- **Microscópio:** posiciona a mesa, foca com a roda do mouse e clica nos achados.
- **Microdureza:** pontos que atravessam a junta.

O motor do caso continua decidindo o que aparece. Hipóteses, caderno e relatório ficam no escritório. Hipóteses do modelo em `docs/HIPOTESES.md` (H109).

**TORNO CONVENCIONAL (Usinagem refeita)** (Treino → TORNO, ou Fábrica → Usinagem). A Usinagem foi refeita no estilo da bancada de solda: o torno em 3D é operado nas manivelas (mouse e teclado) e a física responde na hora.
- **O que acontece no corte:** o cavaco sai com a forma de cada material; em vc baixa aparece aresta postiça; a aresta se desgasta; a peça esbelta vibra; o motor para por sobrecarga; e a ferramenta quebra se encostar com o eixo parado.
- **Deflexão:** no desbaste a peça sai maior que o mostrador, então é preciso medir com micrômetro (com o eixo parado) antes do acabamento.
- **Peças:** OM-01 eixo de aço, pino esbelto de alumínio, bucha de latão e tarugo livre.
- **Nota e Fábrica:** nota de 0 a 1000 com defeitos explicados. A etapa de usinagem da OS-01 usa o torno novo. O CNC da versão anterior continua em Fábrica → Usinagem até ser refeito.

Hipóteses em `docs/HIPOTESES.md` (H108).

**Novo na v2.2, experimental:** **FÁBRICA**, uma prática industrial. A Oficina de Soldagem, a **Usinagem** (torno CNC) e o **Laboratório de Falhas** viram um jogo só: um galpão 3D com os setores de Usinagem, Soldagem, Manufatura Aditiva e Laboratório, ligados por **ordens de serviço**. A OS-01 (*Braço tensor da peneira vibratória*) passa pelos setores como numa indústria. O laboratório investiga por que o braço quebrou, a usinagem refaz o pino dentro da tolerância e a soldagem refaz a emenda em aço SAE 1045 com o procedimento corrigido. No fim, a qualidade libera a OS, e o relatório sai impresso ou em PDF para o professor. Como funciona, sugestão de aula e como criar novas OS: [docs/FABRICA.md](docs/FABRICA.md).

**Menu em 3D (teste da nova interface):** o menu é a própria fábrica, à noite. Cada opção é um lugar do galpão: o portão com o quadro de OS (Fábrica), os fliperamas (Arcade), a cabine de solda (Treino), o robô (Manufatura Aditiva), a estante de troféus (Recordes) e o armário de ferramentas (Configurações). Escolher uma opção vira a câmera para o lugar, e confirmar leva a câmera até lá. A lista fica por cima e continua funcionando com teclado, controle e leitor de tela; também dá para clicar direto no lugar. O **mesmo cenário fica atrás das outras telas de menu**: no Arcade (e na História, nos Desafios etc.) a câmera fica diante dos fliperamas; no Treino, na cabine de solda; em Recordes, na estante de troféus; em Configurações, no armário; e na Manufatura Aditiva, no robô. Voltar ao menu recua a câmera olhando para o lugar de onde você veio. Telas de jogo com o próprio 3D (bancada, célula do robô, fábrica) escondem e pausam o cenário. Sem 3D no computador, volta a arte ilustrada. Código em `src/render/menu3d.ts` e `src/ui/cenario.ts`.

**Soldagem a plasma (Treino → PLASMA):** na mesma bancada do TIG, o arco sai apertado por um bocal de cobre. Na peça **keyhole** (inox 4 mm ou aço 5 mm, topo reto, sem chanfro), o jato fura a chapa e a poça fecha atrás: uma passada solda a espessura toda. Pouco gás só funde por cima; gás demais corta; parar a tocha ou cortar o arco de vez no fim deixa furo (solte o pedal devagar: rampa de descida). Bocal encostado ou corrente alta demais dá arco duplo e gasta o bocal. O **microplasma** solda inox de 1 mm com pouca corrente e pouco gás. Hipóteses em `docs/HIPOTESES.md` (H107).

- **Solda subaquática (Treino → SUBAQUÁTICA):** eletrodo revestido no fundo do mar, no escuro. Só a sua lanterna ilumina a peça: segure **F** e arraste para apontar (no celular, **🔦 Mirar luz**). A corrente é ligada pelo ajudante na superfície (**C** pede liga/desliga), e trocar a vareta com a corrente ligada dá choque. A água pede mais corrente, arco bem curto (senão vira poro) e endurece a ZTA: o laudo do resultado mostra a dureza. Três mergulhos: cais (4 m), casco de balsa (8 m) e plataforma (18 m).

**Treino vira sandbox:** só a bancada livre por processo (MIG/MAG, eletrodo, TIG, plasma e brasagem). As missões ficam na História e as ordens de serviço, na Fábrica.

Todo o resto é a v2.1: Manufatura Aditiva, MIG/MAG, TIG, eletrodo, brasagem, História, Desafios, Versus e o x1 online, com o mesmo protocolo de rede.

**Celular e tablet (novo na v2.2):** passe o HTML para o celular (cabo, Drive ou WhatsApp como documento) e abra no **Chrome**. Jogue **na horizontal**. No celular a barra lateral some e as bancadas ganham uma barra de botões embaixo:

- **O dedo é o mouse:** arraste para soldar, levar a ferramenta do torno ou mover a lanterna.
- **🎥 Câmera** e **⟳ Peça:** com o modo ligado, o dedo gira a câmera ou a peça. Toque de novo para voltar a soldar. **−/+** afastam e aproximam.
- **☰** abre o painel da máquina como gaveta (ajustes, medidas, instrumentos).
- **Teclas na tela:** cada bancada mostra os botões que usa (vareta do TIG e do plasma, descer o eletrodo, manivelas e avanços do torno, girar a amostra na lixa, Encerrar). Segure o botão para segurar a tecla. **⚡ Rápido** é o Shift das manivelas.
- Para testar o layout do celular no computador, abra o HTML com `?toque=1` no fim do endereço.

Num celular pequeno o 3D pode ficar lento: feche outros apps. A Manufatura Aditiva e o escritório do laboratório foram feitos para tela grande e ficam apertados no celular.

## Baixar e jogar

**[Baixar a v2.2 (teste) — ZIP](Oficina-de-Soldagem-Alpha-v2.2.zip)**

Extraia o ZIP e abra **Oficina de Soldagem.html** no Chrome ou Edge, sem instalação e sem internet. O ZIP traz só esse HTML e o LEIA-ME: o `.bat` e o atalho JOGAR ONLINE.html ficaram de fora porque o antivírus costuma acusá-los por engano. O x1 online abre dentro do jogo: Arcade → X1 em rede → **Abrir oficina online**.

O ZIP da v2.2 não traz o servidor local de reserva (ele só é gerado no Windows). Para o x1 em rede local, use o pacote da [v2.1](../v2.1/Oficina-de-Soldagem-Alpha-v2.1.zip) ou da [v2.0](../v2.0/Oficina-de-Soldagem-v2.0-Rede.zip), que usam o mesmo protocolo.

## Jogo online

[Abra a Oficina de Solda online](https://oficinadesolda.beath.chatgpt.site/?rede=1).

Uma pessoa cria a sala e usa **Copiar convite**. A outra abre o link, informa seu apelido e entra. O x1 online é para duas pessoas em MIG/MAG; cada uma precisa de conexão com a internet. A nota é calculada no servidor. A pausa local não interrompe o prazo da rodada.

## Servidor local de reserva

Em **servidor-local/**, execute **ABRIR-OFICINA.bat** no PC anfitrião e mantenha a janela aberta. O pacote já inclui o runtime e não precisa de instalação de Node.js.

O outro jogador abre no navegador o endereço com IP mostrado na janela do servidor. `localhost` funciona somente no próprio anfitrião. A rede precisa permitir comunicação entre os PCs na porta 5197; as políticas do Windows e da instituição continuam valendo.

O servidor local guarda salas em memória: reiniciá-lo apaga essas salas. O online hospedado usa armazenamento compartilhado. Os dois modos usam o mesmo contrato de rede, mas suas salas são separadas.

## Seus dados

Recordes e preferências ficam no navegador, não dentro da pasta. Antes de trocar de caminho, versão ou navegador, exporte os recordes que quiser preservar. O ZIP não transfere automaticamente os dados de versões antigas.

## Código-fonte e geração do pacote

A v2.2 fica nesta pasta (`v2.2/`), feita a partir da v2.1. A Alpha v2.0 estável continua em **alpha-v2.0**, e as versões anteriores permanecem em suas branches.

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run pacote:v2
```

A geração do ZIP usa a biblioteca ZIP do Windows e o Node.js oficial definido em `licencas/node-runtime.json`. Se o executável em uso não corresponder ao hash desse manifesto, defina `NODE_PORTATIL` com o caminho do `node.exe` oficial correspondente. O gerador confere o SHA-256 antes de incluir o runtime.

`npm run pacote:v2` (só no Windows) gera **Oficina-de-Soldagem-Alpha-v2.2.zip** completo, com o portátil, o atalho HTML online e o servidor local de reserva. A pasta intermediária fica em `pacote-v22/` e não entra no Git. O HTML portátil também pode ser gerado separadamente com `npm run portatil`.

Documentação técnica: [fábrica](docs/FABRICA.md), [manufatura aditiva](docs/MANUFATURA-ADITIVA.md), [rede](docs/REDE-V17.md), [hipóteses](docs/HIPOTESES.md), [pontuação](docs/PONTUACAO.md), [TIG](docs/TIG.md) e [verificação](docs/VERIFICACAO.md).

Modelo didático qualitativo: os números do jogo não qualificam procedimentos nem servem como receita de soldagem.
