# Usinagem — modelo didático: fórmulas, hipóteses e limites

O modelo é **didático e simplificado**. Só as relações da seção 1 são exatas.
Todo o resto usa funções e constantes **sintéticas**, escolhidas para mostrar tendências
coerentes, sem validação experimental. Nenhum valor aqui é recomendação de operação.

Código: `src/modelo/` (funções puras, sem DOM). Dados: `src/dados/`. Partida, programa e avaliação: `src/jogo/`.

## Unidades

| Grandeza | Símbolo | Unidade |
|---|---|---|
| Diâmetro, profundidade, comprimento | D, ap, L, P | mm |
| Rotação | n (S no programa) | rpm |
| Avanço por volta | f (F no programa) | mm/volta |
| Velocidade de corte | vc | m/min |
| Velocidade de avanço | vf | mm/min |
| Tempo | t | min |
| Rugosidade | Ra | µm |
| Força e torque (internos, nunca exibidos) | Fc, M | N, N·m |
| Custo | — | u.c. (unidade de custo didática) |

## 1. Relações exatas (`cinematica.ts`, `furacao.ts`)

- vc = π·D·n / 1000. O jogador escolhe **n** (rotação constante por bloco, G97); vc é sempre calculada.
  No torneamento, o modelo usa vc no diâmetro programado; na furação, vc na periferia da broca.
- vf = f·n
- ΔD = 2·ap; X_prog = X_ref − 2·ap (X em diâmetro, como nos tornos CNC)
- tc = percurso / vf; no torneamento, percurso = L + 2 mm de aproximação
- Volume removido calculado célula a célula: V = Σ π/4·(D_antes² − D_depois²)·Δz
- Ra geométrica = f²/(32·rε); Rt = f²/(8·rε)
- Ponta da broca: lp = (d/2)/tan(σ/2)
- Furação: percurso = aproximação + P + lp + 0,5 mm por descarga; tempo = percurso/vf + descargas × t_descarga

## 2. Peça, torre e referência (`peca.ts`, `jogo/partida.ts`)

- Perfil em células de Δz = 0,1 mm, com z = 0 na face livre. Cada célula guarda o diâmetro externo, o diâmetro do furo, a operação que gerou a superfície e a Ra estimada.
- **H1. Material removido não volta:** D_depois = min(D_antes, D_corte); furo_depois = max(furo_antes, furo_novo).
- **H2. Referência e corretores:** X_ref é o último diâmetro *programado*, não o medido. Cada ferramenta da torre tem o próprio desgaste e o próprio recuo de referência. Uma aresta ou ferramenta nova é zerada com recuo 0; num tarugo novo, as ferramentas montadas são tangenciadas com o recuo que têm naquele momento. O zeramento é suposto perfeito.
- **H2b. Parede mínima:** nenhum torneamento ou furação pode deixar parede menor que 1,0 mm entre o furo e o diâmetro externo (limite geométrico, a operação é recusada).

## 3. Torneamento (`passe.ts`, `fenomenos.ts`)

D_corte = X_prog + 2·(recuo + δ)

- **H3. Recuo da ponta:** recuo = VB·tan α (+ 0,03 mm se lascada) − recuo de referência. Sintético.
- **H4.** A força usa a profundidade nominal, sem descontar a própria deflexão.
- **H5. Força (forma de Kienzle):** Fc = kc·ap·f, kc = kc1.1·h^(−mc), h = f·sen κr. kc1.1 e mc são sintéticos por material.
- **H6. Força passiva:** Fp = Fc·(0,3 + 0,4·e^(−ap/rε)). Sintética.
- **H7. Deflexão:** δ = Fp/k_sistema + Fp·x³/(3·E·I), I = π(D⁴ − d_furo⁴)/64, k_sistema = 15 N/µm (sintético), E do material, x = distância da placa.
- **H8. Lascamento:** Fc/(F_lim·(1 − 0,3·min(VB/VB_lim, 1,5))) ≥ 1 → a aresta lasca naquele ponto (determinístico).

## 4. Furação (`furacao.ts`)

Para cada posição da ponta (passos de 0,1 mm), com d0 = pré-furo existente e d_eng = min(d, 2·z·tan(σ/2)):

- **H22. Corte por aresta:** largura w = (d_eng − d0)/2; h = (f/2)·sen(σ/2); Fc_aresta = kc(h)·w·f/2 (duas arestas).
- **H23. Torque:** M = 2·Fc_aresta·(d_eng + d0)/4.
- **H24. Gume transversal:** se d0 < 0,18·d (furo maciço), soma 0,6·kc·f·0,18·d à força de avanço. Um pré-furo elimina essa parcela. Coeficientes sintéticos.
- **H25. Entupimento do canal:** fator = 1 + 0,5·max(0, (profundidade desde a última descarga)/d − 3). O pica-pau (Q) zera essa profundidade a cada descarga. Sintético.
- **H26. Quebra da broca:** índice = max(M·fator/M_lim, F·fator/F_lim), com limites que caem com o desgaste. Índice ≥ 1 → a broca quebra naquele ponto, fica presa no furo e a peça fica inutilizada (determinístico). Limites por broca, sintéticos e crescentes com o diâmetro.
- **H27. Diâmetro do furo:** d + sobremedida da broca + 0,2·VB; depois do diâmetro pleno, cone da ponta. Sobremedidas sintéticas.
- **H28. Ra da parede:** Ra_base da broca + 0,4·(parcela de aresta postiça do material) + (VB/VB_lim)². Muito simplificada.
- O desgaste da broca usa a mesma acumulação de dano (H10) com vc na periferia.

## 5. Desgaste (`fenomenos.ts`, materiais)

- **H9. Vida de referência (Taylor estendida, sintética):** T = 10 min·(vc_ref/vc)^k·(0,25/f), com vc_ref e k por par material–classe de ferramenta. Aço rápido usa k = 8 e metal duro k ≈ 4 (3,5 no inox). A ordem de grandeza dos expoentes segue o que livros-texto mostram como típico para cada classe; os valores são sintéticos.
- **H10.** Acúmulo linear de dano: dano += Δt/T·fator.
- **H11.** VB = VB_lim·[0,3·(1 − e^(−10·dano)) + 0,7·dano²]; VB_lim = 0,30 mm (limite didático).
- **H12. Casca de fornecimento:** fator = 1 + extra·min(1, espessura/ap) ao cortar a superfície original (carepa do aço laminado: 0,25 mm, extra 2; pele de fundição: 0,5 mm, extra 3).

## 6. Rugosidade estimada (torneamento)

Ra = √(Ra_geo² + Ra_min²) + Ra_APC(vc) + 1,2·(VB/VB_lim)² + Ra_atrito + Ra_lascamento

- **H13.** Piso Ra_min por material (0,3 a 0,9 µm, sintético).
- **H14.** Aresta postiça: janela por material (vc_plena, vc_fim, máximo). Ferro fundido e latão não formam aresta postiça no modelo.
- **H15.** Atrito: ap efetiva < 0,1 mm soma até Ra_atrito_max (maior no inox, que encrua).
- **H16.** Lascamento: +2,5 µm. **H17.** As parcelas são somadas (hipótese do jogo).
- A faixa de ±30 % exibida é só um lembrete de que o valor é indicativo.

## 7. Cavaco

- **H18.** Materiais dúcteis: aresta postiça em vc baixa (só no torneamento); depois, a janela da ferramenta decide entre fita, curto e espesso. A "ductilidade" do material desloca a janela para avanços maiores. Ferramenta sem quebra-cavaco (bit HSS) → fita. Ferro fundido e latão → fragmentado.
- **H19.** Cavaco em fita soma 0,3 min de parada para retirada.

## 8. Medição e avaliação

- **H20.** Micrômetros externo e interno: leitura arredondada a 0,01 mm, incerteza didática ±0,01 mm, sem ruído.
- **H21.** Paquímetro: comprimento usinado até o primeiro degrau > 0,1 mm; profundidade do furo até onde o diâmetro pleno termina; resolução 0,05 mm.
- Encomenda: refugo irreversível (abaixo do limite inferior ou região bruta usinada); avaliação por critérios (especificações, sobremetal, medições, recursos, pergunta estruturada).

## 9. Programa CNC (`jogo/programa.ts`)

- O programa é uma lista de blocos (torneamento, furação, M00) editada por formulário. A listagem ISO (G00/G01/G83/G97, X em diâmetro, Z negativo) é **gerada para leitura**, sem interpretador de código G.
- CICLO INÍCIO executa a partir do cursor; "bloco a bloco" para depois de cada bloco; M00 para o programa; um erro de limite gera ALARME e para o ciclo. MDI executa só o bloco escolhido sem mover o cursor.
- **Animação:** cada bloco é calculado inteiro antes de ser mostrado. O quadro é função só do tempo simulado; a velocidade de simulação muda só a apresentação (1 min de corte = 20 s em 1×).

## 10. Tempo e custo

Tempo = corte (ou furação, incluindo descargas) + 0,4 min por operação + retirada de cavaco + trocas (1,5 min) + montagem (1,0 min) + preparação do tarugo (3 min).
Custo = tarugos × 12 + minutos × 1,5 + Σ consumo de cada ferramenta × custo dela. Tudo sintético.

## 11. Não implementado (só limitações)

Vibração e chatter, temperatura e dilatação, fluido de corte, revestimento, desgaste de cratera e de entalhe, desgaste adesivo em vc baixa,
encruamento real (só a parcela de atrito), tensões residuais, rebarba, raio no canto do ressalto, potência do motor, G96, faceamento, canais, roscas,
perfis, compensação de raio, desvio de broca sem centro, conicidade e ovalização do furo, broca presa removível, erros geométricos da máquina.

## Materiais (todos com designação fictícia e comportamento sintético)

| Material | Família / condição | kc1.1, mc | E [GPa] | Aresta postiça | Vida MD / HSS (vc_ref, k) | Casca | Cavaco |
|---|---|---|---|---|---|---|---|
| AC-45 | aço médio C, laminado a quente | 1700, 0,25 | 210 | até 45 → 0 em 120 m/min, 2,5 µm | 200/4 · 30/8 | carepa 0,25 mm | dúctil |
| AC-10 | aço baixo C, trefilado | 1500, 0,26 | 210 | até 60 → 0 em 160, 3,0 µm | 250/4 · 38/8 | — | muito dúctil |
| AL-61 | Al-Mg-Si, T6 | 800, 0,23 | 69 | até 80 → 0 em 250, 1,5 µm | 1200/4 · 250/8 | — | dúctil |
| FF-25 | ferro fundido cinzento, bruto | 1100, 0,28 | 110 | não | 150/4 · 22/8 | pele 0,5 mm | fragmentado |
| IX-304 | inox austenítico, solubilizado | 2100, 0,21 | 193 | até 30 → 0 em 90, 2,0 µm | 140/3,5 · 18/8 | — | muito dúctil |
| LT-360 | latão de corte livre | 780, 0,18 | 100 | não | 600/4 · 120/8 | — | fragmentado |

E: valores típicos de cada família (literatura geral). Demais colunas: sintéticas — revisar.

## Ferramentas (fictícias)

| Código | Tipo | Classe | Geometria principal | Limites sintéticos |
|---|---|---|---|---|
| MD-80 R0,8 | inserto | metal duro | 80°, rε 0,8, κr 95° | F_lim 2400 N, ap ≤ 3 |
| MD-80 R0,4 | inserto | metal duro | 80°, rε 0,4 | F_lim 1700 N, ap ≤ 2 |
| MD-80 R1,2 | inserto | metal duro | 80°, rε 1,2 | F_lim 3200 N, ap ≤ 4 |
| MD-35 R0,2 | inserto | metal duro | 35°, rε 0,2, κr 93° | F_lim 900 N, ap ≤ 1,5 |
| HSS bit R0,4 | bit afiado | aço rápido | rε 0,4, sem quebra-cavaco | F_lim 1500 N |
| Broca HSS Ø6 / Ø10 / Ø16 | helicoidal | aço rápido | σ 118° | M_lim 4,5 / 20 / 80 N·m |
| Broca MD Ø10 | inteiriça | metal duro | σ 140° | M_lim 28 N·m, sobremedida 0,02 |

## Outros parâmetros sintéticos

| Parâmetro | Valor | Onde |
|---|---|---|
| Razão passiva | 0,3 + 0,4·e^(−ap/rε) | `fenomenos.ts` |
| Rigidez do sistema | 15 N/µm | `torno-td1.ts` |
| Curva VB(dano) | 0,3·(1 − e^(−10x)) + 0,7x² | `fenomenos.ts` |
| Recuo por lascamento | 0,03 mm | `passe.ts` |
| Gume transversal / entupimento | 0,18·d; 0,6; L/D 3; 0,5 por d | `furacao.ts` |
| Tempo por descarga | 0,04 min | `torno-td1.ts` |
| Tempos e custos | ver encomenda | `om01-eixo-sob-medida.ts` |
| Fração de perlita (AC-45, AC-10) | regra da alavanca no equilíbrio (0,022 / 0,76 %C) | estimativa de equilíbrio |
