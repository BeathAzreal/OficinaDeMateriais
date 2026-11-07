# MFL no jogo

A [MFL](https://github.com/BeathAzreal/MFLanguage) (Materials &
Manufacturing Language) é uma linguagem pequena para modelos de materiais e
fabricação: cada número tem unidade, e a linguagem recusa uma conta com
dimensões erradas antes de rodar. O jogo a usa para duas coisas:

1. **Fórmulas legíveis.** O modelo fica num arquivo `.mfl` com unidades,
   fonte e limites, e não espalhado no TypeScript. O aluno e o professor
   leem o mesmo arquivo que o jogo roda (botão **Ver a fórmula**).
2. **Modelos verificados.** O módulo `welding` da MFL tem testes contra
   soluções independentes (MFL, `docs/welding.md` §4).

## Como funciona

| Parte | Arquivo |
|---|---|
| Modelos | `modelos/**/*.mfl` (entram no build como texto) |
| Interpretador | `vendor/mfl-wasm/` (WebAssembly, 306 KB; embutido no HTML portátil) |
| Motor: carrega a MFL uma vez, registra os modelos, compila cada um uma vez | `src/mfl/motor.ts` |
| Laudo térmico (entradas e saídas com unidade) | `src/mfl/laudoTermico.ts` |
| Botão e sobreposição do laudo | `src/ui/componentes/laudoTermico.ts` |
| Testes (rodam a MFL de verdade) | `tests/laudoTermico.test.ts` |

O jogo passa entradas com unidade (`tensao` em V, `velocidade` em mm/s,
`preaquecimento` em K) e lê os resultados na unidade que quiser
(`aporte` em kJ/mm, `t85` em s). O interpretador só carrega na primeira vez
que um modelo é usado.

## Laudo térmico do MIG/MAG (H111, em teste)

No resultado do MIG/MAG (Treino e Fábrica → Soldagem), o botão **Laudo
térmico (MFL)** mostra:

| Resultado | Modelo |
|---|---|
| Aporte térmico (kJ/mm) | Q = k·U·I/v, k = 0,8 (EN 1011-1) |
| Chapa fina (2-D) ou grossa (3-D) | espessura de transição da EN 1011-2 |
| t8/5 (s) | EN 1011-2, Anexo D (F2 = F3 = 1) |
| Larguras da zona fundida e da ZTA | distância em que o pico do campo de Rosenthal chega a 1500 °C e a 727 °C (A1) |

Entradas: tensão e corrente do último ajuste da máquina no passe,
velocidade média do trecho avaliado, espessura e material da chapa, peça a
20 °C (o jogo ainda não tem pré-aquecimento). Só os aços carbono
(baixo carbono, galvanizado, SAE 1045) têm o laudo completo; nas outras
chapas aparece só o aporte.

**Validade:** se a zona fundida calculada passa de 4 vezes a espessura (poça atravessando a chapa), o laudo avisa que os números deixaram de valer.

**Modo sombra:** o laudo não muda a nota. Ele serve para comparar com os
índices qualitativos do jogo antes de decidir se a MFL passa a valer na
pontuação.

**Limites:** modelos analíticos com propriedades constantes e sem perdas
pela superfície; valem para a ZTA, longe do arco. Não preveem a poça, a
penetração, o chanfro nem a microestrutura.

## Atualizar a MFL

1. Na MFL: `wasm/build.sh` e `python3 wasm/package.py` (gera `wasm/dist/npm`).
2. Aqui: `node scripts/atualizar-mfl.mjs <caminho>/wasm/dist/npm <commit da MFL>`
   e `npm install`.
3. `npm test`: os testes do laudo comparam com as referências da MFL.

## Próximos modelos

- Dureza da ZTA a partir do t8/5 e do carbono equivalente (hoje uma regra do
  jogo em `src/modelo/subaquatica.ts`), para a solda subaquática e para o
  laboratório.
- A solda do aluno gerar o caso do Laboratório de Falhas (OS-02).
- Torno: força de corte, rugosidade teórica, vida da ferramenta.
