import {
  ACCESSORIES,
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFITS,
  SKIN_TONES,
  type SwatchOption,
} from '../../domain/customizationCatalog';
import type { PlayerCustomization, PlayerProfile } from '../../domain/types';
import { AvatarPreview } from '../AvatarPreview';
import { HudDialog } from './HudPrimitives';

type WardrobeProfile = Pick<PlayerProfile, 'id' | 'name' | 'portrait' | 'customization'>;

function WardrobeField<T extends string>({ label, options, selected, onChange }: {
  label: string; options: SwatchOption<T>[]; selected: T; onChange: (value: T) => void;
}) {
  return (
    <label className="hud-setting-row">
      <span>{label}</span>
      <select value={selected} onChange={(event) => {
        const match = options.find((option) => option.id === event.target.value);
        if (match) onChange(match.id);
      }}>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function WardrobePanel({ profile, connected, onChange, onDismiss }: {
  profile: WardrobeProfile;
  connected: boolean;
  onChange: (patch: Partial<PlayerCustomization>) => void;
  onDismiss: () => void;
}) {
  const { customization } = profile;
  return (
    <HudDialog title="ตู้เสื้อผ้า" onDismiss={onDismiss}>
      <div className="hud-wardrobe-preview"><AvatarPreview profile={profile} size={70} decorative /><strong>{profile.name}</strong></div>
      {!connected && <p role="status" className="hud-room__summary">กำลังเชื่อมต่อกลับเข้าห้อง รอสักครู่ก่อนเปลี่ยนชุด</p>}
      <fieldset className="hud-setting-group" disabled={!connected}>
        <legend>แต่งตัวละครของคุณ</legend>
        <WardrobeField label="เพศตัวละคร" options={GENDERS} selected={customization.gender ?? 'female'} onChange={(gender) => onChange({ gender })} />
        <WardrobeField label="ทรงผม" options={HAIR_STYLES} selected={customization.hairStyle} onChange={(hairStyle) => onChange({ hairStyle })} />
        <WardrobeField label="สีผม" options={HAIR_COLORS} selected={customization.hairColor} onChange={(hairColor) => onChange({ hairColor })} />
        <WardrobeField label="สีผิว" options={SKIN_TONES} selected={customization.skinTone} onChange={(skinTone) => onChange({ skinTone })} />
        <WardrobeField label="ชุดไทย" options={OUTFITS} selected={customization.outfit} onChange={(outfit) => onChange({ outfit })} />
        <WardrobeField label="เครื่องประดับ" options={ACCESSORIES} selected={customization.accessory} onChange={(accessory) => onChange({ accessory })} />
      </fieldset>
    </HudDialog>
  );
}
