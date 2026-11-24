import { useEffect, useRef } from 'react';
import {
  KRATHONG_BASES,
  KRATHONG_FLOWERS,
  KRATHONG_GLOWS,
} from '../domain/customizationCatalog';
import { getCoopChallengeSpec, isCoopPairComplete } from '../domain/coopChallenges';
import { getLandmarkForSpotKind } from '../domain/landmarks';
import { areAllMinigamesPassed, computeKrathongQuality } from '../domain/minigames';
import { MATERIAL_LABELS, canCraftKrathong, hasAllMaterials } from '../domain/reducer';
import { getSpotById } from '../domain/worldMap';
import type {
  CoopSignalEvent,
  GameState,
  KrathongDesign,
  MaterialId,
  MinigameId,
  PlayMode,
  PlayerId,
} from '../domain/types';
import { AvatarPreview } from './AvatarPreview';
import { CoopChallengePanel } from './CoopChallengePanel';
import { KrathongIllustration } from './KrathongIllustration';
import { MinigameSuite } from './MinigameSuite';

interface InteractionModalProps {
  spotId: string | null;
  state: GameState;
  playMode?: PlayMode;
  myOnlineRole?: PlayerId;
  partnerOnline?: boolean;
  lastPartnerSignal?: CoopSignalEvent | null;
  reducedMotion: boolean;
  onClose: () => void;
  onSwitchLocalPlayer?: (playerId: PlayerId) => void;
  onRecordCoopHalf: (taskKey: string, playerId: PlayerId, halfScore: number) => void;
  onSendCoopSignal?: (spotId: string, action: string, value?: number) => void;
  onCollectMaterial: (material: MaterialId, message: string) => void;
  onLightLantern: (lanternId: string) => void;
  onBlessPavilion: () => void;
  onCompleteMinigame: (gameId: MinigameId, passed: boolean, score: number) => void;
  onResetMinigame: (gameId: MinigameId) => void;
  onUpdateKrathongDesign: (patch: Partial<KrathongDesign>) => void;
  onCraftKrathong: () => void;
  onReleaseKrathong: () => void;
  onStartAnother: () => void;
}

export function InteractionModal({
  spotId,
  state,
  playMode = 'local',
  myOnlineRole = 'p1',
  partnerOnline = false,
  lastPartnerSignal = null,
  reducedMotion,
  onClose,
  onSwitchLocalPlayer,
  onRecordCoopHalf,
  onSendCoopSignal,
  onCollectMaterial,
  onLightLantern,
  onBlessPavilion,
  onCompleteMinigame,
  onResetMinigame,
  onUpdateKrathongDesign,
  onCraftKrathong,
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

  // Automatically unlock spot reward as soon as BOTH P1 and P2 complete their cooperative halves
  useEffect(() => {
    if (!spot) return;
    const progress = state.coopTasks[spot.id];
    if (!isCoopPairComplete(progress)) return;

    if (
      (spot.kind === 'npc' || spot.kind === 'gather') &&
      spot.grantsMaterial &&
      !state.inventory[spot.grantsMaterial]
    ) {
      onCollectMaterial(
        spot.grantsMaterial,
        `ทั้งคู่ร่วมแรงผ่านภารกิจและได้รับ${MATERIAL_LABELS[spot.grantsMaterial].name}เรียบร้อย!`
      );
    } else if (spot.kind === 'lantern' && !state.litLanternIds.includes(spot.id)) {
      onLightLantern(spot.id);
    } else if (spot.kind === 'pavilion' && !state.pavilionBlessed) {
      onBlessPavilion();
    }
  }, [
    spot,
    state.coopTasks,
    state.inventory,
    state.litLanternIds,
    state.pavilionBlessed,
    onCollectMaterial,
    onLightLantern,
    onBlessPavilion,
  ]);

  const handleClose = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close?.();
    }
    onClose();
  };

  const p1 = state.players.p1;
  const p2 = state.players.p2;
  const quality = computeKrathongQuality(state.minigames);
  const allMats = hasAllMaterials(state.inventory);
  const allMinigamesDone = areAllMinigamesPassed(state.minigames);
  const latestReleased =
    state.releasedKrathongs[state.releasedKrathongs.length - 1] ?? null;

  const landmark = spot ? getLandmarkForSpotKind(spot.kind) : null;
  const coopSpec = spot ? getCoopChallengeSpec(spot.id, spot.kind) : null;

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

          {(spot.kind === 'npc' || spot.kind === 'gather') &&
            spot.grantsMaterial &&
            coopSpec && (
              <div className="dialog-body">
                <div className="dialogue-bubble">
                  {spot.id === 'npc-bua' && (
                    <p>
                      <strong>ป้าบัว:</strong> ยินดีต้อนรับจ้ะหนู {p1.name} และ {p2.name}!
                      คืนนี้มาช่วยกันคนละไม้คนละมือนะ คนหนึ่งเจียนใบตองตานี อีกคนพับกลีบผีเสื้อให้ครบคู่!
                    </p>
                  )}
                  {spot.id === 'npc-man' && (
                    <p>
                      <strong>ลุงมั่น:</strong> ความรักทางไกลต้องใจตรงกันนะลูก!
                      จำลำดับเครื่องหอมมงคลทั้ง 4 ชิ้นแล้วเรียงให้ถูกทั้งสองคน ลุงจะมอบชุดธูปเทียนคู่ให้เลย
                    </p>
                  )}
                  {spot.id === 'gather-lotus' && (
                    <p>
                      ริมสระบัวหิ่งห้อยกำลังเบ่งบานรับแสงจันทร์ ต้องช่วยกันเก็บดอกบัวชมพูที่บานเต็มที่ทั้งฝั่งซ้ายและขวาให้ครบคู่!
                    </p>
                  )}
                </div>

                <CoopChallengePanel
                  spec={coopSpec}
                  progress={state.coopTasks[spot.id]}
                  players={state.players}
                  playMode={playMode}
                  myOnlineRole={myOnlineRole}
                  partnerOnline={partnerOnline}
                  activeLocalPlayer={state.settings.activePlayer}
                  reducedMotion={reducedMotion}
                  soundEnabled={state.settings.soundEnabled}
                  alreadyRewarded={state.inventory[spot.grantsMaterial]}
                  rewardBadgeText={`ทั้งคู่ช่วยกันคว้า "${MATERIAL_LABELS[spot.grantsMaterial].name}" สำเร็จแล้ว!`}
                  lastPartnerSignal={lastPartnerSignal}
                  onSwitchLocalPlayer={(pid) => onSwitchLocalPlayer?.(pid)}
                  onCompleteHalf={(pid, score) =>
                    onRecordCoopHalf(spot.id, pid, score)
                  }
                  onSendSignal={onSendCoopSignal}
                />
              </div>
            )}

          {spot.kind === 'lantern' && coopSpec && (
            <div className="dialog-body">
              <p className="dialogue-bubble">
                โคมยี่เป็งล้านนาต้องอาศัยความสมดุลของทั้งสองคน ช่วยกันประคองไฟเตาซ้าย-ขวาให้ลมร้อนเข้าโซนทองเพื่อส่งคำอธิษฐานขึ้นสู่ฟ้า!
              </p>
              <CoopChallengePanel
                spec={coopSpec}
                progress={state.coopTasks[spot.id]}
                players={state.players}
                playMode={playMode}
                myOnlineRole={myOnlineRole}
                partnerOnline={partnerOnline}
                activeLocalPlayer={state.settings.activePlayer}
                reducedMotion={reducedMotion}
                soundEnabled={state.settings.soundEnabled}
                alreadyRewarded={state.litLanternIds.includes(spot.id)}
                rewardBadgeText="โคมยี่เป็งดวงนี้ถูกจุดส่องสว่างด้วยพลังของทั้งคู่แล้ว!"
                lastPartnerSignal={lastPartnerSignal}
                onSwitchLocalPlayer={(pid) => onSwitchLocalPlayer?.(pid)}
                onCompleteHalf={(pid, score) =>
                  onRecordCoopHalf(spot.id, pid, score)
                }
                onSendSignal={onSendCoopSignal}
              />
            </div>
          )}

          {spot.kind === 'pavilion' && coopSpec && (
            <div className="dialog-body">
              <div className="couple-mini-row">
                <AvatarPreview profile={p1} size={52} />
                <span className="couple-heart" aria-hidden="true">
                  ♥
                </span>
                <AvatarPreview profile={p2} size={52} />
              </div>
              <p className="dialogue-bubble">
                ศาลาไม้ทรงไทยกลางสวนหิ่งห้อยสะท้อนเงาจันทร์เหนือผิวน้ำ{' '}
                {state.pavilionBlessed
                  ? `${p1.name} และ ${p2.name} ได้บรรเลงระฆังคู่รับพรคืนเพ็ญร่วมกันแล้ว`
                  : 'ร่วมกันตีระฆังแสงจันทร์ให้เสียงกังวานสอดประสานกันทั้งสองฝั่ง'}
              </p>
              <CoopChallengePanel
                spec={coopSpec}
                progress={state.coopTasks[spot.id]}
                players={state.players}
                playMode={playMode}
                myOnlineRole={myOnlineRole}
                partnerOnline={partnerOnline}
                activeLocalPlayer={state.settings.activePlayer}
                reducedMotion={reducedMotion}
                soundEnabled={state.settings.soundEnabled}
                alreadyRewarded={state.pavilionBlessed}
                rewardBadgeText="รับคำอวยพรระฆังคู่ประจำคืนเพ็ญเรียบร้อย!"
                lastPartnerSignal={lastPartnerSignal}
                onSwitchLocalPlayer={(pid) => onSwitchLocalPlayer?.(pid)}
                onCompleteHalf={(pid, score) =>
                  onRecordCoopHalf(spot.id, pid, score)
                }
                onSendSignal={onSendCoopSignal}
              />
            </div>
          )}

          {spot.kind === 'craft' && (
            <div className="dialog-body">
              {!allMats ? (
                <div className="missing-materials">
                  <p className="dialogue-bubble">
                    ต้องชวนแฟนช่วยกันเล่นภารกิจเก็บวัสดุให้ครบทั้ง 3 จุดก่อน จึงจะเริ่ม 3 ด่านประดิษฐ์กระทงได้:
                  </p>
                  <ul className="quest-list" role="list">
                    {(Object.keys(MATERIAL_LABELS) as MaterialId[]).map((mat) => (
                      <li key={mat} className={state.inventory[mat] ? 'is-done' : ''}>
                        {state.inventory[mat] ? '✓' : '○'}{' '}
                        <strong>{MATERIAL_LABELS[mat].name}</strong> —{' '}
                        {MATERIAL_LABELS[mat].hint}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <MinigameSuite
                    progress={state.minigames}
                    reducedMotion={reducedMotion}
                    soundEnabled={state.settings.soundEnabled}
                    onCompleteMinigame={onCompleteMinigame}
                    onResetMinigame={onResetMinigame}
                  />

                  <div className="craft-customizer">
                    <div className="craft-preview-box">
                      <KrathongIllustration
                        design={state.krathongDesign}
                        quality={quality}
                        size={140}
                      />
                      <p className="craft-quality-label">
                        ระดับผลงาน: <strong>{quality.tierTitle}</strong>
                      </p>
                    </div>

                    <div className="craft-options">
                      <fieldset className="swatch-fieldset">
                        <legend className="field-label">ฐานกระทง</legend>
                        <div className="chip-grid">
                          {KRATHONG_BASES.map((b) => (
                            <label
                              key={b.id}
                              className="chip-option chip-option--compact"
                            >
                              <input
                                type="radio"
                                name="krathong-base"
                                value={b.id}
                                checked={state.krathongDesign.base === b.id}
                                onChange={() =>
                                  onUpdateKrathongDesign({ base: b.id })
                                }
                                className="visually-hidden"
                              />
                              <span>{b.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset className="swatch-fieldset">
                        <legend className="field-label">ดอกไม้หลัก</legend>
                        <div className="chip-grid">
                          {KRATHONG_FLOWERS.map((f) => (
                            <label
                              key={f.id}
                              className="chip-option chip-option--compact"
                            >
                              <input
                                type="radio"
                                name="krathong-flower"
                                value={f.id}
                                checked={state.krathongDesign.flower === f.id}
                                onChange={() =>
                                  onUpdateKrathongDesign({ flower: f.id })
                                }
                                className="visually-hidden"
                              />
                              <span>{f.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset className="swatch-fieldset">
                        <legend className="field-label">ประกายแสงเทียน</legend>
                        <div className="chip-grid">
                          {KRATHONG_GLOWS.map((g) => (
                            <label
                              key={g.id}
                              className="chip-option chip-option--compact"
                            >
                              <input
                                type="radio"
                                name="krathong-glow"
                                value={g.id}
                                checked={state.krathongDesign.glow === g.id}
                                onChange={() =>
                                  onUpdateKrathongDesign({ glow: g.id })
                                }
                                className="visually-hidden"
                              />
                              <span>{g.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className="field-group">
                        <label htmlFor="couple-wish-input" className="field-label">
                          คำอธิษฐานคู่รักบนกระทง (ซิงก์เห็นพร้อมกันทั้งสองคน)
                        </label>
                        <textarea
                          id="couple-wish-input"
                          className="text-input text-area"
                          rows={2}
                          maxLength={140}
                          value={state.krathongDesign.wishText}
                          onChange={(e) =>
                            onUpdateKrathongDesign({ wishText: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="dialog-actions">
                    {!allMinigamesDone ? (
                      <p className="status-badge">
                        กรุณาผ่านมินิเกมให้ครบทั้ง 3 ด่านก่อนประกอบกระทงขั้นสุดท้าย (ช่วยกันเล่นคนละด่านได้!)
                      </p>
                    ) : state.krathongCrafted ? (
                      <p className="status-badge status-badge--ok">
                        ✓ ประกอบกระทงเสร็จสมบูรณ์แล้ว! เดินจูงมือกันลงไปที่ท่าน้ำแสงจันทร์ได้เลย
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--primary btn--lg"
                        disabled={!canCraftKrathong(state)}
                        onClick={onCraftKrathong}
                      >
                        ประกอบกระทงคู่ให้เสร็จสมบูรณ์
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {spot.kind === 'pier' && (
            <div className="dialog-body">
              {!state.krathongCrafted && state.questStage !== 'released' ? (
                <div className="dialogue-bubble">
                  <p>
                    ท่าน้ำไม้สักส่องประกายรับจันทร์เต็มดวง! กรุณาช่วยกันเก็บวัสดุทั้ง 3 จุด และผ่านมินิเกมประดิษฐ์กระทงทั้ง 3 ด่านที่โต๊ะประดิษฐ์ก่อนนำกระทงมาลอยคู่กันนะ
                  </p>
                </div>
              ) : state.questStage === 'released' && latestReleased ? (
                <div className="keepsake-card">
                  <div className="couple-mini-row">
                    <AvatarPreview profile={p1} size={58} />
                    <KrathongIllustration
                      design={latestReleased.design}
                      quality={latestReleased.quality}
                      size={136}
                    />
                    <AvatarPreview profile={p2} size={58} />
                  </div>
                  <h2 className="keepsake-card__title">
                    ปล่อยกระทงคู่ของ {latestReleased.coupleNames[0]} และ{' '}
                    {latestReleased.coupleNames[1]} สำเร็จ!
                  </h2>
                  <p className="keepsake-card__wish">
                    “{latestReleased.design.wishText}”
                  </p>
                  <div className="keepsake-scores">
                    <span>คุณภาพ: {latestReleased.quality.tierTitle}</span>
                    <span>คะแนนรวมมินิเกม: {latestReleased.quality.totalScore}/300</span>
                    <span>ดอกไม้ระดับ {latestReleased.quality.flowerLevel}/3</span>
                    <span>แสงประกายระดับ {latestReleased.quality.glowLevel}/3</span>
                    <span>โคมที่จุด: {state.litLanternIds.length}/3 ดวง</span>
                  </div>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={handleClose}
                    >
                      ชมกระทงลอยคู่กันในแม่น้ำ
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => {
                        onStartAnother();
                        handleClose();
                      }}
                    >
                      ประดิษฐ์กระทงใบใหม่ร่วมกัน
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ceremony-ready">
                  <div className="couple-mini-row">
                    <AvatarPreview profile={p1} size={56} />
                    <KrathongIllustration
                      design={state.krathongDesign}
                      quality={quality}
                      size={136}
                    />
                    <AvatarPreview profile={p2} size={56} />
                  </div>
                  <p className="dialogue-bubble">
                    {p1.name} และ {p2.name} ประคองกระทงระดับ{' '}
                    <strong>{quality.tierTitle}</strong> (คะแนน {quality.totalScore}/300)
                    ที่ปลายสะพานท่าน้ำแสงจันทร์ พร้อมตั้งจิตอธิษฐานร่วมกัน: “
                    {state.krathongDesign.wishText}”
                  </p>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--lg"
                      onClick={onReleaseKrathong}
                    >
                      🌊 ทำพิธีปล่อยกระทงลงสู่สายน้ำคู่กัน
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
