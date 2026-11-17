export interface CompressedProofingPhoto {
  fileName: string;
  mimeType: string;
  blob: Blob;
  sizeBytes: number;
  width: number;
  height: number;
}

const MAX_LONG_EDGE_PX = 2048;
const DEFAULT_QUALITY = 0.82;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function loadBitmapOrImage(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to HTMLImageElement
    }
  }

  const objectUrl = URL.createObjectURL(file);
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read image file "${file.name}".`));
    };
    img.src = objectUrl;
  });
}

/**
 * Resizes and compresses a camera photo in-browser for cloud proofing while
 * strictly preserving the original camera filename (for Lightroom matching).
 */
export async function compressProofingPhoto(
  file: File,
  options?: { maxEdge?: number; quality?: number }
): Promise<CompressedProofingPhoto> {
  const maxEdge = options?.maxEdge ?? MAX_LONG_EDGE_PX;
  const quality = options?.quality ?? DEFAULT_QUALITY;

  const source = await loadBitmapOrImage(file);
  try {
    const srcW = Math.max(1, source.width);
    const srcH = Math.max(1, source.height);
    const longEdge = Math.max(srcW, srcH);

    // If image is already compact web-friendly JPEG/WebP/PNG within dimension and <320 KB, keep original blob
    if (
      longEdge <= maxEdge &&
      file.size <= 320 * 1024 &&
      ["image/webp", "image/jpeg", "image/png"].includes(file.type.toLowerCase())
    ) {
      return {
        fileName: file.name,
        mimeType: file.type.toLowerCase(),
        blob: file,
        sizeBytes: file.size,
        width: srcW,
        height: srcH,
      };
    }

    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Browser canvas is unavailable for image compression.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    source.draw(ctx, targetW, targetH);

    let mimeType = "image/webp";
    let blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") {
      mimeType = "image/jpeg";
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }

    if (!blob) {
      throw new Error(`Failed to compress "${file.name}".`);
    }

    // Never bloat an already small JPEG/PNG
    if (blob.size > file.size && longEdge <= maxEdge && file.size <= 2 * 1024 * 1024) {
      return {
        fileName: file.name,
        mimeType: file.type || mimeType,
        blob: file,
        sizeBytes: file.size,
        width: srcW,
        height: srcH,
      };
    }

    return {
      fileName: file.name,
      mimeType,
      blob,
      sizeBytes: blob.size,
      width: targetW,
      height: targetH,
    };
  } finally {
    source.cleanup();
  }
}
