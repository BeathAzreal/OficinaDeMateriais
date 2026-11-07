import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {OFICINA_ONLINE} from '../src/rede/convite.ts'

/** Atalho HTML sem servidor local; o link continua disponível sem JavaScript. */
export function gravarAtalhoOnline(pasta){
 const endereco=OFICINA_ONLINE+'/?rede=1'
 writeFileSync(join(pasta,'JOGAR ONLINE.html'),`<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${endereco}">
<title>Abrir Oficina de Solda online</title>
<style>body{max-width:640px;margin:12vh auto;padding:24px;background:#101315;color:#f4efdf;font:18px/1.6 Arial,sans-serif}a{display:block;padding:16px;background:#b52c29;color:white;text-align:center;border-radius:6px}a:focus-visible{outline:3px solid white;outline-offset:4px}</style>
<h1>Oficina de Solda online</h1>
<p>Abrindo a oficina no navegador. É necessário ter conexão com a internet.</p>
<a href="${endereco}">Abrir o jogo online</a>
<p>Este atalho não inicia Node.js nem servidor neste computador. Para treinar sem internet, abra <strong>Oficina de Soldagem.html</strong> na pasta principal do pacote.</p>
</html>
`,'utf8')
}
