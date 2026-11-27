import { getItemSprite, getItemSpritePool, ITEM_BY_ID } from '@core/catalogs';
import type { GameSession } from '@core/gameSession';
import type { BoardItemInstance } from '@core/types';
import { computeAspectDimensions } from '@core/visualDepth';
import type { ShellElements } from './shellTemplate';

export interface EditorModeDeps {
  el: ShellElements;
  getSession: () => GameSession | undefined;
  onRender: () => void;
}

/**
 * Lightweight `?editor=1` visual room-slot fine-tuning overlay.
 * Allows dragging board items, rotating, scaling, cycling semantic poses,
 * and copying ready-to-paste RoomAnchor JSON snippets.
 */
export class VisualLayoutEditor {
  readonly enabled: boolean;
  private panelEl: HTMLElement | null = null;
  private selectedUid: string | null = null;
  private dragState: {
    uid: string;
    pointerId: number;
    startX: number;
    startY: number;
    origNormX: number;
    origNormY: number;
  } | null = null;

  constructor(private readonly deps: EditorModeDeps) {
    this.enabled =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('editor') === '1';
    if (this.enabled) {
      this.mountUi();
      this.bindBoardDrag();
    }
  }

  private getSelectedItem(): BoardItemInstance | undefined {
    if (!this.selectedUid) return undefined;
    return this.deps
      .getSession()
      ?.getSnapshot()
      .items.find((it) => it.uid === this.selectedUid && it.state === 'on_board');
  }

  private mutateSelected(fn: (item: BoardItemInstance) => void): void {
    const session = this.deps.getSession();
    if (!session || !this.selectedUid) return;
    // GameSession snapshots clone items; adjust internal items array directly in dev editor mode
    const rawItems = (session as unknown as { items?: BoardItemInstance[] }).items;
    const item = rawItems?.find((it) => it.uid === this.selectedUid && it.state === 'on_board');
    if (!item) return;
    fn(item);
    this.deps.onRender();
    this.refreshPanel();
  }

  private mountUi(): void {
    const panel = document.createElement('div');
    panel.className = 'editor-overlay-bar';
    panel.innerHTML = `
      <div class="editor-head">
        <span>✎ 摆位编辑 (?editor=1)</span>
        <span class="editor-coords">点击画布物品选中后可拖拽微调</span>
      </div>
      <div class="editor-controls">
        <button type="button" data-ed="rot-minus">↺ -5°</button>
        <button type="button" data-ed="rot-plus">↻ +5°</button>
        <button type="button" data-ed="scale-minus">－缩放</button>
        <button type="button" data-ed="scale-plus">＋缩放</button>
        <button type="button" data-ed="pose-next">换姿态</button>
        <button type="button" data-ed="copy-json">复制JSON</button>
      </div>
    `;
    panel.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-ed]');
      if (!btn) return;
      const action = btn.dataset.ed;
      if (action === 'rot-minus') {
        this.mutateSelected((it) => {
          it.rotation = Number((it.rotation - 5).toFixed(1));
        });
      } else if (action === 'rot-plus') {
        this.mutateSelected((it) => {
          it.rotation = Number((it.rotation + 5).toFixed(1));
        });
      } else if (action === 'scale-minus') {
        this.mutateSelected((it) => {
          it.scale = Number(Math.max(0.65, it.scale - 0.04).toFixed(2));
        });
      } else if (action === 'scale-plus') {
        this.mutateSelected((it) => {
          it.scale = Number(Math.min(1.35, it.scale + 0.04).toFixed(2));
        });
      } else if (action === 'pose-next') {
        this.mutateSelected((it) => {
          const pool = getItemSpritePool(it.itemId);
          const nextIdx = ((it.variantIndex ?? 0) + 1) % pool.length;
          const meta = getItemSprite(it.itemId, nextIdx);
          it.variantIndex = nextIdx;
          it.pose = meta.pose;
          it.aspectRatio = meta.aspectRatio;
        });
      } else if (action === 'copy-json') {
        const cur = this.getSelectedItem();
        if (!cur) return;
        const snippet = JSON.stringify({
          id: cur.anchorId,
          x: Number(cur.x.toFixed(3)),
          y: Number(cur.y.toFixed(3)),
          scale: Number(cur.scale.toFixed(2)),
          preferredPose: cur.pose ?? 'flat',
          fixedRotation: Math.round(cur.rotation),
        });
        navigator.clipboard?.writeText(snippet).catch(() => undefined);
        const coordsEl = this.panelEl?.querySelector('.editor-coords');
        if (coordsEl) coordsEl.textContent = `已复制: ${snippet}`;
      }
    });
    this.deps.el.shellEl.appendChild(panel);
    this.panelEl = panel;
  }

  private bindBoardDrag(): void {
    const { itemsLayerEl, boardEl } = this.deps.el;
    itemsLayerEl.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.enabled) return;
        const itemEl = (e.target as HTMLElement).closest<HTMLElement>('.board-item');
        if (!itemEl || !itemEl.dataset.uid) return;
        e.stopPropagation();
        e.preventDefault();
        this.selectedUid = itemEl.dataset.uid;
        const cur = this.getSelectedItem();
        if (!cur) return;
        this.dragState = {
          uid: cur.uid,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          origNormX: cur.x,
          origNormY: cur.y,
        };
        this.refreshPanel();
      },
      true
    );

    itemsLayerEl.addEventListener(
      'click',
      (e) => {
        if (this.enabled) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );

    window.addEventListener('pointermove', (e) => {
      if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;
      const rect = boardEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dx = (e.clientX - this.dragState.startX) / rect.width;
      const dy = (e.clientY - this.dragState.startY) / rect.height;
      const origX = this.dragState.origNormX;
      const origY = this.dragState.origNormY;
      this.mutateSelected((it) => {
        it.x = Number(Math.min(0.92, Math.max(0.08, origX + dx)).toFixed(3));
        it.y = Number(Math.min(0.77, Math.max(0.39, origY + dy)).toFixed(3));
      });
    });

    const endDrag = (e: PointerEvent) => {
      if (this.dragState && e.pointerId === this.dragState.pointerId) {
        this.dragState = null;
      }
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  refreshPanel(): void {
    if (!this.enabled || !this.panelEl) return;
    const item = this.getSelectedItem();
    const coordsEl = this.panelEl.querySelector('.editor-coords');
    this.deps.el.itemsLayerEl.querySelectorAll('.board-item').forEach((node) => {
      node.classList.toggle('editor-selected', (node as HTMLElement).dataset.uid === this.selectedUid);
    });
    if (!coordsEl) return;
    if (!item) {
      coordsEl.textContent = '点击画布物品选中后可拖拽微调';
      return;
    }
    const def = ITEM_BY_ID[item.itemId];
    const dims = computeAspectDimensions(100, item.aspectRatio ?? def?.aspectRatio ?? 1);
    coordsEl.textContent = `${def?.name ?? item.itemId} [${item.anchorId}] x=${item.x.toFixed(3)} y=${item.y.toFixed(3)} pose=${item.pose ?? 'flat'} rot=${Math.round(item.rotation)}° (${Math.round(dims.width)}:${Math.round(dims.height)})`;
  }
}
