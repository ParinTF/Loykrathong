import type { ActivitySkillCommand } from '../domain/activitySkills.mjs';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  DEFAULT_PRESET_BY_GENDER,
} from '../domain/customizationCatalog';
import {
  createInitialGameState,
  extractSharedQuestState,
  gameReducer,
} from '../domain/reducer';
import type {
  CoopSignalEvent,
  CoupleEmoteEvent,
  Direction,
  GameState,
  GenderId,
  PhotoBoothEvent,
  PhotoBoothFilterId,
  PhotoBoothShutter,
  PlayerId,
  PlayerProfile,
} from '../domain/types';
import { getSpotById, isPositionWalkable } from '../domain/worldMap';
import type { CameraPreset, FestivalScene } from '../game/FestivalScene';
import { playChime, startFestivalMusic } from '../game/sound';
import {
  OnlineRoomClient,
  createSeatKey,
  inspectInvitation,
  readInviteCode,
  readRoomSession,
  saveRoomSession,
  type RoomConnectionStatus,
  type RoomIntent,
  type RoomOccupancy,
} from '../online/roomClient';
import {
  clearAllPersistedState,
  flushStateToLocalStorageSync,
  loadPersistedState,
  savePersistedState,
} from '../persistence/storage';
import {
  FestivalHud,
  type HudActions,
  type HudOverlay,
  type HudProfile,
} from './FestivalHud';
import { InteractionModal } from './InteractionModal';
import {
  InvitationScreen,
  OpeningFestival,
  type InvitationDetails,
  type PortraitDraft,
} from './InvitationScreen';
import { TouchControls } from './TouchControls';
import { KeepsakeCard } from './activities/KeepsakeCard';

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
    ])
      .then(async (modules) => {
        await modules[1].preloadFestivalModels();
        return modules;
      })
      .catch((error) => {
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
    prev.myRole === next.myRole &&
    prev.settings === next.settings &&
    prev.inventory === next.inventory &&
    prev.lotusBoat === next.lotusBoat &&
    prev.leafRelay === next.leafRelay &&
    prev.fortunePaper === next.fortunePaper &&
    prev.skyLantern === next.skyLantern &&
    prev.activePose === next.activePose &&
    prev.photoMemories === next.photoMemories &&
    prev.pierCeremony === next.pierCeremony &&
    prev.questStage === next.questStage &&
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
  offlineDemo?: boolean;
  loadWorldModules?: () => Promise<WorldModulesTuple>;
}

export function GameShell({
  disablePhaser = false,
  offlineDemo = false,
  loadWorldModules = preloadDefaultWorldModules,
}: GameShellProps) {
  // Read URL invite code ONCE on mount so replaceState('?room=...') never re-triggers invite checks
  const [inviteCode, setInviteCode] = useState<string | null>(() =>
    readInviteCode()
  );
  const [inviteDetails, setInviteDetails] = useState<InvitationDetails | null>(
    () => (readInviteCode() ? { status: 'checking' } : null)
  );
  const [inviteRetryTick, setInviteRetryTick] = useState(0);

  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    createInitialGameState
  );
  const [hydrated, setHydrated] = useState(false);
  const [resumingSession, setResumingSession] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const [openSpotId, setOpenSpotId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [hudOverlay, setHudOverlay] = useState<HudOverlay>(null);
  const [cinematicActive, setCinematicActive] = useState(false);
  const [keepsakeOpen, setKeepsakeOpen] = useState(false);

  // Online room connection state
  const [roomCode, setRoomCode] = useState<string>('');
  const [roomStatus, setRoomStatus] =
    useState<RoomConnectionStatus>('disconnected');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<RoomOccupancy>({
    p1: false,
    p2: false,
  });
  const [lastPartnerSignal, setLastPartnerSignal] =
    useState<CoopSignalEvent | null>(null);
  const [lastPhotoEvent, setLastPhotoEvent] =
    useState<PhotoBoothEvent | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('follow');

  const [worldAssetStatus, setWorldAssetStatus] = useState<
    'loading' | 'ready' | 'error'
  >(disablePhaser ? 'ready' : 'loading');
  const [assetRetryCount, setAssetRetryCount] = useState(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const legacyEngineRef = useRef<{
    destroy: (removeCanvas?: boolean) => void;
  } | null>(null);
  const sceneRef = useRef<FestivalScene | null>(null);
  const loadedModulesRef = useRef<WorldModulesTuple | null>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const keepsakeDialogRef = useRef<HTMLDialogElement>(null);
  const pendingBlobsRef = useRef<Partial<Record<PlayerId, Blob | null>>>({});
  const lastPersistedStateRef = useRef<GameState | null>(null);
  const hydratedRef = useRef<boolean>(false);
  hydratedRef.current = hydrated;
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;

  const pendingProfileOverrideRef = useRef<PlayerProfile | null>(null);
  const roomClientRef = useRef<OnlineRoomClient | null>(null);
  const lastSyncedSharedJsonRef = useRef<string>('');
  const pendingSyncOptionsRef = useRef<{ forceReplace?: boolean } | undefined>(
    undefined
  );

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

  // Hydrate persisted preferences & couple state
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

  // Ensure OnlineRoomClient instance is wired once
  const ensureRoomClient = useCallback(() => {
    if (roomClientRef.current) return roomClientRef.current;

    roomClientRef.current = new OnlineRoomClient(
      () =>
        pendingProfileOverrideRef.current ??
        stateRef.current.players[stateRef.current.myRole],
      {
        onJoined: (payload) => {
          pendingProfileOverrideRef.current = null;
          setRoomCode(payload.roomCode);
          setOccupancy(payload.occupancy);
          setSubmittingInvite(false);
          setResumingSession(false);
          setRoomError(null);
          saveRoomSession({
            roomCode: payload.roomCode,
            seatKey: payload.seatKey,
            role: payload.role,
          });
          lastSyncedSharedJsonRef.current = JSON.stringify(payload.shared);
          dispatch({ type: 'SET_FOLLOW_PARTNER', enabled: false });
          dispatch({
            type: 'APPLY_ONLINE_SNAPSHOT',
            myRole: payload.role,
            players: payload.players,
            shared: payload.shared,
            preserveMyProfile: false,
            preserveMyPosition: false,
          });
          dispatch({ type: 'ENTER_WORLD' });
          try {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('room', payload.roomCode);
            window.history.replaceState({}, '', nextUrl.toString());
          } catch {
            // ignore in non-browser tests
          }
        },
        onSnapshot: (payload) => {
          setOccupancy(payload.occupancy);
          lastSyncedSharedJsonRef.current = JSON.stringify(payload.shared);
          dispatch({
            type: 'APPLY_ONLINE_SNAPSHOT',
            myRole: stateRef.current.myRole,
            players: payload.players,
            shared: payload.shared,
            preserveMyProfile: true,
            preserveMyPosition: true,
          });
        },
        onPeerMoved: (playerId, position) => {
          if (playerId !== stateRef.current.myRole) {
            dispatch({ type: 'APPLY_PEER_MOVE', playerId, position });
          }
        },
        onPeerProfile: (playerId, profile) => {
          if (playerId !== stateRef.current.myRole) {
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
        onPhotoBoothEvent: (event) => {
          setLastPhotoEvent(event);
        },
        onStatusChange: (status, message, code) => {
          setRoomStatus(status);
          setRoomError(message);
          if (status === 'error') {
            setSubmittingInvite(false);
            setResumingSession(false);
            if (code === 'not_found' || code === 'invalid_seat') {
              saveRoomSession(null);
            }
          }
        },
      }
    );
    return roomClientRef.current;
  }, []);

  // Auto-resume existing room session on refresh OR inspect partner invitation
  useEffect(() => {
    if (!hydrated || offlineDemo) return undefined;

    const existing = readRoomSession(inviteCode);
    if (existing) {
      setResumingSession(true);
      ensureRoomClient().connect({
        type: 'resume_room',
        roomCode: existing.roomCode,
        seatKey: existing.seatKey,
      });
      return undefined;
    }

    if (!inviteCode) {
      setInviteDetails(null);
      return undefined;
    }

    const controller = new AbortController();
    setInviteDetails({ status: 'checking' });
    void inspectInvitation(inviteCode, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if ('hostName' in res) {
          setInviteDetails({ status: 'ready', hostName: res.hostName });
        } else {
          setInviteDetails({
            status: 'error',
            message: res.message,
            retry: res.retry,
          });
        }
      })
      .catch(() => {
        // aborted
      });

    return () => controller.abort();
  }, [hydrated, inviteCode, inviteRetryTick, offlineDemo, ensureRoomClient]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      roomClientRef.current?.disconnect();
    };
  }, []);

  // Sync my movement to partner in real time
  const myProfile = state.players[state.myRole];
  useEffect(() => {
    if (roomStatus !== 'connected') return;
    roomClientRef.current?.sendMove(myProfile.position);
  }, [
    roomStatus,
    myProfile.position.x,
    myProfile.position.y,
    myProfile.position.facing,
  ]);

  // Sync my profile (name, outfit, accessory, portrait) when edited
  useEffect(() => {
    if (roomStatus !== 'connected') return;
    roomClientRef.current?.sendProfile(myProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roomStatus,
    myProfile.name,
    myProfile.customization,
    myProfile.portrait.updatedAt,
  ]);

  // Sync shared romantic activity state to partner without echoing snapshots
  useEffect(() => {
    if (roomStatus !== 'connected') return;
    const shared = extractSharedQuestState(stateRef.current);
    const serialized = JSON.stringify(shared);
    if (serialized === lastSyncedSharedJsonRef.current) return;

    lastSyncedSharedJsonRef.current = serialized;
    const opts = pendingSyncOptionsRef.current;
    pendingSyncOptionsRef.current = undefined;
    roomClientRef.current?.sendSharedState(shared, opts);
  }, [
    roomStatus,
    state.inventory,
    state.lotusBoat,
    state.leafRelay,
    state.fortunePaper,
    state.skyLantern,
    state.activePose,
    state.photoMemories,
    state.pierCeremony,
    state.questStage,
    state.krathongCrafted,
    state.krathongDesign,
    state.releasedKrathongs,
    state.lastEventLog,
  ]);

  // Preload Three.js & Blender 3D models
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

  // Synchronous flush on tab hide/reload
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const flushNow = () => {
      if (!hydratedRef.current) return;
      flushStateToLocalStorageSync(stateRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
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

  // Persist state updates
  useEffect(() => {
    if (!hydrated) return undefined;
    const hasPendingBlobs =
      pendingBlobsRef.current.p1 !== undefined ||
      pendingBlobsRef.current.p2 !== undefined;
    const positionOnly =
      !hasPendingBlobs &&
      isPositionOnlyChange(lastPersistedStateRef.current, state);

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

  // Dialog sync for Reset & Standalone Keepsake Card
  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog) return;
    if (resetOpen && !dialog.open) dialog.showModal?.();
    else if (!resetOpen && dialog.open) dialog.close?.();
  }, [resetOpen]);

  useEffect(() => {
    const dialog = keepsakeDialogRef.current;
    if (!dialog) return;
    if (keepsakeOpen && !dialog.open) dialog.showModal?.();
    else if (!keepsakeOpen && dialog.open) dialog.close?.();
  }, [keepsakeOpen]);

  // Mount Three.js 3D FestivalScene
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
        onInteractSpot: setOpenSpotId,
        onCameraPreset: setCameraPreset,
      },
      reducedMotionRef.current
    );
    scene.setModalBlocked(
      Boolean(openSpotId) ||
        resetOpen ||
        hudOverlay !== null ||
        keepsakeOpen ||
        cinematicActive
    );
    scene.setCameraPreset?.(cameraPreset);
    sceneRef.current = scene;

    try {
      if (typeof scene.mount === 'function') {
        scene.mount(container);
      } else {
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
      scene.destroy?.();
      legacyEngineRef.current = null;
      sceneRef.current = null;
      setWorldAssetStatus('error');
    }

    return () => {
      sceneRef.current?.destroy?.();
      sceneRef.current = null;
      if (legacyEngineRef.current) {
        legacyEngineRef.current.destroy(true);
        legacyEngineRef.current = null;
      }
    };
  }, [state.screen, disablePhaser, worldAssetStatus]);

  const partnerRole: PlayerId = state.myRole === 'p1' ? 'p2' : 'p1';
  const partnerPresent =
    roomStatus === 'connected' ? occupancy[partnerRole] : true;

  useEffect(() => {
    sceneRef.current?.updateSnapshot?.(
      state,
      effectiveReducedMotion,
      partnerPresent
    );
  }, [state, effectiveReducedMotion, partnerPresent]);

  useEffect(() => {
    sceneRef.current?.setModalBlocked(
      Boolean(openSpotId) ||
        resetOpen ||
        hudOverlay !== null ||
        keepsakeOpen ||
        cinematicActive
    );
  }, [openSpotId, resetOpen, hudOverlay, keepsakeOpen, cinematicActive]);

  useEffect(() => {
    if (state.screen !== 'world' || !state.settings.musicEnabled) return;
    return startFestivalMusic();
  }, [state.screen, state.settings.musicEnabled]);

  const handleVectorChange = useCallback((vx: number, vy: number) => {
    sceneRef.current?.setTouchVector(vx, vy);
  }, []);

  const handleNudgeStep = useCallback(
    (dx: number, dy: number, facing: Direction) => {
      const targetPlayer = stateRef.current.myRole;
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
      const sender = stateRef.current.myRole;
      if (roomStatus === 'connected') {
        roomClientRef.current?.sendEmote(emoji, text);
      } else {
        playChime('beat', stateRef.current.settings.soundEnabled);
        sceneRef.current?.showEmote?.({
          playerId: sender,
          emoji,
          text,
          ts: Date.now(),
        });
      }
    },
    [roomStatus]
  );

  const handleWalkToPartner = useCallback(() => {
    const myRole = stateRef.current.myRole;
    const pRole: PlayerId = myRole === 'p1' ? 'p2' : 'p1';
    const players = stateRef.current.players;
    const partnerPos = players[pRole].position;
    const myPos = players[myRole].position;
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
          playerId: myRole,
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
  }, []);

  // Submit InvitationScreen -> create or join private room (or enter offline demo when offlineDemo=true)
  const handleSubmitInvitation = useCallback(
    (name: string, gender: GenderId, draft: PortraitDraft) => {
      const targetRole: PlayerId = inviteCode ? 'p2' : 'p1';
      const genderPreset = DEFAULT_PRESET_BY_GENDER[gender];
      const nextCustomization = {
        ...stateRef.current.players[targetRole].customization,
        ...genderPreset,
      };
      const updatedProfile: PlayerProfile = {
        ...stateRef.current.players[targetRole],
        name,
        customization: nextCustomization,
        portrait: draft.portrait,
      };
      pendingBlobsRef.current[targetRole] = draft.blob;
      dispatch({ type: 'SET_MY_ROLE', role: targetRole });
      dispatch({ type: 'UPDATE_PLAYER_NAME', playerId: targetRole, name });
      dispatch({
        type: 'UPDATE_PLAYER_CUSTOMIZATION',
        playerId: targetRole,
        patch: genderPreset,
      });
      dispatch({
        type: 'SET_PLAYER_PORTRAIT',
        playerId: targetRole,
        portrait: draft.portrait,
      });

      if (offlineDemo) {
        dispatch({ type: 'ENTER_WORLD' });
        return;
      }

      pendingProfileOverrideRef.current = updatedProfile;
      setSubmittingInvite(true);
      setRoomError(null);
      const seatKey = createSeatKey();
      const intent: RoomIntent = inviteCode
        ? { type: 'join_room', roomCode: inviteCode, seatKey }
        : { type: 'create_room', seatKey };
      ensureRoomClient().connect(intent);
    },
    [inviteCode, offlineDemo, ensureRoomClient]
  );

  const handleGoHome = useCallback(() => {
    roomClientRef.current?.disconnect();
    saveRoomSession(null);
    setInviteCode(null);
    setInviteDetails(null);
    setRoomCode('');
    setRoomError(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  const handleConfirmReset = async () => {
    setResetOpen(false);
    setOpenSpotId(null);
    setHudOverlay(null);
    setKeepsakeOpen(false);
    setCinematicActive(false);
    setCameraPreset('follow');
    roomClientRef.current?.disconnect();
    saveRoomSession(null);
    setRoomCode('');
    setRoomStatus('disconnected');
    setOccupancy({ p1: false, p2: false });
    pendingBlobsRef.current = { p1: null, p2: null };
    pendingSyncOptionsRef.current = { forceReplace: true };
    await clearAllPersistedState();
    dispatch({ type: 'RESET_GAME' });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  // Activity 08: Release Krathong -> Trigger smooth 3D Cinematic -> Open Keepsake Card
  const handleTriggerKrathongRelease = useCallback((byPlayer: PlayerId) => {
    const timestamp = new Date().toISOString();
    const nextIndex = stateRef.current.releasedKrathongs.length + 1;
    const krathongId = `krathong-${nextIndex}-${timestamp}`;
    playChime('ceremony', stateRef.current.settings.soundEnabled);
    dispatch({ type: 'RELEASE_KRATHONG', byPlayer, timestamp });
    setOpenSpotId(null);

    if (sceneRef.current && typeof sceneRef.current.startReleaseCinematic === 'function') {
      setCinematicActive(true);
      sceneRef.current.startReleaseCinematic(krathongId, () => {
        setCinematicActive(false);
        setKeepsakeOpen(true);
      });
    } else {
      setKeepsakeOpen(true);
    }
  }, []);

  const handleSkipCinematic = useCallback(() => {
    if (sceneRef.current?.stopReleaseCinematic) {
      sceneRef.current.stopReleaseCinematic();
    } else {
      setCinematicActive(false);
      setKeepsakeOpen(true);
    }
  }, []);

  const handleSendPhotoFrame = useCallback(
    (dataUrl: string, mirrored: boolean, filter: PhotoBoothFilterId) => {
      roomClientRef.current?.sendPhotoBoothFrame(dataUrl, mirrored, filter);
    },
    []
  );

  const handleSendPhotoCamState = useCallback((active: boolean) => {
    roomClientRef.current?.sendPhotoBoothCamState(active);
  }, []);

  const handleSendPhotoShutter = useCallback(
    (payload: PhotoBoothShutter) => {
      roomClientRef.current?.sendPhotoBoothShutter(payload);
    },
    []
  );

  const handleSendPhotoSnap = useCallback(
    (sessionId: string, shotIndex: number, dataUrl: string | null) => {
      roomClientRef.current?.sendPhotoBoothSnap(sessionId, shotIndex, dataUrl);
    },
    []
  );

  const handleActivitySkill = useCallback((command: ActivitySkillCommand) => {
    roomClientRef.current?.sendActivitySkill(command);
  }, []);

  const bothOnline = roomStatus === 'connected' && occupancy.p1 && occupancy.p2;
  const activePlayer = state.players[state.myRole];
  const nearbySpot = getSpotById(state.nearbySpotId);

  const { name: p1Name, customization: p1Outfit, portrait: p1Portrait } =
    state.players.p1;
  const { name: p2Name, customization: p2Outfit, portrait: p2Portrait } =
    state.players.p2;

  const hudProfiles = useMemo<Record<PlayerId, HudProfile>>(
    () => ({
      p1: { id: 'p1', name: p1Name, customization: p1Outfit, portrait: p1Portrait },
      p2: { id: 'p2', name: p2Name, customization: p2Outfit, portrait: p2Portrait },
    }),
    [p1Name, p1Outfit, p1Portrait, p2Name, p2Outfit, p2Portrait]
  );

  const hudMemories = useMemo(
    () => ({
      boatDone: state.lotusBoat.completed,
      leafDone: state.leafRelay.completed,
      fortuneDone: state.fortunePaper.revealed,
      lanternReleased: state.skyLantern.released,
      krathongCrafted: state.krathongCrafted,
      photoCount: state.photoMemories.length,
      releasedCount: state.releasedKrathongs.length,
    }),
    [
      state.lotusBoat.completed,
      state.leafRelay.completed,
      state.fortunePaper.revealed,
      state.skyLantern.released,
      state.krathongCrafted,
      state.photoMemories.length,
      state.releasedKrathongs.length,
    ]
  );

  const canJoinPartner =
    bothOnline &&
    Math.hypot(
      state.players.p1.position.x - state.players.p2.position.x,
      state.players.p1.position.y - state.players.p2.position.y
    ) > 150;

  const hudActions = useMemo<HudActions>(
    () => ({
      onJoinPartner: handleWalkToPartner,
      onOverlay: setHudOverlay,
      onEmote: handleSendEmote,
      onInteract: () => setOpenSpotId(stateRef.current.nearbySpotId),
      onCamera: (preset) => {
        setCameraPreset(preset);
        sceneRef.current?.setCameraPreset?.(preset);
      },
      onResetCamera: () => sceneRef.current?.resetCameraAngle?.(),
      onPresentation: (patch) =>
        dispatch({ type: 'SET_PRESENTATION_SETTINGS', patch }),
      onSound: () => dispatch({ type: 'TOGGLE_SOUND' }),
      onMotion: (mode) => dispatch({ type: 'SET_REDUCED_MOTION', mode }),
      onResetGame: () => setResetOpen(true),
      onUpdateCustomization: (patch) =>
        dispatch({
          type: 'UPDATE_PLAYER_CUSTOMIZATION',
          playerId: stateRef.current.myRole,
          patch,
        }),
      onOpenKeepsake: () => setKeepsakeOpen(true),
    }),
    [handleSendEmote, handleWalkToPartner]
  );

  const defaultRoleForInvite: PlayerId = inviteCode ? 'p2' : 'p1';
  const latestReleased =
    state.releasedKrathongs[state.releasedKrathongs.length - 1] ?? null;

  return (
    <div
      className="app-shell"
      data-reduced-motion={effectiveReducedMotion ? 'true' : 'false'}
    >
      <a href="#main-content" className="skip-link">
        ข้ามไปยังเนื้อหาหลัก
      </a>

      {state.screen === 'setup' ? (
        resumingSession ? (
          <OpeningFestival
            message={roomError ?? 'กำลังกลับเข้าห้องเดิม…'}
            error={roomStatus === 'error'}
            onRetry={handleGoHome}
            reducedMotion={effectiveReducedMotion}
          />
        ) : (
          <InvitationScreen
            invite={inviteDetails}
            nameHint={state.players[defaultRoleForInvite].name}
            initialGender={state.players[defaultRoleForInvite].customization.gender}
            initialPortrait={state.players[defaultRoleForInvite].portrait}
            submitting={submittingInvite}
            message={roomError}
            reducedMotion={effectiveReducedMotion}
            onSubmit={handleSubmitInvitation}
            onGoHome={handleGoHome}
            onRetryInvite={() => setInviteRetryTick((n) => n + 1)}
          />
        )
      ) : (
        <div
          className="world-layout"
          data-festival-world
          data-high-contrast={state.settings.highContrast}
        >
          <main id="main-content" className="world-stage-wrap" tabIndex={-1}>
            <h1 className="visually-hidden">
              แผนที่งานลอยกระทงคู่รัก คืนเพ็ญริมน้ำ
            </h1>
            {!disablePhaser && worldAssetStatus === 'loading' && (
              <div className="stage-loading-card">
                <p>กำลังเตรียมฉากงานลอยกระทง 3 มิติ...</p>
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
                  ไม่สามารถเตรียมไฟล์ฉากแผนที่ได้ขณะออฟไลน์หรือการเชื่อมต่อขาดหาย
                  กรุณาเชื่อมต่อเครือข่ายแล้วกดลองใหม่
                </p>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleRetryWorldAssets}
                  >
                    ลองโหลดฉากอีกครั้ง
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
          </main>

          {!cinematicActive && (
            <FestivalHud
              profiles={hudProfiles}
              settings={state.settings}
              memories={hudMemories}
              eventLog={state.lastEventLog}
              nearbySpot={worldAssetStatus === 'ready' ? nearbySpot : null}
              roomCode={roomCode}
              role={state.myRole}
              roomStatus={roomStatus}
              roomError={roomError}
              occupancy={occupancy}
              canJoinPartner={canJoinPartner}
              camera={cameraPreset}
              overlay={hudOverlay}
              actions={hudActions}
            />
          )}

          {!cinematicActive && worldAssetStatus === 'ready' && (
            <TouchControls
              activePlayerName={activePlayer.name}
              alwaysVisible={state.settings.showTouchControls}
              onVectorChange={handleVectorChange}
              onNudgeStep={handleNudgeStep}
            />
          )}

          {cinematicActive && latestReleased && (
            <div
              className="cinematic-overlay"
              role="region"
              aria-label="ฉากปล่อยกระทงใต้แสงจันทร์"
            >
              <div className="cinematic-overlay__caption">
                <span className="cinematic-overlay__names">
                  🌕 {latestReleased.coupleNames[0]} ♥{' '}
                  {latestReleased.coupleNames[1]}
                </span>
                <p className="cinematic-overlay__wish">
                  “{latestReleased.design.wishText}”
                </p>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--sm cinematic-overlay__skip"
                onClick={handleSkipCinematic}
              >
                เปิดการ์ดที่ระลึก →
              </button>
            </div>
          )}

          <InteractionModal
            spotId={openSpotId}
            state={state}
            myOnlineRole={state.myRole}
            bothOnline={bothOnline}
            lastPartnerSignal={lastPartnerSignal}
            lastPhotoEvent={lastPhotoEvent}
            reducedMotion={effectiveReducedMotion}
            onClose={() => setOpenSpotId(null)}
            onSendCoopSignal={(sid, action, val, x, y) => {
              roomClientRef.current?.sendCoopSignal(sid, action, val, x, y);
            }}
            onSendPhotoFrame={handleSendPhotoFrame}
            onSendPhotoCamState={handleSendPhotoCamState}
            onSendPhotoShutter={handleSendPhotoShutter}
            onSendPhotoSnap={handleSendPhotoSnap}
            onActivitySkill={handleActivitySkill}
            onSetFortunePrompt={(promptIndex) =>
              dispatch({ type: 'SET_FORTUNE_PROMPT', promptIndex })
            }
            onSetFortuneAnswer={(playerId, answer) =>
              dispatch({ type: 'SET_FORTUNE_ANSWER', playerId, answer })
            }
            onLockFortuneAnswer={(playerId) =>
              dispatch({ type: 'LOCK_FORTUNE_ANSWER', playerId })
            }
            onResetFortuneRound={() =>
              dispatch({ type: 'RESET_FORTUNE_ROUND' })
            }
            onSetLanternWish={(playerId, wish) =>
              dispatch({ type: 'SET_LANTERN_WISH', playerId, wish })
            }
            onUpdateKrathongDesign={(patch) =>
              dispatch({ type: 'UPDATE_KRATHONG_DESIGN', patch })
            }
            onAddKrathongDecoration={(item) =>
              dispatch({ type: 'ADD_KRATHONG_DECORATION', item })
            }
            onMoveKrathongDecoration={(id, x, y) =>
              dispatch({ type: 'MOVE_KRATHONG_DECORATION', id, x, y })
            }
            onRemoveKrathongDecoration={(id) =>
              dispatch({ type: 'REMOVE_KRATHONG_DECORATION', id })
            }
            onClearKrathongDecorations={() =>
              dispatch({ type: 'CLEAR_KRATHONG_DECORATIONS' })
            }
            onCraftKrathong={(byPlayer) =>
              dispatch({ type: 'CRAFT_KRATHONG', byPlayer })
            }
            onSetCouplePose={(pose) =>
              dispatch({ type: 'SET_COUPLE_POSE', pose })
            }
            onSavePhotoMemory={(pose, backdrop, caption, layout, compositeDataUrl, frameTheme) =>
              dispatch({
                type: 'SAVE_PHOTO_MEMORY',
                pose,
                backdrop,
                caption,
                layout,
                compositeDataUrl,
                frameTheme,
              })
            }
            onTogglePierReady={(playerId, ready) =>
              dispatch({ type: 'TOGGLE_PIER_READY', playerId, ready })
            }
            onReleaseKrathong={handleTriggerKrathongRelease}
            onStartAnother={() => {
              pendingSyncOptionsRef.current = { forceReplace: true };
              dispatch({ type: 'START_ANOTHER_KRATHONG' });
            }}
          />
        </div>
      )}

      {/* Standalone Couple Keepsake Card Dialog (opened after 3D Release Cinematic or from Memories HUD) */}
      <dialog
        ref={keepsakeDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        className="festival-dialog"
        aria-label="การ์ดที่ระลึกคืนเพ็ญของทั้งคู่"
        onClose={() => setKeepsakeOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setKeepsakeOpen(false);
        }}
      >
        {keepsakeOpen && latestReleased && (
          <div className="festival-dialog__content">
            <KeepsakeCard
              state={state}
              onWatchRiver={() => setKeepsakeOpen(false)}
              onStartAnother={() => {
                pendingSyncOptionsRef.current = { forceReplace: true };
                dispatch({ type: 'START_ANOTHER_KRATHONG' });
                setKeepsakeOpen(false);
              }}
            />
          </div>
        )}
      </dialog>

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
            ข้อมูลตัวละครทั้ง 2 คน รูปใบหน้า ความทรงจำ และกระทงที่ลอยแล้วจะถูกล้างกลับเป็นค่าเริ่มต้น
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
