import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { GENDERS } from '../domain/customizationCatalog';
import type { GenderId, PlayerPortrait } from '../domain/types';
import { processPortraitFileLocally } from '../persistence/storage';
import { HudIcon } from './hud/HudPrimitives';

export type InvitationDetails =
  | { status: 'checking' }
  | { status: 'ready'; hostName: string }
  | { status: 'error'; message: string; retry: boolean };

export interface PortraitDraft {
  portrait: PlayerPortrait;
  blob: Blob | null;
}

function InvitationStage({ children, reducedMotion }: { children: ReactNode; reducedMotion: boolean }) {
  return (
    <main className="invite-stage" id="main-content" data-reduced-motion={reducedMotion}>
      <picture className="invite-stage__scene" aria-hidden="true">
        <source media="(max-width: 700px)" srcSet="/invite/moonlit-festival-mobile.webp" />
        <img src="/invite/moonlit-festival.webp" alt="" fetchPriority="high" width={1680} height={945} />
      </picture>
      <div className="invite-stage__glow" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
      </div>
      <div className="invite-brand" aria-label="ลอยกระทง">
        <HudIcon name="lotus" />
        <span>ลอยกระทง</span>
      </div>
      <div className="invite-stage__content">{children}</div>
    </main>
  );
}

function InvitationHeading({ children, subtitle }: { children: ReactNode; subtitle: string }) {
  return (
    <header className="invite-heading">
      <div className="invite-heading__ornament" aria-hidden="true"><HudIcon name="spark" /></div>
      <h1>{children}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

export function OpeningFestival({ message, error, onRetry, reducedMotion }: {
  message: string; error?: boolean; onRetry?: () => void; reducedMotion: boolean;
}) {
  return (
    <InvitationStage reducedMotion={reducedMotion}>
      <InvitationHeading subtitle={message}>{error ? 'คืนนี้ยังรอคุณอยู่' : 'กำลังเข้าสู่คืนเพ็ญ'}</InvitationHeading>
      {error && onRetry ? (
        <button type="button" className="invite-button" onClick={onRetry}>ลองอีกครั้ง <HudIcon name="right" /></button>
      ) : (
        <div className="invite-progress" role="progressbar" aria-label={message}><span /></div>
      )}
    </InvitationStage>
  );
}

export function InvitationScreen({ invite, nameHint, initialGender, initialPortrait, submitting, message, reducedMotion,
  onSubmit, onGoHome, onRetryInvite }: {
  invite: InvitationDetails | null;
  nameHint: string;
  initialGender: GenderId;
  initialPortrait: PlayerPortrait;
  submitting: boolean;
  message: string | null;
  reducedMotion: boolean;
  onSubmit: (name: string, gender: GenderId, draft: PortraitDraft) => void;
  onGoHome: () => void;
  onRetryInvite: () => void;
}) {
  const nameId = useId();
  const imageId = useId();
  const errorId = useId();
  const genderGroupName = useId();
  const operation = useRef(0);
  const [name, setName] = useState(nameHint);
  const [gender, setGender] = useState<GenderId>(initialGender);
  const [draft, setDraft] = useState<PortraitDraft>({ portrait: initialPortrait, blob: null });
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [invalidName, setInvalidName] = useState(false);

  async function preview(file: File | undefined) {
    if (!file) return;
    const request = ++operation.current;
    setProcessing(true);
    setPhotoError(null);
    const result = await processPortraitFileLocally(file);
    if (request !== operation.current) return;
    if (result.portrait.status === 'ready') setDraft(result);
    else setPhotoError(result.portrait.error ?? 'เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่น');
    setProcessing(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) {
      setInvalidName(true);
      document.getElementById(nameId)?.focus();
      return;
    }
    if (!submitting && !processing) onSubmit(cleaned.slice(0, 24), gender, draft);
  }

  if (invite?.status === 'checking') {
    return <OpeningFestival message="กำลังเปิดคำเชิญของคุณ…" reducedMotion={reducedMotion} />;
  }
  if (invite?.status === 'error') {
    return (
      <InvitationStage reducedMotion={reducedMotion}>
        <InvitationHeading subtitle={invite.message}>คำเชิญนี้เปิดไม่ได้</InvitationHeading>
        <button type="button" className="invite-button" onClick={invite.retry ? onRetryInvite : onGoHome}>
          {invite.retry ? 'ลองอีกครั้ง' : 'เริ่มคืนใหม่'} <HudIcon name="right" />
        </button>
      </InvitationStage>
    );
  }

  return (
    <InvitationStage reducedMotion={reducedMotion}>
      <InvitationHeading subtitle={invite ? `${invite.hostName} ส่งคำเชิญให้คุณมาลอยกระทงในคืนเพ็ญ` : 'แม้อยู่ไกลกัน แต่คืนนี้เราลอยกระทงด้วยกันได้'}>
        {invite ? 'คำเชิญใต้แสงจันทร์' : 'คืนเพ็ญของเราสองคน'}
      </InvitationHeading>
      <form className="invite-form" noValidate onSubmit={submit} aria-busy={submitting}>
        <label className="invite-upload" htmlFor={imageId}>
          <span className="invite-upload__portrait">
            {draft.portrait.dataUrl ? <img src={draft.portrait.dataUrl} alt="ตัวอย่างรูปโปรไฟล์" /> : <HudIcon name="portrait" />}
            <span className="invite-upload__mark"><HudIcon name="upload" /></span>
          </span>
          <span>{processing ? 'กำลังเตรียมรูป…' : 'อัปโหลดรูป'}</span>
          <input id={imageId} type="file" className="visually-hidden" accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={submitting} onChange={(event) => {
              void preview(event.target.files?.[0]);
              event.target.value = '';
            }} />
        </label>
        {photoError && <p className="invite-error" role="alert">{photoError}</p>}
        <label htmlFor={nameId} className="visually-hidden">ชื่อของคุณ</label>
        <input className="invite-name" id={nameId} value={name} onChange={(event) => {
          setName(event.target.value);
          setInvalidName(false);
        }} placeholder="ชื่อของคุณ" maxLength={24} autoComplete="nickname" disabled={submitting}
          required aria-invalid={invalidName} aria-describedby={invalidName ? errorId : undefined} />
        {invalidName && <p className="invite-error" id={errorId} role="alert">กรอกชื่อของคุณก่อนเริ่ม</p>}
        <fieldset className="invite-gender" disabled={submitting}>
          <legend className="invite-gender__label">เลือกเพศตัวละคร</legend>
          <div className="invite-gender__options">
            {GENDERS.map((option) => (
              <label
                key={option.id}
                className="invite-gender__option"
                data-selected={gender === option.id}
              >
                <input
                  type="radio"
                  name={genderGroupName}
                  value={option.id}
                  checked={gender === option.id}
                  onChange={() => setGender(option.id)}
                  className="visually-hidden"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="invite-button" disabled={submitting || processing}>
          {submitting ? invite ? 'กำลังเข้าห้อง…' : 'กำลังเปิดห้องส่วนตัว…' : invite ? 'ไปลอยกระทงด้วยกัน' : 'เริ่มต้นคืนพิเศษด้วยกัน'}
          <HudIcon name={submitting ? 'moon' : 'right'} />
        </button>
        {message && <p className={submitting ? 'invite-form__status' : 'invite-error'} role={submitting ? 'status' : 'alert'}>{message}</p>}
      </form>
    </InvitationStage>
  );
}
