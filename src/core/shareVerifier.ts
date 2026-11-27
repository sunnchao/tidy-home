export interface ShareRequest {
  title: string;
  query?: string;
  imageUrl?: string;
  purposeTitle?: string;
  rewardDesc?: string;
  rewardLabel?: string;
}

export type ShareVerifyReason =
  | 'sdk_confirmed'
  | 'unconfirmed'
  | 'cancelled'
  | 'failed'
  | 'unavailable';

export interface ShareResult {
  shared: boolean;
  verified: boolean;
  reason: ShareVerifyReason;
  message: string;
}

const SHARE_MESSAGES: Record<ShareVerifyReason, string> = {
  sdk_confirmed: '分享成功！',
  unconfirmed: '未收到分享成功确认',
  cancelled: '已取消分享',
  failed: '分享失败，请稍后再试',
  unavailable: '当前环境暂不支持分享',
};

export function evaluateExternalShare(reason: ShareVerifyReason): ShareResult {
  const verified = reason === 'sdk_confirmed';
  return {
    shared: verified,
    verified,
    reason,
    message: SHARE_MESSAGES[reason],
  };
}
