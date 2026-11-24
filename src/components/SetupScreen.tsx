import { useId, useState, type ChangeEvent } from 'react';
import {
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFITS,
  SKIN_TONES,
} from '../domain/customizationCatalog';
import type {
  GameState,
  PlayerCustomization,
  PlayerId,
  PlayerProfile,
  ReducedMotionPreference,
} from '../domain/types';
import { processPortraitFileLocally } from '../persistence/storage';
import { AvatarPreview } from './AvatarPreview';

export type WorldAssetStatus = 'loading' | 'ready' | 'error';

interface SetupScreenProps {
  state: GameState;
  worldAssetStatus?: WorldAssetStatus;
  onRetryWorldAssets?: () => void;
  onUpdateName: (playerId: PlayerId, name: string) => void;
  onUpdateCustomization: (
    playerId: PlayerId,
    patch: Partial<PlayerCustomization>
  ) => void;
  onPortraitProcessed: (
    playerId: PlayerId,
    portrait: PlayerProfile['portrait'],
    blob: Blob | null
  ) => void;
  onClearPortrait: (playerId: PlayerId) => void;
  onSetReducedMotion: (mode: ReducedMotionPreference) => void;
  onStartFestival: () => void;
  onRequestReset: () => void;
}

interface PlayerEditorProps {
  profile: PlayerProfile;
  labelTitle: string;
  onUpdateName: (playerId: PlayerId, name: string) => void;
  onUpdateCustomization: (
    playerId: PlayerId,
    patch: Partial<PlayerCustomization>
  ) => void;
  onPortraitProcessed: (
    playerId: PlayerId,
    portrait: PlayerProfile['portrait'],
    blob: Blob | null
  ) => void;
  onClearPortrait: (playerId: PlayerId) => void;
}

function PlayerEditorCard({
  profile,
  labelTitle,
  onUpdateName,
  onUpdateCustomization,
  onPortraitProcessed,
  onClearPortrait,
}: PlayerEditorProps) {
  const uid = useId();
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const nameInputId = `${uid}-name`;
  const fileInputId = `${uid}-photo`;
  const fileHelpId = `${uid}-photo-help`;
  const fileErrorId = `${uid}-photo-err`;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    setProcessingPhoto(true);
    try {
      const result = await processPortraitFileLocally(file);
      onPortraitProcessed(profile.id, result.portrait, result.blob);
    } finally {
      setProcessingPhoto(false);
    }
  };

  return (
    <section
      className={`setup-card setup-card--${profile.id}`}
      aria-labelledby={`${uid}-heading`}
    >
      <div className="setup-card__header">
        <AvatarPreview profile={profile} size={76} />
        <div className="setup-card__title-group">
          <h2 id={`${uid}-heading`} className="setup-card__heading">
            {labelTitle}
          </h2>
          <p className="setup-card__sub">
            {profile.portrait.status === 'ready'
              ? 'กำลังใช้รูปใบหน้าส่วนตัว (เก็บในเครื่องนี้เท่านั้น)'
              : 'กำลังใช้ตัวละครอวตารปรับแต่งเอง'}
          </p>
        </div>
      </div>

      <div className="field-group">
        <label htmlFor={nameInputId} className="field-label">
          ชื่อตัวละคร
        </label>
        <input
          id={nameInputId}
          name={`player-name-${profile.id}`}
          type="text"
          className="text-input"
          value={profile.name}
          maxLength={24}
          placeholder={profile.id === 'p1' ? 'เช่น ฟ้าใส' : 'เช่น ต้นกล้า'}
          enterKeyHint="done"
          onChange={(e) => onUpdateName(profile.id, e.target.value)}
        />
      </div>

      <div className="field-group">
        <label htmlFor={fileInputId} className="field-label">
          รูปใบหน้า (เลือกจากเครื่อง — ไม่มีการอัปโหลด)
        </label>
        <p id={fileHelpId} className="field-hint">
          รองรับไฟล์ JPG, PNG, WebP หรือ GIF ไม่เกิน 10 MB เก็บเฉพาะในเบราว์เซอร์นี้
        </p>
        <div className="photo-controls">
          <input
            id={fileInputId}
            name={`portrait-${profile.id}`}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="file-input-native"
            aria-describedby={
              profile.portrait.error
                ? `${fileHelpId} ${fileErrorId}`
                : fileHelpId
            }
            aria-invalid={profile.portrait.status === 'invalid' ? 'true' : undefined}
            onChange={handleFileChange}
            disabled={processingPhoto}
          />
          {profile.portrait.status === 'ready' && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => onClearPortrait(profile.id)}
            >
              ลบรูป ใช้ตัวละครอวตาร
            </button>
          )}
        </div>
        {processingPhoto && (
          <p className="field-status" role="status">
            กำลังปรับขนาดรูปในเครื่อง...
          </p>
        )}
        {profile.portrait.error && (
          <p id={fileErrorId} className="field-error" role="status">
            {profile.portrait.error}
          </p>
        )}
      </div>

      <fieldset className="swatch-fieldset">
        <legend className="field-label">สีผิว</legend>
        <div className="swatch-grid">
          {SKIN_TONES.map((tone) => {
            const checked = profile.customization.skinTone === tone.id;
            return (
              <label key={tone.id} className="swatch-option">
                <input
                  type="radio"
                  name={`skin-${profile.id}`}
                  value={tone.id}
                  checked={checked}
                  onChange={() =>
                    onUpdateCustomization(profile.id, { skinTone: tone.id })
                  }
                  className="visually-hidden"
                />
                <span
                  className="swatch-dot"
                  style={{ backgroundColor: tone.color }}
                  aria-hidden="true"
                />
                <span className="swatch-text">{tone.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="swatch-fieldset">
        <legend className="field-label">ทรงผม</legend>
        <div className="chip-grid">
          {HAIR_STYLES.map((style) => {
            const checked = profile.customization.hairStyle === style.id;
            return (
              <label key={style.id} className="chip-option">
                <input
                  type="radio"
                  name={`hair-style-${profile.id}`}
                  value={style.id}
                  checked={checked}
                  onChange={() =>
                    onUpdateCustomization(profile.id, { hairStyle: style.id })
                  }
                  className="visually-hidden"
                />
                <span>{style.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="swatch-fieldset">
        <legend className="field-label">สีผม</legend>
        <div className="swatch-grid">
          {HAIR_COLORS.map((hc) => {
            const checked = profile.customization.hairColor === hc.id;
            return (
              <label key={hc.id} className="swatch-option">
                <input
                  type="radio"
                  name={`hair-color-${profile.id}`}
                  value={hc.id}
                  checked={checked}
                  onChange={() =>
                    onUpdateCustomization(profile.id, { hairColor: hc.id })
                  }
                  className="visually-hidden"
                />
                <span
                  className="swatch-dot"
                  style={{ backgroundColor: hc.color }}
                  aria-hidden="true"
                />
                <span className="swatch-text">{hc.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="swatch-fieldset">
        <legend className="field-label">ชุดไทยร่วมสมัย</legend>
        <div className="chip-grid">
          {OUTFITS.map((outfit) => {
            const checked = profile.customization.outfit === outfit.id;
            return (
              <label key={outfit.id} className="chip-option">
                <input
                  type="radio"
                  name={`outfit-${profile.id}`}
                  value={outfit.id}
                  checked={checked}
                  onChange={() =>
                    onUpdateCustomization(profile.id, { outfit: outfit.id })
                  }
                  className="visually-hidden"
                />
                <span
                  className="swatch-dot"
                  style={{ backgroundColor: outfit.color }}
                  aria-hidden="true"
                />
                <span>{outfit.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}

export function SetupScreen({
  state,
  worldAssetStatus = 'ready',
  onRetryWorldAssets,
  onUpdateName,
  onUpdateCustomization,
  onPortraitProcessed,
  onClearPortrait,
  onSetReducedMotion,
  onStartFestival,
  onRequestReset,
}: SetupScreenProps) {
  return (
    <main className="setup-page" id="main-content">
      <header className="setup-hero">
        <p className="setup-hero__eyebrow">เทศกาลลอยกระทงคู่รัก · ออฟไลน์ 100% บนเครื่องคุณ</p>
        <h1 className="setup-hero__title">คืนเพ็ญริมน้ำ: ลอยกระทงใต้แสงจันทร์</h1>
        <p className="setup-hero__desc">
          สร้างตัวละครคู่รัก เดินสำรวจตลาดริมคลอง จุดโคมยี่เป็ง ผ่านมินิเกมประดิษฐ์กระทง 3 ด่าน
          แล้วปล่อยกระทงลงสู่สายน้ำพร้อมคำอธิษฐานร่วมกัน (เล่นด้วยกันบนเครื่องเดียวหรือสลับมือได้)
        </p>

        <div className="setup-motion-bar">
          <fieldset className="motion-fieldset">
            <legend className="motion-legend">โหมดการเคลื่อนไหว (Reduced Motion)</legend>
            <div className="chip-grid">
              {(
                [
                  { id: 'system', label: 'ตามระบบเครื่อง' },
                  { id: 'reduce', label: 'ลดการเคลื่อนไหว' },
                  { id: 'no-preference', label: 'เต็มรูปแบบ' },
                ] as const
              ).map((opt) => (
                <label key={opt.id} className="chip-option chip-option--compact">
                  <input
                    type="radio"
                    name="reduced-motion-mode"
                    value={opt.id}
                    checked={state.settings.reducedMotionOverride === opt.id}
                    onChange={() => onSetReducedMotion(opt.id)}
                    className="visually-hidden"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </header>

      <div className="setup-grid">
        <PlayerEditorCard
          profile={state.players.p1}
          labelTitle="ตัวละครที่ 1 (เดินด้วย WASD หรือแท็บ P1)"
          onUpdateName={onUpdateName}
          onUpdateCustomization={onUpdateCustomization}
          onPortraitProcessed={onPortraitProcessed}
          onClearPortrait={onClearPortrait}
        />
        <PlayerEditorCard
          profile={state.players.p2}
          labelTitle="ตัวละครที่ 2 (เดินด้วยลูกศร หรือแท็บ P2)"
          onUpdateName={onUpdateName}
          onUpdateCustomization={onUpdateCustomization}
          onPortraitProcessed={onPortraitProcessed}
          onClearPortrait={onClearPortrait}
        />
      </div>

      {worldAssetStatus === 'error' && (
        <div className="asset-error-banner" role="alert">
          <p>
            <strong>ยังเตรียมฉากงานลอยกระทงไม่สำเร็จ:</strong>{' '}
            การเชื่อมต่อขาดหายก่อนโหลดทรัพยากรฉากครบ กรุณาเชื่อมต่อเครือข่ายแล้วกดลองใหม่
          </p>
          {onRetryWorldAssets && (
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={onRetryWorldAssets}
              >
                ลองโหลดฉากอีกครั้ง
              </button>
            </div>
          )}
        </div>
      )}

      <footer className="setup-actions">
        {worldAssetStatus === 'loading' && (
          <div className="setup-preload-status">
            <progress
              className="minigame-progress"
              aria-label="กำลังเตรียมฉากงานลอยกระทงสำหรับเล่นออฟไลน์"
            />
            <span className="field-hint">
              กำลังเตรียมฉากริมน้ำเพื่อให้พร้อมเล่นแม้ตัดเน็ต...
            </span>
          </div>
        )}
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={worldAssetStatus !== 'ready'}
          onClick={onStartFestival}
        >
          {worldAssetStatus === 'loading'
            ? 'กำลังเตรียมฉากงานลอยกระทง...'
            : 'เข้าสู่งานลอยกระทงคู่กัน'}
        </button>
        <button
          type="button"
          className="btn btn--danger-outline"
          onClick={onRequestReset}
        >
          รีเซ็ตข้อมูลทั้งหมด
        </button>
      </footer>
    </main>
  );
}