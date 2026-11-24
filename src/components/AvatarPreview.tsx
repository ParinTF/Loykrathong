import type { PlayerProfile } from '../domain/types';
import {
  HAIR_COLORS,
  OUTFITS,
  SKIN_TONES,
  findOption,
} from '../domain/customizationCatalog';

interface AvatarPreviewProps {
  profile: PlayerProfile;
  size?: number;
  decorative?: boolean;
}

export function AvatarPreview({
  profile,
  size = 64,
  decorative = false,
}: AvatarPreviewProps) {
  const hasPhoto =
    profile.portrait.status === 'ready' && Boolean(profile.portrait.dataUrl);

  if (hasPhoto && profile.portrait.dataUrl) {
    return (
      <div
        className="avatar-frame avatar-frame--photo"
        style={{ width: size, height: size }}
      >
        <img
          src={profile.portrait.dataUrl}
          alt={decorative ? '' : `รูปใบหน้าของ ${profile.name || profile.id}`}
          width={size}
          height={size}
          className="avatar-photo-img"
        />
      </div>
    );
  }

  const skin = findOption(SKIN_TONES, profile.customization.skinTone).color;
  const hair = findOption(HAIR_COLORS, profile.customization.hairColor).color;
  const outfit = findOption(OUTFITS, profile.customization.outfit);
  const hairStyle = profile.customization.hairStyle;

  return (
    <div
      className="avatar-frame avatar-frame--svg"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role={decorative ? undefined : 'img'}
        aria-hidden={decorative ? true : undefined}
        aria-label={decorative ? undefined : `ภาพอวตารของ ${profile.name || profile.id}`}
      >
        <circle cx="32" cy="32" r="31" fill="#131B36" />
        {(hairStyle === 'long-silky' || hairStyle === 'wavy-bob') && (
          <rect
            x="16"
            y="14"
            width="32"
            height={hairStyle === 'long-silky' ? 38 : 28}
            rx="14"
            fill={hair}
          />
        )}
        {hairStyle === 'high-ponytail' && (
          <circle cx="32" cy="10" r="8" fill={hair} />
        )}

        <path d="M12 62 C12 46, 52 46, 52 62 Z" fill={outfit.color} />
        <path
          d="M20 48 L44 58 L38 62 L18 55 Z"
          fill={outfit.accent ?? '#FDE68A'}
          opacity="0.92"
        />

        <rect x="28" y="38" width="8" height="8" rx="3" fill={skin} />
        <circle cx="32" cy="28" r="13" fill={skin} />

        {hairStyle === 'curly-crop' ? (
          <g fill={hair}>
            <circle cx="23" cy="18" r="6" />
            <circle cx="32" cy="15" r="7" />
            <circle cx="41" cy="18" r="6" />
          </g>
        ) : (
          <path d="M18 26 C18 13, 46 13, 46 26 C42 20, 22 20, 18 26 Z" fill={hair} />
        )}

        <circle cx="27" cy="29" r="1.8" fill="#0F172A" />
        <circle cx="37" cy="29" r="1.8" fill="#0F172A" />
        <path
          d="M28 34 Q32 37 36 34"
          fill="none"
          stroke="#7C2D12"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}