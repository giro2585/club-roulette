// Набор иллюстраций в стиле «жёлтый + серебро». Все рисунки свои, viewBox 0 0 100 100.
const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="gLime" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe680"/><stop offset=".45" stop-color="#fecc00"/><stop offset="1" stop-color="#cc9a00"/>
    </linearGradient>
    <linearGradient id="gLimeDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8b400"/><stop offset="1" stop-color="#a37400"/>
    </linearGradient>
    <linearGradient id="gSilver" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#dfe1e6"/><stop offset=".7" stop-color="#9da1ab"/><stop offset="1" stop-color="#e8e9ed"/>
    </linearGradient>
    <linearGradient id="gSilverDark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a7abb5"/><stop offset="1" stop-color="#5f636c"/>
    </linearGradient>
    <linearGradient id="gInk" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4a4d55"/><stop offset="1" stop-color="#121316"/>
    </linearGradient>
    <radialGradient id="gShine" cx=".3" cy=".25" r=".6">
      <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`;

const mark = (cx, cy, r, fill) =>
  `<path d="M${cx} ${cy - r} C${cx + r * 0.18} ${cy - r * 0.18} ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} C${cx + r * 0.18} ${cy + r * 0.18} ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} C${cx - r * 0.18} ${cy + r * 0.18} ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} C${cx - r * 0.18} ${cy - r * 0.18} ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r}Z" fill="${fill}"/>`;

const coin = (cx, cy, r, lime = true) => `
  <ellipse cx="${cx + r * 0.08}" cy="${cy + r * 0.1}" rx="${r}" ry="${r}" fill="${lime ? 'url(#gLimeDark)' : 'url(#gSilverDark)'}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${lime ? 'url(#gLime)' : 'url(#gSilver)'}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="none" stroke="${lime ? '#d9a600' : '#9da1ab'}" stroke-width="${r * 0.07}"/>
  ${mark(cx, cy, r * 0.5, lime ? '#c29000' : '#8a8e98')}
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gShine)"/>`;

const ICONS = {
  coin: () => coin(50, 50, 30, false) + coin(30, 72, 12) + mark(80, 22, 8, 'url(#gSilver)'),
  coins: () => coin(36, 60, 22) + coin(64, 40, 24, false) + coin(72, 76, 13) + mark(22, 22, 9, 'url(#gSilver)'),
  ticket: () => `
    <g transform="rotate(-14 50 50)">
      <path d="M10 30 h80 v14 a6 6 0 0 0 0 12 v14 h-80 v-14 a6 6 0 0 0 0 -12z" fill="url(#gLimeDark)" transform="translate(2 3)"/>
      <path d="M10 30 h80 v14 a6 6 0 0 0 0 12 v14 h-80 v-14 a6 6 0 0 0 0 -12z" fill="url(#gLime)"/>
      <line x1="70" y1="33" x2="70" y2="67" stroke="#b88600" stroke-width="2" stroke-dasharray="3 3"/>
      <text x="40" y="47" font-family="Unbounded, sans-serif" font-weight="800" font-size="11" text-anchor="middle" fill="#111">PROMO</text>
      <text x="40" y="60" font-family="Unbounded, sans-serif" font-weight="800" font-size="11" text-anchor="middle" fill="#111">CODE</text>
    </g>` + mark(84, 18, 9, 'url(#gSilver)') + mark(18, 84, 6, 'url(#gSilver)'),
  percent: () => `
    <circle cx="52" cy="54" r="34" fill="url(#gLimeDark)"/><circle cx="50" cy="50" r="34" fill="url(#gLime)"/>
    <circle cx="50" cy="50" r="34" fill="url(#gShine)"/>
    <circle cx="38" cy="38" r="8" fill="none" stroke="url(#gInk)" stroke-width="6"/>
    <circle cx="62" cy="62" r="8" fill="none" stroke="url(#gInk)" stroke-width="6"/>
    <line x1="64" y1="32" x2="36" y2="68" stroke="url(#gInk)" stroke-width="7" stroke-linecap="round"/>` + mark(86, 16, 9, 'url(#gSilver)'),
  gift: () => `
    <rect x="18" y="44" width="64" height="44" rx="5" fill="url(#gLimeDark)"/>
    <rect x="18" y="44" width="58" height="44" rx="5" fill="url(#gLime)"/>
    <rect x="12" y="32" width="76" height="16" rx="4" fill="url(#gLime)"/>
    <rect x="43" y="32" width="14" height="56" fill="url(#gSilver)"/>
    <path d="M50 32 C36 10 18 20 30 30 Z" fill="url(#gSilver)"/><path d="M50 32 C64 10 82 20 70 30 Z" fill="url(#gSilver)"/>
    <rect x="18" y="44" width="64" height="44" rx="5" fill="url(#gShine)"/>` + mark(86, 14, 8, 'url(#gSilver)'),
  headphones: () => `
    <path d="M22 58 V48 a28 28 0 0 1 56 0 V58" fill="none" stroke="url(#gInk)" stroke-width="7" stroke-linecap="round"/>
    <rect x="12" y="52" width="20" height="32" rx="9" fill="url(#gInk)"/>
    <rect x="68" y="52" width="20" height="32" rx="9" fill="url(#gInk)"/>
    <rect x="16" y="58" width="8" height="20" rx="4" fill="#fecc00"/>
    <rect x="76" y="58" width="8" height="20" rx="4" fill="#fecc00"/>` + mark(50, 14, 9, 'url(#gSilver)') + mark(88, 30, 6, 'url(#gSilver)'),
  star: () => mark(50, 50, 38, 'url(#gSilver)') + mark(80, 20, 10, 'url(#gLime)') + mark(22, 78, 8, 'url(#gSilver)'),
  flower: () => {
    let s = '';
    for (let i = 0; i < 6; i++) s += `<ellipse cx="50" cy="28" rx="13" ry="20" fill="url(#gSilver)" transform="rotate(${i * 60} 50 50)"/>`;
    return s + `<circle cx="50" cy="50" r="12" fill="url(#gLime)"/>` + mark(86, 16, 8, 'url(#gLime)');
  },
  cup: () => `
    <path d="M28 18 h44 v22 a22 22 0 0 1 -44 0z" fill="url(#gLime)"/>
    <path d="M28 24 h-10 a10 12 0 0 0 12 20 M72 24 h10 a10 12 0 0 1 -12 20" fill="none" stroke="url(#gLime)" stroke-width="6"/>
    <rect x="45" y="60" width="10" height="14" fill="url(#gSilver)"/>
    <rect x="32" y="74" width="36" height="10" rx="3" fill="url(#gSilver)"/>
    <rect x="28" y="18" width="44" height="44" rx="20" fill="url(#gShine)"/>` + mark(84, 14, 9, 'url(#gSilver)'),
  bag: () => `
    <path d="M36 34 v-6 a14 14 0 0 1 28 0 v6" fill="none" stroke="url(#gSilverDark)" stroke-width="6"/>
    <path d="M20 34 h60 l-5 52 h-50z" fill="url(#gLime)"/><path d="M20 34 h60 l-5 52 h-50z" fill="url(#gShine)"/>` + mark(50, 60, 12, '#c29000'),
  heart: () => `
    <path d="M50 84 C20 62 12 46 18 32 C24 18 44 18 50 32 C56 18 76 18 82 32 C88 46 80 62 50 84Z" fill="url(#gLimeDark)" transform="translate(2 3)"/>
    <path d="M50 84 C20 62 12 46 18 32 C24 18 44 18 50 32 C56 18 76 18 82 32 C88 46 80 62 50 84Z" fill="url(#gLime)"/>
    <ellipse cx="34" cy="34" rx="9" ry="6" fill="#fff" opacity=".7" transform="rotate(-30 34 34)"/>` + mark(86, 14, 8, 'url(#gSilver)'),
  receipt: () => `
    <path d="M26 12 h48 v76 l-8 -6 -8 6 -8 -6 -8 6 -8 -6 -8 6z" fill="url(#gLime)" transform="rotate(8 50 50)"/>
    <g transform="rotate(8 50 50)" stroke="#111" stroke-width="3" stroke-linecap="round">
      <line x1="34" y1="28" x2="66" y2="28"/><line x1="34" y1="38" x2="58" y2="38"/><line x1="34" y1="48" x2="62" y2="48"/>
    </g>` + mark(16, 20, 8, 'url(#gSilver)'),
  perfume: () => `
    <rect x="42" y="12" width="16" height="16" rx="3" fill="url(#gSilver)"/>
    <rect x="22" y="30" width="56" height="58" rx="12" fill="url(#gLimeDark)"/>
    <rect x="22" y="30" width="52" height="58" rx="12" fill="url(#gLime)"/>
    <rect x="30" y="38" width="8" height="42" rx="4" fill="#fff" opacity=".5"/>` + mark(86, 18, 8, 'url(#gSilver)'),
  card: () => `
    <g transform="rotate(-10 50 50)">
      <rect x="12" y="26" width="76" height="48" rx="8" fill="url(#gSilverDark)" transform="translate(2 3)"/>
      <rect x="12" y="26" width="76" height="48" rx="8" fill="url(#gSilver)"/>
      <rect x="12" y="36" width="76" height="9" fill="url(#gLime)"/>
      <text x="80" y="66" font-family="Unbounded, sans-serif" font-weight="800" font-size="12" text-anchor="end" fill="#111">1000 ₽</text>
    </g>`,
};

function icon(name, cls = '') {
  if (ICONS[name]) return `<svg class="ic ${cls}" viewBox="0 0 100 100" aria-hidden="true">${ICONS[name]()}</svg>`;
  // любое другое значение показываем как эмодзи/текст
  return `<span class="ic ic-emoji ${cls}" aria-hidden="true">${String(name).replace(/[<>&"]/g, '')}</span>`;
}
const ICON_NAMES = Object.keys(ICONS);
const sparkle = (cls = '') => `<svg class="sparkle ${cls}" viewBox="0 0 100 100" aria-hidden="true">${mark(50, 50, 48, 'url(#gSilver)')}</svg>`;
const coinMini = () => `<svg class="coin-mini" viewBox="0 0 100 100" aria-hidden="true">${coin(48, 48, 44)}</svg>`;

document.body.insertAdjacentHTML('afterbegin', DEFS);
