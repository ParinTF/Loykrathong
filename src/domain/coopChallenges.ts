import type { CoopPairProgress, PlayerId, SpotKind } from './types';

export type CoopChallengeMechanic =
  | 'lotus-pond'
  | 'leaf-fold'
  | 'incense-memory'
  | 'lantern-lift'
  | 'sala-bells';

export interface CoopChallengeSpec {
  spotId: string;
  mechanic: CoopChallengeMechanic;
  title: string;
  p1TaskLabel: string;
  p2TaskLabel: string;
  instruction: string;
  difficultyLabel: string;
}

export const INCENSE_SYMBOLS = [
  { id: 'candle', emoji: '🕯️', label: 'เทียนน้ำผึ้ง' },
  { id: 'jasmine', emoji: '🪷', label: 'มาลัยมะลิ' },
  { id: 'sandalwood', emoji: '🪔', label: 'กำยานจันทน์' },
  { id: 'saisin', emoji: '🧵', label: 'สายสิญจน์ทอง' },
] as const;

export const P1_INCENSE_ORDER = ['candle', 'jasmine', 'sandalwood', 'saisin'] as const;
export const P2_INCENSE_ORDER = ['jasmine', 'saisin', 'candle', 'sandalwood'] as const;

export const LEAF_FOLD_TARGETS: Record<PlayerId, [number, number, number]> = {
  p1: [0.5, 0.32, 0.68],
  p2: [0.5, 0.68, 0.32],
};

export const SALA_BELL_TARGETS: Record<PlayerId, [number, number, number]> = {
  p1: [0.5, 0.36, 0.64],
  p2: [0.5, 0.64, 0.36],
};

export function getCoopChallengeSpec(
  spotId: string,
  kind: SpotKind
): CoopChallengeSpec | null {
  if (spotId === 'gather-lotus' || kind === 'gather') {
    return {
      spotId,
      mechanic: 'lotus-pond',
      title: 'ภารกิจคู่รัก: จังหวะเก็บดอกบัวบานกลางสระหิ่งห้อย',
      p1TaskLabel: 'ฝั่งผู้เล่น 1: เก็บบัวชมพูบานฝั่งจันทร์ (3 ดอก)',
      p2TaskLabel: 'ฝั่งผู้เล่น 2: เก็บบัวชมพูบานฝั่งดาว (3 ดอก)',
      instruction:
        'แตะเฉพาะใบบัวที่ "🪷 บานเต็มที่!" ให้ครบคนละ 3 ดอก ห้ามแตะบัวตูมหรือกบน้อย (พลาดได้ไม่เกิน 3 ครั้ง)',
      difficultyLabel: 'ความท้าทายคู่รัก ★★☆',
    };
  }

  if (spotId === 'npc-bua') {
    return {
      spotId,
      mechanic: 'leaf-fold',
      title: 'ภารกิจคู่รัก: เจียนใบตอง & พับกลีบประสานมือ',
      p1TaskLabel: 'ฝั่งผู้เล่น 1: เจียนใบตองตานีตามเส้นทอง (3 แผ่น)',
      p2TaskLabel: 'ฝั่งผู้เล่น 2: พับกลีบผีเสื้อ & กลัดไม้กลัด (3 กลีบ)',
      instruction:
        'หยุดเกจมีดเจียน/การพับให้ตรงแถบสีทองที่เปลี่ยนตำแหน่งทั้ง 3 รอบ ต้องผ่านครบทั้งสองคนจึงจะได้ชุดใบตอง!',
      difficultyLabel: 'ความท้าทายคู่รัก ★★☆',
    };
  }

  if (spotId === 'npc-man') {
    return {
      spotId,
      mechanic: 'incense-memory',
      title: 'ภารกิจคู่รัก: จำรหัสเครื่องหอมมงคล 4 ทิศ',
      p1TaskLabel: 'ฝั่งผู้เล่น 1: เรียงเครื่องหอมชุดแสงเทียน (4 ขั้น)',
      p2TaskLabel: 'ฝั่งผู้เล่น 2: เรียงเครื่องหอมชุดสายสิญจน์ (4 ขั้น)',
      instruction:
        'จดจำลำดับเครื่องหอม 4 ชิ้นที่ลุงมั่นแสดงชั่วครู่ แล้วกดเรียงตามลำดับให้ถูกต้องทั้งสองคน!',
      difficultyLabel: 'ความท้าทายคู่รัก ★★★',
    };
  }

  if (kind === 'lantern') {
    const level = spotId.endsWith('3') ? 3 : spotId.endsWith('2') ? 2 : 1;
    return {
      spotId,
      mechanic: 'lantern-lift',
      title: `ภารกิจคู่รัก: ประคองไฟลมร้อนปล่อยโคมยี่เป็ง (ดวงที่ ${level})`,
      p1TaskLabel: 'ฝั่งผู้เล่น 1: ประคองไฟเตาซ้ายเข้าโซนลอยตัว (68–88%)',
      p2TaskLabel: 'ฝั่งผู้เล่น 2: ประคองไฟเตาขวาเข้าโซนลอยตัว (68–88%)',
      instruction:
        'กดเติมไฟต้านลมหนาวให้เกจลมร้อนอยู่ในช่วง 68%–88% แล้วกด "ล็อกสมดุลปล่อยโคม!" ระวังอย่าให้ไฟเกิน 95%!',
      difficultyLabel: level === 3 ? 'ลมแรงพิเศษ ★★★' : 'ความท้าทายคู่รัก ★★☆',
    };
  }

  if (kind === 'pavilion') {
    return {
      spotId,
      mechanic: 'sala-bells',
      title: 'ภารกิจคู่รัก: บรรเลงระฆังคู่ประสานเสียงจันทร์เพ็ญ',
      p1TaskLabel: 'ฝั่งผู้เล่น 1: ตีระฆังเอกรับแสงจันทร์ (3 กังวาน)',
      p2TaskLabel: 'ฝั่งผู้เล่น 2: ตีระฆังทุ้มประสานเสียงน้ำ (3 กังวาน)',
      instruction:
        'รอให้คลื่นแสงจันทร์เคลื่อนเข้าสู่วงระฆังทอง แล้วเคาะระฆังให้กังวานครบคนละ 3 ครั้งเพื่อรับพรคู่รัก',
      difficultyLabel: 'ความท้าทายคู่รัก ★★☆',
    };
  }

  return null;
}

export function isCoopPairComplete(progress: CoopPairProgress | undefined): boolean {
  return Boolean(progress && progress.p1Done && progress.p2Done);
}
