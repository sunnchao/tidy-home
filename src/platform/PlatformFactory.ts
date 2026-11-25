import { DouyinAdapter } from './DouyinAdapter';
import type { IPlatformAdapter } from './IPlatformAdapter';
import { MockPlatformAdapter } from './MockPlatformAdapter';
import { WeChatAdapter } from './WeChatAdapter';

declare const wx: any;
declare const tt: any;

export function createPlatformAdapter(): IPlatformAdapter {
  if (
    typeof tt !== 'undefined' &&
    (typeof tt.createRewardedVideoAd === 'function' || typeof tt.getStorageSync === 'function')
  ) {
    return new DouyinAdapter();
  }
  if (
    typeof wx !== 'undefined' &&
    (typeof wx.createRewardedVideoAd === 'function' || typeof wx.getStorageSync === 'function')
  ) {
    return new WeChatAdapter();
  }
  return new MockPlatformAdapter();
}
