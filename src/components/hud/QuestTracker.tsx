import { useId, useState, type ReactNode } from 'react';
import { HudIcon } from './HudPrimitives';

export interface HudMemories {
  boatDone: boolean;
  leafDone: boolean;
  fortuneDone: boolean;
  lanternReleased: boolean;
  krathongCrafted: boolean;
  photoCount: number;
  releasedCount: number;
}

function suggestion(memories: HudMemories): [string, string] {
  if (memories.releasedCount > 0) {
    return [
      'ค่ำคืนแสนอบอุ่นของเราสองคน',
      'เดินเล่นถ่ายรูปคู่ พายเรือชมหิ่งห้อย หรือเปิดการ์ดที่ระลึกได้ทุกเมื่อ',
    ];
  }
  if (memories.krathongCrafted) {
    return [
      'กระทงใบเดียวในโลกพร้อมแล้ว',
      'เดินจูงมือไปท่าน้ำแสงจันทร์เมื่อพร้อม หรือแวะถ่ายรูปคู่ก่อนก็ได้',
    ];
  }
  if (!memories.boatDone && !memories.leafDone && !memories.fortuneDone) {
    return [
      'เดินเล่นตามใจชอบได้เลย',
      'พายเรือเก็บบัว พับใบตอง ตอบกระดาษคำทำนาย ปล่อยโคม หรือไปทำกระทงทันทีก็ได้',
    ];
  }
  return [
    'เก็บความทรงจำด้วยกันต่อได้เลย',
    'แวะโต๊ะประดิษฐ์สร้างกระทงที่มีเพียงใบเดียวในโลก หรือไปนั่งชมจันทร์ถ่ายรูปคู่',
  ];
}

function MemoryItem({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className={done ? 'is-complete' : undefined}>
      <span className="visually-hidden">{done ? 'ทำร่วมกันแล้ว' : 'ยังไม่ได้แวะ'}</span>
      <HudIcon name={done ? 'check' : 'heart'} />
      <div>{children}</div>
    </li>
  );
}

export function QuestTracker({
  memories,
  onOpenKeepsake,
}: {
  memories: HudMemories;
  onOpenKeepsake?: () => void;
}) {
  const [open, setOpen] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 760px)').matches) || false
  );
  const bodyId = useId();
  const [title, hint] = suggestion(memories);

  return (
    <aside className="hud-quest hud-surface" aria-label="สมุดความทรงจำคืนนี้">
      <button
        className="hud-quest__toggle"
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <HudIcon name="heart" />
        <span>คืนนี้ของเรา</span>
        <HudIcon name="chevron" className="hud-chevron" />
      </button>
      <div className="hud-quest__body" id={bodyId} hidden={!open}>
        <h2>{title}</h2>
        <p className="hud-quest__hint">{hint}</p>

        {memories.releasedCount > 0 && onOpenKeepsake && (
          <button
            type="button"
            className="hud-text-button hud-text-button--primary hud-keepsake-btn"
            onClick={onOpenKeepsake}
          >
            <HudIcon name="spark" /> เปิดการ์ดที่ระลึกของเรา
          </button>
        )}

        <details className="hud-quest__details">
          <summary>จุดกิจกรรมโรแมนติกในงาน</summary>
          <ul className="hud-quest__steps">
            <MemoryItem done={memories.boatDone}>
              <strong>01 · พายเรือเก็บดอกบัวด้วยกัน</strong>
              <span>สวนหิ่งห้อย — สลับกันพายเรือและเก็บบัวชมพู</span>
            </MemoryItem>
            <MemoryItem done={memories.leafDone}>
              <strong>02 · ช่วยกันพับใบตอง</strong>
              <span>ซุ้มป้าบัว — เจียนใบตองส่งต่อให้อีกคนพับกลีบ</span>
            </MemoryItem>
            <MemoryItem done={memories.fortuneDone}>
              <strong>03 · กระดาษคำทำนายของเราสองคน</strong>
              <span>ซุ้มลุงมั่น — แอบตอบคำถามแล้วเปิดอ่านพร้อมกัน</span>
            </MemoryItem>
            <MemoryItem done={memories.lanternReleased}>
              <strong>04 · ส่งความปรารถนาขึ้นสู่ท้องฟ้า</strong>
              <span>ลานโคมยี่เป็ง — เขียนพรและปล่อยโคมดวงพิเศษด้วยกัน</span>
            </MemoryItem>
            <MemoryItem done={memories.krathongCrafted}>
              <strong>06 · สร้างกระทงใบเดียวในโลก</strong>
              <span>ลานกลางงาน — ช่วยกันลากวางดอกไม้และตกแต่งสดๆ</span>
            </MemoryItem>
            <MemoryItem done={memories.photoCount > 0}>
              <strong>07 · จุดชมวิวและถ่ายรูปคู่</strong>
              <span>
                ศาลาชมจันทร์ &amp; ม้านั่งริมน้ำ
                {memories.photoCount > 0 ? ` (${memories.photoCount} ภาพ)` : ''}
              </span>
            </MemoryItem>
            <MemoryItem done={memories.releasedCount > 0}>
              <strong>08 · คำอธิษฐานใต้แสงจันทร์</strong>
              <span>ท่าน้ำไม้สัก — กดปล่อยกระทงพร้อมกันและรับการ์ดที่ระลึก</span>
            </MemoryItem>
          </ul>
        </details>
      </div>
    </aside>
  );
}
