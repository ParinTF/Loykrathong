import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { createInitialGameState, gameReducer } from '../domain/reducer';
import { getSpotById } from '../domain/worldMap';
import type { Direction, GameState, PlayerId } from '../domain/types';
import type { FestivalScene } from '../game/FestivalScene';
import { playChime } from '../game/sound';
import {
  clearAllPersistedState,
  flushStateToLocalStorageSync,
  loadPersistedState,
  savePersistedState,
} from '../persistence/storage';
import { FestivalHud } from './FestivalHud';
import { InteractionModal } from './InteractionModal';
import { SetupScreen, type WorldAssetStatus } from './SetupScreen';
import { TouchControls } from './TouchControls';

export type WorldModulesTuple = [
  typeof import('phaser'),
  typeof import('../game/FestivalScene'),
];

let defaultWorldModulesPromise: Promise<WorldModulesTuple> | null = null;

export function preloadDefaultWorldModules(): Promise<WorldModulesTuple> {
  if (!defaultWorldModulesPromise) {
    defaultWorldModulesPromise = Promise.all([
      import('phaser'),
      import('../game/FestivalScene'),
    ]).catch((error) => {
      defaultWorldModulesPromise = null;
      throw error;
    });
  }
  return defaultWorldModulesPromise;
}

export function resetDefaultWorldModulesCache(): void {
  defaultWorldModulesPromise = null;
}

function isPositionOnlyChange(prev: GameState | null, next: GameState): boolean {
  if (!prev) return false;
  return (
    prev.screen === next.screen &&
    prev.settings === next.settings &&
    prev.inventory === next.inventory &&
    prev.litLanternIds === next.litLanternIds &&
    prev.pavilionBlessed === next.pavilionBlessed &&
    prev.contributedBy === next.contributedBy &&
    prev.questStage === next.questStage &&
    prev.minigames === next.minigames &&
    prev.krathongCrafted === next.krathongCrafted &&
    prev.krathongDesign === next.krathongDesign &&
    prev.releasedKrathongs === next.releasedKrathongs &&
    prev.players.p1.name === next.players.p1.name &&
    prev.players.p2.name === next.players.p2.name &&
    prev.players.p1.customization === next.players.p1.customization &&
    prev.players.p2.customization === next.players.p2.customization &&
    prev.players.p1.portrait === next.players.p1.portrait &&
    prev.players.p2.portrait === next.players.p2.portrait
  );
}

interface GameShellProps {
  disablePhaser?: boolean;
  loadWorldModules?: () => Promise<WorldModulesTuple>;
}

export function GameShell({
  disablePhaser = false,
  loadWorldModules = preloadDefaultWorldModules,
}: GameShellProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    createInitialGameState
  );
  const [hydrated, setHydrated] = useState(false);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [worldAssetStatus, setWorldAssetStatus] = useState<WorldAssetStatus>(
    disablePhaser ? 'ready' : 'loading'
  );
  const [assetRetryCount, setAssetRetryCount] = useState(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FestivalScene | null>(null);
  const loadedModulesRef = useRef<WorldModulesTuple | null>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const pendingBlobsRef = useRef<Partial<Record<PlayerId, Blob | null>>>({});
  const lastPersistedStateRef = useRef<GameState | null>(null);
  const hydratedRef = useRef<boolean>(false);
  hydratedRef.current = hydrated;
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;

  const effectiveReducedMotion =
    state.settings.reducedMotionOverride === 'reduce'
      ? true
      : state.settings.reducedMotionOverride === 'no-preference'
        ? false
        : systemReducedMotion;

  const reducedMotionRef = useRef<boolean>(effectiveReducedMotion);
  reducedMotionRef.current = effectiveReducedMotion;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) =>
      setSystemReducedMotion(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let active = true;
    void loadPersistedState().then((saved) => {
      if (!active) return;
      if (saved) {
        lastPersistedStateRef.current = saved;
        dispatch({ type: 'HYDRATE_STATE', payload: saved });
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Preload Phaser & FestivalScene during setup so offline start works after initial load
  useEffect(() => {
    if (disablePhaser) {
      setWorldAssetStatus('ready');
      return undefined;
    }
    if (loadedModulesRef.current) {
      setWorldAssetStatus('ready');
      return undefined;
    }

    let cancelled = false;
    setWorldAssetStatus('loading');

    loadWorldModules()
      .then((mods) => {
        if (cancelled) return;
        loadedModulesRef.current = mods;
        setWorldAssetStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        loadedModulesRef.current = null;
        setWorldAssetStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [disablePhaser, loadWorldModules, assetRetryCount]);

  const handleRetryWorldAssets = useCallback(() => {
    if (loadWorldModules === preloadDefaultWorldModules) {
      resetDefaultWorldModulesCache();
    }
    loadedModulesRef.current = null;
    setWorldAssetStatus('loading');
    setAssetRetryCount((c) => c + 1);
  }, [loadWorldModules]);

  // Flush pending movement state synchronously if tab hides or reloads immediately
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const flushNow = () => {
      if (!hydratedRef.current) return;
      flushStateToLocalStorageSync(stateRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;

    const hasPendingBlobs =
      pendingBlobsRef.current.p1 !== undefined ||
      pendingBlobsRef.current.p2 !== undefined;
    const positionOnly =
      !hasPendingBlobs && isPositionOnlyChange(lastPersistedStateRef.current, state);

    if (!positionOnly) {
      flushStateToLocalStorageSync(state);
      const blobs = pendingBlobsRef.current;
      pendingBlobsRef.current = {};
      lastPersistedStateRef.current = state;
      void savePersistedState(state, blobs);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const blobs = pendingBlobsRef.current;
      pendingBlobsRef.current = {};
      lastPersistedStateRef.current = state;
      void savePersistedState(state, blobs);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog) return;
    if (resetOpen && !dialog.open) {
      dialog.showModal?.();
    } else if (!resetOpen && dialog.open) {
      dialog.close?.();
    }
  }, [resetOpen]);

  // Mount Phaser 3 & FestivalScene once world screen is open and preloaded modules are ready
  useEffect(() => {
    if (
      disablePhaser ||
      state.screen !== 'world' ||
      worldAssetStatus !== 'ready' ||
      !loadedModulesRef.current ||
      !stageRef.current
    ) {
      return undefined;
    }

    const container = stageRef.current;
    const [phaserMod, sceneMod] = loadedModulesRef.current;
    const PhaserLib =
      'default' in phaserMod
        ? (phaserMod as unknown as { default: typeof Phaser }).default
        : phaserMod;
    const scene = new sceneMod.FestivalScene(
      stateRef.current,
      {
        onMove: (playerId, dx, dy, facing) => {
          dispatch({ type: 'MOVE_PLAYER', playerId, dx, dy, facing });
        },
        onInteractSpot: (spotId) => {
          setOpenSpotId(spotId);
        },
      },
      reducedMotionRef.current
    );
    scene.setModalBlocked(Boolean(openSpotId) || resetOpen);
    sceneRef.current = scene;

    try {
      const game = new PhaserLib.Game({
        type: PhaserLib.AUTO,
        parent: container,
        width: container.clientWidth || 360,
        height: container.clientHeight || 480,
        backgroundColor: '#091026',
        scene: [scene],
        scale: {
          mode: PhaserLib.Scale.RESIZE,
          autoCenter: PhaserLib.Scale.CENTER_BOTH,
        },
        input: {
          keyboard: true,
        },
      });
      phaserGameRef.current = game;
    } catch {
      phaserGameRef.current = null;
      sceneRef.current = null;
      setWorldAssetStatus('error');
    }

    return () => {
      sceneRef.current = null;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, [state.screen, disablePhaser, worldAssetStatus]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateSnapshot(state, effectiveReducedMotion);
    }
  }, [state, effectiveReducedMotion]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setModalBlocked(Boolean(openSpotId) || resetOpen);
    }
  }, [openSpotId, resetOpen]);

  const handleVectorChange = useCallback((vx: number, vy: number) => {
    sceneRef.current?.setTouchVector(vx, vy);
  }, []);

  const handleNudgeStep = useCallback(
    (dx: number, dy: number, facing: Direction) => {
      dispatch({
        type: 'MOVE_PLAYER',
        playerId: stateRef.current.settings.activePlayer,
        dx,
        dy,
        facing,
      });
    },
    []
  );

  const handleConfirmReset = async () => {
    setResetOpen(false);
    setOpenSpotId(null);
    pendingBlobsRef.current = { p1: null, p2: null };
    await clearAllPersistedState();
    dispatch({ type: 'RESET_GAME' });
  };

  const activePlayer = state.players[state.settings.activePlayer];
  const nearbySpot = getSpotById(state.nearbySpotId);

  return (
    <div
      className="app-shell"
      data-reduced-motion={effectiveReducedMotion ? 'true' : 'false'}
    >
      <a href="#main-content" className="skip-link">
        ข้ามไปยังเนื้อหาหลัก
      </a>

      {state.screen === 'setup' ? (
        <SetupScreen
          state={state}
          worldAssetStatus={worldAssetStatus}
          onRetryWorldAssets={handleRetryWorldAssets}
          onUpdateName={(playerId, name) =>
            dispatch({ type: 'UPDATE_PLAYER_NAME', playerId, name })
          }
          onUpdateCustomization={(playerId, patch) =>
            dispatch({ type: 'UPDATE_PLAYER_CUSTOMIZATION', playerId, patch })
          }
          onPortraitProcessed={(playerId, portrait, blob) => {
            pendingBlobsRef.current[playerId] = blob;
            dispatch({ type: 'SET_PLAYER_PORTRAIT', playerId, portrait });
          }}
          onClearPortrait={(playerId) => {
            pendingBlobsRef.current[playerId] = null;
            dispatch({ type: 'CLEAR_PLAYER_PORTRAIT', playerId });
          }}
          onSetReducedMotion={(mode) =>
            dispatch({ type: 'SET_REDUCED_MOTION', mode })
          }
          onStartFestival={() => dispatch({ type: 'ENTER_WORLD' })}
          onRequestReset={() => setResetOpen(true)}
        />
      ) : (
        <div className="world-layout">
          <FestivalHud
            state={state}
            reducedMotion={effectiveReducedMotion}
            onSetActivePlayer={(playerId) => {
              if (playerId !== state.settings.activePlayer) {
                setOpenSpotId(null);
              }
              dispatch({ type: 'SET_ACTIVE_PLAYER', playerId });
            }}
            onToggleFollow={() => dispatch({ type: 'TOGGLE_FOLLOW_PARTNER' })}
            onOpenSetup={() => {
              setOpenSpotId(null);
              dispatch({ type: 'OPEN_SETUP' });
            }}
            onToggleSound={() => dispatch({ type: 'TOGGLE_SOUND' })}
            onToggleReducedMotion={() =>
              dispatch({
                type: 'SET_REDUCED_MOTION',
                mode: effectiveReducedMotion ? 'no-preference' : 'reduce',
              })
            }
            onRequestReset={() => setResetOpen(true)}
          />

          <main id="main-content" className="world-stage-wrap">
            <h1 className="visually-hidden">
              แผนที่งานลอยกระทงคู่รัก คืนเพ็ญริมน้ำ
            </h1>
            {!disablePhaser && worldAssetStatus === 'loading' && (
              <div className="stage-loading-card">
                <p>กำลังเตรียมฉากงานลอยกระทง...</p>
                <progress
                  className="minigame-progress"
                  aria-label="กำลังโหลดฉากงานลอยกระทง"
                />
              </div>
            )}
            {!disablePhaser && worldAssetStatus === 'error' && (
              <div className="stage-recovery-card" role="alert">
                <h2>โหลดฉากงานลอยกระทงไม่สำเร็จ</h2>
                <p>
                  ไม่สามารถเตรียมไฟล์ฉากแผนที่ได้ขณะออฟไลน์หรือการเชื่อมต่อขาดหาย กรุณาเชื่อมต่อเครือข่ายแล้วกดลองใหม่
                </p>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleRetryWorldAssets}
                  >
                    ลองโหลดฉากอีกครั้ง
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => {
                      setOpenSpotId(null);
                      dispatch({ type: 'OPEN_SETUP' });
                    }}
                  >
                    กลับหน้าตั้งค่าตัวละคร
                  </button>
                </div>
              </div>
            )}
            <div
              ref={stageRef}
              className="phaser-stage"
              role="region"
              aria-label="ฉากงานเทศกาลลอยกระทงแบบเดินสำรวจ 2 มิติ"
            />

            <TouchControls
              activePlayerName={activePlayer.name}
              nearbySpot={nearbySpot}
              onVectorChange={handleVectorChange}
              onNudgeStep={handleNudgeStep}
              onInteract={() => {
                if (state.nearbySpotId) setOpenSpotId(state.nearbySpotId);
              }}
            />
          </main>

          <InteractionModal
            spotId={openSpotId}
            state={state}
            reducedMotion={effectiveReducedMotion}
            onClose={() => setOpenSpotId(null)}
            onCollectMaterial={(material, message) => {
              playChime('pickup', state.settings.soundEnabled);
              dispatch({
                type: 'COLLECT_MATERIAL',
                material,
                byPlayer: state.settings.activePlayer,
                message,
              });
            }}
            onLightLantern={(lanternId) => {
              playChime('lantern', state.settings.soundEnabled);
              dispatch({
                type: 'LIGHT_LANTERN',
                lanternId,
                byPlayer: state.settings.activePlayer,
              });
            }}
            onBlessPavilion={() => {
              playChime('success', state.settings.soundEnabled);
              dispatch({
                type: 'BLESS_PAVILION',
                byPlayer: state.settings.activePlayer,
              });
            }}
            onCompleteMinigame={(gameId, passed, score) => {
              playChime(passed ? 'success' : 'error', state.settings.soundEnabled);
              dispatch({
                type: 'COMPLETE_MINIGAME',
                gameId,
                passed,
                score,
                byPlayer: state.settings.activePlayer,
              });
            }}
            onResetMinigame={(gameId) =>
              dispatch({ type: 'RESET_MINIGAME', gameId })
            }
            onUpdateKrathongDesign={(patch) =>
              dispatch({ type: 'UPDATE_KRATHONG_DESIGN', patch })
            }
            onCraftKrathong={() => {
              playChime('success', state.settings.soundEnabled);
              dispatch({
                type: 'CRAFT_KRATHONG',
                byPlayer: state.settings.activePlayer,
              });
            }}
            onReleaseKrathong={() => {
              playChime('ceremony', state.settings.soundEnabled);
              dispatch({
                type: 'RELEASE_KRATHONG',
                byPlayer: state.settings.activePlayer,
              });
            }}
            onStartAnother={() => dispatch({ type: 'START_ANOTHER_KRATHONG' })}
          />
        </div>
      )}

      <dialog
        ref={resetDialogRef}
        className="festival-dialog festival-dialog--compact"
        aria-labelledby="reset-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          setResetOpen(false);
        }}
      >
        <div className="festival-dialog__content">
          <h2 id="reset-dialog-title" className="festival-dialog__title">
            ยืนยันการรีเซ็ตข้อมูลทั้งหมด?
          </h2>
          <p className="festival-dialog__subtitle">
            ข้อมูลตัวละครทั้ง 2 คน รูปใบหน้าที่บันทึกไว้ในเครื่อง วัสดุ ผลมินิเกม และกระทงที่ลอยแล้วจะถูกล้างกลับเป็นค่าเริ่มต้น
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              autoFocus
              className="btn btn--secondary"
              onClick={() => setResetOpen(false)}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void handleConfirmReset()}
            >
              ยืนยันรีเซ็ตทั้งหมด
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}