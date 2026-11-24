import type {
  CouplePoseId,
  PhotoBackdropId,
  PhotoBoothFilterId,
  PhotoBoothLayoutId,
  PlayerProfile,
} from '../../domain/types';

export interface CoupleShotPair {
  p1DataUrl: string | null;
  p2DataUrl: string | null;
}

export const FILTER_CSS: Record<PhotoBoothFilterId, string> = {
  natural: 'none',
  'warm-candle': 'sepia(0.24) saturate(1.22) brightness(1.04) contrast(1.03)',
  'moonlight-film': 'contrast(1.06) saturate(0.92) hue-rotate(-8deg) brightness(1.02)',
  'classic-bw': 'grayscale(1) contrast(1.12) brightness(1.04)',
};

export const FILTER_LABELS: Record<PhotoBoothFilterId, string> = {
  natural: 'ใสธรรมชาติ',
  'warm-candle': 'แสงเทียนอุ่น',
  'moonlight-film': 'ฟิล์มคืนเพ็ญ',
  'classic-bw': 'ขาวดำคลาสสิก',
};

const POSE_LABELS: Record<CouplePoseId, string> = {
  'sit-moon': '🌕 นั่งเคียงข้างชมจันทร์',
  'hold-hands': '🤝 จับมือกันข้ามจอ',
  'warm-hug': '🫂 โอบกอดอุ่นๆ',
  'heart-hands': '🫶 ทำมือครึ่งหัวใจชนกัน',
};

/**
 * Center-crops a live <video> frame onto a canvas (cover-fit, never stretches faces)
 * with optional selfie mirror and filter, returning a JPEG data URL.
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  targetW: number,
  targetH: number,
  mirrored: boolean,
  filter: PhotoBoothFilterId,
  quality = 0.72
): string | null {
  try {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const targetRatio = targetW / targetH;
    const srcRatio = vw / vh;
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;
    if (srcRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }

    ctx.save();
    if (filter !== 'natural' && 'filter' in ctx) {
      ctx.filter = FILTER_CSS[filter];
    }
    if (mirrored) {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

function loadImageSafe(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const targetRatio = w / h;
  const srcRatio = iw / ih;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (srcRatio > targetRatio) {
    sw = ih * targetRatio;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetRatio;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawHalfSlot(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  profile: PlayerProfile,
  accentColor: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (img) {
    drawCoverImage(ctx, img, x, y, w, h);
  } else {
    // Graceful romantic moonlit portrait placeholder if this partner has camera off
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, '#13203C');
    bg.addColorStop(1, '#0A1328');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    const cx = x + w / 2;
    const cy = y + h * 0.45;
    const r = Math.min(w, h) * 0.24;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FDE68A';
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.round(r * 0.46)}px "Noto Sans Thai", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((profile.name || profile.id).slice(0, 10), cx, cy);

    ctx.fillStyle = 'rgba(244, 233, 212, 0.72)';
    ctx.font = `500 ${Math.max(13, Math.round(r * 0.26))}px "Noto Sans Thai", sans-serif`;
    ctx.fillText('โหมดอวตารคืนเพ็ญ', cx, cy + r + 24);
  }

  // Subtle romantic bottom name tag inside photo corner
  ctx.fillStyle = 'rgba(10, 15, 36, 0.56)';
  ctx.fillRect(x, y + h - 34, w, 34);
  ctx.fillStyle = '#FEF3C7';
  ctx.font = '600 16px "Noto Sans Thai", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(profile.name || profile.id, x + w / 2, y + h - 17);

  ctx.restore();
}

function getThemePalette(backdrop: PhotoBackdropId) {
  switch (backdrop) {
    case 'cream-minimal':
      return {
        outerBgTop: '#F9F4EA',
        outerBgBot: '#EFE5D1',
        border: '#C9A25B',
        titleColor: '#1E293B',
        subColor: '#64748B',
        ornament: '#D4A359',
      };
    case 'yipeng':
      return {
        outerBgTop: '#1A1332',
        outerBgBot: '#3B1E36',
        border: '#FBBF24',
        titleColor: '#FEF3C7',
        subColor: '#FDE68A',
        ornament: '#F59E0B',
      };
    case 'river':
      return {
        outerBgTop: '#0A192F',
        outerBgBot: '#13314A',
        border: '#93C5FD',
        titleColor: '#F8FAFC',
        subColor: '#BAE6FD',
        ornament: '#FDE68A',
      };
    case 'sala':
    default:
      return {
        outerBgTop: '#0C1428',
        outerBgBot: '#1C294A',
        border: '#D4B477',
        titleColor: '#F4E9D4',
        subColor: '#D4B477',
        ornament: '#FDE68A',
      };
  }
}

export interface RenderedPhotoBoothOutput {
  hdPngDataUrl: string | null;
  compactJpegDataUrl: string | null;
}

/**
 * Composites P1 (left) and P2 (right) real camera snaps seamlessly into either a
 * single Romantic Polaroid frame or a 4-Cut Photo Booth Strip.
 */
export async function renderCouplePhotoBoothComposite(options: {
  shots: CoupleShotPair[];
  p1: PlayerProfile;
  p2: PlayerProfile;
  layout: PhotoBoothLayoutId;
  backdrop: PhotoBackdropId;
  pose: CouplePoseId;
  caption: string;
}): Promise<RenderedPhotoBoothOutput> {
  try {
    const { shots, p1, p2, layout, backdrop, pose, caption } = options;
    const isStrip = layout === 'strip-4';
    const shotCount = isStrip ? 4 : 1;
    const palette = getThemePalette(backdrop);

    const width = isStrip ? 760 : 960;
    const padding = isStrip ? 38 : 44;
    const headerH = isStrip ? 84 : 76;
    const footerH = isStrip ? 148 : 156;
    const shotGap = isStrip ? 18 : 0;
    const innerW = width - padding * 2;
    const halfW = Math.floor(innerW / 2);
    const shotH = isStrip ? 350 : 540;
    const height =
      headerH + shotCount * shotH + (shotCount - 1) * shotGap + footerH;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { hdPngDataUrl: null, compactJpegDataUrl: null };

    // Frame background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, palette.outerBgTop);
    bgGrad.addColorStop(1, palette.outerBgBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Outer double border
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, width - 28, height - 28);

    // Top festival header
    ctx.fillStyle = palette.ornament;
    ctx.font = '700 22px "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `🌕 คืนเพ็ญของเราสองคน · ${isStrip ? '4-CUT PHOTOBOOTH' : 'LOY KRATHONG BOOTH'}`,
      width / 2,
      headerH / 2 + 4
    );

    // Preload all images in parallel (fallback to uploaded portrait if camera snap missing)
    const loadedPairs = await Promise.all(
      Array.from({ length: shotCount }, async (_, idx) => {
        const pair = shots[idx] ?? shots[shots.length - 1] ?? {
          p1DataUrl: null,
          p2DataUrl: null,
        };
        const [img1, img2] = await Promise.all([
          loadImageSafe(pair.p1DataUrl ?? p1.portrait.dataUrl),
          loadImageSafe(pair.p2DataUrl ?? p2.portrait.dataUrl),
        ]);
        return { img1, img2 };
      })
    );

    // Draw each joined couple shot row (P1 left + P2 right, seamlessly meeting in center!)
    for (let i = 0; i < shotCount; i += 1) {
      const y = headerH + i * (shotH + shotGap);
      const { img1, img2 } = loadedPairs[i];

      drawHalfSlot(ctx, img1, p1, '#DB2777', padding, y, halfW, shotH);
      drawHalfSlot(
        ctx,
        img2,
        p2,
        '#D97706',
        padding + halfW,
        y,
        innerW - halfW,
        shotH
      );

      // Subtle moonlit golden photo frame & center shimmer dot
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(padding, y, innerW, shotH);

      // Little moon & lantern corner accents
      ctx.fillStyle = 'rgba(253, 230, 138, 0.85)';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🏮', padding + 10, y + 26);
      ctx.textAlign = 'right';
      ctx.fillText('✨', padding + innerW - 10, y + 26);
    }

    // Bottom Polaroid / Strip footer
    const footerTop = height - footerH;
    ctx.fillStyle = palette.titleColor;
    ctx.font = '700 28px "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      caption.trim() || `คืนเพ็ญแสนอบอุ่นของ ${p1.name} และ ${p2.name}`,
      width / 2,
      footerTop + 44
    );

    ctx.fillStyle = palette.subColor;
    ctx.font = '600 20px "Noto Sans Thai", sans-serif';
    ctx.fillText(
      `${p1.name}  ♥  ${p2.name}   ·   ${POSE_LABELS[pose]}`,
      width / 2,
      footerTop + 86
    );

    const dateStr = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    ctx.font = '500 16px "Noto Sans Thai", sans-serif';
    ctx.fillText(dateStr, width / 2, footerTop + 120);

    const hdPngDataUrl = canvas.toDataURL('image/png');

    // Also build a compact JPEG thumbnail (max 560px wide) for smooth room sync & album preview
    const thumbCanvas = document.createElement('canvas');
    const thumbScale = Math.min(1, 560 / width);
    thumbCanvas.width = Math.round(width * thumbScale);
    thumbCanvas.height = Math.round(height * thumbScale);
    const tCtx = thumbCanvas.getContext('2d');
    let compactJpegDataUrl: string | null = null;
    if (tCtx) {
      tCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      compactJpegDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);
    }

    return { hdPngDataUrl, compactJpegDataUrl };
  } catch {
    return { hdPngDataUrl: null, compactJpegDataUrl: null };
  }
}
