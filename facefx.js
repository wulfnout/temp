/* Temp face effects engine.
   Camera -> WebGL pipeline: face tracking (MediaPipe Face Landmarker, served from /vendor/mp),
   beauty warps (slim, eyes, nose, chin), edge-preserving skin smoothing masked to the face,
   makeup / face paint mapped onto the 3D face mesh, colour grades, and AR layers
   (accessories + particles) in front of or behind the person (selfie segmentation).
   The canvas is what goes out on the live stream, so viewers see everything. */
(function () {
  'use strict';
  const ROOT = (function () { try { return new URL('.', document.currentScript.src).href } catch (e) { return '/' } })();
  const MP = ROOT + 'vendor/mp/';

  // ---------------------------------------------------------------- landmark sets
  const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  const EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  const EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
  const LID_R = [33, 246, 161, 160, 159, 158, 157, 173, 133];
  const LID_L = [263, 466, 388, 387, 386, 385, 384, 398, 362];
  const BROW_R = [46, 53, 52, 65, 55, 107, 66, 105, 63, 70];
  const BROW_L = [276, 283, 282, 295, 285, 336, 296, 334, 293, 300];
  const BROW_R_LO = [46, 53, 52, 65, 55], BROW_L_LO = [276, 283, 282, 295, 285];
  const LIPS_OUT = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
  const LIPS_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
  const JAW_R = [132, 58, 172, 136, 150], JAW_L = [361, 288, 397, 365, 379];
  const SKIN_PTS = [50, 101, 118, 117, 123, 187, 205, 36, 280, 330, 347, 346, 352, 411, 425, 266, 4, 5, 195, 197, 6, 9, 151, 108, 337, 69, 299, 199, 175];

  // ---------------------------------------------------------------- loaders (shared by every engine on the page)
  let trackerP = null, segP = null, lastTs = 0;
  const nextTs = () => { const t = Math.max(performance.now(), lastTs + 1); lastTs = t; return t };
  let visionP = null;
  function vision() {
    if (!visionP) visionP = (async () => { const m = await import(MP + 'vision_bundle.mjs'); const fs = await m.FilesetResolver.forVisionTasks(MP.replace(/\/$/, '')); return { m, fs } })();
    visionP.catch(() => { visionP = null });
    return visionP;
  }
  function loadTracker() {
    if (trackerP) return trackerP;
    trackerP = (async () => {
      const { m, fs } = await vision();
      const mk = (delegate) => m.FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: MP + 'face_landmarker.task', delegate }, runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5
      });
      let fl; try { fl = await mk('GPU') } catch (e) { fl = await mk('CPU') }
      return { fl, tess: m.FaceLandmarker.FACE_LANDMARKS_TESSELATION };
    })();
    trackerP.catch(() => { trackerP = null });
    return trackerP;
  }
  function loadSeg() {
    if (segP) return segP;
    segP = (async () => {
      const { m, fs } = await vision();
      const mk = (delegate) => m.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: MP + 'selfie_segmenter.tflite', delegate }, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
      try { return await mk('GPU') } catch (e) { return await mk('CPU') }
    })();
    segP.catch(() => { segP = null });
    return segP;
  }

  // ---------------------------------------------------------------- tiny helpers
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const ease = (x) => { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3) };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c };

  class Euro { // one-euro filter: steady when still, no lag when moving
    constructor(n, minC, beta) { this.n = n; this.minC = minC; this.beta = beta; this.x = new Float32Array(n); this.dx = new Float32Array(n); this.ok = false }
    reset() { this.ok = false }
    f(v, dt) {
      if (!this.ok) { this.x.set(v); this.dx.fill(0); this.ok = true; return this.x }
      dt = Math.max(dt, 1 / 120); const al = (c) => { const tau = 1 / (2 * Math.PI * c); return 1 / (1 + tau / dt) }; const aD = al(1);
      for (let i = 0; i < this.n; i++) { const d = (v[i] - this.x[i]) / dt; this.dx[i] += aD * (d - this.dx[i]); const a = al(this.minC + this.beta * Math.abs(this.dx[i])); this.x[i] += a * (v[i] - this.x[i]) }
      return this.x;
    }
  }

  // ---------------------------------------------------------------- sprites
  let SPR = null;
  function sprites() {
    if (SPR) return SPR;
    const radial = (n, stops) => { const c = mkCanvas(n, n), g = c.getContext('2d'), r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); stops.forEach(([o, col]) => r.addColorStop(o, col)); g.fillStyle = r; g.fillRect(0, 0, n, n); return c };
    const tongue = (stops) => { // a soft flame tongue pointing up
      const c = mkCanvas(64, 128), g = c.getContext('2d');
      const r = g.createRadialGradient(32, 92, 2, 32, 82, 56); stops.forEach((col, i) => r.addColorStop(i / (stops.length - 1), col));
      g.shadowColor = stops[1]; g.shadowBlur = 16; g.shadowOffsetX = 400; g.translate(-400, 0); g.fillStyle = r;
      g.beginPath(); g.moveTo(32, 18); g.bezierCurveTo(38, 44, 50, 62, 48, 86); g.bezierCurveTo(46, 106, 18, 106, 16, 86); g.bezierCurveTo(14, 62, 27, 44, 32, 18); g.fill();
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6; g.fillStyle = r; g.beginPath(); g.ellipse(32, 84, 11, 18, 0, 0, 7); g.fill();
      return c;
    };
    const glint = (core, ray) => {
      const n = 96, c = mkCanvas(n, n), g = c.getContext('2d'), h = n / 2;
      g.drawImage(radial(n, [[0, core], [0.12, 'rgba(255,240,200,.55)'], [0.4, 'rgba(255,190,90,.12)'], [1, 'rgba(255,160,60,0)']]), 0, 0);
      g.globalCompositeOperation = 'lighter';
      [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]].forEach(([a, L]) => {
        g.save(); g.translate(h, h); g.rotate(a); const lg = g.createLinearGradient(-h * L, 0, h * L, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, ray); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg; g.beginPath(); g.moveTo(-h * L, 0); g.lineTo(0, -2.2); g.lineTo(h * L, 0); g.lineTo(0, 2.2); g.fill(); g.restore();
      });
      return c;
    };
    const heart = () => {
      const c = mkCanvas(96, 96), g = c.getContext('2d');
      const path = () => { g.beginPath(); g.moveTo(48, 82); g.bezierCurveTo(14, 60, 6, 40, 14, 26); g.bezierCurveTo(22, 12, 42, 12, 48, 28); g.bezierCurveTo(54, 12, 74, 12, 82, 26); g.bezierCurveTo(90, 40, 82, 60, 48, 82); g.closePath() };
      g.shadowColor = 'rgba(255,40,90,.8)'; g.shadowBlur = 10; const lg = g.createLinearGradient(20, 14, 76, 82); lg.addColorStop(0, '#ff9ab8'); lg.addColorStop(0.5, '#ff3366'); lg.addColorStop(1, '#c4002f');
      g.fillStyle = lg; path(); g.fill(); g.shadowBlur = 0;
      const hl = g.createRadialGradient(32, 30, 1, 32, 30, 16); hl.addColorStop(0, 'rgba(255,255,255,.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.beginPath(); g.ellipse(32, 30, 12, 8, -0.6, 0, 7); g.fill();
      return c;
    };
    const petal = () => {
      const c = mkCanvas(64, 64), g = c.getContext('2d');
      const lg = g.createLinearGradient(10, 10, 54, 54); lg.addColorStop(0, '#ff4d6d'); lg.addColorStop(0.55, '#c9184a'); lg.addColorStop(1, '#6b0020');
      g.fillStyle = lg; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(58, 10, 60, 44, 32, 60); g.bezierCurveTo(6, 44, 8, 12, 32, 4); g.fill();
      g.strokeStyle = 'rgba(255,200,210,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(32, 10); g.quadraticCurveTo(36, 34, 30, 56); g.stroke();
      const hl = g.createRadialGradient(24, 20, 1, 24, 20, 16); hl.addColorStop(0, 'rgba(255,255,255,.45)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(0, 0, 64, 64);
      return c;
    };
    const flake = () => {
      const c = mkCanvas(64, 64), g = c.getContext('2d'); g.translate(32, 32); g.strokeStyle = 'rgba(235,248,255,.95)'; g.lineCap = 'round'; g.shadowColor = 'rgba(150,210,255,.9)'; g.shadowBlur = 6;
      for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * Math.PI / 3); g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.moveTo(0, -12); g.lineTo(-7, -19); g.moveTo(0, -12); g.lineTo(7, -19); g.moveTo(0, -20); g.lineTo(-4, -25); g.moveTo(0, -20); g.lineTo(4, -25); g.stroke(); g.restore() }
      return c;
    };
    SPR = {
      hot: radial(64, [[0, 'rgba(255,255,240,1)'], [0.25, 'rgba(255,235,150,.95)'], [0.55, 'rgba(255,160,40,.5)'], [1, 'rgba(255,90,0,0)']]),
      fire: radial(64, [[0, 'rgba(255,220,120,.95)'], [0.3, 'rgba(255,140,30,.8)'], [0.65, 'rgba(230,60,0,.35)'], [1, 'rgba(160,20,0,0)']]),
      deep: radial(64, [[0, 'rgba(255,110,20,.7)'], [0.4, 'rgba(200,40,0,.4)'], [1, 'rgba(90,10,0,0)']]),
      smoke: radial(64, [[0, 'rgba(60,40,35,.35)'], [1, 'rgba(40,30,30,0)']]),
      ember: radial(24, [[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,200,90,.95)'], [0.6, 'rgba(255,100,20,.5)'], [1, 'rgba(255,60,0,0)']]),
      tHot: tongue(['rgba(255,255,235,1)', 'rgba(255,220,110,.95)', 'rgba(255,140,30,.7)', 'rgba(255,80,0,0)']),
      tFire: tongue(['rgba(255,210,100,.95)', 'rgba(255,120,20,.85)', 'rgba(220,50,0,.55)', 'rgba(150,20,0,0)']),
      tDeep: tongue(['rgba(255,120,30,.7)', 'rgba(210,40,0,.5)', 'rgba(140,10,0,.25)', 'rgba(80,0,0,0)']),
      glint: glint('rgba(255,255,255,1)', 'rgba(255,255,255,.95)'),
      gold: glint('rgba(255,250,220,1)', 'rgba(255,215,120,.95)'),
      heart: heart(), petal: petal(), flake: flake(),
      steam: radial(64, [[0, 'rgba(250,250,250,.85)'], [0.45, 'rgba(235,238,242,.5)'], [1, 'rgba(225,230,235,0)']]),
      puff: radial(64, [[0, 'rgba(255,255,255,.55)'], [0.5, 'rgba(240,245,255,.25)'], [1, 'rgba(230,240,255,0)']]),
      ice: radial(32, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(190,230,255,.7)'], [1, 'rgba(120,190,255,0)']]),
    };
    SPR.flames = [SPR.tHot, SPR.tFire, SPR.tFire, SPR.tDeep];
    SPR.blobs = [SPR.hot, SPR.fire, SPR.deep, SPR.smoke];
    return SPR;
  }

  // ---------------------------------------------------------------- particles
  class Parts {
    constructor() { this.a = [] }
    add(p) { if (this.a.length < 900) { p.t = 0; if (p.r == null) p.r = 0; this.a.push(p) } }
    step(dt) {
      const a = this.a; let j = 0;
      for (let i = 0; i < a.length; i++) {
        const p = a[i]; p.t += dt; if (p.t >= p.life) continue;
        if (p.ax) p.vx += p.ax * dt; if (p.ay) p.vy += p.ay * dt;
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.sway) p.x += Math.cos((p.t + p.ph) * p.sway) * p.swayA * dt;
        if (p.vr) p.r += p.vr * dt;
        a[j++] = p;
      }
      a.length = j;
    }
    draw(g) {
      for (const p of this.a) {
        const k = p.t / p.life;
        let al = p.fade ? p.fade(k) : (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);
        al *= p.al == null ? 1 : p.al; if (al <= 0.004) continue;
        const s = p.s * (p.grow ? 1 + p.grow * k : 1) * (p.pulse ? 1 + 0.25 * Math.sin(p.t * p.pulse) : 1);
        const spr = p.sprs ? p.sprs[Math.min(p.sprs.length - 1, (k * p.sprs.length) | 0)] : p.spr;
        g.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; g.globalAlpha = Math.min(1, al);
        const rot = p.align ? Math.atan2(p.vy, p.vx) + Math.PI / 2 : p.r;
        const w = s * (p.ar || 1);
        if (rot) { g.save(); g.translate(p.x, p.y); g.rotate(rot); g.drawImage(spr, -w / 2, -s / 2, w, s); g.restore() }
        else g.drawImage(spr, p.x - w / 2, p.y - s / 2, w, s);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }

  // ---------------------------------------------------------------- face-space (UV) textures: makeup, paint, glow
  const UVS = 512;
  function uvKit(uv) {
    const S = UVS, P = (i) => [uv[i * 2] * S, uv[i * 2 + 1] * S];
    const L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const C = (ids) => { let x = 0, y = 0; ids.forEach((i) => { const p = P(i); x += p[0]; y += p[1] }); return [x / ids.length, y / ids.length] };
    const poly = (g, ids, scale, about) => { const c = scale ? (about || C(ids)) : null; ids.forEach((i, k) => { let p = P(i); if (c) p = L(c, p, scale); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]) }); g.closePath() };
    const curve = (g, pts) => { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const m = L(pts[i], pts[i + 1], 0.5); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]) } const e = pts[pts.length - 1]; g.lineTo(e[0], e[1]) };
    const fw = D(P(234), P(454));
    const cheek = (side) => side < 0 ? L(L(P(234), P(1), 0.42), P(61), 0.22) : L(L(P(454), P(1), 0.42), P(291), 0.22);
    const ud = [P(10)[0] - P(152)[0], P(10)[1] - P(152)[1]], ul = Math.hypot(ud[0], ud[1]) || 1, up = [ud[0] / ul, ud[1] / ul];
    const U = (p, amt) => [p[0] + up[0] * amt * fw, p[1] + up[1] * amt * fw];
    return { S, P, L, D, C, poly, curve, fw, cheek, up, U };
  }
  // fill a shape as a soft-edged blur (shadow trick: works in every browser incl. iOS Safari)
  function soft(g, blur, color, shape, op) {
    g.save(); if (op) g.globalCompositeOperation = op; g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetX = 4000; g.translate(-4000, 0);
    g.fillStyle = color; g.beginPath(); shape(); g.fill(); g.restore();
  }
  function softStroke(g, blur, color, width, shape, op) {
    g.save(); if (op) g.globalCompositeOperation = op; g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetX = 4000; g.translate(-4000, 0);
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); shape(); g.stroke(); g.restore();
  }
  function cutEyesMouth(g, K, feather) {
    soft(g, feather, 'rgba(0,0,0,1)', () => { K.poly(g, EYE_R, 1.08); K.poly(g, EYE_L, 1.08); K.poly(g, LIPS_IN, 1.0) }, 'destination-out');
  }
  function lips(g, K, color, blur) {
    g.save(); soft(g, blur, color, () => K.poly(g, LIPS_OUT)); soft(g, blur * 0.6, 'rgba(0,0,0,1)', () => K.poly(g, LIPS_IN), 'destination-out'); g.restore();
  }
  function blush(g, K, color, r) {
    [-1, 1].forEach((s) => { const c = K.cheek(s); const rg = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * K.fw); rg.addColorStop(0, color); rg.addColorStop(1, color.replace(/[\d.]+\)$/, '0)')); g.fillStyle = rg; g.beginPath(); g.arc(c[0], c[1], r * K.fw, 0, 7); g.fill() });
  }
  function liner(g, K, color, w) {
    [[LID_R, 33, 133], [LID_L, 263, 362]].forEach(([lid, outer, inner]) => {
      const o = K.P(outer), i = K.P(inner), dir = [o[0] - i[0], o[1] - i[1]], len = Math.hypot(dir[0], dir[1]);
      const wing = K.U([o[0] + dir[0] * 0.28, o[1] + dir[1] * 0.28], len * 0.16 / K.fw);
      softStroke(g, 1.5, color, w, () => { K.curve(g, lid.map(K.P).reverse()); g.lineTo(wing[0], wing[1]) });
    });
  }
  function shadowLids(g, K, color, blur) {
    [[LID_R, BROW_R_LO], [LID_L, BROW_L_LO]].forEach(([lid, brow]) => {
      const top = brow.map((i, k) => K.L(K.P(lid[Math.round(k * (lid.length - 1) / (brow.length - 1))]), K.P(i), 0.6));
      soft(g, blur, color, () => { K.curve(g, lid.map(K.P)); const b = top.slice(); if (K.D(b[0], K.P(lid[lid.length - 1])) > K.D(b[b.length - 1], K.P(lid[lid.length - 1]))) b.reverse(); b.forEach((p) => g.lineTo(p[0], p[1])); g.closePath() });
    });
  }
  function hashRand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

  // each layer draws into P (paint: overlay-blended, keeps skin shading) and G (glow: added light)
  const LAYERS = {
    glam(P, G, K) {
      lips(P, K, 'rgba(176,22,58,.62)', 3);
      blush(P, K, 'rgba(255,92,112,.38)', 0.16);
      shadowLids(P, K, 'rgba(150,70,50,.5)', 7);
      liner(P, K, 'rgba(12,6,6,.92)', 2.6);
      [-1, 1].forEach((s) => { const c = K.cheek(s), up = K.L(c, s < 0 ? K.P(116) : K.P(345), 0.6); soft(G, 10, 'rgba(255,240,225,.16)', () => { G.ellipse(up[0], up[1], K.fw * 0.07, K.fw * 0.035, 0, 0, 7) }) });
      softStroke(G, 8, 'rgba(255,245,235,.14)', K.fw * 0.035, () => K.curve(G, [K.P(168), K.P(6), K.P(197), K.P(195)]));
      const lo = K.L(K.P(17), K.P(14), 0.45); soft(G, 4, 'rgba(255,255,255,.32)', () => G.ellipse(lo[0], lo[1], K.fw * 0.045, K.fw * 0.012, 0, 0, 7));
      [-1, 1].forEach((s) => { const a = s < 0 ? K.P(234) : K.P(454), b = s < 0 ? K.P(61) : K.P(291); const c1 = K.L(a, b, 0.25), c2 = K.L(a, b, 0.55); softStroke(P, 12, 'rgba(90,50,35,.3)', K.fw * 0.05, () => { const a1 = K.U(c1, 0.03), a2 = K.U(c2, 0.05); P.moveTo(a1[0], a1[1]); P.lineTo(a2[0], a2[1]) }) });
    },
    contour(P, G, K) {
      [-1, 1].forEach((s) => { const a = s < 0 ? K.P(234) : K.P(454), b = s < 0 ? K.P(61) : K.P(291); const c1 = K.L(a, b, 0.18), c2 = K.L(a, b, 0.55); softStroke(P, 14, 'rgba(80,45,30,.42)', K.fw * 0.06, () => { const a1 = K.U(c1, 0.03), a2 = K.U(c2, 0.05); P.moveTo(a1[0], a1[1]); P.lineTo(a2[0], a2[1]) }) });
      [-1, 1].forEach((s) => { const j = (s < 0 ? JAW_R : JAW_L).map(K.P); softStroke(P, 12, 'rgba(80,45,30,.3)', K.fw * 0.05, () => K.curve(P, j)) });
      softStroke(G, 8, 'rgba(255,245,235,.16)', K.fw * 0.03, () => K.curve(G, [K.P(168), K.P(6), K.P(197), K.P(195), K.P(5)]));
      [-1, 1].forEach((s) => { const c = K.cheek(s), up = K.L(c, s < 0 ? K.P(116) : K.P(345), 0.65); soft(G, 10, 'rgba(255,240,225,.18)', () => G.ellipse(up[0], up[1], K.fw * 0.07, K.fw * 0.03, 0, 0, 7)) });
      lips(P, K, 'rgba(170,70,70,.32)', 3);
    },
    ember(P, G, K) { // phoenix face paint: a flame crest on the forehead and fire-feather filigree sweeping up the cheekbones
      const fh = K.L(K.P(9), K.P(10), 0.38), sz = K.fw * 0.13, u = K.up, r = [-u[1], u[0]];
      const at = (x, y) => [fh[0] + r[0] * x * sz + u[0] * y * sz, fh[1] + r[1] * x * sz + u[1] * y * sz];
      const M = (g, p) => g.moveTo(p[0], p[1]), Q = (g, c, p) => g.quadraticCurveTo(c[0], c[1], p[0], p[1]), Bz = (g, c1, c2, p) => g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
      const crest = (g) => {
        M(g, at(0, 1.35)); Bz(g, at(0.55, 0.7), at(0.5, -0.3), at(0, -0.8)); Bz(g, at(-0.5, -0.3), at(-0.55, 0.7), at(0, 1.35));
        M(g, at(0, 0.75)); Q(g, at(0.28, 0.1), at(0, -0.45)); Q(g, at(-0.28, 0.1), at(0, 0.75));
        [-1, 1].forEach((s) => { M(g, at(0.38 * s, -0.55)); Bz(g, at(0.9 * s, -0.3), at(1.1 * s, 0.35), at(0.95 * s, 0.85)); Bz(g, at(0.82 * s, 0.4), at(0.62 * s, -0.05), at(0.38 * s, -0.55)) });
      };
      const feathers = (g, fill) => [-1, 1].forEach((s) => {
        const lid = K.P(s < 0 ? 145 : 374), ala = K.P(s < 0 ? 98 : 327), ear = K.P(s < 0 ? 234 : 454), brow = K.P(s < 0 ? 70 : 300), tmp = K.P(s < 0 ? 127 : 356);
        const oc = K.P(s < 0 ? 33 : 263), root = K.L(K.L(oc, lid, 0.35), K.P(s < 0 ? 116 : 345), 0.25); void ala;
        const tips = [K.U(K.L(brow, tmp, 0.2), 0.05), K.U(K.L(brow, tmp, 0.75), 0.02), K.L(tmp, ear, 0.45)];
        tips.forEach((tip, k) => {
          const b = K.L(root, ear, k * 0.04), mid = K.U(K.L(b, tip, 0.5), -0.03), w = K.fw * (0.024 - k * 0.004);
          const n = [-(tip[1] - b[1]), tip[0] - b[0]], nl = Math.hypot(n[0], n[1]) || 1, o = [n[0] / nl * w, n[1] / nl * w];
          if (fill) { M(g, b); Q(g, [mid[0] + o[0], mid[1] + o[1]], tip); Q(g, [mid[0] - o[0], mid[1] - o[1]], b); g.closePath() }
          else { M(g, b); Q(g, mid, tip) }
          const curl = K.U(tip, 0.03); if (!fill) { Q(g, K.L(tip, curl, 0.6), K.L(curl, b, 0.06)) }
        });
        if (fill) { M(g, [root[0] + K.fw * 0.018, root[1]]); g.arc(root[0], root[1], K.fw * 0.018, 0, 7) }
      });
      const dots = (g, rad) => [-1, 1].forEach((s) => { const a = K.P(s < 0 ? 33 : 263), b = K.P(s < 0 ? 70 : 300); for (let k = 0; k < 3; k++) { const d = K.U(K.L(a, b, 0.1), 0.02 + k * 0.035); const x = K.L(d, K.P(s < 0 ? 127 : 356), 0.25 + k * 0.12); M(g, [x[0] + rad - k * 0.4, x[1]]); g.arc(x[0], x[1], rad - k * 0.4, 0, 7) } });
      // paint: deep ember shading around the eyes + filled gold crest
      shadowLids(P, K, 'rgba(190,50,10,.6)', 9);
      [-1, 1].forEach((s) => { const c = K.L(K.P(s < 0 ? 33 : 263), K.P(s < 0 ? 127 : 356), 0.4); soft(P, 16, 'rgba(200,60,10,.45)', () => P.ellipse(c[0], c[1], K.fw * 0.07, K.fw * 0.05, 0, 0, 7)) });
      P.save(); P.lineCap = 'round'; P.lineJoin = 'round'; P.fillStyle = 'rgba(255,185,60,.85)'; P.beginPath(); crest(P); P.fill('evenodd');
      P.beginPath(); feathers(P, 1); P.fill(); P.strokeStyle = 'rgba(255,200,80,.95)'; P.lineWidth = 3.2; P.beginPath(); crest(P); feathers(P); P.stroke(); P.fillStyle = 'rgba(255,200,80,.95)'; P.beginPath(); dots(P, 2.6); P.fill(); P.restore();
      // glow: hot halo + bright metallic core so it reads as glowing gold on any skin tone
      G.save(); G.lineCap = 'round'; G.lineJoin = 'round';
      G.shadowColor = 'rgba(255,90,0,1)'; G.shadowBlur = 16; G.strokeStyle = 'rgba(255,110,10,.7)'; G.lineWidth = 6; G.beginPath(); crest(G); feathers(G); G.stroke();
      G.shadowBlur = 4; G.shadowColor = 'rgba(255,200,90,1)'; G.strokeStyle = 'rgba(255,205,100,.95)'; G.lineWidth = 2.6; G.beginPath(); crest(G); feathers(G); G.stroke();
      G.shadowBlur = 0; G.strokeStyle = 'rgba(255,248,220,.95)'; G.lineWidth = 1; G.beginPath(); crest(G); feathers(G); G.stroke();
      G.fillStyle = 'rgba(255,170,60,.35)'; G.beginPath(); crest(G); G.fill('evenodd'); G.fillStyle = 'rgba(255,160,50,.4)'; G.beginPath(); feathers(G, 1); G.fill(); G.fillStyle = 'rgba(255,230,160,.95)'; G.beginPath(); dots(G, 2.4); G.fill();
      G.restore();
      lips(P, K, 'rgba(150,30,20,.45)', 3);
    },
    frost(P, G, K) {
      const rnd = hashRand(7);
      softStroke(P, 18, 'rgba(225,242,255,.32)', K.fw * 0.08, () => K.poly(P, OVAL, 0.98));
      const oval = OVAL.map(K.P), c = K.C(OVAL);
      for (let n = 0; n < 420; n++) {
        const k = rnd() * oval.length, i = k | 0, a = oval[i], b = oval[(i + 1) % oval.length], e = K.L(a, b, k - i), p = K.L(e, c, Math.pow(rnd(), 3) * 0.26);
        const s = 2 + rnd() * 6, ang = rnd() * 3; P.save(); P.translate(p[0], p[1]); P.rotate(ang); P.strokeStyle = 'rgba(245,252,255,' + (0.2 + rnd() * 0.45) + ')'; P.lineWidth = 0.9;
        P.beginPath(); for (let q = 0; q < 3; q++) { P.rotate(Math.PI / 3); P.moveTo(-s, 0); P.lineTo(s, 0) } P.stroke(); P.restore();
        if (rnd() < 0.35) { G.fillStyle = 'rgba(200,235,255,' + (0.25 + rnd() * 0.5) + ')'; G.beginPath(); G.arc(p[0], p[1], 0.6 + rnd() * 1.2, 0, 7); G.fill() }
      }
      lips(P, K, 'rgba(110,150,215,.6)', 3);
      softStroke(P, 2, 'rgba(240,250,255,.85)', 2.2, () => { K.curve(P, LID_R.map(K.P)); K.curve(P, LID_L.map(K.P)) });
      soft(P, 3, 'rgba(235,245,255,.55)', () => { K.poly(P, BROW_R); K.poly(P, BROW_L) });
      blush(P, K, 'rgba(160,200,255,.35)', 0.15);
    },
    glitter(P, G, K) {
      const rnd = hashRand(11);
      blush(P, K, 'rgba(255,120,150,.32)', 0.15);
      lips(P, K, 'rgba(220,80,120,.42)', 3);
      const spots = [[K.cheek(-1), 0.14, 380], [K.cheek(1), 0.14, 380], [K.L(K.P(6), K.P(195), 0.5), 0.05, 140], [K.C(LID_R), 0.06, 120], [K.C(LID_L), 0.06, 120]];
      const cols = ['255,215,120', '255,170,200', '255,255,255', '255,190,90'];
      spots.forEach(([c, r, n]) => { for (let i = 0; i < n; i++) { const a = rnd() * 7, d = Math.sqrt(rnd()) * r * K.fw, p = [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * 0.7]; G.fillStyle = 'rgba(' + pick(cols) + ',' + (0.35 + rnd() * 0.65) * (1 - d / (r * K.fw) * 0.6) + ')'; G.beginPath(); G.arc(p[0], p[1], 0.5 + rnd() * 1.3, 0, 7); G.fill() } });
      const lo = K.L(K.P(17), K.P(14), 0.45); soft(G, 4, 'rgba(255,255,255,.4)', () => G.ellipse(lo[0], lo[1], K.fw * 0.045, K.fw * 0.012, 0, 0, 7));
    },
    neon(P, G, K) {
      soft(P, 30, 'rgba(20,10,30,.35)', () => K.poly(P, OVAL, 0.98));
      const draw = (g) => { K.poly(g, OVAL); K.poly(g, BROW_R); K.poly(g, BROW_L); K.poly(g, EYE_R, 1.25); K.poly(g, EYE_L, 1.25); K.poly(g, LIPS_OUT); K.curve(g, [K.P(168), K.P(6), K.P(197), K.P(195), K.P(5), K.P(4), K.P(1)]); K.curve(g, [K.P(98), K.P(2), K.P(327)]) };
      const lg = G.createLinearGradient(0, 0, UVS, UVS); lg.addColorStop(0, '#ff7a1a'); lg.addColorStop(0.5, '#ff2d6f'); lg.addColorStop(1, '#ffb800');
      G.save(); G.lineCap = 'round'; G.lineJoin = 'round';
      G.shadowColor = '#ff3d6e'; G.shadowBlur = 16; G.strokeStyle = lg; G.lineWidth = 4; G.globalAlpha = 0.6; G.beginPath(); draw(G); G.stroke();
      G.shadowBlur = 6; G.lineWidth = 2; G.globalAlpha = 1; G.beginPath(); draw(G); G.stroke();
      G.shadowBlur = 0; G.strokeStyle = 'rgba(255,240,230,.9)'; G.lineWidth = 0.8; G.beginPath(); draw(G); G.stroke(); G.restore();
    },
    flush(P, G, K) {
      blush(P, K, 'rgba(235,30,20,.6)', 0.2);
      const n = K.P(4); soft(P, 14, 'rgba(230,30,20,.55)', () => P.arc(n[0], n[1], K.fw * 0.07, 0, 7));
      const f = K.L(K.P(9), K.P(10), 0.4); soft(P, 26, 'rgba(225,40,20,.35)', () => P.ellipse(f[0], f[1], K.fw * 0.22, K.fw * 0.09, 0, 0, 7));
      const rnd = hashRand(3);
      for (let i = 0; i < 6; i++) { const p = K.L(K.L(K.P(103), K.P(332), 0.1 + rnd() * 0.8), K.P(9), 0.1 + rnd() * 0.35), r = K.fw * (0.012 + rnd() * 0.01), ang = Math.atan2(-K.up[1], -K.up[0]) - Math.PI / 2;
        P.save(); P.translate(p[0], p[1]); P.rotate(ang); P.fillStyle = 'rgba(255,235,225,.5)'; P.beginPath(); P.moveTo(0, -r * 1.9); P.quadraticCurveTo(r * 1.05, -r * 0.2, 0, r); P.quadraticCurveTo(-r * 1.05, -r * 0.2, 0, -r * 1.9); P.fill(); P.restore();
        G.save(); G.translate(p[0], p[1]); G.rotate(ang); G.fillStyle = 'rgba(255,255,255,.85)'; G.beginPath(); G.ellipse(-r * 0.3, -r * 0.2, r * 0.22, r * 0.4, 0.3, 0, 7); G.fill(); G.fillStyle = 'rgba(255,255,255,.35)'; G.beginPath(); G.arc(r * 0.25, r * 0.5, r * 0.18, 0, 7); G.fill(); G.restore() }
      lips(P, K, 'rgba(200,20,20,.4)', 3);
    },
    rose(P, G, K) { blush(P, K, 'rgba(225,40,90,.45)', 0.17); lips(P, K, 'rgba(185,10,55,.7)', 3); shadowLids(P, K, 'rgba(170,40,80,.4)', 8); const lo = K.L(K.P(17), K.P(14), 0.45); soft(G, 4, 'rgba(255,255,255,.35)', () => G.ellipse(lo[0], lo[1], K.fw * 0.045, K.fw * 0.012, 0, 0, 7)) },
    blushPink(P, G, K) { blush(P, K, 'rgba(255,70,130,.55)', 0.18); lips(P, K, 'rgba(230,50,110,.5)', 3) },
    lava(P, G, K) {
      const oval = OVAL.map(K.P), c = K.C(OVAL);
      softStroke(P, 22, 'rgba(30,12,8,.62)', K.fw * 0.12, () => K.poly(P, OVAL, 0.96));
      G.save(); G.lineCap = 'round'; G.lineJoin = 'round';
      const paths = []; { const R = hashRand(41); for (let n = 0; n < 13; n++) { let p = oval[(n * 2.77 + R() * 2) % oval.length | 0], ang = Math.atan2(c[1] - p[1], c[0] - p[0]) + (R() - 0.5) * 0.6; const pts = [p]; const len = 6 + ((R() * 6) | 0); for (let s = 0; s < len; s++) { ang += (R() - 0.5) * 1.1; p = [p[0] + Math.cos(ang) * K.fw * 0.032, p[1] + Math.sin(ang) * K.fw * 0.032]; pts.push(p); if (R() < 0.3) { const b = [p, [p[0] + Math.cos(ang + 1.2) * K.fw * 0.05, p[1] + Math.sin(ang + 1.2) * K.fw * 0.05], [p[0] + Math.cos(ang + 0.8) * K.fw * 0.08, p[1] + Math.sin(ang + 0.8) * K.fw * 0.08]]; paths.push(b) } } paths.push(pts) } }
      const trace = (g) => paths.forEach((pts) => { g.moveTo(pts[0][0], pts[0][1]); pts.forEach((p) => g.lineTo(p[0], p[1])) });
      G.shadowColor = 'rgba(255,70,0,1)'; G.shadowBlur = 18; G.strokeStyle = 'rgba(255,90,0,.85)'; G.lineWidth = 7; G.beginPath(); trace(G); G.stroke();
      G.shadowBlur = 6; G.shadowColor = 'rgba(255,170,40,1)'; G.strokeStyle = 'rgba(255,170,40,1)'; G.lineWidth = 3.2; G.beginPath(); trace(G); G.stroke();
      G.shadowBlur = 0; G.strokeStyle = 'rgba(255,250,210,1)'; G.lineWidth = 1.3; G.beginPath(); trace(G); G.stroke(); G.restore();
      P.save(); P.strokeStyle = 'rgba(20,6,2,.85)'; P.lineWidth = 9; P.lineCap = 'round'; P.beginPath(); trace(P); P.stroke(); P.restore();
    },
  };
  function buildMask(g, K) {
    g.clearRect(0, 0, UVS, UVS);
    soft(g, 14, 'rgba(255,255,255,1)', () => K.poly(g, OVAL, 0.94));
    soft(g, 7, 'rgba(0,0,0,1)', () => { K.poly(g, EYE_R, 1.5); K.poly(g, EYE_L, 1.5); K.poly(g, BROW_R, 1.15); K.poly(g, BROW_L, 1.15); K.poly(g, LIPS_OUT, 1.06); const a = K.P(98), b = K.P(327); g.moveTo(a[0] + 6, a[1]); g.arc(a[0], a[1], 6, 0, 7); g.moveTo(b[0] + 6, b[1]); g.arc(b[0], b[1], 6, 0, 7) }, 'destination-out');
  }

  // ---------------------------------------------------------------- effect catalogue
  const BEAUTY = {
    off: {}, natural: { smooth: 0.45, bright: 0.35, slim: 0.12, eyes: 0.07 }, smooth: { smooth: 0.75, bright: 0.45 },
    glam: { smooth: 0.55, bright: 0.4, slim: 0.24, eyes: 0.15, layer: 'glam' }, sculpt: { smooth: 0.35, bright: 0.2, slim: 0.42, eyes: 0.1, nose: 0.3, chin: 0.3, layer: 'contour' }
  };
  const EFFECTS = {
    none: {}, warm: { grade: 1 }, cool: { grade: 2 }, mono: { grade: 3 }, vintage: { grade: 4 }, glow: { grade: 5 },
    ember: { layer: 'ember', feat: ['embersSoft'], glowPulse: 1 }, crown: { feat: ['crown'] }, frost: { layer: 'frost', grade: 6, gradeA: 0.8, feat: ['snow', 'breathCold'], twinkle: 0.6 },
    heat: { feat: ['eyesGlow', 'breathFire'], grade: 7, gradeA: 0.65 }, glitter: { layer: 'glitter', twinkle: 1, feat: ['glints'] }, neon: { layer: 'neon', glowPulse: 0.5 }
  };
  const GIFT_FX = {
    spark: { dur: 3200, feat: ['glintBurst'], layer: 'glitter', twinkle: 1 },
    ember: { dur: 3800, feat: ['embers'] },
    icecube: { dur: 4800, layer: 'frost', grade: 6, feat: ['snow', 'breathCold'], twinkle: 0.6 },
    hotsauce: { dur: 4800, layer: 'flush', feat: ['steam', 'breathFire'], grade: 7 },
    rose: { dur: 4800, layer: 'rose', feat: ['petals'] },
    thermo: { dur: 4800, feat: ['aura', 'eyesGlow', 'embers'], grade: 7 },
    heart: { dur: 6000, layer: 'blushPink', feat: ['heartEyes', 'hearts'] },
    mic: { dur: 6000, feat: ['shades', 'glintBurst'], grade: 8 },
    crown: { dur: 6500, feat: ['crown', 'embers'] },
    volcano: { dur: 8000, layer: 'lava', feat: ['eruption', 'embers'], grade: 7, glowPulse: 1 },
    meteor: { dur: 8000, feat: ['meteors', 'embers'] },
    phoenix: { dur: 10000, layer: 'ember', feat: ['wings', 'crown', 'eyesGlow', 'embers', 'aura'], grade: 7, glowPulse: 1 },
  };
  const BACK_FEATS = { wings: 1, aura: 1 };

  // ---------------------------------------------------------------- AR features (drawn in output pixels)
  function featTick(name, e, a, dt, t, F) {
    const S = sprites(), pf = e.pf, pb = e.pb, W = e.W, H = e.H;
    const sc = F ? F.w / 200 : W / 720;
    const head = F ? F.head : [W / 2, H * 0.36];
    const up = F ? [-F.dn[0], -F.dn[1]] : [0, -1];
    const rate = (n) => { const x = n * dt * a; return (x | 0) + (Math.random() < x % 1 ? 1 : 0) };
    const flame = (L, x, y, s, vx, vy, life) => L.add({ x, y, vx, vy, s, life: life || rnd(0.45, 0.8), sprs: S.flames, add: 1, ar: rnd(0.4, 0.75), align: 1, grow: -0.55, drag: 1.2, sway: rnd(8, 14), swayA: rnd(30, 70) * (s / 50), ph: Math.random() * 9, fade: (k) => k < 0.1 ? k / 0.1 : 1 - Math.pow((k - 0.1) / 0.9, 1.4) });
    const ember = (L, x, y, vx, vy, s) => L.add({ x, y, vx, vy, s: s || rnd(5, 11) * sc, life: rnd(1, 2.2), spr: S.ember, add: 1, sway: rnd(2, 4), swayA: rnd(10, 40) * sc, ph: Math.random() * 9, ay: -20 * sc, drag: 0.4, fade: (k) => (k < 0.1 ? k / 0.1 : 1 - k) * (0.6 + 0.4 * Math.sin(k * 40)) });
    switch (name) {
      case 'embers': case 'embersSoft': {
        const n = name === 'embers' ? 34 : 12;
        for (let i = rate(n); i--;) { const ang = Math.random() * 6.28, rr = (F ? F.w : 300) * rnd(0.55, 1.05); const x = head[0] + Math.cos(ang) * rr, y = head[1] + Math.sin(ang) * rr * 1.3 + (F ? F.h * 0.4 : 0); ember(Math.random() < 0.4 ? pb : pf, x, y, up[0] * rnd(40, 110) * sc + rnd(-20, 20) * sc, up[1] * rnd(40, 110) * sc) }
        break;
      }
      case 'crown': if (F) drawCrown(e, a, t, F, flame, ember, rate); break;
      case 'wings': if (F) drawWings(e, a, t, F, flame, rate); break;
      case 'eyesGlow': if (F) drawEyes(e, a, t, F); break;
      case 'heartEyes': if (F) [F.eyeR, F.eyeL].forEach((c) => { const s = F.eyeW * 2.1 * ease(a * 1.4) * (1 + 0.1 * Math.sin(t * 9)); const g = e.fg; g.save(); g.translate(c[0], c[1]); g.rotate(F.roll); g.globalAlpha = Math.min(1, a * 2); g.drawImage(S.heart, -s / 2, -s / 2, s, s); g.restore() }); break;
      case 'hearts': for (let i = rate(5); i--;) { const x = head[0] + rnd(-1, 1) * (F ? F.w : 300) * 1.2; pf.add({ x, y: head[1] + (F ? F.h * 0.7 : 200), vx: rnd(-20, 20), vy: -rnd(90, 170) * sc, s: rnd(26, 52) * sc, life: rnd(1.8, 2.8), spr: S.heart, sway: rnd(2, 3), swayA: 40 * sc, ph: Math.random() * 9, r: rnd(-0.3, 0.3), fade: (k) => k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 2) }) } break;
      case 'shades': if (F) drawShades(e, a, t, F); break;
      case 'breathFire': if (F && F.jaw > 0.22) { const m = F.mouth, k = clamp((F.jaw - 0.22) * 3, 0, 1); for (let i = (16 * k * a) | 0; i--;) { const sp = rnd(220, 420) * sc; const dir = [F.dn[0] + F.ux[0] * rnd(-0.5, 0.5) + F.ux[0] * F.yaw * 1.5, F.dn[1] + F.ux[1] * rnd(-0.5, 0.5) + F.ux[1] * F.yaw * 1.5]; pf.add({ x: m[0], y: m[1], vx: dir[0] * sp, vy: dir[1] * sp, ay: -260 * sc, s: rnd(30, 50) * sc, grow: 2.2, life: rnd(0.5, 0.8), sprs: S.blobs, add: 1, drag: 1.6 }) } } break;
      case 'breathCold': if (F && F.jaw > 0.22) { const m = F.mouth, k = clamp((F.jaw - 0.22) * 3, 0, 1); for (let i = (5 * k * a) | 0; i--;) { const sp = rnd(70, 140) * sc; pf.add({ x: m[0], y: m[1], vx: (F.dn[0] + rnd(-0.6, 0.6)) * sp, vy: (F.dn[1] * 0.3 - 0.3) * sp, s: rnd(30, 50) * sc, grow: 2.5, life: rnd(1, 1.6), spr: S.puff, al: 0.55, drag: 0.8 }) } } break;
      case 'steam': if (F) [[F.P(234), -1], [F.P(454), 1]].forEach(([p, s]) => { for (let i = rate(22); i--;) pf.add({ x: p[0] + up[0] * F.h * 0.08, y: p[1] + up[1] * F.h * 0.08, vx: F.ux[0] * s * rnd(90, 200) * sc + up[0] * rnd(90, 170) * sc, vy: F.ux[1] * s * rnd(90, 200) * sc + up[1] * rnd(90, 170) * sc, s: rnd(36, 60) * sc, grow: 3.6, life: rnd(0.9, 1.5), spr: S.steam, al: 0.6, drag: 1.1, fade: (k) => k < 0.1 ? k / 0.1 : Math.pow(1 - k, 1.5) }) }); break;
      case 'aura': {
        const g = e.bg, r = (F ? F.w : 300) * 1.45 * (1 + 0.05 * Math.sin(t * 5)), c = F ? [head[0] + F.dn[0] * F.h * 0.35, head[1] + F.dn[1] * F.h * 0.35] : head;
        const rg = g.createRadialGradient(c[0], c[1], r * 0.2, c[0], c[1], r); rg.addColorStop(0, 'rgba(255,200,80,' + 0.75 * a + ')'); rg.addColorStop(0.45, 'rgba(255,110,10,' + 0.5 * a + ')'); rg.addColorStop(1, 'rgba(200,30,0,0)');
        g.globalCompositeOperation = 'lighter'; g.fillStyle = rg; g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
        for (let i = rate(60); i--;) { const ang = rnd(-Math.PI, 0) + rnd(-0.5, 0.5), rr = r * rnd(0.4, 0.75); pb.add({ x: c[0] + Math.cos(ang) * rr, y: c[1] + Math.sin(ang) * rr * 1.1, vx: up[0] * rnd(120, 220) * sc + rnd(-30, 30) * sc, vy: up[1] * rnd(120, 220) * sc, s: rnd(40, 90) * sc, grow: -0.5, life: rnd(0.45, 0.9), sprs: S.blobs, add: 1, drag: 1, sway: rnd(6, 12), swayA: rnd(30, 80) * sc, ph: Math.random() * 9 }) }
        break;
      }
      case 'petals': for (let i = rate(15); i--;) pf.add({ x: rnd(-0.1, 1.1) * W, y: -50, vx: rnd(-30, 30), vy: rnd(140, 240), s: rnd(34, 62) * (W / 720), life: 9, spr: S.petal, r: rnd(0, 6), vr: rnd(-2, 2), sway: rnd(1.2, 2.2), swayA: rnd(50, 110), ph: Math.random() * 9, fade: (k) => Math.min(1, k * 20) }); break;
      case 'snow': for (let i = rate(16); i--;) pf.add({ x: rnd(-0.1, 1.1) * W, y: -30, vx: rnd(-25, 25), vy: rnd(60, 130), s: rnd(10, 28) * (W / 720), life: 12, spr: S.flake, add: 1, al: 0.9, r: rnd(0, 6), vr: rnd(-1, 1), sway: rnd(0.8, 1.6), swayA: rnd(20, 60), ph: Math.random() * 9, fade: (k) => Math.min(1, k * 20) }); break;
      case 'glints': if (F) for (let i = rate(9); i--;) { const p = F.P(pick(SKIN_PTS)); pf.add({ x: p[0] + rnd(-6, 6) * sc, y: p[1] + rnd(-6, 6) * sc, vx: 0, vy: 0, s: rnd(18, 34) * sc, life: rnd(0.35, 0.6), spr: Math.random() < 0.5 ? S.glint : S.gold, add: 1, r: rnd(0, 0.8), fade: (k) => Math.sin(k * Math.PI) }) } break;
      case 'glintBurst': {
        if (!e._burst || e._burst < t - 3) { e._burst = t; for (let i = 0; i < 46; i++) { const ang = Math.random() * 6.28, sp = rnd(150, 520) * sc; pf.add({ x: head[0], y: head[1] + (F ? F.h * 0.45 : 0), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: 2.2, s: rnd(20, 46) * sc, life: rnd(0.7, 1.3), spr: Math.random() < 0.5 ? S.glint : S.gold, add: 1, r: rnd(0, 0.8), vr: rnd(-3, 3) }) } }
        if (F) for (let i = rate(12); i--;) { const p = F.P(pick(OVAL)); pf.add({ x: p[0], y: p[1], vx: rnd(-40, 40) * sc, vy: rnd(-90, -30) * sc, s: rnd(14, 28) * sc, life: rnd(0.4, 0.8), spr: S.glint, add: 1, fade: (k) => Math.sin(k * Math.PI) }) }
        break;
      }
      case 'eruption': {
        const top = F ? F.top : [W / 2, H * 0.2];
        for (let i = rate(70); i--;) { const sp = rnd(450, 900) * sc, ang = Math.atan2(up[1], up[0]) + rnd(-0.45, 0.45); pf.add({ x: top[0] + rnd(-20, 20) * sc, y: top[1], vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ay: 900 * sc, s: rnd(34, 64) * sc, grow: 0.8, life: rnd(0.8, 1.3), sprs: S.blobs, add: 1, drag: 0.6 }) }
        for (let i = rate(30); i--;) { const sp = rnd(400, 800) * sc, ang = Math.atan2(up[1], up[0]) + rnd(-0.7, 0.7); pf.add({ x: top[0], y: top[1], vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ay: 1100 * sc, s: rnd(8, 16) * sc, life: rnd(1.2, 2), spr: S.ember, add: 1 }) }
        for (let i = rate(6); i--;) pf.add({ x: top[0] + rnd(-30, 30) * sc, y: top[1] - 40 * sc, vx: up[0] * 120 * sc + rnd(-40, 40), vy: up[1] * 120 * sc, s: rnd(60, 100) * sc, grow: 2, life: rnd(1.4, 2.2), spr: S.smoke, al: 0.8, drag: 0.5 });
        break;
      }
      case 'meteors': {
        const q = W / 720; e._met = e._met || []; e._metT = (e._metT || 0) - dt * a;
        if (e._metT <= 0 && a > 0.2) { e._metT = rnd(0.45, 0.8); const side = Math.random() < 0.5 ? -1 : 1, tx = W / 2 + side * rnd(0.28, 0.48) * W, ty = rnd(0.12, 0.6) * H, sp = rnd(1100, 1500) * q, ang = rnd(1.9, 2.3);
          const dur = rnd(0.45, 0.7); e._met.push({ x: tx - Math.cos(ang) * sp * dur, y: ty - Math.sin(ang) * sp * dur, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ty, s: rnd(60, 100) * q }) }
        e._met = e._met.filter((m) => {
          m.x += m.vx * dt; m.y += m.vy * dt;
          for (let i = 0; i < 5; i++) { const k = Math.random(); pf.add({ x: m.x - m.vx * dt * k + rnd(-5, 5) * q, y: m.y - m.vy * dt * k + rnd(-5, 5) * q, vx: -m.vx * 0.05 + rnd(-30, 30), vy: -m.vy * 0.05 + rnd(-30, 30), s: m.s * rnd(0.45, 0.85), grow: -0.7, life: rnd(0.3, 0.5), sprs: S.blobs, add: 1 }) }
          for (let i = 0; i < 2; i++) pf.add({ x: m.x, y: m.y, vx: rnd(-160, 160) * q, vy: rnd(-160, 60) * q, ay: 400 * q, s: rnd(6, 12) * q, life: rnd(0.5, 1), spr: S.ember, add: 1 });
          pf.add({ x: m.x, y: m.y, vx: 0, vy: 0, s: m.s * 1.4, life: 0.05, spr: S.hot, add: 1, fade: () => 1 });
          if (m.y > m.ty) { for (let i = 0; i < 34; i++) { const an = Math.random() * 6.28, sp = rnd(150, 520) * q; pf.add({ x: m.x, y: m.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 150 * q, ay: 600 * q, s: rnd(24, 60) * q, grow: 0.5, life: rnd(0.5, 0.9), sprs: S.blobs, add: 1, drag: 1.8 }) }
            pf.add({ x: m.x, y: m.y, vx: 0, vy: 0, s: m.s * 5, grow: 0.8, life: 0.35, spr: S.hot, add: 1, fade: (k) => 1 - k }); return false }
          return true;
        });
        break;
      }
    }
  }
  // crown: polished gold with gems, flames licking off each point
  function drawCrown(e, a, t, F, flame, ember, rate) {
    const g = e.fg, s = F.w / 200 * F.sq, k = ease(a * 1.6), drop = (1 - k) * -120;
    const toW = (x, y) => [F.top[0] + F.ux[0] * x * s + F.dn[0] * (y + drop) * (F.w / 200), F.top[1] + F.ux[1] * x * s + F.dn[1] * (y + drop) * (F.w / 200)];
    const tips = [[-84, -46], [-42, -60], [0, -78], [42, -60], [84, -46]];
    { const c = toW(0, -40), rr = F.w * 0.75; g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], rr); rg.addColorStop(0, 'rgba(255,170,50,' + 0.45 * a + ')'); rg.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = rg; g.beginPath(); g.arc(c[0], c[1], rr, 0, 7); g.fill(); g.restore() }
    g.save(); g.globalAlpha = Math.min(1, a * 2.5);
    g.setTransform(e.ff * F.ux[0] * s, e.ff * F.ux[1] * s, e.ff * F.dn[0] * F.w / 200, e.ff * F.dn[1] * F.w / 200, e.ff * F.top[0], e.ff * F.top[1]); g.translate(0, drop);
    const body = () => { g.beginPath(); g.moveTo(-96, 6); g.lineTo(-96, -14); tips.forEach(([x, y], i) => { const prev = i ? tips[i - 1][0] : -96; g.lineTo((prev + x) / 2, -20); g.lineTo(x, y) }); g.lineTo(96, -20); g.lineTo(96, -14); g.lineTo(96, 6); g.quadraticCurveTo(0, 18, -96, 6); g.closePath() };
    const lg = g.createLinearGradient(0, -80, 0, 14); lg.addColorStop(0, '#fff7d0'); lg.addColorStop(0.25, '#ffd45a'); lg.addColorStop(0.6, '#e09a1c'); lg.addColorStop(1, '#8a4a06');
    g.shadowColor = 'rgba(255,140,20,.85)'; g.shadowBlur = 18 * e.ff; g.fillStyle = lg; body(); g.fill(); g.shadowBlur = 0;
    const band = g.createLinearGradient(0, -16, 0, 12); band.addColorStop(0, '#ffe28a'); band.addColorStop(0.5, '#c97b10'); band.addColorStop(1, '#6e3a04');
    g.fillStyle = band; g.beginPath(); g.moveTo(-96, -14); g.lineTo(96, -14); g.lineTo(96, 6); g.quadraticCurveTo(0, 18, -96, 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,250,220,.85)'; g.lineWidth = 1.6; body(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-90, -11); g.quadraticCurveTo(0, -3, 90, -11); g.stroke();
    const gem = (x, y, r, c1, c2) => { const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r); rg.addColorStop(0, '#fff'); rg.addColorStop(0.25, c1); rg.addColorStop(1, c2); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,240,200,.9)'; g.lineWidth = 1.2; g.stroke() };
    { g.save(); g.globalCompositeOperation = 'source-atop'; const cy = g.createLinearGradient(-100, 0, 100, 0); cy.addColorStop(0, 'rgba(60,25,0,.55)'); cy.addColorStop(0.22, 'rgba(60,25,0,0)'); cy.addColorStop(0.45, 'rgba(255,255,230,.28)'); cy.addColorStop(0.55, 'rgba(255,255,230,0)'); cy.addColorStop(0.8, 'rgba(60,25,0,0)'); cy.addColorStop(1, 'rgba(60,25,0,.6)'); g.fillStyle = cy; g.fillRect(-100, -90, 200, 112); g.restore() }
    g.strokeStyle = 'rgba(120,60,0,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-94, 2); g.quadraticCurveTo(0, 13, 94, 2); g.stroke(); for (let x = -86; x <= 86; x += 12) { if (Math.abs(x) < 14 || Math.abs(Math.abs(x) - 50) < 10) continue; g.fillStyle = 'rgba(255,245,200,.8)'; g.beginPath(); g.arc(x, -3 + (x * x) / 9000 * 4, 1.4, 0, 7); g.fill() }
    gem(0, -2, 9, '#ff7a1a', '#8a1000'); gem(-50, -2, 6, '#ffb347', '#a33a00'); gem(50, -2, 6, '#ffb347', '#a33a00');
    tips.forEach(([x, y]) => gem(x, y, 5, '#ffe9a0', '#d06000'));
    const sweep = ((t * 0.6) % 1) * 260 - 130; const sh = g.createLinearGradient(sweep - 30, 0, sweep + 30, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = sh; g.fillRect(-100, -90, 200, 110);
    g.restore(); g.setTransform(e.ff, 0, 0, e.ff, 0, 0);
    const up = [-F.dn[0], -F.dn[1]], sc = F.w / 200;
    tips.forEach(([x, y]) => { const p = toW(x, y - 4); for (let i = rate(9); i--;) flame(e.pf, p[0] + rnd(-6, 6) * sc, p[1] + rnd(-4, 4) * sc, rnd(36, 64) * sc * (y < -70 ? 1.2 : 1), up[0] * rnd(120, 230) * sc + rnd(-40, 40) * sc, up[1] * rnd(120, 230) * sc, rnd(0.3, 0.6));
      for (let i = rate(46); i--;) e.pf.add({ x: p[0] + rnd(-12, 12) * sc, y: p[1] + rnd(-4, 6) * sc, vx: up[0] * rnd(90, 200) * sc + rnd(-45, 45) * sc, vy: up[1] * rnd(90, 200) * sc, s: rnd(22, 46) * sc, grow: -0.55, life: rnd(0.25, 0.6), sprs: sprites().blobs, add: 1, drag: 1.2, sway: rnd(9, 15), swayA: rnd(40, 90) * sc, ph: Math.random() * 9 }) });
    for (let i = rate(6); i--;) { const p = toW(rnd(-90, 90), -30); ember(e.pf, p[0], p[1], up[0] * rnd(60, 140) * sc, up[1] * rnd(60, 140) * sc) }
  }
  // phoenix wings: a real wing silhouette (arm, primaries fanning up from the wrist, secondaries hanging off the arm,
  // golden coverts on top), made of fire feathers, beating slowly behind the shoulders
  function drawWings(e, a, t, F, flame, rate) {
    const g = e.bg, f = e.bf, k = ease(a * 1.2), sc = F.w / 200, up = [-F.dn[0], -F.dn[1]];
    const Lw = Math.min(F.w * 2.2, e.H * 0.5) * (0.35 + 0.65 * k);
    const base = [F.chin[0] + F.dn[0] * F.h * 0.42, F.chin[1] + F.dn[1] * F.h * 0.42];
    const cr = Math.cos(F.roll), sr = Math.sin(F.roll);
    const feather = (x, y, ang, len, wid, c0, c1, c2) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      const lg = g.createLinearGradient(0, 0, len, 0); lg.addColorStop(0, c0); lg.addColorStop(0.45, c1); lg.addColorStop(1, c2);
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, -wid * 0.3); g.bezierCurveTo(len * 0.35, -wid, len * 0.8, -wid * 0.75, len, 0); g.bezierCurveTo(len * 0.8, wid * 0.6, len * 0.35, wid * 0.8, 0, wid * 0.3); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,245,200,' + 0.55 * a + ')'; g.lineWidth = Math.max(1, wid * 0.08); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -wid * 0.12, len * 0.96, 0); g.stroke();
      g.restore();
    };
    [-1, 1].forEach((side) => {
      const sh = [base[0] + F.ux[0] * side * F.w * 0.62, base[1] + F.ux[1] * side * F.w * 0.62];
      const beat = Math.sin(t * 2.4) * 0.09 * (0.4 + 0.6 * k) - (1 - k) * 0.6;
      g.save(); g.setTransform(f, 0, 0, f, 0, 0); g.translate(sh[0], sh[1]); g.rotate(F.roll); g.scale(side, 1); g.rotate(-beat);
      const wr = [Lw * 0.62, -Lw * 0.62], ctrl = [Lw * 0.22, -Lw * 0.42];
      const arm = (u) => [(1 - u) * (1 - u) * 0 + 2 * (1 - u) * u * ctrl[0] + u * u * wr[0], 2 * (1 - u) * u * ctrl[1] + u * u * wr[1]];
      const A = a, cb = Math.cos(-beat), sb = Math.sin(-beat), toWorld = (p) => { const rx = side * (p[0] * cb - p[1] * sb), ry = p[0] * sb + p[1] * cb; return [sh[0] + rx * cr - ry * sr, sh[1] + rx * sr + ry * cr] };
      g.globalCompositeOperation = 'source-over';
      // secondaries (hang off the arm, outward and down)
      for (let i = 0; i < 9; i++) { const u = 0.04 + i * 0.11, p = arm(u), ang = -1.45 + u * 0.7 + Math.sin(t * 3 + i) * 0.03, len = Lw * (0.5 + u * 0.38);
        feather(p[0], p[1], ang, len, Lw * 0.085, 'rgba(255,170,40,' + 0.95 * A + ')', 'rgba(235,70,10,' + 0.85 * A + ')', 'rgba(140,10,0,0)') }
      // primaries (fan up and out from the wrist)
      for (let i = 0; i < 8; i++) { const fr = i / 7, ang = -0.72 + fr * 0.55 + Math.sin(t * 3.2 + i) * 0.03, len = Lw * (0.85 - fr * 0.35);
        feather(wr[0], wr[1], ang, len, Lw * 0.08, 'rgba(255,200,70,' + A + ')', 'rgba(255,95,15,' + 0.85 * A + ')', 'rgba(160,15,0,0)');
        if (i % 2 === 0) { const tip = toWorld([wr[0] + Math.cos(ang) * len * 0.92, wr[1] + Math.sin(ang) * len * 0.92]); for (let q = rate(9); q--;) flame(e.pb, tip[0], tip[1], rnd(34, 60) * sc, up[0] * 140 * sc, up[1] * 140 * sc, rnd(0.35, 0.6)) } }
      // coverts: shorter bright golden layer over the arm
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) { const u = 0.05 + i * 0.1, p = arm(u), ang = -1.35 + u * 0.75, len = Lw * (0.22 + u * 0.1);
        feather(p[0], p[1], ang, len, Lw * 0.06, 'rgba(255,250,215,' + 0.5 * A + ')', 'rgba(255,200,70,' + 0.35 * A + ')', 'rgba(255,120,20,0)') }
      g.lineCap = 'round'; const ag = g.createLinearGradient(0, 0, wr[0], wr[1]); ag.addColorStop(0, 'rgba(255,240,190,' + 0.9 * A + ')'); ag.addColorStop(1, 'rgba(255,170,60,' + 0.7 * A + ')');
      g.strokeStyle = ag; g.lineWidth = Lw * 0.035; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ctrl[0], ctrl[1], wr[0], wr[1]); g.stroke();
      g.restore();
      for (let q = rate(14); q--;) { const p = toWorld(arm(Math.random())); flame(e.pb, p[0], p[1], rnd(30, 50) * sc, up[0] * 120 * sc, up[1] * 120 * sc, rnd(0.3, 0.55)) }
    });
    g.setTransform(f, 0, 0, f, 0, 0);
  }
  function drawEyes(e, a, t, F) {
    const g = e.fg, S = sprites();
    [[F.irisR, EYE_R], [F.irisL, EYE_L]].forEach(([c, ring]) => {
      const r = F.irisRad * (1.15 + 0.1 * Math.sin(t * 11));
      g.save(); g.beginPath(); ring.forEach((i, k) => { const p = F.P(i); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]) }); g.closePath(); g.clip();
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a * 1.5);
      const rg = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * 1.4); rg.addColorStop(0, 'rgba(255,255,230,1)'); rg.addColorStop(0.35, 'rgba(255,200,60,.95)'); rg.addColorStop(0.75, 'rgba(255,90,0,.7)'); rg.addColorStop(1, 'rgba(255,40,0,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(c[0], c[1], r * 1.4, 0, 7); g.fill(); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a * 1.2) * 0.85;
      const s = r * 9; g.drawImage(S.fire, c[0] - s / 2, c[1] - s / 2, s, s);
      g.translate(c[0], c[1]); g.rotate(F.roll); const fl = F.w * 0.24; const lg = g.createLinearGradient(-fl, 0, fl, 0); lg.addColorStop(0, 'rgba(255,140,30,0)'); lg.addColorStop(0.5, 'rgba(255,230,170,.7)'); lg.addColorStop(1, 'rgba(255,140,30,0)');
      g.fillStyle = lg; g.fillRect(-fl, -1.2, fl * 2, 2.4); g.restore();
    });
  }
  function drawShades(e, a, t, F) {
    const g = e.fg, k = ease(a * 1.8), mid = [(F.eyeR[0] + F.eyeL[0]) / 2, (F.eyeR[1] + F.eyeL[1]) / 2], s = F.w / 200;
    g.save(); g.setTransform(e.ff * F.ux[0] * s * F.sq, e.ff * F.ux[1] * s * F.sq, e.ff * F.dn[0] * s, e.ff * F.dn[1] * s, e.ff * mid[0], e.ff * mid[1]); g.translate(0, (1 - k) * -260); g.globalAlpha = Math.min(1, a * 3);
    const lens = (cx) => { const m = cx < 0 ? -1 : 1; g.beginPath(); g.moveTo(cx - 40 * m, -20); g.quadraticCurveTo(cx, -27, cx + 40 * m, -21); g.bezierCurveTo(cx + 44 * m, 4, cx + 30 * m, 32, cx + 4 * m, 32); g.bezierCurveTo(cx - 22 * m, 32, cx - 42 * m, 10, cx - 40 * m, -20); g.closePath() };
    g.translate(0, 6); g.scale(1.12, 1.18);
    [-47, 47].forEach((cx) => {
      g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 10 * e.ff; g.shadowOffsetY = 4 * e.ff; const lg = g.createLinearGradient(cx, -26, cx, 32); lg.addColorStop(0, 'rgba(18,10,8,.97)'); lg.addColorStop(0.55, 'rgba(70,28,8,.95)'); lg.addColorStop(1, 'rgba(190,80,10,.9)');
      g.fillStyle = lg; lens(cx); g.fill(); g.restore(); g.save(); lens(cx); g.clip();
      const sky = g.createLinearGradient(cx - 40, -26, cx + 30, 10); sky.addColorStop(0, 'rgba(255,255,255,.28)'); sky.addColorStop(0.4, 'rgba(255,200,150,.08)'); sky.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sky; g.fillRect(cx - 50, -30, 100, 70);
      const sw = ((t * 0.45) % 1) * 180 - 90; const rl = g.createLinearGradient(cx + sw - 26, -26, cx + sw + 12, 32); rl.addColorStop(0, 'rgba(255,255,255,0)'); rl.addColorStop(0.5, 'rgba(255,230,190,.5)'); rl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rl; g.fillRect(cx - 50, -30, 100, 70);
      g.restore();
      const fr = g.createLinearGradient(cx - 40, -26, cx + 40, 32); fr.addColorStop(0, '#fff1b8'); fr.addColorStop(0.35, '#ffb83d'); fr.addColorStop(0.7, '#b8640a'); fr.addColorStop(1, '#ffd77a'); g.strokeStyle = fr; g.lineWidth = 4.6; lens(cx); g.stroke();
      g.strokeStyle = 'rgba(255,255,240,.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 34 * Math.sign(cx), -21); g.quadraticCurveTo(cx, -26, cx + 34 * Math.sign(cx), -21); g.stroke();
    });
    const fr2 = g.createLinearGradient(-20, 0, 20, 0); fr2.addColorStop(0, '#ffb83d'); fr2.addColorStop(0.5, '#fff1b8'); fr2.addColorStop(1, '#ffb83d'); g.strokeStyle = fr2; g.lineWidth = 4.2;
    g.beginPath(); g.moveTo(-8, -20); g.quadraticCurveTo(0, -27, 8, -20); g.stroke(); g.lineWidth = 2.6; g.beginPath(); g.moveTo(-10, -12); g.quadraticCurveTo(0, -16, 10, -12); g.stroke();
    g.lineWidth = 4.6; g.strokeStyle = '#d9891c'; g.beginPath(); g.moveTo(-86, -18); g.lineTo(-104, -16); g.moveTo(86, -18); g.lineTo(104, -16); g.stroke();
    [-87, 87].forEach((x) => { g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(x, -19, 2.4, 0, 7); g.fill() });
    g.restore(); g.setTransform(e.ff, 0, 0, e.ff, 0, 0);
  }

  // ---------------------------------------------------------------- shaders
  const VQ = 'attribute vec2 aP;uniform float uFlip;varying vec2 vUv;void main(){vUv=aP*.5+.5;if(uFlip>.5)vUv.y=1.-vUv.y;gl_Position=vec4(aP,0.,1.);}';
  const FCOPY = 'precision mediump float;varying vec2 vUv;uniform sampler2D t;uniform vec4 uMap;void main(){gl_FragColor=vec4(texture2D(t,vUv*uMap.xy+uMap.zw).rgb,1.);}';
  const FBIL = `precision mediump float;varying vec2 vUv;uniform sampler2D t;uniform vec2 uDir;uniform float uSig;
void main(){vec3 c=texture2D(t,vUv).rgb;vec3 s=c;float ws=1.;
for(int i=1;i<=7;i++){float fi=float(i);float g=exp(-fi*fi/22.);
vec3 a=texture2D(t,vUv+uDir*fi).rgb;vec3 b=texture2D(t,vUv-uDir*fi).rgb;
float wa=g*exp(-dot(a-c,a-c)*uSig);float wb=g*exp(-dot(b-c,b-c)*uSig);s+=a*wa+b*wb;ws+=wa+wb;}
gl_FragColor=vec4(s/ws,1.);}`;
  const VMESH = 'attribute vec2 aP;attribute vec2 aUV;uniform vec2 uRes;varying vec2 vT;void main(){vT=aUV;gl_Position=vec4(aP/uRes*2.-1.,0.,1.);}';
  const FMESH = 'precision mediump float;varying vec2 vT;uniform sampler2D t;uniform float uA;void main(){gl_FragColor=texture2D(t,vT)*uA;}';
  const FFINAL = `precision highp float;varying vec2 vUv;
uniform sampler2D tSrc,tBlur,tMask,tPaint,tGlow,tFront,tBack,tSeg;
uniform vec2 uRes;uniform vec4 uEye[2];uniform vec4 uPull[14];uniform float uPullR[14];
uniform float uWarp,uSmooth,uGSmooth,uBright,uFace,uTime,uPaint,uGlow,uTwinkle,uFront,uBack,uSeg,uG1,uA1,uG2,uA2;uniform vec4 uSegMap;
vec3 ov(vec3 b,vec3 p){return mix(2.*b*p,1.-2.*(1.-b)*(1.-p),step(.5,b));}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 grade(vec3 c,float gg,float a,vec2 u){if(a<=0.)return c;vec3 o=c;
 if(gg<1.5)o=ov(c,vec3(1.,.64,.38));
 else if(gg<2.5)o=ov(c,vec3(.38,.6,1.));
 else if(gg<3.5){float l=lum(c);o=ov(vec3(l),vec3(.56));}
 else if(gg<4.5){o=mix(c,vec3(lum(c)),.45);o=ov(o,vec3(.64,.5,.34));o=o*.9+vec3(.07,.05,.02);}
 else if(gg<5.5){vec3 b=texture2D(tBlur,u).rgb;o=1.-(1.-c)*(1.-b*.5);o=ov(o,vec3(.6,.53,.46));}
 else if(gg<6.5){o=mix(c,vec3(lum(c)),.35);o=ov(o,vec3(.42,.58,.72))+vec3(.02,.04,.07);}
 else if(gg<7.5){o=ov(c,vec3(.68,.5,.4));o=mix(vec3(lum(o)),o,1.1);}
 else {vec2 d=vUv-vec2(.5,.36);float v=smoothstep(.72,.18,length(d*vec2(1.,.62)));o=c*mix(.4,1.1,v);}
 return mix(c,clamp(o,0.,1.),a);}
void main(){vec2 p=vUv*uRes;vec2 q=p;
 if(uWarp>0.){
  for(int i=0;i<2;i++){vec4 e=uEye[i];if(e.w!=0.){vec2 d=q-e.xy;float r=length(d)/e.z;if(r<1.){float f=1.-r*r;q=e.xy+d*(1.-e.w*f*f);}}}
  vec2 off=vec2(0.);for(int i=0;i<14;i++){float R=uPullR[i];if(R>0.){vec2 d=p-uPull[i].xy;off+=uPull[i].zw*exp(-dot(d,d)/(R*R));}}
  q+=off;}
 vec2 u=clamp(q/uRes,0.,1.);
 vec3 c=texture2D(tSrc,u).rgb;
 if(uSmooth>0.||uGSmooth>0.){float m=max(texture2D(tMask,u).r*uSmooth*uFace,uGSmooth);vec3 b=texture2D(tBlur,u).rgb;
  c=mix(c,b,m*.85);c=mix(c,1.-(1.-c)*(1.-c*.22),m*uBright);}
 if(uPaint>0.){vec4 pa=texture2D(tPaint,u);if(pa.a>.002){c=mix(c,ov(c,pa.rgb/pa.a),clamp(pa.a,0.,1.));}}
 if(uGlow>0.){vec3 g=texture2D(tGlow,u).rgb;float tw=1.-uTwinkle+uTwinkle*(.35+.65*pow(.5+.5*sin(uTime*7.+hash(floor(p/2.))*60.),3.));c+=g*tw;}
 if(uBack>0.){vec4 bk=texture2D(tBack,vUv);float per=uSeg>0.?texture2D(tSeg,vUv*uSegMap.xy+uSegMap.zw).r:0.;per=smoothstep(.25,.75,per);float k=1.-per;c=c*(1.-bk.a*k)+bk.rgb*k;}
 c=grade(c,uG1,uA1,u);c=grade(c,uG2,uA2,u);
 if(uFront>0.){vec4 f=texture2D(tFront,vUv);c=c*(1.-f.a)+f.rgb;}
 gl_FragColor=vec4(clamp(c,0.,1.),1.);}`;

  // ---------------------------------------------------------------- engine
  class Engine {
    constructor(W, H) {
      W = W || 720; H = H || 1280; this.W = W; this.H = H;
      this.c = mkCanvas(W, H);
      const gl = this.c.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, stencil: false });
      if (!gl) throw new Error('no webgl'); this.gl = gl;
      this.v = document.createElement('video'); this.v.muted = true; this.v.playsInline = true; this.v.setAttribute('playsinline', ''); this.v.setAttribute('autoplay', '');
      const mk = (vs, fs) => { const s = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o };
        const p = gl.createProgram(); gl.attachShader(p, s(gl.VERTEX_SHADER, vs)); gl.attachShader(p, s(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aUV'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name) } return { p, u } };
      this.pCopy = mk(VQ, FCOPY); this.pBil = mk(VQ, FBIL); this.pMesh = mk(VMESH, FMESH); this.pFinal = mk(VQ, FFINAL);
      this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.meshPos = gl.createBuffer(); this.meshUV = gl.createBuffer(); this.meshIdx = gl.createBuffer(); this.nIdx = 0;
      const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t };
      this._tex = tex;
      const rt = (w, h) => { const t = tex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h } };
      const hw = W >> 1, hh = H >> 1;
      this.rSrc = rt(W, H); this.rH = rt(hw, hh); this.rB = rt(hw, hh); this.rMask = rt(hw, hh); this.rPaint = rt(W, H); this.rGlow = rt(hw, hh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.tVid = tex(); this.tFront = tex(); this.tBack = tex(); this.tSeg = tex(); this.tBlank = tex();
      gl.bindTexture(gl.TEXTURE_2D, this.tBlank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      this.ff = 0.75; this.bf = 0.5;
      this.front = mkCanvas((W * this.ff) | 0, (H * this.ff) | 0); this.fg = this.front.getContext('2d');
      this.back = mkCanvas((W * this.bf) | 0, (H * this.bf) | 0); this.bg = this.back.getContext('2d');
      this.segC = mkCanvas(90, 160); this.segG = this.segC.getContext('2d');
      this.pf = new Parts(); this.pb = new Parts();
      this.uvLayers = {}; this.uvCan = [mkCanvas(UVS, UVS), mkCanvas(UVS, UVS)];
      this.beauty = 'off'; this.effect = 'none'; this.gifts = []; this.fxStr = 'off:none';
      this.euro = new Euro(478 * 2, 1.2, 0.012); this.raw = new Float32Array(478 * 2); this.lm = null; this.faceA = 0; this.seenAt = -1e9; this.jaw = 0;
      this.uv = null; this.uvScore = 9; this.uvAt = 0; this.uvN = 0; this.uvVer = 0;
      this.status = 'idle'; this.onstatus = null; this.raf = 0; this.last = 0; this.t0 = performance.now(); this.tick = this.tick.bind(this);
      this.detMs = 0; this.skip = 0; this.segMask = null; this.segAt = 0;
    }
    static supported() { try { const c = mkCanvas(2, 2); return !!(c.getContext('webgl') && HTMLCanvasElement.prototype.captureStream) } catch (e) { return false } }
    get fx() { return this.fxStr }
    set fx(s) {
      s = String(s || 'off:none'); const legacy = { none: 'off:none', smooth: 'smooth:none', beauty: 'natural:none', glow: 'off:glow', warm: 'off:warm', cool: 'off:cool', mono: 'off:mono', vintage: 'off:vintage' };
      if (legacy[s]) s = legacy[s]; const [b, e] = s.split(':'); this.beauty = BEAUTY[b] ? b : 'off'; this.effect = EFFECTS[e] ? e : 'none'; this.fxStr = this.beauty + ':' + this.effect; this.need();
    }
    gift(id, qty) { const d = GIFT_FX[id]; if (!d) return; const now = this.now(); const ex = this.gifts.find((g) => g.id === id); const dur = d.dur * (qty > 1 ? Math.min(1.8, 1 + qty * 0.08) : 1);
      if (ex) ex.end = Math.max(ex.end, now + dur); else { this.gifts.push({ id, start: now, end: now + dur }); if (this.gifts.length > 3) this.gifts.shift() } this.need() }
    now() { return (performance.now() - this.t0) / 1000 }
    setStatus(s) { if (this.status !== s) { this.status = s; try { this.onstatus && this.onstatus(s) } catch (e) { } } }
    needsFace() { const b = BEAUTY[this.beauty], e = EFFECTS[this.effect]; return !!(b.smooth || b.slim || b.eyes || b.layer || e.layer || (e.feat && e.feat.length) || this.gifts.length) }
    need() { if (this.needsFace() && !this.tr && !this.trLoading) { this.trLoading = true; this.setStatus('loading'); loadTracker().then((t) => { this.tr = t; this.buildTris(t.tess); this.setStatus('ready') }, () => this.setStatus('failed')).finally(() => { this.trLoading = false }) } }
    buildTris(edges) {
      const adj = Array.from({ length: 478 }, () => new Set()); edges.forEach((e) => { adj[e.start].add(e.end); adj[e.end].add(e.start) });
      const tris = []; for (let a = 0; a < 478; a++) for (const b of adj[a]) if (b > a) for (const c of adj[b]) if (c > b && adj[a].has(c)) tris.push(a, b, c);
      const gl = this.gl; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(tris), gl.STATIC_DRAW); this.nIdx = tris.length;
    }
    setSource(stream) { this.v.srcObject = stream; this.v.play().catch(() => { }); this.facing = ((stream.getVideoTracks()[0] || {}).getSettings ? (stream.getVideoTracks()[0].getSettings().facingMode || 'user') : 'user'); if (!this.raf) this.raf = requestAnimationFrame(this.tick) }
    stream(fps) { try { return this.c.captureStream(fps || 30) } catch (e) { return null } }
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; try { this.v.pause() } catch (e) { } this.v.srcObject = null; const gl = this.gl; setTimeout(() => { try { const x = gl.getExtension('WEBGL_lose_context'); x && x.loseContext() } catch (e) { } }, 300) }

    // ---- per frame
    tick(nowMs) {
      this.raf = requestAnimationFrame(this.tick); if (nowMs - this.last < 30) return; const dt = Math.min(0.1, (nowMs - (this.last || nowMs)) / 1000) || 1 / 30; this.last = nowMs;
      const v = this.v; if (!v.videoWidth || v.readyState < 2) return;
      try { this.frame(dt) } catch (err) { if (!this._warned) { this._warned = 1; console.warn('facefx', err) } }
    }
    frame(dt) {
      const gl = this.gl, v = this.v, W = this.W, H = this.H, t = this.now();
      const vw = v.videoWidth, vh = v.videoHeight, k = Math.max(W / vw, H / vh), offX = (W - vw * k) / 2, offY = (H - vh * k) / 2;
      this.map = [W / (vw * k), H / (vh * k), -offX / (vw * k), -offY / (vh * k)];
      this.gifts = this.gifts.filter((g) => g.end > t - 0.6);
      const B = BEAUTY[this.beauty], E = EFFECTS[this.effect];
      const giftA = (g) => Math.min(clamp((t - g.start) / 0.5, 0, 1), clamp((g.end - t) / 0.6, 0, 1));
      // track
      const wantFace = this.needsFace(); if (wantFace) this.need();
      if (wantFace && this.tr) this.track(vw, vh, k, offX, offY, dt);
      const faceOn = this.lm && t - this.seenAt < 0.35;
      this.faceA += ((faceOn ? 1 : 0) - this.faceA) * Math.min(1, dt * (faceOn ? 8 : 5));
      const F = this.lm && this.faceA > 0.02 ? this.faceFrame() : null;
      // video -> src
      gl.disable(gl.BLEND);
      gl.bindTexture(gl.TEXTURE_2D, this.tVid); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      this.pass(this.pCopy, this.rSrc, { t: this.tVid }, (u) => gl.uniform4fv(u.uMap, this.map));
      // smoothing
      const sm = (B.smooth || 0), useMask = sm > 0 && this.tr && F, gSm = sm > 0 && !(this.tr) && this.status === 'failed' ? sm * 0.5 : 0;
      const needBlur = sm > 0 || E.grade === 5;
      if (needBlur) {
        this.pass(this.pBil, this.rH, { t: this.rSrc.t }, (u) => { gl.uniform2f(u.uDir, 1.6 / W, 0); gl.uniform1f(u.uSig, 38) });
        this.pass(this.pBil, this.rB, { t: this.rH.t }, (u) => { gl.uniform2f(u.uDir, 0, 1.6 / H); gl.uniform1f(u.uSig, 38) });
      }
      // face-space layers
      const layers = [];
      if (F && this.uv) {
        if (B.layer) layers.push([B.layer, 1, 0]);
        if (E.layer) layers.push([E.layer, 1, E.glowPulse || 0]);
        this.gifts.forEach((g) => { const d = GIFT_FX[g.id]; if (d.layer) layers.push([d.layer, giftA(g), d.glowPulse || 0]) });
      }
      let twinkle = (E.twinkle || 0); this.gifts.forEach((g) => { const d = GIFT_FX[g.id]; if (d.twinkle) twinkle = Math.max(twinkle, d.twinkle * giftA(g)) });
      const hasPaint = layers.length > 0;
      if (F && this.uv && (useMask || hasPaint)) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPos); gl.bufferData(gl.ARRAY_BUFFER, this.lm, gl.DYNAMIC_DRAW);
        if (useMask) this.meshPass(this.rMask, [[this.layerTex('mask').mask, 1]]);
        if (hasPaint) {
          const pl = layers.map(([id, a]) => [this.layerTex(id).paint, a * this.faceA]);
          const gls = layers.map(([id, a, pulse]) => [this.layerTex(id).glow, a * this.faceA * (pulse ? 0.75 + 0.25 * Math.sin(t * 4.2) * pulse + 0.25 * (1 - pulse) : 1)]);
          this.meshPass(this.rPaint, pl); this.meshPass(this.rGlow, gls);
        }
      }
      // AR layers
      const feats = []; (E.feat || []).forEach((f) => feats.push([f, 1])); this.gifts.forEach((g) => (GIFT_FX[g.id].feat || []).forEach((f) => feats.push([f, giftA(g)])));
      const ff = this.ff, bf = this.bf;
      this.fg.setTransform(1, 0, 0, 1, 0, 0); this.fg.clearRect(0, 0, this.front.width, this.front.height); this.fg.setTransform(ff, 0, 0, ff, 0, 0);
      this.bg.setTransform(1, 0, 0, 1, 0, 0); this.bg.clearRect(0, 0, this.back.width, this.back.height); this.bg.setTransform(bf, 0, 0, bf, 0, 0);
      const Fa = F && this.faceA > 0.3 ? F : null;
      feats.forEach(([f, a]) => featTick(f, this, a, dt, t, Fa));
      this.pf.step(dt); this.pb.step(dt);
      const hasFront = this.pf.a.length > 0 || feats.some(([f]) => !BACK_FEATS[f]); const hasBack = this.pb.a.length > 0 || feats.some(([f]) => BACK_FEATS[f]);
      if (hasFront) { this.pf.draw(this.fg); this.upload(this.tFront, this.front) }
      if (hasBack) { this.bg.setTransform(bf, 0, 0, bf, 0, 0); this.pb.draw(this.bg); this.upload(this.tBack, this.back); this.segment(F, vw, vh) }
      // grades: effect grade + strongest gift grade
      let g2 = 0, a2 = 0; this.gifts.forEach((g) => { const d = GIFT_FX[g.id]; if (d.grade && giftA(g) * (d.gradeA || 0.7) > a2) { g2 = d.grade; a2 = giftA(g) * (d.gradeA || 0.7) } });
      // final
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
      const p = this.pFinal, u = p.u; gl.useProgram(p.p); this.bindQuad();
      const T = [['tSrc', this.rSrc.t], ['tBlur', needBlur ? this.rB.t : this.tBlank], ['tMask', useMask ? this.rMask.t : this.tBlank], ['tPaint', hasPaint ? this.rPaint.t : this.tBlank], ['tGlow', hasPaint ? this.rGlow.t : this.tBlank], ['tFront', hasFront ? this.tFront : this.tBlank], ['tBack', hasBack ? this.tBack : this.tBlank], ['tSeg', this.tSeg]];
      T.forEach(([n, tx], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(u[n], i) }); gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(u.uFlip, 1); gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uTime, t);
      const warp = F ? this.warpUniforms(F, B) : null;
      gl.uniform1f(u.uWarp, warp ? 1 : 0);
      if (warp) { gl.uniform4fv(u.uEye, warp.eye); gl.uniform4fv(u.uPull, warp.pull); gl.uniform1fv(u.uPullR, warp.pullR) }
      gl.uniform1f(u.uSmooth, useMask ? sm : 0); gl.uniform1f(u.uGSmooth, gSm); gl.uniform1f(u.uBright, B.bright || 0); gl.uniform1f(u.uFace, this.faceA);
      gl.uniform1f(u.uPaint, hasPaint ? 1 : 0); gl.uniform1f(u.uGlow, hasPaint ? 1 : 0); gl.uniform1f(u.uTwinkle, clamp(twinkle, 0, 1));
      gl.uniform1f(u.uFront, hasFront ? 1 : 0); gl.uniform1f(u.uBack, hasBack ? 1 : 0); gl.uniform1f(u.uSeg, hasBack ? 1 : 0); gl.uniform4fv(u.uSegMap, this.segMap || [1, 1, 0, 0]);
      gl.uniform1f(u.uG1, E.grade || 0); gl.uniform1f(u.uA1, E.grade ? (E.gradeA || 1) : 0); gl.uniform1f(u.uG2, g2); gl.uniform1f(u.uA2, a2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    bindQuad() { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.disableVertexAttribArray(1) }
    pass(p, target, texs, set) {
      const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); gl.useProgram(p.p); this.bindQuad();
      let i = 0; for (const n in texs) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texs[n]); gl.uniform1i(p.u[n], i); i++ } gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(p.u.uFlip, 0); if (set) set(p.u); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    meshPass(target, draws) {
      const gl = this.gl, p = this.pMesh; gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUV); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIdx); gl.uniform2f(p.u.uRes, this.W, this.H); gl.uniform1i(p.u.t, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      draws.forEach(([tx, a]) => { if (a <= 0.003 || !tx) return; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1f(p.u.uA, a); gl.drawElements(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0) });
      gl.disable(gl.BLEND); gl.disableVertexAttribArray(1);
    }
    upload(tx, canvas) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false) }
    layerTex(id) {
      const key = id + '@' + this.uvVer; if (this.uvLayers[key]) return this.uvLayers[key];
      Object.keys(this.uvLayers).forEach((k2) => { if (!k2.endsWith('@' + this.uvVer)) { const L = this.uvLayers[k2];[L.paint, L.glow, L.mask].forEach((x) => x && this.gl.deleteTexture(x)); delete this.uvLayers[k2] } });
      const K = uvKit(this.uv), [cp, cg] = this.uvCan, P = cp.getContext('2d'), G = cg.getContext('2d'); P.clearRect(0, 0, UVS, UVS); G.clearRect(0, 0, UVS, UVS);
      const out = {};
      if (id === 'mask') { buildMask(P, K); out.mask = this.texFrom(cp) }
      else { try { LAYERS[id](P, G, K) } catch (e) { console.warn('layer', id, e) } cutEyesMouth(P, K, 3); cutEyesMouth(G, K, 3); const em = this.edgeMask(K); [P, G].forEach((g) => { g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(em, 0, 0); g.restore() }); out.paint = this.texFrom(cp); out.glow = this.texFrom(cg) }
      this.uvLayers[key] = out; return out;
    }
    edgeMask(K) { if (this._em && this._emV === this.uvVer) return this._em; const c = this._em || mkCanvas(UVS, UVS), g = c.getContext('2d'); g.clearRect(0, 0, UVS, UVS); soft(g, 16, 'rgba(0,0,0,1)', () => K.poly(g, OVAL, 0.95)); this._em = c; this._emV = this.uvVer; return c }
    texFrom(canvas) { const t = this._tex(); this.upload(t, canvas); return t }

    track(vw, vh, k, offX, offY, dt) {
      if (this.skip > 0) { this.skip--; return }
      if (this.holdTrack && this.uv && this.lm) { this.seenAt = this.now(); return }
      const t0 = performance.now(); let r; try { r = this.tr.fl.detectForVideo(this.v, nextTs()) } catch (e) { return }
      this.detMs = this.detMs * 0.8 + (performance.now() - t0) * 0.2; if (this.detMs > 28) this.skip = 1;
      const L = r && r.faceLandmarks && r.faceLandmarks[0]; if (!L) return;
      const now = this.now(); if (now - this.seenAt > 0.5) this.euro.reset();
      const raw = this.raw, n = Math.min(478, L.length); for (let i = 0; i < n; i++) { raw[i * 2] = L[i].x * vw * k + offX; raw[i * 2 + 1] = L[i].y * vh * k + offY }
      this.lm = this.euro.f(raw, dt * (this.skip ? 2 : 1)); this.seenAt = now;
      const bs = r.faceBlendshapes && r.faceBlendshapes[0]; if (bs) { const j = bs.categories.find((c) => c.categoryName === 'jawOpen'); if (j) this.jaw += (j.score - this.jaw) * 0.5 }
      // face-space layout: refine while the face gets more frontal
      const P = (i) => [this.lm[i * 2], this.lm[i * 2 + 1]], d1 = Math.hypot(P(1)[0] - P(234)[0], P(1)[1] - P(234)[1]), d2 = Math.hypot(P(1)[0] - P(454)[0], P(1)[1] - P(454)[1]);
      const yaw = Math.abs(d1 - d2) / (d1 + d2);
      if (!this.uv || (yaw < this.uvScore - 0.03 && now - this.uvAt > 0.7 && this.uvN < 6)) {
        const m = r.facialTransformationMatrixes && r.facialTransformationMatrixes[0];
        const uv = canonUV(L, vw, vh, m && m.data); if (uv) { this.uv = uv; this.uvScore = yaw; this.uvAt = now; this.uvN++; this.uvVer++; const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUV); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW) }
      }
    }
    faceFrame() {
      const lm = this.lm, P = (i) => [lm[i * 2], lm[i * 2 + 1]], cen = (ids) => { let x = 0, y = 0; ids.forEach((i) => { x += lm[i * 2]; y += lm[i * 2 + 1] }); return [x / ids.length, y / ids.length] };
      const eyeR = cen(EYE_R), eyeL = cen(EYE_L), dx = eyeL[0] - eyeR[0], dy = eyeL[1] - eyeR[1], de = Math.hypot(dx, dy) || 1;
      const ux = [dx / de, dy / de], dn = [-ux[1], ux[0]];
      const w = Math.hypot(P(454)[0] - P(234)[0], P(454)[1] - P(234)[1]), h = Math.hypot(P(152)[0] - P(10)[0], P(152)[1] - P(10)[1]);
      const d1 = Math.hypot(P(1)[0] - P(234)[0], P(1)[1] - P(234)[1]), d2 = Math.hypot(P(1)[0] - P(454)[0], P(1)[1] - P(454)[1]), yaw = (d1 - d2) / (d1 + d2);
      const top = [P(10)[0] - dn[0] * h * 0.05, P(10)[1] - dn[1] * h * 0.05];
      const irisR = lm.length >= 956 ? P(468) : eyeR, irisL = lm.length >= 956 ? P(473) : eyeL;
      const irisRad = lm.length >= 956 ? Math.max(2, Math.hypot(P(469)[0] - P(471)[0], P(469)[1] - P(471)[1]) / 2) : de * 0.08;
      return { P, eyeR, eyeL, irisR, irisL, irisRad, ux, dn, roll: Math.atan2(ux[1], ux[0]), w, h, yaw, sq: Math.max(0.45, Math.cos(yaw * 1.6)), top,
        head: [(P(10)[0] + P(152)[0]) / 2 - dn[0] * h * 0.25, (P(10)[1] + P(152)[1]) / 2 - dn[1] * h * 0.25], chin: P(152), mouth: [(P(13)[0] + P(14)[0]) / 2, (P(13)[1] + P(14)[1]) / 2],
        jaw: this.jaw, eyeW: Math.hypot(P(33)[0] - P(133)[0], P(33)[1] - P(133)[1]) };
    }
    warpUniforms(F, B) {
      const a = this.faceA, slim = (B.slim || 0) * a, eyes = (B.eyes || 0) * a, nose = (B.nose || 0) * a, chin = (B.chin || 0) * a;
      if (!slim && !eyes && !nose && !chin) return null;
      const eye = new Float32Array(8), pull = new Float32Array(14 * 4), pullR = new Float32Array(14);
      if (eyes) { const r = F.eyeW * 1.05; eye.set([F.eyeR[0], F.eyeR[1], r, eyes, F.eyeL[0], F.eyeL[1], r, eyes]) }
      let n = 0; const add = (p, d, R) => { if (n >= 14) return; pull.set([p[0], p[1], d[0], d[1]], n * 4); pullR[n++] = R };
      if (slim) { const mid = [(F.P(1)[0] + F.P(152)[0]) / 2, (F.P(1)[1] + F.P(152)[1]) / 2]; JAW_R.concat(JAW_L).forEach((i) => { const p = F.P(i), d = [p[0] - mid[0], p[1] - mid[1]], l = Math.hypot(d[0], d[1]) || 1; add(p, [d[0] / l * slim * F.w * 0.07, d[1] / l * slim * F.w * 0.07], F.w * 0.17) }) }
      if (chin) add(F.P(152), [F.dn[0] * chin * F.h * 0.05, F.dn[1] * chin * F.h * 0.05], F.w * 0.15);
      if (nose) [98, 327].forEach((i) => { const p = F.P(i), c = F.P(1), d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(d[0], d[1]) || 1; add(p, [d[0] / l * nose * F.w * 0.03, d[1] / l * nose * F.w * 0.03], F.w * 0.07) });
      return { eye, pull, pullR };
    }
    segment(F, vw, vh) {
      // real person cut-out when the segmenter is available, otherwise a soft head-and-shoulders shape
      if (!this.segTried) { this.segTried = true; loadSeg().then((s) => { this.seg = s }, () => { }) }
      const gl = this.gl;
      if (this.seg) {
        if ((this.segN = (this.segN || 0) + 1) % 2) return;
        try { this.seg.segmentForVideo(this.v, nextTs(), (res) => { const m = res.confidenceMasks && res.confidenceMasks[0]; if (!m) return; const f = m.getAsFloat32Array(), w = m.width, h = m.height, b = new Uint8Array(w * h * 4);
          for (let i = 0; i < w * h; i++) { const x = (f[i] * 255) | 0; b[i * 4] = x; b[i * 4 + 1] = x; b[i * 4 + 2] = x; b[i * 4 + 3] = 255 }
          gl.bindTexture(gl.TEXTURE_2D, this.tSeg); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, b); this.segMap = this.map }) } catch (e) { }
        return;
      }
      const g = this.segG, sw = 90 / this.W; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, 90, 160);
      if (F) { g.setTransform(sw, 0, 0, sw, 0, 0); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6;
        g.beginPath(); g.ellipse(F.head[0] + F.dn[0] * F.h * 0.2, F.head[1] + F.dn[1] * F.h * 0.2, F.w * 0.62, F.h * 0.82, F.roll, 0, 7); g.fill();
        const c = F.chin; g.beginPath(); g.moveTo(c[0] - F.w * 0.4, c[1]); g.lineTo(c[0] + F.w * 0.4, c[1]); g.lineTo(c[0] + F.w * 1.4, c[1] + F.h * 0.7); g.lineTo(c[0] + F.w * 1.6, this.H); g.lineTo(c[0] - F.w * 1.6, this.H); g.lineTo(c[0] - F.w * 1.4, c[1] + F.h * 0.7); g.closePath(); g.fill(); g.shadowBlur = 0 }
      gl.bindTexture(gl.TEXTURE_2D, this.tSeg); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.segC); this.segMap = [1, 1, 0, 0];
    }
  }
  // put the face into a flat, front-on layout (undo head turn/tilt) so paint maps cleanly onto it
  function canonUV(L, vw, vh, M) {
    const n = 478, pts = new Float32Array(n * 3); let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < n; i++) { const p = L[i] || L[0]; const X = (p.x - 0.5) * vw, Y = -(p.y - 0.5) * vh, Z = -p.z * vw; pts[i * 3] = X; pts[i * 3 + 1] = Y; pts[i * 3 + 2] = Z; mx += X; my += Y; mz += Z }
    mx /= n; my /= n; mz /= n;
    const uv = new Float32Array(n * 2);
    let R = null;
    if (M && M.length >= 12) { const col = (c) => { const v = [M[c * 4], M[c * 4 + 1], M[c * 4 + 2]], l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }; R = [col(0), col(1), col(2)] }
    if (!R) { const a = [pts[263 * 3] - pts[33 * 3], pts[263 * 3 + 1] - pts[33 * 3 + 1]], ang = Math.atan2(a[1], a[0]), c = Math.cos(-ang), s = Math.sin(-ang); R = [[c, -s, 0], [s, c, 0], [0, 0, 1]] }
    for (let i = 0; i < n; i++) { const x = pts[i * 3] - mx, y = pts[i * 3 + 1] - my, z = pts[i * 3 + 2] - mz; uv[i * 2] = R[0][0] * x + R[0][1] * y + R[0][2] * z; uv[i * 2 + 1] = -(R[1][0] * x + R[1][1] * y + R[1][2] * z) }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; OVAL.forEach((i) => { x0 = Math.min(x0, uv[i * 2]); x1 = Math.max(x1, uv[i * 2]); y0 = Math.min(y0, uv[i * 2 + 1]); y1 = Math.max(y1, uv[i * 2 + 1]) });
    const sz = Math.max(x1 - x0, y1 - y0); if (!(sz > 1)) return null; const s = 0.86 / sz, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let i = 0; i < n; i++) { uv[i * 2] = 0.5 + (uv[i * 2] - cx) * s; uv[i * 2 + 1] = 0.5 + (uv[i * 2 + 1] - cy) * s }
    return uv;
  }

  window.TempFX = {
    Engine, supported: Engine.supported, preload() { return loadTracker() },
    BEAUTY: [['off', 'Off'], ['natural', 'Natural'], ['smooth', 'Smooth'], ['glam', 'Glam'], ['sculpt', 'Sculpt']],
    EFFECTS: [['none', 'None'], ['ember', 'Ember Mask'], ['crown', 'Fire Crown'], ['heat', 'Heat Vision'], ['frost', 'Frostbite'], ['glitter', 'Glitter'], ['neon', 'Neon'], ['warm', 'Warm'], ['cool', 'Cool'], ['glow', 'Glow'], ['mono', 'Mono'], ['vintage', 'Vintage']],
    GIFT_FX: Object.keys(GIFT_FX),
  };
})();
