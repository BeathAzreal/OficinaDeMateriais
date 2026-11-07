# Laboratório de Falhas

Jogo didático de investigação de falhas em materiais, em português, para estudantes de Engenharia de Materiais.
O jogador recebe uma peça que falhou, consulta o histórico, formula hipóteses e decide **onde amostrar, como preparar,
que ensaios fazer e com quais parâmetros**. Ao final, monta um relatório estruturado e recebe uma devolutiva.

> As imagens são **esquemáticas** e os dados são **sintéticos**. A atividade desenvolve raciocínio de investigação
> (processamento → estrutura → propriedades → desempenho) e **não certifica competência prática** de laboratório.

## Requisitos

- Node.js 20 ou mais recente (testado com Node 24) e npm.
- Navegador moderno. Layout pensado para computador (≥ 1280 px de largura).

Não há backend, login, serviço pago nem chamada de IA. O progresso fica no `localStorage` do navegador.

## Instalação e execução

```bash
npm install
```

```bash
npm run dev
```

Abra o endereço indicado pelo Vite (por padrão `http://localhost:5173`).

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes das regras (Vitest) |
| `npm run typecheck` | Verificação de tipos |
| `npm run build` | Gera a versão estática em `dist/` (pode ser aberta por qualquer servidor estático) |
| `npm run preview` | Serve a versão gerada |

## Como se joga (caso 1: "A junta que falhou")

1. **Bancada** — peça interativa (vista de cima e lateral), ficha técnica, histórico, objetivo, orçamento (R$ 3.000) e tempo (30 h).
   Documentos extras podem ser solicitados (custam tempo).
2. **Hipóteses** — mecanismo, causa e fatores contribuintes, separados. Para cada hipótese, anote o que a apoiaria e o que a enfraqueceria.
3. **Ensaios** — três estações, cada uma com custo, tempo, finalidade e tipo de informação:
   - **Inspeção visual e da fratura**: superfície, limpeza (suave ou agressiva, irreversível), luz (rasante ou difusa), visão geral ou detalhe ~10×.
   - **Metalografia**: posição e orientação do corte (destrutivo), lixamento, polimento, ataque e ampliação (10×, 100×, 500×).
   - **Microdureza Vickers**: carga, profundidade, trajeto, espaçamento e pontos avulsos; gráfico dureza × distância e marcas em escala real.
4. **Caderno** (painel à direita) — resultados com identificação da amostra e parâmetros, evidências (observação ≠ interpretação),
   associação às hipóteses (apoia / enfraquece / inconclusiva), matriz, comparação entre resultados e registro de gastos.
5. **Relatório** — mecanismo, causa, fatores, evidências citadas, situação das alternativas, limitações e próximos ensaios.
   "Dados insuficientes" é aceito quando justificado pelos dados obtidos.
6. **Devolutiva** — nota por dimensão, cadeia de evidências, explicação das hipóteses alternativas, revisão das evidências e
   o que cada ensaio mostra e não mostra. A solução só aparece aqui.

Modos: **Aprender** (dicas antes das decisões e explicações das limitações durante a investigação) e
**Desafio** (menos orientação; explicações completas só na devolutiva). O botão **Reiniciar** apaga o progresso do caso.

## Organização do código

```
src/
  casos/                    dados dos casos (um arquivo por parte)
    tipos.ts                tipos de um caso: público, verdade, gabarito
    junta-que-falhou/
      ficha.ts              parte PÚBLICA (ficha, documentos, hipóteses, opções, tutorial, dicas)
      verdade.ts            estado REAL da peça (só o motor lê)
      gabarito.ts           chave de avaliação e devolutiva (só a avaliação lê)
  motor/                    regras dos ensaios — funções puras, sem DOM
    geometria.ts            junta em V, zonas, borda da fratura, cortes
    inspecao.ts             modelo de aquisição da inspeção visual
    metalografia.ts         corte, preparação, artefatos, micrografias
    microdureza.ts          modelo de medição Vickers e limitações
    recursos.ts             custos e consumo de orçamento/tempo
    estado.ts               ações da partida (estado → novo estado)
    persistencia.ts         salvamento no navegador
  avaliacao/avaliar.ts      avaliação das evidências e do relatório
  ui/                       interface React (renderização SVG/Canvas em ui/render)
tests/                      testes das regras
docs/                       modelo didático, caso 1 (com solução) e cadastro de casos
```

## Documentação

- [docs/MODELO-DIDATICO.md](docs/MODELO-DIDATICO.md) — camadas do modelo, simplificações, valores usados e **pontos para revisão docente**.
- [docs/CASO-JUNTA-QUE-FALHOU.md](docs/CASO-JUNTA-QUE-FALHOU.md) — **contém a solução** do caso 1 (para professores).
- [docs/NOVOS-CASOS.md](docs/NOVOS-CASOS.md) — como cadastrar novos casos.

## Testes

`npm test` executa 29 testes em quatro grupos:

- **recursos** — cobrança, bloqueio por falta de orçamento/tempo, irreversibilidade da limpeza agressiva e dos cortes.
- **consistência** — mesmas condições → mesmo resultado; faces A e B coerentes; dureza, microestrutura e fratura descrevem a mesma peça.
- **amostragem** — o local do corte decide se a trinca secundária aparece; preparação ruim compromete a microestrutura e gera
  artefatos; perfil profundo/espaçado perde o pico; espaçamento curto gera limitação; limpeza agressiva e corte antes de documentar apagam evidências.
- **avaliação** — investigação completa recebe nota alta; palpite certo sem dados vale pouco; "dados insuficientes" é aceito
  quando coerente; artefato interpretado como defeito, exagero sobre dureza e uso de dado comprometido são penalizados;
  economizar sem obter evidências não é premiado.

## Limitações conhecidas

- Um único caso e uma única família geométrica (junta de topo em V em chapa). Novos tipos de peça exigem um novo módulo de geometria.
- Imagens procedurais esquemáticas: servem para reconhecer padrões e distinguir artefatos, não para treinar o olho em micrografias reais.
- Custos, tempos e valores numéricos são de jogo (ver o documento do modelo).
- Registro de evidências e interpretação usam opções fechadas; o texto livre não é corrigido.
