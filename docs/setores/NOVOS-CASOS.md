# Como cadastrar um novo caso

Um caso é um objeto `CasoDefinicao` (ver `src/casos/tipos.ts`) com três partes em arquivos separados.
O motor atual suporta a família geométrica **junta de topo em V em chapa** (`geometria.tipo = 'junta-topo-v'`);
dentro dela, um novo caso pode ser criado só com dados.

## Passo a passo

1. Copie a pasta `src/casos/junta-que-falhou/` para `src/casos/<novo-id>/`.
2. **`ficha.ts` (público)** — tudo o que pode aparecer na tela:
   - `ficha`, `historico`, `objetivo`, `recursos` (orçamento em R$ e tempo em h);
   - `desenho`: dimensões externas para desenhar a peça (largura, espessura, meia-largura do cordão, posição da fratura na face);
   - `superficies`: superfícies da inspeção visual, com faixas `u`/`v` em mm;
   - `documentos`: cada fato tem um `achadoId` (usado só pela avaliação);
   - `hipoteses` com `categoria` (`mecanismo`, `causa`, `fator`);
   - `gruposInterpretacao`: perguntas e opções de interpretação (sem indicar a correta);
   - `relatorio.limitacoes` e `relatorio.proximosEnsaios`: misture afirmações corretas e indevidas;
   - `tutorial` e `dicas` (modo Aprender).
3. **`verdade.ts` (só o motor)**:
   - `geometria`: dimensões da junta, larguras da ZTA, profundidades de revenimento, plano da fratura e faixa da origem;
   - `zonas`: estilo de desenho (`ferrita-perlita`, `martensita`, `zf-colunar` etc.), tamanho de grão (mm), fração escura,
     tom no macroataque, densidade de inclusões e **dureza sintética**;
   - `formas`: feições 3D (`esferas` para poros; `trinca` com traço por orientação de corte);
   - `achadosVisuais`: região, marcador (para achados locais), regras *(vistas, luzes, limpezas) → qualidade*, observação **descritiva**;
   - `achadosMetalografia`: `modo` campo (por zona ou caixa 3D) ou local (por forma), regras *(ampliações, ataques) → qualidade*,
     `linhaFina` para feições que riscos podem imitar, `requer` quando a observação só faz sentido depois de achar outra;
   - `achadosDureza`: como classificar o máximo e a média afastada de um perfil;
   - `superficieFratura` e `superficieExterna`: parâmetros usados para desenhar as superfícies;
   - `variacaoFase`: dispersão por fase atingida, por carga.
4. **`gabarito.ts` (só a avaliação)**:
   - `mecanismo`, `causa` e `fatores` com grupos de **suficiência** (quais achados tornam a conclusão sustentável);
   - `hipoteses`: verdadeira/falsa, evidências decisivas e explicação;
   - `achados`: para cada id (inclusive fatos de documentos), interpretações `corretas`/`aceitaveis`/`exageros`, `relevancia` por hipótese
     (`apoia`, `enfraquece`, `apoia-fraco`, `enfraquece-fraco`), `chave`, `explicacao` e `comoObter`;
   - `limitacoesCorretas/Incorretas`, `ensaiosUteis/Inadequados`;
   - `cadeia` (devolutiva), `ensaios` (o que cada estação mostra e não mostra);
   - `amostragem`: critérios declarativos (`visual`, `corte`, `micrografia-zona`, `micrografia-caixa`, `perfil-atravessa`,
     `perfil-zona`, `documento`) e penalidades (`limpeza`, `corte-antes-de-documentar`).
5. Crie `index.ts` exportando o `CasoDefinicao` e registre-o em `src/casos/index.ts` (`CASOS`).
   Hoje a tela inicial abre o primeiro caso da lista; com dois ou mais casos, acrescente uma seleção de caso na `TelaInicial` (`src/ui/App.tsx`).
6. Escreva testes no estilo de `tests/amostragem.test.ts`: para cada evidência-chave, um teste que a obtém com as condições
   certas e outro que mostra a limitação quando as condições são erradas. Rode `npm test`.

## Regras de consistência

- Escreva **observações descritivas** ("linhas curvas concêntricas…"), nunca interpretações ("marcas de praia…").
  A interpretação fica nas opções do grupo.
- Toda feição desenhada deve ter um achado correspondente, e vice-versa; confira posições com testes (veja `consistencia.test.ts`).
- Dureza, microestrutura e fratura devem vir das mesmas zonas e da mesma geometria.
- Não crie parâmetros sem efeito. Se uma escolha não muda nada no seu caso, ela não deve ser oferecida.
- Inclua alternativas plausíveis e ao menos uma evidência "real, mas irrelevante" (como os poros do caso 1).
- Não invente normas, limites de aceitação ou referências. Valores sintéticos entram em `docs/MODELO-DIDATICO.md` com a situação "revisar".

## Outras geometrias

Para peças que não sejam juntas de topo em V (eixos, engrenagens, vasos), crie um novo módulo em `src/motor/` com as mesmas
funções de `geometria.ts` (`parteEm`, `zonaEm`, `pontoNaSecao`, `contornoSecao`, `xBordaFratura` ou equivalente) e acrescente
o novo `tipo` à união de geometrias em `src/casos/tipos.ts`. Os renderizadores em `src/ui/render/` também usam essas funções.
