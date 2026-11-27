import { describe, expect, it } from 'vitest';
import {
  beginTransition,
  createIdleTransition,
  getTransitionVisuals,
  isTransitionBlockingInput,
  stepTransition,
  TRANSITION_ENTER_MS,
  TRANSITION_EXIT_MS,
  TRANSITION_HOLD_MS,
} from '@core/transition';

const PAYLOAD = {
  title: '第 2 关',
  subtitle: '元气浴室 · 晨光',
  accentColor: '#4A9EE8',
  bgColor: '#EEF7FF',
};

describe('Scene transition state machine', () => {
  it('starts idle, blocks input while entering/holding, and swaps once at hold boundary', () => {
    const idle = createIdleTransition();
    expect(idle.phase).toBe('idle');
    expect(isTransitionBlockingInput(idle)).toBe(false);
    expect(getTransitionVisuals(idle).visible).toBe(false);

    let state = beginTransition(PAYLOAD);
    expect(state.phase).toBe('entering');
    expect(isTransitionBlockingInput(state)).toBe(true);

    // Mid-enter: not yet swapped
    const midEnter = stepTransition(state, TRANSITION_ENTER_MS * 0.5);
    expect(midEnter.shouldSwap).toBe(false);
    expect(midEnter.state.phase).toBe('entering');
    const visEnter = getTransitionVisuals(midEnter.state);
    expect(visEnter.visible).toBe(true);
    expect(visEnter.alpha).toBeGreaterThan(0.5);
    expect(visEnter.alpha).toBeLessThan(1);

    // Reach enter boundary -> transitions into holding and signals swap once
    const enterEnd = stepTransition(midEnter.state, TRANSITION_ENTER_MS * 0.5);
    expect(enterEnd.shouldSwap).toBe(true);
    expect(enterEnd.state.phase).toBe('holding');
    expect(isTransitionBlockingInput(enterEnd.state)).toBe(true);
    expect(getTransitionVisuals(enterEnd.state).alpha).toBe(1);

    // Hold completion -> enters exiting without swapping again
    const holdEnd = stepTransition(enterEnd.state, TRANSITION_HOLD_MS);
    expect(holdEnd.shouldSwap).toBe(false);
    expect(holdEnd.state.phase).toBe('exiting');
    expect(isTransitionBlockingInput(holdEnd.state)).toBe(false);
    expect(getTransitionVisuals(holdEnd.state).visible).toBe(true);

    // Exiting fades alpha downward cleanly and settles back to idle
    const midExit = stepTransition(holdEnd.state, TRANSITION_EXIT_MS * 0.5);
    expect(midExit.state.phase).toBe('exiting');
    expect(getTransitionVisuals(midExit.state).alpha).toBeCloseTo(0.5, 4);

    const done = stepTransition(midExit.state, TRANSITION_EXIT_MS * 0.6);
    expect(done.shouldSwap).toBe(false);
    expect(done.state.phase).toBe('idle');
    expect(getTransitionVisuals(done.state).visible).toBe(false);
  });

  it('handles single-frame spikes cleanly across entering -> holding -> exiting', () => {
    const start = beginTransition(PAYLOAD);
    const bigStep = stepTransition(start, TRANSITION_ENTER_MS + TRANSITION_HOLD_MS + 20);
    expect(bigStep.shouldSwap).toBe(true);
    expect(bigStep.state.phase).toBe('exiting');
    expect(bigStep.state.swapped).toBe(true);

    const followUp = stepTransition(bigStep.state, TRANSITION_EXIT_MS);
    expect(followUp.shouldSwap).toBe(false);
    expect(followUp.state.phase).toBe('idle');
  });
});
