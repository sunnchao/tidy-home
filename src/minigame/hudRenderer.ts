import { getItemSprite, ITEM_BY_ID, ROOM_CATALOG } from '@core/catalogs';
import { type FlyingItemAnim, sampleSlotBounce } from '@core/flyAnimation';
import { REWARD_UNLOCK_COPY } from '@core/rewardUnlock';
import type { BoosterType, SessionSnapshot } from '@core/types';
import { BOOSTER_DEFS, UI_ICON_RESOURCES } from '@shared/constants';
import { computeOrderSlotDisplay, getLevelBadgeTag } from '@shared/hudViewModel';
import type { OrderFlowTracker } from '@shared/orderFlowTracker';
import type { MiniGameAssetStore } from './assets';
import { drawImg, drawRoundRect, drawSoftCard } from './canvasPrimitives';
import type { HitRect, HudLayout, MiniGameModal } from './types';

export interface HudRenderDeps {
  ctx: any;
  assets: MiniGameAssetStore;
  layout: HudLayout;
  snap: SessionSnapshot;
  roomName: string;
  tintLabel: string;
  accentColor: string;
  shareUnlock?: boolean;
  activeModal: MiniGameModal;
  orderFlow: OrderFlowTracker;
  activeFlys: readonly FlyingItemAnim[];
  slotLandAtMs: ReadonlyMap<string, number>;
  hudHitRegions: HitRect[];
  onGoHome: () => void;
  onOpenSettings: () => void;
  onUnlockOrderBox: () => void;
  onFillOrderBox: (slotIndex: number) => void;
  onUnlockTraySlot: () => void;
  onTapBooster: (type: BoosterType) => void;
  onBoxSealedToast: () => void;
}

export function renderInGameHud(deps: HudRenderDeps): void {
  const { ctx, assets, layout, snap, roomName, tintLabel, accentColor, shareUnlock } = deps;
  const { ox, topY, barY, orderY, boostersY, trayRowY } = layout;
  const now = Date.now();

  // Row 1: Home + Level Pill + Settings
  drawSoftCard(ctx, ox + 18, topY, 50, 44, 22, 'rgba(255, 253, 249, 0.92)', 'rgba(90, 66, 52, 0.14)', 1.5, 0.09, 3);
  drawImg(ctx, assets, 'resources/ui/icon_home.png', ox + 28, topY + 7, 30, 30);

  drawSoftCard(ctx, ox + 76, topY, 294, 44, 22, 'rgba(255, 253, 249, 0.92)', 'rgba(90, 66, 52, 0.14)', 1.5, 0.09, 3);
  drawRoundRect(ctx, ox + 82, topY + 6, 70, 32, 16, accentColor);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv.${snap.levelNumber}`, ox + 117, topY + 28);
  ctx.fillStyle = '#3B2D26';
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${roomName}·${tintLabel}`, ox + 162, topY + 28);

  const badgeTag = getLevelBadgeTag(snap, true);
  if (badgeTag) {
    drawSoftCard(ctx, ox + 382, topY + 4, 152, 36, 18, ROOM_CATALOG[snap.theme].badgeBg, 'rgba(90, 66, 52, 0.14)', 1.2, 0.06, 2);
    ctx.fillStyle = ROOM_CATALOG[snap.theme].accentDeep;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeTag, ox + 458, topY + 28);
  }

  drawSoftCard(ctx, ox + 644, topY, 54, 44, 22, 'rgba(255, 253, 249, 0.92)', 'rgba(90, 66, 52, 0.14)', 1.5, 0.09, 3);
  drawImg(ctx, assets, 'resources/ui/icon_settings.png', ox + 656, topY + 7, 30, 30);

  if (deps.activeModal === 'none' && snap.status === 'playing') {
    deps.hudHitRegions.push(
      { x: ox + 18, y: topY, w: 50, h: 44, onTap: deps.onGoHome },
      { x: ox + 644, y: topY, w: 54, h: 44, onTap: deps.onOpenSettings }
    );
  }

  // Progress bar
  const ratio = snap.progressTotal > 0 ? snap.progressDone / snap.progressTotal : 0;
  drawRoundRect(ctx, ox + 20, barY + 3, 536, 14, 7, 'rgba(72, 52, 40, 0.11)', 'rgba(72, 52, 40, 0.08)', 1);
  if (ratio > 0) {
    drawRoundRect(ctx, ox + 21, barY + 4, Math.max(14, 534 * ratio), 12, 6, accentColor);
  }
  ctx.fillStyle = '#3B2D26';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${snap.distinctItemTypes}类 ${snap.progressDone}/${snap.progressTotal}`, ox + 700, barY + 16);

  // Open-box order slots ([Image #1] 3D cardboard look + mint counter pill + quick-fill)
  snap.orderSlots.forEach((slot, idx) => {
    const bx = ox + 20 + idx * 230;
    const by = orderY;
    const bw = 220;
    const bh = 114;
    const tr = deps.orderFlow.getActiveTransition(idx, now);
    if (tr && tr.sample.phase === 'sealed' && !tr.transition.sealNotified) {
      tr.transition.sealNotified = true;
      deps.onBoxSealedToast();
    }
    const bounce = sampleSlotBounce(deps.slotLandAtMs.get(`order_${idx}`), now);
    const totalScale = (tr ? tr.sample.scale : 1) * (bounce.active ? bounce.scale : 1);
    const offsetY = tr ? tr.sample.offsetY * 1.55 : 0;
    const rotRad = tr ? (tr.sample.rotationDeg * Math.PI) / 180 : 0;
    const alpha = tr ? tr.sample.opacity : 1;

    ctx.save();
    ctx.globalAlpha *= alpha;
    if (totalScale !== 1 || offsetY !== 0 || rotRad !== 0) {
      const cx = bx + bw * 0.5;
      const cy = by + bh * 0.5;
      ctx.translate(cx, cy + offsetY);
      if (rotRad !== 0) ctx.rotate(rotRad);
      if (totalScale !== 1) ctx.scale(totalScale, totalScale);
      ctx.translate(-cx, -cy);
    }

    if (!slot.unlocked && slot.isAdSlot && !tr) {
      drawSoftCard(ctx, bx, by, bw, bh, 14, '#2C2725', '#1F1B1A', 3, 0.14, 3);
      drawRoundRect(ctx, bx + 4, by + 4, bw - 8, 18, 8, '#1E1A19');
      drawImg(ctx, assets, 'resources/ui/icon_lock.png', bx + 94, by + 30, 32, 32);
      ctx.fillStyle = '#EAE2DA';
      ctx.font = 'bold 19px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(REWARD_UNLOCK_COPY.unlock_order_box.shortTag, bx + bw / 2, by + 92);
      if (deps.activeModal === 'none' && snap.status === 'playing') {
        deps.hudHitRegions.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          onTap: deps.onUnlockOrderBox,
        });
      }
    } else {
      const display = computeOrderSlotDisplay(slot, tr, deps.orderFlow.getInFlightCounts());
      if (display.displayOrder) {
        const { displayOrder, displayCount, showSealed, isEntering } = display;
        drawSoftCard(
          ctx,
          bx,
          by,
          bw,
          bh,
          14,
          showSealed ? '#EEFBE8' : bounce.active ? '#FFF9E8' : '#F8F4EC',
          isEntering ? '#E89643' : '#3D2B24',
          3,
          0.14,
          4
        );
        drawRoundRect(ctx, bx + 4, by + 4, bw - 8, 16, 6, '#D6CEC4', '#3D2B24', 1.8);

        const def = ITEM_BY_ID[displayOrder.itemId];
        drawImg(ctx, assets, `resources/${def.spriteResource}.png`, bx + 16, by + 26, 60, 60);
        ctx.fillStyle = '#3D2B24';
        ctx.font = 'bold 21px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(def.name, bx + 84, by + 64);

        if (!showSealed) {
          drawRoundRect(ctx, bx - 4, by - 10, 64, 28, 14, '#E8763B', '#3D2B24', 2);
          ctx.fillStyle = '#FFFDF9';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('装满', bx + 28, by + 10);
          if (deps.activeModal === 'none' && snap.status === 'playing') {
            deps.hudHitRegions.push({
              x: bx - 8,
              y: by - 12,
              w: 74,
              h: 34,
              onTap: () => deps.onFillOrderBox(idx),
            });
          }
          drawRoundRect(ctx, bx + 60, by + bh - 15, 100, 30, 8, '#8FD4C6', '#3D2B24', 2.4);
          ctx.fillStyle = '#2B211C';
          ctx.font = 'bold 19px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${displayCount}/${displayOrder.requiredCount}`, bx + 110, by + bh + 7);
        } else {
          drawRoundRect(ctx, bx + 54, by + bh - 16, 112, 30, 14, '#2F8F63', '#3D2B24', 2.2);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 17px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('已装满 ✓', bx + 110, by + bh + 6);
        }
      } else {
        drawSoftCard(ctx, bx, by, bw, bh, 14, '#EDF6EC', '#4E8A5A', 2.2, 0.08, 3);
        drawImg(ctx, assets, 'resources/ui/icon_check.png', bx + 86, by + 20, 46, 46);
        ctx.fillStyle = '#4E8A5A';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('已清完', bx + bw / 2, by + 95);
      }
    }
    ctx.restore();
  });

  // Top 7-slot waiting tray right below order boxes ([Image #1] placement)
  drawSoftCard(ctx, ox + 18, trayRowY, 684, 96, 16, '#D8D1C9', '#3D2B24', 2.6, 0.14, 4);
  for (let i = 0; i < snap.trayMaxSlots; i++) {
    const tx = ox + 30 + i * 95;
    const ty = trayRowY + 9;
    const unlocked = i < snap.trayUnlockedSlots;
    const item = snap.tray[i];
    if (!unlocked) {
      drawRoundRect(ctx, tx, ty, 84, 78, 12, '#35302E', '#221D1B', 2.2);
      drawImg(ctx, assets, 'resources/ui/icon_lock.png', tx + 26, ty + 14, 32, 32);
      ctx.fillStyle = '#EFEAE4';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+1', tx + 42, ty + 68);
      if (deps.activeModal === 'none' && snap.status === 'playing') {
        deps.hudHitRegions.push({
          x: tx,
          y: ty,
          w: 84,
          h: 78,
          onTap: deps.onUnlockTraySlot,
        });
      }
    } else {
      const bounce = sampleSlotBounce(deps.slotLandAtMs.get(`tray_${i}`), now);
      const pendingFlight = Boolean(
        item && deps.activeFlys.some((f) => f.uid === item.uid && f.kind === 'to_tray')
      );
      ctx.save();
      if (bounce.active) {
        const cx = tx + 42;
        const cy = ty + 39;
        ctx.translate(cx, cy);
        ctx.scale(bounce.scale, bounce.scale);
        ctx.translate(-cx, -cy);
      }
      drawRoundRect(
        ctx,
        tx,
        ty,
        84,
        78,
        12,
        pendingFlight ? '#FFF5E0' : bounce.active ? '#FFF9E8' : item ? '#FFFDF9' : '#FAF2DC',
        pendingFlight || bounce.active ? '#E87630' : '#3D2B24',
        2.2
      );
      if (item && !pendingFlight) {
        drawImg(
          ctx,
          assets,
          `resources/${getItemSprite(item.itemId, item.variantIndex ?? 0).spriteResource}.png`,
          tx + 10,
          ty + 7,
          64,
          64
        );
      }
      ctx.restore();
    }
  }

  // Compact bottom 4-pill boosters dock
  BOOSTER_DEFS.forEach((b, i) => {
    const bx = ox + 22 + i * 172;
    const by = boostersY;
    const bw = 158;
    const bh = 62;
    drawSoftCard(ctx, bx, by, bw, bh, 31, 'rgba(255, 253, 249, 0.94)', 'rgba(61, 43, 36, 0.25)', 2, 0.1, 3);
    drawImg(ctx, assets, `resources/${UI_ICON_RESOURCES[b.iconKey]}`, bx + 16, by + 13, 36, 36);
    ctx.fillStyle = '#3B2D26';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(b.name, bx + 58, by + 39);

    const cnt = snap.boosters[b.type];
    const pillW = cnt > 0 ? 34 : shareUnlock ? 44 : 36;
    drawSoftCard(
      ctx,
      bx + bw - pillW + 4,
      by - 8,
      pillW,
      28,
      14,
      cnt > 0 ? accentColor : shareUnlock ? '#3E9B6E' : '#4FA1DA',
      '#FFFDF9',
      2,
      0.16,
      2
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = cnt > 0 ? 'bold 16px sans-serif' : shareUnlock ? 'bold 13px sans-serif' : 'bold 16px sans-serif';
    ctx.fillText(cnt > 0 ? String(cnt) : shareUnlock ? '解锁' : 'AD', bx + bw - pillW * 0.5 + 4, by + 12);

    if (deps.activeModal === 'none' && snap.status === 'playing') {
      deps.hudHitRegions.push({
        x: bx,
        y: by,
        w: bw,
        h: bh,
        onTap: () => deps.onTapBooster(b.type),
      });
    }
  });
}
