# Interface Alpha v1.4 — laboratório industrial

Base: Alpha v1.3 aprovada, commit f71666932319377a35ff4197faf36dcdbbeefd67.
Trabalho do GPT em gpt/v1.4; integração por PR em alpha-v1.4.

## Direção escolhida

Grafite, aço e laranja, tipografia legível e números em monoespaçada.
A navegação fica numa lateral persistente; na execução ela se reduz a
ícones para liberar a área da peça. Os botões conservam nomes acessíveis,
dica ao passar o mouse e indicação da seção atual.

O início reúne atividades, acesso direto ao treino e ao Arcade, retomada
de torneio e contadores reais dos dados desta estação. Missões correspondem
ao modo História existente. Os atalhos 1–6 continuam disponíveis no início;
não interceptam campos de formulário nem diálogos.

## Abrangência desta entrega

- Novo início e navegação comum.
- Cabeçalho e identificação da versão.
- Linguagem visual para missões, treino, bancada, controles, execução,
  resultados, recordes, torneios, formulários e diálogos.
- Estados de seleção e foco, redução de movimento e adaptação para notebook.
- Camada de estilos em src/estilo-v14.css, carregada após os estilos existentes.
- Física, pontuação, registros e controles de entrada preservados.

Não há fontes remotas nem bibliotecas novas. Os dados mantêm as chaves da
versão anterior; ao copiar o HTML para outra pasta, o navegador pode tratar
o arquivo como outra origem. O portátil e o ZIP foram gerados para permitir o teste visual pelo dono.

## Próximo processo

Eletrodo revestido aparece como planejado, com explicação ao abrir.
Não há seleção capaz de iniciar MIG/MAG sob o nome de eletrodo.

A etapa posterior precisará definir e implementar um modelo próprio,
consumíveis, regulagens, operação, avaliação e missões antes de liberar
essa opção. A arquitetura atual de MIG/MAG não foi generalizada sem isso.

## Validação

TypeScript, 305 testes em 24 arquivos e build de produção aprovados.
O navegador integrado não conseguiu acessar o servidor local (timeout).
A revisão visual e de interação em 1280×720 e 1366×768 permanece pendente,
incluindo zoom, formulários, navegação durante tentativa oficial, câmera
e os três dispositivos. O PR inclui um pacote de teste; a revisão visual permanece pendente.
