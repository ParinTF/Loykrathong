import type { SpotKind } from './types';

export interface LandmarkAsset {
  id: string;
  imagePath: string;
  textureKey: string;
  placeTitle: string;
  locationNote: string;
  alt: string;
  credit: string;
}

export const LANDMARK_ASSETS: Record<
  'sala' | 'market' | 'sukhothai' | 'yipeng' | 'river' | 'lotus',
  LandmarkAsset
> = {
  sala: {
    id: 'sala',
    imagePath: '/landmarks/sala-pavilion.jpg',
    textureKey: 'landmark-sala',
    placeTitle: 'ศาลาไทยริมน้ำทรงจัตุรมุข',
    locationNote: 'แรงบันดาลใจจากศาลาไทยหลังคาแดงทองสะท้อนผืนน้ำ จ.ชลบุรี',
    alt: 'ศาลาไทยไม้หลังคาแดงทองสะท้อนเงาบนผิวน้ำท่ามกลางสวนร่มรื่น',
    credit: 'Wikimedia Commons · PattayaPatrol (CC BY-SA 4.0)',
  },
  market: {
    id: 'market',
    imagePath: '/landmarks/amphawa-market.jpg',
    textureKey: 'landmark-market',
    placeTitle: 'ตลาดน้ำยามค่ำคืนอัมพวา',
    locationNote: 'แรงบันดาลใจจากตลาดริมคลองอัมพวา จ.สมุทรสงคราม',
    alt: 'บรรยากาศเรือนไม้และแสงไฟอบอุ่นริมคลองตลาดน้ำอัมพวายามค่ำคืน',
    credit: 'Wikimedia Commons · Antoine Fleury-Gobert (CC BY-SA 3.0)',
  },
  sukhothai: {
    id: 'sukhothai',
    imagePath: '/landmarks/sukhothai-krathong.jpg',
    textureKey: 'landmark-sukhothai',
    placeTitle: 'งานเผาเทียนเล่นไฟ อุทยานประวัติศาสตร์สุโขทัย',
    locationNote: 'ต้นกำเนิดประเพณีลอยกระทงและศิลปะกระทงใบตองโบราณ จ.สุโขทัย',
    alt: 'บรรยากาศงานเทศกาลลอยกระทงเผาเทียนเล่นไฟยามค่ำคืนที่สุโขทัย',
    credit: 'Wikimedia Commons · Dan Lundberg (CC BY-SA 2.0)',
  },
  yipeng: {
    id: 'yipeng',
    imagePath: '/landmarks/yipeng-chiangmai.jpg',
    textureKey: 'landmark-yipeng',
    placeTitle: 'ซุ้มโคมยี่เป็งล้านนา เชียงใหม่',
    locationNote: 'แรงบันดาลใจจากเทศกาลโคมยี่เป็งล้านนา จ.เชียงใหม่',
    alt: 'โคมยี่เป็งส่องแสงสีทองเรียงรายสว่างไสวในเทศกาลยี่เป็งเชียงใหม่',
    credit: 'Wikimedia Commons · Nik Cyclist (CC BY 2.0)',
  },
  river: {
    id: 'river',
    imagePath: '/landmarks/river-krathong.jpg',
    textureKey: 'landmark-river',
    placeTitle: 'สายน้ำแห่งคำอธิษฐาน คืนวันเพ็ญ',
    locationNote: 'บรรยากาศการลอยกระทงอธิษฐานริมสายน้ำยามค่ำคืน จ.เชียงใหม่',
    alt: 'กระทงจุดเทียนสว่างไสวลอยคู่กันบนผิวน้ำในคืนวันลอยกระทง',
    credit: 'Wikimedia Commons · Deba Prasad Roy (CC0)',
  },
  lotus: {
    id: 'lotus',
    imagePath: '/landmarks/pink-lotus.jpg',
    textureKey: 'landmark-lotus',
    placeTitle: 'สระบัวหลวงสีชมพู',
    locationNote: 'ดอกบัวหลวงบานรับแสงจันทร์ สัญลักษณ์แห่งความรักบริสุทธิ์',
    alt: 'ดอกบัวหลวงสีชมพูบานสะพรั่งเหนือใบบัวสีเขียวริมสระน้ำ',
    credit: 'Wikimedia Commons · Hong Zhang (CC0)',
  },
};

export function getLandmarkForSpotKind(kind: SpotKind): LandmarkAsset {
  switch (kind) {
    case 'pavilion':
      return LANDMARK_ASSETS.sala;
    case 'npc':
      return LANDMARK_ASSETS.market;
    case 'lantern':
      return LANDMARK_ASSETS.yipeng;
    case 'gather':
      return LANDMARK_ASSETS.lotus;
    case 'craft':
      return LANDMARK_ASSETS.sukhothai;
    case 'pier':
      return LANDMARK_ASSETS.river;
  }
}
