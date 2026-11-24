import type { PhotoStripThemeId } from '../../domain/types';

export const DEFAULT_STRIP_THEME: PhotoStripThemeId = 'moonlight-romance';
export const STRIP_WIDTH = 540;
export const STRIP_HEIGHT = 1560;
export const STRIP_SCALE = 2;

export const STRIP_FRAMES = {
  'moonlight-romance': {
    title: 'Moonlight Romance', background: '#101a31', ink: '#f5e9d5', detail: '#cead7a',
    inset: 34, top: 106, rowHeight: 320, rowGap: 14, seam: 6,
  },
  'ivory-memories': {
    title: 'Ivory Memories', background: '#f2e9d5', ink: '#372f23', detail: '#7b7252',
    inset: 43, top: 122, rowHeight: 312, rowGap: 16, seam: 10,
  },
  'love-letter': {
    title: 'Love Letter', background: '#e9c7cb', ink: '#542e38', detail: '#8b5260',
    inset: 35, top: 117, rowHeight: 315, rowGap: 16, seam: 10,
  },
  'golden-festival': {
    title: 'Golden Festival', background: '#12362e', ink: '#f4e4bd', detail: '#c8a871',
    inset: 39, top: 123, rowHeight: 312, rowGap: 14, seam: 4,
  },
} as const satisfies Record<PhotoStripThemeId, {
  title: string; background: string; ink: string; detail: string;
  inset: number; top: number; rowHeight: number; rowGap: number; seam: number;
}>;

export function stripThemeOf(theme?: PhotoStripThemeId): PhotoStripThemeId {
  return theme && Object.hasOwn(STRIP_FRAMES, theme) ? theme : DEFAULT_STRIP_THEME;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function spark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + 1, y - 1, x + size, y);
  ctx.quadraticCurveTo(x + 1, y + 1, x, y + size);
  ctx.quadraticCurveTo(x - 1, y + 1, x - size, y);
  ctx.quadraticCurveTo(x - 1, y - 1, x, y - size);
  ctx.fill();
}

function moon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-.22);
  ctx.beginPath();
  ctx.arc(0, 0, radius, .83, Math.PI * 1.73);
  ctx.quadraticCurveTo(-radius * .29, radius * .15, radius * .675, radius * .738);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function lotus(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-13, -9, 0, -23);
  ctx.quadraticCurveTo(13, -9, 0, 0);
  ctx.quadraticCurveTo(-18, 3, -24, -8);
  ctx.quadraticCurveTo(-10, -11, 0, 0);
  ctx.quadraticCurveTo(18, 3, 24, -8);
  ctx.quadraticCurveTo(10, -11, 0, 0);
  ctx.stroke();
  ctx.restore();
}

function sprig(ctx: CanvasRenderingContext2D, x: number, y: number, turn: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.bezierCurveTo(4, -6, 3, -25, 15, -43);
  ctx.stroke();
  for (const [lx, ly, yaw, size] of [[3, -5, -1, 14], [5, -14, 1.15, 16], [6, -23, -.79, 13], [10, -32, .89, 12], [15, -42, .34, 9]]) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(yaw);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, -size * .48, 0, -size);
    ctx.quadraticCurveTo(5, -size * .55, 0, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-20, -4, -13, -17, 0, -9);
  ctx.bezierCurveTo(13, -17, 20, -4, 0, 7);
  ctx.stroke();
  ctx.restore();
}

function lantern(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-7, -13);
  ctx.bezierCurveTo(-19, -3, -16, 10, -7, 15);
  ctx.lineTo(7, 15);
  ctx.bezierCurveTo(16, 10, 19, -3, 7, -13);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, -12);
  ctx.quadraticCurveTo(-10, 2, -4, 14);
  ctx.moveTo(7, -12);
  ctx.quadraticCurveTo(10, 2, 4, 14);
  ctx.stroke();
  line(ctx, 0, -31, 0, -13);
  line(ctx, 0, 15, 0, 22);
  ctx.restore();
}

function grain(ctx: CanvasRenderingContext2D, ink: [number, number, number], amount: number) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 94;
  const tc = tile.getContext('2d');
  if (!tc) return;
  const noise = tc.createImageData(94, 94);
  let state = 88213;
  for (let i = 0; i < noise.data.length; i += 4) {
    state = (1664525 * state + 1013904223) >>> 0;
    noise.data[i] = ink[0];
    noise.data[i + 1] = ink[1];
    noise.data[i + 2] = ink[2];
    noise.data[i + 3] = (state >>> 24) < 35 ? amount : 0;
  }
  tc.putImageData(noise, 0, 0);
  const texture = ctx.createPattern(tile, 'repeat');
  if (texture) {
    ctx.fillStyle = texture;
    ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  }
}

function centeredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) {
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y, max);
}

function fineBrand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.font = '500 10px "Noto Sans Thai", sans-serif';
  centeredText(ctx, 'L O Y   K R A T H O N G', x, y, 220);
}

export function paintFramePaper(ctx: CanvasRenderingContext2D, theme: PhotoStripThemeId): void {
  const frame = STRIP_FRAMES[theme];
  ctx.save();
  ctx.fillStyle = frame.background;
  ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  ctx.lineWidth = .95;
  ctx.strokeStyle = frame.detail;
  ctx.fillStyle = frame.detail;
  ctx.textBaseline = 'middle';

  switch (theme) {
    case 'moonlight-romance':
      fineBrand(ctx, 109, 27);
      ctx.textAlign = 'left';
      ctx.fillStyle = frame.ink;
      ctx.font = 'italic 37px Georgia, serif';
      ctx.fillText(frame.title, 33, 65, 400);
      line(ctx, 34, 88, 498, 88);
      ctx.fillStyle = frame.detail;
      moon(ctx, 468, 48, 20);
      spark(ctx, 491, 32, 4);
      spark(ctx, 439, 55, 2.5);
      spark(ctx, 500, 59, 2.5);
      break;
    case 'ivory-memories':
      grain(ctx, [51, 42, 26], 18);
      ctx.fillStyle = frame.detail;
      ctx.strokeStyle = frame.detail;
      ctx.strokeRect(16, 16, 508, 1528);
      sprig(ctx, 75, 96, .53, 1.2);
      sprig(ctx, 468, 103, -.5, .94);
      fineBrand(ctx, 270, 33);
      ctx.fillStyle = frame.ink;
      ctx.font = '33px Georgia, serif';
      centeredText(ctx, frame.title, 270, 71, 355);
      line(ctx, 208, 95, 332, 95);
      break;
    case 'love-letter':
      grain(ctx, [103, 58, 66], 15);
      ctx.strokeStyle = frame.detail;
      ctx.fillStyle = frame.detail;
      fineBrand(ctx, 111, 28);
      ctx.fillStyle = frame.ink;
      ctx.font = '500 40px Mali, "Noto Sans Thai", cursive';
      ctx.textAlign = 'left';
      ctx.fillText(frame.title, 42, 70, 350);
      ctx.save();
      ctx.translate(439, 58);
      ctx.rotate(-.12);
      ctx.strokeRect(-38, -18, 76, 42);
      ctx.beginPath();
      ctx.moveTo(-38, -18);
      ctx.lineTo(0, 6);
      ctx.lineTo(38, -18);
      ctx.stroke();
      heart(ctx, 0, 6, .74);
      ctx.restore();
      ctx.fillStyle = '#f5e4c999';
      ctx.save();
      ctx.translate(49, 108);
      ctx.rotate(-.18);
      ctx.fillRect(-20, -5, 47, 10);
      ctx.restore();
      break;
    case 'golden-festival':
      ctx.strokeRect(17, 17, 506, 1526);
      for (const sx of [-1, 1]) {
        const x = 270 + sx * 173;
        lantern(ctx, x, 65, .91);
        lantern(ctx, x + sx * 31, 40, .66);
      }
      fineBrand(ctx, 270, 43);
      ctx.fillStyle = frame.ink;
      ctx.font = '32px Georgia, serif';
      centeredText(ctx, frame.title, 270, 79, 300);
      lotus(ctx, 270, 112, .37);
      break;
  }
  ctx.restore();
}

export function paintFrameFooter(ctx: CanvasRenderingContext2D, theme: PhotoStripThemeId, options: {
  names: readonly [string, string];
  caption: string;
  date: string;
}): void {
  const frame = STRIP_FRAMES[theme];
  const names = options.names.join('  &  ');
  const caption = options.caption.trim();
  const x = theme === 'love-letter' ? 204 : 270;
  ctx.save();
  ctx.lineWidth = .85;
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = frame.detail;
  ctx.fillStyle = frame.ink;
  ctx.font = theme === 'love-letter' ? '500 23px Mali, "Noto Sans Thai", cursive'
    : '500 25px "Noto Serif Thai", Georgia, serif';
  centeredText(ctx, names, x, 1467, theme === 'love-letter' ? 330 : 426);
  ctx.fillStyle = frame.detail;
  if (caption) {
    ctx.font = '500 15px "Noto Sans Thai", sans-serif';
    centeredText(ctx, caption, x, 1498, theme === 'love-letter' ? 330 : 426);
  }
  ctx.font = '500 13px "Noto Sans Thai", sans-serif';
  centeredText(ctx, options.date, x, caption ? 1524 : 1498, 330);

  switch (theme) {
    case 'moonlight-romance':
      lotus(ctx, 470, 1534, .55);
      for (const right of [false, true]) {
        ctx.save();
        ctx.translate(right ? 508 : 33, 1537);
        if (right) ctx.scale(-1, 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(44, -6, 78, 0);
        ctx.quadraticCurveTo(110, 5, 153, 0);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 'ivory-memories':
      sprig(ctx, 70, 1516, .66, 1);
      sprig(ctx, 472, 1518, -.48, 1);
      break;
    case 'love-letter':
      ctx.save();
      ctx.translate(440, 1487);
      ctx.rotate(-.27);
      ctx.strokeRect(-31, -27, 62, 54);
      ctx.strokeRect(-26, -22, 52, 44);
      heart(ctx, 0, 0, .9);
      ctx.restore();
      break;
    case 'golden-festival':
      for (const direction of [-1, 1]) {
        ctx.save();
        ctx.translate(270 + direction * 191, 1496);
        ctx.scale(direction, 1);
        lotus(ctx, 0, 22, .76);
        line(ctx, 32, 22, 49, 22);
        ctx.restore();
      }
      break;
  }
  ctx.restore();
}
