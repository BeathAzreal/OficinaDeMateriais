# Avaliação de treino SMAW — v1.6

Referências consultadas em 26/10/2026:
- ISO 5817:2023, tabela 1, itens 1.9/1.10 (imperfeições 502/503): https://www.iso.org/standard/80209.html
- Texto consultado para conferir os limites dimensionais: https://weldcalc.ssab.com/sisStandards/ISO%205817_Ed_4_2023.pdf (página impressa 7).
- ISO 17637:2016, inspeção visual: https://www.iso.org/standard/67259.html
- ISO 6520-1:2007, classificação das imperfeições: https://www.iso.org/standard/40229.html

O exercício usa o nível C como referência fixa; B/C/D permanecem definidos na função de comparação dimensional. Somente a comparação dimensional h/b dos itens 502 e 503 foi implementada. h e b vêm das seções do cordão simulado, em mm; no filete h é a convexidade acima da linha entre os pés, e b é a largura da face. Transição suave e geometria do pé não são medidas: o resultado identifica explicitamente a verificação como parcial. Não se infere conformidade de toda a junta nem qualificação do soldador.

A remoção de escória segue a preparação para inspeção visual descrita na ISO 17637:2016, 6.4.2; as dimensões se relacionam ao exame de perfil de 6.4.3. Condições de iluminação, qualificação do examinador e demais verificações não são reproduzidas.

O jogador encerra a tentativa por botão ou Enter e recebe uma nota numérica de 0 a 1000. A escória não bloqueia a pontuação: desconta até 200 pontos, proporcional à fração não removida. A inspeção visual fica pendente enquanto a máscara ainda contém escória, e a geometria oculta é identificada como estimativa interna do jogo. Não há estimativa de porosidade, trincas, penetração, fusão ou inclusões internas. O indicador de deposição sobre escória não é usado como prova de inclusão interna. Não se empregam limites de uma norma de inspeção visual como se fossem limites de aceitação de defeitos.

A nota de 0 a 1000 é uma regra do jogo, não uma nota ISO: união das bordas 300, preenchimento e perfil 400 (200 de preenchimento + 200 de perfil), metal na região solicitada 150 e continuidade 150. A avaliação usa a malha local do eletrodo, a mesma do 3D e do contato. Não usa mais o centro médio de uma fatia como substituto para a união real.

A cada 1 mm entre INÍCIO e FIM, nove pontos transversais precisam atingir o perfil-alvo, com pelo menos 0,1 mm de metal e tolerância de altura de 0,2 mm. Isso evita contar dois cordões separados como uma união. O progresso mede o preenchimento local mesmo antes de completar a face. Abaixo de 80% do preenchimento-alvo, aplica-se um fator proporcional para impedir nota alta com um ponto isolado. Todos esses cortes e pesos são didáticos, não limites ISO.

Objetivos por peça:
- Topo reto e reparo da grade: preencher a abertura até a face; chapa grossa pode exigir várias varetas e limpeza entre passes.
- Filetes: unir o canto com perna-alvo de aproximadamente 4 mm. A convexidade é medida acima da reta entre os pés do perfil conectado, sem usar a altura absoluta da raiz como reforço.
- Chanfro em V: o exercício solicita apenas um passe de raiz, com camada-alvo de 2 mm no fundo. Não se exige encher os 12 mm da chapa para pontuar. O teto didático de 4 mm para esse passe não é apresentado como limite ISO 5817 de reforço final. A verificação dimensional 502 na face final não se aplica ao passe de raiz isolado.

A comparação 502/503 só usa seções que completaram o objetivo. Metal fora do intervalo solicitado ou distante da emenda fica visível onde foi depositado, mas não preenche a região avaliada. Arco adequado e aderência aparecem como feedback de técnica. Sem arco e metal depositado a nota é zero; limpeza evita o desconto por escória, sem dar pontos por uma superfície vazia.


No treino a avaliação não entra no ranking de MIG/MAG. Ao encerrar, o resultado congela a bancada e exibe total, conceito, critérios e descontos. Inspecionar em 360° ou ocultar a escória não muda o modelo nem a nota. Nova tentativa reinicia a peça atual; também é possível escolher outra peça diretamente.
