// Barcodes lezen uit de camera of uit een foto.
// Chrome en Android hebben een ingebouwde BarcodeDetector; Safari (iPhone) niet, daar gebruiken we ZXing.

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

type Source = HTMLVideoElement | HTMLImageElement | ImageBitmap | HTMLCanvasElement;

export interface Decoder {
  /** Leest een barcode uit een videobeeld of afbeelding, of geeft null. */
  decode(source: Source): Promise<string | null>;
  kind: 'native' | 'zxing';
}

async function nativeDecoder(): Promise<Decoder | null> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: object): NativeDetector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const supported = (await BD.getSupportedFormats?.()) ?? FORMATS;
    if (!FORMATS.some((f) => supported.includes(f))) return null;
    const det = new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
    return {
      kind: 'native',
      decode: async (src) => {
        const res = await det.detect(src).catch(() => []);
        return res[0]?.rawValue ?? null;
      },
    };
  } catch {
    return null;
  }
}

const size = (src: Source) =>
  src instanceof HTMLVideoElement ? [src.videoWidth, src.videoHeight] : src instanceof HTMLImageElement ? [src.naturalWidth, src.naturalHeight] : [src.width, src.height];

async function zxingDecoder(): Promise<Decoder> {
  const z = await import('@zxing/library');
  const reader = new z.MultiFormatReader();
  const hints = new Map();
  hints.set(z.DecodeHintType.POSSIBLE_FORMATS, [z.BarcodeFormat.EAN_13, z.BarcodeFormat.EAN_8, z.BarcodeFormat.UPC_A, z.BarcodeFormat.UPC_E]);
  hints.set(z.DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const read = (w: number, h: number) => {
    const { data } = ctx.getImageData(0, 0, w, h);
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (data[j] * 299 + data[j + 1] * 587 + data[j + 2] * 114) / 1000;
    try {
      const bmp = new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(lum, w, h)));
      return reader.decodeWithState(bmp).getText();
    } catch {
      return null;
    } finally {
      reader.reset();
    }
  };

  return {
    kind: 'zxing',
    decode: async (src) => {
      const [sw, sh] = size(src);
      if (!sw || !sh) return null;
      // probeer op twee formaten: grote foto's verkleinen gaat sneller en leest vaak beter
      for (const max of [1000, 1600]) {
        const scale = Math.min(1, max / Math.max(sw, sh));
        const w = Math.round(sw * scale);
        const h = Math.round(sh * scale);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(src, 0, 0, w, h);
        const code = read(w, h);
        if (code) return code;
        if (scale === 1) break;
      }
      return null;
    },
  };
}

let shared: Promise<Decoder> | null = null;

/** De beste beschikbare lezer: ingebouwd als dat kan, anders ZXing. */
export function getDecoder() {
  shared ??= nativeDecoder().then((d) => d ?? zxingDecoder());
  return shared;
}

/** Leest een barcode uit een foto die de gebruiker maakte of koos. */
export async function decodeFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const dec = await getDecoder();
    const code = await dec.decode(img);
    if (code || dec.kind === 'zxing') return code;
    // ingebouwde lezer vond niets: probeer ZXing nog als tweede kans
    return (await zxingDecoder()).decode(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Staat de pagina in een afgeschermd kader (bijv. een voorbeeldweergave)? */
export const inFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export type CameraProblem = 'insecure' | 'blocked' | 'denied' | 'nocamera' | 'busy' | 'unknown';

/** Mag deze pagina de camera vragen? (Een kader zonder camerarecht zegt nee, nog vóór de vraag.) */
export function cameraAllowedHere() {
  const doc = document as Document & { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  try {
    return policy ? policy.allowsFeature('camera') : true;
  } catch {
    return true;
  }
}

/** Waarom de camera niet start, zo specifiek mogelijk. */
export function cameraProblem(err?: unknown): CameraProblem {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure';
  if (!cameraAllowedHere()) return 'blocked';
  if (!navigator.mediaDevices?.getUserMedia) return inFrame() ? 'blocked' : 'insecure';
  const name = (err as { name?: string } | undefined)?.name;
  // in een kader komt vrijwel elke weigering van het kader zelf
  if (inFrame() && name !== 'NotReadableError') return 'blocked';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'nocamera';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  return 'unknown';
}

export const CAMERA_HELP: Record<CameraProblem, { title: string; text: string }> = {
  insecure: {
    title: 'Camera werkt alleen via https',
    text: 'Je telefoon geeft de camera alleen vrij op een beveiligde verbinding. Open Puls via de https-link, of start hem op je computer met “npm run telefoon”. Je kunt hieronder ook een foto van de barcode kiezen.',
  },
  blocked: {
    title: 'Camera niet beschikbaar in deze weergave',
    text: 'Deze versie draait in een afgeschermd venster waarin de camera niet aan mag. Open Puls via de eigen link (GitHub Pages) om live te scannen, of typ de cijfers onder de barcode in.',
  },
  denied: {
    title: 'Je hebt de camera geweigerd',
    text: 'Geef Puls toegang: tik op het slotje (iPhone: “aA”) in de adresbalk, kies Camera → Toestaan en tik op Opnieuw proberen. Of maak hieronder een foto van de barcode.',
  },
  nocamera: { title: 'Geen camera gevonden', text: 'Kies een foto van de barcode of typ de cijfers in.' },
  busy: { title: 'De camera is bezet', text: 'Een andere app gebruikt de camera. Sluit die en tik op Opnieuw proberen.' },
  unknown: { title: 'De camera start niet', text: 'Tik op Opnieuw proberen, kies een foto van de barcode of typ de cijfers in.' },
};
