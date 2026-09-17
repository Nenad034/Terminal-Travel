// Dizajn dok. 29 §6i — rezervna pozadina ekrana prijave kad katalog nema nijednu sliku
// (svež seed, prazna baza). Generativni „zaliv u kasno popodne", prenet iz mockupa
// docs/moduli/M17-interni-panel/11-MOCKUP-PRIJAVA-DVE-VARIJANTE.html. Čist crtež, bez slike
// spolja — ništa se ne preuzima ni ne licencira.
export function paintFallbackScene(c: HTMLCanvasElement): void {
  const R = window.devicePixelRatio || 1;
  const W = (c.width = c.offsetWidth * R);
  const H = (c.height = c.offsetHeight * R);
  const g = c.getContext('2d');
  if (!g || W === 0 || H === 0) return;

  const sky = g.createLinearGradient(0, 0, 0, H * 0.58);
  sky.addColorStop(0, '#1b2340');
  sky.addColorStop(0.55, '#3a3f66');
  sky.addColorStop(1, '#c9885a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H * 0.58);

  const sea = g.createLinearGradient(0, H * 0.58, 0, H);
  sea.addColorStop(0, '#5a6f8c');
  sea.addColorStop(0.5, '#1f3348');
  sea.addColorStop(1, '#0d1620');
  g.fillStyle = sea;
  g.fillRect(0, H * 0.58, W, H * 0.42);

  const sx = W * 0.68;
  const sy = H * 0.55;
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.28);
  glow.addColorStop(0, 'rgba(255,214,150,.85)');
  glow.addColorStop(0.25, 'rgba(255,170,90,.35)');
  glow.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,200,130,${0.05 + Math.random() * 0.12})`;
    const y = H * 0.59 + Math.random() * H * 0.3;
    const w = 6 + Math.random() * 40 * R;
    g.fillRect(sx - w / 2 + (Math.random() - 0.5) * 60 * R, y, w, 1.5 * R);
  }

  const hill = (yBase: number, amp: number, color: string, seed: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, yBase);
    for (let x = 0; x <= W; x += 12) {
      const y =
        yBase +
        Math.sin(x / (240 * R) + seed) * amp +
        Math.sin(x / (61 * R) + seed * 2) * amp * 0.35;
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  hill(H * 0.5, 26 * R, '#2a3352', 1.2);
  hill(H * 0.555, 16 * R, '#151b2e', 3.1);

  for (let i = 0; i < 46; i++) {
    const x = W * 0.05 + (i / 46) * W * 0.9 + Math.sin(i) * 8;
    const y = H * 0.565 + Math.sin(i * 1.7) * 6;
    g.fillStyle = i % 5 === 0 ? 'rgba(255,190,110,.9)' : 'rgba(255,225,180,.55)';
    g.beginPath();
    g.arc(x, y, (i % 5 === 0 ? 2.2 : 1.3) * R, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < (W * H) / 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
}
