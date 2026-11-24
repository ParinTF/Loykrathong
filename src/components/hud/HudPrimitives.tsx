import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

const paths = {
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm3-3.9a4 4 0 0 1 0 7.8',
  sound: 'M3 9h4l5-4v14l-5-4H3zm13-.5a5 5 0 0 1 0 7m2.8-10a9 9 0 0 1 0 13',
  muted: 'M3 9h4l5-4v14l-5-4H3zm13 1 5 5m0-5-5 5',
  settings: 'M9.8 2.7h4.4l.6 2.7 2 .9 2.4-1.4 2.2 3.8-2 1.9v2.8l2 1.9-2.2 3.8-2.4-1.4-2 .9-.6 2.7H9.8l-.6-2.7-2-.9-2.4 1.4-2.2-3.8 2-1.9v-2.8l-2-1.9 2.2-3.8 2.4 1.4 2-.9zM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0z',
  wardrobe: 'M9.2 5.6a2.8 2.8 0 1 1 4 2.5l-1.2.7v1.3l8.1 4.8a1.8 1.8 0 0 1-.9 3.3H4.8a1.8 1.8 0 0 1-.9-3.3l8.1-4.8',
  lotus: 'M12 19c-2.7-1.5-4.1-4.1-4.1-6.9 0-3.4 2-5.9 4.1-8.1 2.1 2.2 4.1 4.7 4.1 8.1 0 2.8-1.4 5.4-4.1 6.9Zm0 0c-4.3 0-8.2-2.4-9.5-7.2 2.3-.5 4.2 0 5.5.7m4 6.5c4.3 0 8.2-2.4 9.5-7.2-2.3-.5-4.2 0-5.5.7M4.7 20.5h14.6',
  moon: 'M20.6 14.4A8.8 8.8 0 0 1 9.6 3.4a8.8 8.8 0 1 0 11 11zM17 3v4m-2-2h4',
  quest: 'M8 4h10a2 2 0 0 1 2 2v2h-4V6a2 2 0 0 0-4 0v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2h4m8-8v7a5 5 0 0 1-5 5M8 4H6a2 2 0 0 0-2 2v2h4',
  walk: 'M13 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM7 12l3-4 3-.5 2 3.5 3 1m-7-3-1 5 4 2v5m-4-7-2 4-3 2',
  heart: 'M20.6 9c0 4.4-8.6 9.6-8.6 9.6S3.4 13.4 3.4 9a4.2 4.2 0 0 1 8.6-.9 4.2 4.2 0 0 1 8.6.9z',
  candle: 'M9 21h6v-9H9zm3-9V9m0 0c-3.8 0-3.2-3.4.8-6 0 2 1.9 2.4 1.9 4.1 0 1.2-1.1 1.9-2.7 1.9zM6 21h12',
  wave: 'M3 10c3-3 5 3 8 0s5-3 10 0M3 15c3-3 5 3 8 0s5-3 10 0M3 20c3-3 5 3 8 0s5-3 10 0',
  flowers: 'M12 12C6 12 5 8 7.8 6.7c1.3-.6 2.6.2 3.1 1.1C10 4 14.2 3.2 15.2 6.1c.3.9.1 1.6-.2 2.3 3.5-2 6.2 1.7 3.3 3.4-1.3.7-2.5.3-3.3.1 2.1 3.5-1.6 5.8-3.1 3.2-.6-.8-.5-1.9-.4-2.7-2.8 3.1-6.4.4-4.4-1.8M12 13v8m0-2 4-2',
  chevron: 'm6 9 6 6 6-6',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4.5 4.5L19 7',
  compass: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0zm-6.4-2.6-1.6 3.6-3.6 1.6L11 11z',
  link: 'm9 13 6-6m-3-1.3 2-2a4.2 4.2 0 0 1 6 6l-2 2m-6 6.6-2 2a4.2 4.2 0 0 1-6-6l2-2',
  spark: 'M12 2.7c0 5.8 3.5 9.3 9.3 9.3-5.8 0-9.3 3.5-9.3 9.3 0-5.8-3.5-9.3-9.3-9.3 5.8 0 9.3-3.5 9.3-9.3z',
  pad: 'M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
  up: 'M12 19V5m-5 5 5-5 5 5',
  down: 'M12 5v14m-5-5 5 5 5-5',
  left: 'M19 12H5m5-5-5 5 5 5',
  right: 'M5 12h14m-5-5 5 5-5 5',
} as const;

export type HudIconName = keyof typeof paths;

export function HudIcon({ name, className }: { name: HudIconName; className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

interface HudIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: HudIconName;
  label: string;
}

export function HudIconButton({ icon, label, className = '', ...props }: HudIconButtonProps) {
  return (
    <button {...props} type="button" className={`hud-icon-button ${className}`} aria-label={label}>
      <HudIcon name={icon} />
      <span className="hud-tooltip" aria-hidden="true">{label}</span>
    </button>
  );
}

export function HudDialog({ title, detail, onDismiss, children }: {
  title: string;
  detail?: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const detailId = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog ref={dialog} className="hud-modal" aria-labelledby={titleId} aria-describedby={detail ? detailId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}>
      <div className="hud-modal__header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {detail && <p id={detailId}>{detail}</p>}
        </div>
        <HudIconButton icon="close" label="ปิด" onClick={onDismiss} autoFocus />
      </div>
      <div className="hud-modal__body">{children}</div>
    </dialog>
  );
}

export function HudSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="hud-setting-row">
      <span>{label}</span>
      <input type="checkbox" role="switch" className="hud-switch" checked={checked} onChange={onChange} />
    </label>
  );
}
