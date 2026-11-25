import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../assets/resources/sprites');
fs.mkdirSync(OUT_DIR, { recursive: true });

const INK = '#3D2B24';

function wrapSvg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </g>
</svg>`;
}

const SPRITES = {
  handbag: wrapSvg(`
    <ellipse cx="128" cy="214" rx="74" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M92 94 C92 48, 164 48, 164 94" fill="none" stroke="${INK}" stroke-width="14"/>
    <path d="M92 94 C92 48, 164 48, 164 94" fill="none" stroke="#F6C89F" stroke-width="6"/>
    <path d="M54 96 L202 96 L214 198 Q214 210 198 210 L58 210 Q42 210 42 198 Z" fill="#F2845C" stroke="${INK}" stroke-width="9"/>
    <path d="M54 96 L202 96 L192 142 Q128 164 64 142 Z" fill="#FC9F72" stroke="${INK}" stroke-width="8"/>
    <rect x="114" y="138" width="28" height="24" rx="7" fill="#FFE082" stroke="${INK}" stroke-width="7"/>
    <circle cx="128" cy="150" r="4" fill="${INK}"/>
    <path d="M68 110 L96 110" stroke="#FFF3E0" stroke-width="6"/>
  `),

  thermos: wrapSvg(`
    <ellipse cx="128" cy="222" rx="44" ry="11" fill="rgba(61,43,36,0.14)"/>
    <rect x="86" y="70" width="84" height="148" rx="22" fill="#59B8D9" stroke="${INK}" stroke-width="9"/>
    <rect x="94" y="84" width="18" height="120" rx="9" fill="#92D8EE"/>
    <rect x="82" y="114" width="92" height="54" rx="8" fill="#FFF7EB" stroke="${INK}" stroke-width="7"/>
    <circle cx="128" cy="141" r="14" fill="#FC9651" stroke="${INK}" stroke-width="6"/>
    <path d="M92 68 L98 38 Q128 32 158 38 L164 68 Z" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
    <rect x="110" y="24" width="36" height="16" rx="7" fill="#F2845C" stroke="${INK}" stroke-width="7"/>
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
    <circle cx="86" cy="206" r="10" fill="#F7D8B6"/>
    <circle cx="170" cy="206" r="22" fill="#C67B47" stroke="${INK}" stroke-width="8"/>
    <circle cx="170" cy="206" r="10" fill="#F7D8B6"/>
    <ellipse cx="128" cy="96" rx="52" ry="44" fill="#D48B56" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="108" rx="24" ry="18" fill="#F7D8B6" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="128" cy="102" rx="9" ry="6" fill="${INK}"/>
    <circle cx="104" cy="88" r="6" fill="${INK}"/>
    <circle cx="152" cy="88" r="6" fill="${INK}"/>
    <circle cx="93" cy="102" r="7" fill="#F59B92" opacity="0.7"/>
    <circle cx="163" cy="102" r="7" fill="#F59B92" opacity="0.7"/>
    <path d="M112 134 L128 144 L144 134 L144 148 L128 142 L112 148 Z" fill="#EB6A5B" stroke="${INK}" stroke-width="5"/>
  `),

  ukulele: wrapSvg(`
    <g transform="rotate(-32 128 128)">
      <ellipse cx="128" cy="176" rx="52" ry="62" fill="#E8924C" stroke="${INK}" stroke-width="9"/>
      <ellipse cx="128" cy="134" rx="38" ry="40" fill="#E8924C" stroke="${INK}" stroke-width="9"/>
      <ellipse cx="128" cy="166" rx="44" ry="50" fill="#F2A966"/>
      <rect x="115" y="40" width="26" height="86" rx="6" fill="#C67139" stroke="${INK}" stroke-width="8"/>
      <rect x="109" y="18" width="38" height="32" rx="8" fill="#8C4E2B" stroke="${INK}" stroke-width="8"/>
      <circle cx="101" cy="27" r="5" fill="#FFE082" stroke="${INK}" stroke-width="4"/>
      <circle cx="101" cy="41" r="5" fill="#FFE082" stroke="${INK}" stroke-width="4"/>
      <circle cx="155" cy="27" r="5" fill="#FFE082" stroke="${INK}" stroke-width="4"/>
      <circle cx="155" cy="41" r="5" fill="#FFE082" stroke="${INK}" stroke-width="4"/>
      <circle cx="128" cy="144" r="18" fill="#5A3324" stroke="${INK}" stroke-width="6"/>
      <rect x="106" y="186" width="44" height="12" rx="4" fill="#5A3324" stroke="${INK}" stroke-width="5"/>
      <line x1="121" y1="44" x2="121" y2="186" stroke="#FFF3E0" stroke-width="2.5"/>
      <line x1="128" y1="44" x2="128" y2="186" stroke="#FFF3E0" stroke-width="2.5"/>
      <line x1="135" y1="44" x2="135" y2="186" stroke="#FFF3E0" stroke-width="2.5"/>
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
    <ellipse cx="128" cy="216" rx="64" ry="13" fill="rgba(61,43,36,0.14)"/>
    <path d="M180 180 C222 180, 232 222, 198 226 C172 228, 162 212, 132 216" fill="none" stroke="${INK}" stroke-width="12"/>
    <path d="M180 180 C222 180, 232 222, 198 226 C172 228, 162 212, 132 216" fill="none" stroke="#F07394" stroke-width="6"/>
    <circle cx="122" cy="134" r="74" fill="#F07394" stroke="${INK}" stroke-width="9"/>
    <path d="M68 92 Q122 132 178 90" fill="none" stroke="${INK}" stroke-width="6"/>
    <path d="M52 126 Q122 168 192 126" fill="none" stroke="${INK}" stroke-width="6"/>
    <path d="M62 162 Q122 198 184 156" fill="none" stroke="${INK}" stroke-width="6"/>
    <path d="M92 68 Q112 132 82 192" fill="none" stroke="${INK}" stroke-width="6"/>
    <path d="M148 66 Q168 128 134 202" fill="none" stroke="${INK}" stroke-width="6"/>
    <circle cx="96" cy="96" r="14" fill="#FFABC0" opacity="0.65"/>
  `),

  coffee_cup: wrapSvg(`
    <ellipse cx="124" cy="214" rx="74" ry="15" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="124" cy="198" rx="72" ry="20" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M174 114 C214 114, 214 166, 172 166" fill="none" stroke="${INK}" stroke-width="16"/>
    <path d="M174 114 C214 114, 214 166, 172 166" fill="none" stroke="#FFF7EB" stroke-width="7"/>
    <path d="M68 98 L180 98 L170 184 Q166 200 124 200 Q82 200 78 184 Z" fill="#FC9651" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="124" cy="98" rx="56" ry="16" fill="#7D4B32" stroke="${INK}" stroke-width="7"/>
    <ellipse cx="124" cy="100" rx="30" ry="8" fill="#C98A5B"/>
    <path d="M98 62 Q88 44 102 28" fill="none" stroke="#D8C4B6" stroke-width="7"/>
    <path d="M128 58 Q118 38 132 22" fill="none" stroke="#D8C4B6" stroke-width="7"/>
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
      <path d="M68 108 L86 138" stroke="${INK}" stroke-width="7"/>
      <path d="M106 104 L124 138" stroke="${INK}" stroke-width="7"/>
      <path d="M144 104 L162 138" stroke="${INK}" stroke-width="7"/>
      <path d="M180 110 L194 134" stroke="${INK}" stroke-width="7"/>
      <path d="M68 110 L82 134" stroke="#FFF2CC" stroke-width="3"/>
      <path d="M106 106 L120 134" stroke="#FFF2CC" stroke-width="3"/>
      <path d="M144 106 L158 134" stroke="#FFF2CC" stroke-width="3"/>
    </g>
  `),

  cake: wrapSvg(`
    <ellipse cx="128" cy="216" rx="76" ry="16" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="128" cy="204" rx="76" ry="18" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M64 128 L192 128 L192 192 Q128 210 64 192 Z" fill="#F9D9A7" stroke="${INK}" stroke-width="9"/>
    <rect x="64" y="156" width="128" height="14" fill="#F2859C" stroke="${INK}" stroke-width="5"/>
    <path d="M58 126 Q64 96 128 96 Q192 96 198 126 Q188 144 170 134 Q152 146 134 132 Q116 146 98 132 Q80 144 58 126 Z" fill="#FFF9F2" stroke="${INK}" stroke-width="8"/>
    <path d="M110 88 C110 64, 146 64, 146 88 C146 104, 134 114, 128 114 C122 114, 110 104, 110 88 Z" fill="#EA5252" stroke="${INK}" stroke-width="7"/>
    <path d="M118 66 Q128 56 138 66" fill="none" stroke="#6BB059" stroke-width="7"/>
    <circle cx="90" cy="108" r="8" fill="#EA5252" stroke="${INK}" stroke-width="5"/>
    <circle cx="166" cy="108" r="8" fill="#EA5252" stroke="${INK}" stroke-width="5"/>
  `),

  succulent: wrapSvg(`
    <ellipse cx="128" cy="222" rx="52" ry="12" fill="rgba(61,43,36,0.14)"/>
    <path d="M74 136 L182 136 L166 216 Q128 224 90 216 Z" fill="#E38154" stroke="${INK}" stroke-width="9"/>
    <rect x="66" y="122" width="124" height="24" rx="10" fill="#F0976C" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="86" cy="104" rx="28" ry="16" transform="rotate(-24 86 104)" fill="#6EC072" stroke="${INK}" stroke-width="7"/>
    <ellipse cx="170" cy="104" rx="28" ry="16" transform="rotate(24 170 104)" fill="#6EC072" stroke="${INK}" stroke-width="7"/>
    <ellipse cx="96" cy="82" rx="26" ry="18" transform="rotate(-40 96 82)" fill="#84D180" stroke="${INK}" stroke-width="7"/>
    <ellipse cx="160" cy="82" rx="26" ry="18" transform="rotate(40 160 82)" fill="#84D180" stroke="${INK}" stroke-width="7"/>
    <ellipse cx="128" cy="72" rx="22" ry="30" fill="#9AE094" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="96" r="14" fill="#B6ECAC" stroke="${INK}" stroke-width="6"/>
  `),

  camera: wrapSvg(`
    <ellipse cx="128" cy="206" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <rect x="78" y="54" width="60" height="24" rx="8" fill="#E5DFD5" stroke="${INK}" stroke-width="7"/>
    <rect x="164" y="60" width="24" height="18" rx="5" fill="#F2845C" stroke="${INK}" stroke-width="6"/>
    <rect x="44" y="72" width="168" height="122" rx="22" fill="#465668" stroke="${INK}" stroke-width="9"/>
    <rect x="44" y="72" width="168" height="40" rx="16" fill="#F5EFE6" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="138" r="46" fill="#D9E2EC" stroke="${INK}" stroke-width="9"/>
    <circle cx="128" cy="138" r="30" fill="#2A4259" stroke="${INK}" stroke-width="7"/>
    <circle cx="128" cy="138" r="14" fill="#5CA4D6" stroke="${INK}" stroke-width="5"/>
    <circle cx="118" cy="128" r="6" fill="#FFFFFF"/>
    <rect x="172" y="84" width="20" height="14" rx="4" fill="#FFE082" stroke="${INK}" stroke-width="5"/>
  `),

  headphone: wrapSvg(`
    <path d="M58 142 C58 56, 198 56, 198 142" fill="none" stroke="${INK}" stroke-width="26"/>
    <path d="M58 142 C58 56, 198 56, 198 142" fill="none" stroke="#4FA1DA" stroke-width="14"/>
    <path d="M78 72 C106 54, 150 54, 178 72" fill="none" stroke="#85C4ED" stroke-width="6"/>
    <rect x="38" y="128" width="42" height="72" rx="20" fill="#FC9651" stroke="${INK}" stroke-width="9"/>
    <rect x="64" y="136" width="22" height="56" rx="11" fill="#3F4B57" stroke="${INK}" stroke-width="7"/>
    <rect x="176" y="128" width="42" height="72" rx="20" fill="#FC9651" stroke="${INK}" stroke-width="9"/>
    <rect x="170" y="136" width="22" height="56" rx="11" fill="#3F4B57" stroke="${INK}" stroke-width="7"/>
  `),

  book: wrapSvg(`
    <ellipse cx="128" cy="212" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M56 58 L194 48 L206 184 L68 196 Z" fill="#5D87C7" stroke="${INK}" stroke-width="9"/>
    <path d="M56 58 L56 198 Q62 212 78 210 L206 198 L206 184 L74 194 Q64 194 64 182 Z" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M74 64 L84 190" stroke="#3E649E" stroke-width="8"/>
    <rect x="104" y="84" width="68" height="44" rx="8" fill="#FFE8A3" stroke="${INK}" stroke-width="6"/>
    <line x1="116" y1="100" x2="160" y2="96" stroke="${INK}" stroke-width="6"/>
    <line x1="118" y1="114" x2="152" y2="111" stroke="${INK}" stroke-width="6"/>
    <path d="M164 188 L164 224 L178 214 L192 224 L192 186 Z" fill="#EB6A5B" stroke="${INK}" stroke-width="6"/>
  `),

  pillow: wrapSvg(`
    <ellipse cx="128" cy="214" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M52 64 Q128 80 204 64 Q190 132 206 196 Q128 180 50 196 Q66 132 52 64 Z" fill="#FFBE7B" stroke="${INK}" stroke-width="9"/>
    <path d="M72 84 Q128 96 184 84 Q174 130 186 176 Q128 164 70 176 Q82 130 72 84 Z" fill="#FFD6A5" stroke="${INK}" stroke-width="5" stroke-dasharray="10 10"/>
    <circle cx="128" cy="130" r="14" fill="#F2845C" stroke="${INK}" stroke-width="6"/>
  `),

  slipper: wrapSvg(`
    <g transform="rotate(-18 128 128)">
      <ellipse cx="128" cy="132" rx="60" ry="92" fill="#FFF4E4" stroke="${INK}" stroke-width="9"/>
      <ellipse cx="128" cy="134" rx="46" ry="76" fill="#F7CFA7"/>
      <path d="M68 118 Q128 76 188 118 L184 166 Q128 148 72 166 Z" fill="#FC9651" stroke="${INK}" stroke-width="8"/>
      <circle cx="110" cy="116" r="6" fill="#FFF7EB"/>
      <circle cx="146" cy="116" r="6" fill="#FFF7EB"/>
      <path d="M116 132 Q128 142 140 132" fill="none" stroke="${INK}" stroke-width="6"/>
    </g>
  `),

  umbrella: wrapSvg(`
    <g transform="rotate(28 128 128)">
      <path d="M128 156 L128 214 C128 232, 156 232, 156 214" fill="none" stroke="${INK}" stroke-width="14"/>
      <path d="M128 156 L128 214 C128 232, 156 232, 156 214" fill="none" stroke="#E5A25D" stroke-width="6"/>
      <path d="M128 24 L128 42" stroke="${INK}" stroke-width="9"/>
      <path d="M38 126 C38 64, 218 64, 218 126 Q190 112 162 126 Q128 112 94 126 Q66 112 38 126 Z" fill="#4FA1DA" stroke="${INK}" stroke-width="9"/>
      <path d="M94 126 C96 76, 124 64, 128 64 C132 64, 160 76, 162 126 Q128 112 94 126 Z" fill="#FFE082" stroke="${INK}" stroke-width="7"/>
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
    <rect x="78" y="84" width="100" height="132" rx="24" fill="#A6DFD1" stroke="${INK}" stroke-width="9"/>
    <rect x="92" y="114" width="72" height="64" rx="10" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <path d="M128 128 C128 128, 144 146, 144 156 A16 16 0 0 1 112 156 C112 146, 128 128, 128 128 Z" fill="#63C7B2" stroke="${INK}" stroke-width="5"/>
  `),

  cat_can: wrapSvg(`
    <ellipse cx="128" cy="212" rx="70" ry="16" fill="rgba(61,43,36,0.14)"/>
    <path d="M62 92 L194 92 L194 190 Q194 210 128 210 Q62 210 62 190 Z" fill="#FC9651" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="92" rx="66" ry="20" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="144" cy="92" rx="14" ry="7" fill="none" stroke="${INK}" stroke-width="5"/>
    <rect x="66" y="122" width="124" height="58" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <ellipse cx="128" cy="151" rx="26" ry="14" fill="#59B8D9" stroke="${INK}" stroke-width="5"/>
    <polygon points="100,151 86,141 86,161" fill="#59B8D9" stroke="${INK}" stroke-width="5"/>
    <circle cx="140" cy="148" r="3" fill="${INK}"/>
  `),

  gamepad: wrapSvg(`
    <ellipse cx="128" cy="204" rx="82" ry="14" fill="rgba(61,43,36,0.14)"/>
    <path d="M72 86 L184 86 C214 86, 224 148, 212 184 C204 202, 180 198, 166 166 L90 166 C76 198, 52 202, 44 184 C32 148, 42 86, 72 86 Z" fill="#8C7AE6" stroke="${INK}" stroke-width="9"/>
    <rect x="68" y="114" width="34" height="14" rx="4" fill="#FFF7EB" stroke="${INK}" stroke-width="5"/>
    <rect x="78" y="104" width="14" height="34" rx="4" fill="#FFF7EB" stroke="${INK}" stroke-width="5"/>
    <circle cx="174" cy="112" r="9" fill="#FFE082" stroke="${INK}" stroke-width="5"/>
    <circle cx="192" cy="126" r="9" fill="#EB6A5B" stroke="${INK}" stroke-width="5"/>
    <circle cx="174" cy="140" r="9" fill="#6EC072" stroke="${INK}" stroke-width="5"/>
    <circle cx="156" cy="126" r="9" fill="#59B8D9" stroke="${INK}" stroke-width="5"/>
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
    <path d="M46 154 C46 84, 102 66, 140 66 C182 66, 206 102, 204 152 Z" fill="#4FA1DA" stroke="${INK}" stroke-width="9"/>
    <path d="M114 68 C134 94, 138 124, 134 152" fill="none" stroke="${INK}" stroke-width="6"/>
    <circle cx="130" cy="60" r="10" fill="#FFE082" stroke="${INK}" stroke-width="6"/>
    <path d="M134 148 Q204 142 228 168 Q204 188 122 174 Z" fill="#EB6A5B" stroke="${INK}" stroke-width="9"/>
    <circle cx="88" cy="118" r="14" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
  `),

  cardboard_closed: wrapSvg(`
    <ellipse cx="128" cy="216" rx="88" ry="16" fill="rgba(61,43,36,0.18)"/>
    <path d="M42 92 L128 52 L214 92 L214 184 L128 220 L42 184 Z" fill="#D99B60" stroke="${INK}" stroke-width="9"/>
    <path d="M42 92 L128 128 L128 220 L42 184 Z" fill="#C9884E" stroke="${INK}" stroke-width="8"/>
    <path d="M214 92 L128 128 L128 220 L214 184 Z" fill="#E3AC72" stroke="${INK}" stroke-width="8"/>
    <path d="M42 92 L128 52 L214 92 L128 128 Z" fill="#F0C18C" stroke="${INK}" stroke-width="8"/>
    <path d="M80 74 L166 112 L182 104 L96 66 Z" fill="#FFF1BF" stroke="${INK}" stroke-width="5"/>
    <rect x="86" y="106" width="24" height="36" rx="4" transform="skewY(22)" fill="#FFF1BF" stroke="${INK}" stroke-width="5"/>
    <path d="M150 156 L192 140 L192 162 L150 178 Z" fill="#FFF7EB" stroke="${INK}" stroke-width="5"/>
  `),

  cardboard_cracked: wrapSvg(`
    <ellipse cx="128" cy="218" rx="88" ry="16" fill="rgba(61,43,36,0.18)"/>
    <path d="M46 106 L128 74 L210 106 L210 188 L128 220 L46 188 Z" fill="#5E3E29" stroke="${INK}" stroke-width="9"/>
    <path d="M46 106 L128 136 L128 220 L46 188 Z" fill="#C9884E" stroke="${INK}" stroke-width="8"/>
    <path d="M210 106 L128 136 L128 220 L210 188 Z" fill="#E3AC72" stroke="${INK}" stroke-width="8"/>
    <path d="M46 106 L26 66 L108 42 L128 78 Z" fill="#F0C18C" stroke="${INK}" stroke-width="8"/>
    <path d="M210 106 L232 68 L148 44 L128 78 Z" fill="#F0C18C" stroke="${INK}" stroke-width="8"/>
    <polygon points="128,82 138,104 162,104 142,118 150,140 128,126 106,140 114,118 94,104 118,104" fill="#FFE082" stroke="${INK}" stroke-width="5"/>
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
    <path d="M40 156 L58 84 L106 84 L126 116 C158 122, 206 130, 218 164 L218 184 L40 184 Z" fill="#59B8D9" stroke="${INK}" stroke-width="9"/>
    <path d="M168 134 C194 138, 214 150, 218 172 L166 172 Z" fill="#FFF7EB" stroke="${INK}" stroke-width="7"/>
    <rect x="34" y="172" width="190" height="24" rx="11" fill="#FFF9F0" stroke="${INK}" stroke-width="8"/>
    <line x1="118" y1="114" x2="132" y2="100" stroke="#FFF7EB" stroke-width="7"/>
    <line x1="134" y1="122" x2="148" y2="108" stroke="#FFF7EB" stroke-width="7"/>
  `),

  donut: wrapSvg(`
    <ellipse cx="128" cy="208" rx="78" ry="15" fill="rgba(61,43,36,0.14)"/>
    <circle cx="128" cy="130" r="80" fill="#E8A45D" stroke="${INK}" stroke-width="9"/>
    <path d="M52 120 C52 72, 204 72, 204 120 Q190 144 170 132 Q150 150 128 134 Q106 150 86 132 Q66 144 52 120 Z" fill="#FF8FAB" stroke="${INK}" stroke-width="8"/>
    <circle cx="128" cy="130" r="26" fill="#FFF8EE" stroke="${INK}" stroke-width="8"/>
    <line x1="84" y1="88" x2="96" y2="96" stroke="#FFE082" stroke-width="7"/>
    <line x1="164" y1="86" x2="154" y2="96" stroke="#7AE0B8" stroke-width="7"/>
    <line x1="126" y1="74" x2="136" y2="82" stroke="#FFF" stroke-width="7"/>
  `),

  teacup: wrapSvg(`
    <ellipse cx="128" cy="212" rx="68" ry="14" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="128" cy="198" rx="66" ry="16" fill="#FFF7EB" stroke="${INK}" stroke-width="8"/>
    <path d="M174 120 C208 120, 208 164, 170 164" fill="none" stroke="${INK}" stroke-width="15"/>
    <path d="M174 120 C208 120, 208 164, 170 164" fill="none" stroke="#85CFA0" stroke-width="7"/>
    <path d="M76 106 L180 106 C178 174, 158 194, 128 194 C98 194, 78 174, 76 106 Z" fill="#85CFA0" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="106" rx="52" ry="14" fill="#6BB876" stroke="${INK}" stroke-width="7"/>
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
    <rect x="64" y="42" width="132" height="170" rx="16" fill="#F295B2" stroke="${INK}" stroke-width="9"/>
    <rect x="52" y="64" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="52" y="102" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="52" y="140" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="52" y="178" width="24" height="12" rx="6" fill="#FFF7EB" stroke="${INK}" stroke-width="6"/>
    <rect x="96" y="74" width="76" height="44" rx="8" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <path d="M196 92 L212 92 L212 126 L196 126" fill="#FFE082" stroke="${INK}" stroke-width="6"/>
  `),

  kettle: wrapSvg(`
    <ellipse cx="128" cy="220" rx="68" ry="13" fill="rgba(61,43,36,0.14)"/>
    <path d="M168 88 C210 88, 214 166, 174 172" fill="none" stroke="${INK}" stroke-width="18"/>
    <path d="M168 88 C210 88, 214 166, 174 172" fill="none" stroke="#4FA1DA" stroke-width="8"/>
    <path d="M72 86 L40 72 L66 116" fill="#D9E2EC" stroke="${INK}" stroke-width="8"/>
    <path d="M72 74 L172 74 L184 198 Q128 214 60 198 Z" fill="#FFF7EB" stroke="${INK}" stroke-width="9"/>
    <rect x="58" y="192" width="128" height="22" rx="9" fill="#5A636E" stroke="${INK}" stroke-width="8"/>
    <path d="M84 74 Q122 50 160 74 Z" fill="#FC9651" stroke="${INK}" stroke-width="8"/>
  `),

  cookie_box: wrapSvg(`
    <ellipse cx="128" cy="214" rx="76" ry="14" fill="rgba(61,43,36,0.14)"/>
    <ellipse cx="128" cy="140" rx="82" ry="64" fill="#4FA1DA" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="126" rx="82" ry="56" fill="#7AC3EE" stroke="${INK}" stroke-width="9"/>
    <circle cx="110" cy="122" r="24" fill="#E8A45D" stroke="${INK}" stroke-width="6"/>
    <circle cx="148" cy="134" r="22" fill="#F2B872" stroke="${INK}" stroke-width="6"/>
    <circle cx="104" cy="116" r="4" fill="${INK}"/>
    <circle cx="118" cy="128" r="4" fill="${INK}"/>
    <circle cx="144" cy="128" r="4" fill="${INK}"/>
    <circle cx="155" cy="139" r="4" fill="${INK}"/>
  `),

  sweater: wrapSvg(`
    <ellipse cx="128" cy="206" rx="84" ry="14" fill="rgba(61,43,36,0.14)"/>
    <rect x="44" y="96" width="168" height="98" rx="20" fill="#F5B882" stroke="${INK}" stroke-width="9"/>
    <rect x="44" y="138" width="168" height="26" fill="#FFE8C2" stroke="${INK}" stroke-width="6"/>
    <path d="M86 96 L104 64 L152 64 L170 96 Q128 112 86 96 Z" fill="#FC9651" stroke="${INK}" stroke-width="8"/>
    <line x1="66" y1="96" x2="66" y2="194" stroke="${INK}" stroke-width="6"/>
    <line x1="190" y1="96" x2="190" y2="194" stroke="${INK}" stroke-width="6"/>
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
    <rect x="92" y="34" width="16" height="106" rx="8" transform="rotate(-14 100 87)" fill="#4FA1DA" stroke="${INK}" stroke-width="7"/>
    <rect x="86" y="32" width="26" height="24" rx="6" transform="rotate(-14 99 44)" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <rect x="144" y="42" width="16" height="102" rx="8" transform="rotate(12 152 93)" fill="#FF8FAB" stroke="${INK}" stroke-width="7"/>
    <path d="M72 114 L184 114 L170 212 Q128 220 86 212 Z" fill="#A6DFD1" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="114" rx="56" ry="14" fill="#FFF7EB" stroke="${INK}" stroke-width="7"/>
  `),

  rubber_duck: wrapSvg(`
    <ellipse cx="128" cy="216" rx="66" ry="13" fill="rgba(61,43,36,0.14)"/>
    <path d="M56 146 C56 112, 174 116, 198 134 C202 184, 172 206, 122 206 C76 206, 56 184, 56 146 Z" fill="#FFD147" stroke="${INK}" stroke-width="9"/>
    <circle cx="104" cy="92" r="44" fill="#FFD147" stroke="${INK}" stroke-width="9"/>
    <path d="M54 96 L32 104 Q48 118 68 110 Z" fill="#FC9651" stroke="${INK}" stroke-width="7"/>
    <circle cx="88" cy="84" r="6" fill="${INK}"/>
    <path d="M108 144 C132 136, 158 148, 152 170 C140 182, 108 176, 108 144 Z" fill="#FFE885" stroke="${INK}" stroke-width="6"/>
  `),

  watering_can: wrapSvg(`
    <ellipse cx="136" cy="214" rx="64" ry="13" fill="rgba(61,43,36,0.14)"/>
    <path d="M168 106 C214 100, 222 176, 174 176" fill="none" stroke="${INK}" stroke-width="18"/>
    <path d="M168 106 C214 100, 222 176, 174 176" fill="none" stroke="#6EC072" stroke-width="8"/>
    <path d="M84 150 L40 94 L52 84 L96 128" fill="#6EC072" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="42" cy="86" rx="12" ry="18" transform="rotate(-40 42 86)" fill="#FFE082" stroke="${INK}" stroke-width="6"/>
    <path d="M82 98 L174 98 L182 198 Q128 212 74 198 Z" fill="#6EC072" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="128" cy="98" rx="46" ry="12" fill="#9AE094" stroke="${INK}" stroke-width="7"/>
  `),

  paint_palette: wrapSvg(`
    <g transform="rotate(-14 128 128)">
      <path d="M42 134 C38 72, 128 46, 188 76 C224 94, 224 148, 176 154 C154 156, 156 184, 172 198 C154 222, 50 206, 42 134 Z" fill="#F2C894" stroke="${INK}" stroke-width="9"/>
      <circle cx="88" cy="96" r="14" fill="#EB6A5B" stroke="${INK}" stroke-width="5"/>
      <circle cx="134" cy="84" r="14" fill="#FFD147" stroke="${INK}" stroke-width="5"/>
      <circle cx="176" cy="106" r="14" fill="#4FA1DA" stroke="${INK}" stroke-width="5"/>
      <circle cx="78" cy="144" r="14" fill="#6EC072" stroke="${INK}" stroke-width="5"/>
      <circle cx="118" cy="170" r="14" fill="#FFFDF9" stroke="${INK}" stroke-width="6"/>
    </g>
  `),

  perfume: wrapSvg(`
    <ellipse cx="128" cy="220" rx="52" ry="12" fill="rgba(61,43,36,0.14)"/>
    <rect x="108" y="38" width="40" height="32" rx="8" fill="#FFE082" stroke="${INK}" stroke-width="7"/>
    <rect x="116" y="70" width="24" height="16" fill="#E39D5C" stroke="${INK}" stroke-width="6"/>
    <rect x="70" y="86" width="116" height="126" rx="28" fill="#F9B8D0" stroke="${INK}" stroke-width="9"/>
    <rect x="86" y="108" width="84" height="82" rx="16" fill="#FFDCE8" stroke="${INK}" stroke-width="5"/>
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
    <path d="M174 108 C216 108, 216 168, 172 168" fill="none" stroke="${INK}" stroke-width="17"/>
    <path d="M174 108 C216 108, 216 168, 172 168" fill="none" stroke="#FFF7EB" stroke-width="8"/>
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
    <rect x="92" y="34" width="72" height="18" rx="5" fill="#59B8D9" stroke="${INK}" stroke-width="7"/>
    <rect x="74" y="114" width="108" height="64" fill="#59B8D9" stroke="${INK}" stroke-width="6"/>
    <circle cx="128" cy="146" r="18" fill="#FFFDF9" stroke="${INK}" stroke-width="5"/>
  `),

  jam_jar: wrapSvg(`
    <ellipse cx="128" cy="218" rx="58" ry="12" fill="rgba(61,43,36,0.14)"/>
    <rect x="70" y="82" width="116" height="128" rx="28" fill="#E85A70" stroke="${INK}" stroke-width="9"/>
    <rect x="86" y="116" width="84" height="64" rx="10" fill="#FFF9F0" stroke="${INK}" stroke-width="6"/>
    <circle cx="128" cy="148" r="16" fill="#EB5757" stroke="${INK}" stroke-width="5"/>
    <rect x="76" y="54" width="104" height="32" rx="10" fill="#FFE082" stroke="${INK}" stroke-width="8"/>
  `),

  backpack: wrapSvg(`
    <ellipse cx="128" cy="218" rx="68" ry="13" fill="rgba(61,43,36,0.14)"/>
    <path d="M106 54 C106 32, 150 32, 150 54" fill="none" stroke="${INK}" stroke-width="11"/>
    <rect x="58" y="54" width="140" height="154" rx="42" fill="#59B8D9" stroke="${INK}" stroke-width="9"/>
    <path d="M58 106 Q128 134 198 106 L198 86 Q128 110 58 86 Z" fill="#4398B8" stroke="${INK}" stroke-width="6"/>
    <rect x="78" y="142" width="100" height="54" rx="14" fill="#FFE082" stroke="${INK}" stroke-width="7"/>
    <line x1="94" y1="158" x2="162" y2="158" stroke="${INK}" stroke-width="6"/>
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
      <circle cx="96" cy="76" r="32" fill="none" stroke="${INK}" stroke-width="14"/>
      <circle cx="96" cy="76" r="32" fill="none" stroke="#D9E2EC" stroke-width="7"/>
      <circle cx="96" cy="124" r="24" fill="#FFD147" stroke="${INK}" stroke-width="8"/>
      <rect x="86" y="144" width="20" height="72" rx="8" fill="#FFD147" stroke="${INK}" stroke-width="8"/>
      <rect x="106" y="180" width="24" height="14" rx="4" fill="#FFD147" stroke="${INK}" stroke-width="7"/>
      <rect x="106" y="200" width="18" height="12" rx="4" fill="#FFD147" stroke="${INK}" stroke-width="7"/>
      <circle cx="152" cy="134" r="26" fill="#FF9AA2" stroke="${INK}" stroke-width="8"/>
      <circle cx="152" cy="134" r="10" fill="#FFF7EB"/>
    </g>
  `),
};

for (const [name, svg] of Object.entries(SPRITES)) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 256 },
    background: 'rgba(0,0,0,0)',
  });
  const pngData = resvg.render();
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), pngData.asPng());
}

console.log(`Generated ${Object.keys(SPRITES).length} sprites in ${OUT_DIR}`);
