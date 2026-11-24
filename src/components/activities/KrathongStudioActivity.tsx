import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  KRATHONG_BASES,
  KRATHONG_FLOWERS,
  KRATHONG_GLOWS,
  findOption,
} from '../../domain/customizationCatalog';
import type {
  CoopSignalEvent,
  KrathongDecorationItem,
  KrathongDesign,
  KrathongStickerKind,
  MaterialId,
  PlayerId,
  PlayerProfile,
} from '../../domain/types';
import { playChime } from '../../game/sound';
import { STICKER_EMOJI } from '../KrathongIllustration';

interface KrathongStudioActivityProps {
  design: KrathongDesign;
  inventory: Record<MaterialId, boolean>;
  crafted: boolean;
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  lastSignal: CoopSignalEvent | null;
  soundEnabled: boolean;
  onUpdateDesign: (patch: Partial<KrathongDesign>) => void;
  onAddDecoration: (item: KrathongDecorationItem) => void;
  onMoveDecoration: (id: string, x: number, y: number) => void;
  onRemoveDecoration: (id: string) => void;
  onClearDecorations: () => void;
  onCraftKrathong: (byPlayer: PlayerId) => void;
  onSendSignal?: (
    spotId: string,
    action: string,
    value?: number,
    x?: number,
    y?: number
  ) => void;
}

const STICKER_PALETTE: KrathongStickerKind[] = [
  'pink-lotus',
  'marigold',
  'crimson-rose',
  'white-jasmine',
  'folded-leaf',
  'heart-charm',
  'candle-spark',
];

export function KrathongStudioActivity({
  design,
  inventory,
  crafted,
  players,
  myRole,
  bothOnline,
  lastSignal,
  soundEnabled,
  onUpdateDesign,
  onAddDecoration,
  onMoveDecoration,
  onRemoveDecoration,
  onClearDecorations,
  onCraftKrathong,
  onSendSignal,
}: KrathongStudioActivityProps) {
  const [selectedTool, setSelectedTool] =
    useState<KrathongStickerKind>('pink-lotus');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    'ช่วยกันเลือกสีและลากวางดอกไม้บนกระทงใบเดียวกันได้ทันที'
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const dragPointerRef = useRef<number | null>(null);
  const lastMoveSignalRef = useRef(0);

  const baseOpt = findOption(KRATHONG_BASES, design.base);
  const flowerOpt = findOption(KRATHONG_FLOWERS, design.flower);
  const glowOpt = findOption(KRATHONG_GLOWS, design.glow);

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return { x: 50, y: 50 };
    }
    const x = Math.max(
      12,
      Math.min(88, Math.round(((clientX - rect.left) / rect.width) * 100))
    );
    const y = Math.max(
      12,
      Math.min(88, Math.round(((clientY - rect.top) / rect.height) * 100))
    );
    return { x, y };
  };

  const placeAt = (x: number, y: number) => {
    if (design.decorations.length >= 24) {
      setAnnouncement('วางของตกแต่งครบ 24 ชิ้นแล้ว ลบชิ้นที่ไม่ต้องการเพื่อเพิ่มชิ้นใหม่ได้');
      return;
    }
    const id = `dec-${myRole}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const item: KrathongDecorationItem = {
      id,
      kind: selectedTool,
      x,
      y,
      scale: selectedTool === 'candle-spark' ? 1.08 : 1,
      placedBy: myRole,
    };
    playChime('pickup', soundEnabled);
    onAddDecoration(item);
    setSelectedItemId(id);
    setAnnouncement(
      `วาง${STICKER_EMOJI[selectedTool].label}ลงบนกระทงแล้ว สามารถลากหรือใช้ปุ่มลูกศรเพื่อปรับตำแหน่งได้`
    );
  };

  const handleStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const { x, y } = toCanvasCoords(event.clientX, event.clientY);
    placeAt(x, y);
  };

  const handleItemPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: KrathongDecorationItem
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    dragPointerRef.current = event.pointerId;
    setDraggingId(item.id);
    setSelectedItemId(item.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleItemPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: KrathongDecorationItem
  ) => {
    if (draggingId !== item.id || dragPointerRef.current !== event.pointerId) {
      return;
    }
    const { x, y } = toCanvasCoords(event.clientX, event.clientY);
    onMoveDecoration(item.id, x, y);
    const now = performance.now();
    if (now - lastMoveSignalRef.current >= 90) {
      lastMoveSignalRef.current = now;
      onSendSignal?.('craft-bench', 'partner-cursor', 0, x, y);
    }
  };

  const finishDrag = (item: KrathongDecorationItem) => {
    if (draggingId !== item.id) return;
    dragPointerRef.current = null;
    setDraggingId(null);
    setAnnouncement(
      `เลื่อน${STICKER_EMOJI[item.kind].label}ไปยังตำแหน่ง ${item.x}%, ${item.y}% แล้ว`
    );
  };

  const handleItemKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    item: KrathongDecorationItem
  ) => {
    const step = 4;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onMoveDecoration(item.id, item.x - step, item.y);
      setAnnouncement(`ขยับ${STICKER_EMOJI[item.kind].label}ไปทางซ้าย`);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onMoveDecoration(item.id, item.x + step, item.y);
      setAnnouncement(`ขยับ${STICKER_EMOJI[item.kind].label}ไปทางขวา`);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMoveDecoration(item.id, item.x, item.y - step);
      setAnnouncement(`ขยับ${STICKER_EMOJI[item.kind].label}ขึ้นด้านบน`);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMoveDecoration(item.id, item.x, item.y + step);
      setAnnouncement(`ขยับ${STICKER_EMOJI[item.kind].label}ลงด้านล่าง`);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemoveDecoration(item.id);
      setSelectedItemId(null);
      setAnnouncement(`นำ${STICKER_EMOJI[item.kind].label}ออกจากกระทงแล้ว`);
    }
  };

  const partnerRole: PlayerId = myRole === 'p1' ? 'p2' : 'p1';
  const partnerCursor =
    bothOnline &&
    lastSignal &&
    lastSignal.spotId === 'craft-bench' &&
    lastSignal.action === 'partner-cursor' &&
    lastSignal.playerId === partnerRole &&
    typeof lastSignal.x === 'number' &&
    typeof lastSignal.y === 'number'
      ? { x: lastSignal.x, y: lastSignal.y }
      : null;

  const gatheredCount = Object.values(inventory).filter(Boolean).length;

  return (
    <section
      className="romantic-activity krathong-studio"
      aria-label="สร้างกระทงที่มีเพียงใบเดียวในโลก"
    >
      <div className="dialogue-bubble">
        <p>
          ช่วยกันตกแต่งกระทงที่มีเพียงใบเดียวในโลกของเราสองคน! แตะวางหรือลากจัดดอกไม้และเทียนลงบนกระทง
          อีกฝ่ายจะเห็นทุกการเปลี่ยนแปลงแบบเรียลไทม์ ไม่มีคะแนนและไม่จับเวลา
        </p>
        {gatheredCount > 0 && (
          <p className="studio-souvenir-note">
            ✨ ของขวัญที่ทั้งคู่ช่วยกันหามาคืนนี้ ({gatheredCount}/3):{' '}
            {inventory['lotus-blossom'] ? '🪷 ดอกบัวหิ่งห้อย ' : ''}
            {inventory['banana-leaf'] ? '🌿 กลีบใบตองพับ ' : ''}
            {inventory['candle-incense'] ? '🕯️ ธูปเทียนลุงมั่น' : ''}
          </p>
        )}
      </div>

      <div className="studio-layout">
        {/* Shared Live Krathong Drag-and-Place Canvas */}
        <div className="studio-canvas-col">
          <div
            ref={stageRef}
            className="krathong-live-stage"
            onClick={handleStageClick}
            role="group"
            aria-label="พื้นที่ตกแต่งกระทงร่วมกัน แตะเพื่อวางของตกแต่งที่เลือก หรือลากชิ้นส่วนเพื่อจัดวาง"
          >
            {/* Base Krathong Top-Down Artistic Ring */}
            <div
              className="krathong-live-stage__aura"
              style={{ background: `radial-gradient(circle, ${glowOpt.color}44 0%, transparent 72%)` }}
              aria-hidden="true"
            />
            <div
              className="krathong-live-stage__ring"
              style={{
                borderColor: baseOpt.accent ?? baseOpt.color,
                background: `radial-gradient(circle, ${flowerOpt.color}38 0%, ${baseOpt.color}cc 68%, #0f172a 100%)`,
              }}
              aria-hidden="true"
            />
            <div
              className="krathong-live-stage__inner"
              style={{ borderColor: flowerOpt.accent ?? '#FDE68A' }}
              aria-hidden="true"
            />

            {/* Draggable Placed Decorations */}
            {design.decorations.map((item) => {
              const meta = STICKER_EMOJI[item.kind];
              const isSelected = selectedItemId === item.id;
              const isDragging = draggingId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`krathong-sticker-handle ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    transform: `translate(-50%, -50%) scale(${item.scale || 1})`,
                  }}
                  aria-label={`${meta.label} วางโดย ${players[item.placedBy].name} ใช้ปุ่มลูกศรเพื่อเลื่อน หรือ Delete เพื่อลบ`}
                  aria-pressed={isSelected}
                  onPointerDown={(e) => handleItemPointerDown(e, item)}
                  onPointerMove={(e) => handleItemPointerMove(e, item)}
                  onPointerUp={() => finishDrag(item)}
                  onPointerCancel={() => finishDrag(item)}
                  onLostPointerCapture={() => finishDrag(item)}
                  onKeyDown={(e) => handleItemKeyDown(e, item)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemId(item.id);
                  }}
                >
                  <span aria-hidden="true">{meta.emoji}</span>
                </button>
              );
            })}

            {partnerCursor && (
              <div
                className="partner-live-cursor"
                style={{ left: `${partnerCursor.x}%`, top: `${partnerCursor.y}%` }}
                aria-hidden="true"
              >
                <span>✨ {players[partnerRole].name}</span>
              </div>
            )}
          </div>

          {/* Palette & Quick Actions */}
          <div className="sticker-palette" role="group" aria-label="เลือกของตกแต่งกระทง">
            {STICKER_PALETTE.map((kind) => {
              const meta = STICKER_EMOJI[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  className={`palette-chip ${selectedTool === kind ? 'is-selected' : ''}`}
                  aria-pressed={selectedTool === kind}
                  onClick={() => {
                    setSelectedTool(kind);
                    playChime('beat', soundEnabled);
                  }}
                >
                  <span aria-hidden="true">{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          <div className="studio-toolbar">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                const angle = (design.decorations.length * 1.15) % (Math.PI * 2);
                const r = design.decorations.length % 2 === 0 ? 18 : 26;
                placeAt(
                  Math.round(50 + Math.cos(angle) * r),
                  Math.round(50 + Math.sin(angle) * r)
                );
              }}
            >
              + วาง{STICKER_EMOJI[selectedTool].label}ลงบนกระทง
            </button>
            {selectedItemId && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  onRemoveDecoration(selectedItemId);
                  setSelectedItemId(null);
                  setAnnouncement('นำของตกแต่งที่เลือกออกแล้ว');
                }}
              >
                ลบชิ้นที่เลือก
              </button>
            )}
            {design.decorations.length > 0 && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  onClearDecorations();
                  setSelectedItemId(null);
                }}
              >
                จัดหน้ากระทงใหม่
              </button>
            )}
          </div>
        </div>

        {/* Base, Flower, Candle & Wish Options */}
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
                    checked={design.base === b.id}
                    onChange={() => {
                      playChime('beat', soundEnabled);
                      onUpdateDesign({ base: b.id });
                    }}
                    className="visually-hidden"
                  />
                  <span>{b.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="swatch-fieldset">
            <legend className="field-label">โทนดอกไม้หลัก</legend>
            <div className="chip-grid">
              {KRATHONG_FLOWERS.map((f) => (
                <label key={f.id} className="chip-option chip-option--compact">
                  <input
                    type="radio"
                    name="krathong-flower"
                    value={f.id}
                    checked={design.flower === f.id}
                    onChange={() => {
                      playChime('beat', soundEnabled);
                      onUpdateDesign({ flower: f.id });
                    }}
                    className="visually-hidden"
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="swatch-fieldset">
            <legend className="field-label">แสงเทียนคู่รัก</legend>
            <div className="chip-grid">
              {KRATHONG_GLOWS.map((g) => (
                <label key={g.id} className="chip-option chip-option--compact">
                  <input
                    type="radio"
                    name="krathong-glow"
                    value={g.id}
                    checked={design.glow === g.id}
                    onChange={() => {
                      playChime('beat', soundEnabled);
                      onUpdateDesign({ glow: g.id });
                    }}
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
              value={design.wishText}
              onChange={(e) => onUpdateDesign({ wishText: e.target.value })}
            />
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => {
                playChime('success', soundEnabled);
                onCraftKrathong(myRole);
              }}
            >
              {crafted
                ? '✨ อัปเดตกระทงใบเดียวในโลกของเรา'
                : '🪷 บันทึกกระทงใบเดียวในโลกของเรา'}
            </button>
          </div>
          {crafted && (
            <p className="status-badge status-badge--ok">
              ✓ บันทึกกระทงของเราแล้ว! เดินจูงมือไปที่ท่าน้ำแสงจันทร์ได้ทุกเมื่อที่พร้อม
            </p>
          )}
        </div>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
