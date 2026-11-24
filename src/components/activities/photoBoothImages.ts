export async function loadPhotoImage(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

export function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cropWidth = Math.min(sourceWidth, sourceHeight * width / height);
  const cropHeight = Math.min(sourceHeight, sourceWidth * height / width);
  ctx.drawImage(source, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2,
    cropWidth, cropHeight, x, y, width, height);
}
