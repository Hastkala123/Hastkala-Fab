import { crc32, deflateSync } from "node:zlib";

/**
 * Minimal 8-bit RGB PNG encoder (colour type 2, no interlacing).
 *
 * Used by the seed script to generate genuine Sanganeri-style block-print
 * imagery instead of shipping broken <img> tags or pulling placeholder files
 * from a third-party host at seed time.
 */

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);

  return Buffer.concat([length, body, crc]);
}

export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // colour type: truecolour RGB
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Each scanline is prefixed with a filter-type byte (0 = None).
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export type Rgb = [number, number, number];

export const PALETTE = {
  indigo: [30, 58, 95] as Rgb,
  indigoLight: [93, 136, 180] as Rgb,
  madder: [179, 71, 51] as Rgb,
  madderLight: [226, 128, 108] as Rgb,
  turmeric: [201, 162, 39] as Rgb,
  cream: [250, 246, 238] as Rgb,
  creamDeep: [243, 235, 220] as Rgb,
  ink: [22, 40, 63] as Rgb,
};

type MotifKind = "buti" | "jaal" | "floral" | "leaf" | "stripe";

/**
 * Draws a repeating hand-block-style motif. The geometry is deliberately
 * imperfect — a small deterministic jitter per tile mimics the slight
 * misregistration that distinguishes hand printing from machine printing.
 */
export function blockPrint(
  width: number,
  height: number,
  options: {
    ground: Rgb;
    primary: Rgb;
    secondary: Rgb;
    accent: Rgb;
    tile: number;
    motif: MotifKind;
    seed: number;
  },
): Uint8Array {
  const { ground, primary, secondary, accent, tile, motif, seed } = options;
  const pixels = new Uint8Array(width * height * 3);

  // Fill the ground.
  for (let i = 0; i < width * height; i++) {
    pixels[i * 3] = ground[0];
    pixels[i * 3 + 1] = ground[1];
    pixels[i * 3 + 2] = ground[2];
  }

  const set = (x: number, y: number, colour: Rgb, alpha = 1) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 3;
    pixels[i] = Math.round(pixels[i] * (1 - alpha) + colour[0] * alpha);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - alpha) + colour[1] * alpha);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - alpha) + colour[2] * alpha);
  };

  const disc = (cx: number, cy: number, r: number, colour: Rgb, alpha = 1) => {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 <= r2) {
          // Feather the last pixel of the radius for a softer edge.
          const edge = 1 - Math.max(0, Math.sqrt(d2) - (r - 1.2)) / 1.2;
          set(x, y, colour, alpha * Math.min(1, Math.max(0, edge)));
        }
      }
    }
  };

  const ring = (cx: number, cy: number, r: number, thickness: number, colour: Rgb) => {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (Math.abs(d - r) <= thickness / 2) set(x, y, colour, 1);
      }
    }
  };

  const petal = (cx: number, cy: number, r: number, angle: number, colour: Rgb) => {
    const px = cx + Math.cos(angle) * r * 0.85;
    const py = cy + Math.sin(angle) * r * 0.85;
    disc(px, py, r * 0.55, colour, 0.95);
  };

  // Deterministic pseudo-random so seeds reproduce identically.
  let state = seed >>> 0 || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };

  const cols = Math.ceil(width / tile) + 1;
  const rows = Math.ceil(height / tile) + 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Half-drop offset on alternate rows, as real block layouts do.
      const offset = row % 2 === 0 ? 0 : tile / 2;
      const jitterX = (rand() - 0.5) * tile * 0.06;
      const jitterY = (rand() - 0.5) * tile * 0.06;
      const cx = col * tile + offset + tile / 2 + jitterX;
      const cy = row * tile + tile / 2 + jitterY;
      const unit = tile / 2;

      switch (motif) {
        case "buti": {
          disc(cx, cy, unit * 0.28, primary);
          ring(cx, cy, unit * 0.55, 2.2, secondary);
          for (let k = 0; k < 4; k++) {
            const a = (Math.PI / 2) * k + Math.PI / 4;
            disc(cx + Math.cos(a) * unit * 0.78, cy + Math.sin(a) * unit * 0.78, unit * 0.1, accent);
          }
          break;
        }
        case "floral": {
          for (let k = 0; k < 8; k++) {
            petal(cx, cy, unit * 0.62, (Math.PI / 4) * k, secondary);
          }
          disc(cx, cy, unit * 0.22, accent);
          ring(cx, cy, unit * 0.86, 1.8, primary);
          break;
        }
        case "jaal": {
          ring(cx, cy, unit * 0.72, 2.6, primary);
          ring(cx, cy, unit * 0.4, 2, secondary);
          disc(cx, cy, unit * 0.14, accent);
          // Connecting trellis lines make the classic jaal lattice.
          for (let t = -tile / 2; t < tile / 2; t++) {
            set(Math.round(cx + t), Math.round(cy), primary, 0.16);
            set(Math.round(cx), Math.round(cy + t), primary, 0.16);
          }
          break;
        }
        case "leaf": {
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k;
            const lx = cx + Math.cos(a) * unit * 0.5;
            const ly = cy + Math.sin(a) * unit * 0.5;
            disc(lx, ly, unit * 0.24, k % 2 === 0 ? primary : secondary, 0.9);
          }
          disc(cx, cy, unit * 0.18, accent);
          break;
        }
        case "stripe": {
          const band = Math.floor(cy / tile) % 3;
          const colour = band === 0 ? primary : band === 1 ? secondary : accent;
          for (let x = 0; x < tile; x++) {
            for (let y = 0; y < Math.max(2, tile * 0.18); y++) {
              set(Math.round(cx - tile / 2 + x), Math.round(cy + y), colour, 0.85);
            }
          }
          disc(cx, cy - unit * 0.45, unit * 0.16, primary);
          break;
        }
      }
    }
  }

  // Subtle woven-cotton grain so the render does not look flat/vector.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x + y) % 3 === 0) {
        const i = (y * width + x) * 3;
        const shift = -4;
        pixels[i] = Math.max(0, Math.min(255, pixels[i] + shift));
        pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + shift));
        pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + shift));
      }
    }
  }

  // Vignette to give the flat fabric some depth.
  const cx0 = width / 2;
  const cy0 = height / 2;
  const maxD = Math.sqrt(cx0 ** 2 + cy0 ** 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.sqrt((x - cx0) ** 2 + (y - cy0) ** 2) / maxD;
      const factor = 1 - Math.pow(d, 2.4) * 0.18;
      const i = (y * width + x) * 3;
      pixels[i] = Math.round(pixels[i] * factor);
      pixels[i + 1] = Math.round(pixels[i + 1] * factor);
      pixels[i + 2] = Math.round(pixels[i + 2] * factor);
    }
  }

  return pixels;
}
