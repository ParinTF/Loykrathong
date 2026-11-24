import { useId, useState, type ChangeEvent } from 'react';
import {
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFITS,
  SKIN_TONES,
} from '../domain/customizationCatalog';
import { LANDMARK_ASSETS } from '../domain/landmarks';
import { computeKrathongQuality } from '../domain/minigames';
import type {
  GameState,
  PlayMode,
  PlayerCustomization,
  PlayerId,
  PlayerProfile,
  ReducedMotionPreference,
} from '../domain/types';
import {
  buildRoomInviteUrl,
  normalizeRoomCodeInput,
  type RoomConnectionStatus,
  type RoomOccupancy,
} from '../online/roomClient';
import { processPortraitFileLocally } from '../persistence/storage';
import { AvatarPreview } from './AvatarPreview';
import { KrathongIllustration } from './KrathongIllustration';

export type WorldAssetStatus = 'loading' | 'ready' | 'error';

interface SetupScreenProps {
  state: GameState;
  playMode?: PlayMode;
  roomCode?: string;
  myOnlineRole?: PlayerId;
  roomStatus?: RoomConnectionStatus;
  roomError?: string | null;
  occupancy?: RoomOccupancy;
  worldAssetStatus?: WorldAssetStatus;
  onRetryWorldAssets?: () => void;
  onChangePlayMode?: (mode: PlayMode) => void;
  onChangeRoomCode?: (code: string) => void;
  onGenerateNewRoom?: () => void;
  onConnectOnlineRoom?: (code: string, preferredRole: PlayerId) => void;
  onDisconnectOnlineRoom?: () => void;
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
  badgeText?: string;
  readOnlyPartner?: boolean;
  partnerConnected?: boolean;
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

const FEATURE_HIGHLIGHTS = [
  {
    icon: '🏯',
    tag: '360° Full 3D World',
    title: 'โลกงานวัดริมน้ำ 3 มิติ หมุนกล้องอิสระ',
    desc: 'เดินขึ้นสะพานไม้สัก ก้าวเข้าศาลาไทยจัตุรมุขหลังคาซ้อน 3 ชั้น ชมโคมลอยยี่เป็งลอยเต็มท้องฟ้าและแสงจันทร์สะท้อนผิวน้ำแบบ 360°',
  },
  {
    icon: '💞',
    tag: 'Long-Distance Couple Co-op',
    title: 'อยู่ไกลกันแค่ไหน ก็เดินข้างกันได้สดๆ',
    desc: 'สร้างห้องส่วนตัวแล้วส่งลิงก์เดียวให้แฟนคลิกเข้าห้อง เห็นตัวละครและรูปหน้ากันแบบเรียลไทม์ ส่งหัวใจลอยบนหัว และวาร์ปไปหาแฟนได้ทันที',
  },
  {
    icon: '🤝',
    tag: 'True 2-Player Challenges',
    title: 'ภารกิจคู่รักที่ต้องช่วยกันเล่นทั้ง 2 คน',
    desc: 'เปลี่ยนอีเวนต์กดผ่านๆ เป็นมินิเกมประสานมือทั้งพายเรือเก็บบัวบาน เจียนพับใบตอง จำสูตรเครื่องหอม ตีระฆังคู่ และประคองไฟปล่อยโคมลอย',
  },
  {
    icon: '🕯️',
    tag: '3-Stage Arcade Crafting',
    title: 'ประดิษฐ์กระทง 3 ด่านแอ็กชัน & การ์ดที่ระลึก',
    desc: 'กะจังหวะช้อนยอดวัสดุกลางสายน้ำ เล็งวางชั้นกระทงให้ตรงแกนทอง ตีจังหวะแสงเทียน แล้วปล่อยกระทง 3 มิติลงสู่แม่น้ำพร้อมคำอธิษฐานคู่',
  },
] as const;

const SKY_LANTERN_DECORS = [
  { left: '8%', top: '18%', size: 'lg', delay: '0s' },
  { left: '22%', top: '62%', size: 'sm', delay: '1.8s' },
  { left: '46%', top: '14%', size: 'md', delay: '0.9s' },
  { left: '68%', top: '24%', size: 'sm', delay: '2.6s' },
  { left: '86%', top: '16%', size: 'lg', delay: '1.2s' },
  { left: '91%', top: '58%', size: 'md', delay: '3.1s' },
] as const;

function PlayerEditorCard({
  profile,
  labelTitle,
  badgeText,
  readOnlyPartner = false,
  partnerConnected = false,
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

  if (readOnlyPartner) {
    return (
      <section
        className={`setup-card setup-card--${profile.id} setup-card--partner-live`}
        aria-labelledby={`${uid}-heading`}
      >
        <div className="setup-card__header">
          <AvatarPreview profile={profile} size={76} />
          <div className="setup-card__title-group">
            <span
              className={`online-presence-pill ${
                partnerConnected ? 'is-online' : 'is-waiting'
              }`}
            >
              {partnerConnected ? '● แฟนเชื่อมต่ออยู่ในห้องแล้ว!' : '○ กำลังรอแฟนเข้าห้อง...'}
            </span>
            <h3 id={`${uid}-heading`} className="setup-card__heading">
              {labelTitle}
            </h3>
            <p className="setup-card__sub">
              ชื่อปัจจุบัน: <strong>{profile.name}</strong>
            </p>
          </div>
        </div>
        <div className="dialogue-bubble">
          <p>
            {partnerConnected
              ? `${profile.name} แต่งตัวพร้อมเดินเที่ยวงานลอยกระทง 3D คู่กับคุณแล้ว! กด "เข้าสู่งานลอยกระทงคู่กัน" ด้านล่างได้เลย`
              : 'คัดลอกลิงก์ชวนแฟนส่งทางแชต เมื่อแฟนเปิดลิงก์จะเข้ามาเป็นตัวละครฝั่งนี้แบบเรียลไทม์ทันที (หรือเข้างานไปเดินรอก่อนก็ได้!)'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`setup-card setup-card--${profile.id}`}
      aria-labelledby={`${uid}-heading`}
    >
      <div className="setup-card__header">
        <AvatarPreview profile={profile} size={76} />
        <div className="setup-card__title-group">
          {badgeText && <span className="online-presence-pill is-online">{badgeText}</span>}
          <h3 id={`${uid}-heading`} className="setup-card__heading">
            {labelTitle}
          </h3>
          <p className="setup-card__sub">
            {profile.portrait.status === 'ready'
              ? 'กำลังใช้รูปใบหน้าส่วนตัว'
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
          รูปใบหน้า (เลือกจากเครื่อง)
        </label>
        <p id={fileHelpId} className="field-hint">
          รองรับไฟล์ JPG, PNG, WebP หรือ GIF ไม่เกิน 10 MB ย่อขนาดในเครื่องอัตโนมัติ
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
  playMode = 'local',
  roomCode = '',
  myOnlineRole = 'p1',
  roomStatus = 'disconnected',
  roomError = null,
  occupancy = { p1: false, p2: false },
  worldAssetStatus = 'ready',
  onRetryWorldAssets,
  onChangePlayMode,
  onChangeRoomCode,
  onGenerateNewRoom,
  onConnectOnlineRoom,
  onDisconnectOnlineRoom,
  onUpdateName,
  onUpdateCustomization,
  onPortraitProcessed,
  onClearPortrait,
  onSetReducedMotion,
  onStartFestival,
  onRequestReset,
}: SetupScreenProps) {
  const roomInputId = useId();
  const [preferredSlot, setPreferredSlot] = useState<PlayerId>(myOnlineRole);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [ambientPaused, setAmbientPaused] = useState(false);

  const partnerRole: PlayerId = myOnlineRole === 'p1' ? 'p2' : 'p1';
  const partnerConnected = occupancy[partnerRole];
  const inviteUrl = roomCode ? buildRoomInviteUrl(roomCode) : '';
  const previewQuality = computeKrathongQuality(state.minigames);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedNotice('คัดลอกลิงก์ชวนแฟนเรียบร้อย! ส่งให้แฟนทางแชตได้เลย');
    } catch {
      setCopiedNotice(`ส่งลิงก์นี้ให้แฟน: ${inviteUrl}`);
    }
    window.setTimeout(() => setCopiedNotice(null), 4000);
  };

  const landmarkGallery = [
    { ...LANDMARK_ASSETS.sala, zoneTag: 'สวนหิ่งห้อย · ศาลาคู่รัก 3D' },
    { ...LANDMARK_ASSETS.yipeng, zoneTag: 'ลานโคมยี่เป็ง · โคมลอยเต็มฟ้า' },
    { ...LANDMARK_ASSETS.market, zoneTag: 'ตลาดริมคลอง · ซุ้มป้าบัว & ลุงมั่น' },
    { ...LANDMARK_ASSETS.sukhothai, zoneTag: 'ลานกลางงาน · โต๊ะประดิษฐ์ 3 ด่าน' },
    { ...LANDMARK_ASSETS.lotus, zoneTag: 'แปลงบัวริมตลิ่ง · พายเรือเก็บบัวคู่' },
    { ...LANDMARK_ASSETS.river, zoneTag: 'ท่าน้ำแสงจันทร์ · พิธีลอยกระทงคู่' },
  ];

  return (
    <div
      className="landing-wrapper"
      data-ambient-paused={ambientPaused ? 'true' : 'false'}
    >
      {/* Sticky Translucent Moonlight Navbar */}
      <header className="landing-topbar">
        <div className="landing-topbar__inner">
          <a href="#main-content" className="landing-brand">
            <span className="landing-brand__lotus" aria-hidden="true">
              🪷
            </span>
            <span>คืนเพ็ญริมน้ำ 3D</span>
          </a>

          <nav className="landing-nav" aria-label="เมนูหลักหน้าแรก">
            <a href="#highlights" className="landing-nav__link">
              จุดเด่น 3D
            </a>
            <a href="#landmarks" className="landing-nav__link">
              สถานที่จริงต้นแบบ
            </a>
            <a href="#online-room" className="landing-nav__link">
              เล่นออนไลน์กับแฟน
            </a>
            <a href="#couple-studio" className="landing-nav__link">
              แต่งตัวคู่รัก
            </a>
          </nav>

          <button
            type="button"
            className="btn btn--primary btn--sm landing-topbar__cta"
            disabled={worldAssetStatus !== 'ready'}
            onClick={onStartFestival}
          >
            {worldAssetStatus === 'loading' ? 'กำลังโหลด 3D...' : 'เข้าสู่งาน 3D →'}
          </button>
        </div>
      </header>

      <main className="landing-main" id="main-content">
        {/* ===============================================================
            HERO LANDING SECTION
           =============================================================== */}
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          {/* Decorative Full Moon & Floating Sky Lantern Backdrop */}
          <div className="landing-hero__sky" aria-hidden="true">
            <div className="landing-moon" />
            {SKY_LANTERN_DECORS.map((item, idx) => (
              <span
                key={idx}
                className={`sky-lantern-float sky-lantern-float--${item.size}`}
                style={{
                  insetInlineStart: item.left,
                  insetBlockStart: item.top,
                  animationDelay: item.delay,
                }}
              >
                🏮
              </span>
            ))}
          </div>

          <div className="landing-hero__grid">
            <div className="landing-hero__content">
              <div className="landing-eyebrow-row">
                <span className="landing-pill-badge">
                  🌕 เทศกาลลอยกระทงคู่รัก 3 มิติ · Online Co-op
                </span>
                <button
                  type="button"
                  className="btn btn--sm landing-ambient-btn"
                  onClick={() => setAmbientPaused((prev) => !prev)}
                >
                  {ambientPaused ? '▶ เล่นเอฟเฟกต์โคมลอย' : '⏸ พักเอฟเฟกต์โคมลอย'}
                </button>
              </div>

              <h1 id="landing-hero-title" className="landing-hero__title">
                คืนเพ็ญริมน้ำ 3D: ลอยกระทงใต้แสงจันทร์เคียงข้างกัน{' '}
                <span className="landing-hero__title-accent">
                  แม้ในวันที่อยู่ไกล
                </span>
              </h1>

              <p className="landing-hero__lead">
                เปลี่ยนคืนวันเพ็ญให้เป็นเดตสุดพิเศษในโลก 3 มิติ หมุนมุมกล้องชมโคมลอยยี่เป็งเต็มฟ้า
                เดินจูงมือแวะศาลาไทยจัตุรมุข ช่วยกันพิชิตมินิเกมคู่รัก ประดิษฐ์กระทง 3 ด่าน
                และอธิษฐานลอยกระทงลงสู่สายน้ำพร้อมกันแบบเรียลไทม์
              </p>

              <div className="landing-hero__cta-row">
                <button
                  type="button"
                  className="btn btn--primary btn--lg landing-cta-glow"
                  onClick={() => {
                    onChangePlayMode?.('online');
                    scrollToSection('online-room');
                  }}
                >
                  🌐 เปิดห้องออนไลน์ชวนแฟน
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--lg"
                  onClick={() => scrollToSection('couple-studio')}
                >
                  🎨 แต่งตัวละครคู่รัก
                </button>
              </div>

              <dl className="landing-stats">
                <div className="landing-stats__item">
                  <dt>มุมมองโลก 3D</dt>
                  <dd>360°</dd>
                </div>
                <div className="landing-stats__item">
                  <dt>มินิเกมคู่รักช่วยกัน</dt>
                  <dd>8 ด่าน</dd>
                </div>
                <div className="landing-stats__item">
                  <dt>ชวนแฟนเข้าห้อง</dt>
                  <dd>1 ลิงก์</dd>
                </div>
              </dl>
            </div>

            <div className="landing-hero__showcase">
              <figure className="hero-postcard">
                <img
                  src={LANDMARK_ASSETS.sala.imagePath}
                  alt={LANDMARK_ASSETS.sala.alt}
                  width={640}
                  height={400}
                  fetchPriority="high"
                  className="hero-postcard__img"
                />
                <figcaption className="hero-postcard__caption">
                  <span>✨ สถานที่ต้นแบบในฉาก 3D: {LANDMARK_ASSETS.sala.placeTitle}</span>
                </figcaption>
              </figure>

              <div
                className="hero-couple-dock"
                aria-label="ตัวอย่างคู่รักและกระทงปัจจุบัน"
              >
                <div className="hero-couple-dock__avatars">
                  <AvatarPreview profile={state.players.p1} size={56} />
                  <span className="couple-heart" aria-hidden="true">
                    ♥
                  </span>
                  <AvatarPreview profile={state.players.p2} size={56} />
                </div>
                <div className="hero-couple-dock__info">
                  <strong>
                    {state.players.p1.name || 'ฟ้าใส'} &amp;{' '}
                    {state.players.p2.name || 'ต้นกล้า'}
                  </strong>
                  <span>พร้อมออกเดินเที่ยวคืนวันเพ็ญ</span>
                </div>
                <KrathongIllustration
                  design={state.krathongDesign}
                  quality={previewQuality}
                  size={84}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ===============================================================
            SECTION 2: 4 ROMANTIC COUPLE HIGHLIGHTS
           =============================================================== */}
        <section
          id="highlights"
          className="landing-section"
          aria-labelledby="highlights-heading"
        >
          <header className="landing-section__header">
            <p className="landing-section__eyebrow">ประสบการณ์เดตออนไลน์ในคืนวันเพ็ญ</p>
            <h2 id="highlights-heading" className="landing-section__title">
              4 โมเมนต์พิเศษที่ออกแบบมาเพื่อคู่รักโดยเฉพาะ
            </h2>
          </header>

          <div className="feature-cards-grid">
            {FEATURE_HIGHLIGHTS.map((feat) => (
              <article key={feat.title} className="feature-card">
                <header className="feature-card__header">
                  <span className="feature-card__icon" aria-hidden="true">
                    {feat.icon}
                  </span>
                  <span className="feature-card__tag">{feat.tag}</span>
                  <h3 className="feature-card__title">{feat.title}</h3>
                </header>
                <p className="feature-card__desc">{feat.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ===============================================================
            SECTION 3: REAL-PLACE THAI FESTIVAL INSPIRATION GALLERY
           =============================================================== */}
        <section
          id="landmarks"
          className="landing-section"
          aria-labelledby="landmarks-heading"
        >
          <header className="landing-section__header">
            <p className="landing-section__eyebrow">บรรยากาศจากสถานที่จริงสู่โลก 3 มิติ</p>
            <h2 id="landmarks-heading" className="landing-section__title">
              แรงบันดาลใจจาก 6 สถานที่จริงทั่วเมืองไทย
            </h2>
          </header>

          <div className="place-cards-grid">
            {landmarkGallery.map((place) => (
              <article key={place.id} className="place-card">
                <img
                  src={place.imagePath}
                  alt={place.alt}
                  width={480}
                  height={300}
                  loading="lazy"
                  className="place-card__img"
                />
                <header className="place-card__header">
                  <span className="place-card__zone">{place.zoneTag}</span>
                  <h3 className="place-card__title">{place.placeTitle}</h3>
                </header>
                <p className="place-card__note">{place.locationNote}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ===============================================================
            SECTION 4: ONLINE LONG-DISTANCE ROOM LOBBY & SETTINGS
           =============================================================== */}
        <section
          id="online-room"
          className="landing-section"
          aria-labelledby="online-room-heading"
        >
          <header className="landing-section__header">
            <p className="landing-section__eyebrow">เชื่อมต่อหัวใจข้ามระยะทาง</p>
            <h2 id="online-room-heading" className="landing-section__title">
              เปิดห้องออนไลน์ชวนแฟน หรือเล่นด้วยกันบนเครื่องเดียว
            </h2>
          </header>

          <ol className="couple-steps-bar" aria-label="ขั้นตอนการชวนแฟนเล่นออนไลน์">
            <li className="couple-steps-bar__item">
              <span className="couple-steps-bar__num">1</span>
              <div>
                <strong>เลือกโหมดออนไลน์</strong>
                <p>สร้างรหัสห้องคู่รักส่วนตัวของคุณ</p>
              </div>
            </li>
            <li className="couple-steps-bar__item">
              <span className="couple-steps-bar__num">2</span>
              <div>
                <strong>คัดลอกลิงก์ส่งให้แฟน</strong>
                <p>แฟนคลิกลิงก์เดียวเข้าห้องเป็น P2 อัตโนมัติ</p>
              </div>
            </li>
            <li className="couple-steps-bar__item">
              <span className="couple-steps-bar__num">3</span>
              <div>
                <strong>เข้าสู่งานลอยกระทง 3D</strong>
                <p>เดินจูงมือ เล่นมินิเกม และลอยกระทงพร้อมกัน!</p>
              </div>
            </li>
          </ol>

          <div className="online-lobby-box">
            <div className="online-lobby-box__modes" role="group" aria-label="โหมดการเล่น">
              <button
                type="button"
                className={`btn ${playMode === 'online' ? 'btn--primary' : 'btn--secondary'}`}
                aria-pressed={playMode === 'online'}
                onClick={() => onChangePlayMode?.('online')}
              >
                🌐 เล่นออนไลน์กับแฟนทางไกล (Online Co-op)
              </button>
              <button
                type="button"
                className={`btn ${playMode === 'local' ? 'btn--primary' : 'btn--secondary'}`}
                aria-pressed={playMode === 'local'}
                onClick={() => onChangePlayMode?.('local')}
              >
                🎮 เล่นเครื่องเดียวกัน (Local 2 คน)
              </button>
            </div>

            {playMode === 'online' && (
              <div className="online-lobby-controls">
                <div className="online-lobby-row">
                  <div className="field-group online-code-field">
                    <label htmlFor={roomInputId} className="field-label">
                      รหัสห้องคู่รัก (4–8 ตัวอักษร)
                    </label>
                    <input
                      id={roomInputId}
                      type="text"
                      className="text-input online-code-input"
                      value={roomCode}
                      maxLength={8}
                      placeholder="เช่น LOVE99"
                      onChange={(e) =>
                        onChangeRoomCode?.(normalizeRoomCodeInput(e.target.value))
                      }
                    />
                  </div>

                  <fieldset className="swatch-fieldset online-slot-picker">
                    <legend className="field-label">บทบาทของคุณ</legend>
                    <div className="chip-grid">
                      {(['p1', 'p2'] as const).map((slot) => (
                        <label
                          key={slot}
                          className="chip-option chip-option--compact"
                        >
                          <input
                            type="radio"
                            name="online-role-slot"
                            value={slot}
                            checked={
                              (roomStatus === 'connected'
                                ? myOnlineRole
                                : preferredSlot) === slot
                            }
                            onChange={() => {
                              setPreferredSlot(slot);
                              if (roomStatus === 'connected') {
                                onConnectOnlineRoom?.(roomCode, slot);
                              }
                            }}
                            className="visually-hidden"
                          />
                          <span>
                            {slot === 'p1'
                              ? 'ผู้เล่น 1 (สร้างห้อง)'
                              : 'ผู้เล่น 2 (แฟนเข้าห้อง)'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="dialog-actions">
                  {roomStatus !== 'connected' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => onConnectOnlineRoom?.(roomCode, preferredSlot)}
                      >
                        {roomStatus === 'connecting'
                          ? 'กำลังเชื่อมต่อห้อง...'
                          : `เชื่อมต่อเข้าห้อง ${roomCode || ''}`}
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={onGenerateNewRoom}
                      >
                        สุ่มรหัสห้องใหม่
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => void handleCopyInvite()}
                      >
                        🔗 คัดลอกลิงก์ชวนแฟนเข้าห้อง ({roomCode})
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={onDisconnectOnlineRoom}
                      >
                        ออกจากห้องออนไลน์
                      </button>
                    </>
                  )}
                </div>

                <p className="online-status-line" role="status" aria-live="polite">
                  {roomError ? (
                    <span className="online-status-line--err">⚠ {roomError}</span>
                  ) : copiedNotice ? (
                    <span className="online-status-line--ok">✓ {copiedNotice}</span>
                  ) : roomStatus === 'connected' ? (
                    <span className="online-status-line--ok">
                      ● เชื่อมต่อห้อง <strong>{roomCode}</strong> สำเร็จ (คุณคือ{' '}
                      {myOnlineRole.toUpperCase()}) ·{' '}
                      {partnerConnected
                        ? `ออนไลน์ครบคู่แล้ว! (${state.players.p1.name} & ${state.players.p2.name})`
                        : 'ส่งลิงก์ให้แฟนคลิกเข้ามาเจอกันในห้องได้เลย'}
                    </span>
                  ) : (
                    'กด "เชื่อมต่อเข้าห้อง" แล้วส่งลิงก์หรือรหัสห้องให้แฟน เพื่อเดินในฉาก 3D และเล่นมินิเกมช่วยกันสดๆ!'
                  )}
                </p>
              </div>
            )}

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
        </section>

        {/* ===============================================================
            SECTION 5: COUPLE AVATAR STUDIO & FINAL LAUNCH BANNER
           =============================================================== */}
        <section
          id="couple-studio"
          className="landing-section"
          aria-labelledby="studio-heading"
        >
          <header className="landing-section__header">
            <p className="landing-section__eyebrow">แต่งชุดไทยและรูปใบหน้าคู่รัก</p>
            <h2 id="studio-heading" className="landing-section__title">
              สตูดิโอปรับแต่งตัวละคร 3 มิติของคุณทั้งคู่
            </h2>
          </header>

          <div className="setup-grid">
            {playMode === 'online' ? (
              <>
                <PlayerEditorCard
                  profile={state.players[myOnlineRole]}
                  labelTitle={`ตัวละครของคุณ (${myOnlineRole.toUpperCase()})`}
                  badgeText={
                    roomStatus === 'connected'
                      ? '● เชื่อมต่อห้องแล้ว'
                      : '○ กำลังเตรียมเข้าห้อง'
                  }
                  onUpdateName={onUpdateName}
                  onUpdateCustomization={onUpdateCustomization}
                  onPortraitProcessed={onPortraitProcessed}
                  onClearPortrait={onClearPortrait}
                />
                <PlayerEditorCard
                  profile={state.players[partnerRole]}
                  labelTitle={`ตัวละครของแฟน (${partnerRole.toUpperCase()})`}
                  readOnlyPartner
                  partnerConnected={partnerConnected}
                  onUpdateName={onUpdateName}
                  onUpdateCustomization={onUpdateCustomization}
                  onPortraitProcessed={onPortraitProcessed}
                  onClearPortrait={onClearPortrait}
                />
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </section>

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

        <footer className="landing-launch-footer">
          <div className="landing-launch-footer__copy">
            <h2>พร้อมเดินจูงมือเข้าสู่งานคืนเพ็ญริมน้ำ 3D หรือยัง?</h2>
            <p>
              เมื่อเข้าไปในงานแล้ว สามารถหมุนกล้องชมโคมลอย 360° ส่งหัวใจให้กัน และกดเปิดห้องชวนแฟนได้ตลอดเวลา
            </p>
          </div>

          {worldAssetStatus === 'loading' && (
            <div className="setup-preload-status">
              <progress
                className="minigame-progress"
                aria-label="กำลังเตรียมฉากงานลอยกระทง"
              />
              <span className="field-hint">กำลังเตรียมฉาก 3 มิติริมน้ำ...</span>
            </div>
          )}

          <div className="setup-actions">
            <button
              type="button"
              className="btn btn--primary btn--lg landing-cta-glow"
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
          </div>
        </footer>
      </main>
    </div>
  );
}
