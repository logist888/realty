// Детерминированная генерация SVG-заглушек фотографий по seed из URL.
// Каждое "фото" — стилизованный фасад дома со своей палитрой и геометрией.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTES = [
  ['#dbe9ff', '#3a6ea5', '#28527a'],
  ['#fdf0e0', '#d98e32', '#a05c14'],
  ['#e8f5e9', '#5c9c63', '#34603a'],
  ['#f3e8fd', '#8b5fbf', '#5b3a82'],
  ['#fde8e8', '#c25b5b', '#8a3333'],
  ['#e0f4f5', '#3e9da3', '#21666b'],
  ['#f5f1e3', '#9a8f5f', '#6b6138'],
];

function buildingSvg(seedStr) {
  const rnd = mulberry32(hashSeed(seedStr));
  const [sky, wall, accent] = PALETTES[Math.floor(rnd() * PALETTES.length)];
  const W = 800, H = 600;
  let parts = [
    `<rect width="${W}" height="${H}" fill="${sky}"/>`,
    `<circle cx="${100 + rnd() * 200}" cy="${80 + rnd() * 60}" r="${30 + rnd() * 25}" fill="#ffffff" opacity="0.85"/>`,
    `<rect y="${H - 60}" width="${W}" height="60" fill="${accent}" opacity="0.25"/>`,
  ];
  const buildings = 2 + Math.floor(rnd() * 3);
  let x = 30 + rnd() * 40;
  for (let b = 0; b < buildings && x < W - 120; b++) {
    const bw = 140 + rnd() * 180;
    const bh = 200 + rnd() * 320;
    const top = H - 60 - bh;
    const shade = b % 2 ? accent : wall;
    parts.push(`<rect x="${x}" y="${top}" width="${bw}" height="${bh}" fill="${shade}" rx="4"/>`);
    const cols = Math.max(2, Math.floor(bw / 48));
    const rows = Math.max(3, Math.floor(bh / 60));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rnd() > 0.4;
        parts.push(`<rect x="${x + 14 + c * (bw - 20) / cols}" y="${top + 16 + r * (bh - 24) / rows}" width="${(bw - 20) / cols - 12}" height="${(bh - 24) / rows - 16}" rx="2" fill="${lit ? '#fff7d6' : '#1f2a38'}" opacity="${lit ? 0.95 : 0.55}"/>`);
      }
    }
    x += bw + 20 + rnd() * 40;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

module.exports = { buildingSvg };
