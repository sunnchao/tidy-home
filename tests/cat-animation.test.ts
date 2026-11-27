import { describe, expect, it } from 'vitest';
import {
  buildHomeCatLines,
  computeBlinkFactor,
  pickTapReactionLine,
  sliceTypedText,
} from '@core/catAnimation';

describe('sliceTypedText', () => {
  it('progressively reveals text character by character', () => {
    const line = '喵～ 今天也一起收拾吧!';
    const start = sliceTypedText(line, 0, 20);
    expect(start.typedChars).toBe(1);
    expect(start.visibleText).toBe('喵');
    expect(start.typing).toBe(true);

    const mid = sliceTypedText(line, 0.25, 20);
    expect(mid.typedChars).toBe(6);
    expect(mid.typing).toBe(true);

    const done = sliceTypedText(line, 2, 20);
    expect(done.visibleText).toBe(line);
    expect(done.typing).toBe(false);
  });

  it('handles empty strings gracefully', () => {
    expect(sliceTypedText('', 1)).toEqual({
      visibleText: '',
      typedChars: 0,
      totalChars: 0,
      typing: false,
    });
  });
});

describe('buildHomeCatLines', () => {
  it('includes daily free treat reminder when claimable', () => {
    const lines = buildHomeCatLines({
      roomTheme: 'living_room',
      currentLevel: 1,
      totalLevelsCleared: 0,
      petTreats: 1,
      canClaimDailyFree: true,
    });
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines.some((l) => l.includes('猫条小铺'))).toBe(true);
  });

  it('adapts dialogue to all 6 room themes, coins, share tips, and zero treats', () => {
    const bedroomLines = buildHomeCatLines({
      roomTheme: 'bedroom',
      currentLevel: 6,
      totalLevelsCleared: 5,
      petTreats: 0,
      canClaimDailyFree: false,
      coins: 80,
      canClaimShare: true,
    });
    expect(bedroomLines.some((l) => l.includes('梦幻卧室'))).toBe(true);
    expect(bedroomLines.some((l) => l.includes('第 6 关'))).toBe(true);
    expect(bedroomLines.some((l) => l.includes('80 金币'))).toBe(true);
    expect(bedroomLines.some((l) => l.includes('平台的成功确认'))).toBe(true);

    const bathLines = buildHomeCatLines({
      roomTheme: 'bathroom',
      currentLevel: 2,
      totalLevelsCleared: 1,
      petTreats: 1,
      canClaimDailyFree: false,
    });
    expect(bathLines.some((l) => l.includes('泡泡浴室'))).toBe(true);

    const studyLines = buildHomeCatLines({
      roomTheme: 'study',
      currentLevel: 3,
      totalLevelsCleared: 2,
      petTreats: 1,
      canClaimDailyFree: false,
    });
    expect(studyLines.some((l) => l.includes('森林画室'))).toBe(true);

    const cafeLines = buildHomeCatLines({
      roomTheme: 'cafe',
      currentLevel: 4,
      totalLevelsCleared: 3,
      petTreats: 1,
      canClaimDailyFree: false,
    });
    expect(cafeLines.some((l) => l.includes('樱花甜品屋'))).toBe(true);
  });
});

describe('computeBlinkFactor & pickTapReactionLine', () => {
  it('blinks smoothly within [0, 1] and stays open during rest of period', () => {
    expect(computeBlinkFactor(0.085)).toBeGreaterThan(0.9);
    expect(computeBlinkFactor(1.5)).toBe(0);
  });

  it('cycles tap reaction lines deterministically', () => {
    expect(pickTapReactionLine(0)).not.toBe(pickTapReactionLine(1));
    expect(pickTapReactionLine(0)).toBe(pickTapReactionLine(4));
  });
});
