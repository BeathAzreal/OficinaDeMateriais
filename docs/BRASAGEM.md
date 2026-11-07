# Brasagem (v2.0, H105)

Treino → **BRASAGEM** → peça → chapa → modo.

Na brasagem o metal de base **não funde**. O maçarico aquece a junta até a faixa de trabalho da liga. A vareta, encostada na borda, derrete com o calor **da peça** (não da chama), e a liga corre por capilaridade para dentro da folga entre as chapas sobrepostas, puxada para onde está mais quente. O que segura a peça é a liga **dentro** da folga, que não se vê de fora.

## Como jogar

| Controle | Só mouse | Mesa + mouse (duas mãos) |
|---|---|---|
| Maçarico | o mouse; segure o botão esquerdo para pôr a chama na peça (solte para afastar) | a caneta; encoste a ponta para pôr a chama na peça |
| Vareta | Espaço encosta na borda, à frente da chama (A/D mudam a distância) | o mouse escolhe o ponto da borda; clique para encostar |
| Distância do bico | W/S ou a roda | W/S ou a roda |
| Câmera | botão do meio ou direito | botão do meio ou direito |

Antes ou durante a tentativa, no painel **PREPARO**:

- **Liga:** cobre-fósforo, prata 45 % ou latão. Mudar a liga recomeça a peça.
- **Fluxo:** pincelado nas duas faces antes de montar. Mudar recomeça a peça.
- **Bico (1 a 5):** mais calor e chama mais larga.
- **Chama:** neutra, oxidante ou carburante.

A técnica:

1. Aqueça a **sobreposição inteira**, não só a borda: mova a chama também sobre a chapa de cima.
2. Observe o fluxo. Ele começa como pasta branca, ferve e vira pó perto de 100 °C e fica **vítreo e transparente** quando chega à faixa ativa. Esse é o sinal de que dá para encostar a vareta.
3. Encoste a vareta na borda, **do lado oposto à chama**. Se a chama derreter a vareta com a peça fria, a liga cai em bolinhas que não molham.
4. Deixe a liga correr para dentro e avance a chama aos poucos, junto com ela.
5. Passou da faixa? Afaste a chama: o fluxo queima, o zinco da liga ferve e, no limite, a chapa funde.

No **Fácil** o HUD mostra a temperatura onde a vareta encosta, no fim da sobreposição e sob a chama. No **Difícil** não há termômetro: só a cor da peça (vermelho escuro, cereja, laranja…), como na oficina.

## Peças

| Peça | Chapa | Liga e preparo recomendados | O que ensina |
|---|---|---|---|
| Suporte de aço | aço carbono 1,5 mm | prata 45 %, fluxo branco, bico 2, chama neutra | a técnica básica |
| Barramento de cobre | cobre 1,5 mm | cobre-fósforo **sem fluxo**, bico 5 | o cobre leva o calor embora; o fósforo limpa o óxido do cobre |
| Grade galvanizada | aço galvanizado 1,5 mm | prata 45 %, fluxo branco, bico 2 | trabalhar abaixo de 907 °C para não ferver o zinco da chapa |
| Luva de quadro | aço carbono 1,5 mm | latão, fluxo de bórax, bico 4 | faixa estreita (910–955 °C): aquecer o lado de dentro |

Todas são juntas sobrepostas com sobreposição de 6 mm (4 vezes a espessura) e folga de 0,06 a 0,1 mm. Como nos outros processos, a chapa pode ser trocada no treino: aço carbono, inox austenítico, galvanizado ou cobre. A recomendação acompanha a chapa: o cobre pede o bico 5, e o aço nunca recebe cobre-fósforo.

## O que vem de catálogo e o que é do jogo

**De catálogo** (AWS A5.8 e fichas de fabricante):

| Liga | Solidus | Liquidus | Faixa de trabalho | Fluxo |
|---|---|---|---|---|
| Cobre-fósforo Cu-7P (BCuP-2) | 710 °C | 795 °C | 735–840 °C | dispensa no cobre |
| Prata 45 % Ag-Cu-Zn (BAg-5) | 663 °C | 743 °C | 745–845 °C | branco (FB3-A), ativo de 565 a 870 °C |
| Latão Cu-Zn-Sn (RBCuZn-A) | 888 °C | 899 °C | 910–955 °C | bórax (FB3-D), ativo de 760 a 1150 °C |

Também são de catálogo:
- a fusão do metal de base: cobre a 1083 °C, aço a cerca de 1510 °C;
- o zinco do galvanizado: derrete a 420 °C e ferve a 907 °C;
- a folga ideal de brasagem: de 0,025 a 0,125 mm;
- a regra do cobre-fósforo: fragiliza o aço (fosfeto de ferro), mas no cobre dispensa fluxo.

**Do jogo:**
- a potência de cada bico;
- a largura da chama pela distância;
- a velocidade da capilaridade;
- quanto dura o fluxo;
- quanto o metal oxida;
- a nota.

O campo de calor é o do TIG: condução no plano da chapa e perda para o resto da peça, com a difusividade pela metade da real para caber na grade.

## Nota (0 a 1000)

| Item | Pontos | O que mede |
|---|---|---|
| Folga preenchida | 350 | fração da folga cheia de liga (como num corte); poros contam como vazio |
| Liga até o fim | 150 | a liga chegou ao fim da sobreposição |
| Filete na borda | 150 | filete fino e contínuo na borda da chapa de cima |
| Temperatura de trabalho | 200 | borda entre o liquidus e o superaquecimento, por igual ao longo da junta |
| Limpeza e economia | 150 | sem liga embolada, vareta derretida na chama, fluxo queimado ou liga escorrida; vale na proporção da folga cheia |

Descontos:
- **metal de base fundido;**
- **junta frágil:** cobre-fósforo no aço;
- **zinco queimado:** além de 3 mm de cada lado da junta.

No Difícil cada item precisa de 20 %, como no eletrodo e no TIG. No resultado, **Ver a folga por dentro** mostra a chapa de cima arrancada, como no ensaio de arrancamento: onde a liga molhou, vazios e poros.

## Limites

- Só juntas sobrepostas em chapa. Tubo com luva fica para outra versão: a bancada 3D não tem a geometria da luva.
- O alumínio não vai à brasagem no jogo: as ligas de alumínio-silício trabalham a poucas dezenas de graus da fusão do metal de base.
- A liga solidificada não tem resistência calculada: a junta é julgada pelo preenchimento, como na inspeção.
- A vareta não esfria a peça além de um pouco de calor na borda; a chama não muda com o ângulo do maçarico.
