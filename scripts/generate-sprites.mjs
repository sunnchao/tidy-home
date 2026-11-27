import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../assets/resources/sprites');
const ITEM_SPRITE_SIZE = 192;
const ITEM_SPRITE_FILL = 0.88;
const itemsOnly = process.argv.includes('--items-only');

const INK = '#3D2B24';

const THIN_INK_STROKE_MAP = {
  '4': '2.2',
  '5': '2.6',
  '6': '3.0',
  '7': '3.4',
  '8': '3.8',
  '9': '4.2',
  '10': '4.6',
  '11': '6.0',
  '12': '12',
  '14': '12.5',
  '15': '14',
  '16': '14',
  '17': '15',
  '18': '15.5',
  '20': '16',
  '24': '19',
  '26': '21',
};

function stripBakedShadowEllipse(body) {
  return body.replace(/\s*<ellipse [^>]*fill="rgba\(61,43,36,0\.1[0-9]+\)"\s*\/>/g, '');
}

function inkOutlines(body) {
  return body.replace(
    /stroke="#3D2B24" stroke-width="(\d+(?:\.\d+)?)"/gi,
    (match, width) => {
      const next = THIN_INK_STROKE_MAP[width];
      return next ? `stroke="${INK}" stroke-width="${next}"` : match;
    }
  );
}

const CRISP_ITEM_STROKE_MAP = {
  '4': '2.0',
  '5': '2.3',
  '6': '2.6',
  '7': '3.0',
  '8': '3.4',
  '9': '3.8',
  '10': '4.3',
  '11': '4.8',
  '12': '6.2',
  '14': '7.4',
  '15': '8.2',
  '16': '9.0',
  '20': '10.5',
};

function crispItemOutlines(svg) {
  return svg.replace(
    /stroke="#3D2B24" stroke-width="(\d+(?:\.\d+)?)"/gi,
    (match, width) => {
      const next = CRISP_ITEM_STROKE_MAP[width];
      return next ? `stroke="${INK}" stroke-width="${next}"` : `stroke="${INK}" stroke-width="${width}"`;
    }
  );
}

function wrapSvg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g stroke-linecap="round" stroke-linejoin="round">
    ${stripBakedShadowEllipse(body)}
  </g>
</svg>`;
}

const SPRITES = {
  handbag: wrapSvg(`
    <path d="M86 100 C86 42 170 42 170 100" fill="none" stroke="#F6C89F" stroke-width="15"/>
    <path d="M69 91 H187 Q203 91 207 111 L220 180 Q224 207 197 210 Q128 218 59 210 Q32 207 36 180 L49 111 Q53 91 69 91 Z" fill="#DF6B45" stroke="${INK}" stroke-width="9"/>
    <path d="M69 93 H187 Q204 93 204 111 Q199 151 128 157 Q57 151 52 111 Q52 93 69 93 Z" fill="#F08A64"/>
    <rect x="111" y="141" width="34" height="28" rx="9" fill="#FFE082"/>
  `),

  thermos: wrapSvg(`
    <rect x="86" y="70" width="84" height="148" rx="22" fill="#2B8C82" stroke="${INK}" stroke-width="9"/>
    <rect x="90" y="114" width="76" height="54" rx="10" fill="#62BEB3"/>
    <circle cx="128" cy="141" r="14" fill="#FC9651"/>
    <path d="M92 68 L98 38 Q128 32 158 38 L164 68 Z" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
    <rect x="110" y="24" width="36" height="16" rx="7" fill="#E04F45" stroke="${INK}" stroke-width="7"/>
  `),

  teddy: wrapSvg(`
    <ellipse cx="128" cy="222" rx="64" ry="12" fill="rgba(61,43,36,0.14)"/>
    <circle cx="72" cy="64" r="24" fill="#D48B56" stroke="${INK}" stroke-width="8"/>
    <circle cx="72" cy="64" r="12" fill="#F6C89F"/>
    <circle cx="184" cy="64" r="24" fill="#D48B56" stroke="${INK}" stroke-width="8"/>
    <circle cx="184" cy="64" r="12" fill="#F6C89F"/>
    <ellipse cx="70" cy="158" rx="22" ry="30" transform="rotate(24 70 158)" fill="#D48B56" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="186" cy="158" rx="22" ry="30" transform="rotate(-24 186 158)" fill="#D48B56" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="128" cy="164" rx="52" ry="52" fill="#D48B56" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="170" rx="31" ry="34" fill="#F7D8B6"/>
    <circle cx="86" cy="206" r="22" fill="#C67B47" stroke="${INK}" stroke-width="8"/>
    <circle cx="170" cy="206" r="22" fill="#C67B47" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="128" cy="96" rx="52" ry="44" fill="#D48B56" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="108" rx="24" ry="18" fill="#F7D8B6"/>
    <ellipse cx="128" cy="102" rx="9" ry="6" fill="${INK}"/>
    <circle cx="104" cy="88" r="6" fill="${INK}"/>
    <circle cx="152" cy="88" r="6" fill="${INK}"/>
    <path d="M112 134 L128 140 L144 134 L144 150 L128 144 L112 150 Z" fill="#EB6A5B"/>
  `),

  ukulele: wrapSvg(`
    <g transform="rotate(-32 128 128)">
      <path d="M128 94 C153 94 171 108 168 131 C166 150 185 153 185 183 C185 217 166 236 128 236 C90 236 71 217 71 183 C71 153 90 150 88 131 C85 108 103 94 128 94 Z" fill="#E8924C" stroke="${INK}" stroke-width="9"/>
      <path d="M128 101 C149 101 164 112 161 132 C158 151 176 157 176 180 C176 207 157 225 128 225 C99 225 80 207 80 180 C80 157 98 151 95 132 C92 112 107 101 128 101 Z" fill="#F2A966"/>
      <rect x="115" y="40" width="26" height="86" rx="6" fill="#C67139" stroke="${INK}" stroke-width="8"/>
      <rect x="109" y="18" width="38" height="32" rx="8" fill="#8C4E2B" stroke="${INK}" stroke-width="8"/>
      <path d="M101 34 H155" fill="none" stroke="#FFE082" stroke-width="7"/>
      <circle cx="128" cy="144" r="18" fill="#5A3324"/>
      <rect x="106" y="186" width="44" height="12" rx="5" fill="#5A3324"/>
      <path d="M124 45 V186 M132 45 V186" fill="none" stroke="#FFF3E0" stroke-opacity="0.78" stroke-width="2.5"/>
    </g>
  `),

  lamp: wrapSvg(`
    <ellipse cx="128" cy="222" rx="56" ry="12" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="128" cy="212" rx="48" ry="14" fill="#E39D5C" stroke="${INK}" stroke-width="8"/>
    <rect x="116" y="122" width="24" height="88" rx="8" fill="#F2B872" stroke="${INK}" stroke-width="8"/>
    <path d="M72 44 L184 44 L208 130 Q128 144 48 130 Z" fill="#FFE08C" stroke="${INK}" stroke-width="9"/>
    <path d="M90 54 L118 54 L104 122 L76 120 Z" fill="#FFF4C4" opacity="0.8"/>
    <line x1="158" y1="134" x2="158" y2="164" stroke="${INK}" stroke-width="6"/>
    <circle cx="158" cy="170" r="8" fill="#FC9651" stroke="${INK}" stroke-width="5"/>
  `),

  yarn: wrapSvg(`
    <path d="M180 180 C222 180, 232 222, 198 226 C172 228, 162 212, 132 216" fill="none" stroke="#E45280" stroke-width="9"/>
    <circle cx="122" cy="134" r="74" fill="#E45280" stroke="${INK}" stroke-width="9"/>
    <path d="M62 102 Q118 83 176 106 M53 133 Q119 112 190 139 M65 166 Q115 145 174 166" fill="none" stroke="#FF95B6" stroke-width="6"/>
  `),

  coffee_cup: wrapSvg(`
    <ellipse cx="124" cy="198" rx="72" ry="20" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M174 114 C214 114, 214 166, 172 166" fill="none" stroke="#D86728" stroke-width="13"/>
    <path d="M68 98 L180 98 L170 184 Q166 200 124 200 Q82 200 78 184 Z" fill="#D86728" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="124" cy="98" rx="56" ry="16" fill="#5A3320" stroke="${INK}" stroke-width="7"/>
    <path d="M98 62 Q88 44 102 28" fill="none" stroke="#D8C4B6" stroke-width="7"/>
    <path d="M154 64 Q144 46 156 32" fill="none" stroke="#D8C4B6" stroke-width="7"/>
  `),

  pan: wrapSvg(`
    <g transform="rotate(-24 128 128)">
      <rect x="150" y="118" width="84" height="22" rx="11" fill="#E88D4F" stroke="${INK}" stroke-width="8"/>
      <circle cx="218" cy="129" r="5" fill="#FFF3E0"/>
      <circle cx="96" cy="128" r="68" fill="#5A636E" stroke="${INK}" stroke-width="9"/>
      <circle cx="96" cy="128" r="50" fill="#76808C" stroke="${INK}" stroke-width="6"/>
      <path d="M76 112 C94 94, 118 104, 120 124 C122 146, 98 158, 78 144 C64 134, 62 122, 76 112 Z" fill="#FFFDF8" stroke="${INK}" stroke-width="5"/>
      <circle cx="95" cy="126" r="14" fill="#FFC94A" stroke="${INK}" stroke-width="4"/>
    </g>
  `),

  baguette: wrapSvg(`
    <g transform="rotate(-32 128 128)">
      <ellipse cx="128" cy="134" rx="98" ry="34" fill="#E59C47" stroke="${INK}" stroke-width="9"/>
      <ellipse cx="128" cy="128" rx="88" ry="24" fill="#F7BE6D"/>
      <path d="M72 108 L88 136" stroke="${INK}" stroke-width="8"/>
      <path d="M116 104 L132 136" stroke="${INK}" stroke-width="8"/>
      <path d="M160 108 L176 136" stroke="${INK}" stroke-width="8"/>
    </g>
  `),

  cake: wrapSvg(`
    <ellipse cx="128" cy="216" rx="76" ry="16" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="128" cy="204" rx="76" ry="18" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M64 128 L192 128 L192 192 Q128 210 64 192 Z" fill="#F9D9A7" stroke="${INK}" stroke-width="9"/>
    <rect x="64" y="156" width="128" height="14" fill="#E63946" stroke="${INK}" stroke-width="5"/>
    <path d="M58 126 Q64 96 128 96 Q192 96 198 126 Q188 144 170 134 Q152 146 134 132 Q116 146 98 132 Q80 144 58 126 Z" fill="#F4EDE2" stroke="${INK}" stroke-width="8"/>
    <path d="M110 88 C110 64, 146 64, 146 88 C146 104, 134 114, 128 114 C122 114, 110 104, 110 88 Z" fill="#E63946" stroke="${INK}" stroke-width="7"/>
    <path d="M118 66 Q128 56 138 66" fill="none" stroke="#6BB059" stroke-width="7"/>
    <circle cx="90" cy="108" r="8" fill="#E63946" stroke="${INK}" stroke-width="5"/>
    <circle cx="166" cy="108" r="8" fill="#E63946" stroke="${INK}" stroke-width="5"/>
  `),

  succulent: wrapSvg(`
    <path d="M72 147 H184 L174 198 Q172 217 155 218 H101 Q84 217 82 198 Z" fill="#E38154" stroke="${INK}" stroke-width="9"/>
    <path d="M128 127 C99 118 88 84 104 45 Q128 19 152 45 C168 84 157 118 128 127 Z" fill="#9AE094" stroke="${INK}" stroke-width="8"/>
    <path d="M126 128 C96 124 62 89 68 65 C101 51 127 79 126 128 Z M130 128 C160 124 194 89 188 65 C155 51 129 79 130 128 Z" fill="#84D180"/>
    <path d="M126 137 C86 142 54 120 51 96 C88 83 113 101 126 137 Z M130 137 C170 142 202 120 205 96 C168 83 143 101 130 137 Z" fill="#6EC072" stroke="${INK}" stroke-width="8"/>
    <path d="M128 146 C103 140 98 112 128 88 C158 112 153 140 128 146 Z" fill="#B6ECAC"/>
    <rect x="63" y="135" width="130" height="30" rx="12" fill="#F0976C" stroke="${INK}" stroke-width="8"/>
  `),

  camera: wrapSvg(`
    <ellipse cx="128" cy="206" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <rect x="164" y="60" width="24" height="18" rx="5" fill="#F2845C" stroke="${INK}" stroke-width="6"/>
    <rect x="44" y="72" width="168" height="122" rx="22" fill="#465668" stroke="${INK}" stroke-width="9"/>
    <rect x="44" y="72" width="168" height="40" rx="16" fill="#F5EFE6" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="138" r="44" fill="#D9E2EC"/>
    <circle cx="128" cy="138" r="34" fill="#2A4259"/>
    <circle cx="117" cy="126" r="9" fill="#5CA4D6"/>
  `),

  headphone: wrapSvg(`
    <path d="M58 142 C58 56, 198 56, 198 142" fill="none" stroke="#3B4C6B" stroke-width="20"/>
    <rect x="38" y="128" width="42" height="72" rx="20" fill="#F47A42" stroke="${INK}" stroke-width="9"/>
    <rect x="64" y="136" width="22" height="56" rx="11" fill="#2A333D"/>
    <rect x="176" y="128" width="42" height="72" rx="20" fill="#F47A42" stroke="${INK}" stroke-width="9"/>
    <rect x="170" y="136" width="22" height="56" rx="11" fill="#2A333D"/>
  `),

  book: wrapSvg(`
    <ellipse cx="128" cy="212" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M56 58 L194 48 L206 184 L68 196 Z" fill="#9E3B4B" stroke="${INK}" stroke-width="9"/>
    <path d="M56 58 L56 198 Q62 212 78 210 L206 198 L206 184 L74 194 Q64 194 64 182 Z" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M74 64 L84 190" stroke="#702432" stroke-width="8"/>
    <rect x="104" y="84" width="68" height="40" rx="8" fill="#FFE8A3"/>
    <path d="M164 188 L164 224 L178 214 L192 224 L192 186 Z" fill="#FFD147" stroke="${INK}" stroke-width="6"/>
  `),

  pillow: wrapSvg(`
    <ellipse cx="128" cy="214" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M52 64 Q128 80 204 64 Q190 132 206 196 Q128 180 50 196 Q66 132 52 64 Z" fill="#4DA6A9" stroke="${INK}" stroke-width="9"/>
    <path d="M72 84 Q128 96 184 84 Q174 130 186 176 Q128 164 70 176 Q82 130 72 84 Z" fill="#7EC6C8"/>
    <circle cx="128" cy="130" r="12" fill="#F47B6B"/>
  `),

  slipper: wrapSvg(`
    <g transform="rotate(-18 128 128)">
      <ellipse cx="128" cy="132" rx="60" ry="92" fill="#FFF4E4" stroke="${INK}" stroke-width="9"/>
      <ellipse cx="128" cy="134" rx="46" ry="76" fill="#F8D9E0"/>
      <path d="M68 118 Q128 76 188 118 L184 166 Q128 148 72 166 Z" fill="#E86F8A" stroke="${INK}" stroke-width="8"/>
      <circle cx="110" cy="116" r="6" fill="#FFF7EB"/>
      <circle cx="146" cy="116" r="6" fill="#FFF7EB"/>
      <path d="M116 132 Q128 142 140 132" fill="none" stroke="${INK}" stroke-width="6"/>
    </g>
  `),

  umbrella: wrapSvg(`
    <g transform="rotate(28 128 128)">
      <path d="M128 124 V214 C128 232 156 232 156 214" fill="none" stroke="#B98251" stroke-width="9"/>
      <path d="M128 24 L128 42" stroke="${INK}" stroke-width="9"/>
      <path d="M38 126 C38 64, 218 64, 218 126 Q190 112 162 126 Q128 112 94 126 Q66 112 38 126 Z" fill="#2D9D92" stroke="${INK}" stroke-width="9"/>
      <path d="M94 126 C96 76, 124 64, 128 64 C132 64, 160 76, 162 126 Q128 112 94 126 Z" fill="#FFE066" stroke="${INK}" stroke-width="7"/>
    </g>
  `),

  alarm_clock: wrapSvg(`
    <ellipse cx="128" cy="218" rx="58" ry="12" fill="rgba(61,43,36,0.14)"/>
    <line x1="84" y1="194" x2="70" y2="216" stroke="${INK}" stroke-width="11"/>
    <line x1="172" y1="194" x2="186" y2="216" stroke="${INK}" stroke-width="11"/>
    <circle cx="72" cy="68" r="24" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
    <circle cx="184" cy="68" r="24" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
    <rect x="116" y="42" width="24" height="16" rx="6" fill="#E38154" stroke="${INK}" stroke-width="6"/>
    <circle cx="128" cy="134" r="70" fill="#EB6A5B" stroke="${INK}" stroke-width="9"/>
    <circle cx="128" cy="134" r="52" fill="#FFF9F0" stroke="${INK}" stroke-width="7"/>
    <line x1="128" y1="134" x2="128" y2="98" stroke="${INK}" stroke-width="8"/>
    <line x1="128" y1="134" x2="156" y2="146" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="134" r="8" fill="#FC9651" stroke="${INK}" stroke-width="5"/>
  `),

  hairdryer: wrapSvg(`
    <g transform="rotate(-12 128 128)">
      <path d="M126 132 L152 208 Q156 220 140 222 L120 222 Q108 220 106 206 L94 134 Z" fill="#F08AB8" stroke="${INK}" stroke-width="9"/>
      <path d="M168 64 L216 74 L216 122 L168 132 Z" fill="#5A636E" stroke="${INK}" stroke-width="8"/>
      <path d="M62 60 Q128 52 174 64 L174 132 Q128 144 62 136 Q38 130 38 98 Q38 66 62 60 Z" fill="#FFABC9" stroke="${INK}" stroke-width="9"/>
      <circle cx="72" cy="98" r="18" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
      <circle cx="128" cy="176" r="9" fill="#FFE082" stroke="${INK}" stroke-width="5"/>
    </g>
  `),

  skincare: wrapSvg(`
    <ellipse cx="128" cy="220" rx="54" ry="12" fill="rgba(61,43,36,0.14)"/>
    <path d="M120 34 L152 34 L152 46 L132 46 L132 60 L120 60 Z" fill="#FFF7EB" stroke="${INK}" stroke-width="7"/>
    <rect x="108" y="60" width="40" height="24" rx="6" fill="#FFE082" stroke="${INK}" stroke-width="7"/>
    <rect x="78" y="84" width="100" height="132" rx="24" fill="#2F9E7E" stroke="${INK}" stroke-width="9"/>
    <rect x="92" y="114" width="72" height="64" rx="10" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <path d="M128 128 C128 128, 144 146, 144 156 A16 16 0 0 1 112 156 C112 146, 128 128, 128 128 Z" fill="#88E0C0" stroke="${INK}" stroke-width="5"/>
  `),

  cat_can: wrapSvg(`
    <ellipse cx="128" cy="212" rx="70" ry="16" fill="rgba(61,43,36,0.14)"/>
    <path d="M62 92 L194 92 L194 190 Q194 210 128 210 Q62 210 62 190 Z" fill="#FC9651" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="92" rx="66" ry="20" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="144" cy="92" rx="14" ry="7" fill="none" stroke="${INK}" stroke-width="5"/>
    <rect x="64" y="122" width="128" height="58" fill="#FFF7EB"/>
    <ellipse cx="128" cy="151" rx="27" ry="14" fill="#59B8D9"/>
    <polygon points="106,151 89,141 89,161" fill="#59B8D9"/>
    <circle cx="140" cy="148" r="3" fill="${INK}"/>
  `),

  gamepad: wrapSvg(`
    <path d="M72 76 Q128 86 184 76 C211 74 228 118 224 160 C222 203 188 209 169 173 Q163 163 152 164 H104 Q93 163 87 173 C68 209 34 203 32 160 C28 118 45 74 72 76 Z" fill="#7C65E6" stroke="${INK}" stroke-width="9"/>
    <path d="M83 112 V142 M68 127 H98" fill="none" stroke="#FFF7EB" stroke-width="10"/>
    <circle cx="174" cy="109" r="8" fill="#FFF7EB"/>
    <circle cx="192" cy="127" r="8" fill="#FFE082"/>
    <circle cx="174" cy="145" r="8" fill="#FFF7EB"/>
    <circle cx="156" cy="127" r="8" fill="#FFE082"/>
  `),

  snack_bag: wrapSvg(`
    <ellipse cx="128" cy="218" rx="64" ry="12" fill="rgba(61,43,36,0.14)"/>
    <path d="M68 50 L188 50 L176 76 L192 188 L184 210 L72 210 L64 188 L80 76 Z" fill="#FFD147" stroke="${INK}" stroke-width="9"/>
    <rect x="76" y="96" width="104" height="72" rx="14" fill="#EB6A5B" stroke="${INK}" stroke-width="7"/>
    <ellipse cx="128" cy="132" rx="30" ry="20" fill="#FFE680" stroke="${INK}" stroke-width="5"/>
    <path d="M108 132 Q128 118 148 132" fill="none" stroke="${INK}" stroke-width="5"/>
  `),

  cap: wrapSvg(`
    <ellipse cx="128" cy="202" rx="84" ry="15" fill="rgba(61,43,36,0.14)"/>
    <path d="M46 154 C46 84, 102 66, 140 66 C182 66, 206 102, 204 152 Z" fill="#D94B43" stroke="${INK}" stroke-width="9"/>
    <circle cx="130" cy="63" r="9" fill="#FFF4DE"/>
    <path d="M134 148 Q204 142 228 168 Q204 188 122 174 Z" fill="#2E4369" stroke="${INK}" stroke-width="9"/>
    <circle cx="88" cy="118" r="13" fill="#FFF4DE"/>
  `),

  cardboard_closed: wrapSvg(`
    <path d="M37 100 Q37 92 46 88 L119 54 Q128 50 137 54 L210 88 Q219 92 219 100 V179 Q219 189 210 193 L137 222 Q128 226 119 222 L46 193 Q37 189 37 179 Z" fill="#E6AB70" stroke="${INK}" stroke-width="9"/>
    <path d="M40 104 L128 141 V223 L46 190 Q40 187 40 179 Z" fill="#C98854"/>
    <path d="M39 100 Q40 93 47 90 L119 56 Q128 52 137 56 L209 90 Q216 93 217 100 L128 137 Z" fill="#F6CE9E"/>
    <path d="M77 75 L97 66 L185 105 V134 L165 143 V114 Z" fill="#FFF0BE"/>
    <path d="M59 146 L98 162 Q103 164 103 169 V179 Q103 185 98 183 L59 167 Q54 165 54 160 V150 Q54 144 59 146 Z" fill="#FFF7EB"/>
  `),

  cardboard_cracked: wrapSvg(`
    <path d="M41 106 L128 74 L215 106 V179 Q215 189 207 192 L136 221 Q128 225 120 221 L49 192 Q41 189 41 179 Z" fill="#946040" stroke="${INK}" stroke-width="9"/>
    <path d="M41 106 L128 138 V222 Q124 223 117 220 L49 192 Q41 189 41 179 Z" fill="#C98854" stroke="${INK}" stroke-width="8"/>
    <path d="M215 106 L128 138 V222 Q132 223 139 220 L207 192 Q215 189 215 179 Z" fill="#E6AB70" stroke="${INK}" stroke-width="8"/>
    <path d="M41 106 L24 73 Q21 68 28 65 L103 41 Q110 39 114 46 L128 74 Z M215 106 L232 73 Q235 68 228 65 L153 41 Q146 39 142 46 L128 74 Z" fill="#F6CE9E" stroke="${INK}" stroke-width="8"/>
    <path d="M41 106 L128 138 L107 165 Q103 170 96 168 L25 141 Q19 138 23 132 Z M215 106 L128 138 L149 165 Q153 170 160 168 L231 141 Q237 138 233 132 Z" fill="#F0BD86" stroke="${INK}" stroke-width="8"/>
  `),

  cat_idle: wrapSvg(`
    <ellipse cx="128" cy="218" rx="68" ry="14" fill="rgba(61,43,36,0.15)"/>
    <path d="M174 188 C218 188, 224 134, 198 130" fill="none" stroke="${INK}" stroke-width="20"/>
    <path d="M174 188 C218 188, 224 134, 198 130" fill="none" stroke="#F49A48" stroke-width="9"/>
    <ellipse cx="128" cy="170" rx="54" ry="48" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="182" rx="30" ry="30" fill="#FFF3DC"/>
    <polygon points="66,94 74,40 112,72" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <polygon points="190,94 182,40 144,72" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <polygon points="75,86 80,55 104,74" fill="#FFB8B8"/>
    <polygon points="181,86 176,55 152,74" fill="#FFB8B8"/>
    <ellipse cx="128" cy="108" rx="58" ry="46" fill="#F9AE63" stroke="${INK}" stroke-width="9"/>
    <path d="M118 64 L118 80 M128 62 L128 84 M138 64 L138 80" stroke="#D16F28" stroke-width="6"/>
    <circle cx="102" cy="104" r="8" fill="${INK}"/>
    <circle cx="154" cy="104" r="8" fill="${INK}"/>
    <circle cx="99" cy="101" r="2.5" fill="#FFF"/>
    <circle cx="151" cy="101" r="2.5" fill="#FFF"/>
    <polygon points="122,116 134,116 128,123" fill="#EB7B7B"/>
    <path d="M114 128 Q128 136 128 124 Q128 136 142 128" fill="none" stroke="${INK}" stroke-width="5"/>
    <circle cx="102" cy="206" r="16" fill="#FFF3DC" stroke="${INK}" stroke-width="7"/>
    <circle cx="154" cy="206" r="16" fill="#FFF3DC" stroke="${INK}" stroke-width="7"/>
  `),

  cat_mischief: wrapSvg(`
    <ellipse cx="128" cy="218" rx="68" ry="14" fill="rgba(61,43,36,0.15)"/>
    <path d="M174 188 C222 174, 224 114, 194 112" fill="none" stroke="${INK}" stroke-width="20"/>
    <path d="M174 188 C222 174, 224 114, 194 112" fill="none" stroke="#F49A48" stroke-width="9"/>
    <ellipse cx="128" cy="170" rx="54" ry="48" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <polygon points="66,94 74,40 112,72" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <polygon points="190,94 182,40 144,72" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="108" rx="58" ry="46" fill="#F9AE63" stroke="${INK}" stroke-width="9"/>
    <line x1="92" y1="94" x2="112" y2="104" stroke="${INK}" stroke-width="6"/>
    <line x1="164" y1="94" x2="144" y2="104" stroke="${INK}" stroke-width="6"/>
    <circle cx="102" cy="108" r="7" fill="${INK}"/>
    <circle cx="154" cy="108" r="7" fill="${INK}"/>
    <path d="M116 128 Q128 120 140 128" fill="none" stroke="${INK}" stroke-width="6"/>
    <path d="M64 166 L32 138" stroke="${INK}" stroke-width="24"/>
    <path d="M64 166 L32 138" stroke="#FFF3DC" stroke-width="12"/>
    <circle cx="154" cy="206" r="16" fill="#FFF3DC" stroke="${INK}" stroke-width="7"/>
  `),

  cat_happy: wrapSvg(`
    <ellipse cx="128" cy="218" rx="68" ry="14" fill="rgba(61,43,36,0.15)"/>
    <path d="M174 188 C218 188, 224 134, 198 130" fill="none" stroke="${INK}" stroke-width="20"/>
    <path d="M174 188 C218 188, 224 134, 198 130" fill="none" stroke="#F49A48" stroke-width="9"/>
    <ellipse cx="128" cy="170" rx="54" ry="48" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="182" rx="30" ry="30" fill="#FFF3DC"/>
    <polygon points="66,94 74,40 112,72" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <polygon points="190,94 182,40 144,72" fill="#F49A48" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="108" rx="58" ry="46" fill="#F9AE63" stroke="${INK}" stroke-width="9"/>
    <path d="M92 106 Q102 92 112 106" fill="none" stroke="${INK}" stroke-width="7"/>
    <path d="M144 106 Q154 92 164 106" fill="none" stroke="${INK}" stroke-width="7"/>
    <circle cx="88" cy="118" r="9" fill="#FF9CA0" opacity="0.8"/>
    <circle cx="168" cy="118" r="9" fill="#FF9CA0" opacity="0.8"/>
    <path d="M114 126 Q128 140 142 126" fill="none" stroke="${INK}" stroke-width="6"/>
    <path d="M196 42 C196 30, 212 30, 212 42 C212 30, 228 30, 228 42 C228 56, 212 66, 212 66 C212 66, 196 56, 196 42 Z" fill="#EB6A5B" stroke="${INK}" stroke-width="5"/>
  `),

  sneaker: wrapSvg(`
    <ellipse cx="128" cy="206" rx="86" ry="15" fill="rgba(61,43,36,0.14)"/>
    <path d="M40 156 L58 84 L106 84 L126 116 C158 122, 206 130, 218 164 L218 184 L40 184 Z" fill="#3FA36C" stroke="${INK}" stroke-width="9"/>
    <path d="M168 134 C194 138, 214 150, 218 172 L166 172 Z" fill="#FFFDF8" stroke="${INK}" stroke-width="7"/>
    <rect x="34" y="172" width="190" height="24" rx="11" fill="#FFFDF8" stroke="${INK}" stroke-width="8"/>
    <line x1="118" y1="114" x2="132" y2="100" stroke="#FFF4DE" stroke-width="7"/>
    <line x1="134" y1="122" x2="148" y2="108" stroke="#FFF4DE" stroke-width="7"/>
  `),

  donut: wrapSvg(`
    <defs>
      <mask id="donut-hole">
        <rect width="256" height="256" fill="#FFFFFF"/>
        <circle cx="128" cy="130" r="24" fill="#000000"/>
      </mask>
    </defs>
    <g mask="url(#donut-hole)">
      <circle cx="128" cy="130" r="80" fill="#E8A45D" stroke="${INK}" stroke-width="9"/>
      <path d="M52 120 C52 72, 204 72, 204 120 Q190 144 170 132 Q150 150 128 134 Q106 150 86 132 Q66 144 52 120 Z" fill="#6B3A24" stroke="${INK}" stroke-width="8"/>
      <line x1="84" y1="88" x2="96" y2="96" stroke="#FFE082" stroke-width="7"/>
      <line x1="164" y1="86" x2="154" y2="96" stroke="#7AE0B8" stroke-width="7"/>
      <line x1="126" y1="74" x2="136" y2="82" stroke="#FF8FAB" stroke-width="7"/>
    </g>
    <circle cx="128" cy="130" r="24" fill="none" stroke="${INK}" stroke-width="8"/>
  `),

  teacup: wrapSvg(`
    <ellipse cx="128" cy="212" rx="68" ry="14" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="128" cy="198" rx="66" ry="16" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M174 120 C208 120, 208 164, 170 164" fill="none" stroke="#58B37C" stroke-width="12"/>
    <path d="M76 106 L180 106 C178 174, 158 194, 128 194 C98 194, 78 174, 76 106 Z" fill="#58B37C" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="106" rx="52" ry="14" fill="#479A68" stroke="${INK}" stroke-width="7"/>
    <path d="M108 72 Q98 54 112 40 M144 70 Q134 52 148 38" fill="none" stroke="#D8C4B6" stroke-width="6"/>
  `),

  cactus: wrapSvg(`
    <ellipse cx="128" cy="222" rx="54" ry="12" fill="rgba(61,43,36,0.14)"/>
    <path d="M78 148 L178 148 L164 216 Q128 224 92 216 Z" fill="#FC9651" stroke="${INK}" stroke-width="9"/>
    <rect x="70" y="134" width="116" height="22" rx="9" fill="#FFB277" stroke="${INK}" stroke-width="8"/>
    <path d="M106 134 L106 58 C106 34, 150 34, 150 58 L150 134 Z" fill="#6EC072" stroke="${INK}" stroke-width="9"/>
    <path d="M106 104 L82 104 Q66 104 66 84 L66 74 C66 60, 88 60, 88 74 L88 86 L106 86" fill="#6EC072" stroke="${INK}" stroke-width="8"/>
    <path d="M150 96 L174 96 Q190 96 190 76 L190 66 C190 52, 168 52, 168 66 L168 78 L150 78" fill="#6EC072" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="36" r="11" fill="#FF7992" stroke="${INK}" stroke-width="6"/>
  `),

  notebook: wrapSvg(`
    <ellipse cx="128" cy="218" rx="68" ry="13" fill="rgba(61,43,36,0.14)"/>
    <rect x="64" y="42" width="132" height="170" rx="16" fill="#F27D9B" stroke="${INK}" stroke-width="9"/>
    <rect x="52" y="64" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="52" y="102" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="52" y="140" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="52" y="178" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="96" y="74" width="76" height="44" rx="8" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <path d="M196 92 L212 92 L212 126 L196 126" fill="#FFE082" stroke="${INK}" stroke-width="6"/>
  `),

  kettle: wrapSvg(`
    <ellipse cx="128" cy="220" rx="68" ry="13" fill="rgba(61,43,36,0.14)"/>
    <path d="M168 88 C210 88, 214 166, 174 172" fill="none" stroke="#626B76" stroke-width="14"/>
    <path d="M72 86 L40 72 L66 116" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
    <path d="M72 74 L172 74 L184 198 Q128 214 60 198 Z" fill="#E04F45" stroke="${INK}" stroke-width="9"/>
    <rect x="58" y="192" width="128" height="22" rx="9" fill="#3B424C" stroke="${INK}" stroke-width="8"/>
    <path d="M84 74 Q122 50 160 74 Z" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
  `),

  cookie_box: wrapSvg(`
    <ellipse cx="128" cy="140" rx="82" ry="64" fill="#3B78C4" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="126" rx="82" ry="56" fill="#5796E0" stroke="${INK}" stroke-width="9"/>
    <circle cx="110" cy="122" r="24" fill="#E8A45D" stroke="${INK}" stroke-width="6"/>
    <circle cx="148" cy="134" r="22" fill="#F2B872" stroke="${INK}" stroke-width="6"/>
    <circle cx="106" cy="120" r="4" fill="${INK}"/>
    <circle cx="148" cy="134" r="4" fill="${INK}"/>
  `),

  sweater: wrapSvg(`
    <ellipse cx="128" cy="206" rx="84" ry="14" fill="rgba(61,43,36,0.14)"/>
    <rect x="44" y="96" width="168" height="98" rx="20" fill="#8E7FD8" stroke="${INK}" stroke-width="9"/>
    <rect x="44" y="138" width="168" height="26" fill="#FFF4DF" stroke="${INK}" stroke-width="6"/>
    <path d="M86 96 L104 64 L152 64 L170 96 Q128 112 86 96 Z" fill="#6E5EC2" stroke="${INK}" stroke-width="8"/>
  `),

  sunglasses: wrapSvg(`
    <g transform="rotate(-12 128 128)">
      <path d="M40 112 L72 68 M216 112 L184 68" stroke="${INK}" stroke-width="9"/>
      <rect x="36" y="102" width="76" height="58" rx="22" fill="#324152" stroke="${INK}" stroke-width="10"/>
      <rect x="144" y="102" width="76" height="58" rx="22" fill="#324152" stroke="${INK}" stroke-width="10"/>
      <path d="M112 122 Q128 112 144 122" fill="none" stroke="${INK}" stroke-width="10"/>
      <line x1="52" y1="118" x2="70" y2="136" stroke="#85C4ED" stroke-width="6"/>
      <line x1="160" y1="118" x2="178" y2="136" stroke="#85C4ED" stroke-width="6"/>
    </g>
  `),

  toothbrush: wrapSvg(`
    <ellipse cx="128" cy="220" rx="54" ry="12" fill="rgba(61,43,36,0.14)"/>
    <rect x="92" y="34" width="16" height="106" rx="8" transform="rotate(-14 100 87)" fill="#EB6A5B" stroke="${INK}" stroke-width="7"/>
    <rect x="86" y="32" width="26" height="24" rx="6" transform="rotate(-14 99 44)" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <rect x="144" y="42" width="16" height="102" rx="8" transform="rotate(12 152 93)" fill="#3FA36C" stroke="${INK}" stroke-width="7"/>
    <path d="M72 114 L184 114 L170 212 Q128 220 86 212 Z" fill="#E8D5BA" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="114" rx="56" ry="14" fill="#FFF7EB" stroke="${INK}" stroke-width="7"/>
  `),

  rubber_duck: wrapSvg(`
    <path d="M55 131 C39 103 48 69 73 54 C101 37 138 51 150 79 Q163 106 146 130 C165 138 194 127 204 112 Q216 105 218 123 C228 174 187 208 127 210 C72 212 44 190 47 158 Q48 143 55 131 Z" fill="#FFD147" stroke="${INK}" stroke-width="9"/>
    <path d="M59 97 C42 91 28 99 30 110 C33 125 61 129 74 116 Q77 102 59 97 Z" fill="#FC9651" stroke="${INK}" stroke-width="7"/>
    <path d="M112 147 C135 145 154 149 173 139 C173 161 151 181 129 179 Q106 178 112 147 Z" fill="#FFE885"/>
    <circle cx="87" cy="91" r="8" fill="${INK}"/>
    <circle cx="85" cy="88" r="2.5" fill="#FFF7EB"/>
  `),

  watering_can: wrapSvg(`
    <path d="M168 106 C214 100, 222 176, 174 176" fill="none" stroke="#6EC072" stroke-width="13"/>
    <path d="M84 150 L40 94 L52 84 L96 128" fill="#6EC072" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="42" cy="86" rx="14" ry="20" transform="rotate(-40 42 86)" fill="#F0B174" stroke="${INK}" stroke-width="6"/>
    <path d="M77 105 H179 L185 175 Q187 197 169 204 Q128 216 87 204 Q69 197 71 175 Z" fill="#6EC072" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="105" rx="51" ry="16" fill="#9AE094" stroke="${INK}" stroke-width="7"/>
  `),

  paint_palette: wrapSvg(`
    <g transform="rotate(-14 128 128)">
      <path fill-rule="evenodd" d="M42 134 C38 72, 128 46, 188 76 C224 94, 224 148, 176 154 C154 156, 156 184, 172 198 C154 222, 50 206, 42 134 Z M 132 170 A 14 14 0 1 1 104 170 A 14 14 0 1 1 132 170 Z" fill="#F2C894" stroke="${INK}" stroke-width="9"/>
      <circle cx="88" cy="96" r="14" fill="#EB6A5B" stroke="${INK}" stroke-width="5"/>
      <circle cx="134" cy="84" r="14" fill="#FFD147" stroke="${INK}" stroke-width="5"/>
      <circle cx="176" cy="106" r="14" fill="#4FA1DA" stroke="${INK}" stroke-width="5"/>
      <circle cx="78" cy="144" r="14" fill="#6EC072" stroke="${INK}" stroke-width="5"/>
    </g>
  `),

  perfume: wrapSvg(`
    <ellipse cx="128" cy="220" rx="52" ry="12" fill="rgba(61,43,36,0.14)"/>
    <rect x="108" y="38" width="40" height="32" rx="8" fill="#FFE082" stroke="${INK}" stroke-width="7"/>
    <rect x="116" y="70" width="24" height="16" fill="#E39D5C" stroke="${INK}" stroke-width="6"/>
    <rect x="70" y="86" width="116" height="126" rx="28" fill="#D982B8" stroke="${INK}" stroke-width="9"/>
    <rect x="86" y="108" width="84" height="82" rx="16" fill="#F3C4E3" stroke="${INK}" stroke-width="5"/>
    <rect x="100" y="128" width="56" height="42" rx="8" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
  `),

  iron: wrapSvg(`
    <ellipse cx="128" cy="212" rx="84" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M56 146 C76 92, 134 78, 196 86 L186 112 C136 108, 108 118, 92 146 Z" fill="#A392E8" stroke="${INK}" stroke-width="8"/>
    <path d="M40 184 C56 140, 128 126, 212 146 L216 184 Z" fill="#59B8D9" stroke="${INK}" stroke-width="9"/>
    <rect x="34" y="182" width="186" height="18" rx="8" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
  `),

  teapot: wrapSvg(`
    <ellipse cx="128" cy="214" rx="68" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M174 108 C216 108, 216 168, 172 168" fill="none" stroke="#EB6A5B" stroke-width="13"/>
    <path d="M74 134 Q42 120 34 96 L52 90 Q60 110 82 114" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="126" cy="146" rx="58" ry="52" fill="#FFF7EB" stroke="${INK}" stroke-width="9"/>
    <path d="M84 96 Q126 76 168 96 Z" fill="#EB6A5B" stroke="${INK}" stroke-width="8"/>
    <circle cx="126" cy="74" r="10" fill="#EB6A5B" stroke="${INK}" stroke-width="6"/>
  `),

  apple: wrapSvg(`
    <ellipse cx="128" cy="214" rx="58" ry="12" fill="rgba(61,43,36,0.14)"/>
    <path d="M128 74 Q128 48 142 36" fill="none" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="154" cy="54" rx="22" ry="11" transform="rotate(-22 154 54)" fill="#6EC072" stroke="${INK}" stroke-width="7"/>
    <path d="M128 80 C92 64, 52 94, 58 148 C64 194, 98 210, 128 198 C158 210, 192 194, 198 148 C204 94, 164 64, 128 80 Z" fill="#EB5757" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="92" cy="116" rx="12" ry="22" transform="rotate(18 92 116)" fill="#FF9E9E" opacity="0.7"/>
  `),

  banana: wrapSvg(`
    <ellipse cx="128" cy="206" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M52 154 C76 196, 174 196, 198 112 C202 92, 192 64, 176 58 C178 96, 146 146, 52 154 Z" fill="#FFD147" stroke="${INK}" stroke-width="9"/>
    <path d="M68 134 C94 172, 168 164, 186 92 C172 118, 124 146, 68 134 Z" fill="#FFE680" stroke="${INK}" stroke-width="7"/>
    <rect x="168" y="42" width="16" height="22" rx="5" fill="#7D4B32" stroke="${INK}" stroke-width="6"/>
  `),

  milk_carton: wrapSvg(`
    <ellipse cx="128" cy="222" rx="54" ry="12" fill="rgba(61,43,36,0.14)"/>
    <polygon points="74,84 128,46 182,84 182,212 74,212" fill="#FFFDF9" stroke="${INK}" stroke-width="9"/>
    <rect x="92" y="34" width="72" height="18" rx="5" fill="#4A96D6" stroke="${INK}" stroke-width="7"/>
    <rect x="74" y="114" width="108" height="64" fill="#4A96D6" stroke="${INK}" stroke-width="6"/>
    <circle cx="128" cy="146" r="18" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
  `),

  jam_jar: wrapSvg(`
    <ellipse cx="128" cy="218" rx="58" ry="12" fill="rgba(61,43,36,0.14)"/>
    <rect x="70" y="82" width="116" height="128" rx="28" fill="#D8384F" stroke="${INK}" stroke-width="9"/>
    <rect x="86" y="116" width="84" height="64" rx="10" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <circle cx="128" cy="148" r="16" fill="#EB5757" stroke="${INK}" stroke-width="5"/>
    <rect x="76" y="54" width="104" height="32" rx="10" fill="#62B86A" stroke="${INK}" stroke-width="8"/>
  `),

  backpack: wrapSvg(`
    <path d="M105 60 V51 C105 26 151 26 151 51 V60" fill="none" stroke="#356B58" stroke-width="13"/>
    <path d="M67 145 Q45 140 43 164 V184 Q43 205 68 205 M189 145 Q211 140 213 164 V184 Q213 205 188 205" fill="#356B58"/>
    <path d="M54 109 Q54 54 128 54 Q202 54 202 109 V182 Q202 222 173 222 H83 Q54 222 54 182 Z" fill="#E5A038" stroke="${INK}" stroke-width="9"/>
    <path d="M56 106 Q128 125 200 106 V123 Q128 143 56 123 Z" fill="#356B58"/>
    <rect x="75" y="151" width="106" height="52" rx="19" fill="#D46B42"/>
    <path d="M98 170 H158" stroke="#FFF7EB" stroke-opacity="0.65" stroke-width="4"/>
  `),

  watch: wrapSvg(`
    <ellipse cx="128" cy="222" rx="38" ry="10" fill="rgba(61,43,36,0.14)"/>
    <rect x="102" y="28" width="52" height="194" rx="14" fill="#D48B56" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="126" r="52" fill="#FFE082" stroke="${INK}" stroke-width="9"/>
    <circle cx="128" cy="126" r="38" fill="#FFFDF9" stroke="${INK}" stroke-width="6"/>
    <line x1="128" y1="126" x2="128" y2="100" stroke="${INK}" stroke-width="7"/>
    <line x1="128" y1="126" x2="148" y2="136" stroke="#EB6A5B" stroke-width="7"/>
    <circle cx="128" cy="126" r="6" fill="${INK}"/>
  `),

  candle: wrapSvg(`
    <ellipse cx="128" cy="218" rx="56" ry="12" fill="rgba(61,43,36,0.14)"/>
    <path d="M128 32 C144 54, 142 74, 128 74 C114 74, 112 54, 128 32 Z" fill="#FC9651" stroke="${INK}" stroke-width="6"/>
    <circle cx="128" cy="58" r="6" fill="#FFE680"/>
    <rect x="74" y="88" width="108" height="122" rx="18" fill="#FFF3DC" stroke="${INK}" stroke-width="9"/>
    <path d="M74 102 Q92 122 108 106 Q128 124 148 104 Q166 120 182 102 L182 88 L74 88 Z" fill="#F7B764" stroke="${INK}" stroke-width="6"/>
    <rect x="94" y="138" width="68" height="42" rx="8" fill="#A6DFD1" stroke="${INK}" stroke-width="5"/>
  `),

  keychain: wrapSvg(`
    <g transform="rotate(-24 128 128)">
      <circle cx="96" cy="76" r="32" fill="none" stroke="#9BA8BB" stroke-width="10"/>
      <circle cx="96" cy="124" r="24" fill="#FFD147" stroke="${INK}" stroke-width="8"/>
      <rect x="86" y="144" width="20" height="72" rx="8" fill="#FFD147" stroke="${INK}" stroke-width="8"/>
      <rect x="106" y="180" width="24" height="14" rx="4" fill="#FFD147" stroke="${INK}" stroke-width="7"/>
      <rect x="106" y="200" width="18" height="12" rx="4" fill="#FFD147" stroke="${INK}" stroke-width="7"/>
      <circle cx="152" cy="134" r="26" fill="#FF9AA2" stroke="${INK}" stroke-width="8"/>
      <circle cx="152" cy="134" r="10" fill="#FFF7EB"/>
    </g>
  `),

  // Bathroom (8)
  soap_bottle: wrapSvg(`
    <ellipse cx="128" cy="220" rx="54" ry="11" fill="rgba(61,43,36,0.14)"/>
    <path d="M128 38 L128 66 M106 38 L158 38 L170 46" fill="none" stroke="${INK}" stroke-width="11"/>
    <rect x="112" y="64" width="32" height="24" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="7"/>
    <rect x="74" y="88" width="108" height="124" rx="28" fill="#F0B83A" stroke="${INK}" stroke-width="9"/>
    <rect x="90" y="122" width="76" height="58" rx="12" fill="#FFFDF9" stroke="${INK}" stroke-width="6"/>
    <circle cx="128" cy="151" r="14" fill="#FFD966" stroke="${INK}" stroke-width="5"/>
  `),

  towel_roll: wrapSvg(`
    <ellipse cx="128" cy="210" rx="82" ry="15" fill="rgba(61,43,36,0.14)"/>
    <g transform="rotate(-16 128 134)">
      <rect x="44" y="82" width="154" height="94" rx="32" fill="#FFF9F0" stroke="${INK}" stroke-width="9"/>
      <rect x="82" y="84" width="22" height="90" fill="#EC7755"/>
      <rect x="124" y="84" width="22" height="90" fill="#F7B293"/>
      <ellipse cx="192" cy="129" rx="22" ry="47" fill="#FFEFE4" stroke="${INK}" stroke-width="8"/>
      <path d="M192 104 C202 114, 202 144, 190 152 C180 158, 174 142, 182 128 C186 122, 194 124, 192 134" fill="none" stroke="${INK}" stroke-width="6"/>
    </g>
  `),

  bath_sponge: wrapSvg(`
    <path d="M128 52 C122 30, 152 24, 152 46" fill="none" stroke="${INK}" stroke-width="8"/>
    <path d="M128 66 C154 58, 178 72, 182 96 C206 106, 210 140, 190 158 C194 186, 168 208, 142 198 C126 214, 96 206, 86 184 C60 184, 48 156, 62 134 C46 112, 60 80, 88 80 C98 58, 120 56, 128 66 Z" fill="#FF8FAB" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="116" cy="112" rx="34" ry="26" fill="#FFABC0"/>
    <ellipse cx="146" cy="150" rx="30" ry="22" fill="#FF7597"/>
    <circle cx="128" cy="132" r="24" fill="#FFB8C9"/>
  `),

  shampoo: wrapSvg(`
    <ellipse cx="128" cy="222" rx="48" ry="11" fill="rgba(61,43,36,0.14)"/>
    <rect x="108" y="30" width="40" height="30" rx="8" fill="#FFD147" stroke="${INK}" stroke-width="7"/>
    <path d="M84 62 L172 62 L182 198 Q182 214 164 214 L92 214 Q74 214 74 198 Z" fill="#3F5EC4" stroke="${INK}" stroke-width="9"/>
    <rect x="92" y="108" width="72" height="72" rx="14" fill="#FFFDF9" stroke="${INK}" stroke-width="6"/>
    <path d="M128 122 C142 138, 142 158, 128 164 C114 158, 114 138, 128 122 Z" fill="#59B8D9" stroke="${INK}" stroke-width="5"/>
  `),

  comb: wrapSvg(`
    <g transform="rotate(-30 128 128)">
      <rect x="34" y="92" width="188" height="30" rx="14" fill="#E8924C" stroke="${INK}" stroke-width="9"/>
      <path d="M55 122 V171 M82 122 V171 M109 122 V171 M136 122 V171 M163 122 V171 M190 122 V171" stroke="#D99B53" stroke-width="9"/>
    </g>
  `),

  bath_bomb: wrapSvg(`
    <ellipse cx="128" cy="216" rx="64" ry="13" fill="rgba(61,43,36,0.14)"/>
    <circle cx="128" cy="134" r="72" fill="#B39DDB" stroke="${INK}" stroke-width="9"/>
    <path d="M58 126 Q94 106 128 128 Q162 150 198 126" fill="none" stroke="#80DEEA" stroke-width="18"/>
    <circle cx="96" cy="92" r="12" fill="#E1BEE7"/>
  `),

  mirror_hand: wrapSvg(`
    <g transform="rotate(-20 128 128)">
      <rect x="116" y="146" width="24" height="82" rx="12" fill="#E5A93B" stroke="${INK}" stroke-width="8"/>
      <circle cx="128" cy="94" r="64" fill="#E5A93B" stroke="${INK}" stroke-width="9"/>
      <circle cx="128" cy="94" r="48" fill="#D8F3FF" stroke="${INK}" stroke-width="6"/>
      <line x1="98" y1="74" x2="128" y2="104" stroke="#FFFFFF" stroke-width="10"/>
    </g>
  `),

  bucket_wash: wrapSvg(`
    <ellipse cx="128" cy="214" rx="70" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M62 96 C62 36, 194 36, 194 96" fill="none" stroke="${INK}" stroke-width="11"/>
    <path d="M56 96 L200 96 L182 204 Q128 218 74 204 Z" fill="#EA7D4F" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="96" rx="74" ry="18" fill="#FFC299" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="128" cy="98" rx="52" ry="10" fill="#7ACBE8" opacity="0.72"/>
    <circle cx="110" cy="92" r="9" fill="#FFFDF9" stroke="${INK}" stroke-width="4"/>
    <circle cx="148" cy="90" r="7" fill="#FFFDF9" stroke="${INK}" stroke-width="4"/>
  `),

  // Study / Art Studio (8)
  globe: wrapSvg(`
    <ellipse cx="128" cy="222" rx="56" ry="12" fill="rgba(61,43,36,0.14)"/>
    <path d="M84 214 L172 214 L156 196 L100 196 Z" fill="#C67B47" stroke="${INK}" stroke-width="8"/>
    <rect x="120" y="172" width="16" height="24" fill="#D48B56" stroke="${INK}" stroke-width="7"/>
    <path d="M128 42 A70 70 0 0 1 128 182" fill="none" stroke="#E9AB58" stroke-width="11"/>
    <circle cx="120" cy="112" r="56" fill="#4FA1DA" stroke="${INK}" stroke-width="9"/>
    <path d="M90 88 Q114 78 124 98 Q112 122 92 114 Z M134 114 Q156 106 160 132 Q140 148 128 134 Z" fill="#A6DC88"/>
  `),

  fountain_pen: wrapSvg(`
    <g transform="rotate(-36 128 128)">
      <rect x="108" y="88" width="40" height="128" rx="14" fill="#2F487A" stroke="${INK}" stroke-width="9"/>
      <rect x="104" y="114" width="48" height="16" rx="4" fill="#FFD147" stroke="${INK}" stroke-width="6"/>
      <polygon points="108,88 148,88 138,34 128,22 118,34" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
      <line x1="128" y1="26" x2="128" y2="62" stroke="${INK}" stroke-width="5"/>
      <circle cx="128" cy="64" r="5" fill="${INK}"/>
    </g>
  `),

  magnifying_glass: wrapSvg(`
    <g transform="rotate(-35 128 128)">
      <rect x="116" y="142" width="24" height="84" rx="12" fill="#D48B56" stroke="${INK}" stroke-width="8"/>
      <circle cx="128" cy="90" r="60" fill="#FFD147" stroke="${INK}" stroke-width="9"/>
      <circle cx="128" cy="90" r="44" fill="#D5F3FF" stroke="${INK}" stroke-width="6"/>
      <path d="M100 72 A32 32 0 0 1 136 56" fill="none" stroke="#FFFFFF" stroke-width="8"/>
    </g>
  `),

  paint_tube: wrapSvg(`
    <g transform="rotate(-24 128 128)">
      <rect x="114" y="28" width="28" height="24" rx="5" fill="#FFFDF9" stroke="${INK}" stroke-width="7"/>
      <path d="M90 52 L166 52 L176 198 L80 198 Z" fill="#E85A70" stroke="${INK}" stroke-width="9"/>
      <rect x="74" y="196" width="108" height="22" rx="6" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
      <rect x="94" y="90" width="68" height="68" rx="10" fill="#FFFDF9" stroke="${INK}" stroke-width="6"/>
      <circle cx="128" cy="124" r="18" fill="#EB5757" stroke="${INK}" stroke-width="5"/>
    </g>
  `),

  scissors: wrapSvg(`
    <g transform="rotate(-20 128 128)">
      <polygon points="118,128 96,34 118,46 128,118" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
      <polygon points="138,128 160,34 138,46 128,118" fill="#B8C4D0" stroke="${INK}" stroke-width="8"/>
      <circle cx="94" cy="184" r="32" fill="none" stroke="#EB6A5B" stroke-width="15"/>
      <circle cx="162" cy="184" r="32" fill="none" stroke="#EB6A5B" stroke-width="15"/>
      <circle cx="128" cy="126" r="9" fill="#FFD147" stroke="${INK}" stroke-width="5"/>
    </g>
  `),

  tape_roll: wrapSvg(`
    <path fill-rule="evenodd" d="M 128 58 A 74 74 0 1 0 128 206 A 74 74 0 1 0 128 58 Z M 128 98 A 34 34 0 1 1 128 166 A 34 34 0 1 1 128 98 Z" fill="#5BC070" stroke="${INK}" stroke-width="9"/>
    <path fill-rule="evenodd" d="M 128 98 A 34 34 0 1 0 128 166 A 34 34 0 1 0 128 98 Z M 128 112 A 20 20 0 1 1 128 152 A 20 20 0 1 1 128 112 Z" fill="#F2D9B8" stroke="${INK}" stroke-width="7"/>
    <circle cx="88" cy="96" r="8" fill="#FFE680"/>
    <circle cx="168" cy="98" r="8" fill="#FFE680"/>
    <circle cx="166" cy="172" r="8" fill="#FFE680"/>
    <circle cx="88" cy="170" r="8" fill="#FFE680"/>
  `),

  calculator: wrapSvg(`
    <ellipse cx="128" cy="222" rx="60" ry="11" fill="rgba(61,43,36,0.14)"/>
    <rect x="64" y="40" width="128" height="176" rx="22" fill="#85CFA0" stroke="${INK}" stroke-width="9"/>
    <rect x="82" y="60" width="92" height="40" rx="8" fill="#D5EBE0" stroke="${INK}" stroke-width="6"/>
    <rect x="82" y="116" width="24" height="22" rx="5" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
    <rect x="116" y="116" width="24" height="22" rx="5" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
    <rect x="150" y="116" width="24" height="22" rx="5" fill="#FC9651" stroke="${INK}" stroke-width="5"/>
    <rect x="82" y="148" width="24" height="22" rx="5" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
    <rect x="116" y="148" width="24" height="22" rx="5" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
    <rect x="150" y="148" width="24" height="54" rx="5" fill="#FFD147" stroke="${INK}" stroke-width="5"/>
    <rect x="82" y="180" width="58" height="22" rx="5" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
  `),

  telescope: wrapSvg(`
    <g transform="rotate(-28 128 128)">
      <rect x="148" y="88" width="60" height="52" rx="8" fill="#3E5C9A" stroke="${INK}" stroke-width="9"/>
      <rect x="88" y="96" width="66" height="36" rx="6" fill="#5982C4" stroke="${INK}" stroke-width="8"/>
      <rect x="44" y="102" width="48" height="24" rx="5" fill="#FFD147" stroke="${INK}" stroke-width="7"/>
      <ellipse cx="208" cy="114" rx="10" ry="26" fill="#A5E6FA" stroke="${INK}" stroke-width="6"/>
      <line x1="126" y1="136" x2="96" y2="210" stroke="${INK}" stroke-width="10"/>
      <line x1="126" y1="136" x2="156" y2="210" stroke="${INK}" stroke-width="10"/>
    </g>
  `),

  // Sakura Cafe (8)
  macaron: wrapSvg(`
    <ellipse cx="128" cy="216" rx="68" ry="14" fill="rgba(61,43,36,0.14)"/>
    <rect x="56" y="156" width="144" height="44" rx="22" fill="#85CFA0" stroke="${INK}" stroke-width="8"/>
    <rect x="64" y="172" width="128" height="12" fill="#FFF7EB" stroke="${INK}" stroke-width="5"/>
    <rect x="62" y="104" width="132" height="44" rx="22" fill="#FFD147" stroke="${INK}" stroke-width="8"/>
    <rect x="70" y="120" width="116" height="12" fill="#FFF7EB" stroke="${INK}" stroke-width="5"/>
    <rect x="68" y="52" width="120" height="44" rx="22" fill="#FF8FAB" stroke="${INK}" stroke-width="8"/>
    <rect x="76" y="68" width="104" height="12" fill="#FFF7EB" stroke="${INK}" stroke-width="5"/>
  `),

  boba_tea: wrapSvg(`
    <ellipse cx="128" cy="222" rx="50" ry="11" fill="rgba(61,43,36,0.14)"/>
    <rect x="136" y="24" width="18" height="72" rx="6" transform="rotate(10 136 24)" fill="#F48C56" stroke="${INK}" stroke-width="7"/>
    <path d="M74 78 L182 78 L166 212 Q128 220 90 212 Z" fill="#E8C39E" stroke="${INK}" stroke-width="9"/>
    <path d="M84 156 L172 156 L166 210 Q128 218 90 210 Z" fill="#C98245"/>
    <ellipse cx="128" cy="78" rx="58" ry="16" fill="#5CC2A6" stroke="${INK}" stroke-width="8"/>
    <circle cx="104" cy="192" r="9" fill="${INK}"/>
    <circle cx="128" cy="196" r="9" fill="${INK}"/>
    <circle cx="152" cy="190" r="9" fill="${INK}"/>
    <circle cx="116" cy="174" r="8" fill="${INK}"/>
    <circle cx="142" cy="176" r="8" fill="${INK}"/>
  `),

  croissant: wrapSvg(`
    <ellipse cx="128" cy="204" rx="80" ry="16" fill="rgba(61,43,36,0.14)"/>
    <path d="M44 156 C44 96, 212 96, 212 156 C212 184, 184 188, 168 170 C150 184, 106 184, 88 170 C72 188, 44 184, 44 156 Z" fill="#F5A642" stroke="${INK}" stroke-width="9"/>
    <path d="M86 106 Q94 144 88 170" fill="none" stroke="${INK}" stroke-width="7"/>
    <path d="M170 106 Q162 144 168 170" fill="none" stroke="${INK}" stroke-width="7"/>
    <ellipse cx="128" cy="134" rx="34" ry="26" fill="#FFBE6B" stroke="${INK}" stroke-width="7"/>
  `),

  ice_cream: wrapSvg(`
    <ellipse cx="128" cy="222" rx="44" ry="10" fill="rgba(61,43,36,0.14)"/>
    <polygon points="82,118 174,118 128,218" fill="#F5B86E" stroke="${INK}" stroke-width="9"/>
    <line x1="100" y1="142" x2="156" y2="142" stroke="#D48B44" stroke-width="5"/>
    <line x1="112" y1="170" x2="144" y2="170" stroke="#D48B44" stroke-width="5"/>
    <circle cx="128" cy="96" r="46" fill="#6AD4AC" stroke="${INK}" stroke-width="9"/>
    <circle cx="128" cy="58" r="34" fill="#FF7BA3" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="30" r="13" fill="#EB5757" stroke="${INK}" stroke-width="6"/>
  `),

  pudding: wrapSvg(`
    <ellipse cx="128" cy="216" rx="74" ry="15" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="128" cy="196" rx="76" ry="20" fill="#FFFDF9" stroke="${INK}" stroke-width="8"/>
    <path d="M72 178 L90 92 Q128 80 166 92 L184 178 Q128 194 72 178 Z" fill="#FFE082" stroke="${INK}" stroke-width="9"/>
    <path d="M88 94 Q128 80 168 94 L174 118 Q154 134 140 116 Q128 136 112 116 Q98 132 82 116 Z" fill="#8C4E2B" stroke="${INK}" stroke-width="7"/>
    <circle cx="128" cy="76" r="14" fill="#EB5757" stroke="${INK}" stroke-width="6"/>
  `),

  cupcake: wrapSvg(`
    <ellipse cx="128" cy="216" rx="58" ry="13" fill="rgba(61,43,36,0.14)"/>
    <path d="M70 132 L186 132 L170 206 Q128 214 86 206 Z" fill="#F5C754" stroke="${INK}" stroke-width="9"/>
    <line x1="100" y1="136" x2="108" y2="206" stroke="${INK}" stroke-width="5"/>
    <line x1="128" y1="136" x2="128" y2="208" stroke="${INK}" stroke-width="5"/>
    <line x1="156" y1="136" x2="148" y2="206" stroke="${INK}" stroke-width="5"/>
    <path d="M58 128 C54 88, 96 64, 128 60 C160 64, 202 88, 198 128 Q128 144 58 128 Z" fill="#8C72E0" stroke="${INK}" stroke-width="9"/>
    <circle cx="128" cy="48" r="14" fill="#EB5757" stroke="${INK}" stroke-width="6"/>
  `),

  cherry_pie: wrapSvg(`
    <ellipse cx="128" cy="212" rx="76" ry="15" fill="rgba(61,43,36,0.14)"/>
    <path d="M52 152 L204 152 L188 198 Q128 212 68 198 Z" fill="#F2B872" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="142" rx="82" ry="34" fill="#E59C47" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="142" rx="64" ry="22" fill="#D93B58" stroke="${INK}" stroke-width="6"/>
    <line x1="82" y1="128" x2="174" y2="156" stroke="#F7BE6D" stroke-width="9"/>
    <line x1="82" y1="156" x2="174" y2="128" stroke="#F7BE6D" stroke-width="9"/>
    <circle cx="128" cy="116" r="14" fill="#EB5757" stroke="${INK}" stroke-width="6"/>
  `),

  menu_board: wrapSvg(`
    <ellipse cx="128" cy="220" rx="64" ry="12" fill="rgba(61,43,36,0.14)"/>
    <rect x="64" y="42" width="128" height="172" rx="16" fill="#B5703A" stroke="${INK}" stroke-width="9"/>
    <rect x="78" y="58" width="100" height="122" rx="8" fill="#36404A" stroke="${INK}" stroke-width="6"/>
    <line x1="94" y1="86" x2="162" y2="86" stroke="#FFE082" stroke-width="7"/>
    <line x1="94" y1="114" x2="148" y2="114" stroke="#FFFDF9" stroke-width="6"/>
    <line x1="94" y1="140" x2="156" y2="140" stroke="#7AE0B8" stroke-width="6"/>
  `),

  // Semantic natural poses (draping, leaning upright, open/sideways, corner tucking)
  sweater_drape_back: wrapSvg(`
    <path d="M90 22 C110 14, 152 16, 170 28 L174 88 L82 88 Z" fill="#8C664A" stroke="${INK}" stroke-width="8"/>
    <path d="M84 36 C104 20, 154 20, 174 38 L184 224 Q130 236 74 220 Z" fill="#A87F5F" stroke="${INK}" stroke-width="9"/>
    <path d="M128 32 L124 226" fill="none" stroke="${INK}" stroke-width="5"/>
    <path d="M92 34 L124 88 L92 100 Z" fill="#8C664A" stroke="${INK}" stroke-width="6"/>
    <path d="M164 34 L132 88 L164 100 Z" fill="#8C664A" stroke="${INK}" stroke-width="6"/>
    <rect x="88" y="138" width="30" height="32" rx="6" fill="#C49A78" stroke="${INK}" stroke-width="5"/>
    <path d="M88 138 L118 138 L112 150 L94 150 Z" fill="#8C664A" stroke="${INK}" stroke-width="5"/>
    <circle cx="134" cy="118" r="4" fill="#FFF4DF"/>
    <circle cx="134" cy="154" r="4" fill="#FFF4DF"/>
  `),

  sweater_drape_edge: wrapSvg(`
    <path d="M62 34 Q128 22 194 34 L198 76 Q128 92 58 76 Z" fill="#9E7EB8" stroke="${INK}" stroke-width="9"/>
    <path d="M60 72 L124 80 L114 218 Q90 226 70 218 Z" fill="#B595CE" stroke="${INK}" stroke-width="9"/>
    <path d="M196 72 L132 80 L142 224 Q166 232 186 222 Z" fill="#A585BE" stroke="${INK}" stroke-width="9"/>
    <rect x="69" y="204" width="46" height="16" rx="6" fill="#8C6BA8" stroke="${INK}" stroke-width="6"/>
    <rect x="141" y="210" width="46" height="16" rx="6" fill="#8C6BA8" stroke="${INK}" stroke-width="6"/>
    <path d="M128 40 L128 84" stroke="${INK}" stroke-width="5"/>
  `),

  towel_roll_drape: wrapSvg(`
    <path d="M50 48 Q128 34 198 52 L190 104 Q128 92 48 100 Z" fill="#F8E7D2" stroke="${INK}" stroke-width="8"/>
    <path d="M52 88 Q128 76 196 92 L206 196 Q160 214 128 198 Q94 212 50 192 Z" fill="#FFF5E8" stroke="${INK}" stroke-width="9"/>
    <path d="M56 134 Q128 124 202 138" fill="none" stroke="#EC7755" stroke-width="14"/>
    <path d="M54 164 Q128 154 204 168" fill="none" stroke="#F7B293" stroke-width="10"/>
    <path d="M56 134 Q128 124 202 138" fill="none" stroke="${INK}" stroke-width="4" stroke-opacity="0.35"/>
    <path d="M128 88 Q124 146 128 198" fill="none" stroke="${INK}" stroke-width="5"/>
  `),

  ukulele_lean: wrapSvg(`
    <g transform="rotate(-7 128 128)">
      <rect x="114" y="16" width="28" height="26" rx="6" fill="#8C4E2B" stroke="${INK}" stroke-width="8"/>
      <path d="M107 24 H149 M107 34 H149" stroke="#FFE082" stroke-width="6"/>
      <rect x="117" y="38" width="22" height="72" rx="4" fill="#C67139" stroke="${INK}" stroke-width="7"/>
      <path d="M128 98 C156 98 172 114 167 138 C164 156 184 162 184 194 C184 226 162 240 128 240 C94 240 72 226 72 194 C72 162 92 156 89 138 C84 114 100 98 128 98 Z" fill="#E8924C" stroke="${INK}" stroke-width="9"/>
      <circle cx="128" cy="148" r="18" fill="#5A3324" stroke="${INK}" stroke-width="5"/>
      <rect x="106" y="192" width="44" height="12" rx="5" fill="#5A3324"/>
      <path d="M124 42 V192 M132 42 V192" fill="none" stroke="#FFF3E0" stroke-width="2.5"/>
    </g>
  `),

  umbrella_lean: wrapSvg(`
    <g transform="rotate(8 128 128)">
      <path d="M128 24 C150 24 152 54 134 54" fill="none" stroke="#B98251" stroke-width="11"/>
      <path d="M128 24 C150 24 152 54 134 54" fill="none" stroke="${INK}" stroke-width="4"/>
      <path d="M124 46 L132 232" stroke="${INK}" stroke-width="8"/>
      <path d="M104 68 Q128 60 152 68 L142 196 Q128 206 114 196 Z" fill="#2D9D92" stroke="${INK}" stroke-width="8"/>
      <path d="M108 118 Q128 126 148 118" fill="none" stroke="#FFE066" stroke-width="9"/>
      <path d="M108 118 Q128 126 148 118" fill="none" stroke="${INK}" stroke-width="4"/>
    </g>
  `),

  book_open: wrapSvg(`
    <path d="M24 72 Q76 52 128 70 Q180 52 232 72 L240 190 Q182 174 128 196 Q74 174 16 190 Z" fill="#9E3B4B" stroke="${INK}" stroke-width="9"/>
    <path d="M34 62 Q82 44 128 66 L128 184 Q80 162 28 180 Z" fill="#FFF7EB" stroke="${INK}" stroke-width="7"/>
    <path d="M222 62 Q174 44 128 66 L128 184 Q176 162 228 180 Z" fill="#FFFDF9" stroke="${INK}" stroke-width="7"/>
    <rect x="46" y="82" width="64" height="44" rx="6" fill="#A6DFD1" stroke="${INK}" stroke-width="5"/>
    <circle cx="78" cy="104" r="13" fill="#6EC072"/>
    <line x1="48" y1="142" x2="108" y2="140" stroke="${INK}" stroke-width="5"/>
    <line x1="48" y1="158" x2="98" y2="156" stroke="${INK}" stroke-width="5"/>
    <rect x="146" y="84" width="64" height="40" rx="6" fill="#FFE082" stroke="${INK}" stroke-width="5"/>
    <line x1="148" y1="142" x2="208" y2="144" stroke="${INK}" stroke-width="5"/>
    <line x1="148" y1="158" x2="196" y2="160" stroke="${INK}" stroke-width="5"/>
  `),

  thermos_lie: wrapSvg(`
    <g transform="rotate(-14 128 128)">
      <rect x="74" y="88" width="144" height="80" rx="22" fill="#2B8C82" stroke="${INK}" stroke-width="9"/>
      <rect x="116" y="92" width="52" height="72" rx="8" fill="#62BEB3"/>
      <circle cx="142" cy="128" r="13" fill="#FC9651"/>
      <path d="M72 94 L42 100 Q34 128 42 156 L72 162 Z" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
      <rect x="24" y="110" width="16" height="36" rx="7" fill="#E04F45" stroke="${INK}" stroke-width="7"/>
    </g>
  `),

  cat_can_tilt: wrapSvg(`
    <g transform="rotate(-11 128 128)">
      <path d="M40 88 L202 88 Q224 88 224 128 Q224 168 202 168 L40 168 Z" fill="#FC9651" stroke="${INK}" stroke-width="9"/>
      <ellipse cx="40" cy="128" rx="16" ry="40" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
      <ellipse cx="40" cy="128" rx="7" ry="16" fill="none" stroke="${INK}" stroke-width="5"/>
      <rect x="88" y="90" width="76" height="76" fill="#FFF7EB"/>
      <ellipse cx="126" cy="128" rx="18" ry="11" fill="#59B8D9"/>
      <polygon points="108,128 96,120 96,136" fill="#59B8D9"/>
    </g>
  `),

  snack_bag_tuck: wrapSvg(`
    <g transform="rotate(11 128 128)">
      <path d="M74 52 L182 52 L172 78 L186 184 L178 206 L78 206 L70 184 L84 78 Z" fill="#FFD147" stroke="${INK}" stroke-width="9"/>
      <rect x="82" y="98" width="92" height="66" rx="14" fill="#EB6A5B" stroke="${INK}" stroke-width="7"/>
      <ellipse cx="128" cy="131" rx="26" ry="16" fill="#FFE680" stroke="${INK}" stroke-width="5"/>
    </g>
  `),

  keychain_tuck: wrapSvg(`
    <g transform="rotate(28 128 128)">
      <circle cx="88" cy="116" r="28" fill="none" stroke="#9BA8BB" stroke-width="10"/>
      <circle cx="88" cy="116" r="28" fill="none" stroke="${INK}" stroke-width="4"/>
      <path d="M114 114 L196 100 L196 120 L180 120 L180 132 L162 132 L162 120 L114 124 Z" fill="#FFD147" stroke="${INK}" stroke-width="7"/>
      <path d="M92 142 L134 202 L114 214 L76 148 Z" fill="#FF9AA2" stroke="${INK}" stroke-width="7"/>
      <circle cx="96" cy="166" r="6" fill="#FFF7EB"/>
    </g>
  `),
};

const VARIANT_PALETTES = {
  handbag_v2: { base: 'handbag', map: { '#DF6B45': '#45A9B8', '#F08A64': '#74CEDB', '#F6C89F': '#B8ECFA' } },
  handbag_v3: { base: 'handbag', map: { '#DF6B45': '#C94A78', '#F08A64': '#EB7AA3', '#F6C89F': '#FAD2E0' } },
  ukulele_v2: { base: 'ukulele', map: { '#E8924C': '#49B0A6', '#F2A966': '#78D1C8', '#C67139': '#2E7E76', '#8C4E2B': '#235B55' } },
  yarn_v2: { base: 'yarn', map: { '#E45280': '#4D9CE0', '#FF95B6': '#9CD0FA' } },
  yarn_v3: { base: 'yarn', map: { '#E45280': '#F0AA36', '#FF95B6': '#FFE082' } },
  succulent_v2: { base: 'succulent', map: { '#E38154': '#49A69C', '#F0976C': '#77C9C0', '#6EC072': '#9B7AD6', '#84D180': '#B497EB', '#9AE094': '#CEB9F7', '#B6ECAC': '#E6DAFF' } },
  succulent_v3: { base: 'succulent', map: { '#E38154': '#C9966B', '#F0976C': '#E8BE96', '#6EC072': '#EB6A8A', '#84D180': '#F78CA6', '#9AE094': '#FFAFC3', '#B6ECAC': '#FFD9E2' } },
  headphone_v2: { base: 'headphone', map: { '#3B4C6B': '#D3B78F', '#F47A42': '#49B0A6' } },
  umbrella_v2: { base: 'umbrella', map: { '#2D9D92': '#E85D88', '#FFE066': '#FFF2CC' } },
  gamepad_v2: { base: 'gamepad', map: { '#7C65E6': '#4BA698', '#FFF7EB': '#FFF0D8' } },
  sneaker_v2: { base: 'sneaker', map: { '#3FA36C': '#D94B43', '#FFFDF8': '#FFF6EA' } },
  watering_can_v2: { base: 'watering_can', map: { '#6EC072': '#F4B83A', '#9AE094': '#FFE082', '#F0B174': '#E86A5B' } },
  candle_v2: { base: 'candle', map: { '#FFF3DC': '#E5D9FA', '#F7B764': '#B392E8', '#A6DFD1': '#FFD147' } },
  cap_v2: { base: 'cap', map: { '#D94B43': '#4E9F6E', '#2E4369': '#E89A3C' } },
  backpack_v2: { base: 'backpack', map: { '#E5A038': '#4DA69B', '#356B58': '#2E4369', '#D46B42': '#F2B84B' } },
  backpack_v3: { base: 'backpack', map: { '#E5A038': '#8D73DE', '#356B58': '#E85D88', '#D46B42': '#FFD147' } },
  soap_bottle_v2: { base: 'soap_bottle', map: { '#F0B83A': '#4AB5A8', '#FFD966': '#88E0D4' } },
  towel_roll_v2: { base: 'towel_roll', map: { '#EC7755': '#4A90D6', '#F7B293': '#89C2F5' } },
  bath_sponge_v2: { base: 'bath_sponge', map: { '#FF8FAB': '#6ED4B0', '#FFABC0': '#99E6CB', '#FF7597': '#45B890', '#FFB8C9': '#BAF2DE' } },
  shampoo_v2: { base: 'shampoo', map: { '#3F5EC4': '#E86A8A', '#FFD147': '#FFF3E0', '#59B8D9': '#FFB2C4' } },
  mirror_hand_v2: { base: 'mirror_hand', map: { '#E5A93B': '#EB7598' } },
  bucket_wash_v2: { base: 'bucket_wash', map: { '#EA7D4F': '#4E9FD6', '#FFC299': '#A6DBFA' } },
  rubber_duck_v2: { base: 'rubber_duck', map: { '#FFD147': '#76C7F0', '#FFE885': '#B5E4FA' } },
  hairdryer_v2: { base: 'hairdryer', map: { '#FFABC9': '#74D1B8', '#F08AB8': '#47B096' } },
  perfume_v2: { base: 'perfume', map: { '#D982B8': '#E8A03E', '#F3C4E3': '#FFE09C' } },
  book_v2: { base: 'book', map: { '#9E3B4B': '#3B7D5C', '#702432': '#26573F', '#FFE8A3': '#CBEED6' } },
  notebook_v2: { base: 'notebook', map: { '#F27D9B': '#4D95D6', '#FFE082': '#7AE0B8' } },
  camera_v2: { base: 'camera', map: { '#465668': '#9E5F3E', '#F5EFE6': '#FFF2D6', '#F2845C': '#56B89A' } },
  cactus_v2: { base: 'cactus', map: { '#FC9651': '#4DA6A9', '#FFB277': '#80CED1', '#FF7992': '#FFD147' } },
  boba_tea_v2: { base: 'boba_tea', map: { '#C98245': '#7AC272', '#E8C39E': '#CFEBC8', '#5CC2A6': '#E878A2', '#F48C56': '#FFD147' } },
  cupcake_v2: { base: 'cupcake', map: { '#8C72E0': '#FF7EA6', '#F5C754': '#8CE09A' } },
  cake_v2: { base: 'cake', map: { '#F4EDE2': '#854D32', '#E63946': '#F2994A', '#F9D9A7': '#F5CA82' } },
  coffee_cup_v2: { base: 'coffee_cup', map: { '#D86728': '#4478C4' } },
  jam_jar_v2: { base: 'jam_jar', map: { '#D8384F': '#5462B8', '#EB5757': '#7D8CE0', '#62B86A': '#F2A83B' } },
  snack_bag_v2: { base: 'snack_bag', map: { '#FFD147': '#E85A4A', '#EB6A5B': '#4E9F6E', '#FFE680': '#FFD147' } },
  kettle_v2: { base: 'kettle', map: { '#E04F45': '#54B8A2', '#FFE082': '#FFF7EB' } },
  teapot_v2: { base: 'teapot', map: { '#FFF7EB': '#D9F2DF', '#EB6A5B': '#479A68' } },
  thermos_v2: { base: 'thermos', map: { '#2B8C82': '#E86A8C', '#62BEB3': '#FFA3BD', '#E04F45': '#4A90D6' } },
  thermos_v3: { base: 'thermos', map: { '#2B8C82': '#E59C32', '#62BEB3': '#FFCA6E', '#FC9651': '#4E9F6E' } },
  teddy_v2: { base: 'teddy', map: { '#D48B56': '#F5E6D3', '#C67B47': '#DEC8B0', '#F7D8B6': '#FFFDF9', '#F6C89F': '#FFD9E2', '#EB6A5B': '#4A90D6' } },
  teddy_v3: { base: 'teddy', map: { '#D48B56': '#8C563C', '#C67B47': '#6E3F29', '#F7D8B6': '#E8C6A8', '#EB6A5B': '#FFD147' } },
  pillow_v2: { base: 'pillow', map: { '#4DA6A9': '#F08A64', '#7EC6C8': '#FFB89C', '#F47B6B': '#59B8D9' } },
  sweater_v2: { base: 'sweater', map: { '#8E7FD8': '#E06B50', '#6E5EC2': '#B84B34', '#FFF4DF': '#FFE4A8' } },
  sweater_drape_back_v2: { base: 'sweater_drape_back', map: { '#A87F5F': '#DE7A3B', '#8C664A': '#B85B23', '#C49A78': '#F0975A' } },
  sweater_drape_back_v3: { base: 'sweater_drape_back', map: { '#A87F5F': '#6E7CC7', '#8C664A': '#4E5CA3', '#C49A78': '#91A0E6' } },
  sweater_drape_edge_v2: { base: 'sweater_drape_edge', map: { '#B595CE': '#6E91BA', '#A585BE': '#5B7DA6', '#9E7EB8': '#52739C', '#8C6BA8': '#426087' } },
  sweater_drape_edge_v3: { base: 'sweater_drape_edge', map: { '#B595CE': '#E3845F', '#A585BE': '#D1704B', '#9E7EB8': '#BF5E3A', '#8C6BA8': '#9E4828' } },
  towel_roll_drape_v2: { base: 'towel_roll_drape', map: { '#EC7755': '#4A9FD6', '#F7B293': '#94D4FA' } },
  ukulele_lean_v2: { base: 'ukulele_lean', map: { '#E8924C': '#48AD5C', '#C67139': '#328243', '#8C4E2B': '#256132' } },
  ukulele_lean_v3: { base: 'ukulele_lean', map: { '#E8924C': '#F0BA3E', '#C67139': '#C99124', '#8C4E2B': '#8C6014' } },
  umbrella_lean_v2: { base: 'umbrella_lean', map: { '#2D9D92': '#E85D88', '#FFE066': '#FFF2CC' } },
  book_open_v2: { base: 'book_open', map: { '#9E3B4B': '#3B7D5C', '#A6DFD1': '#FFD9E2', '#FFE082': '#B6ECAC' } },
  thermos_lie_v2: { base: 'thermos_lie', map: { '#2B8C82': '#F09BB4', '#62BEB3': '#FFC4D6', '#E04F45': '#4A90D6' } },
  cat_can_tilt_v2: { base: 'cat_can_tilt', map: { '#FC9651': '#9B74D6', '#59B8D9': '#FFE082' } },
};

function applyPaletteSwap(svg, map) {
  const entries = Object.entries(map);
  let out = svg;
  entries.forEach(([from], idx) => {
    out = out.replace(new RegExp(from.replace('#', '\\#'), 'gi'), `__PAL_${idx}__`);
  });
  entries.forEach(([, to], idx) => {
    out = out.split(`__PAL_${idx}__`).join(to);
  });
  return out;
}

function renderSprite(name, svg) {
  const isBoxOrPet =
    name.startsWith('cardboard_') ||
    name === 'cat_idle' ||
    name === 'cat_mischief' ||
    name === 'cat_happy';
  if (isBoxOrPet) {
    const rendered = new Resvg(inkOutlines(svg)).render();
    return { png: rendered.asPng(), width: rendered.width, height: rendered.height };
  }

  const styledSvg = crispItemOutlines(svg);
  const options = { font: { loadSystemFonts: false } };
  const bounds = new Resvg(styledSvg, options).getBBox();
  if (!bounds || !bounds.width || !bounds.height) {
    throw new Error(`Empty sprite: ${name}`);
  }
  const pad = Math.max(4, Math.max(bounds.width, bounds.height) * 0.048);
  const viewW = bounds.width + pad * 2;
  const viewH = bounds.height + pad * 2;
  const left = bounds.x - pad;
  const top = bounds.y - pad;
  const fittedSvg = styledSvg.replace(
    /width="256"\s+height="256"\s+viewBox="0 0 256 256"/,
    `width="${viewW.toFixed(2)}" height="${viewH.toFixed(2)}" viewBox="${left.toFixed(2)} ${top.toFixed(2)} ${viewW.toFixed(2)} ${viewH.toFixed(2)}"`
  );
  const fitTo = viewW >= viewH
    ? { mode: 'width', value: ITEM_SPRITE_SIZE }
    : { mode: 'height', value: ITEM_SPRITE_SIZE };
  const rendered = new Resvg(fittedSvg, { ...options, fitTo }).render();
  return { png: rendered.asPng(), width: rendered.width, height: rendered.height };
}

const allSvgs = { ...SPRITES };
for (const [variantName, spec] of Object.entries(VARIANT_PALETTES)) {
  const baseSvg = SPRITES[spec.base];
  if (!baseSvg) {
    throw new Error(`Missing base sprite "${spec.base}" for variant "${variantName}"`);
  }
  const swapped = applyPaletteSwap(baseSvg, spec.map);
  if (swapped === baseSvg) {
    throw new Error(`Variant "${variantName}" SVG matches base "${spec.base}" unchanged`);
  }
  allSvgs[variantName] = swapped;
}

const itemsConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../assets/resources/configs/items.json'), 'utf8')
);
const itemResources = new Set([
  ...itemsConfig.map((item) => item.spriteResource),
  ...itemsConfig.flatMap((item) => (item.variants || []).map((variant) => variant.spriteResource)),
  'sprites/cardboard_closed',
  'sprites/cardboard_cracked',
]);
for (const resource of itemResources) {
  if (!Object.hasOwn(allSvgs, resource.replace(/^sprites\//, ''))) {
    throw new Error(`Missing sprite artwork: ${resource}`);
  }
}

const renderedSprites = Object.entries(allSvgs)
  .filter(([name]) => !itemsOnly || itemResources.has(`sprites/${name}`))
  .map(([name, svg]) => [name, renderSprite(name, svg)]);
fs.mkdirSync(OUT_DIR, { recursive: true });
const aspectRatios = {};
for (const [name, result] of renderedSprites) {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), result.png);
  aspectRatios[name] = Number((result.width / Math.max(1, result.height)).toFixed(3));
}
if (process.argv.includes('--print-aspects')) {
  console.log(JSON.stringify(aspectRatios, null, 2));
}

console.log(`Generated ${renderedSprites.length} sprites (${itemResources.size} cartoon item and box sprites) in ${OUT_DIR}`);
