import {
  KRATHONG_BASES,
  KRATHONG_FLOWERS,
  KRATHONG_GLOWS,
  findOption,
} from '../domain/customizationCatalog';
import type { KrathongDesign, KrathongStickerKind } from '../domain/types';

interface KrathongIllustrationProps {
  design: KrathongDesign;
  size?: number;
}

export const STICKER_EMOJI: Record<KrathongStickerKind, { emoji: string; label: string }> = {
  'pink-lotus': { emoji: '🪷', label: 'ดอกบัวชมพู' },
  marigold: { emoji: '🌼', label: 'ดาวเรืองทอง' },
  'crimson-rose': { emoji: '🌹', label: 'กุหลาบแดง' },
  'white-jasmine': { emoji: '🤍', label: 'ดอกมะลิหอม' },
  'folded-leaf': { emoji: '🌿', label: 'กลีบใบตองพับ' },
  'heart-charm': { emoji: '💖', label: 'หัวใจคู่รัก' },
  'candle-spark': { emoji: '🕯️', label: 'เทียนหอม' },
};

export function KrathongIllustration({
  design,
  size = 148,
}: KrathongIllustrationProps) {
  const base = findOption(KRATHONG_BASES, design.base);
  const flower = findOption(KRATHONG_FLOWERS, design.flower);
  const glow = findOption(KRATHONG_GLOWS, design.glow);
  const decorations = design.decorations ?? [];

  return (
    <svg
      viewBox="0 0 180 136"
      width={size}
      height={Math.round(size * (136 / 180))}
      role="img"
      aria-label={`ภาพกระทง${base.label} ประดับ${flower.label} ${glow.label}`}
      className="krathong-svg"
    >
      {/* Warm romantic moonlight aura */}
      <circle cx="90" cy="66" r="56" fill={glow.color} opacity="0.2" />
      <ellipse cx="90" cy="96" rx="70" ry="20" fill={glow.color} opacity="0.14" />

      {/* Water ripple */}
      <ellipse
        cx="90"
        cy="104"
        rx="68"
        ry="15"
        fill="none"
        stroke="#93C5FD"
        strokeWidth="1.5"
        opacity="0.55"
      />

      {/* Base cup */}
      <path d="M30 82 Q90 110 150 82 L140 98 Q90 120 40 98 Z" fill={base.color} />
      <ellipse cx="90" cy="82" rx="60" ry="18" fill={base.accent ?? base.color} />

      {/* Folded banana leaf crown petals */}
      {Array.from({ length: 10 }).map((_, idx) => {
        const angle = (idx / 10) * Math.PI * 2;
        const cx = 90 + Math.cos(angle) * 44;
        const cy = 78 + Math.sin(angle) * 12;
        return (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={8.5}
            fill={idx % 2 === 0 ? flower.color : flower.accent ?? flower.color}
          />
        );
      })}

      {/* Center cushion & incense sticks */}
      <ellipse cx="90" cy="74" rx="22" ry="12" fill={flower.color} opacity="0.88" />
      <line x1="78" y1="68" x2="72" y2="34" stroke="#78350F" strokeWidth="2" />
      <line x1="102" y1="68" x2="108" y2="34" stroke="#78350F" strokeWidth="2" />
      <circle cx="72" cy="33" r="2.2" fill={glow.color} />
      <circle cx="108" cy="33" r="2.2" fill={glow.color} />

      {/* Central wax candle & warm flame */}
      <rect x="86.5" y="40" width="7" height="30" rx="2.5" fill="#FEF3C7" />
      <path d="M90 22 Q98 33 90 41 Q82 33 90 22 Z" fill={glow.color} />
      <circle cx="90" cy="33" r="3" fill="#FFFBEB" />

      {/* Couple's custom placed decorations */}
      {decorations.map((dec) => {
        const sx = 34 + (dec.x / 100) * 112;
        const sy = 50 + (dec.y / 100) * 44;
        return (
          <text
            key={dec.id}
            x={sx}
            y={sy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Math.round(16 * (dec.scale || 1))}
          >
            {STICKER_EMOJI[dec.kind]?.emoji ?? '🪷'}
          </text>
        );
      })}
    </svg>
  );
}
