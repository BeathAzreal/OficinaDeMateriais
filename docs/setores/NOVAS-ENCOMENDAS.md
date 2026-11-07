# Como cadastrar encomendas, materiais e ferramentas

Os dados ficam separados da interface em `src/dados/`. O cadastro central é `src/dados/catalogo.ts`.

## Nova encomenda

1. Copie `src/dados/encomendas/om01-eixo-sob-medida.ts`.
2. Ajuste `id`, `codigo`, `titulo`, `resumo`, `contexto`, `tarugo`, `requisitos`, `pontosMedicao`, `instrumentos`, `custos`, `tempos` e `modoEncomenda`.
   Os requisitos devem ser identificados como objetivos fictícios da missão.
3. Defina `materialId`, `maquinaId`, `ferramentasPermitidas` (ids da biblioteca) e `torreInicial` (posição → id).
4. Registre a encomenda no array `encomendas` de `catalogo.ts`.

Limites atuais: a avaliação de entrega (`src/jogo/avaliacao.ts`) cobre um diâmetro externo a partir da face livre. Uma encomenda com furo
precisa de critérios novos na avaliação. Ainda não há seletor de encomendas na interface: a partida usa a primeira do catálogo.

## Novo material (ou nova condição de fornecimento)

Crie um objeto `Material` (`src/modelo/tipos.ts`), em `src/dados/materiais/`, e registre em `listaMateriais`. O comportamento é dado por **funções**,
montadas com as peças de `materiais/comum.ts` ou escritas do zero:

- `classificarCavaco(cond)` — `classificadorDuctil(apc, ductilidade)` ou uma regra própria (ex.: sempre fragmentado).
- `rugosidadeApc(vc)` — `janelaApc(vcPlena, vcFim, raMax)`, ou `() => 0`.
- `vidaAresta(vc, f, classe)` — `vidaTaylor({ 'metal-duro': {...}, 'aco-rapido': {...} })`.
- `fatorCasca(ap)` e `casca` — superfície de fornecimento.
- `forca`, `raMinimo`, `raAtritoMax`, `moduloElasticidade`, `cores` e `microestrutura.esquema`
  (`ferrita-perlita`, `monofasico` com maclas e partículas opcionais, ou `grafita-lamelar`).

Outra condição de fornecimento do mesmo material (normalizado, temperado e revenido…) é outro objeto `Material`.
Todo número novo entra na tabela de `docs/MODELO.md`, com origem e status.

## Nova ferramenta ou broca

Acrescente um `FerramentaTornear` ou uma `Broca` em `src/dados/ferramentas/biblioteca.ts` e inclua nas listas exportadas.
Para insertos, rε, κr, εr e α entram nas equações e no desenho; a janela de quebra-cavaco, `forcaLimite` e `vbLimite` controlam cavaco, lascamento
e desgaste. Para brocas, diâmetro, σ, canal útil, `torqueLimite`, `forcaAvancoLimite`, `sobremedida`, `raBase` e `janelaCavaco`.
