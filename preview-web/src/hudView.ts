import { getItemSprite, ITEM_BY_ID, ROOM_CATALOG } from '@core/catalogs';
import type { GameSession } from '@core/gameSession';
import type { AdPlacement, BoosterType, SessionSnapshot } from '@core/types';
import { BOOSTER_DEFS, WEB_UI_ICONS } from '@shared/constants';
import { computeOrderSlotDisplay, getLevelBadgeTag } from '@shared/hudViewModel';
import type { OrderFlowTracker } from '@shared/orderFlowTracker';
import type { ShellElements } from './shellTemplate';
import { spawnFloatToast } from './webEffects';

export interface WebHudViewDeps {
  el: ShellElements;
  orderFlow: OrderFlowTracker;
  getSession: () => GameSession | undefined;
  onUnlockOrderBox: () => void;
  onFillOrderBox: (slotIndex: number) => void;
  onUnlockTraySlot: () => void;
  onBoosterClick: (type: BoosterType) => void;
  onBoxSealSound: () => void;
  onRenderWinModal: (snap: SessionSnapshot) => void;
}

export class WebHudView {
  private readonly inFlightTrayUids = new Set<string>();
  private readonly orderCardRenderKeys = new Map<number, string>();
  private orderTransitionRafId = 0;

  constructor(private readonly deps: WebHudViewDeps) {}

  resetForLevel(): void {
    this.inFlightTrayUids.clear();
    if (this.orderTransitionRafId) {
      cancelAnimationFrame(this.orderTransitionRafId);
      this.orderTransitionRafId = 0;
    }
    this.orderCardRenderKeys.clear();
  }

  setTrayItemInFlight(uid: string, inFlight: boolean): void {
    if (!uid) return;
    if (inFlight) this.inFlightTrayUids.add(uid);
    else this.inFlightTrayUids.delete(uid);
  }

  flashTraySlotLanded(uid: string, trayIdx: number): void {
    const rack = this.deps.el.trayRackEl;
    const freshSlot = uid
      ? rack.querySelector<HTMLElement>(`[data-tray-uid="${uid}"]`)
      : (rack.children[trayIdx] as HTMLElement | undefined);
    if (!freshSlot) return;
    freshSlot.classList.remove('pending-arrival', 'slot-land-pop');
    void freshSlot.offsetWidth;
    freshSlot.classList.add('slot-land-pop');
    setTimeout(() => freshSlot.classList.remove('slot-land-pop'), 280);
  }

  flashOrderCardLanded(slotIndex: number): void {
    const landNow = performance.now();
    this.syncOrderSlotsVisual(landNow);
    const activeTr = this.deps.orderFlow.getActiveTransition(slotIndex, landNow);
    if (!activeTr || (activeTr.sample.phase !== 'sealed' && activeTr.sample.phase !== 'exiting')) {
      const liveCard = this.deps.el.ordersRowEl.querySelector<HTMLElement>(`[data-slot="${slotIndex}"]`);
      if (liveCard) {
        liveCard.classList.remove('order-land-pop');
        void liveCard.offsetWidth;
        liveCard.classList.add('order-land-pop');
        setTimeout(() => liveCard.classList.remove('order-land-pop'), 280);
      }
    }
  }

  getOrderSlotTargetRect(slotIndex: number, targetCard?: HTMLElement | null): DOMRect | null {
    const { ordersRowEl } = this.deps.el;
    const card = targetCard ?? ordersRowEl.querySelector<HTMLElement>(`[data-slot="${slotIndex}"]`);
    if (!card) return null;
    const activeTr = this.deps.orderFlow.getActiveTransition(slotIndex, performance.now());
    if (!activeTr) {
      const iconEl = card.querySelector<HTMLElement>('.order-head img');
      if (iconEl) return iconEl.getBoundingClientRect();
    }
    const rowRect = ordersRowEl.getBoundingClientRect();
    const cx = rowRect.left + card.offsetLeft + card.offsetWidth * 0.5;
    const cy = rowRect.top + card.offsetTop + 26;
    return new DOMRect(cx - 26, cy - 18, 36, 36);
  }

  ensureOrderTransitionLoop(): void {
    if (this.orderTransitionRafId) return;
    const step = (ts: number) => {
      this.orderTransitionRafId = 0;
      if (!this.deps.getSession()) return;
      const keepRunning = this.syncOrderSlotsVisual(ts);
      if (keepRunning) {
        this.orderTransitionRafId = requestAnimationFrame(step);
      }
    };
    this.orderTransitionRafId = requestAnimationFrame(step);
  }

  renderHeader(snap: SessionSnapshot): void {
    const { el } = this.deps;
    const room = ROOM_CATALOG[snap.theme];
    const tint = room.paletteTint[snap.timeOfDay];

    el.roomBgEl.src = room.bgWebUrl;
    el.roomBgEl.classList.toggle('in-play', snap.status === 'playing');
    el.tintEl.style.backgroundColor = tint.overlayColor;
    el.tintEl.style.opacity = String(tint.overlayOpacity);
    el.feverAuraEl.classList.toggle('active', snap.feverActive);

    el.levelNumEl.textContent = `Lv.${snap.levelNumber}`;
    el.levelNameEl.textContent = `${room.name} · ${tint.label}`;

    const badgeTag = getLevelBadgeTag(snap, false);
    if (badgeTag) {
      el.modifierBadgeEl.style.display = 'inline-block';
      el.modifierBadgeEl.textContent = badgeTag;
    } else {
      el.modifierBadgeEl.style.display = 'none';
    }

    const pct = snap.progressTotal > 0 ? Math.round((snap.progressDone / snap.progressTotal) * 100) : 0;
    el.progressFillEl.style.width = `${pct}%`;
    el.progressTextEl.textContent = `${snap.distinctItemTypes}类 · ${snap.progressDone}/${snap.progressTotal}`;
    el.hostTextEl.textContent = snap.tutorialHint ?? snap.hostOpening;
  }

  renderOrders(snap: SessionSnapshot): void {
    const { ordersRowEl } = this.deps.el;
    if (ordersRowEl.children.length !== snap.orderSlots.length) {
      this.orderCardRenderKeys.clear();
      ordersRowEl.innerHTML = snap.orderSlots
        .map((slot) => `<div class="order-card" data-slot="${slot.slotIndex}"></div>`)
        .join('');
      snap.orderSlots.forEach((slot) => {
        const card = ordersRowEl.children[slot.slotIndex] as HTMLElement | undefined;
        card?.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.order-fill-btn')) {
            e.stopPropagation();
            this.deps.onFillOrderBox(slot.slotIndex);
            return;
          }
          const latest = this.deps.getSession()?.getSnapshot().orderSlots[slot.slotIndex];
          const activeTr = this.deps.orderFlow.getActiveTransition(slot.slotIndex, performance.now());
          if (!activeTr && latest && !latest.unlocked && latest.isAdSlot) {
            this.deps.onUnlockOrderBox();
          }
        });
      });
    }
    this.syncOrderSlotsVisual(performance.now());
  }

  syncOrderSlotsVisual(now: number): boolean {
    const session = this.deps.getSession();
    if (!session) return false;
    const snap = session.getSnapshot();
    const { ordersRowEl } = this.deps.el;
    let hasActiveTransitions = false;

    for (const slot of snap.orderSlots) {
      const card = ordersRowEl.children[slot.slotIndex] as HTMLElement | undefined;
      if (!card) continue;

      const active = this.deps.orderFlow.getActiveTransition(slot.slotIndex, now);
      if (active) {
        hasActiveTransitions = true;
        if (active.sample.phase === 'sealed' && !active.transition.sealNotified) {
          active.transition.sealNotified = true;
          this.deps.onBoxSealSound();
          spawnFloatToast(card.getBoundingClientRect(), '打包完成! +1箱', '#FFD147');
        }
      }

      if (!slot.unlocked && slot.isAdSlot && !active) {
        const renderKey = 'locked';
        if (this.orderCardRenderKeys.get(slot.slotIndex) !== renderKey) {
          this.orderCardRenderKeys.set(slot.slotIndex, renderKey);
          card.className = 'order-card ad-locked';
          card.setAttribute('data-ad-order', '1');
          card.style.justifyContent = '';
          card.style.background = '';
          card.innerHTML = `
            <div class="order-lock-badge">
              <img class="ui-ico" src="${WEB_UI_ICONS.lock}" alt="解锁" />
            </div>
            <div class="order-lock-title">第 3 格订单</div>
            <div class="order-lock-sub">解锁第3箱</div>
          `;
        }
        card.style.transform = '';
        card.style.opacity = '';
        card.style.zIndex = '';
        continue;
      }

      const display = computeOrderSlotDisplay(slot, active, this.deps.orderFlow.getInFlightCounts());
      if (!display.displayOrder) {
        const renderKey = `done|${display.isEntering ? 'enter' : 'idle'}`;
        if (this.orderCardRenderKeys.get(slot.slotIndex) !== renderKey) {
          this.orderCardRenderKeys.set(slot.slotIndex, renderKey);
          card.className = `order-card${display.isEntering ? ' order-entering' : ''}`;
          card.removeAttribute('data-ad-order');
          card.style.justifyContent = 'center';
          card.style.background = '#EDF6EC';
          card.innerHTML = `
            <div style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:900;color:#4E8A5A;">
              <img class="ui-ico" src="${WEB_UI_ICONS.check}" alt="完成" /> 已清完
            </div>
          `;
        }
      } else {
        const { displayOrder, displayCount, showSealed, isEntering } = display;
        const renderKey = `order|${displayOrder.id}|${displayCount}|${showSealed ? '1' : '0'}|${isEntering ? '1' : '0'}`;
        if (this.orderCardRenderKeys.get(slot.slotIndex) !== renderKey) {
          this.orderCardRenderKeys.set(slot.slotIndex, renderKey);
          const preservePop = !showSealed && card.classList.contains('order-land-pop');
          card.className = `order-card${showSealed ? ' order-sealed' : isEntering ? ' order-entering' : ''}${
            preservePop ? ' order-land-pop' : ''
          }`;
          card.removeAttribute('data-ad-order');
          card.style.justifyContent = '';
          card.style.background = '';
          const def = ITEM_BY_ID[displayOrder.itemId];
          const fillBtnHtml = !showSealed
            ? `<button class="order-fill-btn" type="button" title="一键装满此箱">装满</button>`
            : '';
          const footerHtml = showSealed
            ? `<div class="order-sealed-row"><span class="order-sealed-stamp">已装满 ✓</span></div>`
            : `<span class="order-count-pill">${displayCount}/${displayOrder.requiredCount}</span>`;
          card.innerHTML = `
            <div class="order-box-lip"></div>
            ${fillBtnHtml}
            <div class="order-head">
              <img src="${def.spriteWebUrl}" alt="${def.name}" />
              <span class="order-name">${def.name}</span>
            </div>
            ${footerHtml}
          `;
        }
      }

      if (active) {
        card.style.transform = `translateY(${active.sample.offsetY.toFixed(2)}px) scale(${active.sample.scale.toFixed(
          3
        )}) rotate(${active.sample.rotationDeg.toFixed(2)}deg)`;
        card.style.opacity = active.sample.opacity.toFixed(3);
        card.style.zIndex = active.sample.phase === 'sealed' || active.sample.phase === 'exiting' ? '4' : '1';
      } else {
        card.style.transform = '';
        card.style.opacity = '';
        card.style.zIndex = '';
      }
    }

    if (snap.status === 'won') {
      if (this.deps.orderFlow.isWinReady(now)) {
        this.deps.onRenderWinModal(snap);
      } else {
        hasActiveTransitions = true;
      }
    }
    return hasActiveTransitions;
  }

  renderTray(snap: SessionSnapshot): void {
    const { trayRackEl } = this.deps.el;
    const cells: string[] = [];
    for (let i = 0; i < snap.trayMaxSlots; i++) {
      const unlocked = i < snap.trayUnlockedSlots;
      const item = snap.tray[i];
      if (!unlocked) {
        cells.push(
          `<div class="tray-slot ad-slot" data-ad-tray="1"><img class="ui-ico" src="${
            WEB_UI_ICONS.lock
          }" alt="解锁" /><span>+1</span></div>`
        );
      } else if (item) {
        const def = ITEM_BY_ID[item.itemId];
        const itemSpriteUrl = getItemSprite(item.itemId, item.variantIndex ?? 0).spriteWebUrl;
        const pending = this.inFlightTrayUids.has(item.uid) ? ' pending-arrival' : '';
        cells.push(
          `<div class="tray-slot occupied${pending}" data-tray-uid="${item.uid}"><img class="tray-item-img" src="${itemSpriteUrl}" alt="${def.name}" /></div>`
        );
      } else {
        cells.push(`<div class="tray-slot"></div>`);
      }
    }
    trayRackEl.innerHTML = cells.join('');
    trayRackEl.querySelectorAll<HTMLElement>('[data-ad-tray="1"]').forEach((slotEl) => {
      slotEl.addEventListener('click', () => {
        this.deps.onUnlockTraySlot();
      });
    });
  }

  renderBoosters(snap: SessionSnapshot): void {
    const { boostersRowEl } = this.deps.el;
    boostersRowEl.innerHTML = BOOSTER_DEFS.map((d) => {
      const count = snap.boosters[d.type];
      const badge =
        count > 0
          ? `<span class="booster-badge">${count}</span>`
          : `<span class="booster-badge ad"><img class="ui-ico" style="width:14px;height:14px" src="${
              WEB_UI_ICONS.lock
            }" alt="解锁" /></span>`;
      return `
        <button class="booster-btn" data-booster="${d.type}" type="button">
          ${badge}
          <div class="booster-icon-wrap">
            <img class="booster-ico" src="${WEB_UI_ICONS[d.iconKey]}" alt="${d.name}" />
          </div>
          <span>${d.name}</span>
        </button>
      `;
    }).join('');

    boostersRowEl.querySelectorAll<HTMLElement>('[data-booster]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.booster as BoosterType;
        this.deps.onBoosterClick(type);
      });
    });
  }

  renderComboBanner(snap: SessionSnapshot): void {
    const { comboEl } = this.deps.el;
    if (snap.feverActive) {
      comboEl.classList.add('visible');
      comboEl.innerHTML = `<img class="ui-ico" src="${WEB_UI_ICONS.flame}" alt="" /> 整理狂热 FEVER · ${snap.feverRemainingSec.toFixed(1)}s`;
    } else if (snap.comboCount >= 2) {
      comboEl.classList.add('visible');
      const left = 5 - snap.comboCount;
      comboEl.innerHTML = `<img class="ui-ico" src="${WEB_UI_ICONS.flame}" alt="" /> ${snap.comboCount} 连击! (${left > 0 ? `再${left}次触发狂热` : '满格!'})`;
    } else {
      comboEl.classList.remove('visible');
    }
  }
}

export type BoosterPlacement = Extract<AdPlacement, `booster_${BoosterType}`>;
