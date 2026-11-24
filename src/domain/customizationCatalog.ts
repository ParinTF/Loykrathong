import type {
  AccessoryId,
  GenderId,
  HairColorId,
  HairStyleId,
  KrathongBaseId,
  KrathongFlowerId,
  KrathongGlowId,
  OutfitId,
  PlayerCustomization,
  SkinToneId,
} from './types';

export interface SwatchOption<T extends string> {
  id: T;
  label: string;
  color: string;
  accent?: string;
}

export const GENDERS: SwatchOption<GenderId>[] = [
  { id: 'female', label: 'ผู้หญิง', color: '#DB2777', accent: '#FCE7F3' },
  { id: 'male', label: 'ผู้ชาย', color: '#D97706', accent: '#FEF3C7' },
  { id: 'nonbinary', label: 'ไม่ระบุ', color: '#059669', accent: '#D1FAE5' },
];

export const DEFAULT_PRESET_BY_GENDER: Record<
  GenderId,
  Pick<PlayerCustomization, 'gender' | 'hairStyle' | 'outfit' | 'accessory'>
> = {
  female: {
    gender: 'female',
    hairStyle: 'long-silky',
    outfit: 'silk-lotus',
    accessory: 'gold-lotus',
  },
  male: {
    gender: 'male',
    hairStyle: 'short-classic',
    outfit: 'chut-thai-gold',
    accessory: 'none',
  },
  nonbinary: {
    gender: 'nonbinary',
    hairStyle: 'wavy-bob',
    outfit: 'lanna-cream',
    accessory: 'jasmine-pin',
  },
};

export const SKIN_TONES: SwatchOption<SkinToneId>[] = [
  { id: 'porcelain', label: 'ขาวนวล', color: '#FBE0CF' },
  { id: 'warm-ivory', label: 'เหลืองนวล', color: '#F3C8A8' },
  { id: 'golden-tan', label: 'น้ำผึ้ง', color: '#DFA579' },
  { id: 'caramel', label: 'แทนอบอุ่น', color: '#C07F56' },
  { id: 'deep-amber', label: 'น้ำตาลเข้ม', color: '#8D5534' },
];

export const HAIR_STYLES: SwatchOption<HairStyleId>[] = [
  { id: 'short-classic', label: 'ผมสั้นเรียบ', color: '#334155' },
  { id: 'long-silky', label: 'ผมยาวสลวย', color: '#334155' },
  { id: 'wavy-bob', label: 'บ๊อบลอนประบ่า', color: '#334155' },
  { id: 'high-ponytail', label: 'รวบหางม้า', color: '#334155' },
  { id: 'curly-crop', label: 'หยักศกนุ่ม', color: '#334155' },
];

export const HAIR_COLORS: SwatchOption<HairColorId>[] = [
  { id: 'obsidian', label: 'ดำขลับ', color: '#1A1E2E' },
  { id: 'espresso', label: 'น้ำตาลเข้ม', color: '#3D271E' },
  { id: 'chestnut', label: 'น้ำตาลประกาย', color: '#6E3F28' },
  { id: 'honey-gold', label: 'คาราเมลทอง', color: '#B77B3D' },
];

export const OUTFITS: SwatchOption<OutfitId>[] = [
  { id: 'chut-thai-gold', label: 'ชุดไทยราชปะแตนทอง', color: '#D97706', accent: '#FEF3C7' },
  { id: 'silk-lotus', label: 'สไบไหมชมพูบัว', color: '#DB2777', accent: '#FCE7F3' },
  { id: 'emerald-sabai', label: 'ชุดไทยเขียวมรกต', color: '#059669', accent: '#D1FAE5' },
  { id: 'lanna-cream', label: 'ผ้าฝ้ายล้านนาครีมแดง', color: '#B91C1C', accent: '#FEF2F2' },
];

export const ACCESSORIES: SwatchOption<AccessoryId>[] = [
  { id: 'none', label: 'ไม่สวมเครื่องประดับ', color: '#26334B' },
  { id: 'gold-lotus', label: 'ปิ่นดอกบัวทอง', color: '#E8B86A' },
  { id: 'jasmine-pin', label: 'ปิ่นมะลิแสงจันทร์', color: '#F4E9D4' },
];

export const KRATHONG_BASES: SwatchOption<KrathongBaseId>[] = [
  { id: 'classic-banana', label: 'ใบตองจีบคลาสสิก', color: '#15803D', accent: '#86EFAC' },
  { id: 'golden-coconut', label: 'กะลาทองคำ', color: '#B45309', accent: '#FDE68A' },
  { id: 'heart-bread', label: 'ขนมปังรูปหัวใจรักษ์น้ำ', color: '#D97706', accent: '#FED7AA' },
];

export const KRATHONG_FLOWERS: SwatchOption<KrathongFlowerId>[] = [
  { id: 'pink-lotus', label: 'ดอกบัวชมพูคู่', color: '#EC4899', accent: '#FBCFE8' },
  { id: 'golden-marigold', label: 'ดาวเรืองทองคำ', color: '#F59E0B', accent: '#FEF08A' },
  { id: 'crimson-rose', label: 'กุหลาบแดงคู่รัก', color: '#E11D48', accent: '#FECDD3' },
];

export const KRATHONG_GLOWS: SwatchOption<KrathongGlowId>[] = [
  { id: 'amber-candle', label: 'แสงเทียนทองอุ่น', color: '#FBBF24' },
  { id: 'moonlight-pearl', label: 'แสงจันทร์นวล', color: '#93C5FD' },
  { id: 'rose-spark', label: 'ประกายชมพูกุหลาบ', color: '#F472B6' },
];

export function findOption<T extends string>(
  list: SwatchOption<T>[],
  id: T
): SwatchOption<T> {
  return list.find((item) => item.id === id) ?? list[0];
}
