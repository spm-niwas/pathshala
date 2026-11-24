import { PAGE_LIMITS } from '../types/book';

export interface CompressedPhotoPayload {
  previewUrl: string;
  ocrBase64: string;
  ocrMimeType: string;
  archivalDataUrl: string;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the selected photo.'));
    img.src = src;
  });
}

function renderScaledDataUrl(
  source: HTMLImageElement | HTMLCanvasElement,
  maxDimension: number,
  quality: number
): string {
  const naturalWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const naturalHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas is unavailable for image compression.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function buildCompressedPayload(
  source: HTMLImageElement | HTMLCanvasElement
): CompressedPhotoPayload {
  // High-clarity image for Gemini OCR (keeps text sharp, ~250-450 KB)
  const ocrDataUrl = renderScaledDataUrl(source, 1400, 0.82);
  const ocrBase64 = ocrDataUrl.split(',')[1] ?? '';

  // Compact archival image guaranteed well below Firestore 1MB document cap
  let maxDim = 920;
  let quality = 0.62;
  let archivalDataUrl = renderScaledDataUrl(source, maxDim, quality);
  while (archivalDataUrl.length > PAGE_LIMITS.imageDataUrlMax - 20000 && quality > 0.3) {
    quality -= 0.1;
    maxDim = Math.round(maxDim * 0.85);
    archivalDataUrl = renderScaledDataUrl(source, maxDim, quality);
  }

  if (archivalDataUrl.length > PAGE_LIMITS.imageDataUrlMax) {
    throw new Error('Compressed page photo still exceeds safe storage size. Try cropping closer to the page.');
  }

  return {
    previewUrl: archivalDataUrl,
    ocrBase64,
    ocrMimeType: 'image/jpeg',
    archivalDataUrl,
  };
}

export async function compressBookPhoto(file: File): Promise<CompressedPhotoPayload> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    return buildCompressedPayload(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function compressCanvasPhoto(canvas: HTMLCanvasElement): CompressedPhotoPayload {
  return buildCompressedPayload(canvas);
}
