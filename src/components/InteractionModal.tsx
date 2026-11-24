import { useEffect, useRef } from 'react';
import {
  KRATHONG_BASES,
  KRATHONG_FLOWERS,
  KRATHONG_GLOWS,
} from '../domain/customizationCatalog';
import { areAllMinigamesPassed, computeKrathongQuality } from '../domain/minigames';
import { MATERIAL_LABELS, canCraftKrathong, hasAllMaterials } from '../domain/reducer';
import { getSpotById } from '../domain/worldMap';
import type {
  GameState,
  KrathongDesign,
  MaterialId,
  MinigameId,
} from '../domain/types';
import { AvatarPreview } from './AvatarPreview';
import { KrathongIllustration } from './KrathongIllustration';
import { MinigameSuite } from './MinigameSuite';

interface InteractionModalProps {
  spotId: string | null;
  state: GameState;
  reducedMotion: boolean;
  onClose: () => void;
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
  reducedMotion,
  onClose,
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
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const spot = getSpotById(spotId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (spot) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal?.();
      }
    } else if (dialog.open) {
      dialog.close?.();
      previousFocusRef.current?.focus();
    }
  }, [spot]);

  const handleClose = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close?.();
    }
    onClose();
    previousFocusRef.current?.focus();
  };

  const p1 = state.players.p1;
  const p2 = state.players.p2;
  const quality = computeKrathongQuality(state.minigames);
  const allMats = hasAllMaterials(state.inventory);
  const allMinigamesDone = areAllMinigamesPassed(state.minigames);
  const latestReleased =
    state.releasedKrathongs[state.releasedKrathongs.length - 1] ?? null;

  return (
    <dialog
      ref={dialogRef}
      className="festival-dialog"
      aria-labelledby="modal-spot-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
    >
      {spot && (
        <div className="festival-dialog__content">
          <header className="festival-dialog__header">
            <div>
              <p className="festival-dialog__zone">{spot.zoneName}</p>
              <h2 id="modal-spot-title" className="festival-dialog__title">
                {spot.title}
              </h2>
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

          {(spot.kind === 'npc' || spot.kind === 'gather') && spot.grantsMaterial && (
            <div className="dialog-body">
              <div className="dialogue-bubble">
                {spot.id === 'npc-bua' && (
                  <p>
                    <strong>ป้าบัว:</strong> ยินดีต้อนรับจ้ะหนู {p1.name} และ {p2.name}!
                    คืนนี้พระจันทร์เต็มดวงสวยมาก ป้าคัดใบตองตานีสดและหยวกกล้วยอย่างดีไว้ให้คู่รักแล้วนะ
                  </p>
                )}
                {spot.id === 'npc-man' && (
                  <p>
                    <strong>ลุงมั่น:</strong> ขอให้ทั้งคู่ครองรักมั่นคงเหมือนแสงเทียนนะลูก
                    ลุงจัดธูป 3 ดอก เทียนหอม และสายสิญจน์มงคลไว้ให้เรียบร้อยแล้ว
                  </p>
                )}
                {spot.id === 'gather-lotus' && (
                  <p>
                    ริมสระบัวหิ่งห้อยกำลังเบ่งบานเต็มที่ ดอกบัวชมพูคู่และกลีบดอกไม้หอมเหมาะสำหรับทำกระทงคู่รักมาก
                  </p>
                )}
              </div>

              <div className="dialog-actions">
                {state.inventory[spot.grantsMaterial] ? (
                  <p className="status-badge status-badge--ok">
                    ✓ ได้รับ {MATERIAL_LABELS[spot.grantsMaterial].name} แล้ว
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() =>
                      onCollectMaterial(
                        spot.grantsMaterial!,
                        `รับ${MATERIAL_LABELS[spot.grantsMaterial!].name}จาก${spot.title}เรียบร้อย`
                      )
                    }
                  >
                    เก็บ{MATERIAL_LABELS[spot.grantsMaterial].name}
                  </button>
                )}
              </div>
            </div>
          )}

          {spot.kind === 'lantern' && (
            <div className="dialog-body">
              <p className="dialogue-bubble">
                โคมยี่เป็งส่องสว่างนำทางให้ความรักสดใสตลอดริมน้ำ สามารถจุดร่วมกันเพื่อเพิ่มแสงอบอุ่นให้ลานงาน
              </p>
              <div className="dialog-actions">
                {state.litLanternIds.includes(spot.id) ? (
                  <p className="status-badge status-badge--ok">
                    ✓ โคมดวงนี้ถูกจุดส่องสว่างแล้ว
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => onLightLantern(spot.id)}
                  >
                    จุดโคมยี่เป็งคู่กัน
                  </button>
                )}
              </div>
            </div>
          )}

          {spot.kind === 'pavilion' && (
            <div className="dialog-body">
              <div className="couple-mini-row">
                <AvatarPreview profile={p1} size={52} />
                <span className="couple-heart" aria-hidden="true">♥</span>
                <AvatarPreview profile={p2} size={52} />
              </div>
              <p className="dialogue-bubble">
                ศาลาไม้กลางสวนหิ่งห้อยเงียบสงบ ลมพัดเย็นพร้อมกลิ่นดอกบัว{' '}
                {state.pavilionBlessed
                  ? `${p1.name} และ ${p2.name} ได้ตั้งจิตอธิษฐานความสุขร่วมกันที่นี่แล้ว`
                  : 'เหมาะสำหรับหยุดพักและกล่าวคำอวยพรร่วมกัน'}
              </p>
              <div className="dialog-actions">
                {state.pavilionBlessed ? (
                  <p className="status-badge status-badge--ok">
                    ✓ รับคำอวยพรประจำคืนเพ็ญเรียบร้อย
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={onBlessPavilion}
                  >
                    อธิษฐานคู่กันที่ศาลา
                  </button>
                )}
              </div>
            </div>
          )}

          {spot.kind === 'craft' && (
            <div className="dialog-body">
              {!allMats ? (
                <div className="missing-materials">
                  <p className="dialogue-bubble">
                    ต้องรวบรวมวัสดุให้ครบ 3 อย่างก่อนจึงจะเริ่ม 3 ด่านประดิษฐ์กระทงได้:
                  </p>
                  <ul className="quest-list" role="list">
                    {(Object.keys(MATERIAL_LABELS) as MaterialId[]).map((mat) => (
                      <li key={mat} className={state.inventory[mat] ? 'is-done' : ''}>
                        {state.inventory[mat] ? '✓' : '○'}{' '}
                        <strong>{MATERIAL_LABELS[mat].name}</strong> — {MATERIAL_LABELS[mat].hint}
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
                            <label key={b.id} className="chip-option chip-option--compact">
                              <input
                                type="radio"
                                name="krathong-base"
                                value={b.id}
                                checked={state.krathongDesign.base === b.id}
                                onChange={() => onUpdateKrathongDesign({ base: b.id })}
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
                            <label key={f.id} className="chip-option chip-option--compact">
                              <input
                                type="radio"
                                name="krathong-flower"
                                value={f.id}
                                checked={state.krathongDesign.flower === f.id}
                                onChange={() => onUpdateKrathongDesign({ flower: f.id })}
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
                            <label key={g.id} className="chip-option chip-option--compact">
                              <input
                                type="radio"
                                name="krathong-glow"
                                value={g.id}
                                checked={state.krathongDesign.glow === g.id}
                                onChange={() => onUpdateKrathongDesign({ glow: g.id })}
                                className="visually-hidden"
                              />
                              <span>{g.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className="field-group">
                        <label htmlFor="couple-wish-input" className="field-label">
                          คำอธิษฐานคู่รักบนกระทง
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
                        กรุณาผ่านมินิเกมให้ครบทั้ง 3 ด่านก่อนประกอบกระทงขั้นสุดท้าย
                      </p>
                    ) : state.krathongCrafted ? (
                      <p className="status-badge status-badge--ok">
                        ✓ ประกอบกระทงเสร็จสมบูรณ์แล้ว! เดินลงไปที่ท่าน้ำแสงจันทร์ได้เลย
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
                    แสงจันทร์ส่องผิวน้ำสวยงามมาก! กรุณาเก็บวัสดุให้ครบและผ่านมินิเกมประดิษฐ์กระทงทั้ง 3 ด่านที่โต๊ะประดิษฐ์กระทงก่อนนำมาปล่อยนะ
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
                  <h3 className="keepsake-card__title">
                    ปล่อยกระทงคู่ของ {latestReleased.coupleNames[0]} และ{' '}
                    {latestReleased.coupleNames[1]} สำเร็จ!
                  </h3>
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
                      ชมกระทงลอยในแม่น้ำ
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => {
                        onStartAnother();
                        handleClose();
                      }}
                    >
                      ประดิษฐ์กระทงใบใหม่
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
                    {p1.name} และ {p2.name} ถือกระทงระดับ{' '}
                    <strong>{quality.tierTitle}</strong> (คะแนน {quality.totalScore}/300)
                    พร้อมตั้งจิตขอขมาพระแม่คงคา: “{state.krathongDesign.wishText}”
                  </p>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--lg"
                      onClick={onReleaseKrathong}
                    >
                      ทำพิธีปล่อยกระทงลงสู่สายน้ำคู่กัน
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