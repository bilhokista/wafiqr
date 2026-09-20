// Listing photos, carried in the listing document rather than in object storage.
//
// The photo of a lot is public the moment it is published, so storage bought no
// privacy here — it bought a bucket, a second set of rules, and a setup step
// before anyone can list anything. For a pilot with a handful of lots, putting
// the image in the document it belongs to is less machinery and one less thing
// that can be unreachable.
//
// What it does buy is a hard ceiling. A Firestore document is capped at 1 MiB,
// base64 inflates bytes by about a third, and a photo off a phone is several
// megabytes before either of those apply. So the picture is resized and
// re-encoded in the browser first, and the result is measured rather than
// hoped about: if it still does not fit, the caller is told plainly instead of
// discovering it as a write failure.
//
// This is a pilot decision, not a permanent one. Past a few hundred lots the
// market page would be downloading every photo inline on every visit, which on
// a village connection is the wrong trade — at that point the pictures move to
// a bucket or a CDN and this file goes away.

/** Longest edge after downscaling. Enough for a card and a lot page. */
const MAX_EDGE = 1280;

/** JPEG quality. Below about 0.6 the fibre and colour of an oil start to go. */
const QUALITY = 0.72;

/**
 * Ceiling for the encoded string, well under Firestore's 1 MiB document cap.
 *
 * The rest of a listing — title, spec, description — is small but not nothing,
 * and a document that fits exactly is a document that breaks the first time
 * somebody writes a long specification.
 */
export const MAX_DATA_URL_BYTES = 700_000;

export class ImageTooLarge extends Error {
  constructor(bytes: number) {
    super(
      `That photo is still ${Math.round(bytes / 1024)} KB after resizing, and the limit is ${Math.round(
        MAX_DATA_URL_BYTES / 1024,
      )} KB. Crop it, or pick a picture of just the goods.`,
    );
    this.name = 'ImageTooLarge';
  }
}

/**
 * Reads a file the browser can decode, downscales it, and returns a JPEG data
 * URL small enough to store in a document.
 *
 * Quality is stepped down before the caller is refused, because one photo
 * slightly over the line is common and telling someone to go and re-edit it is
 * a step where a first-time seller gives up.
 */
export async function toStoredImage(file: File): Promise<string> {
  const bitmap = await loadBitmap(file);

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image.');
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [QUALITY, 0.6, 0.5, 0.4]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (byteLength(dataUrl) <= MAX_DATA_URL_BYTES) return dataUrl;
    }

    throw new ImageTooLarge(byteLength(canvas.toDataURL('image/jpeg', 0.4)));
  } finally {
    // Frees the decoded pixels immediately rather than at the next collection,
    // which matters on the phones this is used from.
    bitmap.close?.();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not a picture.');
  }
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('That picture could not be read. Try a JPEG or a PNG.');
  }
}

function fitWithin(width: number, height: number, edge: number) {
  const longest = Math.max(width, height);
  if (longest <= edge) return { width, height };
  const scale = edge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Bytes the stored string will actually occupy, not its character count. */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
