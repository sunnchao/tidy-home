import type { ShareRequest } from './shareVerifier';
import type { AdPlacement } from './types';

export function isShareUnlockMode(platformName: string): boolean {
  return platformName === 'douyin';
}

export interface RewardUnlockCopy {
  modalTitle: string;
  actionLabel: string;
  buttonLabel: string;
  shortTag: string;
  shareTitle: (ctx: { levelNumber: number; roomName?: string }) => string;
  successToast: string;
}

export const REWARD_UNLOCK_COPY: Record<AdPlacement, RewardUnlockCopy> = {
  unlock_order_box: {
    modalTitle: '分享好友解锁第 3 订单箱',
    actionLabel: '解锁第 3 个并行订单箱（本关永久生效）',
    buttonLabel: '分享解锁第 3 箱',
    shortTag: '解锁第3箱',
    shareTitle: ({ levelNumber, roomName }) =>
      `我在《我来收纳》整理第 ${levelNumber} 关「${roomName ?? '温馨小屋'}」，快来帮我开启第 3 个收纳箱！`,
    successToast: '分享成功！第 3 订单箱已开启',
  },
  fill_order_box: {
    modalTitle: '分享好友一键装满订单箱',
    actionLabel: '将当前收纳箱剩余物品直接装满并立即打包',
    buttonLabel: '分享好友一键装满',
    shortTag: '装满',
    shareTitle: ({ levelNumber, roomName }) =>
      `我在《我来收纳》第 ${levelNumber} 关「${roomName ?? '温馨小屋'}」打包超解压，快来一起装满收纳箱！`,
    successToast: '分享成功！订单箱已装满打包',
  },
  unlock_tray_slot: {
    modalTitle: '分享好友扩容暂存槽',
    actionLabel: '额外扩容 +1 个暂存槽（本关生效）',
    buttonLabel: '分享扩容 +1 格',
    shortTag: '解锁+1',
    shareTitle: ({ levelNumber, roomName }) =>
      `我在《我来收纳》第 ${levelNumber} 关「${roomName ?? '温馨小屋'}」差一点位置，快来看看我的房间整理！`,
    successToast: '分享成功！暂存槽已扩容 +1 格',
  },
  revive_clear_tray: {
    modalTitle: '分享好友清理暂存槽并继续',
    actionLabel: '移出最后 3 件暂存杂物并保留连胜继续整理',
    buttonLabel: '分享好友复活（移出 3 件）',
    shortTag: '分享复活',
    shareTitle: ({ levelNumber, roomName }) =>
      `第 ${levelNumber} 关「${roomName ?? '温馨小屋'}」差点装满啦，分享战绩继续冲关！`,
    successToast: '分享成功！已移出 3 件杂物继续整理',
  },
  booster_magnet: {
    modalTitle: '分享好友领「强力磁铁」',
    actionLabel: '免费获得 1 个「强力磁铁」并立即吸附目标',
    buttonLabel: '分享好友用磁铁',
    shortTag: '分享领磁铁',
    shareTitle: ({ levelNumber }) =>
      `我在《我来收纳》挑战第 ${levelNumber} 关，快来一起高效整理小屋！`,
    successToast: '分享成功！强力磁铁已生效',
  },
  booster_undo: {
    modalTitle: '分享好友领「撤销」',
    actionLabel: '免费获得 1 个「撤销」并退回最后一件暂存物',
    buttonLabel: '分享好友用撤销',
    shortTag: '分享领撤销',
    shareTitle: ({ levelNumber }) =>
      `我在《我来收纳》第 ${levelNumber} 关精打细算，快来一起挑战整理！`,
    successToast: '分享成功！撤销道具已生效',
  },
  booster_hint: {
    modalTitle: '分享好友领「线索提示」',
    actionLabel: '免费获得 1 个「线索提示」立即定位关键物品',
    buttonLabel: '分享好友看提示',
    shortTag: '分享看提示',
    shareTitle: ({ levelNumber }) =>
      `我在《我来收纳》第 ${levelNumber} 关寻宝中，快来和我一起眼力大考验！`,
    successToast: '分享成功！已为你标出关键物品',
  },
  booster_shuffle: {
    modalTitle: '分享好友领「重新洗牌」',
    actionLabel: '免费获得 1 个「重新洗牌」翻开底层物品',
    buttonLabel: '分享好友重排',
    shortTag: '分享重排',
    shareTitle: ({ levelNumber }) =>
      `我在《我来收纳》挑战第 ${levelNumber} 关，重排房间物品接着冲！`,
    successToast: '分享成功！已完成物品重排',
  },
  cat_pet_extra: {
    modalTitle: '分享好友请橘猫额外寻物',
    actionLabel: '给橘猫额外加餐，立刻帮你找出 1 件目标物',
    buttonLabel: '分享好友请橘猫寻物 (+1次)',
    shortTag: '分享续摸',
    shareTitle: ({ levelNumber, roomName }) =>
      `我家橘猫正在帮我整理第 ${levelNumber} 关「${roomName ?? '温馨小屋'}」，快来吸猫一起玩！`,
    successToast: '分享成功！橘猫帮你收好了一件目标物',
  },
  daily_cat_bonus: {
    modalTitle: '分享好友领今日加餐猫条',
    actionLabel: '额外领取今日补给猫条 +1',
    buttonLabel: '分享好友额外领 +1 猫条',
    shortTag: '分享加餐',
    shareTitle: ({ levelNumber }) =>
      `我在《我来收纳》整理到第 ${levelNumber} 关啦，分享领猫条和好友一起打卡！`,
    successToast: '分享成功！获得额外猫条 +1',
  },
  refill_lives: {
    modalTitle: '分享好友恢复 +2 体力',
    actionLabel: '立即恢复 +2 点挑战体力，继续闯关',
    buttonLabel: '分享好友恢复 +2 体力',
    shortTag: '分享回体',
    shareTitle: ({ levelNumber }) =>
      `《我来收纳》第 ${levelNumber} 关太上头了，体力补给一下继续冲！`,
    successToast: '分享成功！已恢复 +2 体力',
  },
};

export function buildRewardShareRequest(
  placement: AdPlacement,
  ctx: { userId: string; levelNumber: number; roomName?: string }
): ShareRequest {
  const copy = REWARD_UNLOCK_COPY[placement];
  return {
    title: copy.shareTitle({ levelNumber: ctx.levelNumber, roomName: ctx.roomName }),
    query: `from=${ctx.userId}&lv=${ctx.levelNumber}&unlock=${placement}`,
    purposeTitle: copy.modalTitle,
    rewardDesc: copy.actionLabel,
  };
}
