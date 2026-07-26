import sharp from "sharp";

const WATERMARK_TEXT = "Fusion DigitalMedia";
const PREVIEW_MAX_DIMENSION = 1000;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildWatermarkSvg(width: number, height: number) {
  // Randomizado por imagen: dificulta automatizar la remoción masiva del
  // patrón, ya que cada preview tiene un ángulo/tamaño/espaciado distinto.
  const angle = randomBetween(-35, -25);
  const fontScale = randomBetween(0.85, 1.15);
  const gapScale = randomBetween(1.1, 1.2);
  const patternOpacity = randomBetween(0.2, 0.25);

  const fontSize = Math.max(16, Math.round((width / 22) * fontScale));
  const stepX = fontSize * WATERMARK_TEXT.length * 0.55 * gapScale;
  const stepY = fontSize * 5 * gapScale;

  let tiles = "";
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      tiles += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="700" fill="black" fill-opacity="${patternOpacity.toFixed(
        2
      )}">${WATERMARK_TEXT}</text>`;
    }
  }

  // Marca central: más grande y más opaca, cubre el centro de la imagen
  // (no solo el fondo), lo que la hace más difícil de reconstruir vía
  // inpainting sin dejar rastros visibles.
  const centralOpacity = randomBetween(0.35, 0.4);
  const centralFontSize = Math.round(fontSize * randomBetween(2.5, 3.2));

  const centralMark = `
    <text
      x="${width / 2}"
      y="${height / 2}"
      font-size="${centralFontSize}"
      font-family="Arial, sans-serif"
      font-weight="800"
      fill="black"
      fill-opacity="${centralOpacity.toFixed(2)}"
      text-anchor="middle"
      dominant-baseline="middle"
    >${WATERMARK_TEXT}</text>
  `;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${angle} ${width / 2} ${height / 2})">
      ${tiles}
      ${centralMark}
    </g>
  </svg>`;
}

export async function buildWatermarkedPreview(buffer: Buffer): Promise<Buffer> {
  // 1) Redimensionar primero: el lado más largo queda en máximo 1000px,
  // manteniendo la relación de aspecto. Esto es intencionalmente más
  // agresivo que solo la marca de agua: aunque alguien logre quitar el
  // watermark, la imagen resultante no sirve para imprimir en buena calidad.
  const resizedBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: PREVIEW_MAX_DIMENSION,
      height: PREVIEW_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();

  const { width, height } = await sharp(resizedBuffer).metadata();
  const targetWidth = width ?? PREVIEW_MAX_DIMENSION;
  const targetHeight = height ?? PREVIEW_MAX_DIMENSION;

  const watermarkSvg = buildWatermarkSvg(targetWidth, targetHeight);

  return sharp(resizedBuffer)
    .composite([{ input: Buffer.from(watermarkSvg) }])
    .jpeg({ quality: 82 })
    .toBuffer();
}
