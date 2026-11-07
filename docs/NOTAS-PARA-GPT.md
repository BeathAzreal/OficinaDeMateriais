# Notas do Claude para o GPT (Alpha v1.3, branch `claude/v1.3`)

O que mudou nas áreas do Claude e o que precisa de ajuste nas áreas do GPT
(missões, didática, Arcade, torneio, recordes, persistência). Nada abaixo
foi mexido pelo Claude além do mínimo listado em "Já ajustado".

## 1. Pontuação `pontuacao-v3` (0 a 1000)

- `ResultadoPontuacao.total` vai de **0 a 1000** (inteiro); cada categoria
  vai até `peso × 10` (`categoria.maximo` já traz o valor certo). Use
  `ESCALA_PONTUACAO` (`src/pontuacao/regras.ts`) em vez de 100 fixo.
- Nomes novos das categorias (`NOME_CATEGORIA`; os ids não mudaram):
  integridade → "Fusão prevista (integridade)", desenho → "Geometria do
  cordão", regularidade → "Regularidade da largura", deformacao →
  "Controle térmico", eficiencia → "Execução".
- Notas graduadas: os `detalhes` do desenho agora são **notas** (Largura,
  Reforço, Alinhamento) e não "fração dentro da faixa". Execução traz
  "Arco sobre a junta", "Reinícios de arco" e "Metal no trecho".
- `EntradaPontuacao.aberturasDeArco` (opcional) entra na Execução;
  `pontuarRegistro` já calcula a partir dos eventos.
- `medidas` ganhou `notaFusao`, `reiniciosArco` e `aproveitamentoMetal`.
- Detalhes e justificativas: `docs/PONTUACAO.md`.

**Precisa de ajuste (GPT):**
1. Textos que falam em "nota de 0 a 100", "pontos de 100" ou nos nomes
   antigos das categorias (telas de História, Arcade, Torneio, Recordes e
   textos didáticos).
2. Mostrar o total como inteiro (hoje várias telas usam `n1`, que mostra
   "846,0").
3. Arcade: `pontos = total × multiplicador` agora vai até 2000 por desafio;
   conferir textos e recordes da partida (`VERSAO_ARCADE` talvez deva subir).
4. Recordes antigos (`pontuacao-v1`/`v2`, 0–100) continuam guardados e
   separados por versão; decidir se a tela de Recordes mostra a escala de
   cada versão.

## 2. Modelo: a fresta da junta de topo enche primeiro (H18 revista)

No topo reto com abertura, o metal enche a fresta (abertura × espessura)
antes de virar reforço. Com o mesmo metal, largura e reforço ficam um pouco
menores. O contexto padrão `CONTEXTO_PADRAO` passou a ter abertura 0 (cordão
sobre chapa, o modelo das etapas 1–4), então os testes daquelas etapas não
mudaram.

**Precisa de ajuste (GPT), em `src/didatica/`:**
- `explicacao.ts` (largura prevista por `larguraPelaArea(area, razao)`) e
  `comparacao.ts` (`decomporLargura` com `√(taxa)`, `√(velocidade)`,
  `√(razão)`) supõem largura ∝ √área. Com fresta isso vira aproximação. O
  certo é usar a área de **reforço**: `areaParaLargura(junta, dimensões,
  largura, razão)` em `src/modelo/juntas.ts` faz a conta inversa, e
  `SecaoLocal.areaReforcoMm2` traz a área acima da face.
- O estado de fusão `enchimento` agora também aparece no topo reto (metal
  abaixo da face) e se chama "junta não preenchida".

## 3. Outras mudanças do modelo que a didática pode usar

- DBCP (10/15/20 mm) no preparo (`Preparo.dbcpMm`), corrente pela relação
  de fusão do arame (H28 revista, H48), ângulo de avanço em
  `INFO_TECNICA[t].anguloAvancoGraus`.
- Relatório técnico estruturado: `relatorioDoRegistro(...)` em
  `src/pontuacao/oficial.ts` (observação × fatores × limitações por trecho);
  campos em `docs/PONTUACAO.md`.

## Já ajustado pelo Claude (mínimo necessário)

- `src/dados/recordes.ts`: validação do total aceita até `ESCALA_PONTUACAO`.
- `src/dados/torneio.ts`: nota do professor (0–10) convertida para a escala
  de 1000 na média ponderada.
- `src/ui/componentes/pontuacao.ts`: conceito S–D por fração da escala e
  placar "/ 1000".
- `src/ui/telas/historia.ts`: recorde buscado na versão atual da pontuação.
- Testes: `tests/torneio.test.ts` (média ponderada na escala nova),
  `tests/dados.test.ts` (nota inválida agora é 5000).

## Alpha v1.4 — defeitos visíveis (Claude, `claude/v1.4`)

O modelo agora prevê defeitos visíveis (H50–H57 em HIPOTESES.md): gravidade
(escorrimento, gotas, caimento), mordedura, sobreposição, respingos,
cratera, porosidade e empeno. Tudo em `src/modelo/defeitos.ts`, função pura
`analisarDefeitos(...)`.

**O que a didática pode usar:**
- `NOME_DEFEITO` e `CONSELHO_DEFEITO` (textos curtos de base, pode
  reescrever na didática) e `OcorrenciaDefeito` (tipo, trecho, valor,
  limiar, unidade).
- Relatório técnico `relatorio-tecnico-v2`: campo `defeitos` com as
  ocorrências, contagem de respingos, poros, gotas e o empeno.
- Ideias de missões/roteiros (área do GPT): sobrecabeça com poça pequena,
  vertical subindo × descendo, horizontal apontando para a chapa de cima,
  "encher a cratera" no fim, alumínio com e sem limpeza do óxido.
- `reforcoMaxMm: 3` em algumas missões continua folgado demais para ser
  realista (comentado na v1.3).

**Pontuação:** `pontuacao-v6` (superfície na geometria; poros e sobreposição
na fusão). Recordes e torneios com versões antigas ficam separados, como
antes. Textos que citem "4 itens da geometria" precisam virar 5.

**Telas comuns que o Claude mexeu (mínimo):**
- `src/ui/componentes/inspecao.ts`: aba "Defeitos", defeitos no 3D e no corte.
- `src/ui/componentes/bancada.ts`: linha "Defeitos visíveis" no resumo do passe.
- `src/ui/telas/execucao.ts` e `bancada.ts`: passam `eventos` para o 3D.

