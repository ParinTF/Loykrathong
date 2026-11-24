import type {
  CouplePoseId,
  PhotoBackdropId,
  PhotoBoothFilterId,
  PhotoBoothLayoutId,
  PhotoStripThemeId,
  PlayerProfile,
} from '../../domain/types';
import { drawPhotoCover, loadPhotoImage } from './photoBoothImages';
import {
  STRIP_FRAMES,
  STRIP_HEIGHT,
  STRIP_SCALE,
  STRIP_WIDTH,
  paintFrameFooter,
  paintFramePaper,
  stripThemeOf,
} from './photoStripFrames';

export interface CoupleShotPair {
  p1DataUrl: string | null;
  p2DataUrl: string | null;
}

export const FILTER_CSS: Record<PhotoBoothFilterId, string> = {
  natural: 'none',
  'warm-candle': 'sepia(.09) saturate(1.06) brightness(1.03)',
  'moonlight-film': 'contrast(1.04) saturate(.94) hue-rotate(-4deg)',
  'classic-bw': 'grayscale(1) contrast(1.05)',
};

export const FILTER_LABELS: Record<PhotoBoothFilterId, string> = {
  natural: 'ใสธรรมชาติ',
  'warm-candle': 'แสงเทียนอุ่น',
  'moonlight-film': 'ฟิล์มคืนเพ็ญ',
  'classic-bw': 'ขาวดำคลาสสิก',
};

const POSE_LABELS: Record<CouplePoseId, string> = {
  'sit-moon': 'นั่งเคียงข้างชมจันทร์',
  'hold-hands': 'จับมือกันข้ามจอ',
  'warm-hug': 'โอบกอดอุ่น ๆ',
  'heart-hands': 'ทำมือครึ่งหัวใจชนกัน',
};

export function captureVideoFrame(
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirrored: boolean,
  filter: PhotoBoothFilterId,
  quality = 0.72,
): string | null {
  try {
    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.filter = FILTER_CSS[filter];
    if (mirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    drawPhotoCover(ctx, video, video.videoWidth, video.videoHeight, 0, 0, width, height);
    const image = canvas.toDataURL('image/jpeg', quality);
    return image.length < 275_000 ? image : canvas.toDataURL('image/jpeg', .65);
  } catch {
    return null;
  }
}

const POLAROID_PALETTE: Record<PhotoBackdropId, readonly [string, string, string]> = {
  'cream-minimal': ['#f9f4ea', '#efe5d1', '#684d31'],
  yipeng: ['#1a1332', '#3b1e36', '#f6d789'],
  river: ['#0a192f', '#13314a', '#b9d8f5'],
  sala: ['#0c1428', '#1c294a', '#e4c48c'],
};
const ROOM_PHOTO_PREVIEW_LIMIT = 30_000;

function paintPolaroidPaper(ctx: CanvasRenderingContext2D, backdrop: PhotoBackdropId) {
  const [top, bottom, ink] = POLAROID_PALETTE[backdrop] ?? POLAROID_PALETTE.sala;
  const gradient = ctx.createLinearGradient(0, 0, 0, 772);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 772);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(15, 15, 930, 742);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '22px Georgia, serif';
  ctx.fillText('LOY KRATHONG', 480, 40);
}

function encodeAlbumPreview(canvas: HTMLCanvasElement): string | null {
  const thumbnail = document.createElement('canvas');
  const ctx = thumbnail.getContext('2d');
  if (!ctx) return null;
  // The room sends up to twelve previews together in one 512 KiB message.
  for (const [width, quality] of [[360, .74], [280, .69], [220, .64], [160, .6]]) {
    thumbnail.width = Math.min(canvas.width, width);
    thumbnail.height = Math.round(canvas.height * thumbnail.width / canvas.width);
    ctx.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
    const jpeg = thumbnail.toDataURL('image/jpeg', quality);
    if (jpeg.startsWith('data:image/jpeg') && jpeg.length <= ROOM_PHOTO_PREVIEW_LIMIT) return jpeg;
  }
  return null;
}

export interface RenderedPhotoBoothOutput {
  png: Blob;
  compactJpegDataUrl: string | null;
}

export async function renderCouplePhotoBoothComposite(options: {
  shots: CoupleShotPair[];
  p1: PlayerProfile;
  p2: PlayerProfile;
  layout: PhotoBoothLayoutId;
  frameTheme?: PhotoStripThemeId;
  backdrop: PhotoBackdropId;
  pose: CouplePoseId;
  caption: string;
  takenAt?: number;
}): Promise<RenderedPhotoBoothOutput | null> {
  try {
    const { shots, p1, p2, layout, backdrop, pose, caption } = options;
    const isStrip = layout === 'strip-4';
    const theme = stripThemeOf(options.frameTheme);
    const frame = isStrip ? STRIP_FRAMES[theme] : { inset: 44, top: 76, rowHeight: 540, rowGap: 0, seam: 0 };
    const width = isStrip ? STRIP_WIDTH : 960;
    const height = isStrip ? STRIP_HEIGHT : 772;
    const scale = isStrip ? STRIP_SCALE : 1;
    const halfWidth = (width - frame.inset * 2 - frame.seam) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    const names = [p1.name || 'ผู้เล่น 1', p2.name || 'ผู้เล่น 2'] as const;
    const date = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric',
    }).format(options.takenAt ?? Date.now());
    const fonts = document.fonts;
    if (fonts) {
      const copy = [...names, caption, date].join(' ');
      await Promise.allSettled([
        fonts.load('500 14px "Noto Sans Thai"', copy),
        ...(isStrip && theme === 'love-letter'
          ? [fonts.load('500 40px Mali', 'Love Letter ' + copy)]
          : isStrip ? [fonts.load('500 25px "Noto Serif Thai"', copy)] : []),
      ]);
    }

    const rows = await Promise.all(Array.from({ length: isStrip ? 4 : 1 }, (_, index) =>
      Promise.all([loadPhotoImage(shots[index]?.p1DataUrl), loadPhotoImage(shots[index]?.p2DataUrl)])
    ));
    const profiles = [p1, p2];
    const missing = profiles.filter((_, index) => rows.some((row) => !row[index]));
    const studio = missing.length
      ? await (await import('./photoBoothAvatar')).createPhotoBoothAvatarStudio(
        missing, halfWidth / frame.rowHeight, backdrop
      )
      : null;

    ctx.scale(scale, scale);
    try {
      if (isStrip) paintFramePaper(ctx, theme);
      else paintPolaroidPaper(ctx, backdrop);
      rows.forEach((row, index) => {
        const y = frame.top + index * (frame.rowHeight + frame.rowGap);
        row.forEach((image, person) => {
          const x = frame.inset + person * (halfWidth + frame.seam);
          if (image) {
            drawPhotoCover(ctx, image, image.naturalWidth, image.naturalHeight, x, y, halfWidth, frame.rowHeight);
          } else {
            studio!.draw(ctx, profiles[person].id, index, x, y, halfWidth, frame.rowHeight);
          }
        });
      });
      if (isStrip) {
        paintFrameFooter(ctx, theme, { names, caption, date });
      } else {
        ctx.fillStyle = (POLAROID_PALETTE[backdrop] ?? POLAROID_PALETTE.sala)[2];
        ctx.font = '500 27px "Noto Sans Thai", sans-serif';
        ctx.fillText(caption.trim() || names.join('  &  '), 480, 660, 850);
        ctx.font = '500 16px "Noto Sans Thai", sans-serif';
        ctx.fillText(POSE_LABELS[pose] + ' · ' + date, 480, 712, 850);
      }
    } finally {
      studio?.dispose();
    }

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return png ? { png, compactJpegDataUrl: encodeAlbumPreview(canvas) } : null;
  } catch (error) {
    console.warn('Photo booth composition failed.', error);
    return null;
  }
}
