// ZIP de teste: uma pasta com o HTML do jogo e um LEIA-ME curto, nada mais
// (sem .bat nem atalhos, que o antivírus costuma acusar por engano).
//   npm run pacote:teste   →   download/Oficina-de-Materiais-teste.zip
// Escreve o ZIP com o zlib do Node: funciona igual no Windows, Linux e macOS.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'
import { LEIA_ME } from './leia-me.mjs'

const pasta = 'Oficina de Materiais'
const arquivos = [
  [`${pasta}/Oficina de Materiais.html`, readFileSync(join('portatil', 'Oficina de Materiais v2.3', 'Oficina de Materiais.html'))],
  [`${pasta}/LEIA-ME.txt`, Buffer.from(LEIA_ME, 'utf8')],
]

// Data fixa (1/1/2026 00:00): o mesmo jogo dá o mesmo ZIP, byte a byte.
const HORA = 0, DATA = ((2026 - 1980) << 9) | (1 << 5) | 1
const locais = [], central = []
let deslocamento = 0
for (const [nome, dados] of arquivos) {
  const n = Buffer.from(nome, 'utf8')
  const comp = deflateRawSync(dados, { level: 9 })
  const crc = crc32(dados)
  const cab = Buffer.alloc(30)
  cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(0x0800, 6) // UTF-8
  cab.writeUInt16LE(8, 8); cab.writeUInt16LE(HORA, 10); cab.writeUInt16LE(DATA, 12)
  cab.writeUInt32LE(crc, 14); cab.writeUInt32LE(comp.length, 18); cab.writeUInt32LE(dados.length, 22)
  cab.writeUInt16LE(n.length, 26); cab.writeUInt16LE(0, 28)
  locais.push(cab, n, comp)
  const c = Buffer.alloc(46)
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8)
  c.writeUInt16LE(8, 10); c.writeUInt16LE(HORA, 12); c.writeUInt16LE(DATA, 14)
  c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(dados.length, 24)
  c.writeUInt16LE(n.length, 28); c.writeUInt32LE(deslocamento, 42)
  central.push(c, n)
  deslocamento += cab.length + n.length + comp.length
}
const tamCentral = central.reduce((s, b) => s + b.length, 0)
const fim = Buffer.alloc(22)
fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10)
fim.writeUInt32LE(tamCentral, 12); fim.writeUInt32LE(deslocamento, 16)

mkdirSync('download', { recursive: true })
const zip = Buffer.concat([...locais, ...central, fim])
const destino = join('download', 'Oficina-de-Materiais-teste.zip')
writeFileSync(destino, zip)
console.log(`${destino}: ${(zip.length / 1e6).toFixed(2)} MB`)
