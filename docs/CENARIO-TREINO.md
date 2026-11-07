# Oficina do treino

Hipóteses desta etapa: cenografia estática, sem influência no modelo, pontuação, gravidade ou colisão do suporte. A bancada fica atrás da chapa, fora do seu volume de rotação; a fonte de soldagem fica à direita em carrinho com cilindro e cabos. A estação articulada existente continua segurando a peça. Não representa um projeto dimensional de oficina nem instrução de instalação.

O módulo `src/render/oficinaTreino.ts` gera a cenografia com primitivas Three.js, sem dependências, imagens externas ou animações adicionais. Usa a iluminação existente e materiais de baixo contraste. O palco inclui esse módulo somente na preparação e execução do treino. A inspeção permanece independente enquanto sua orientação e seus controles são ajustados em paralelo.

O cenário não adiciona objetos sobre a junta, altera a câmera ou amplia a área de interação da peça. O jogador mantém os controles atuais de aproximação e rotação da vista.
