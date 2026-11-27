import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../assets/resources/ui');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Keep bespoke 3D studio-rendered booster PNGs intact unless --all is explicitly passed.
const PRESERVE_3D_BOOSTERS = new Set(['icon_magnet', 'icon_undo', 'icon_hint', 'icon_shuffle']);
const overwriteAll = process.argv.includes('--all');

const SHADOW_DEF = `
  <filter id="softDrop" x="-16%" y="-16%" width="132%" height="136%">
    <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#3B2D26" flood-opacity="0.16"/>
  </filter>
`;

function wrapSvg(body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    ${SHADOW_DEF}
    ${defs}
  </defs>
  <g stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </g>
</svg>`;
}

const UI_ICONS = {
  icon_magnet: wrapSvg(
    `<g filter="url(#softDrop)">
      <path d="M36 42 L36 72 C36 91, 92 91, 92 72 L92 42" fill="none" stroke="url(#magRed)" stroke-width="18"/>
      <path d="M38 68 C40 82, 56 85, 64 85" fill="none" stroke="#FFADA6" stroke-width="4" opacity="0.7"/>
      <rect x="24" y="27" width="24" height="18" rx="5" fill="url(#magSilver)"/>
      <rect x="80" y="27" width="24" height="18" rx="5" fill="url(#magSilver)"/>
      <path d="M64 15 L67 23 L75 26 L67 29 L64 37 L61 29 L53 26 L61 23 Z" fill="#FFD15C"/>
    </g>`,
    `<linearGradient id="magRed" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF7468"/><stop offset="100%" stop-color="#D13C35"/>
    </linearGradient>
    <linearGradient id="magSilver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F7FAFC"/><stop offset="100%" stop-color="#C8D2DC"/>
    </linearGradient>`
  ),

  icon_undo: wrapSvg(
    `<g filter="url(#softDrop)">
      <path d="M48 44 L24 63 L48 82 L48 70 C70 70, 86 76, 91 95 C101 76, 90 50, 48 50 Z" fill="url(#undoBlue)"/>
      <path d="M52 55 C72 55, 83 61, 89 71" fill="none" stroke="#C8EBFF" stroke-width="4" opacity="0.85"/>
    </g>`,
    `<linearGradient id="undoBlue" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#76C4F4"/><stop offset="100%" stop-color="#357FBB"/>
    </linearGradient>`
  ),

  icon_hint: wrapSvg(
    `<g filter="url(#softDrop)">
      <circle cx="64" cy="56" r="34" fill="url(#hintGlow)"/>
      <path d="M40 58 C40 36, 88 36, 88 58 C88 71, 78 78, 76 88 L52 88 C50 78, 40 71, 40 58 Z" fill="url(#hintBulb)"/>
      <ellipse cx="54" cy="50" rx="8" ry="12" transform="rotate(-18 54 50)" fill="#FFFCEE" opacity="0.82"/>
      <rect x="52" y="88" width="24" height="9" rx="4" fill="#E3D7C8"/>
      <rect x="55" y="98" width="18" height="8" rx="4" fill="#D5A14B"/>
    </g>`,
    `<radialGradient id="hintGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE680" stop-opacity="0.55"/><stop offset="100%" stop-color="#FFE680" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="hintBulb" cx="38%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFF5B8"/><stop offset="55%" stop-color="#FFD44D"/><stop offset="100%" stop-color="#EC9A29"/>
    </radialGradient>`
  ),

  icon_shuffle: wrapSvg(
    `<g filter="url(#softDrop)">
      <path d="M22 44 C46 44, 58 84, 88 84 L96 84" fill="none" stroke="url(#shufGreen)" stroke-width="11"/>
      <polygon points="88,71 109,84 88,97" fill="#5CB96B"/>
      <path d="M22 84 C46 84, 58 44, 88 44 L96 44" fill="none" stroke="url(#shufOrange)" stroke-width="11"/>
      <polygon points="88,31 109,44 88,57" fill="#FC9651"/>
    </g>`,
    `<linearGradient id="shufGreen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#87D98B"/><stop offset="100%" stop-color="#4A9E5B"/>
    </linearGradient>
    <linearGradient id="shufOrange" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFB474"/><stop offset="100%" stop-color="#E87230"/>
    </linearGradient>`
  ),

  icon_ad: wrapSvg(
    `<g filter="url(#softDrop)">
      <rect x="14" y="25" width="100" height="78" rx="22" fill="url(#adFrame)"/>
      <rect x="23" y="34" width="82" height="60" rx="14" fill="url(#adScreen)"/>
      <polygon points="54,47 85,64 54,81" fill="url(#adPlay)"/>
      <circle cx="33" cy="43" r="4.2" fill="#EE6A5E"/>
    </g>`,
    `<linearGradient id="adFrame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB277"/><stop offset="100%" stop-color="#E87430"/>
    </linearGradient>
    <linearGradient id="adScreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#FBF2E6"/>
    </linearGradient>
    <linearGradient id="adPlay" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#69BBE9"/><stop offset="100%" stop-color="#3C87BF"/>
    </linearGradient>`
  ),

  icon_star: wrapSvg(
    `<g filter="url(#softDrop)">
      <polygon points="64,13 79,44 113,49 88,73 94,107 64,91 34,107 40,73 15,49 49,44" fill="url(#starGrad)"/>
      <polygon points="64,23 75,47 101,51 82,69 86,95 64,83 42,95 46,69 27,51 53,47" fill="url(#starInner)" opacity="0.85"/>
    </g>`,
    `<linearGradient id="starGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE87C"/><stop offset="55%" stop-color="#FFC738"/><stop offset="100%" stop-color="#E5981D"/>
    </linearGradient>
    <linearGradient id="starInner" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF7BE"/><stop offset="100%" stop-color="#FFD44D" stop-opacity="0"/>
    </linearGradient>`
  ),

  icon_sound_on: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#sndBg)"/>
    <g filter="url(#softDrop)">
      <path d="M31 51 L48 51 L68 34 L68 94 L48 77 L31 77 Q26 77 26 72 L26 56 Q26 51 31 51 Z" fill="url(#sndBody)"/>
      <path d="M80 49 C89 56, 89 72, 80 79" fill="none" stroke="#53A4DA" stroke-width="6.5"/>
      <path d="M90 39 C104 51, 104 77, 90 89" fill="none" stroke="#7AC0EA" stroke-width="6"/>
    </g>`,
    `<linearGradient id="sndBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF9F0"/><stop offset="100%" stop-color="#F7E8D4"/>
    </linearGradient>
    <linearGradient id="sndBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB176"/><stop offset="100%" stop-color="#E67330"/>
    </linearGradient>`
  ),

  icon_sound_off: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#sndOffBg)"/>
    <g filter="url(#softDrop)">
      <path d="M29 51 L46 51 L66 34 L66 94 L46 77 L29 77 Q24 77 24 72 L24 56 Q24 51 29 51 Z" fill="url(#sndMuted)"/>
      <line x1="78" y1="50" x2="100" y2="78" stroke="#DE5842" stroke-width="7.5"/>
      <line x1="100" y1="50" x2="78" y2="78" stroke="#DE5842" stroke-width="7.5"/>
    </g>`,
    `<linearGradient id="sndOffBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAF6F2"/><stop offset="100%" stop-color="#EDE4DA"/>
    </linearGradient>
    <linearGradient id="sndMuted" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C8BDB4"/><stop offset="100%" stop-color="#9B8E85"/>
    </linearGradient>`
  ),

  icon_daily_gift: wrapSvg(
    `<g filter="url(#softDrop)">
      <rect x="22" y="54" width="84" height="56" rx="14" fill="url(#giftBox)"/>
      <rect x="16" y="38" width="96" height="21" rx="9" fill="url(#giftLid)"/>
      <rect x="56" y="38" width="16" height="72" rx="3" fill="url(#giftRibbon)"/>
      <path d="M64 38 C46 14, 23 26, 38 38 Z" fill="url(#giftBow)"/>
      <path d="M64 38 C82 14, 105 26, 90 38 Z" fill="url(#giftBow)"/>
      <circle cx="64" cy="36" r="7.5" fill="#FFE686"/>
    </g>`,
    `<linearGradient id="giftBox" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFA96C"/><stop offset="100%" stop-color="#E56F2E"/>
    </linearGradient>
    <linearGradient id="giftLid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFC28E"/><stop offset="100%" stop-color="#F68B46"/>
    </linearGradient>
    <linearGradient id="giftRibbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF0A8"/><stop offset="100%" stop-color="#F2B830"/>
    </linearGradient>
    <linearGradient id="giftBow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF887A"/><stop offset="100%" stop-color="#D94B40"/>
    </linearGradient>`
  ),

  icon_cat_treat: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#treatBg)"/>
    <g filter="url(#softDrop)" transform="rotate(-24 64 64)">
      <ellipse cx="58" cy="64" rx="35" ry="20" fill="url(#treatFish)"/>
      <polygon points="88,64 111,45 106,64 111,83" fill="#E87246"/>
      <path d="M46 47 Q52 64 46 81" fill="none" stroke="rgba(128,58,24,0.35)" stroke-width="3.5"/>
      <circle cx="37" cy="59" r="3.8" fill="#4A2D1E"/>
      <ellipse cx="64" cy="55" rx="15" ry="4.5" fill="#FFD3A8" opacity="0.72"/>
    </g>`,
    `<linearGradient id="treatBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF7EA"/><stop offset="100%" stop-color="#FDE5C6"/>
    </linearGradient>
    <linearGradient id="treatFish" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB97A"/><stop offset="100%" stop-color="#E77832"/>
    </linearGradient>`
  ),

  icon_flashlight: wrapSvg(
    `<g filter="url(#softDrop)" transform="rotate(-35 64 64)">
      <rect x="20" y="49" width="52" height="30" rx="10" fill="url(#flBody)"/>
      <path d="M72 44 L96 36 L96 92 L72 84 Z" fill="url(#flHead)"/>
      <ellipse cx="96" cy="64" rx="6" ry="26" fill="#FFED96"/>
      <rect x="40" y="56" width="14" height="8" rx="4" fill="#FFE58F"/>
    </g>`,
    `<linearGradient id="flBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#70BCEB"/><stop offset="100%" stop-color="#3C83BA"/>
    </linearGradient>
    <linearGradient id="flHead" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB474"/><stop offset="100%" stop-color="#E5732E"/>
    </linearGradient>`
  ),

  icon_paw: wrapSvg(
    `<g filter="url(#softDrop)">
      <ellipse cx="64" cy="79" rx="28" ry="22" fill="url(#pawGrad)"/>
      <ellipse cx="32" cy="52" rx="10.5" ry="13.5" transform="rotate(-22 32 52)" fill="url(#pawGrad)"/>
      <ellipse cx="52" cy="36" rx="10.5" ry="14.5" transform="rotate(-8 52 36)" fill="url(#pawGrad)"/>
      <ellipse cx="76" cy="36" rx="10.5" ry="14.5" transform="rotate(8 76 36)" fill="url(#pawGrad)"/>
      <ellipse cx="96" cy="52" rx="10.5" ry="13.5" transform="rotate(22 96 52)" fill="url(#pawGrad)"/>
      <ellipse cx="64" cy="80" rx="14" ry="9.5" fill="#FFD9DE" opacity="0.88"/>
    </g>`,
    `<linearGradient id="pawGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB7C0"/><stop offset="100%" stop-color="#EA7586"/>
    </linearGradient>`
  ),

  icon_check: wrapSvg(
    `<g filter="url(#softDrop)">
      <circle cx="64" cy="64" r="52" fill="url(#chkGrad)"/>
      <ellipse cx="48" cy="34" rx="20" ry="9" transform="rotate(-24 48 34)" fill="#FFFFFF" opacity="0.22"/>
      <polyline points="38,65 56,83 90,46" fill="none" stroke="#FFFFFF" stroke-width="11"/>
    </g>`,
    `<linearGradient id="chkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#84D489"/><stop offset="100%" stop-color="#489A55"/>
    </linearGradient>`
  ),

  icon_flame: wrapSvg(
    `<g filter="url(#softDrop)">
      <path d="M64 13 C87 38, 103 54, 103 78 C103 101, 86 115, 64 115 C42 115, 25 101, 25 78 C25 58, 38 42, 48 34 C46 48, 52 54, 56 54 C54 38, 58 23, 64 13 Z" fill="url(#flameOuter)"/>
      <path d="M64 55 C76 68, 83 78, 83 89 C83 100, 74 107, 64 107 C54 107, 45 100, 45 89 C45 78, 54 66, 64 55 Z" fill="url(#flameInner)"/>
    </g>`,
    `<linearGradient id="flameOuter" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFBC6E"/><stop offset="55%" stop-color="#FA7C3C"/><stop offset="100%" stop-color="#D9482B"/>
    </linearGradient>
    <linearGradient id="flameInner" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF5B8"/><stop offset="100%" stop-color="#FFC738"/>
    </linearGradient>`
  ),

  icon_home: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#homeBg)"/>
    <g filter="url(#softDrop)">
      <path d="M27 62 L64 29 L101 62 L94 62 L94 101 Q94 107 88 107 L40 107 Q34 107 34 101 L34 62 Z" fill="#FFFDF9"/>
      <path d="M18 64 L64 24 L110 64" fill="none" stroke="url(#homeRoof)" stroke-width="11"/>
      <rect x="52" y="72" width="24" height="35" rx="7" fill="url(#homeDoor)"/>
      <circle cx="70" cy="90" r="2.8" fill="#FFFDF9"/>
    </g>`,
    `<linearGradient id="homeBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF9F0"/><stop offset="100%" stop-color="#FDE5C6"/>
    </linearGradient>
    <linearGradient id="homeRoof" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFB176"/><stop offset="100%" stop-color="#E6712E"/>
    </linearGradient>
    <linearGradient id="homeDoor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D98B4E"/><stop offset="100%" stop-color="#B1652D"/>
    </linearGradient>`
  ),

  icon_settings: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#setBg)"/>
    <g filter="url(#softDrop)">
      <path d="M56 20 L72 20 L75 32 L85 36 L96 29 L106 39 L99 50 L103 60 L114 63 L114 79 L103 82 L99 92 L106 103 L96 113 L85 106 L75 110 L72 120 L56 120 L53 110 L43 106 L32 113 L22 103 L29 92 L25 82 L14 79 L14 63 L25 60 L29 50 L22 39 L32 29 L43 36 L53 32 Z" transform="translate(0 -6)" fill="url(#setGear)"/>
      <circle cx="64" cy="64" r="19" fill="#FFFDF9"/>
      <circle cx="64" cy="64" r="8" fill="#F28A3C"/>
    </g>`,
    `<linearGradient id="setBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAF3EA"/><stop offset="100%" stop-color="#EEDEC9"/>
    </linearGradient>
    <linearGradient id="setGear" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFC77D"/><stop offset="100%" stop-color="#E68834"/>
    </linearGradient>`
  ),

  icon_rooms: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#roomsBg)"/>
    <g filter="url(#softDrop)">
      <rect x="20" y="34" width="54" height="62" rx="11" fill="#FFFDF9"/>
      <path d="M27 53 L47 39 L67 53 L67 78 L27 78 Z" fill="url(#roomsHouse)"/>
      <rect x="54" y="42" width="54" height="62" rx="11" fill="url(#roomsCard)"/>
      <circle cx="81" cy="64" r="13" fill="url(#roomsGreen)"/>
      <rect x="64" y="83" width="34" height="10" rx="5" fill="#FFFDF9" opacity="0.92"/>
    </g>`,
    `<linearGradient id="roomsBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F2F9FD"/><stop offset="100%" stop-color="#DCEEF9"/>
    </linearGradient>
    <linearGradient id="roomsHouse" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB176"/><stop offset="100%" stop-color="#E6712E"/>
    </linearGradient>
    <linearGradient id="roomsCard" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE7C2"/><stop offset="100%" stop-color="#F8CE8F"/>
    </linearGradient>
    <linearGradient id="roomsGreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#87D88C"/><stop offset="100%" stop-color="#4FA35C"/>
    </linearGradient>`
  ),

  icon_help: wrapSvg(
    `<g filter="url(#softDrop)">
      <circle cx="64" cy="64" r="52" fill="url(#helpGrad)"/>
      <ellipse cx="47" cy="34" rx="20" ry="9" transform="rotate(-24 47 34)" fill="#FFFFFF" opacity="0.22"/>
      <path d="M48 50 C48 36, 80 34, 80 51 C80 61, 64 63, 64 74" fill="none" stroke="#FFFFFF" stroke-width="11"/>
      <circle cx="64" cy="92" r="6.5" fill="#FFFFFF"/>
    </g>`,
    `<linearGradient id="helpGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#76C2F2"/><stop offset="100%" stop-color="#3B87C2"/>
    </linearGradient>`
  ),

  icon_vibrate: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#vibBg)"/>
    <g filter="url(#softDrop)">
      <rect x="44" y="26" width="40" height="76" rx="11" fill="url(#vibPhone)"/>
      <rect x="50" y="36" width="28" height="48" rx="5" fill="#FFFBF5"/>
      <circle cx="64" cy="92" r="3.5" fill="#FFFBF5"/>
      <path d="M32 46 Q24 64 32 82 M22 38 Q12 64 22 90" fill="none" stroke="#D97434" stroke-width="4.5" opacity="0.72"/>
      <path d="M96 46 Q104 64 96 82 M106 38 Q116 64 106 90" fill="none" stroke="#D97434" stroke-width="4.5" opacity="0.72"/>
    </g>`,
    `<linearGradient id="vibBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF7EA"/><stop offset="100%" stop-color="#FDE5C6"/>
    </linearGradient>
    <linearGradient id="vibPhone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB277"/><stop offset="100%" stop-color="#E4712E"/>
    </linearGradient>`
  ),

  icon_replay: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#repBg)"/>
    <g filter="url(#softDrop)">
      <path d="M88 48 C78 32, 50 32, 38 48 C28 62, 32 86, 52 94 C70 100, 90 90, 94 72" fill="none" stroke="url(#repArc)" stroke-width="11"/>
      <polygon points="73,50 97,55 92,31" fill="#469257"/>
    </g>`,
    `<linearGradient id="repBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F2FAF1"/><stop offset="100%" stop-color="#DCF1DB"/>
    </linearGradient>
    <linearGradient id="repArc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6FC278"/><stop offset="100%" stop-color="#3E824D"/>
    </linearGradient>`
  ),

  icon_shield: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#shdBg)"/>
    <g filter="url(#softDrop)">
      <path d="M64 22 L98 34 L98 62 C98 86, 80 102, 64 108 C48 102, 30 86, 30 62 L30 34 Z" fill="url(#shdBody)"/>
      <polyline points="49,64 60,76 82,52" fill="none" stroke="#FFFFFF" stroke-width="9"/>
    </g>`,
    `<linearGradient id="shdBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#EEF8FD"/><stop offset="100%" stop-color="#D7EEFA"/>
    </linearGradient>
    <linearGradient id="shdBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#76CBE5"/><stop offset="100%" stop-color="#3B8EB8"/>
    </linearGradient>`
  ),

  icon_heart: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#hrtBg)"/>
    <g filter="url(#softDrop)">
      <path d="M64 103 C64 103, 21 76, 21 48 C21 30, 36 21, 48 21 C57 21, 62 27, 64 33 C66 27, 71 21, 80 21 C92 21, 107 30, 107 48 C107 76, 64 103, 64 103 Z" fill="url(#hrtGrad)"/>
      <ellipse cx="44" cy="43" rx="8.5" ry="12.5" transform="rotate(-24 44 43)" fill="#FFFFFF" opacity="0.34"/>
    </g>`,
    `<linearGradient id="hrtBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF2F4"/><stop offset="100%" stop-color="#FFE0E6"/>
    </linearGradient>
    <linearGradient id="hrtGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF8695"/><stop offset="100%" stop-color="#DE3D55"/>
    </linearGradient>`
  ),

  icon_coin: wrapSvg(
    `<g filter="url(#softDrop)">
      <circle cx="64" cy="64" r="52" fill="url(#coinRim)"/>
      <circle cx="64" cy="64" r="40" fill="url(#coinFace)"/>
      <ellipse cx="48" cy="36" rx="18" ry="8" transform="rotate(-28 48 36)" fill="#FFFFFF" opacity="0.32"/>
      <polygon points="64,37 71,54 89,56 75,68 79,86 64,76 49,86 53,68 39,56 57,54" fill="url(#coinStar)"/>
    </g>`,
    `<linearGradient id="coinRim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE675"/><stop offset="100%" stop-color="#E59819"/>
    </linearGradient>
    <linearGradient id="coinFace" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF29C"/><stop offset="100%" stop-color="#F6B628"/>
    </linearGradient>
    <linearGradient id="coinStar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FC9E48"/><stop offset="100%" stop-color="#D6621C"/>
    </linearGradient>`
  ),

  icon_share: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#shrBg)"/>
    <g filter="url(#softDrop)">
      <polygon points="22,62 102,26 84,102 60,76 40,90 48,68" fill="url(#shrBody)"/>
      <polyline points="102,26 50,68 60,76" fill="#A6E3FA"/>
    </g>`,
    `<linearGradient id="shrBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F0FBF7"/><stop offset="100%" stop-color="#D8F3EA"/>
    </linearGradient>
    <linearGradient id="shrBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#70C0F0"/><stop offset="100%" stop-color="#3785BF"/>
    </linearGradient>`
  ),

  icon_shop: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#shpBg)"/>
    <g filter="url(#softDrop)">
      <rect x="24" y="54" width="80" height="52" rx="10" fill="#FFFDF9"/>
      <path d="M18 54 L26 28 L102 28 L110 54 Q96 64 82 54 Q64 64 46 54 Q32 64 18 54 Z" fill="url(#shpAwning)"/>
      <rect x="48" y="72" width="32" height="34" rx="6" fill="url(#shpDoor)"/>
    </g>`,
    `<linearGradient id="shpBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF8EB"/><stop offset="100%" stop-color="#FDE4C3"/>
    </linearGradient>
    <linearGradient id="shpAwning" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB176"/><stop offset="100%" stop-color="#E56F2E"/>
    </linearGradient>
    <linearGradient id="shpDoor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#76C2F2"/><stop offset="100%" stop-color="#3E88C2"/>
    </linearGradient>`
  ),

  icon_zoom_in: wrapSvg(
    `<g filter="url(#softDrop)">
      <circle cx="56" cy="56" r="28" fill="url(#zmLensIn)" stroke="#5B483F" stroke-width="6"/>
      <line x1="77" y1="77" x2="100" y2="100" stroke="#5B483F" stroke-width="11"/>
      <line x1="56" y1="44" x2="56" y2="68" stroke="#3B82B8" stroke-width="6.5"/>
      <line x1="44" y1="56" x2="68" y2="56" stroke="#3B82B8" stroke-width="6.5"/>
    </g>`,
    `<radialGradient id="zmLensIn" cx="35%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#D7EEFC"/>
    </radialGradient>`
  ),

  icon_zoom_out: wrapSvg(
    `<g filter="url(#softDrop)">
      <circle cx="56" cy="56" r="28" fill="url(#zmLensOut)" stroke="#5B483F" stroke-width="6"/>
      <line x1="77" y1="77" x2="100" y2="100" stroke="#5B483F" stroke-width="11"/>
      <line x1="44" y1="56" x2="68" y2="56" stroke="#D87136" stroke-width="6.5"/>
    </g>`,
    `<radialGradient id="zmLensOut" cx="35%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#FDE6D4"/>
    </radialGradient>`
  ),

  icon_crown: wrapSvg(
    `<circle cx="64" cy="64" r="54" fill="url(#crnBg)"/>
    <g filter="url(#softDrop)">
      <path d="M22 86 L28 40 L50 62 L64 29 L78 62 L100 40 L106 86 Z" fill="url(#crnGold)"/>
      <rect x="22" y="84" width="84" height="14" rx="7" fill="url(#crnBand)"/>
      <circle cx="64" cy="27" r="6" fill="#EE6258"/>
      <circle cx="27" cy="37" r="5" fill="#53A8E2"/>
      <circle cx="101" cy="37" r="5" fill="#53A8E2"/>
    </g>`,
    `<linearGradient id="crnBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF9E6"/><stop offset="100%" stop-color="#FCE7B2"/>
    </linearGradient>
    <linearGradient id="crnGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFEA80"/><stop offset="100%" stop-color="#EEA91C"/>
    </linearGradient>
    <linearGradient id="crnBand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFA96C"/><stop offset="100%" stop-color="#E46F2D"/>
    </linearGradient>`
  ),

  icon_lock: wrapSvg(
    `<g filter="url(#softDrop)">
      <path d="M44 54 V40 C44 25, 84 25, 84 40 V54" fill="none" stroke="url(#lckShackle)" stroke-width="11"/>
      <rect x="30" y="51" width="68" height="53" rx="16" fill="url(#lckBody)"/>
      <rect x="35" y="77" width="58" height="22" rx="9" fill="#E89A24" opacity="0.45"/>
      <ellipse cx="48" cy="62" rx="10" ry="4" fill="#FFF7CA" opacity="0.8"/>
      <circle cx="64" cy="72" r="7" fill="#5A3D2E"/>
      <path d="M60.5 76 L67.5 76 L69.5 90 L58.5 90 Z" fill="#5A3D2E"/>
    </g>`,
    `<linearGradient id="lckShackle" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F5F8FB"/><stop offset="100%" stop-color="#BDC8D4"/>
    </linearGradient>
    <linearGradient id="lckBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE675"/><stop offset="100%" stop-color="#F0A524"/>
    </linearGradient>`
  ),
};

let count = 0;
for (const [name, svg] of Object.entries(UI_ICONS)) {
  if (!overwriteAll && PRESERVE_3D_BOOSTERS.has(name) && fs.existsSync(path.join(OUT_DIR, `${name}.png`))) {
    continue;
  }
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 128 },
    background: 'rgba(0,0,0,0)',
  });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), resvg.render().asPng());
  count += 1;
}

console.log(`Generated ${count} UI icons in ${OUT_DIR}`);
