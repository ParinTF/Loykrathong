import {
  KRATHONG_BASES,
  KRATHONG_FLOWERS,
  KRATHONG_GLOWS,
  findOption,
} from '../domain/customizationCatalog';
import type { KrathongDesign, KrathongQualitySummary } from '../domain/types';

interface KrathongIllustrationProps {
  design: KrathongDesign;
  quality?: KrathongQualitySummary;
  size?: number;
}

export function KrathongIllustration({
  design,
  quality,
  size = 132,
}: KrathongIllustrationProps) {
  const base = findOption(KRATHONG_BASES, design.base);
  const flower = findOption(KRATHONG_FLOWERS, design.flower);
  const glow = findOption(KRATHONG_GLOWS, design.glow);
  const tier = quality?.tier ?? 'classic';
  const flowerCount = quality ? 4 + quality.flowerLevel * 2 : 6;

  return (
    <svg
      viewBox="0 0 160 120"
      width={size}
      height={Math.round(size * 0.75)}
      role="img"
      aria-label={`ภาพกระทง${base.label} ประดับ${flower.label} ${glow.label}`}
      className="krathong-svg"
    >
      {tier === 'celestial' && (
        <circle cx="80" cy="54" r="52" fill={glow.color} opacity="0.22" />
      )}
      {tier !== 'classic' && (
        <ellipse cx="80" cy="76" rx="64" ry="24" fill={glow.color} opacity="0.18" />
      )}

      <ellipse
        cx="80"
        cy="92"
        rx="62"
        ry="15"
        fill="none"
        stroke="#93C5FD"
        strokeWidth="1.5"
        opacity="0.55"
      />

      <path d="M28 74 Q80 98 132 74 L124 88 Q80 108 36 88 Z" fill={base.color} />
      <ellipse cx="80" cy="74" rx="52" ry="15" fill={base.accent ?? base.color} />

      {Array.from({ length: flowerCount }).map((_, idx) => {
        const angle = (idx / flowerCount) * Math.PI * 2;
        const cx = 80 + Math.cos(angle) * 34;
        const cy = 70 + Math.sin(angle) * 9;
        return (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={tier === 'celestial' ? 9 : 7.5}
            fill={idx % 2 === 0 ? flower.color : flower.accent ?? flower.color}
          />
        );
      })}

      <ellipse cx="80" cy="64" rx="18" ry="11" fill={flower.color} />
      <rect x="77" y="34" width="6" height="28" rx="2" fill="#FEF3C7" />
      <line x1="70" y1="60" x2="66" y2="30" stroke="#78350F" strokeWidth="2" />
      <line x1="90" y1="60" x2="94" y2="30" stroke="#78350F" strokeWidth="2" />
      <circle cx="66" cy="29" r="2.2" fill={glow.color} />
      <circle cx="94" cy="29" r="2.2" fill={glow.color} />

      <path d="M80 18 Q87 28 80 35 Q73 28 80 18 Z" fill={glow.color} />
      <circle cx="80" cy="28" r="2.8" fill="#FFFBEB" />
    </svg>
  );
}