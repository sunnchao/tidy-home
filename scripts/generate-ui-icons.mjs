import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../assets/resources/ui');
fs.mkdirSync(OUT_DIR, { recursive: true });

const INK = '#3D2B24';

function wrapSvg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <g stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </g>
</svg>`;
}

const UI_ICONS = {
  icon_magnet: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#FFE8D6"/>
    <path d="M36 42 L36 72 C36 90, 92 90, 92 72 L92 42" fill="none" stroke="${INK}" stroke-width="24"/>
    <path d="M36 42 L36 72 C36 90, 92 90, 92 72 L92 42" fill="none" stroke="#EC5D52" stroke-width="14"/>
    <rect x="24" y="28" width="24" height="18" rx="5" fill="#FFE680" stroke="${INK}" stroke-width="5"/>
    <rect x="80" y="28" width="24" height="18" rx="5" fill="#FFE680" stroke="${INK}" stroke-width="5"/>
    <path d="M64 16 L67 24 L75 26 L67 28 L64 36 L61 28 L53 26 L61 24 Z" fill="#FFB830" stroke="${INK}" stroke-width="3.5"/>
    <path d="M40 72 C42 81, 56 84, 62 84" fill="none" stroke="#FF9B93" stroke-width="4"/>
  `),

  icon_undo: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#E3F2FD"/>
    <path d="M46 46 L26 62 L46 78 L46 68 C68 68, 84 74, 88 92 C98 74, 88 52, 46 52 Z" fill="#4FA1DA" stroke="${INK}" stroke-width="5.5"/>
    <path d="M52 57 C70 57, 81 62, 87 72" fill="none" stroke="#9AD2F5" stroke-width="4.5"/>
  `),

  icon_hint: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#FFF3CC"/>
    <path d="M64 14 L64 21 M28 29 L33 34 M100 29 L95 34 M18 62 L25 62 M110 62 L103 62" stroke="#FC9651" stroke-width="5.5"/>
    <path d="M42 62 C42 44, 86 44, 86 62 C86 73, 78 80, 76 88 L52 88 C50 80, 42 73, 42 62 Z" fill="#FFD54F" stroke="${INK}" stroke-width="5.5"/>
    <circle cx="56" cy="54" r="7" fill="#FFF8DC" opacity="0.9"/>
    <rect x="52" y="88" width="24" height="10" rx="4" fill="#E8DFD3" stroke="${INK}" stroke-width="5"/>
    <rect x="55" y="98" width="18" height="8" rx="4" fill="#FC9651" stroke="${INK}" stroke-width="4.5"/>
  `),

  icon_shuffle: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#EDF6EC"/>
    <path d="M24 44 C46 44, 58 84, 88 84 L98 84" fill="none" stroke="${INK}" stroke-width="14"/>
    <path d="M24 44 C46 44, 58 84, 88 84 L98 84" fill="none" stroke="#6EC072" stroke-width="7"/>
    <polygon points="88,72 108,84 88,96" fill="#6EC072" stroke="${INK}" stroke-width="4.5"/>
    <path d="M24 84 C46 84, 58 44, 88 44 L98 44" fill="none" stroke="${INK}" stroke-width="14"/>
    <path d="M24 84 C46 84, 58 44, 88 44 L98 44" fill="none" stroke="#FC9651" stroke-width="7"/>
    <polygon points="88,32 108,44 88,56" fill="#FC9651" stroke="${INK}" stroke-width="4.5"/>
  `),

  icon_ad: wrapSvg(`
    <rect x="14" y="26" width="100" height="76" rx="20" fill="#FC9651" stroke="${INK}" stroke-width="6"/>
    <rect x="24" y="36" width="80" height="56" rx="12" fill="#FFF7EB" stroke="${INK}" stroke-width="4.5"/>
    <polygon points="54,48 84,64 54,80" fill="#4FA1DA" stroke="${INK}" stroke-width="4.5"/>
    <circle cx="32" cy="44" r="4" fill="#EB6A5B"/>
  `),

  icon_star: wrapSvg(`
    <polygon points="64,14 78,44 112,48 87,71 93,104 64,88 35,104 41,71 16,48 50,44" fill="#FFD147" stroke="${INK}" stroke-width="6"/>
    <polygon points="64,26 73,46 95,49 79,63 83,84 64,74 45,84 49,63 33,49 55,46" fill="#FFE98A"/>
  `),

  icon_sound_on: wrapSvg(`
    <circle cx="64" cy="64" r="52" fill="#FFF7EB" stroke="${INK}" stroke-width="5.5"/>
    <path d="M32 52 L48 52 L68 36 L68 92 L48 76 L32 76 Z" fill="#FC9651" stroke="${INK}" stroke-width="5.5"/>
    <path d="M80 50 C88 57, 88 71, 80 78" fill="none" stroke="#4FA1DA" stroke-width="6.5"/>
    <path d="M90 40 C103 52, 103 76, 90 88" fill="none" stroke="#4FA1DA" stroke-width="6.5"/>
  `),

  icon_sound_off: wrapSvg(`
    <circle cx="64" cy="64" r="52" fill="#F3ECE3" stroke="${INK}" stroke-width="5.5"/>
    <path d="M30 52 L46 52 L66 36 L66 92 L46 76 L30 76 Z" fill="#B5A69B" stroke="${INK}" stroke-width="5.5"/>
    <line x1="78" y1="50" x2="100" y2="78" stroke="#D9533B" stroke-width="7"/>
    <line x1="100" y1="50" x2="78" y2="78" stroke="#D9533B" stroke-width="7"/>
  `),

  icon_daily_gift: wrapSvg(`
    <rect x="22" y="54" width="84" height="56" rx="12" fill="#FC9651" stroke="${INK}" stroke-width="6"/>
    <rect x="16" y="38" width="96" height="22" rx="8" fill="#FFB277" stroke="${INK}" stroke-width="6"/>
    <rect x="56" y="38" width="16" height="72" fill="#FFE082" stroke="${INK}" stroke-width="5"/>
    <path d="M64 38 C46 14, 24 26, 38 38 Z" fill="#EB6A5B" stroke="${INK}" stroke-width="5"/>
    <path d="M64 38 C82 14, 104 26, 90 38 Z" fill="#EB6A5B" stroke="${INK}" stroke-width="5"/>
    <circle cx="64" cy="36" r="7" fill="#FFE082" stroke="${INK}" stroke-width="4.5"/>
  `),

  icon_cat_treat: wrapSvg(`
    <circle cx="64" cy="64" r="52" fill="#FFF0DB"/>
    <g transform="rotate(-24 64 64)">
      <ellipse cx="58" cy="64" rx="34" ry="20" fill="#FC9651" stroke="${INK}" stroke-width="5.5"/>
      <polygon points="88,64 110,46 106,64 110,82" fill="#F2845C" stroke="${INK}" stroke-width="5.5"/>
      <path d="M46 46 Q52 64 46 82" fill="none" stroke="${INK}" stroke-width="4.5"/>
      <circle cx="38" cy="59" r="4" fill="${INK}"/>
      <ellipse cx="64" cy="57" rx="14" ry="5" fill="#FFBE88"/>
    </g>
  `),

  icon_flashlight: wrapSvg(`
    <g transform="rotate(-35 64 64)">
      <rect x="20" y="50" width="52" height="28" rx="9" fill="#4FA1DA" stroke="${INK}" stroke-width="5.5"/>
      <path d="M72 44 L96 36 L96 92 L72 84 Z" fill="#FC9651" stroke="${INK}" stroke-width="5.5"/>
      <ellipse cx="96" cy="64" rx="6" ry="26" fill="#FFE680" stroke="${INK}" stroke-width="4.5"/>
      <rect x="40" y="56" width="14" height="8" rx="3" fill="#FFE082" stroke="${INK}" stroke-width="3.5"/>
    </g>
  `),

  icon_paw: wrapSvg(`
    <ellipse cx="64" cy="78" rx="28" ry="22" fill="#FF9AA2" stroke="${INK}" stroke-width="5.5"/>
    <ellipse cx="32" cy="52" rx="10" ry="13" transform="rotate(-22 32 52)" fill="#FF9AA2" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="52" cy="36" rx="10" ry="14" transform="rotate(-8 52 36)" fill="#FF9AA2" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="76" cy="36" rx="10" ry="14" transform="rotate(8 76 36)" fill="#FF9AA2" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="96" cy="52" rx="10" ry="13" transform="rotate(22 96 52)" fill="#FF9AA2" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="64" cy="79" rx="14" ry="10" fill="#FFD0D6"/>
  `),

  icon_check: wrapSvg(`
    <circle cx="64" cy="64" r="50" fill="#6EC072" stroke="${INK}" stroke-width="6"/>
    <polyline points="38,65 56,84 90,46" fill="none" stroke="#FFFDF9" stroke-width="11"/>
  `),

  icon_flame: wrapSvg(`
    <path d="M64 14 C86 38, 102 54, 102 78 C102 100, 86 114, 64 114 C42 114, 26 100, 26 78 C26 58, 38 42, 48 34 C46 48, 52 54, 56 54 C54 38, 58 24, 64 14 Z" fill="#FC9651" stroke="${INK}" stroke-width="6"/>
    <path d="M64 56 C76 68, 82 78, 82 88 C82 99, 74 106, 64 106 C54 106, 46 99, 46 88 C46 78, 54 66, 64 56 Z" fill="#FFD54F" stroke="${INK}" stroke-width="4.5"/>
  `),

  icon_home: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#FFF0DB"/>
    <path d="M26 62 L64 28 L102 62 L94 62 L94 102 Q94 108 88 108 L40 108 Q34 108 34 102 L34 62 Z" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <path d="M18 64 L64 24 L110 64" fill="none" stroke="${INK}" stroke-width="14"/>
    <path d="M18 64 L64 24 L110 64" fill="none" stroke="#FC9651" stroke-width="7"/>
    <rect x="52" y="72" width="24" height="36" rx="6" fill="#E39D5C" stroke="${INK}" stroke-width="5"/>
    <circle cx="70" cy="91" r="3" fill="${INK}"/>
  `),

  icon_settings: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#F6EBDC"/>
    <path d="M56 20 L72 20 L75 32 L85 36 L96 29 L106 39 L99 50 L103 60 L114 63 L114 79 L103 82 L99 92 L106 103 L96 113 L85 106 L75 110 L72 120 L56 120 L53 110 L43 106 L32 113 L22 103 L29 92 L25 82 L14 79 L14 63 L25 60 L29 50 L22 39 L32 29 L43 36 L53 32 Z" transform="translate(0 -6)" fill="#F7B764" stroke="${INK}" stroke-width="5.5"/>
    <circle cx="64" cy="64" r="18" fill="#FFF8EE" stroke="${INK}" stroke-width="6"/>
    <circle cx="64" cy="64" r="7" fill="#FC9651" stroke="${INK}" stroke-width="4"/>
  `),

  icon_rooms: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#E9F4FC"/>
    <rect x="20" y="34" width="54" height="62" rx="10" fill="#FFF9F0" stroke="${INK}" stroke-width="5.5"/>
    <path d="M26 52 L47 38 L68 52 L68 78 L26 78 Z" fill="#FC9651" stroke="${INK}" stroke-width="4.5"/>
    <rect x="54" y="42" width="54" height="62" rx="10" fill="#FFE0B2" stroke="${INK}" stroke-width="5.5"/>
    <circle cx="81" cy="64" r="12" fill="#6EC072" stroke="${INK}" stroke-width="4.5"/>
    <rect x="64" y="82" width="34" height="10" rx="5" fill="#FFFDF9" stroke="${INK}" stroke-width="4"/>
  `),

  icon_help: wrapSvg(`
    <circle cx="64" cy="64" r="50" fill="#4FA1DA" stroke="${INK}" stroke-width="6"/>
    <circle cx="64" cy="64" r="39" fill="#6CB8EA"/>
    <path d="M48 50 C48 36, 80 34, 80 51 C80 61, 64 63, 64 74" fill="none" stroke="#FFFDF9" stroke-width="11"/>
    <circle cx="64" cy="92" r="6.5" fill="#FFFDF9"/>
  `),

  icon_vibrate: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#FFF0DB"/>
    <rect x="44" y="26" width="40" height="76" rx="10" fill="#FC9651" stroke="${INK}" stroke-width="5.5"/>
    <rect x="50" y="36" width="28" height="48" rx="4" fill="#FFF8EE" stroke="${INK}" stroke-width="4"/>
    <circle cx="64" cy="92" r="3.5" fill="#FFF8EE"/>
    <path d="M32 46 Q24 64 32 82 M22 38 Q12 64 22 90" fill="none" stroke="${INK}" stroke-width="5"/>
    <path d="M96 46 Q104 64 96 82 M106 38 Q116 64 106 90" fill="none" stroke="${INK}" stroke-width="5"/>
  `),

  icon_replay: wrapSvg(`
    <circle cx="64" cy="64" r="52" fill="#E8F6E8" stroke="${INK}" stroke-width="5.5"/>
    <path d="M88 48 C78 32, 50 32, 38 48 C28 62, 32 86, 52 94 C70 100, 90 90, 94 72" fill="none" stroke="#4E8A5A" stroke-width="11"/>
    <polygon points="74,50 96,54 92,32" fill="#4E8A5A" stroke="${INK}" stroke-width="4.5"/>
  `),

  icon_shield: wrapSvg(`
    <circle cx="64" cy="64" r="54" fill="#E3F2FD"/>
    <path d="M64 22 L98 34 L98 62 C98 86, 80 102, 64 108 C48 102, 30 86, 30 62 L30 34 Z" fill="#59B8D9" stroke="${INK}" stroke-width="6"/>
    <polyline points="49,64 60,76 82,52" fill="none" stroke="#FFFDF9" stroke-width="9"/>
  `),
};

for (const [name, svg] of Object.entries(UI_ICONS)) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 128 },
    background: 'rgba(0,0,0,0)',
  });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), resvg.render().asPng());
}

console.log(`Generated ${Object.keys(UI_ICONS).length} UI icons in ${OUT_DIR}`);
