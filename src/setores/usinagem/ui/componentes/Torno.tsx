// Vista do torno (Canvas 2D): metade superior em vista externa, metade inferior em corte
// (mostra o furo). Só apresenta: lê a peça e o quadro já calculados pelo modelo.

import { useEffect, useRef } from 'react';
import { DZ, type Peca } from '../../modelo/peca';
import type { Ferramenta, Material, PontoMedicao, TipoCavaco } from '../../modelo/tipos';
import type { QuadroPasse } from '../../jogo/animacao';
import type { RegistroOperacao } from '../../jogo/partida';
import { num } from '../formato';

export type PrevisaoDesenho =
  | { tipo: 'tornear'; dref: number; dprog: number; ap: number; L: number; valido: boolean }
  | { tipo: 'furar'; d: number; P: number; fundo: number; valido: boolean };

export interface PropsTorno {
  peca: Peca;
  material: Material;
  ferramenta: Ferramenta | null;
  animacao: { registro: RegistroOperacao; quadro: QuadroPasse; rodando: boolean } | null;
  previsao: PrevisaoDesenho | null;
  aproximacao: number;
  pontos: PontoMedicao[];
  ressalto: number | null;
  aviso: string | null;
}

const ALTURA = 400;
const CORES = {
  fundo: '#0e1621',
  grade: 'rgba(120,150,190,0.07)',
  eixo: 'rgba(170,190,215,0.55)',
  texto: '#b9c6d6',
  textoFraco: '#7f8fa3',
  laranja: '#ff8a1f',
  placa: '#3a4656',
  placaClara: '#526175',
  suporte: '#5d6a7b',
  inserto: '#2b2f36',
  insertoAresta: '#d8dee6',
  cavaco: '#c6ced8',
  alerta: '#ff6b6b',
};

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  vidaMax: number;
  rot: number;
  vrot: number;
  tam: number;
  fluxo: number;
}

export function Torno(props: PropsTorno) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const largura = useRef(800);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const caixa = caixaRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rnd = lcg(12345);
    let particulas: Particula[] = [];
    let fase = 0;
    let fluxo = 0;
    let acumEmissao = 0;
    let ultimo = performance.now();
    let raf = 0;

    // Padrão de hachura para a metade em corte.
    const hach = document.createElement('canvas');
    hach.width = 8;
    hach.height = 8;
    const hc = hach.getContext('2d')!;
    hc.strokeStyle = 'rgba(10,14,20,0.55)';
    hc.lineWidth = 1.2;
    hc.beginPath();
    hc.moveTo(0, 8);
    hc.lineTo(8, 0);
    hc.stroke();
    const padraoHachura = ctx.createPattern(hach, 'repeat');

    const redimensionar = () => {
      const w = Math.max(480, caixa.clientWidth);
      largura.current = w;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(ALTURA * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ALTURA}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    redimensionar();
    const obs = new ResizeObserver(redimensionar);
    obs.observe(caixa);

    const rotulo = (texto: string, x: number, y: number, cor: string) => {
      const w = ctx.measureText(texto).width;
      const x0 = ctx.textAlign === 'center' ? x - w / 2 : ctx.textAlign === 'right' ? x - w : x;
      ctx.fillStyle = 'rgba(14,22,33,0.82)';
      ctx.fillRect(x0 - 4, y - 12, w + 8, 16);
      ctx.fillStyle = cor;
      ctx.fillText(texto, x, y);
    };

    const quadro = (agora: number) => {
      const dt = Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;
      const p = propsRef.current;
      const W = largura.current;
      const H = ALTURA;
      const anim = p.animacao;
      const pecaAntes = anim ? anim.registro.pecaAntes : p.peca;
      const pecaDepois = anim ? anim.registro.pecaDepois : p.peca;
      const balanco = pecaAntes.balanco;
      const dBruto = pecaAntes.diametroBruto;
      const margemDir = 34;
      const margemPlaca = 28;
      const s = Math.min(W / (balanco + margemDir + margemPlaca), (H * 0.6) / (dBruto + 4));
      const sobra = Math.max(0, W - (balanco + margemDir + margemPlaca) * s);
      const xFace = W - margemDir * s - sobra / 2;
      const X = (z: number) => xFace - z * s;
      const eixoY = H * 0.5;
      const ferr = p.ferramenta;
      const ehFuro = anim ? anim.registro.tipo === 'furar' : ferr?.tipo === 'broca';
      const rodando = !!anim && anim.rodando && !anim.quadro.concluido;
      if (rodando) fase += (dt * 2 * Math.PI * Math.min(anim!.registro.params.n, 360)) / 60 * 0.35;
      const [bA, bB] = p.material.cores.bruta;
      const [uA, uB] = p.material.cores.usinada;

      // ---------------------------------------------- fundo e grade
      ctx.fillStyle = CORES.fundo;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = CORES.grade;
      ctx.lineWidth = 1;
      for (let z = -30; z <= balanco + margemPlaca; z += 10) {
        const x = Math.round(X(z)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let r = -60; r <= 60; r += 10) {
        const y = Math.round(eixoY + r * s) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // ---------------------------------------------- perfil exibido
      const cortadas = anim ? anim.quadro.celulasCortadas : 0;
      const n = pecaAntes.diametros.length;
      const de = (i: number) => (i < cortadas ? pecaDepois : pecaAntes);
      const trechos: { i0: number; i1: number; d: number; furo: number; bruta: boolean }[] = [];
      for (let i = 0; i < n; i++) {
        const fonte = de(i);
        const d = fonte.diametros[i];
        const furo = fonte.furo[i];
        const b = fonte.origem[i] === -1;
        const t = trechos[trechos.length - 1];
        if (t && t.bruta === b && Math.abs(t.d - d) * s < 0.4 && Math.abs(t.furo - furo) * s < 0.4) t.i1 = i;
        else trechos.push({ i0: i, i1: i, d, furo, bruta: b });
      }

      // Parte do tarugo dentro da placa.
      ctx.fillStyle = '#2a3038';
      ctx.fillRect(X(balanco + margemPlaca), eixoY - (dBruto / 2) * s, margemPlaca * s, dBruto * s);

      for (const t of trechos) {
        const x0 = X((t.i1 + 1) * DZ);
        const x1 = X(t.i0 * DZ);
        const w = x1 - x0 + 0.6;
        const r = (t.d / 2) * s;
        const rf = (t.furo / 2) * s;
        // metade superior: vista externa
        const g = ctx.createLinearGradient(0, eixoY - r, 0, eixoY);
        g.addColorStop(0, t.bruta ? bB : uB);
        g.addColorStop(0.45, t.bruta ? bA : uA);
        g.addColorStop(1, t.bruta ? bB : uB);
        ctx.fillStyle = g;
        ctx.fillRect(x0, eixoY - r, w, r);
        if (rodando) {
          for (let k = 0; k < 8; k++) {
            const th = fase + (k * Math.PI) / 4;
            const sn = Math.sin(th);
            const c = Math.cos(th);
            if (sn <= 0.05 || c < 0) continue;
            const y = eixoY - r * c;
            ctx.strokeStyle = t.bruta ? `rgba(0,0,0,${0.35 * sn})` : `rgba(255,255,255,${0.28 * sn})`;
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
            ctx.stroke();
          }
        }
        if (rf > 0) {
          // linha oculta do furo na vista externa
          ctx.strokeStyle = 'rgba(20,24,30,0.7)';
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(x0, eixoY - rf);
          ctx.lineTo(x1, eixoY - rf);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // metade inferior: corte (material hachurado, furo vazio)
        ctx.fillStyle = t.bruta ? bA : uA;
        ctx.fillRect(x0, eixoY + rf, w, r - rf);
        if (padraoHachura) {
          ctx.fillStyle = padraoHachura;
          ctx.fillRect(x0, eixoY + rf, w, r - rf);
        }
        if (rf > 0) {
          ctx.fillStyle = '#141c27';
          ctx.fillRect(x0, eixoY, w, rf);
        }
      }
      // Contornos.
      ctx.strokeStyle = 'rgba(220,230,240,0.6)';
      ctx.lineWidth = 1;
      for (const sinal of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(X(0), eixoY);
        for (const t of trechos) {
          const y = eixoY + sinal * (t.d / 2) * s;
          ctx.lineTo(X(t.i0 * DZ), y);
          ctx.lineTo(X((t.i1 + 1) * DZ), y);
        }
        ctx.stroke();
      }
      ctx.beginPath();
      for (const t of trechos) {
        if (t.furo <= 0) continue;
        ctx.moveTo(X(t.i0 * DZ), eixoY + (t.furo / 2) * s);
        ctx.lineTo(X((t.i1 + 1) * DZ), eixoY + (t.furo / 2) * s);
      }
      ctx.stroke();

      // ---------------------------------------------- placa e castanhas
      const hCast = Math.min(9, dBruto * 0.2) * s;
      ctx.fillStyle = CORES.placa;
      const meiaPlaca = Math.max(31, dBruto / 2 + 12);
      ctx.fillRect(X(balanco + margemPlaca), eixoY - meiaPlaca * s, (margemPlaca - 8) * s, 2 * meiaPlaca * s);
      ctx.fillStyle = CORES.placaClara;
      for (const sinal of [-1, 1]) {
        const yBase = eixoY + sinal * (dBruto / 2) * s;
        ctx.fillRect(X(balanco + 8), sinal < 0 ? yBase - hCast : yBase, 8 * s, hCast);
      }
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = CORES.textoFraco;
      ctx.fillText('Placa · 3 castanhas', X(balanco + margemPlaca / 2), Math.min(H - 6, eixoY + meiaPlaca * s + 14));

      // Eixo (traço-ponto).
      ctx.strokeStyle = CORES.eixo;
      ctx.setLineDash([14, 4, 2, 4]);
      ctx.beginPath();
      ctx.moveTo(X(balanco + margemPlaca), eixoY + 0.5);
      ctx.lineTo(W, eixoY + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ressalto pedido no desenho (só na encomenda).
      if (p.ressalto !== null) {
        ctx.strokeStyle = 'rgba(160,190,230,0.35)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(X(p.ressalto) + 0.5, eixoY - (dBruto / 2 + 5) * s);
        ctx.lineTo(X(p.ressalto) + 0.5, eixoY - (dBruto / 2 - 2) * s);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = CORES.textoFraco;
        ctx.fillText(`ressalto do desenho (z = ${p.ressalto})`, X(p.ressalto), eixoY - (dBruto / 2 + 5) * s - 6);
      }

      // Régua z e pontos de medição.
      const yRegua = Math.min(H - 34, eixoY + (dBruto / 2) * s + 22);
      ctx.strokeStyle = CORES.textoFraco;
      ctx.fillStyle = CORES.textoFraco;
      ctx.beginPath();
      ctx.moveTo(X(0), yRegua);
      ctx.lineTo(X(balanco), yRegua);
      ctx.stroke();
      for (let z = 0; z <= balanco; z += 10) {
        ctx.beginPath();
        ctx.moveTo(X(z) + 0.5, yRegua);
        ctx.lineTo(X(z) + 0.5, yRegua + 5);
        ctx.stroke();
        ctx.fillText(String(-z), X(z), yRegua + 16);
      }
      ctx.textAlign = 'left';
      ctx.fillText('Z [mm] (0 = face livre; negativo para dentro da peça)', X(balanco), yRegua + 30);
      ctx.textAlign = 'center';
      for (const pt of p.pontos) {
        const x = X(pt.z);
        const y = yRegua - 12;
        ctx.fillStyle = CORES.texto;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 7);
        ctx.lineTo(x + 4, y + 7);
        ctx.closePath();
        ctx.fill();
      }

      // ---------------------------------------------- previsão geométrica
      ctx.font = '11px system-ui, sans-serif';
      if (!anim && p.previsao) {
        const pv = p.previsao;
        ctx.strokeStyle = pv.valido ? CORES.laranja : CORES.alerta;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        if (pv.tipo === 'tornear') {
          const r = (pv.dprog / 2) * s;
          for (const sinal of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(X(0) + 2, eixoY + sinal * r);
            ctx.lineTo(X(pv.L), eixoY + sinal * r);
            ctx.lineTo(X(pv.L), eixoY + sinal * (dBruto / 2) * s);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          const xa = X(pv.L / 2);
          const rRef = (pv.dref / 2) * s;
          ctx.lineWidth = 1;
          for (const sinal of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(xa, eixoY + sinal * rRef);
            ctx.lineTo(xa, eixoY + sinal * r);
            ctx.stroke();
          }
          ctx.textAlign = 'center';
          rotulo(`ap = ${num(pv.ap)} mm no raio, dos dois lados → ΔD = ${num(2 * pv.ap)} mm`, xa, eixoY - rRef - 10, CORES.laranja);
          ctx.textAlign = 'left';
          rotulo(`Previsão: X ${num(pv.dref, 3)} − 2 × ${num(pv.ap)} = X ${num(pv.dprog, 3)} até Z −${num(pv.L, 1)}`, 12, 40, CORES.laranja);
        } else {
          const rf = (pv.d / 2) * s;
          for (const sinal of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(X(0), eixoY + sinal * rf);
            ctx.lineTo(X(pv.P), eixoY + sinal * rf);
            ctx.lineTo(X(pv.fundo), eixoY);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.textAlign = 'left';
          rotulo(`Previsão: furo Ø ${num(pv.d, 1)} com ${num(pv.P, 1)} mm de diâmetro pleno; ponta até Z −${num(pv.fundo, 1)}`, 12, 40, CORES.laranja);
        }
      }

      // ---------------------------------------------- ferramenta
      const ang = (g: number) => (g * Math.PI) / 180;
      if (ehFuro) {
        // Broca no eixo, entrando pela face; haste presa na torre à direita.
        const reg = anim?.registro;
        const d = ferr && ferr.tipo === 'broca' ? ferr.diametro : 10;
        const anguloPonta = ferr && ferr.tipo === 'broca' ? ferr.anguloPonta : 118;
        const zTip = anim && !anim.quadro.concluido ? anim.quadro.zFerramenta : -p.aproximacao - 4;
        const rr = (d / 2) * s;
        const lp = rr / Math.tan(ang(anguloPonta / 2));
        const xt = X(zTip);
        const xFim = W;
        ctx.fillStyle = '#b7c0ca';
        ctx.beginPath();
        ctx.moveTo(xt, eixoY);
        ctx.lineTo(xt + lp, eixoY - rr);
        ctx.lineTo(xFim, eixoY - rr);
        ctx.lineTo(xFim, eixoY + rr);
        ctx.lineTo(xt + lp, eixoY + rr);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e6ebf1';
        ctx.stroke();
        ctx.strokeStyle = '#3b4250';
        ctx.lineWidth = 2;
        for (let x = xt + lp + 4; x < xFim; x += Math.max(8, rr * 1.1)) {
          ctx.beginPath();
          ctx.moveTo(x, eixoY - rr);
          ctx.lineTo(x + rr * 0.8, eixoY + rr);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        if (reg && reg.tipo === 'furar' && reg.quebrouEm !== null && anim!.quadro.concluido) {
          ctx.fillStyle = CORES.alerta;
          ctx.textAlign = 'center';
          rotulo('✕ broca quebrada', xt + 40, eixoY - rr - 10, CORES.alerta);
        }
      } else {
        let tx: number;
        let ty: number;
        if (anim && anim.registro.tipo === 'tornear' && !anim.quadro.concluido) {
          const q = anim.quadro;
          tx = X(Math.min(q.zFerramenta, anim.registro.params.L));
          const dPonta = q.zFerramenta < 0 ? anim.registro.previsao.dprog : q.diametroPonta;
          ty = eixoY - (dPonta / 2) * s;
        } else {
          tx = X(-6);
          ty = eixoY - (Math.max(...p.peca.diametros.slice(0, 5)) / 2 + 2) * s;
        }
        if (ferr || anim) {
          const a = 8 * s;
          const kr = ferr && ferr.tipo === 'tornear' ? ferr.anguloPosicao : 95;
          const ep = ferr && ferr.tipo === 'tornear' ? ferr.anguloPonta : 80;
          const p1 = { x: tx + a * Math.cos(ang(180 - kr)), y: ty - a * Math.sin(ang(180 - kr)) };
          const p3 = { x: tx + a * Math.cos(ang(180 - kr - ep)), y: ty - a * Math.sin(ang(180 - kr - ep)) };
          const p2 = { x: p1.x + p3.x - tx, y: p1.y + p3.y - ty };
          const topo = Math.min(p1.y, p2.y, p3.y);
          ctx.fillStyle = CORES.suporte;
          const xs = Math.min(p1.x, p2.x, p3.x, tx);
          const xe = Math.max(p1.x, p2.x, p3.x, tx);
          ctx.fillRect(xs + 2, 0, Math.max(10, xe - xs - 2), topo + 3 * s);
          ctx.fillStyle = CORES.inserto;
          ctx.strokeStyle = CORES.insertoAresta;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (anim && anim.registro.cavaco.tipo === 'apc' && anim.quadro.emContato) {
            ctx.fillStyle = 'rgba(200,205,215,0.85)';
            ctx.beginPath();
            ctx.ellipse(tx + 3, ty - 4, 3 + Math.sin(fase * 3) * 1.2, 2.2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ---------------------------------------------- cavaco (ilustrativo)
      const tipo: TipoCavaco | null = anim ? anim.registro.cavaco.tipo : null;
      const emitir = rodando && anim!.quadro.emContato;
      let ex = 0;
      let ey = 0;
      if (anim) {
        if (anim.registro.tipo === 'tornear') {
          ex = X(Math.min(anim.quadro.zFerramenta, anim.registro.params.L)) + 2;
          ey = eixoY - (anim.quadro.diametroPonta / 2) * s - 4;
        } else {
          ex = X(0) + 3;
          ey = eixoY - (anim.quadro.diametroPonta / 2) * s;
        }
      }
      if (emitir && tipo) {
        acumEmissao += dt;
        if (tipo === 'fita') {
          while (acumEmissao > 0.012) {
            acumEmissao -= 0.012;
            const th = fase * 2.2;
            particulas.push({ x: ex, y: ey, vx: 40 + 30 * Math.cos(th), vy: -70 + 40 * Math.sin(th), vida: 0, vidaMax: 2.6, rot: 0, vrot: 0, tam: 1.6, fluxo });
          }
        } else {
          const intervalo = tipo === 'espesso' ? 0.07 : tipo === 'fragmentado' ? 0.02 : 0.045;
          while (acumEmissao > intervalo) {
            acumEmissao -= intervalo;
            particulas.push({
              x: ex,
              y: ey,
              vx: 40 + rnd() * 70,
              vy: -90 - rnd() * 70,
              vida: 0,
              vidaMax: 1.3,
              rot: rnd() * 6,
              vrot: (rnd() - 0.5) * 14,
              tam: tipo === 'espesso' ? 6 + rnd() * 2 : tipo === 'fragmentado' ? 1 + rnd() * 1.5 : 3.5 + rnd() * 2,
              fluxo: -1,
            });
          }
        }
      } else if (!rodando) {
        fluxo++;
      }
      const pausado = !!anim && !anim.rodando && !anim.quadro.concluido;
      if (!pausado) {
        for (const q of particulas) {
          q.vida += dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.rot += q.vrot * dt;
          if (q.fluxo < 0) q.vy += 320 * dt;
          else {
            q.vy += 25 * dt;
            q.vx *= 1 - 0.4 * dt;
          }
        }
        particulas = particulas.filter((q) => q.vida < q.vidaMax && q.y < H + 20);
      }
      ctx.strokeStyle = CORES.cavaco;
      ctx.fillStyle = CORES.cavaco;
      for (const q of particulas) {
        if (q.fluxo >= 0) continue;
        ctx.globalAlpha = Math.max(0, 1 - q.vida / q.vidaMax);
        if (q.tam < 3) {
          ctx.fillRect(q.x, q.y, q.tam + 1, q.tam);
          continue;
        }
        ctx.lineWidth = q.tam > 5.5 ? 3 : 2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.tam, q.rot, q.rot + 4.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.6;
      let anterior: Particula | null = null;
      for (const q of particulas) {
        if (q.fluxo < 0) {
          anterior = null;
          continue;
        }
        if (anterior && anterior.fluxo === q.fluxo) {
          ctx.globalAlpha = Math.max(0, 1 - q.vida / q.vidaMax);
          ctx.beginPath();
          ctx.moveTo(anterior.x, anterior.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        anterior = q;
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;

      // ---------------------------------------------- textos fixos
      ctx.textAlign = 'left';
      ctx.font = '11px system-ui, sans-serif';
      rotulo(`${p.material.nome} · vista superior externa / inferior em corte · rotação e cavaco ilustrativos`, 12, 20, CORES.textoFraco);
      ctx.strokeStyle = CORES.texto;
      ctx.beginPath();
      ctx.moveTo(W - 12 - 10 * s, H - 10);
      ctx.lineTo(W - 12, H - 10);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillStyle = CORES.texto;
      ctx.fillText('10 mm', W - 12, H - 15);
      if (p.aviso && !anim) {
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px system-ui, sans-serif';
        rotulo(`✕ ${p.aviso}`, 12, H - 12, CORES.alerta);
      }

      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, []);

  const p = props;
  const descricao = p.animacao
    ? `Animação da operação ${p.animacao.registro.numero}: ferramenta em Z ${num(-p.animacao.quadro.zFerramenta, 1)} mm.`
    : 'Máquina parada.';

  return (
    <div className="torno-caixa" ref={caixaRef}>
      <canvas ref={canvasRef} role="img" aria-label={`Vista do torno com ${p.material.nome}. ${descricao}`} />
    </div>
  );
}
