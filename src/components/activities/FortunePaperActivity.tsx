import { useState } from 'react';
import { FORTUNE_PROMPTS } from '../../domain/reducer';
import type {
  FortunePaperState,
  PlayerId,
  PlayerProfile,
} from '../../domain/types';
import { playChime } from '../../game/sound';

interface FortunePaperActivityProps {
  fortune: FortunePaperState;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  soundEnabled: boolean;
  onChangePrompt: (promptIndex: number) => void;
  onSetAnswer: (playerId: PlayerId, answer: string) => void;
  onLockAnswer: (playerId: PlayerId) => void;
  onNextRound: () => void;
}

export function FortunePaperActivity({
  fortune,
  players,
  myRole,
  bothOnline,
  soundEnabled,
  onChangePrompt,
  onSetAnswer,
  onLockAnswer,
  onNextRound,
}: FortunePaperActivityProps) {
  const [soloRoleView, setSoloRoleView] = useState<PlayerId>(myRole);
  const activeWriter: PlayerId = bothOnline ? myRole : soloRoleView;
  const partnerRole: PlayerId = activeWriter === 'p1' ? 'p2' : 'p1';

  const myAnswer = activeWriter === 'p1' ? fortune.p1Answer : fortune.p2Answer;
  const myLocked = activeWriter === 'p1' ? fortune.p1Locked : fortune.p2Locked;
  const partnerLocked =
    partnerRole === 'p1' ? fortune.p1Locked : fortune.p2Locked;

  const promptText =
    FORTUNE_PROMPTS[fortune.promptIndex % FORTUNE_PROMPTS.length];

  const handleSeal = () => {
    if (!myAnswer.trim() || myLocked) return;
    playChime(partnerLocked ? 'ceremony' : 'pickup', soundEnabled);
    onLockAnswer(activeWriter);
  };

  return (
    <section
      className="romantic-activity fortune-paper-activity"
      aria-label="กระดาษคำทำนายของเราสองคน"
    >
      <div className="dialogue-bubble">
        <p>
          <strong>ลุงมั่น:</strong> คืนนี้ไม่ต้องทดสอบความจำหรอกลูก ลองแอบเขียนคำตอบในใจโดยไม่ให้แฟนเห็น
          แล้วค่อยเปิดอ่านพร้อมกันสิ เดี๋ยวลุงมอบชุดธูปเทียนหอมให้เป็นของขวัญนะ
        </p>
      </div>

      {!bothOnline && !fortune.revealed && (
        <div className="solo-preview-bar" role="group" aria-label="สลับฝั่งเขียนคำตอบระหว่างรอคู่รัก">
          <span>กำลังรอแฟนเข้าห้อง · ลองแอบสลับเขียนทีละฝั่งได้:</span>
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
                {(pid === 'p1' ? fortune.p1Locked : fortune.p2Locked) ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fortune-prompt-card">
        <span className="fortune-prompt-card__badge">📜 คำถามบนกระดาษคำทำนาย</span>
        <h2 className="fortune-prompt-card__question">{promptText}</h2>
        {!fortune.revealed && (
          <div className="fortune-prompt-picker">
            {FORTUNE_PROMPTS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`prompt-dot ${fortune.promptIndex === idx ? 'is-active' : ''}`}
                onClick={() => {
                  playChime('beat', soundEnabled);
                  onChangePrompt(idx);
                }}
              >
                ข้อที่ {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {!fortune.revealed ? (
        <div className="fortune-envelopes-grid">
          {/* Active writer's private fortune slip */}
          <div className="fortune-slip fortune-slip--mine">
            <header className="fortune-slip__head">
              <strong>กระดาษของ {players[activeWriter].name}</strong>
              <span className="slip-pill">
                {myLocked ? '💌 ปิดผนึกแล้ว' : '✍️ แอบเขียน (อีกฝ่ายมองไม่เห็น)'}
              </span>
            </header>

            {myLocked ? (
              <div className="fortune-sealed-box">
                <span className="fortune-sealed-box__seal" aria-hidden="true">
                  🏮
                </span>
                <p>ปิดผนึกคำตอบของคุณไว้เรียบร้อยแล้ว!</p>
                <p className="fortune-sealed-box__sub">
                  คำตอบจะถูกเปิดเผยพร้อมกันทันทีที่ {players[partnerRole].name} ปิดผนึกเสร็จ
                </p>
              </div>
            ) : (
              <>
                <label htmlFor="fortune-my-answer" className="visually-hidden">
                  คำตอบในใจของคุณ
                </label>
                <textarea
                  id="fortune-my-answer"
                  className="text-input text-area"
                  rows={3}
                  maxLength={140}
                  placeholder="พิมพ์คำตอบจากใจของคุณตรงนี้... (อีกฝ่ายจะไม่เห็นจนกว่าจะเปิดพร้อมกัน)"
                  value={myAnswer}
                  onChange={(e) => onSetAnswer(activeWriter, e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!myAnswer.trim()}
                  onClick={handleSeal}
                >
                  💌 ปิดผนึกคำตอบของฉัน
                </button>
              </>
            )}
          </div>

          {/* Partner's hidden envelope */}
          <div className="fortune-slip fortune-slip--partner">
            <header className="fortune-slip__head">
              <strong>กระดาษของ {players[partnerRole].name}</strong>
              <span className="slip-pill">
                {partnerLocked ? '💌 ปิดผนึกพร้อมเปิด!' : '🕯️ กำลังคิดคำตอบ…'}
              </span>
            </header>
            <div className="fortune-sealed-box fortune-sealed-box--secret">
              <span className="fortune-sealed-box__seal" aria-hidden="true">
                {partnerLocked ? '✨💌✨' : '📜'}
              </span>
              <p>
                {partnerLocked
                  ? `${players[partnerRole].name} เขียนและปิดผนึกไว้เรียบร้อยแล้ว!`
                  : `กำลังรอ ${players[partnerRole].name} แอบเขียนคำตอบ…`}
              </p>
              <p className="fortune-sealed-box__sub">
                ข้อความถูกเก็บเป็นความลับจนกว่าทั้งสองคนจะปิดผนึกครบ
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fortune-reveal-panel" role="region" aria-label="ผลเปิดกระดาษคำทำนาย">
          <div className="fortune-reveal-grid">
            <article className="fortune-opened-card">
              <span className="fortune-opened-card__author">
                💌 คำตอบของ {players.p1.name}
              </span>
              <p className="fortune-opened-card__text">“{fortune.p1Answer}”</p>
            </article>
            <article className="fortune-opened-card">
              <span className="fortune-opened-card__author">
                💌 คำตอบของ {players.p2.name}
              </span>
              <p className="fortune-opened-card__text">“{fortune.p2Answer}”</p>
            </article>
          </div>

          <div className="romantic-reward-banner" role="status">
            🕯️ ลุงมั่นยิ้มอย่างอบอุ่นและมอบ <strong>ชุดธูปเทียนมงคล</strong> เป็นของขวัญให้ทั้งคู่แล้ว!
            คำตอบนี้จะถูกเก็บไว้ในการ์ดที่ระลึกคืนนี้ด้วย
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                playChime('beat', soundEnabled);
                onNextRound();
              }}
            >
              📜 ลองตอบคำถามข้ออื่นเพิ่มอีกใบ
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
