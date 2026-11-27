import { DouyinAdapter, type DouyinAdConfig } from './DouyinAdapter';
import type { IPlatformAdapter } from './IPlatformAdapter';
import { MockPlatformAdapter } from './MockPlatformAdapter';
import { WeChatAdapter, type WeChatAdConfig } from './WeChatAdapter';

declare const wx: any;
declare const tt: any;

export function createPlatformAdapter(config: { wechat?: WeChatAdConfig; douyin?: DouyinAdConfig } = {}): IPlatformAdapter {
  if (
    typeof tt !== 'undefined' &&
    (typeof tt.createRewardedVideoAd === 'function' || typeof tt.getStorageSync === 'function')
  ) {
    return new DouyinAdapter(config.douyin);
  }
  if (
    typeof wx !== 'undefined' &&
    (typeof wx.createRewardedVideoAd === 'function' || typeof wx.getStorageSync === 'function')
  ) {
    return new WeChatAdapter(config.wechat);
  }
  return new MockPlatformAdapter();
}
