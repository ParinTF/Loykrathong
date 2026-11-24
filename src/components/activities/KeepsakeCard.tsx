import { FORTUNE_PROMPTS } from '../../domain/reducer';
import type { GameState } from '../../domain/types';
import { AvatarPreview } from '../AvatarPreview';
import { KrathongIllustration } from '../KrathongIllustration';

interface KeepsakeCardProps {
  state: GameState;
  onWatchRiver: () => void;
  onStartAnother: () => void;
}

function downloadKeepsakeCardPng(state: GameState): void {
  try {
    const latest = state.releasedKrathongs[state.releasedKrathongs.length - 1];
    if (!latest) return;

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, 620);
    grad.addColorStop(0, '#0C1428');
    grad.addColorStop(0.55, '#192748');
    grad.addColorStop(1, '#0F1C36');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 620);

    // Double gold border
    ctx.strokeStyle = '#D4B477';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, 852, 572);
    ctx.strokeStyle = 'rgba(212, 180, 119, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(36, 36, 828, 548);

    // Moon emblem
    ctx.beginPath();
    ctx.arc(450, 96, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FEF3C7';
    ctx.fill();

    ctx.fillStyle = '#F4E9D4';
    ctx.textAlign = 'center';
    ctx.font = '700 32px "Noto Sans Thai", sans-serif';
    ctx.fillText('การ์ดที่ระลึกคืนเพ็ญของเราสองคน', 450, 168);

    ctx.fillStyle = '#FDE68A';
    ctx.font = '700 26px "Noto Sans Thai", sans-serif';
    ctx.fillText(
      `${latest.coupleNames[0]}  ♥  ${latest.coupleNames[1]}`,
      450,
      214
    );

    // Moonlight wish box
    ctx.fillStyle = 'rgba(12, 20, 40, 0.72)';
    ctx.fillRect(88, 246, 724, 108);
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.45)';
    ctx.strokeRect(88, 246, 724, 108);

    ctx.fillStyle = '#D4B477';
    ctx.font = '600 18px "Noto Sans Thai", sans-serif';
    ctx.fillText('คำอธิษฐานใต้แสงจันทร์', 450, 278);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 22px "Noto Sans Thai", sans-serif';
    ctx.fillText(`“${latest.design.wishText.slice(0, 62)}”`, 450, 322);

    let cursorY = 398;
    if (state.skyLantern.released) {
      ctx.fillStyle = '#FDE68A';
      ctx.font = '600 18px "Noto Sans Thai", sans-serif';
      const lw = [state.skyLantern.p1Wish, state.skyLantern.p2Wish]
        .filter(Boolean)
        .join(' · ');
      ctx.fillText(
        `🏮 โคมความปรารถนา: ${lw ? lw.slice(0, 68) : 'ปล่อยโคมคู่ขึ้นสู่ท้องฟ้าแล้ว'}`,
        450,
        cursorY
      );
      cursorY += 42;
    }

    if (state.fortunePaper.revealed) {
      ctx.fillStyle = '#FBCFE8';
      ctx.font = '600 18px "Noto Sans Thai", sans-serif';
      ctx.fillText(
        `💌 คำตอบในใจ: ${latest.coupleNames[0]} “${state.fortunePaper.p1Answer.slice(0, 26)}” · ${latest.coupleNames[1]} “${state.fortunePaper.p2Answer.slice(0, 26)}”`,
        450,
        cursorY
      );
      cursorY += 42;
    }

    const latestPhoto = state.photoMemories[state.photoMemories.length - 1];
    if (latestPhoto) {
      ctx.fillStyle = '#BAE6FD';
      ctx.font = '600 18px "Noto Sans Thai", sans-serif';
      ctx.fillText(`📸 ภาพความทรงจำ: “${latestPhoto.caption.slice(0, 56)}”`, 450, cursorY);
    }

    const dateLabel = new Date(latest.releasedAt).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 16px "Noto Sans Thai", sans-serif';
    ctx.fillText(
      `บันทึกไว้ในค่ำคืนวันลอยกระทง · ${dateLabel}`,
      450,
      556
    );

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'loykratong-keepsake-card.png';
    a.click();
  } catch {
    // Graceful no-op in headless/jsdom test environments
  }
}

export function KeepsakeCard({
  state,
  onWatchRiver,
  onStartAnother,
}: KeepsakeCardProps) {
  const latest = state.releasedKrathongs[state.releasedKrathongs.length - 1];
  if (!latest) return null;

  const p1 = state.players.p1;
  const p2 = state.players.p2;
  const latestPhoto = state.photoMemories[state.photoMemories.length - 1];
  const promptText =
    FORTUNE_PROMPTS[state.fortunePaper.promptIndex % FORTUNE_PROMPTS.length];

  const dateText = (() => {
    try {
      return new Date(latest.releasedAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'ค่ำคืนวันลอยกระทง';
    }
  })();

  return (
    <article className="keepsake-card keepsake-card--romantic" aria-label="การ์ดที่ระลึกของทั้งคู่">
      <div className="keepsake-card__badge">🌕 การ์ดที่ระลึกคืนเพ็ญของเราสองคน</div>

      <div className="couple-mini-row">
        <div className="keepsake-avatar-col">
          <AvatarPreview profile={p1} size={62} />
          <span>{latest.coupleNames[0]}</span>
        </div>
        <KrathongIllustration design={latest.design} size={146} />
        <div className="keepsake-avatar-col">
          <AvatarPreview profile={p2} size={62} />
          <span>{latest.coupleNames[1]}</span>
        </div>
      </div>

      <h2 className="keepsake-card__title">
        {latest.coupleNames[0]} ♥ {latest.coupleNames[1]}
      </h2>
      <p className="keepsake-card__date">{dateText}</p>

      <blockquote className="keepsake-card__wish">
        “{latest.design.wishText}”
      </blockquote>

      <div className="keepsake-memories-list">
        {state.skyLantern.released && (
          <div className="keepsake-memory-item">
            <strong>🏮 โคมความปรารถนาบนท้องฟ้า</strong>
            <p>
              {state.skyLantern.p1Wish && (
                <span>
                  {p1.name}: “{state.skyLantern.p1Wish}”
                </span>
              )}
              {state.skyLantern.p1Wish && state.skyLantern.p2Wish && ' · '}
              {state.skyLantern.p2Wish && (
                <span>
                  {p2.name}: “{state.skyLantern.p2Wish}”
                </span>
              )}
              {!state.skyLantern.p1Wish &&
                !state.skyLantern.p2Wish &&
                'ปล่อยโคมยี่เป็งคู่ขึ้นสู่ท้องฟ้าพร้อมกันแล้ว'}
            </p>
          </div>
        )}

        {state.fortunePaper.revealed && (
          <div className="keepsake-memory-item">
            <strong>💌 กระดาษคำทำนาย — {promptText}</strong>
            <p>
              {p1.name}: “{state.fortunePaper.p1Answer}” · {p2.name}: “
              {state.fortunePaper.p2Answer}”
            </p>
          </div>
        )}

        {latestPhoto && (
          <div className="keepsake-memory-item">
            <strong>📸 ภาพความทรงจำจาก Photo Booth</strong>
            <p>“{latestPhoto.caption}”</p>
            {latestPhoto.compositeDataUrl && (
              <img
                src={latestPhoto.compositeDataUrl}
                alt={latestPhoto.caption}
                className="keepsake-photo-thumb"
              />
            )}
          </div>
        )}
      </div>

      <div className="dialog-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => downloadKeepsakeCardPng(state)}
        >
          💾 บันทึกการ์ดที่ระลึก (.PNG)
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onWatchRiver}
        >
          ชมกระทงลอยคู่กันในสายน้ำ
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onStartAnother}
        >
          ทำกระทงใบใหม่ด้วยกัน
        </button>
      </div>
    </article>
  );
}
