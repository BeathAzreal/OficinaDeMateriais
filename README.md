# Oficina de Materiais

**[⬇ Baixar para testar (ZIP, 2,6 MB)](https://github.com/BeathAzreal/OficinaDeMateriais/raw/main/download/Oficina-de-Materiais-teste.zip)**

Extraia o ZIP e abra **Oficina de Materiais.html** no Chrome ou Edge. Não
precisa instalar nada nem ter internet. No celular, abra o mesmo arquivo no
Chrome, na horizontal.

Jogo didático de fabricação e materiais: uma fábrica com **Soldagem**,
**Usinagem**, **Laboratório de Falhas** e **Manufatura Aditiva**, ligados por
ordens de serviço. Novo na Alpha v2.3 (teste): o **Laudo térmico (MFL)** no
resultado do MIG/MAG, com as fórmulas escritas na linguagem
[MFL](https://github.com/BeathAzreal/MFLanguage).

Continuação da *Oficina de Soldagem*
([SoldamatGamification](https://github.com/BeathAzreal/SoldamatGamification)).
Modelo didático: os números não servem como receita de soldagem ou de usinagem.

## Desenvolvimento

```bash
npm ci
npm run dev
npm test
npm run pacote:teste   # gera download/Oficina-de-Materiais-teste.zip
```

Documentação em [`docs/`](docs/): [MFL no jogo](docs/MFL.md),
[fábrica](docs/FABRICA.md), [hipóteses](docs/HIPOTESES.md).
