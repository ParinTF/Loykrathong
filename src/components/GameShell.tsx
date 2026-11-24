import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  createInitialGameState,
  extractSharedQuestState,
  gameReducer,
} from '../domain/reducer';
import { getSpotById, isPositionWalkable } from '../domain/worldMap';
import type {
  CoopSignalEvent,
  CoupleEmoteEvent,
  Direction,
  GameState,
  MinigameId,
  PlayMode,
  PlayerId,
} from '../domain/types';
import type { CameraPreset, FestivalScene } from '../game/FestivalScene';
import { playChime } from '../game/sound';
import {
  OnlineRoomClient,
  generateInviteRoomCode,
  readInitialRoomFromUrl,
  type RoomConnectionStatus,
  type RoomOccupancy,
} from '../online/roomClient';
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
  typeof import('three'),
  typeof import('../game/FestivalScene'),
];

let defaultWorldModulesPromise: Promise<WorldModulesTuple> | null = null;

export function preloadDefaultWorldModules(): Promise<WorldModulesTuple> {
  if (!defaultWorldModulesPromise) {
    defaultWorldModulesPromise = Promise.all([
      import('three'),
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
    prev.coopTasks === next.coopTasks &&
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
  const initialInviteCode = readInitialRoomFromUrl();

  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    createInitialGameState
  );
  const [hydrated, setHydrated] = useState(false);
  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  // Online Couple Room state
  const [playMode, setPlayMode] = useState<PlayMode>(() =>
    initialInviteCode ? 'online' : 'local'
  );
  const [roomCode, setRoomCode] = useState<string>(
    () => initialInviteCode ?? generateInviteRoomCode()
  );
  const [myOnlineRole, setMyOnlineRole] = useState<PlayerId>(() =>
    initialInviteCode ? 'p2' : 'p1'
  );
  const [roomStatus, setRoomStatus] =
    useState<RoomConnectionStatus>('disconnected');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<RoomOccupancy>({
    p1: false,
    p2: false,
  });
  const [lastPartnerSignal, setLastPartnerSignal] =
    useState<CoopSignalEvent | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('follow');

  const [worldAssetStatus, setWorldAssetStatus] = useState<WorldAssetStatus>(
    disablePhaser ? 'ready' : 'loading'
  );
  const [assetRetryCount, setAssetRetryCount] = useState(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const legacyEngineRef = useRef<{ destroy: (removeCanvas?: boolean) => void } | null>(
    null
  );
  const sceneRef = useRef<FestivalScene | null>(null);
  const loadedModulesRef = useRef<WorldModulesTuple | null>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const pendingBlobsRef = useRef<Partial<Record<PlayerId, Blob | null>>>({});
  const lastPersistedStateRef = useRef<GameState | null>(null);
  const hydratedRef = useRef<boolean>(false);
  hydratedRef.current = hydrated;
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;

  const playModeRef = useRef<PlayMode>(playMode);
  playModeRef.current = playMode;
  const myOnlineRoleRef = useRef<PlayerId>(myOnlineRole);
  myOnlineRoleRef.current = myOnlineRole;

  const roomClientRef = useRef<OnlineRoomClient | null>(null);
  const lastSyncedSharedJsonRef = useRef<string>('');
  const pendingSyncOptionsRef = useRef<
    | {
        forceReplace?: boolean;
        resetTaskKey?: string;
        resetMinigame?: MinigameId;
      }
    | undefined
  >(undefined);

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

  // Connect online room helper
  const connectToRoom = useCallback((code: string, preferredRole: PlayerId) => {
    if (!roomClientRef.current) {
      roomClientRef.current = new OnlineRoomClient(
        () => stateRef.current.players[myOnlineRoleRef.current],
        {
          onJoined: (payload) => {
            setRoomCode(payload.roomCode);
            setMyOnlineRole(payload.role);
            myOnlineRoleRef.current = payload.role;
            setOccupancy(payload.occupancy);
            lastSyncedSharedJsonRef.current = JSON.stringify(payload.shared);
            // Disable local partner AI-follow in Online Mode so each partner walks independently
            dispatch({ type: 'SET_FOLLOW_PARTNER', enabled: false });
            dispatch({
              type: 'APPLY_ONLINE_SNAPSHOT',
              myRole: payload.role,
              players: payload.players,
              shared: payload.shared,
              preserveMyProfile: true,
              preserveMyPosition: false,
            });
            try {
              const nextUrl = new URL(window.location.href);
              nextUrl.searchParams.set('room', payload.roomCode);
              window.history.replaceState({}, '', nextUrl.toString());
            } catch {
              // ignore history update in test environments
            }
          },
          onSnapshot: (payload) => {
            setOccupancy(payload.occupancy);
            lastSyncedSharedJsonRef.current = JSON.stringify(payload.shared);
            dispatch({
              type: 'APPLY_ONLINE_SNAPSHOT',
              myRole: myOnlineRoleRef.current,
              players: payload.players,
              shared: payload.shared,
              preserveMyProfile: true,
              preserveMyPosition: true,
            });
          },
          onPeerMoved: (playerId, position) => {
            if (playerId !== myOnlineRoleRef.current) {
              dispatch({ type: 'APPLY_PEER_MOVE', playerId, position });
            }
          },
          onPeerProfile: (playerId, profile) => {
            if (playerId !== myOnlineRoleRef.current) {
              dispatch({ type: 'APPLY_PEER_PROFILE', playerId, profile });
            }
          },
          onEmote: (event: CoupleEmoteEvent) => {
            playChime('beat', stateRef.current.settings.soundEnabled);
            sceneRef.current?.showEmote(event);
          },
          onCoopSignal: (signal) => {
            setLastPartnerSignal(signal);
          },
          onStatusChange: (status, errMsg) => {
            setRoomStatus(status);
            setRoomError(errMsg);
          },
        }
      );
    }
    setPlayMode('online');
    roomClientRef.current.connect(code, preferredRole);
  }, []);

  const disconnectFromRoom = useCallback(() => {
    roomClientRef.current?.disconnect();
    setRoomStatus('disconnected');
    setRoomError(null);
    setOccupancy({ p1: false, p2: false });
  }, []);

  // Auto-join when opened via a partner invite URL (?room=XXXXXX) once local profile is hydrated
  useEffect(() => {
    if (!hydrated || !initialInviteCode) return undefined;
    connectToRoom(initialInviteCode, 'p2');
    return () => {
      roomClientRef.current?.disconnect();
    };
  }, [hydrated, initialInviteCode, connectToRoom]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      roomClientRef.current?.disconnect();
    };
  }, []);

  // Sync my movement to partner in real time
  const myProfile = state.players[myOnlineRole];
  useEffect(() => {
    if (playMode !== 'online' || roomStatus !== 'connected') return;
    roomClientRef.current?.sendMove(myProfile.position);
  }, [
    playMode,
    roomStatus,
    myProfile.position.x,
    myProfile.position.y,
    myProfile.position.facing,
  ]);

  // Sync my profile (name, outfit, portrait) to partner when edited
  useEffect(() => {
    if (playMode !== 'online' || roomStatus !== 'connected') return;
    roomClientRef.current?.sendProfile(myProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playMode,
    roomStatus,
    myProfile.name,
    myProfile.customization,
    myProfile.portrait.updatedAt,
  ]);

  // Sync shared quest / coop / minigame / krathong state changes to room without echoing server snapshots
  useEffect(() => {
    if (playMode !== 'online' || roomStatus !== 'connected') return;
    const shared = extractSharedQuestState(state);
    const serialized = JSON.stringify(shared);
    if (serialized === lastSyncedSharedJsonRef.current) return;

    lastSyncedSharedJsonRef.current = serialized;
    const opts = pendingSyncOptionsRef.current;
    pendingSyncOptionsRef.current = undefined;
    roomClientRef.current?.sendSharedState(shared, opts);
  }, [
    playMode,
    roomStatus,
    state.inventory,
    state.litLanternIds,
    state.pavilionBlessed,
    state.contributedBy,
    state.questStage,
    state.minigames,
    state.krathongCrafted,
    state.coopTasks,
    state.krathongDesign,
    state.releasedKrathongs,
    state,
  ]);

  // Preload Phaser & FestivalScene during setup
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

  // Mount Three.js 3D FestivalScene once world screen is open
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
    const [engineMod, sceneMod] = loadedModulesRef.current;
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
      if (typeof scene.mount === 'function') {
        scene.mount(container);
      } else {
        // Test-harness compatibility when a custom mock engine tuple is injected
        const maybeLegacy = (
          engineMod as unknown as {
            default?: {
              Game?: new (cfg: Record<string, unknown>) => {
                destroy: (b?: boolean) => void;
              };
            };
          }
        ).default;
        if (maybeLegacy?.Game) {
          legacyEngineRef.current = new maybeLegacy.Game({
            parent: container,
            scene: [scene],
          });
        }
      }
    } catch {
      legacyEngineRef.current = null;
      sceneRef.current = null;
      setWorldAssetStatus('error');
    }

    return () => {
      if (sceneRef.current && typeof sceneRef.current.destroy === 'function') {
        sceneRef.current.destroy();
      }
      sceneRef.current = null;
      if (legacyEngineRef.current) {
        legacyEngineRef.current.destroy(true);
        legacyEngineRef.current = null;
      }
    };
  }, [state.screen, disablePhaser, worldAssetStatus]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateSnapshot?.(
        state,
        effectiveReducedMotion,
        playMode,
        myOnlineRole
      );
    }
  }, [state, effectiveReducedMotion, playMode, myOnlineRole]);

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
      const targetPlayer =
        playModeRef.current === 'online'
          ? myOnlineRoleRef.current
          : stateRef.current.settings.activePlayer;
      const transformed = sceneRef.current?.transformInputVector
        ? sceneRef.current.transformInputVector(dx, dy)
        : { dx, dy };
      const nextFacing: Direction =
        Math.abs(transformed.dx) >= Math.abs(transformed.dy)
          ? transformed.dx >= 0
            ? 'right'
            : 'left'
          : transformed.dy >= 0
            ? 'down'
            : 'up';
      dispatch({
        type: 'MOVE_PLAYER',
        playerId: targetPlayer,
        dx: transformed.dx,
        dy: transformed.dy,
        facing: sceneRef.current?.transformInputVector ? nextFacing : facing,
      });
    },
    []
  );

  const handleSendEmote = useCallback(
    (emoji: string, text: string) => {
      const sender: PlayerId =
        playMode === 'online' ? myOnlineRole : state.settings.activePlayer;
      if (playMode === 'online' && roomStatus === 'connected') {
        roomClientRef.current?.sendEmote(emoji, text);
      } else {
        playChime('beat', state.settings.soundEnabled);
        sceneRef.current?.showEmote?.({
          playerId: sender,
          emoji,
          text,
          ts: Date.now(),
        });
      }
    },
    [playMode, myOnlineRole, roomStatus, state.settings.activePlayer, state.settings.soundEnabled]
  );

  const handleWalkToPartner = useCallback(() => {
    const partnerRole: PlayerId = myOnlineRole === 'p1' ? 'p2' : 'p1';
    const partnerPos = state.players[partnerRole].position;
    const myPos = state.players[myOnlineRole].position;
    const offsets = [
      { ox: -42, oy: 0 },
      { ox: 42, oy: 0 },
      { ox: 0, oy: -42 },
      { ox: 0, oy: 42 },
    ];
    for (const off of offsets) {
      const tx = partnerPos.x + off.ox;
      const ty = partnerPos.y + off.oy;
      if (isPositionWalkable(tx, ty)) {
        dispatch({
          type: 'MOVE_PLAYER',
          playerId: myOnlineRole,
          dx: tx - myPos.x,
          dy: ty - myPos.y,
          facing: partnerPos.facing,
        });
        roomClientRef.current?.sendMove(
          { x: tx, y: ty, facing: partnerPos.facing },
          true
        );
        break;
      }
    }
  }, [myOnlineRole, state.players]);

  const handleConfirmReset = async () => {
    setResetOpen(false);
    setOpenSpotId(null);
    pendingBlobsRef.current = { p1: null, p2: null };
    pendingSyncOptionsRef.current = { forceReplace: true };
    await clearAllPersistedState();
    dispatch({ type: 'RESET_GAME' });
  };

  const controllingPlayerId: PlayerId =
    playMode === 'online' ? myOnlineRole : state.settings.activePlayer;
  const activePlayer = state.players[controllingPlayerId];
  const nearbySpot = getSpotById(state.nearbySpotId);
  const partnerRole: PlayerId = myOnlineRole === 'p1' ? 'p2' : 'p1';

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
          playMode={playMode}
          roomCode={roomCode}
          myOnlineRole={myOnlineRole}
          roomStatus={roomStatus}
          roomError={roomError}
          occupancy={occupancy}
          worldAssetStatus={worldAssetStatus}
          onRetryWorldAssets={handleRetryWorldAssets}
          onChangePlayMode={(mode) => {
            setPlayMode(mode);
            if (mode === 'local') {
              disconnectFromRoom();
              dispatch({ type: 'SET_FOLLOW_PARTNER', enabled: true });
            } else if (roomStatus === 'disconnected') {
              connectToRoom(roomCode, myOnlineRole);
            }
          }}
          onChangeRoomCode={setRoomCode}
          onGenerateNewRoom={() => {
            const fresh = generateInviteRoomCode();
            setRoomCode(fresh);
            if (playMode === 'online') {
              connectToRoom(fresh, 'p1');
            }
          }}
          onConnectOnlineRoom={connectToRoom}
          onDisconnectOnlineRoom={disconnectFromRoom}
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
          onStartFestival={() => {
            if (playMode === 'online' && roomStatus === 'disconnected') {
              connectToRoom(roomCode, myOnlineRole);
            }
            dispatch({ type: 'ENTER_WORLD' });
          }}
          onRequestReset={() => setResetOpen(true)}
        />
      ) : (
        <div className="world-layout">
          <FestivalHud
            state={state}
            playMode={playMode}
            roomCode={roomCode}
            myOnlineRole={myOnlineRole}
            roomStatus={roomStatus}
            occupancy={occupancy}
            cameraPreset={cameraPreset}
            reducedMotion={effectiveReducedMotion}
            onSetActivePlayer={(playerId) => {
              if (playerId !== state.settings.activePlayer) {
                setOpenSpotId(null);
              }
              dispatch({ type: 'SET_ACTIVE_PLAYER', playerId });
            }}
            onToggleFollow={() => dispatch({ type: 'TOGGLE_FOLLOW_PARTNER' })}
            onCycleCameraPreset={() => {
              const next = sceneRef.current?.cycleCameraPreset?.();
              if (next) setCameraPreset(next);
            }}
            onResetCameraAngle={() => {
              sceneRef.current?.resetCameraAngle?.();
            }}
            onOpenSetup={() => {
              setOpenSpotId(null);
              dispatch({ type: 'OPEN_SETUP' });
            }}
            onQuickSwitchOnline={() => {
              connectToRoom(roomCode, 'p1');
            }}
            onSendEmote={handleSendEmote}
            onWalkToPartner={handleWalkToPartner}
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
              aria-label="ฉากงานเทศกาลลอยกระทงแบบเดินสำรวจ 3 มิติ"
            />

            <TouchControls
              activePlayerName={activePlayer.name}
              playMode={playMode}
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
            playMode={playMode}
            myOnlineRole={myOnlineRole}
            partnerOnline={occupancy[partnerRole]}
            lastPartnerSignal={lastPartnerSignal}
            reducedMotion={effectiveReducedMotion}
            onClose={() => setOpenSpotId(null)}
            onSwitchLocalPlayer={(pid) =>
              dispatch({ type: 'SET_ACTIVE_PLAYER', playerId: pid })
            }
            onRecordCoopHalf={(taskKey, playerId, halfScore) => {
              dispatch({
                type: 'RECORD_COOP_HALF',
                taskKey,
                playerId,
                halfScore,
              });
            }}
            onSendCoopSignal={(sid, action, val) => {
              roomClientRef.current?.sendCoopSignal(sid, action, val);
            }}
            onCollectMaterial={(material, message) => {
              playChime('pickup', state.settings.soundEnabled);
              dispatch({
                type: 'COLLECT_MATERIAL',
                material,
                byPlayer: controllingPlayerId,
                message,
              });
            }}
            onLightLantern={(lanternId) => {
              playChime('lantern', state.settings.soundEnabled);
              dispatch({
                type: 'LIGHT_LANTERN',
                lanternId,
                byPlayer: controllingPlayerId,
              });
            }}
            onBlessPavilion={() => {
              playChime('success', state.settings.soundEnabled);
              dispatch({
                type: 'BLESS_PAVILION',
                byPlayer: controllingPlayerId,
              });
            }}
            onCompleteMinigame={(gameId, passed, score) => {
              playChime(passed ? 'success' : 'error', state.settings.soundEnabled);
              dispatch({
                type: 'COMPLETE_MINIGAME',
                gameId,
                passed,
                score,
                byPlayer: controllingPlayerId,
              });
            }}
            onResetMinigame={(gameId) => {
              pendingSyncOptionsRef.current = { resetMinigame: gameId };
              dispatch({ type: 'RESET_MINIGAME', gameId });
            }}
            onUpdateKrathongDesign={(patch) =>
              dispatch({ type: 'UPDATE_KRATHONG_DESIGN', patch })
            }
            onCraftKrathong={() => {
              playChime('success', state.settings.soundEnabled);
              dispatch({
                type: 'CRAFT_KRATHONG',
                byPlayer: controllingPlayerId,
              });
            }}
            onReleaseKrathong={() => {
              playChime('ceremony', state.settings.soundEnabled);
              dispatch({
                type: 'RELEASE_KRATHONG',
                byPlayer: controllingPlayerId,
              });
            }}
            onStartAnother={() => {
              pendingSyncOptionsRef.current = { forceReplace: true };
              dispatch({ type: 'START_ANOTHER_KRATHONG' });
            }}
          />
        </div>
      )}

      <dialog
        ref={resetDialogRef}
        {...({ closedby: 'closerequest' } as Record<string, string>)}
        className="festival-dialog festival-dialog--compact"
        aria-labelledby="reset-dialog-title"
        onClose={() => setResetOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setResetOpen(false);
        }}
      >
        <div className="festival-dialog__content">
          <h1 id="reset-dialog-title" className="festival-dialog__title">
            ยืนยันการรีเซ็ตข้อมูลทั้งหมด?
          </h1>
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
