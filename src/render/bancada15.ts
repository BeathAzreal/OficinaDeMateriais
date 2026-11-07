import { DepositoEletrodo, baseEletrodo } from '../modelo/depositoEletrodo'
import { criarMetalEletrodo } from './metalEletrodo'
import type { PecaEletrodo } from '../missoes/pecasEletrodo'
import { limitesPecaEletrodo } from '../missoes/pecasEletrodo'
import { criarDetalhesIndustriais15 } from './pecaIndustrial15'
import * as THREE from 'three'
import { Palco3D } from './palco3d'
import { criarMar } from './mar15'
import { curvarPonto, desdobrarPonto } from './curvaTubo'
import { geometriaDa } from '../modelo/junta'
import { CONTEXTO_PADRAO, type ContextoProcesso } from '../modelo/processo'
import type { Cordao } from '../modelo/cordao'
import type { Acionamento15 } from '../modelo/acionamento15'
import type { ModeloTig } from '../modelo/tig'
import { BRASAGEM, FLUXOS, ModeloBrasagem, type ChamaId } from '../modelo/brasagem'
import { criarSuperficieEscoria15 } from './escoriaSuperficie15'
import { girarFerramenta15, type Vetor15 } from '../entrada/giroFerramenta15'
import type { FerramentaBancada15 } from '../modelo/escoria15'
import { cristaMm, GIRO_INICIAL_TUBO_GRAUS, INFO_JUNTA, juntaDe, pontoNaSuperficie, type TipoJunta } from '../modelo/juntas'
import type { AnaliseDefeitos } from '../modelo/defeitos'

/** Ponta nua da vareta presa nas garras do alicate (mm). */
const PONTA_NUA = 20
const MAX_RESPINGOS = 160
const GRAVIDADE = 9810

/** Brilho radial para o arco e a poça (textura pequena gerada em código: o jogo segue offline). */
function texturaBrilho(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.25, 'rgba(210,235,255,0.75)')
  r.addColorStop(1, 'rgba(120,170,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** Vista do protótipo: porta-eletrodo e vareta em escala de mm, câmera independente. */
export function criarBancada15(peca?: { junta: TipoJunta; espessuraMm: number; aberturaMm: number; inicioMm: number; fimMm: number; larguraMm?: number; conjunto?: 'grade'; tubo?: { diametroMm: number } }, op: { tig?: boolean; material?: ContextoProcesso['material']; subaquatico?: { turbidez: number; estrutura: 'cais' | 'casco' | 'plataforma' } } = {}) {
  // A peça chega na posição plana (rolagem 0): no filete, o canto fica voltado para cima.
  // H103: a emenda de tubos curva o desenho; o modelo do eletrodo e do TIG continua na junta desenrolada.
  const contexto = peca ? { ...CONTEXTO_PADRAO, junta: peca.junta, espessuraMm: peca.espessuraMm, aberturaMm: peca.aberturaMm, ...(op.material ? { material: op.material } : {}), ...(peca.tubo ? { tubo: peca.tubo, posicaoInicial: { rolagemGraus: 0, giroGraus: GIRO_INICIAL_TUBO_GRAUS } } : {}) } : CONTEXTO_PADRAO
  // TIG: chapa limpa e cordão brilhante (o acabamento do MIG), sem a crosta do eletrodo.
  const palco = Palco3D.criar({
    larguraPecaMm: peca?.larguraMm, processo: op.tig ? 'mig' : 'eletrodo', contexto, geometria: geometriaDa('reta'), oficinaTreino: true, sombras: true, pixelRatioMax: 1.5,
    missao: peca ? { inicioMm: peca.inicioMm, fimMm: peca.fimMm } : undefined, regua: !!peca && !peca.larguraMm,
    subaquatico: op.subaquatico,
  })
  if (!palco) return null
  const canvas = palco.elemento
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', 'Bancada 3D: selecione soldagem, martelinho ou escova. W sobe e afasta, S desce e aproxima.')
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 4000)
  // Filete na posição plana: câmera mais alta para enxergar as duas paredes e a raiz no fundo do V.
  const filete = !!peca && INFO_JUNTA[peca.junta].familia === 'filete'
  const AZIMUTE0 = 0.237, POLAR0 = filete ? 0.62 : 1.077, ZOOM0 = filete ? 0.75 : 1, ALVO_Y = filete ? 12 : 40
  let azimute = AZIMUTE0, polar = POLAR0, zoom = ZOOM0, alvoY = ALVO_Y
  const posicionarCamera = () => {
    const d = 338 * Math.max(1, 1 / camera.aspect) * zoom
    camera.position.setFromSphericalCoords(d, polar, azimute).add(new THREE.Vector3(0, alvoY, 0))
    camera.position.y = Math.max(-350, camera.position.y)
    camera.lookAt(0, alvoY, 0)
    camera.updateMatrixWorld()
  }
  const enquadrar = (l: number, a: number) => {
    palco.ajustarTamanho(l, a)
    camera.aspect = l / a
    posicionarCamera()
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }
  const Y = new THREE.Vector3(0, 1, 0)
  const ferramenta = new THREE.Group()
  const eletrodo = new THREE.Group()
  const mig = new THREE.Group()
  ferramenta.add(eletrodo, mig)
  palco.peca.add(palco.ancorar(ferramenta))
  const metal = new THREE.MeshStandardMaterial({ color: '#b5b9bd', metalness: 0.85, roughness: 0.4 })
  const revestimento = new THREE.MeshStandardMaterial({ color: '#b39a74', roughness: 0.95 })
  const isolante = new THREE.MeshStandardMaterial({ color: '#283842', roughness: 0.8 })
  const cobre = new THREE.MeshStandardMaterial({ color: '#b78552', metalness: 0.85, roughness: 0.35 })
  const borracha = new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.9 })
  const vermelho = new THREE.MeshStandardMaterial({ color: '#9a2a22', roughness: 0.6 })
  const cilindro = (grupo: THREE.Object3D, raio: number, altura: number, y: number, mat: THREE.Material, lados = 16) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(raio, raio, altura, lados), mat)
    m.position.y = y
    m.castShadow = true
    grupo.add(m)
    return m
  }
  /** Cilindro de comprimento `comprimento` saindo de `inicio` na direção `dir` (eixos locais do grupo). */
  const haste = (grupo: THREE.Object3D, raio: number, comprimento: number, inicio: THREE.Vector3, dir: THREE.Vector3, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(raio, raio, comprimento, 18), mat)
    m.quaternion.setFromUnitVectors(Y, dir)
    m.position.copy(inicio).addScaledVector(dir, comprimento / 2)
    m.castShadow = true
    grupo.add(m)
    return m
  }
  // Vareta: alma metálica com revestimento até a ponta; o topo fica nu para as garras (H61).
  const alma = cilindro(eletrodo, 1, 1, 0, metal, 10)
  const capa = cilindro(eletrodo, 1, 1, 0, revestimento, 14)
  const brasaMat = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0 })
  const brasa = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), brasaMat)
  eletrodo.add(brasa)
  // Alicate porta-eletrodo: garras na ponta nua e cabo inclinado. Girar o punho (rolamento) move o cabo.
  const alicate = new THREE.Group()
  eletrodo.add(alicate)
  const garraA = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 10), cobre)
  garraA.position.set(-3.6, 0, 0)
  const garraB = garraA.clone()
  garraB.position.x = 3.6
  alicate.add(garraA, garraB)
  const dirCabo = new THREE.Vector3(0.82, 0.57, 0).normalize()
  const inicioCabo = new THREE.Vector3(3, 6, 0)
  const pescoco = haste(alicate, 4, 14, inicioCabo, dirCabo, cobre)
  const protetor = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 3, 24), vermelho)
  protetor.quaternion.setFromUnitVectors(Y, dirCabo)
  protetor.position.copy(inicioCabo).addScaledVector(dirCabo, 14)
  alicate.add(protetor)
  const empunhadura = haste(alicate, 7, 72, inicioCabo.clone().addScaledVector(dirCabo, 15.5), dirCabo, borracha)
  const caboEletrico = haste(alicate, 3.2, 90, inicioCabo.clone().addScaledVector(dirCabo, 87), dirCabo, borracha)
  void pescoco; void empunhadura; void caboEletrico
  const bocal = cilindro(mig, 5, 16, 8, cobre)
  const punho = cilindro(mig, 7, 28, 30, isolante)
  const arame = cilindro(mig, 0.45, 1, 0, metal)
  // TIG (H92): tocha com bocal cerâmico e tungstênio aparente; a vareta de adição fica na outra mão.
  const tig = new THREE.Group()
  ferramenta.add(tig)
  tig.visible = false
  const tungstenioMat = new THREE.MeshStandardMaterial({ color: '#8d9399', metalness: 0.9, roughness: 0.3 })
  const ceramica = new THREE.MeshStandardMaterial({ color: '#d98b78', roughness: 0.9 })
  const tungstenio = cilindro(tig, 0.8, 12, 6, tungstenioMat, 10)
  const pontaTungstenio = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 10), tungstenioMat)
  pontaTungstenio.rotation.x = Math.PI
  pontaTungstenio.position.y = -0.8
  tig.add(pontaTungstenio)
  const bocalTig = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 4.2, 14, 20, 1, true), ceramica)
  bocalTig.material.side = THREE.DoubleSide
  bocalTig.position.y = 11
  tig.add(bocalTig)
  cilindro(tig, 7, 22, 29, isolante)
  const tampa = cilindro(tig, 3.2, 26, 50, borracha)
  const empunhaduraTig = haste(tig, 6, 70, new THREE.Vector3(0, 26, 0), new THREE.Vector3(0.9, 0.42, 0).normalize(), borracha)
  void tungstenio; void tampa; void empunhaduraTig
  const varetaTig = new THREE.Group()
  palco.peca.add(palco.ancorar(varetaTig))
  varetaTig.visible = false
  const varetaMat = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.9, roughness: 0.25 })
  const corpoVareta = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), varetaMat)
  corpoVareta.castShadow = true
  varetaTig.add(corpoVareta)
  const pontaVaretaMat = new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, opacity: 0 })
  const pontaVaretaMalha = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), pontaVaretaMat)
  varetaTig.add(pontaVaretaMalha)
  const dirVareta = new THREE.Vector3()
  const madeira = new THREE.MeshStandardMaterial({ color: '#996d3f', roughness: 0.85 })
  const martelo = new THREE.Group(), escova = new THREE.Group()
  palco.peca.add(palco.ancorar(martelo), palco.ancorar(escova))
  cilindro(martelo, 2.5, 46, 27, madeira)
  const cabeca = new THREE.Mesh(new THREE.BoxGeometry(23, 7, 8), metal)
  martelo.add(cabeca)
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(4, 11, 4), metal)
  ponta.rotation.z = Math.PI / 2
  ponta.position.x = -15
  martelo.add(ponta)
  const caboEscova = new THREE.Mesh(new THREE.BoxGeometry(36, 7, 14), madeira)
  caboEscova.position.y = 10
  escova.add(caboEscova)
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) {
    const cerda = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), metal)
    cerda.position.set(-14 + i * 3.5, 3.5, -4.5 + j * 3)
    escova.add(cerda)
  }
  // Arco: coluna luminosa da ponta à poça, halo voltado para a câmera, poça e luz que tremulam.
  const aditivo = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const
  const coluna = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.6, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#d9f0ff', opacity: 0.9, ...aditivo }))
  palco.peca.add(palco.ancorar(coluna))
  const textura = texturaBrilho()
  palco.guardarTexturas(textura)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textura, color: '#cfe6ff', opacity: 0.95, ...aditivo }))
  palco.peca.add(palco.ancorar(halo))
  const poca = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: '#ffd38a', toneMapped: false }))
  palco.peca.add(palco.ancorar(poca))
  const luz = new THREE.PointLight('#c9eaff', 0, 160, 2)
  palco.peca.add(palco.ancorar(luz))
  // Respingos: gotas balísticas que caem pela gravidade e se apagam ao esfriar.
  const posRespingo = new Float32Array(MAX_RESPINGOS * 3)
  const corRespingo = new Float32Array(MAX_RESPINGOS * 3)
  const velRespingo = new Float32Array(MAX_RESPINGOS * 3)
  const vidaRespingo = new Float32Array(MAX_RESPINGOS)
  const geoRespingo = new THREE.BufferGeometry()
  geoRespingo.setAttribute('position', new THREE.BufferAttribute(posRespingo, 3))
  geoRespingo.setAttribute('color', new THREE.BufferAttribute(corRespingo, 3))
  const respingos = new THREE.Points(geoRespingo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: true, ...aditivo }))
  respingos.frustumCulled = false
  palco.peca.add(respingos)
  let proximoRespingo = 0, acumulado = 0
  const raio = new THREE.Raycaster()
  const ponto = new THREE.Vector3()
  const limitesX = limitesPecaEletrodo(peca ?? {})
  const junta = juntaDe(contexto)
  /** Altura da superfície das chapas a um desvio lateral n (filete na posição plana: paredes a 45°). */
  const superficie = (n: number) => peca ? baseEletrodo(peca as PecaEletrodo,n) : pontoNaSuperficie(junta, contexto, n)[1]
  /** Até onde vão as chapas de cada lado da junta (no filete, 50 mm de parede a 45°). */
  const alcanceLateral = INFO_JUNTA[junta].familia === 'filete' ? 50 / Math.SQRT2 : 50
  const escoria = criarSuperficieEscoria15(superficie, junta)
  palco.peca.add(escoria.malha)
  palco.curvarTambem(escoria.malha)
  palco.guardarTexturas(escoria.textura, escoria.crosta)
  if (peca && !peca.tubo) palco.peca.add(criarDetalhesIndustriais15(junta, peca.conjunto))
  const eixo = new THREE.Vector3(), normal = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion()
  const pontaMartelo = new THREE.Vector3()
  const cameraLocal = new THREE.Vector3()
  let volumeAntes = -1
  let cordaoAntes: Cordao | DepositoEletrodo | null = null
  const metalLocal = criarMetalEletrodo()
  palco.peca.add(metalLocal.malha)
  palco.curvarTambem(metalLocal.malha)
  const lascas = new THREE.Group()
  palco.peca.add(lascas)
  const particulasEscoria: { malha: THREE.Mesh; velocidade: THREE.Vector3; vida: number }[] = []
  for (let i = 0; i < 24; i++) {
    const malha = new THREE.Mesh(new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial({ color: '#373632', roughness: 0.88 }))
    malha.visible = false; lascas.add(malha)
    particulasEscoria.push({ malha, velocidade: new THREE.Vector3(), vida: 0 })
  }
  let calorPonta = 0
  // H110: no mar, a lanterna do mergulhador, as bolhas do arco e a neve marinha.
  const mar = op.subaquatico ? criarMar(palco, camera, textura, op.subaquatico.turbidez) : null

  // ------------------------------------------------------------ brasagem (H105)
  // Maçarico oxiacetilênico: corpo de latão, pescoço e bico de cobre; a chama sai do bico para baixo.
  const macarico = new THREE.Group()
  ferramenta.add(macarico)
  macarico.visible = false
  const latao = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.35 })
  const bicoMalha = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 14, 16), cobre)
  bicoMalha.position.y = 7
  macarico.add(bicoMalha)
  // Pescoço curvo e corpo para o lado e para cima (como a tocha do TIG), finos para não tampar a peça.
  const dirPescoco = new THREE.Vector3(0.35, 0.94, 0).normalize(), dirCorpo = new THREE.Vector3(0.9, 0.42, -0.1).normalize()
  const pescocoMacarico = haste(macarico, 1.8, 36, new THREE.Vector3(0, 14, 0), dirPescoco, cobre)
  const inicioCorpo = new THREE.Vector3(0, 14, 0).addScaledVector(dirPescoco, 36)
  const corpoMacarico = haste(macarico, 3.6, 60, inicioCorpo, dirCorpo, latao)
  const registroO2 = cilindro(macarico, 3, 4, 0, vermelho)
  registroO2.position.copy(inicioCorpo).addScaledVector(dirCorpo, 10).add(new THREE.Vector3(0, 4, 0))
  registroO2.rotation.x = Math.PI / 2
  void pescocoMacarico; void corpoMacarico
  // Chama: dardo (cone interno brilhante), pena do acetileno (só na carburante) e envoltório azulado.
  const aditivoChama = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const
  const dardo = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#e6f2ff', opacity: 0.95, ...aditivoChama }))
  const pena = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#fff4dc', opacity: 0.5, ...aditivoChama }))
  const envoltorio = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#2f6bff', opacity: 0.35, ...aditivoChama }))
  for (const c of [dardo, pena, envoltorio]) { c.rotation.x = Math.PI; macarico.add(c) }
  const manchaChama = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textura, color: '#ffb070', opacity: 0.6, ...aditivoChama }))
  palco.peca.add(palco.ancorar(manchaChama))
  manchaChama.visible = false
  const COR_CHAMA: Record<ChamaId, { envoltorio: string; pena: number; dardo: number }> = {
    neutra: { envoltorio: '#2f6bff', pena: 0, dardo: 1 },
    oxidante: { envoltorio: '#5a48ff', pena: 0, dardo: 0.7 },
    carburante: { envoltorio: '#ff9a3a', pena: 1, dardo: 1 },
  }
  // Brilho da peça pela temperatura (incandescência) e o fluxo por cima, na mesma grade do modelo.
  const G = ModeloBrasagem.grade
  const nVert = G.NX * G.NY
  const geoBrasa = new THREE.BufferGeometry()
  const posBrasa = new Float32Array(nVert * 3)
  for (let j = 0; j < G.NY; j++) for (let i = 0; i < G.NX; i++) {
    const k = j * G.NX + i, y = G.Y0 + (j + 0.5) * G.DY
    posBrasa[3 * k] = (i + 0.5) * G.DX - 75
    posBrasa[3 * k + 1] = superficie(y) + 0.06
    posBrasa[3 * k + 2] = y
  }
  const indices: number[] = []
  for (let j = 0; j + 1 < G.NY; j++) for (let i = 0; i + 1 < G.NX; i++) {
    const a = j * G.NX + i
    indices.push(a, a + G.NX, a + 1, a + 1, a + G.NX, a + G.NX + 1)
  }
  geoBrasa.setAttribute('position', new THREE.BufferAttribute(posBrasa, 3))
  geoBrasa.setIndex(indices)
  const geoFluxo = geoBrasa.clone()
  const corBrasa = new Float32Array(nVert * 3)
  const corFluxo = new Float32Array(nVert * 4)
  geoBrasa.setAttribute('color', new THREE.BufferAttribute(corBrasa, 3))
  geoFluxo.setAttribute('color', new THREE.BufferAttribute(corFluxo, 4))
  const brilhoPeca = new THREE.Mesh(geoBrasa, new THREE.MeshBasicMaterial({ vertexColors: true, ...aditivoChama, side: THREE.DoubleSide }))
  const camadaFluxo = new THREE.Mesh(geoFluxo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
  camadaFluxo.position.y = 0.03
  for (const m of [camadaFluxo, brilhoPeca]) { m.visible = false; m.frustumCulled = false; palco.peca.add(m); palco.curvarTambem(m) }
  /** Cor da incandescência do aço e do cobre (°C → cor somada à peça): vermelho escuro, cereja, laranja, amarelo. */
  const PONTOS_COR: [number, number, number, number][] = [
    [480, 0, 0, 0], [580, 0.16, 0.01, 0], [680, 0.42, 0.04, 0.01], [760, 0.75, 0.1, 0.02],
    [850, 1, 0.24, 0.04], [950, 1, 0.48, 0.1], [1050, 1, 0.72, 0.28], [1200, 1, 0.92, 0.65],
  ]
  const corIncandescente = (t: number, saida: Float32Array, k: number) => {
    if (t <= PONTOS_COR[0][0]) { saida[3 * k] = saida[3 * k + 1] = saida[3 * k + 2] = 0; return }
    let n = PONTOS_COR.length - 1
    for (let q = 1; q < PONTOS_COR.length; q++) if (t < PONTOS_COR[q][0]) { n = q; break }
    const a = PONTOS_COR[n - 1], b = PONTOS_COR[n]
    const f = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])))
    for (let c = 0; c < 3; c++) saida[3 * k + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f
  }
  let brasaQuadro = 0

  return {
    canvas, enquadrar, superficie,
    /** H110: aponta a lanterna para um ponto da peça (mm, como o ponteiro). */
    apontarLanterna(x: number, y: number) { mar?.apontar(x - 75, superficie(y), y) },
    /** H110: liga ou desliga a lanterna. */
    ligarLanterna(ligada: boolean) { mar?.ligar(ligada) },
    get lanternaLigada() { return mar?.ligada ?? false },
    /** H103: a peça é uma emenda de tubos (o giro do tubo vale). */
    tubo: !!palco.curva,
    /** H103: gira o tubo no próprio eixo (radianos). */
    girarTubo(radianos: number) { palco.definirGiro(radianos) },
    zoomPercentual: () => Math.round(ZOOM0 / zoom * 100),
    soltarEscoria(x: number, y: number, removido: number) {
      if (removido <= 0) return
      const quantidade = Math.min(24, Math.max(4, Math.ceil(removido * 6)))
      for (let i = 0; i < quantidade; i++) {
        const p = particulasEscoria[i], a = i * 2.39996
        p.vida = 0.45 + (i % 4) * 0.08
        p.malha.position.set(x - 75, superficie(y) + 2, y)
        if (palco.curva) curvarPonto(palco.curva, x - 75, superficie(y) + 2, y, p.malha.position)
        p.malha.scale.set(1.2 + (i % 3) * 0.3, 0.25, 0.7)
        p.velocidade.set(Math.cos(a) * 24, 30 + (i % 5) * 7, Math.sin(a) * 24)
        p.malha.visible = true
      }
    },
    iniciarGiro(m: Acionamento15) {
      const inicial = { azimute: m.azimuteGraus, inclinacao: m.inclinacaoGraus }
      const direita = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray() as unknown as Vetor15
      const cima = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray() as unknown as Vetor15
      return (dx: number, dy: number, sensibilidade: number) => girarFerramenta15(inicial, direita, cima, dx, dy, sensibilidade)
    },
    orbitar(dx: number, dy: number) {
      azimute += dx * 0.006
      polar = Math.max(0.04, Math.min(Math.PI - 0.04, polar + dy * 0.006))
      posicionarCamera()
    },
    aproximar(delta: number) { zoom = Math.max(0.5, Math.min(3, zoom * Math.exp(delta * 0.001))); posicionarCamera() },
    verEstacao() { alvoY = -140; zoom = 3; polar = 0.85; azimute = AZIMUTE0; posicionarCamera() },
    centralizar() { alvoY = ALVO_Y; azimute = AZIMUTE0; polar = POLAR0; zoom = ZOOM0; posicionarCamera() },
    pontoNaTela(x: number, y: number) {
      const r = canvas.getBoundingClientRect()
      raio.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, 1 - ((y - r.top) / r.height) * 2), camera)
      // Anda pelo raio até cruzar a superfície das chapas e refina por bissecção.
      const o = raio.ray.origin, d = raio.ray.direction
      const curva = palco.curva
      const acima = (t: number) => {
        let x = o.x + d.x * t, y = o.y + d.y * t, n = o.z + d.z * t
        // H103: no tubo, o ponto do raio volta para a junta desenrolada antes da comparação.
        if (curva) ({ x, y, z: n } = desdobrarPonto(curva, x, y, n))
        return y > (cordaoAntes instanceof DepositoEletrodo ? cordaoAntes.altura(x+75,n) : superficie(n))
      }
      let t0 = 0, t1 = -1
      for (let t = 0; t < 3000; t += 2) {
        if (!acima(t)) { t1 = t; break }
        t0 = t
      }
      if (t1 < 0) return null
      for (let i = 0; i < 30; i++) {
        const tm = (t0 + t1) / 2
        if (acima(tm)) t0 = tm
        else t1 = tm
      }
      raio.ray.at((t0 + t1) / 2, ponto)
      if (curva) { const q = desdobrarPonto(curva, ponto.x, ponto.y, ponto.z); ponto.set(q.x, q.y, q.z) }
      // A borda não é uma superfície de contato: continue seguindo a mão fora da peça.
      const p = { x: ponto.x + 75, y: ponto.z }
      return { ...p, naPeca: p.x >= limitesX.min && p.x <= limitesX.max && Math.abs(p.y) <= alcanceLateral }
    },
    desenhar(m: Acionamento15, p: { x: number; y: number }, c: Cordao | DepositoEletrodo, modo: FerramentaBancada15 = 'soldar', acionada = false, desdeGolpeMs = Infinity, agoraMs = 0, dt = 0, direcaoGolpe: 'lateral' | 'diagonal' | 'cima' = 'lateral', ocultarEscoria = false, inspecionando = false) {
      const ligado = modo === 'soldar' && m.estado === 'arco'
      ferramenta.visible = modo === 'soldar' && !inspecionando
      martelo.visible = modo === 'martelo' && m.naPeca && !inspecionando
      escova.visible = modo === 'escova' && m.naPeca && !inspecionando
      // Alturas absolutas (acima da raiz): chão sob a ponta e crista do cordão, se houver.
      const chao = c instanceof DepositoEletrodo ? c.altura(p.x,p.y) : superficie(p.y)
      let topo = chao
      if (!(c instanceof DepositoEletrodo)) for (const cord of [c, ...c.soltos]) {
        const s = cord.secao(cord.indiceEm(p.x))
        if (s.larguraMm > 0 && Math.abs(s.yCentroMm - p.y) < Math.max(3, s.larguraMm / 2)) topo = Math.max(topo, cristaMm(s, junta))
      }
      // Cabo de lado: a cabeça chega em arco lateral e a ponta toca a crosta.
      const golpe = desdeGolpeMs >= 0 && desdeGolpeMs < 260 ? Math.sin(Math.PI * desdeGolpeMs / 260) : 0
      const deCima = direcaoGolpe === 'cima', diagonal = direcaoGolpe === 'diagonal'
      martelo.rotation.set(diagonal ? 0.45 : 0, -0.6 + golpe * 0.22, (deCima ? 0 : diagonal ? 0.6 : 1.1) + golpe * 0.35)
      pontaMartelo.set(-20.5, 0, 0).applyEuler(martelo.rotation)
      martelo.position.set(p.x - 75 - (1 - golpe) * 10, topo + 0.8 + (1 - golpe) * (deCima ? 28 : diagonal ? 18 : 5), p.y + (1 - golpe) * 4).sub(pontaMartelo)
      escova.position.set(p.x - 75 + (acionada ? Math.sin(agoraMs * 0.04) * 1.5 : 0), topo + 0.5, p.y)
      escova.rotation.y = 0.2
      const altura = Math.max(0, m.distanciaMm)
      // O arco nasce no cordão já depositado (ou na chapa), nunca acima da ponta.
      const base = m.processo === 'eletrodo' ? Math.min(topo, chao + altura) : 0
      ferramenta.position.set(p.x - 75, chao + altura, p.y)
      const inc = m.inclinacaoGraus * Math.PI / 180, az = m.azimuteGraus * Math.PI / 180
      eixo.set(Math.sin(inc) * Math.cos(az), Math.cos(inc), Math.sin(inc) * Math.sin(az))
      ferramenta.quaternion.setFromUnitVectors(normal, eixo).multiply(q.setFromAxisAngle(normal, m.rolamentoGraus * Math.PI / 180))
      eletrodo.visible = m.processo === 'eletrodo'
      mig.visible = m.processo === 'mig'
      tig.visible = false
      varetaTig.visible = false
      const r = m.diametroMm / 2
      alma.scale.set(r, m.restanteMm, r)
      alma.position.y = m.restanteMm / 2
      const revestida = Math.max(0.5, m.restanteMm - PONTA_NUA)
      capa.scale.set(r * 1.65, revestida, r * 1.65)
      capa.position.y = revestida / 2 + 0.25
      alicate.position.y = m.restanteMm - PONTA_NUA / 2 + 2
      // Ponta incandescente: acende no arco e esfria devagar depois.
      calorPonta = ligado ? 1 : calorPonta * Math.exp(-dt / 1.2)
      brasa.scale.setScalar(r * 1.3)
      brasa.position.y = 0.2
      brasaMat.opacity = Math.min(1, calorPonta * 1.2)
      brasaMat.color.setRGB(1, 0.35 + 0.45 * calorPonta, 0.1 + 0.4 * calorPonta * calorPonta)
      brasa.visible = calorPonta > 0.02
      bocal.position.y = 8
      punho.position.y = 30
      arame.scale.y = Math.max(0.1, altura - 2)
      arame.position.y = -(altura - 2) / 2

      // Arco e poça.
      const tremor = 0.85 + 0.3 * Math.random()
      const instavel = ligado && m.processo === 'eletrodo' ? m.forma.instabilidade : 0
      const comprimento = m.processo === 'mig' ? 2 : Math.max(0.3, chao + altura - base)
      coluna.visible = halo.visible = poca.visible = ligado
      coluna.position.set(p.x - 75, base + comprimento / 2, p.y)
      coluna.scale.set(tremor * (1 + instavel * 0.6), comprimento, tremor * (1 + instavel * 0.6))
      palco.peca.worldToLocal(cameraLocal.copy(camera.position))
      halo.position.set(p.x - 75, base + comprimento * 0.4, p.y)
      halo.lookAt(cameraLocal)
      halo.scale.setScalar((16 + 6 * instavel) * tremor)
      const raioPoca = 1.3 + m.diametroMm * 0.55
      poca.position.set(p.x - 75, base + 0.2, p.y)
      poca.scale.set(raioPoca, 0.6, raioPoca)
      luz.position.set(p.x - 75, base + 6, p.y)
      luz.intensity = ligado ? 700 * tremor : 0
      if (mar) {
        // Na água o arco fica verde-azulado e a luz se espalha num halo maior, mas não vai longe.
        ;(halo.material as THREE.MeshBasicMaterial).color.set('#9fffe6')
        halo.scale.multiplyScalar(1.8)
        luz.color.set('#bff7ff')
        luz.distance = 260
        luz.intensity = ligado ? 1100 * tremor : 0
        mar.atualizar(dt, ligado && !inspecionando, p.x - 75, base, p.y, agoraMs)
      }
      // Respingos: base pequena, muito mais com arco longo (H69).
      if (ligado && m.processo === 'eletrodo') acumulado += dt * (4 + 70 * instavel)
      while (acumulado >= 1) {
        acumulado -= 1
        const i = proximoRespingo
        proximoRespingo = (proximoRespingo + 1) % MAX_RESPINGOS
        const ang = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220
        if (palco.curva) posRespingo.set(curvarPonto(palco.curva, p.x - 75, base + 0.5, p.y).toArray(), i * 3)
        else posRespingo.set([p.x - 75, base + 0.5, p.y], i * 3)
        velRespingo.set([Math.cos(ang) * v, 120 + Math.random() * 260, Math.sin(ang) * v], i * 3)
        vidaRespingo[i] = 0.35 + Math.random() * 0.45
      }
      let vivos = false
      for (let i = 0; i < MAX_RESPINGOS; i++) {
        if (vidaRespingo[i] <= 0) { corRespingo.set([0, 0, 0], i * 3); continue }
        vivos = true
        vidaRespingo[i] -= dt
        velRespingo[i * 3 + 1] -= GRAVIDADE * 0.12 * dt
        for (let k = 0; k < 3; k++) posRespingo[i * 3 + k] += velRespingo[i * 3 + k] * dt
        if (posRespingo[i * 3 + 1] < 0.2) { posRespingo[i * 3 + 1] = 0.2; velRespingo.fill(0, i * 3, i * 3 + 3) }
        const t = Math.max(0, vidaRespingo[i]) / 0.8
        corRespingo.set([1, 0.35 + 0.5 * t, 0.08 + 0.3 * t * t], i * 3)
      }
      respingos.visible = vivos && !inspecionando
      geoRespingo.attributes.position.needsUpdate = true
      geoRespingo.attributes.color.needsUpdate = true
      if (c instanceof DepositoEletrodo) {
        metalLocal.atualizar(c)
        cordaoAntes = c
      } else if (c !== cordaoAntes || c.volumeTotal() !== volumeAntes) {
        metalLocal.malha.visible = false
        palco.atualizarCordao(c)
        cordaoAntes = c
        volumeAntes = c.volumeTotal()
      }
      lascas.visible = !inspecionando
      for (const p of particulasEscoria) {
        if (p.vida <= 0) { p.malha.visible = false; continue }
        p.vida -= dt
        p.velocidade.y -= 230 * dt
        p.malha.position.addScaledVector(p.velocidade, dt)
        p.malha.rotation.x += dt * 8; p.malha.rotation.z += dt * 5
      }
      escoria.atualizar(m.escoria, c)
      if (ocultarEscoria) escoria.malha.visible = false
      palco.desenhar(camera)
    },
    /**
     * TIG (H92): tocha, arco azulado, poça do tamanho calculado e vareta de adição
     * entrando pela frente da poça, a ~20° da chapa.
     */
    desenharTig(m: ModeloTig, c: Cordao, dt = 0, inspecionando = false) {
      const ligado = m.estado === 'arco'
      const chao = superficie(m.yMm)
      const topoMetal = (x: number, y: number) => {
        let topo = superficie(y)
        for (const cord of [c, ...c.soltos]) {
          const s = cord.secao(cord.indiceEm(x))
          if (s.larguraMm > 0 && Math.abs(s.yCentroMm - y) < Math.max(3, s.larguraMm / 2)) topo = Math.max(topo, cristaMm(s, junta))
        }
        return topo
      }
      const base = topoMetal(m.xMm, m.yMm)
      ferramenta.visible = !inspecionando
      eletrodo.visible = mig.visible = false
      tig.visible = true
      martelo.visible = escova.visible = false
      ferramenta.position.set(m.xMm - 75, base + Math.max(0, m.distanciaMm), m.yMm)
      const inc = m.inclinacaoGraus * Math.PI / 180, az = m.azimuteGraus * Math.PI / 180
      eixo.set(Math.sin(inc) * Math.cos(az), Math.cos(inc), Math.sin(inc) * Math.sin(az))
      ferramenta.quaternion.setFromUnitVectors(normal, eixo)
      // Vareta: da mão (atrás e acima, do lado oposto à tocha) até a ponta na frente da poça.
      const p = m.pontaVareta
      const pontaY = topoMetal(p.x, p.y) + Math.max(0, m.alturaVaretaMm) + m.peca.varetaMm / 2
      const comprimento = Math.min(140, 30 + m.varetaRestanteMm * 0.35)
      dirVareta.set(m.sentido * Math.cos(0.35), Math.sin(0.35), 0).normalize()
      const r = m.peca.varetaMm / 2
      corpoVareta.scale.set(r, comprimento, r)
      corpoVareta.quaternion.setFromUnitVectors(Y, dirVareta)
      corpoVareta.position.copy(dirVareta).multiplyScalar(comprimento / 2)
      varetaTig.position.set(p.x - 75, pontaY, p.y)
      varetaTig.visible = !inspecionando && m.varetaRestanteMm > 0
      const tocando = m.alturaVaretaMm <= 0.3 && ligado
      pontaVaretaMat.opacity = tocando ? 0.95 : Math.max(0, pontaVaretaMat.opacity - dt * 2)
      pontaVaretaMalha.scale.setScalar(r * 1.2)
      pontaVaretaMalha.visible = pontaVaretaMat.opacity > 0.02
      // Arco TIG: cone azulado curto e estável; contaminado, ele tremula e abre.
      const tremor = m.contaminado ? 0.7 + 0.6 * Math.random() : 0.95 + 0.1 * Math.random()
      const comprimentoArco = Math.max(0.3, m.distanciaMm)
      coluna.visible = halo.visible = ligado
      ;(coluna.material as THREE.MeshBasicMaterial).color.set(m.contaminado ? '#e9d6ff' : '#bcd8ff')
      coluna.position.set(m.xMm - 75, base + comprimentoArco / 2, m.yMm)
      coluna.scale.set(tremor * (0.6 + m.distanciaMm * 0.25), comprimentoArco, tremor * (0.6 + m.distanciaMm * 0.25))
      palco.peca.worldToLocal(cameraLocal.copy(camera.position))
      halo.position.set(m.xMm - 75, base + comprimentoArco * 0.4, m.yMm)
      halo.lookAt(cameraLocal)
      halo.scale.setScalar((6 + m.pedal * 10) * tremor)
      const raioPoca = m.raioPocaMm
      poca.visible = raioPoca > 0.2 && !inspecionando
      poca.position.set(m.xMm - 75 - m.sentido * raioPoca * 0.25, base + 0.15, m.yMm)
      poca.scale.set(Math.max(0.3, raioPoca), 0.35, Math.max(0.3, raioPoca * 0.9))
      ;(poca.material as THREE.MeshBasicMaterial).color.set(ligado ? '#ffe2a8' : '#ff9a4a')
      luz.position.set(m.xMm - 75, base + 6, m.yMm)
      luz.intensity = ligado ? (250 + 500 * m.pedal) * tremor : 0
      respingos.visible = false
      escoria.malha.visible = false
      lascas.visible = false
      void chao
      if (c !== cordaoAntes || c.volumeTotal() !== volumeAntes) {
        metalLocal.malha.visible = false
        palco.atualizarCordao(c)
        cordaoAntes = c
        volumeAntes = c.volumeTotal()
      }
      palco.desenhar(camera)
    },
    /**
     * Brasagem (H105): maçarico com a chama do tipo escolhido, a peça brilhando
     * pela temperatura, o fluxo (pasta branca, pó, vítreo, queimado), a vareta
     * na borda e a liga (filete) com a cor dela.
     */
    desenharBrasagem(m: ModeloBrasagem, c: Cordao, dt = 0, inspecionando = false) {
      const chao = superficie(m.yMm)
      eletrodo.visible = mig.visible = tig.visible = false
      martelo.visible = escova.visible = false
      macarico.visible = true
      ferramenta.visible = !inspecionando
      // Solto, o maçarico sobe e se afasta da peça (a chama continua acesa).
      const altura = m.naPeca ? m.distanciaMm : Math.max(m.distanciaMm, 45)
      ferramenta.position.set(m.xMm - 75, chao + altura, m.yMm)
      eixo.set(Math.sin(0.35), Math.cos(0.35), 0)
      ferramenta.quaternion.setFromUnitVectors(normal, eixo)
      const bico = m.bico, cor = COR_CHAMA[m.preparo.chama]
      const tremor = 0.94 + 0.12 * Math.random()
      const dardoMm = bico.dardoMm * (m.preparo.chama === 'oxidante' ? 0.7 : 1)
      dardo.scale.set(0.7 + bico.n * 0.15, dardoMm, 0.7 + bico.n * 0.15)
      dardo.position.y = -dardoMm / 2
      ;(dardo.material as THREE.MeshBasicMaterial).opacity = 0.95 * cor.dardo
      pena.visible = cor.pena > 0
      pena.scale.set(1.4 + bico.n * 0.2, dardoMm * 3, 1.4 + bico.n * 0.2)
      pena.position.y = -dardoMm * 1.5
      const comprimento = Math.min(altura + 6, 22 + 6 * bico.n) * tremor
      envoltorio.scale.set(2.5 + bico.n * 0.9, comprimento, 2.5 + bico.n * 0.9)
      envoltorio.position.y = -comprimento / 2
      ;(envoltorio.material as THREE.MeshBasicMaterial).color.set(cor.envoltorio)
      // Onde a chama bate na peça, ela se abre numa mancha.
      manchaChama.visible = m.naPeca && !inspecionando && m.potenciaW > 0
      palco.peca.worldToLocal(cameraLocal.copy(camera.position))
      manchaChama.position.set(m.xMm - 75, chao + 0.5, m.yMm)
      manchaChama.lookAt(cameraLocal)
      manchaChama.scale.setScalar(m.chama.sigmaMm * 3 * tremor)
      // Vareta da liga na borda da chapa de cima, vindo do outro lado da chama.
      const r = m.liga.varetaMm / 2
      const pontaY = superficie(0.25) + (m.encostarVareta ? r : r + 6)
      const comp = Math.min(140, 30 + m.varetaRestanteMm * 0.35)
      dirVareta.set(-Math.sign(m.xMm - m.varetaXMm || 1) * Math.cos(0.5), Math.sin(0.5), 0).normalize()
      corpoVareta.scale.set(r, comp, r)
      corpoVareta.quaternion.setFromUnitVectors(Y, dirVareta)
      corpoVareta.position.copy(dirVareta).multiplyScalar(comp / 2)
      varetaMat.color.set(m.liga.cor)
      varetaTig.position.set(m.varetaXMm - 75, pontaY, 0.6)
      varetaTig.visible = !inspecionando && m.varetaRestanteMm > 0
      const derretendo = m.encostarVareta && m.temperaturaC(m.varetaXMm, 0.25) > m.liga.solidusC
      pontaVaretaMat.opacity = derretendo ? 0.9 : Math.max(0, pontaVaretaMat.opacity - dt * 2)
      pontaVaretaMalha.scale.setScalar(r * 1.3)
      pontaVaretaMalha.visible = pontaVaretaMat.opacity > 0.02
      coluna.visible = halo.visible = poca.visible = false
      luz.position.set(m.xMm - 75, chao + 10, m.yMm)
      luz.color.set('#ffb36a')
      luz.intensity = m.naPeca && !inspecionando ? 60 + 30 * bico.n : 15
      respingos.visible = false
      escoria.malha.visible = false
      lascas.visible = false
      // Brilho e fluxo: a cada dois quadros (13 mil pontos).
      brilhoPeca.visible = camadaFluxo.visible = true
      if (++brasaQuadro % 2 === 0 || inspecionando) {
        const [a0, a1] = FLUXOS[m.liga.fluxo].ativoC
        const oxidoCor = m.peca.material === 'cobre' ? [0.08, 0.05, 0.04] : [0.16, 0.13, 0.1]
        for (let k = 0; k < nVert; k++) {
          const t = BRASAGEM.ambienteC + m.temperatura[k]
          corIncandescente(t, corBrasa, k)
          const pico = BRASAGEM.ambienteC + m.maxima[k]
          let rC = 0, gC = 0, bC = 0, aC = 0
          if (m.fluxo[k] > 0.05) {
            // Pasta branca; acima de 100 °C a água ferve e vira pó; na faixa ativa fica vítreo e transparente.
            if (t < 100) { rC = 0.95; gC = 0.94; bC = 0.9; aC = 0.7 }
            else if (t < a0) { rC = 0.9; gC = 0.88; bC = 0.82; aC = 0.55 }
            else { rC = 1; gC = 0.97; bC = 0.85; aC = 0.12 }
          } else if (m.preparo.fluxo && pico > a1 && m.fluxo[k] <= 0.05 && pico > 300 && Math.abs(G.Y0 + (Math.floor(k / G.NX) + 0.5) * G.DY) < 15) {
            // Fluxo queimado: crosta escura, verde-preta.
            rC = 0.09; gC = 0.11; bC = 0.08; aC = 0.75
          } else if (m.oxido[k] > 0.15) {
            rC = oxidoCor[0]; gC = oxidoCor[1]; bC = oxidoCor[2]; aC = Math.min(0.75, m.oxido[k] * 0.8)
          }
          corFluxo[4 * k] = rC; corFluxo[4 * k + 1] = gC; corFluxo[4 * k + 2] = bC; corFluxo[4 * k + 3] = aC
        }
        geoBrasa.attributes.color.needsUpdate = true
        geoFluxo.attributes.color.needsUpdate = true
      }
      if (c !== cordaoAntes || c.volumeTotal() !== volumeAntes) {
        metalLocal.malha.visible = false
        palco.atualizarCordao(c)
        cordaoAntes = c
        volumeAntes = c.volumeTotal()
      }
      palco.desenhar(camera)
    },
    /** H105: a liga tem a cor dela no cordão (filete). */
    definirCoresLiga(cores: readonly [string, string, string, string]) { palco.definirCoresCordao(cores) },
    /** Defeitos visíveis calculados pela análise do eletrodo (poros, crateras, mordedura, respingos, cor de calor), desenhados sobre o cordão 3D (H84, H86). */
    atualizarDefeitos(a: AnaliseDefeitos | null) {
      palco.atualizarDefeitos(a)
    },
    destruir() { palco.destruir() },
  }
}
