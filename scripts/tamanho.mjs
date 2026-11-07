// Tamanho do HTML portátil e das partes embutidas (relatório em Markdown).
//   npm run portatil && node scripts/tamanho.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const pasta = join('portatil', readdirSync('portatil')[0])
const html = readFileSync(join(pasta, 'Oficina de Materiais.html'), 'utf8')
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`
const partes = new Map()
for (const m of html.matchAll(/data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)/g)) {
  partes.set(m[1], (partes.get(m[1]) ?? 0) + m[2].length)
}
const embutido = [...partes.values()].reduce((a, b) => a + b, 0)
console.log('| Parte do HTML portátil | Tamanho |\n|---|---|')
console.log(`| **total** | **${mb(Buffer.byteLength(html))}** |`)
for (const [tipo, n] of [...partes].sort((a, b) => b[1] - a[1])) console.log(`| embutido: ${tipo} (base64) | ${mb(n)} |`)
console.log(`| código, estilos e textos | ${mb(Buffer.byteLength(html) - embutido)} |`)
