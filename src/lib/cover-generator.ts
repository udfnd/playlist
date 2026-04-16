import * as THREE from 'three';

const SIZE = 512;
const HALF = SIZE / 2;

type PatternFn = (ctx: CanvasRenderingContext2D, baseColor: string) => void;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(c * (1 - amount));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// Pattern 0: Giant circle with radial glow
const patternRadialGlow: PatternFn = (ctx, color) => {
  ctx.fillStyle = darken(color, 0.3);
  ctx.fillRect(0, 0, SIZE, SIZE);
  const g = ctx.createRadialGradient(HALF, HALF, 30, HALF, HALF, 220);
  g.addColorStop(0, lighten(color, 0.5));
  g.addColorStop(0.5, color);
  g.addColorStop(1, darken(color, 0.5));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(HALF, HALF, 200, 0, Math.PI * 2);
  ctx.fill();
};

// Pattern 1: Bold diagonal split
const patternDiagonal: PatternFn = (ctx, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = lighten(color, 0.4);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(SIZE, 0);
  ctx.lineTo(0, SIZE);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, SIZE);
  ctx.lineTo(SIZE, 0);
  ctx.stroke();
};

// Pattern 2: Concentric rings
const patternRings: PatternFn = (ctx, color) => {
  ctx.fillStyle = darken(color, 0.4);
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 5; i >= 0; i--) {
    ctx.fillStyle = i % 2 === 0 ? color : lighten(color, 0.3);
    ctx.beginPath();
    ctx.arc(HALF, HALF, 40 + i * 36, 0, Math.PI * 2);
    ctx.fill();
  }
};

// Pattern 3: Horizontal bands
const patternBands: PatternFn = (ctx, color) => {
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    ctx.fillStyle = i % 2 === 0 ? lighten(color, t * 0.3) : darken(color, t * 0.3);
    ctx.fillRect(0, (SIZE / bands) * i, SIZE, SIZE / bands);
  }
};

// Pattern 4: Sunburst
const patternSunburst: PatternFn = (ctx, color) => {
  ctx.fillStyle = darken(color, 0.3);
  ctx.fillRect(0, 0, SIZE, SIZE);
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const nextAngle = ((i + 0.5) / rays) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? color : lighten(color, 0.25);
    ctx.beginPath();
    ctx.moveTo(HALF, HALF);
    ctx.lineTo(HALF + Math.cos(angle) * 400, HALF + Math.sin(angle) * 400);
    ctx.lineTo(HALF + Math.cos(nextAngle) * 400, HALF + Math.sin(nextAngle) * 400);
    ctx.closePath();
    ctx.fill();
  }
};

// Pattern 5: Dots grid
const patternDots: PatternFn = (ctx, color) => {
  ctx.fillStyle = darken(color, 0.2);
  ctx.fillRect(0, 0, SIZE, SIZE);
  const gap = 64;
  for (let x = gap / 2; x < SIZE; x += gap) {
    for (let y = gap / 2; y < SIZE; y += gap) {
      const dist = Math.sqrt((x - HALF) ** 2 + (y - HALF) ** 2);
      const r = Math.max(4, 18 - dist * 0.04);
      ctx.fillStyle = lighten(color, 0.3 + Math.random() * 0.2);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// Pattern 6: Mountain silhouette
const patternMountain: PatternFn = (ctx, color) => {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, lighten(color, 0.3));
  g.addColorStop(1, darken(color, 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = darken(color, 0.5);
  ctx.beginPath();
  ctx.moveTo(0, SIZE);
  ctx.lineTo(80, 200);
  ctx.lineTo(180, 320);
  ctx.lineTo(260, 140);
  ctx.lineTo(360, 280);
  ctx.lineTo(450, 180);
  ctx.lineTo(SIZE, 300);
  ctx.lineTo(SIZE, SIZE);
  ctx.closePath();
  ctx.fill();
};

// Pattern 7: Abstract wave
const patternWave: PatternFn = (ctx, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 5; i++) {
    const y = 100 + i * 80;
    ctx.fillStyle = i % 2 === 0 ? lighten(color, 0.2 + i * 0.05) : darken(color, 0.1 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= SIZE; x += 10) {
      ctx.lineTo(x, y + Math.sin((x + i * 60) * 0.02) * 30);
    }
    ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(0, SIZE);
    ctx.closePath();
    ctx.fill();
  }
};

const patterns: PatternFn[] = [
  patternRadialGlow,
  patternDiagonal,
  patternRings,
  patternBands,
  patternSunburst,
  patternDots,
  patternMountain,
  patternWave,
];

function drawText(
  ctx: CanvasRenderingContext2D,
  title: string,
  artist: string,
) {
  ctx.textAlign = 'center';

  // Shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(title, HALF, SIZE - 80, SIZE - 40);

  // Artist
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '26px sans-serif';
  ctx.fillText(artist, HALF, SIZE - 44, SIZE - 40);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// rounded-xl = 0.75rem = 12px at 224px display → 12*(512/224) ≈ 27px
const CORNER_RADIUS = 27;

function roundedClip(ctx: CanvasRenderingContext2D) {
  const r = CORNER_RADIUS;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(SIZE - r, 0);
  ctx.quadraticCurveTo(SIZE, 0, SIZE, r);
  ctx.lineTo(SIZE, SIZE - r);
  ctx.quadraticCurveTo(SIZE, SIZE, SIZE - r, SIZE);
  ctx.lineTo(r, SIZE);
  ctx.quadraticCurveTo(0, SIZE, 0, SIZE - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.clip();
}

function renderCoverCanvas(
  title: string,
  artist: string,
  color: string,
  index: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Clip to rounded rect so both 3D texture and 2D image have identical corners
  ctx.save();
  roundedClip(ctx);

  const pattern = patterns[index % patterns.length];
  pattern(ctx, color);

  const vig = ctx.createRadialGradient(HALF, HALF, 100, HALF, HALF, 360);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawText(ctx, title, artist);

  ctx.restore();

  return canvas;
}

export function generateCoverTexture(
  title: string,
  artist: string,
  color: string,
  index: number,
): THREE.CanvasTexture {
  const canvas = renderCoverCanvas(title, artist, color, index);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function generateCoverDataUrl(
  title: string,
  artist: string,
  color: string,
  index: number,
): string {
  const canvas = renderCoverCanvas(title, artist, color, index);
  return canvas.toDataURL('image/png');
}

// Thumbnail-based cover: draws a YouTube thumbnail onto a rounded canvas
function renderThumbnailCanvas(
  img: HTMLImageElement,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  roundedClip(ctx);

  // YouTube thumbnails are 16:9, crop to 1:1 center
  const srcSize = Math.min(img.width, img.height);
  const sx = (img.width - srcSize) / 2;
  const sy = (img.height - srcSize) / 2;
  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, SIZE, SIZE);

  ctx.restore();
  return canvas;
}

const thumbnailTextureCache = new Map<string, THREE.CanvasTexture>();

export function loadThumbnailTexture(
  thumbnailUrl: string,
): THREE.CanvasTexture {
  const cached = thumbnailTextureCache.get(thumbnailUrl);
  if (cached) return cached;

  // Create placeholder texture immediately
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  roundedClip(ctx);
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  thumbnailTextureCache.set(thumbnailUrl, texture);

  // Load image asynchronously and update texture
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const loaded = renderThumbnailCanvas(img);
    texture.image = loaded;
    texture.needsUpdate = true;
  };
  img.src = thumbnailUrl;

  return texture;
}
