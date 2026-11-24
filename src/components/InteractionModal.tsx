import { useEffect, useRef } from 'react';
import { getLandmarkForSpotKind } from '../domain/landmarks';
import type {
  CoopSignalEvent,
  CouplePoseId,
  GameState,
  KrathongDecorationItem,
  KrathongDesign,
  LeafRelayState,
  LotusBoatState,
  PhotoBackdropId,
  PhotoBoothEvent,
  PhotoBoothFilterId,
  PhotoBoothLayoutId,
  PlayerId,
} from '../domain/types';
import { getSpotById } from '../domain/worldMap';
import { FortunePaperActivity } from './activities/FortunePaperActivity';
import { KrathongStudioActivity } from './activities/KrathongStudioActivity';
import { LeafFoldRelayActivity } from './activities/LeafFoldRelayActivity';
import { LotusBoatActivity } from './activities/LotusBoatActivity';
import { PierCeremonyActivity } from './activities/PierCeremonyActivity';
import { ScenicPhotoActivity } from './activities/ScenicPhotoActivity';
import { SkyLanternActivity } from './activities/SkyLanternActivity';

interface InteractionModalProps {
  spotId: string | null;
  state: GameState;
  myOnlineRole: PlayerId;
  bothOnline: boolean;
  lastPartnerSignal?: CoopSignalEvent | null;
  lastPhotoEvent?: PhotoBoothEvent | null;
  reducedMotion: boolean;
  onClose: () => void;
  onSendCoopSignal?: (
    spotId: string,
    action: string,
    value?: number,
    x?: number,
    y?: number
  ) => void;
  onSendPhotoFrame?: (
    dataUrl: string,
    mirrored: boolean,
    filter: PhotoBoothFilterId
  ) => void;
  onSendPhotoCamState?: (active: boolean) => void;
  onSendPhotoShutter?: (payload: {
    sessionId: string;
    layout: PhotoBoothLayoutId;
    backdrop: PhotoBackdropId;
    pose: CouplePoseId;
    caption: string;
  }) => void;
  onSendPhotoSnap?: (
    sessionId: string,
    shotIndex: number,
    dataUrl: string | null
  ) => void;
  // Activity 01
  onUpdateLotusBoat: (patch: Partial<LotusBoatState>) => void;
  onPickBoatLotus: (lotusId: string, byPlayer: PlayerId) => void;
  // Activity 02
  onUpdateLeafRelay: (patch: Partial<LeafRelayState>) => void;
  onAdvanceLeafCut: (byPlayer: PlayerId) => void;
  onAdvanceLeafFold: (byPlayer: PlayerId) => void;
  // Activity 03
  onSetFortunePrompt: (promptIndex: number) => void;
  onSetFortuneAnswer: (playerId: PlayerId, answer: string) => void;
  onLockFortuneAnswer: (playerId: PlayerId) => void;
  onResetFortuneRound: () => void;
  // Activity 04
  onSetLanternWish: (playerId: PlayerId, wish: string) => void;
  onLightLanternSide: (playerId: PlayerId) => void;
  onReadyReleaseLantern: (playerId: PlayerId) => void;
  onCompleteLanternRelease: () => void;
  // Activity 06
  onUpdateKrathongDesign: (patch: Partial<KrathongDesign>) => void;
  onAddKrathongDecoration: (item: KrathongDecorationItem) => void;
  onMoveKrathongDecoration: (id: string, x: number, y: number) => void;
  onRemoveKrathongDecoration: (id: string) => void;
  onClearKrathongDecorations: () => void;
  onCraftKrathong: (byPlayer: PlayerId) => void;
  // Activity 07
  onSetCouplePose: (pose: CouplePoseId) => void;
  onSavePhotoMemory: (
    pose: CouplePoseId,
    backdrop: PhotoBackdropId,
    caption: string,
    layout?: PhotoBoothLayoutId,
    compositeDataUrl?: string | null
  ) => void;
  // Activity 08
  onTogglePierReady: (playerId: PlayerId, ready?: boolean) => void;
  onReleaseKrathong: (byPlayer: PlayerId) => void;
  onStartAnother: () => void;
}

export function InteractionModal({
  spotId,
  state,
  myOnlineRole,
  bothOnline,
  lastPartnerSignal = null,
  lastPhotoEvent = null,
  reducedMotion,
  onClose,
  onSendCoopSignal,
  onSendPhotoFrame,
  onSendPhotoCamState,
  onSendPhotoShutter,
  onSendPhotoSnap,
  onUpdateLotusBoat,
  onPickBoatLotus,
  onUpdateLeafRelay,
  onAdvanceLeafCut,
  onAdvanceLeafFold,
  onSetFortunePrompt,
  onSetFortuneAnswer,
  onLockFortuneAnswer,
  onResetFortuneRound,
  onSetLanternWish,
  onLightLanternSide,
  onReadyReleaseLantern,
  onCompleteLanternRelease,
  onUpdateKrathongDesign,
  onAddKrathongDecoration,
  onMoveKrathongDecoration,
  onRemoveKrathongDecoration,
  onClearKrathongDecorations,
  onCraftKrathong,
  onSetCouplePose,
  onSavePhotoMemory,
  onTogglePierReady,
  onReleaseKrathong,
  onStartAnother,
}: InteractionModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const spot = getSpotById(spotId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (spot) {
      if (!dialog.open) {
        dialog.showModal?.();
      }
    } else if (dialog.open) {
      dialog.close?.();
    }
  }, [spot]);

  // Light-dismiss fallback for browsers without native dialog[closedby="any"] support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (
      !dialog ||
      typeof HTMLDialogElement === 'undefined' ||
      'closedBy' in HTMLDialogElement.prototype
    ) {
      return undefined;
    }

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isDialogContent) {
        dialog.close?.();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, []);

  const handleClose = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close?.();
    }
    onClose();
  };

  const landmark = spot ? getLandmarkForSpotKind(spot.kind) : null;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="festival-dialog"
      aria-labelledby="modal-spot-title"
      onClose={() => {
        if (spotId !== null) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
    >
      {spot && (
        <div className="festival-dialog__content">
          {landmark && (
            <figure className="landmark-banner">
              <img
                src={landmark.imagePath}
                alt={landmark.alt}
                width={760}
                height={220}
                loading="lazy"
                fetchPriority="low"
                className="landmark-banner__img"
              />
              <figcaption className="landmark-banner__caption">
                <strong>📍 {landmark.placeTitle}</strong>
                <span>{landmark.locationNote}</span>
              </figcaption>
            </figure>
          )}

          <header className="festival-dialog__header">
            <div>
              <p className="festival-dialog__zone">{spot.zoneName}</p>
              <h1 id="modal-spot-title" className="festival-dialog__title">
                {spot.title}
              </h1>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleClose}
            >
              ปิดหน้าต่าง
            </button>
          </header>

          <p className="festival-dialog__subtitle">{spot.subtitle}</p>

          <div className="dialog-body">
            {spot.id === 'gather-lotus' && (
              <LotusBoatActivity
                boat={state.lotusBoat}
                players={state.players}
                myRole={myOnlineRole}
                bothOnline={bothOnline}
                lastSignal={lastPartnerSignal}
                reducedMotion={reducedMotion}
                soundEnabled={state.settings.soundEnabled}
                onUpdateBoat={onUpdateLotusBoat}
                onPickLotus={onPickBoatLotus}
                onSendSignal={onSendCoopSignal}
              />
            )}

            {spot.id === 'npc-bua' && (
              <LeafFoldRelayActivity
                relay={state.leafRelay}
                players={state.players}
                myRole={myOnlineRole}
                bothOnline={bothOnline}
                soundEnabled={state.settings.soundEnabled}
                onUpdateRelay={onUpdateLeafRelay}
                onAdvanceCut={onAdvanceLeafCut}
                onAdvanceFold={onAdvanceLeafFold}
              />
            )}

            {spot.id === 'npc-man' && (
              <FortunePaperActivity
                fortune={state.fortunePaper}
                players={state.players}
                myRole={myOnlineRole}
                bothOnline={bothOnline}
                soundEnabled={state.settings.soundEnabled}
                onChangePrompt={onSetFortunePrompt}
                onSetAnswer={onSetFortuneAnswer}
                onLockAnswer={onLockFortuneAnswer}
                onNextRound={onResetFortuneRound}
              />
            )}

            {spot.kind === 'lantern' && (
              <SkyLanternActivity
                lantern={state.skyLantern}
                players={state.players}
                myRole={myOnlineRole}
                bothOnline={bothOnline}
                reducedMotion={reducedMotion}
                soundEnabled={state.settings.soundEnabled}
                onSetWish={onSetLanternWish}
                onLightSide={onLightLanternSide}
                onReadyRelease={onReadyReleaseLantern}
                onCompleteRelease={onCompleteLanternRelease}
              />
            )}

            {spot.kind === 'craft' && (
              <KrathongStudioActivity
                design={state.krathongDesign}
                inventory={state.inventory}
                crafted={state.krathongCrafted}
                players={state.players}
                myRole={myOnlineRole}
                bothOnline={bothOnline}
                lastSignal={lastPartnerSignal}
                soundEnabled={state.settings.soundEnabled}
                onUpdateDesign={onUpdateKrathongDesign}
                onAddDecoration={onAddKrathongDecoration}
                onMoveDecoration={onMoveKrathongDecoration}
                onRemoveDecoration={onRemoveKrathongDecoration}
                onClearDecorations={onClearKrathongDecorations}
                onCraftKrathong={onCraftKrathong}
                onSendSignal={onSendCoopSignal}
              />
            )}

            {(spot.kind === 'pavilion' || spot.kind === 'photo') && (
              <ScenicPhotoActivity
                spotId={spot.id}
                activePose={state.activePose}
                photoMemories={state.photoMemories}
                players={state.players}
                myRole={myOnlineRole}
                bothOnline={bothOnline}
                lastPhotoEvent={lastPhotoEvent}
                soundEnabled={state.settings.soundEnabled}
                onSetPose={onSetCouplePose}
                onSavePhoto={onSavePhotoMemory}
                onSendPhotoFrame={onSendPhotoFrame}
                onSendCamState={onSendPhotoCamState}
                onSendShutter={onSendPhotoShutter}
                onSendSnap={onSendPhotoSnap}
              />
            )}

            {spot.kind === 'pier' && (
              <PierCeremonyActivity
                state={state}
                myRole={myOnlineRole}
                bothOnline={bothOnline}
                reducedMotion={reducedMotion}
                soundEnabled={state.settings.soundEnabled}
                onUpdateWish={onUpdateKrathongDesign}
                onToggleReady={onTogglePierReady}
                onTriggerRelease={onReleaseKrathong}
                onStartAnother={onStartAnother}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
