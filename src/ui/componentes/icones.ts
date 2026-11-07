/*
 * Ícones em SVG próprios (traço simples, cor herdada do texto). Decorativos:
 * sempre acompanham um texto, então ficam fora da leitura de tela.
 */

const TRACOS: Record<string, string> = {
  fabrica: '<path d="M3 20V10l5 3V10l5 3V10l5 3V5h3v15z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
  historia: '<path d="M4 5c3-1.5 6-1.5 8 0v14c-2-1.5-5-1.5-8 0z"/><path d="M20 5c-3-1.5-6-1.5-8 0v14c2-1.5 5-1.5 8 0z"/>',
  arcade: '<rect x="3" y="9" width="18" height="10" rx="3"/><path d="M8 12v4M6 14h4"/><circle cx="15.5" cy="13" r="1"/><circle cx="17.5" cy="15.5" r="1"/><path d="M12 9V5"/><circle cx="12" cy="4" r="1.5"/>',
  torneio: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 20h8M9 17h6"/>',
  treino: '<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  recordes: '<path d="M4 20V13h5v7M9 20V8h6v12M15 20v-5h5v5"/><path d="M12 3l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  maquina: '<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="8" cy="12.5" r="2.5"/><circle cx="16" cy="12.5" r="2.5"/><path d="M8 4v2M16 4v2"/>',
  cadeado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ajuste: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  limpar: '<path d="M4 20h16M7 16l9-9 3 3-9 9H7z"/>',
  mouse: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 3v6"/>',
  caneta: '<path d="M4 20l1.5-5L16 4.5 19.5 8 9 18.5z"/><path d="M14 6.5l3.5 3.5"/>',
  controle: '<path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 4a2.5 2.5 0 0 1-4.4 1.2L14.5 16h-5L8 17.7a2.5 2.5 0 0 1-4.4-1.2l-.6-4A4 4 0 0 1 7 8z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="16" cy="11.5" r=".8"/><circle cx="17.5" cy="13.5" r=".8"/>',
  'tecnica-empurrando': '<path d="M3 19h18"/><path d="M8 17l7-12"/><path d="M8 17l-2 2"/><path d="M17 13h4l-2-2M21 13l-2 2"/>',
  'tecnica-neutra': '<path d="M3 19h18"/><path d="M12 17V4"/><path d="M12 17v2"/>',
  'movimento-reto': '<path d="M3 12h18"/><path d="M17 8l4 4-4 4"/>',
  'movimento-zigue-zague': '<path d="M3 12l3-5 3 10 3-10 3 10 3-10 3 5"/>',
  'movimento-meia-lua': '<path d="M3 7c2 9 4 9 5 0M8 7c2 9 4 9 5 0M13 7c2 9 4 9 5 0"/>',
  'movimento-circulos': '<circle cx="6" cy="12" r="3"/><circle cx="11" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M19 12h2"/>',
  'tecnica-puxando': '<path d="M3 19h18"/><path d="M16 17L9 5"/><path d="M16 17l2 2"/><path d="M7 13H3l2-2M3 13l2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  estrela: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>',
  coracao: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  desenho: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M7 15h10M7 15V9h10v6M10 9v-2M14 9v-2"/>',
  raio: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  continuar: '<path d="M8 5l10 7-10 7z"/>',
}

export function icone(nome: string, classe = 'icone'): HTMLElement {
  const s = document.createElement('span')
  s.className = classe
  s.setAttribute('aria-hidden', 'true')
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TRACOS[nome] ?? ''}</svg>`
  return s
}
