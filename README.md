# Oficina de Materiais

Jogo didático de processos de fabricação e materiais: uma **fábrica** em 3D com
**Soldagem** (MIG/MAG, eletrodo, TIG, plasma, brasagem, subaquática),
**Usinagem** (torno convencional), **Laboratório de Falhas** e **Manufatura
Aditiva**, ligados por **ordens de serviço** que passam de setor em setor como
numa indústria. Roda no navegador, sem instalação e sem internet.

É a continuação da *Oficina de Soldagem* (repositório
[SoldamatGamification](https://github.com/BeathAzreal/SoldamatGamification),
v1.1 a v2.2). O progresso salvo no navegador continua valendo.

> **Alpha v2.3 (em desenvolvimento).** Versão de teste, não estável.

## O que muda na v2.3

- **Nome novo e repositório próprio**, com uma versão só do código (as
  anteriores ficam no repositório antigo).
- **Fórmulas em MFL.** As contas físicas começam a sair do meio do código e
  vão para arquivos `.mfl` em [`modelos/`](modelos/), escritos na
  [MFL](https://github.com/BeathAzreal/MFLanguage), uma linguagem com
  unidades verificadas. O aluno e o professor podem ler o modelo dentro do
  jogo, em **Ver a fórmula**. Primeiro modelo: o **laudo térmico** do MIG/MAG
  (aporte térmico, t8/5, larguras da zona fundida e da ZTA), em teste: aparece
  no resultado e não muda a nota. Detalhes em [docs/MFL.md](docs/MFL.md).
- **Mais leve:** o HTML portátil caiu de 7,05 MB para 5,03 MB, já com o
  interpretador da MFL dentro (o fundo do menu passou de PNG para WebP).

## Jogar

Gere o HTML portátil (abaixo) e abra **Oficina de Materiais.html** no Chrome
ou Edge. No celular, abra o mesmo HTML no Chrome, na horizontal. Os controles
de cada bancada estão em **Configurações → Controles** e no
[histórico da v2.2](docs/NOVIDADES-v2.2.md).

O x1 online continua em Arcade → X1 em rede → **Abrir oficina online**.

## Seus dados

Recordes, progresso e preferências ficam no navegador, não dentro da pasta.
Antes de trocar de computador ou de navegador, exporte os recordes.

## Desenvolvimento

```bash
npm ci
npm run dev          # servidor de desenvolvimento
npm run typecheck
npm test             # vitest (inclui o laudo térmico rodando a MFL de verdade)
npm run portatil     # HTML único offline em portatil/
```

O CI (GitHub Actions) roda a verificação de tipos, os testes e o build, e
publica o HTML portátil como artefato, com o tamanho de cada parte.

| Pasta | O que tem |
|---|---|
| `src/` | o jogo (TypeScript; three.js no 3D; React só na Usinagem e no Laboratório) |
| `modelos/` | modelos físicos em MFL, lidos pelo jogo e mostrados ao aluno |
| `vendor/mfl-wasm/` | o interpretador da MFL em WebAssembly (cópia do pacote; ver `ORIGEM.md`) |
| `tests/` | testes (vitest) |
| `docs/` | fábrica, hipóteses de cada modelo (`HIPOTESES.md`), pontuação, MFL |
| `servidor/` | servidor do x1 online e da rede local |

Documentação: [fábrica](docs/FABRICA.md), [MFL no jogo](docs/MFL.md),
[hipóteses](docs/HIPOTESES.md), [pontuação](docs/PONTUACAO.md),
[verificação](docs/VERIFICACAO.md).

Modelo didático: os números do jogo não qualificam procedimentos nem servem
como receita de soldagem ou de usinagem.
