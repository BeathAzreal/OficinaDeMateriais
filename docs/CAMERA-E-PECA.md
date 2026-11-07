# Câmera, peça e suporte — Alpha v1.4

A câmera tem azimute de −90° a +90° e elevação de 0° a 180°, com batentes. A peça gira apenas em X; a orientação inicial em Y é preservada. A peça continua imóvel durante o arco aberto e nas montagens definidas como fixas.

A fixação é uma articulação didática na orelha lateral. Seu ponto permanece na garra; a câmera não acompanha a rotação. A mira usa a matriz real da peça e sua inversa para compensar o pivô lateral.

O movimento testa passos de até 1° contra caixas da coluna, garra e base. As chapas usam caixas orientadas. É uma colisão conservadora: pode parar antes da superfície real, não representa atrito ou aperto mecânico. Sem WebGL, o fallback 2D não aplica colisões 3D. Em vista rasante, reposicione a câmera para soldar.

Validação automatizada cobre câmera, projeção inversa, colisão e permanência da orelha na fixação. Conferência interativa completa de todos os menus e dispositivos ainda pendente.
