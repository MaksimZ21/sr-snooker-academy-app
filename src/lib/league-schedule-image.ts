// Browser only: draws a week of league matches into a PNG (canvas, no
// libraries) for sending in WhatsApp groups.

export type ScheduleImageDay = {
  title: string; // "יום ראשון · 15.11"
  matches: { a: string; b: string; district: string }[];
};

const W = 1080;
const PAD = 56;
const GREEN = "#12932b";
const GREEN_DARK = "#0b4413";
const INK = "#16201a";
const MUTED = "#6b7a70";
const ROW_ALT = "#f1f6f2";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Cuts text with "…" so it fits in maxWidth.
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export async function drawScheduleImage({
  leagueName,
  rangeLabel,
  days,
}: {
  leagueName: string;
  rangeLabel: string;
  days: ScheduleImageDay[];
}): Promise<Blob> {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";

  const HEADER = 230;
  const DAY_TITLE = 76;
  const ROW = 66;
  const DAY_GAP = 28;
  const FOOTER = 90;
  const height =
    HEADER + PAD + days.reduce((h, d) => h + DAY_TITLE + d.matches.length * ROW + DAY_GAP, 0) + FOOTER;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  ctx.scale(scale, scale);
  ctx.direction = "rtl";

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, height);

  // Header band
  const grad = ctx.createLinearGradient(0, 0, W, HEADER);
  grad.addColorStop(0, GREEN);
  grad.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER);

  const logo = await loadImage("/logo.png");
  if (logo) ctx.drawImage(logo, PAD, (HEADER - 110) / 2, 110, 110);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 54px ${font}`;
  ctx.fillText(fit(ctx, leagueName, W - PAD * 2 - 140), W - PAD, 100);
  ctx.font = `500 32px ${font}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`לוז משחקים · ${rangeLabel}`, W - PAD, 160);

  let y = HEADER + PAD;
  for (const day of days) {
    // Day title with a green marker
    ctx.fillStyle = GREEN;
    ctx.fillRect(W - PAD - 8, y + 18, 8, 40);
    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.font = `700 38px ${font}`;
    ctx.fillText(day.title, W - PAD - 22, y + 52);
    y += DAY_TITLE;

    day.matches.forEach((m, i) => {
      if (i % 2 === 0) {
        ctx.fillStyle = ROW_ALT;
        ctx.beginPath();
        ctx.roundRect(PAD, y, W - PAD * 2, ROW - 6, 14);
        ctx.fill();
      }
      const mid = y + ROW / 2 + 8;
      ctx.textAlign = "left";
      ctx.font = `500 24px ${font}`;
      ctx.fillStyle = MUTED;
      const district = fit(ctx, m.district, 260);
      ctx.fillText(district, PAD + 22, mid);
      const districtW = m.district ? ctx.measureText(district).width + 44 : 0;

      ctx.textAlign = "right";
      ctx.font = `600 32px ${font}`;
      ctx.fillStyle = INK;
      ctx.fillText(fit(ctx, `${m.a}  נגד  ${m.b}`, W - PAD * 2 - 44 - districtW), W - PAD - 22, mid);
      y += ROW;
    });
    y += DAY_GAP;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.font = `500 26px ${font}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("האקדמיה לסנוקר של שחר רוברג", W / 2, height - 40);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
