// Crop & resize a photo before posting: pick a shape, then pinch to zoom and drag to frame it.
import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, Image, Animated, PanResponder, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { T } from './ui';

const SHAPES = [['orig', 'Original'], [1, 'Square'], [4 / 5, '4:5'], [3 / 4, '3:4'], [16 / 9, '16:9'], [9 / 16, '9:16']];

async function cropImage(uri, rect, maxW) {
  const w = Math.round(rect.width), h = Math.round(rect.height);
  const scale = w > maxW ? maxW / w : 1;
  // newer Expo: chainable context; older: manipulateAsync
  if (ImageManipulator.ImageManipulator && ImageManipulator.ImageManipulator.manipulate) {
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
    ctx.crop({ originX: Math.round(rect.x), originY: Math.round(rect.y), width: w, height: h });
    if (scale < 1) ctx.resize({ width: Math.round(w * scale) });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.88, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: out.uri, width: out.width, height: out.height };
  }
  const acts = [{ crop: { originX: Math.round(rect.x), originY: Math.round(rect.y), width: w, height: h } }];
  if (scale < 1) acts.push({ resize: { width: Math.round(w * scale) } });
  const out = await ImageManipulator.manipulateAsync(uri, acts, { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

export function CropEditor({ asset, onDone, onClose }) {
  const ins = useSafeAreaInsets(); const { width: SW, height: SH } = Dimensions.get('window');
  const [size, setSize] = useState(asset.width && asset.height ? { w: asset.width, h: asset.height } : null);
  const [shape, setShape] = useState('orig'); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (!size) Image.getSize(asset.uri, (w, h) => setSize({ w, h }), () => setErr('Couldn’t open that photo.')); }, []);
  const boxW = SW - 32, boxH = SH - ins.top - ins.bottom - 230;
  const aspect = size ? (shape === 'orig' ? size.w / size.h : shape) : 1;
  const FW = Math.min(boxW, boxH * aspect), FH = FW / aspect;
  const base = size ? Math.max(FW / size.w, FH / size.h) : 1; // smallest scale that still fills the frame
  // gesture state: k = zoom (>=1), tx/ty = image centre offset from frame centre, in points
  const st = useRef({ k: 1, tx: 0, ty: 0 }); const g = useRef(null);
  const aK = useRef(new Animated.Value(1)).current, aX = useRef(new Animated.Value(0)).current, aY = useRef(new Animated.Value(0)).current;
  const dims = useRef({ FW, FH, base, size }); dims.current = { FW, FH, base, size };
  const clamp = (k, tx, ty) => {
    const { FW: fw, FH: fh, base: b, size: sz } = dims.current; if (!sz) return { k, tx, ty };
    k = Math.max(1, Math.min(6, k));
    const mx = Math.max(0, (sz.w * b * k - fw) / 2), my = Math.max(0, (sz.h * b * k - fh) / 2);
    return { k, tx: Math.max(-mx, Math.min(mx, tx)), ty: Math.max(-my, Math.min(my, ty)) };
  };
  const apply = (v) => { st.current = v; aK.setValue(v.k); aX.setValue(v.tx); aY.setValue(v.ty); };
  // a new shape starts framed in the middle again
  useEffect(() => { apply({ k: 1, tx: 0, ty: 0 }); }, [shape, size && size.w]);
  const pts = (e) => e.nativeEvent.touches.map((t) => ({ x: t.pageX, y: t.pageY }));
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { g.current = null; },
    onPanResponderMove: (e) => {
      const p = pts(e); if (!p.length) return;
      const c = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
      const d = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
      const cur = g.current;
      if (!cur || cur.n !== p.length) { g.current = { n: p.length, c, d, s: { ...st.current } }; return; }
      const k = cur.d && d ? cur.s.k * d / cur.d : cur.s.k;
      apply(clamp(k, cur.s.tx + (c.x - cur.c.x), cur.s.ty + (c.y - cur.c.y)));
    },
    onPanResponderRelease: () => { g.current = null; }, onPanResponderTerminate: () => { g.current = null; },
  })).current;
  const done = async () => {
    if (!size) return; setBusy(true); setErr('');
    const { k, tx, ty } = st.current; const s = base * k;
    const cw = Math.min(size.w, FW / s), ch = Math.min(size.h, FH / s);
    const cx = size.w / 2 - tx / s, cy = size.h / 2 - ty / s;
    const rect = { x: Math.max(0, Math.min(size.w - cw, cx - cw / 2)), y: Math.max(0, Math.min(size.h - ch, cy - ch / 2)), width: cw, height: ch };
    try { const out = await cropImage(asset.uri, rect, 2160); onDone({ ...asset, ...out, type: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg' }); }
    catch (e) { setErr('Couldn’t crop that photo. Try again.'); setBusy(false); }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: ins.top + 8, paddingBottom: ins.bottom + 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 48 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cancel"><T h style={{ color: '#fff', fontSize: 16 }}>Cancel</T></Pressable>
          <T h style={{ color: '#fff', fontSize: 17 }}>Crop</T>
          <Pressable onPress={done} disabled={busy || !size} hitSlop={12} accessibilityLabel="Done" style={{ backgroundColor: '#ff5500', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, opacity: busy ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <T h style={{ color: '#fff', fontSize: 15 }}>Done</T>}</Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} {...pr.panHandlers}>
          {size ? <View style={{ width: FW, height: FH, overflow: 'hidden', borderRadius: 4 }}>
            <Animated.Image source={{ uri: asset.uri }} style={{ position: 'absolute', width: size.w * base, height: size.h * base, left: (FW - size.w * base) / 2, top: (FH - size.h * base) / 2,
              transform: [{ translateX: aX }, { translateY: aY }, { scale: aK }] }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: '#fff', borderRadius: 4 }}>
              {[1, 2].map((i) => <View key={'v' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: (FW * i) / 3, width: 1, backgroundColor: 'rgba(255,255,255,.35)' }} />)}
              {[1, 2].map((i) => <View key={'h' + i} style={{ position: 'absolute', left: 0, right: 0, top: (FH * i) / 3, height: 1, backgroundColor: 'rgba(255,255,255,.35)' }} />)}
            </View>
          </View> : err ? <T b style={{ color: '#fff' }}>{err}</T> : <ActivityIndicator color="#fff" />}
        </View>
        {err && size ? <T b style={{ color: '#ff8a2b', textAlign: 'center', marginBottom: 8 }}>{err}</T> : null}
        <T b style={{ color: 'rgba(255,255,255,.6)', textAlign: 'center', fontSize: 13, marginBottom: 12 }}>Pinch to zoom · drag to move</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }}>
          {SHAPES.map(([v, l]) => <Pressable key={l} onPress={() => setShape(v)} accessibilityState={{ selected: shape === v }}
            style={{ paddingVertical: 9, paddingHorizontal: 15, borderRadius: 14, backgroundColor: shape === v ? '#fff' : 'rgba(255,255,255,.12)' }}>
            <T h style={{ color: shape === v ? '#000' : '#fff', fontSize: 14 }}>{l}</T></Pressable>)}
        </View>
      </View>
    </Modal>
  );
}
