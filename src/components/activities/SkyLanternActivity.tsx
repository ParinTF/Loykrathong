import { useEffect, useState } from 'react';
import type {
  PlayerId,
  PlayerProfile,
  SkyLanternState,
} from '../../domain/types';
import { playChime } from '../../game/sound';

interface SkyLanternActivityProps {
  lantern: SkyLanternState;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  onSetWish: (playerId: PlayerId, wish: string) => void;
  onLightSide: (playerId: PlayerId) => void;
  onReadyRelease: (playerId: PlayerId) => void;
  onCompleteRelease: () => void;
}

export function SkyLanternActivity({
  lantern,
  players,
  myRole,
  bothOnline,
  reducedMotion,
  soundEnabled,
  onSetWish,
  onLightSide,
  onReadyRelease,
  onCompleteRelease,
}: SkyLanternActivityProps) {
  const [soloRoleView, setSoloRoleView] = useState<PlayerId>(myRole);
  const activeActor: PlayerId = bothOnline ? myRole : soloRoleView;
  const [countdown, setCountdown] = useState<number | null>(null);

  const bothLit = lantern.p1Lit && lantern.p2Lit;
  const bothReady = lantern.p1ReadyRelease && lantern.p2ReadyRelease;

  // Trigger synchronized heartfelt 3-2-1 release once both partners press ready
  useEffect(() => {
    if (!bothReady || lantern.released) {
      setCountdown(null);
      return undefined;
    }

    if (reducedMotion) {
      playChime('ceremony', soundEnabled);
      onCompleteRelease();
      return undefined;
    }

    setCountdown(3);
    playChime('beat', soundEnabled);
    const t1 = window.setTimeout(() => {
      setCountdown(2);
      playChime('beat', soundEnabled);
    }, 850);
    const t2 = window.setTimeout(() => {
      setCountdown(1);
      playChime('beat', soundEnabled);
    }, 1700);
    const t3 = window.setTimeout(() => {
      setCountdown(0);
      playChime('lantern', soundEnabled);
      onCompleteRelease();
    }, 2550);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [bothReady, lantern.released, onCompleteRelease, reducedMotion, soundEnabled]);

  const myWish = activeActor === 'p1' ? lantern.p1Wish : lantern.p2Wish;
  const myLit = activeActor === 'p1' ? lantern.p1Lit : lantern.p2Lit;
  const myReady =
    activeActor === 'p1' ? lantern.p1ReadyRelease : lantern.p2ReadyRelease;

  return (
    <section
      className="romantic-activity sky-lantern-activity"
      aria-label="ส่งความปรารถนาขึ้นสู่ท้องฟ้า"
    >
      <div className="dialogue-bubble">
        <p>
          โคมยี่เป็งดวงพิเศษเพียงดวงเดียวของคืนนี้ — เขียนคำอธิษฐานของแต่ละคนลงบนผิวโคม
          ช่วยกันประคองและจุดไฟ แล้วนับถอยหลังปล่อยขึ้นสู่ฟ้าพร้อมกัน
        </p>
      </div>

      {!bothOnline && !lantern.released && (
        <div className="solo-preview-bar" role="group" aria-label="สลับฝั่งโคมระหว่างรอคู่รัก">
          <span>กำลังรอแฟนเข้าห้อง · สลับฝั่งเขียนคำอธิษฐานและประคองโคมได้:</span>
          <div className="solo-preview-bar__actions">
            {(['p1', 'p2'] as const).map((pid) => (
              <button
                key={pid}
                type="button"
                className={`btn btn--sm ${soloRoleView === pid ? 'btn--primary' : 'btn--secondary'}`}
                aria-pressed={soloRoleView === pid}
                onClick={() => setSoloRoleView(pid)}
              >
                ฝั่ง {players[pid].name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visual Illuminated Sky Lantern */}
      <div
        className={`lantern-ritual-stage ${bothLit ? 'is-lit' : ''} ${lantern.released ? 'is-released' : ''}`}
      >
        <div className="lantern-body">
          <div className="lantern-body__panel">
            <span className="lantern-body__author">{players.p1.name}</span>
            <p className="lantern-body__wish">
              {lantern.p1Wish.trim() || 'รอเขียนคำอธิษฐาน…'}
            </p>
          </div>
          <div className="lantern-body__divider" aria-hidden="true" />
          <div className="lantern-body__panel">
            <span className="lantern-body__author">{players.p2.name}</span>
            <p className="lantern-body__wish">
              {lantern.p2Wish.trim() || 'รอเขียนคำอธิษฐาน…'}
            </p>
          </div>
        </div>

        <div className="lantern-burner" aria-hidden="true">
          <span className={`burner-flame ${lantern.p1Lit ? 'is-on' : ''}`}>🔥</span>
          <span className={`burner-core ${bothLit ? 'is-bright' : ''}`}>✨</span>
          <span className={`burner-flame ${lantern.p2Lit ? 'is-on' : ''}`}>🔥</span>
        </div>

        {countdown !== null && countdown > 0 && (
          <div className="lantern-countdown-overlay" role="status" aria-live="assertive">
            <span>ปล่อยโคมพร้อมกันใน…</span>
            <strong>{countdown}</strong>
          </div>
        )}
      </div>

      {lantern.released ? (
        <div className="romantic-reward-banner" role="status">
          🏮✨ โคมความปรารถนาของ {players.p1.name} และ {players.p2.name} ลอยสว่างขึ้นสู่ท้องฟ้าในฉาก 3 มิติแล้ว!
          ลองเงยหน้าชมโคมที่ค่อยๆ ลอยเหนือลานโคมยี่เป็งดูสิ
        </div>
      ) : (
        <div className="lantern-controls">
          <div className="field-group">
            <label htmlFor="lantern-wish-input" className="field-label">
              คำอธิษฐานของ {players[activeActor].name} บนโคมยี่เป็ง
            </label>
            <input
              id="lantern-wish-input"
              type="text"
              className="text-input"
              maxLength={110}
              placeholder="เช่น ขอให้ปีหน้าเราได้จับมือกันดูโคมจริงๆ ด้วยกัน…"
              value={myWish}
              onChange={(e) => onSetWish(activeActor, e.target.value)}
            />
          </div>

          <div className="lantern-step-actions">
            {!bothLit ? (
              <button
                type="button"
                className={`btn ${myLit ? 'btn--secondary' : 'btn--primary'}`}
                disabled={myLit}
                onClick={() => {
                  playChime('lantern', soundEnabled);
                  onLightSide(activeActor);
                }}
              >
                {myLit
                  ? `✓ ${players[activeActor].name} ประคองและจุดไฟฝั่งตัวเองแล้ว`
                  : `🔥 ช่วยประคองและจุดไฟโคม (${players[activeActor].name})`}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                disabled={myReady || countdown !== null}
                onClick={() => {
                  playChime('pickup', soundEnabled);
                  onReadyRelease(activeActor);
                }}
              >
                {countdown !== null
                  ? `กำลังปล่อยโคมขึ้นสู่ท้องฟ้า (${countdown})…`
                  : myReady
                    ? `✓ พร้อมปล่อยแล้ว รออีกฝ่ายแตะปล่อยพร้อมกัน…`
                    : `🏮 นับถอยหลังปล่อยโคมพร้อมกัน (${players[activeActor].name})`}
              </button>
            )}
          </div>

          <div className="partner-sync-pills">
            <span className={`sync-pill ${lantern.p1Lit ? 'is-ready' : ''}`}>
              {players.p1.name}:{' '}
              {lantern.p1ReadyRelease
                ? 'พร้อมปล่อยแล้ว 🏮'
                : lantern.p1Lit
                  ? 'จุดไฟแล้ว 🔥'
                  : 'กำลังเขียนคำอธิษฐาน'}
            </span>
            <span className={`sync-pill ${lantern.p2Lit ? 'is-ready' : ''}`}>
              {players.p2.name}:{' '}
              {lantern.p2ReadyRelease
                ? 'พร้อมปล่อยแล้ว 🏮'
                : lantern.p2Lit
                  ? 'จุดไฟแล้ว 🔥'
                  : 'กำลังเขียนคำอธิษฐาน'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
