import type { AdPlacement, BoosterType } from '@core/types';

export const UI_ICON_RESOURCES = {
  magnet: 'ui/icon_magnet.png',
  undo: 'ui/icon_undo.png',
  hint: 'ui/icon_hint.png',
  shuffle: 'ui/icon_shuffle.png',
  ad: 'ui/icon_ad.png',
  star: 'ui/icon_star.png',
  soundOn: 'ui/icon_sound_on.png',
  soundOff: 'ui/icon_sound_off.png',
  dailyGift: 'ui/icon_daily_gift.png',
  catTreat: 'ui/icon_cat_treat.png',
  flashlight: 'ui/icon_flashlight.png',
  paw: 'ui/icon_paw.png',
  check: 'ui/icon_check.png',
  flame: 'ui/icon_flame.png',
  home: 'ui/icon_home.png',
  settings: 'ui/icon_settings.png',
  rooms: 'ui/icon_rooms.png',
  help: 'ui/icon_help.png',
  vibrate: 'ui/icon_vibrate.png',
  replay: 'ui/icon_replay.png',
  shield: 'ui/icon_shield.png',
  heart: 'ui/icon_heart.png',
  coin: 'ui/icon_coin.png',
  share: 'ui/icon_share.png',
  shop: 'ui/icon_shop.png',
  zoomIn: 'ui/icon_zoom_in.png',
  zoomOut: 'ui/icon_zoom_out.png',
  crown: 'ui/icon_crown.png',
  lock: 'ui/icon_lock.png',
} as const;

export type UiIconKey = keyof typeof UI_ICON_RESOURCES;

export const WEB_UI_ICONS: Record<UiIconKey, string> = Object.fromEntries(
  Object.entries(UI_ICON_RESOURCES).map(([k, v]) => [k, `/resources/${v}`])
) as Record<UiIconKey, string>;

export const MINIGAME_UI_ICON_PATHS: string[] = Object.values(UI_ICON_RESOURCES).map(
  (rel) => `resources/${rel}`
);

export const MINIGAME_STATIC_SPRITE_PATHS: string[] = [
  'resources/sprites/cardboard_closed.png',
  'resources/sprites/cardboard_cracked.png',
  'resources/sprites/cat_idle.png',
  'resources/sprites/cat_mischief.png',
  'resources/sprites/cat_happy.png',
];

export const BOOSTER_DEFS: ReadonlyArray<{
  type: BoosterType;
  iconKey: Extract<UiIconKey, 'magnet' | 'undo' | 'hint' | 'shuffle'>;
  name: string;
}> = [
  { type: 'magnet', iconKey: 'magnet', name: '磁铁' },
  { type: 'undo', iconKey: 'undo', name: '撤销' },
  { type: 'hint', iconKey: 'hint', name: '提示' },
  { type: 'shuffle', iconKey: 'shuffle', name: '洗牌' },
];

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  unlock_order_box: '解锁第 3 个并行订单箱（本关永久生效）',
  fill_order_box: '将当前订单箱直接装满并立即打包',
  unlock_tray_slot: '额外扩容 +1 个暂存槽（本关生效）',
  revive_clear_tray: '清空最后 3 件暂存杂物并复活继续',
  booster_magnet: '领取 1 个「强力磁铁」并立即吸附目标',
  booster_undo: '领取 1 个「撤销」并退回误点杂物',
  booster_hint: '领取 1 个「线索提示」定位目标物',
  booster_shuffle: '领取 1 个「重新洗牌」翻开底层物品',
  cat_pet_extra: '喂给橘猫一根专属猫条，让它立刻替你找出 1 件目标物',
  daily_cat_bonus: '领取今日额外猫条 +1',
  refill_lives: '立即恢复 +2 次挑战体力，继续闯关!',
};
