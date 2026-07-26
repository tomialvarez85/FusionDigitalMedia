import sharp from "sharp";

const WATERMARK_TEXT = "Fusion DigitalMedia";
const PREVIEW_MAX_WIDTH = 1600;

function buildWatermarkSvg(width: number, height: number) {
  const fontSize = Math.max(20, Math.round(width / 22));
  const stepX = fontSize * WATERMARK_TEXT.length * 0.55;
  const stepY = fontSize * 5;

  let tiles = "";
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      tiles += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="700" fill="white" fill-opacity="0.32">${WATERMARK_TEXT}</text>`;
    }
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-30 ${width / 2} ${height / 2})">${tiles}</g>
  </svg>`;
}

export async function buildWatermarkedPreview(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).rotate().metadata();
  const width = metadata.width ?? PREVIEW_MAX_WIDTH;
  const height = metadata.height ?? Math.round(width * 0.67);

  const targetWidth = Math.min(width, PREVIEW_MAX_WIDTH);
  const targetHeight = Math.round((height / width) * targetWidth);

  const watermarkSvg = buildWatermarkSvg(targetWidth, targetHeight);

  return sharp(buffer)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .composite([{ input: Buffer.from(watermarkSvg) }])
    .jpeg({ quality: 82 })
    .toBuffer();
}
