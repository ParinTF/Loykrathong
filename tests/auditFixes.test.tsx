import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameShell, type WorldModulesTuple } from '../src/components/GameShell';
import { MinigameSuite } from '../src/components/MinigameSuite';
import { createInitialGameState, gameReducer } from '../src/domain/reducer';
import { getSpotById } from '../src/domain/worldMap';
import {
  STORAGE_KEY,
  flushStateToLocalStorageSync,
  loadPersistedState,
  savePersistedState,
} from '../src/persistence/storage';

describe('Audit remediation regression suite (LK-01 through LK-05)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('LK-01: gates readiness on world module preload and recovers cleanly via retry after import failure', async () => {
    const fakeSceneInstances: { initialReducedMotion: boolean }[] = [];
    class FakeFestivalScene {
      public initialReducedMotion: boolean;
      constructor(
        _state: unknown,
        _callbacks: unknown,
        initialReducedMotion = false
      ) {
        this.initialReducedMotion = initialReducedMotion;
        fakeSceneInstances.push({ initialReducedMotion });
      }
      setModalBlocked() {}
      updateSnapshot() {}
      setTouchVector() {}
    }

    const fakeGameDestroy = vi.fn();
    class FakePhaserGame {
      destroy = fakeGameDestroy;
    }

    const fakeModules = [
      {
        default: {
          AUTO: 0,
          Game: FakePhaserGame,
          Scale: { RESIZE: 0, CENTER_BOTH: 0 },
        },
      },
      { FestivalScene: FakeFestivalScene },
    ] as unknown as WorldModulesTuple;

    let attempts = 0;
    const loadWorldModules = vi.fn(() => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(new Error('Network offline'));
      }
      return Promise.resolve(fakeModules);
    });

    render(<GameShell loadWorldModules={loadWorldModules} />);

    // First attempt fails -> shows recovery alert and keeps enter disabled until ready
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/ยังเตรียมฉากงานลอยกระทงไม่สำเร็จ/i);
    const startBtn = screen.getByRole('button', {
      name: /เข้าสู่งานลอยกระทงคู่กัน/i,
    });
    expect(startBtn).toBeDisabled();

    // Select reduced motion before entering (also verifies LK-04 initial reducedMotion)
    fireEvent.click(screen.getByLabelText('ลดการเคลื่อนไหว'));

    // Retry preload -> resolves and unlocks offline-ready entry
    fireEvent.click(screen.getByRole('button', { name: /ลองโหลดฉากอีกครั้ง/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /เข้าสู่งานลอยกระทงคู่กัน/i })
      ).toBeEnabled();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /เข้าสู่งานลอยกระทงคู่กัน/i })
    );

    await waitFor(() => {
      expect(fakeSceneInstances).toHaveLength(1);
    });
    // LK-04: initial reducedMotion passed directly on scene instantiation
    expect(fakeSceneInstances[0].initialReducedMotion).toBe(true);
    expect(loadWorldModules).toHaveBeenCalledTimes(2);
  });

  it('LK-02: exposes accessible non-visual cue description and polite sweetspot status in Rhythm minigame', () => {
    vi.useFakeTimers();
    try {
      render(
        <MinigameSuite
          progress={{
            recipe: { status: 'passed', score: 90, attempts: 1 },
            assembly: { status: 'passed', score: 95, attempts: 1 },
            rhythm: { status: 'pending', score: 0, attempts: 0 },
          }}
          reducedMotion={true}
          soundEnabled={false}
          onCompleteMinigame={vi.fn()}
          onResetMinigame={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole('button', { name: /เริ่มจับจังหวะแสง/i })
      );

      const tapBtn = screen.getByRole('button', { name: /แตะให้ตรงแสง/i });
      expect(tapBtn).toHaveAttribute('aria-describedby');

      // Advance reduced-motion step timer until cursor reaches center sweetspot (0.5)
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(
        screen.getByText(/จังหวะเข้าเป้ากลางแล้ว/i)
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('LK-03: recalculates nearbySpotId when switching active player with followPartner disabled', () => {
    const pavilion = getSpotById('pavilion-blessing')!;
    let state = createInitialGameState();
    state = gameReducer(state, { type: 'ENTER_WORLD' });
    // Turn off followPartner so p2 remains at spawn
    state = gameReducer(state, { type: 'TOGGLE_FOLLOW_PARTNER' });
    expect(state.settings.followPartner).toBe(false);

    // Teleport p1 next to pavilion via hydration and move slightly
    state = gameReducer(state, {
      type: 'HYDRATE_STATE',
      payload: {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players.p1,
            position: { x: pavilion.x, y: pavilion.y + 30, facing: 'up' },
          },
        },
      },
    });
    expect(state.nearbySpotId).toBe('pavilion-blessing');

    // Switch active player to p2 at spawn -> nearbySpotId must clear immediately
    state = gameReducer(state, { type: 'SET_ACTIVE_PLAYER', playerId: 'p2' });
    expect(state.nearbySpotId).toBeNull();

    // Switch back to p1 -> nearbySpotId restores to pavilion-blessing
    state = gameReducer(state, { type: 'SET_ACTIVE_PLAYER', playerId: 'p1' });
    expect(state.nearbySpotId).toBe('pavilion-blessing');
  });

  it('LK-05: persists state synchronously for immediate reload and retains localStorage portrait fallback when IndexedDB fails', async () => {
    let state = createInitialGameState();
    state = gameReducer(state, {
      type: 'UPDATE_PLAYER_NAME',
      playerId: 'p1',
      name: 'ดาริกา',
    });
    state = gameReducer(state, {
      type: 'SET_PLAYER_PORTRAIT',
      playerId: 'p1',
      portrait: {
        status: 'ready',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        mimeType: 'image/png',
        error: null,
        updatedAt: '2026-11-24T03:00:00.000Z',
      },
    });

    // Immediate synchronous flush before any async timer settles
    flushStateToLocalStorageSync(state);
    const immediateLoaded = await loadPersistedState();
    expect(immediateLoaded?.players.p1.name).toBe('ดาริกา');
    expect(immediateLoaded?.players.p1.portrait.dataUrl).toContain('data:image/png');

    // Simulate IndexedDB existing on globalThis yet failing to open
    const originalIdb = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => {
          throw new Error('IndexedDB blocked');
        },
      },
    });

    try {
      // Save #1 with portrait blob (IDB fails -> must keep fallback in localStorage)
      await savePersistedState(state, {
        p1: new Blob(['png'], { type: 'image/png' }),
      });

      // Save #2 without portraitBlobs (e.g. walking/settings update -> must NOT wipe fallback!)
      const movedState = gameReducer(state, {
        type: 'MOVE_PLAYER',
        playerId: 'p1',
        dx: 8,
        dy: 0,
        facing: 'right',
      });
      await savePersistedState(movedState);

      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(raw.players.p1.portrait.dataUrl).toContain('data:image/png');

      const reloaded = await loadPersistedState();
      expect(reloaded?.players.p1.portrait.status).toBe('ready');
      expect(reloaded?.players.p1.portrait.dataUrl).toContain('data:image/png');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: originalIdb,
      });
    }
  });
});
