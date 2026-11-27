export const TRANSITION_ENTER_MS = 220;
export const TRANSITION_HOLD_MS = 160;
export const TRANSITION_EXIT_MS = 260;

export interface TransitionPayload {
  title: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
}

export interface SceneTransitionState {
  phase: 'idle' | 'entering' | 'holding' | 'exiting';
  elapsedMs: number;
  swapped: boolean;
  payload: TransitionPayload | null;
}

export interface TransitionVisuals {
  visible: boolean;
  alpha: number;
  cardScale: number;
  cardOffsetY: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

function easeInOutQuad(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function createIdleTransition(): SceneTransitionState {
  return {
    phase: 'idle',
    elapsedMs: 0,
    swapped: false,
    payload: null,
  };
}

export function beginTransition(payload: TransitionPayload): SceneTransitionState {
  return {
    phase: 'entering',
    elapsedMs: 0,
    swapped: false,
    payload,
  };
}

export function isTransitionBlockingInput(state: SceneTransitionState): boolean {
  return state.phase === 'entering' || state.phase === 'holding';
}

export function stepTransition(
  state: SceneTransitionState,
  dtMs: number
): { state: SceneTransitionState; shouldSwap: boolean } {
  if (state.phase === 'idle' || dtMs <= 0) {
    return { state, shouldSwap: false };
  }

  let phase = state.phase;
  let elapsedMs = state.elapsedMs + dtMs;
  let swapped = state.swapped;
  let shouldSwap = false;

  if (phase === 'entering' && elapsedMs >= TRANSITION_ENTER_MS) {
    elapsedMs -= TRANSITION_ENTER_MS;
    phase = 'holding';
    if (!swapped) {
      swapped = true;
      shouldSwap = true;
    }
  }

  if (phase === 'holding' && elapsedMs >= TRANSITION_HOLD_MS) {
    elapsedMs -= TRANSITION_HOLD_MS;
    phase = 'exiting';
  }

  if (phase === 'exiting' && elapsedMs >= TRANSITION_EXIT_MS) {
    return {
      state: createIdleTransition(),
      shouldSwap,
    };
  }

  return {
    state: {
      phase,
      elapsedMs,
      swapped,
      payload: state.payload,
    },
    shouldSwap,
  };
}

export function getTransitionVisuals(state: SceneTransitionState): TransitionVisuals {
  if (state.phase === 'idle') {
    return { visible: false, alpha: 0, cardScale: 0.94, cardOffsetY: 16 };
  }

  if (state.phase === 'entering') {
    const p = easeOutCubic(state.elapsedMs / TRANSITION_ENTER_MS);
    return {
      visible: true,
      alpha: p,
      cardScale: 0.88 + 0.12 * p,
      cardOffsetY: 22 * (1 - p),
    };
  }

  if (state.phase === 'holding') {
    return {
      visible: true,
      alpha: 1,
      cardScale: 1,
      cardOffsetY: 0,
    };
  }

  const p = easeInOutQuad(state.elapsedMs / TRANSITION_EXIT_MS);
  return {
    visible: true,
    alpha: 1 - p,
    cardScale: 1 + 0.04 * p,
    cardOffsetY: -18 * p,
  };
}
