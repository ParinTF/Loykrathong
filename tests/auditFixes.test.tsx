import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameShell, type WorldModulesTuple } from '../src/components/GameShell';
import { KrathongStudioActivity } from '../src/components/activities/KrathongStudioActivity';
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
    sessionStorage.clear();
  });

  it('LK-01 & LK-04: recovers cleanly via retry after 3D module import failure and passes reducedMotion on instantiation', async () => {
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

    const fakeModules = [
      { default: {} },
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

    // Pre-persist reducedMotionOverride: 'reduce' so LK-04 checks initial reducedMotion on scene mount
    const base = gameReducer(createInitialGameState(), {
      type: 'SET_REDUCED_MOTION',
      mode: 'reduce',
    });
    flushStateToLocalStorageSync(base);

    render(<GameShell offlineDemo loadWorldModules={loadWorldModules} />);

    // Wait for persisted reducedMotion preference to hydrate before entering world
    await waitFor(() => {
      expect(
        document.querySelector('.app-shell')?.getAttribute('data-reduced-motion')
      ).toBe('true');
    });

    // Enter world -> first load fails -> recovery alert appears
    fireEvent.click(
      screen.getByRole('button', { name: /เริ่มต้นคืนพิเศษด้วยกัน/i })
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/โหลดฉากงานลอยกระทงไม่สำเร็จ/i);

    // Retry preload -> resolves and mounts FestivalScene with reducedMotion = true
    fireEvent.click(screen.getByRole('button', { name: /ลองโหลดฉากอีกครั้ง/i }));

    await waitFor(() => {
      expect(fakeSceneInstances).toHaveLength(1);
    });
    expect(fakeSceneInstances[0].initialReducedMotion).toBe(true);
    expect(loadWorldModules).toHaveBeenCalledTimes(2);
  });

  it('LK-02: exposes accessible keyboard nudging & polite status announcements in Shared Krathong Studio', () => {
    const state = createInitialGameState();
    const onMove = vi.fn();

    render(
      <KrathongStudioActivity
        design={state.krathongDesign}
        inventory={state.inventory}
        crafted={false}
        players={state.players}
        myRole="p1"
        bothOnline={true}
        lastSignal={null}
        soundEnabled={false}
        onUpdateDesign={vi.fn()}
        onAddDecoration={vi.fn()}
        onMoveDecoration={onMove}
        onRemoveDecoration={vi.fn()}
        onClearDecorations={vi.fn()}
        onCraftKrathong={vi.fn()}
      />
    );

    const handle = screen.getAllByRole('button', {
      name: /ใช้ปุ่มลูกศรเพื่อเลื่อน/i,
    })[0];
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/ขยับ.*ขึ้นด้านบน/i)).toBeInTheDocument();
  });

  it('LK-03: recalculates nearbySpotId when switching active player with followPartner disabled', () => {
    const pavilion = getSpotById('pavilion-blessing')!;
    let state = createInitialGameState();
    state = gameReducer(state, { type: 'ENTER_WORLD' });
    state = gameReducer(state, { type: 'TOGGLE_FOLLOW_PARTNER' });
    expect(state.settings.followPartner).toBe(false);

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

    state = gameReducer(state, { type: 'SET_ACTIVE_PLAYER', playerId: 'p2' });
    expect(state.nearbySpotId).toBeNull();

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
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        mimeType: 'image/png',
        error: null,
        updatedAt: '2026-11-24T03:00:00.000Z',
      },
    });

    flushStateToLocalStorageSync(state);
    const immediateLoaded = await loadPersistedState();
    expect(immediateLoaded?.players.p1.name).toBe('ดาริกา');
    expect(immediateLoaded?.players.p1.portrait.dataUrl).toContain(
      'data:image/png'
    );

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
      await savePersistedState(state, {
        p1: new Blob(['png'], { type: 'image/png' }),
      });

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
