// Gera um único HTML offline do protótipo, na branch v2.2.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gravarAtalhoOnline } from './atalho-online.mjs'
import { LEIA_ME } from './leia-me.mjs'
const saida = join('portatil', 'Oficina de Materiais v2.3')
let html = readFileSync('dist/index.html', 'utf8')
html = html.replace(/<link rel="stylesheet"[^>]*href="\/?([^"]+)"[^>]*>/g, (_, arquivo) => `<style>${readFileSync(join('dist', arquivo), 'utf8')}</style>`)
html = html.replace(/<script type="module"[^>]*src="\/?([^"]+)"[^>]*><\/script>/g, (_, arquivo) => `<script type="module">${readFileSync(join('dist', arquivo), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`)
if (/(?:src|href)="\/?assets\//.test(html)) throw new Error('Referência externa no portátil')
mkdirSync(saida, { recursive: true })
writeFileSync(join(saida, 'Oficina de Materiais.html'), html)
writeFileSync(join(saida, 'Abrir o jogo.bat'), '@echo off\r\nstart "" "%~dp0Oficina de Materiais.html"\r\n')
writeFileSync(join(saida, 'LEIA-ME.txt'), LEIA_ME)
gravarAtalhoOnline(saida)
console.log(`Protótipo offline e atalho online gerados em ${saida}`)
