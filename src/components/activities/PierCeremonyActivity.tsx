import { useEffect, useState } from 'react';
import type { GameState, KrathongDesign, PlayerId } from '../../domain/types';
import { playChime } from '../../game/sound';
import { AvatarPreview } from '../AvatarPreview';
import { KrathongIllustration } from '../KrathongIllustration';
import { KeepsakeCard } from './KeepsakeCard';

interface PierCeremonyActivityProps {
  state: GameState;
  myRole: PlayerId;
  bothOnline: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  onUpdateWish: (patch: Partial<KrathongDesign>) => void;
  onToggleReady: (playerId: PlayerId, ready?: boolean) => void;
  onTriggerRelease: (byPlayer: PlayerId) => void;
  onStartAnother: () => void;
  onClose: () => void;
}

export function PierCeremonyActivity({
  state,
  myRole,
  bothOnline,
  reducedMotion,
  soundEnabled,
  onUpdateWish,
  onToggleReady,
  onTriggerRelease,
  onStartAnother,
  onClose,
}: PierCeremonyActivityProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showingKeepsake, setShowingKeepsake] = useState(
    state.questStage === 'released' && state.releasedKrathongs.length > 0
  );

  useEffect(() => {
    if (state.questStage === 'released' && state.releasedKrathongs.length > 0) {
      setShowingKeepsake(true);
    } else {
      setShowingKeepsake(false);
    }
  }, [state.questStage, state.releasedKrathongs.length]);

  const bothReady = state.pierCeremony.p1Ready && state.pierCeremony.p2Ready;

  // Synchronized 3-2-1 release when both partners confirm ready
  useEffect(() => {
    if (!bothReady || showingKeepsake) {
      setCountdown(null);
      return undefined;
    }

    if (reducedMotion) {
      playChime('ceremony', soundEnabled);
      onTriggerRelease(myRole);
      return undefined;
    }

    setCountdown(3);
    playChime('beat', soundEnabled);
    const t1 = window.setTimeout(() => {
      setCountdown(2);
      playChime('beat', soundEnabled);
    }, 750);
    const t2 = window.setTimeout(() => {
      setCountdown(1);
      playChime('beat', soundEnabled);
    }, 1500);
    const t3 = window.setTimeout(() => {
      setCountdown(null);
      playChime('ceremony', soundEnabled);
      onTriggerRelease(myRole);
    }, 2250);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [
    bothReady,
    myRole,
    onTriggerRelease,
    reducedMotion,
    showingKeepsake,
    soundEnabled,
  ]);

  if (showingKeepsake && state.releasedKrathongs.length > 0) {
    return (
      <KeepsakeCard
        state={state}
        onWatchRiver={onClose}
        onStartAnother={() => {
          onStartAnother();
          setShowingKeepsake(false);
        }}
      />
    );
  }

  const p1 = state.players.p1;
  const p2 = state.players.p2;
  const myReady =
    myRole === 'p1' ? state.pierCeremony.p1Ready : state.pierCeremony.p2Ready;

  return (
    <section
      className="romantic-activity pier-ceremony-activity"
      aria-label="คำอธิษฐานใต้แสงจันทร์"
    >
      <div className="couple-mini-row">
        <AvatarPreview profile={p1} size={58} />
        <KrathongIllustration design={state.krathongDesign} size={146} />
        <AvatarPreview profile={p2} size={58} />
      </div>

      <p className="dialogue-bubble">
        ปลายสะพานท่าน้ำไม้สักสะท้อนแสงจันทร์เต็มดวง — เขียนคำอธิษฐานของสองเราแล้วแตะปล่อยกระทงลงสู่สายน้ำพร้อมกัน
      </p>

      <div className="field-group">
        <label htmlFor="pier-moonlight-wish" className="field-label">
          คำอธิษฐานใต้แสงจันทร์ของ {p1.name} และ {p2.name}
        </label>
        <textarea
          id="pier-moonlight-wish"
          className="text-input text-area"
          rows={2}
          maxLength={140}
          value={state.krathongDesign.wishText}
          onChange={(e) => onUpdateWish({ wishText: e.target.value })}
        />
      </div>

      {countdown !== null ? (
        <div className="pier-countdown-banner" role="status" aria-live="assertive">
          <span>ค่อยๆ วางกระทงลงสู่สายน้ำแสงจันทร์พร้อมกันใน…</span>
          <strong>{countdown}</strong>
        </div>
      ) : (
        <div className="pier-sync-actions">
          {bothOnline ? (
            <>
              <button
                type="button"
                className={`btn btn--lg ${myReady ? 'btn--secondary' : 'btn--primary'}`}
                onClick={() => {
                  playChime('pickup', soundEnabled);
                  onToggleReady(myRole);
                }}
              >
                {myReady
                  ? `✓ ${state.players[myRole].name} ประคองกระทงพร้อมปล่อยแล้ว (แตะยกเลิกได้)`
                  : `🌊 กดปล่อยกระทงพร้อมกัน (${state.players[myRole].name})`}
              </button>
              <div className="partner-sync-pills">
                <span className={`sync-pill ${state.pierCeremony.p1Ready ? 'is-ready' : ''}`}>
                  {p1.name}: {state.pierCeremony.p1Ready ? 'พร้อมปล่อยแล้ว 🪷' : 'กำลังตั้งจิตอธิษฐาน'}
                </span>
                <span className={`sync-pill ${state.pierCeremony.p2Ready ? 'is-ready' : ''}`}>
                  {p2.name}: {state.pierCeremony.p2Ready ? 'พร้อมปล่อยแล้ว 🪷' : 'กำลังตั้งจิตอธิษฐาน'}
                </span>
              </div>
            </>
          ) : (
            <div className="pier-solo-release">
              <p className="activity-gentle-note">
                กำลังรออีกฝ่ายเข้าห้อง — สามารถกดยืนยันทั้งสองฝั่งเพื่อทดลองปล่อยกระทงและชมฉาก Cinematic ได้เลย
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className={`btn ${state.pierCeremony.p1Ready ? 'btn--secondary' : 'btn--primary'}`}
                  onClick={() => {
                    playChime('pickup', soundEnabled);
                    onToggleReady('p1');
                  }}
                >
                  {state.pierCeremony.p1Ready ? `✓ ${p1.name} พร้อมแล้ว` : `ประคองฝั่ง ${p1.name}`}
                </button>
                <button
                  type="button"
                  className={`btn ${state.pierCeremony.p2Ready ? 'btn--secondary' : 'btn--primary'}`}
                  onClick={() => {
                    playChime('pickup', soundEnabled);
                    onToggleReady('p2');
                  }}
                >
                  {state.pierCeremony.p2Ready ? `✓ ${p2.name} พร้อมแล้ว` : `ประคองฝั่ง ${p2.name}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
