import { useEffect, useId, useRef, useState } from 'react';
import { HudIconButton, type HudIconName } from './HudPrimitives';

const emotes: { icon: HudIconName; emoji: string; text: string }[] = [
  { icon: 'heart', emoji: '💖', text: 'คิดถึงนะ' },
  { icon: 'lotus', emoji: '🪷', text: 'มาเจอกันตรงนี้เร็ว!' },
  { icon: 'candle', emoji: '🕯️', text: 'ไปช่วยกันทำกระทงกัน' },
  { icon: 'wave', emoji: '🌊', text: 'ไปท่าน้ำแสงจันทร์กัน!' },
];

export function EmoteWheel({ onSend }: { onSend: (emoji: string, text: string) => void }) {
  const [open, setOpen] = useState(false);
  const groupId = useId();
  const root = useRef<HTMLDivElement>(null);

  function dismiss() {
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>('.hud-emote__trigger')?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return (
    <div ref={root} className="hud-emote" data-open={open} onKeyDown={(event) => {
      if (open && event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      }
    }}>
      <HudIconButton icon={open ? 'close' : 'heart'} className="hud-emote__trigger"
        label={open ? 'ปิดวงล้อคู่รัก' : 'วงล้อคู่รัก'} aria-expanded={open} aria-controls={groupId}
        onClick={() => setOpen((value) => !value)} />
      <div id={groupId} className="hud-emote__options" role="group" aria-label="ส่งความรู้สึกถึงคู่รัก" hidden={!open}>
        {emotes.map(({ icon, text, emoji }) => (
          <HudIconButton key={icon} icon={icon} label={`ส่งข้อความ ${text}`} onClick={() => {
            onSend(emoji, text);
            dismiss();
          }} />
        ))}
      </div>
    </div>
  );
}
