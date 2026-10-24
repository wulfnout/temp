import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Modal, TextInput, Animated, Easing, ScrollView, ActivityIndicator, PanResponder, Keyboard, Dimensions } from 'react-native';
import { Image as XImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, T, Btn } from './ui';
import { Video } from './posts';
import { act } from './data';
import * as ImagePicker from 'expo-image-picker';
import { F } from './lib';

/* Filters are color layers drawn over the video when it plays, so they look the same in the app and on the website. */
export const FILTERS = {
  none: { name: 'Normal' },
  ember: { name: 'Ember', color: 'rgba(255,85,0,.22)' },
  frost: { name: 'Frost', color: 'rgba(80,170,255,.22)' },
  noir: { name: 'Noir', color: 'rgba(0,0,0,.38)' },
  sunset: { name: 'Sunset', grad: ['rgba(255,94,98,.32)', 'rgba(255,179,71,.18)'] },
  neon: { name: 'Neon', color: 'rgba(255,43,214,.2)' },
  vintage: { name: 'Vintage', color: 'rgba(112,66,20,.28)' },
  heat: { name: 'Heat map', grad: ['rgba(255,45,0,.35)', 'rgba(255,210,122,.05)', 'rgba(255,45,0,.3)'] },
};
export const TEXT_COLORS = ['#ffffff', '#0a0a0a', '#ff5500', '#ffd60a', '#ff2d55', '#4fd2ff', '#7dffa1', '#b26bff', '#ff8fd0'];
export const TEXT_STYLES = ['plain', 'box', 'soft'];
const BASE = 0.075; // text size as a share of the video's width, so it looks the same at any size
const isLight = (c) => { const h = (c || '#fff').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150; };
// texts on a Replay: [{ t, x, y (centre, 0..1 of the frame), s (scale), r (degrees), c (colour), st (plain | box | soft) }]
export function normTexts(o) {
  if (!o) return [];
  if (Array.isArray(o.texts)) return o.texts.filter((x) => x && x.t);
  if (o.text) { const p = o.textPos || 'middle'; return [{ t: o.text, x: 0.5, y: p === 'top' ? 0.18 : p === 'bottom' ? 0.72 : 0.46, s: 1, r: 0, c: o.color || '#ffffff', st: 'plain' }]; }
  return [];
}
export function TextChip({ it, W }) {
  const fs = Math.max(5, W * BASE * (it.s || 1)); const c = it.c || '#ffffff'; const st = it.st || 'plain';
  const bg = st === 'box' ? c : st === 'soft' ? 'rgba(0,0,0,.5)' : 'transparent';
  const col = st === 'box' ? (isLight(c) ? '#0a0a0a' : '#ffffff') : c;
  return (
    <View style={{ maxWidth: W * 0.9, backgroundColor: bg, borderRadius: fs * 0.3, paddingHorizontal: st === 'plain' ? 0 : fs * 0.35, paddingVertical: st === 'plain' ? 0 : fs * 0.1 }}>
      <T d style={{ color: col, fontSize: fs, lineHeight: fs * 1.2, textAlign: 'center', letterSpacing: -fs * 0.03,
        textShadowColor: st !== 'plain' ? 'transparent' : col === '#0a0a0a' ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.55)', textShadowRadius: st === 'plain' ? fs * 0.25 : 0 }}>{it.t}</T>
    </View>
  );
}
// a box twice the frame's width centred on the text's point, so text can be centred and rotated without measuring it
const spot = (it, box) => ({ position: 'absolute', left: it.x * box.w - box.w, top: it.y * box.h - box.w, width: box.w * 2, height: box.w * 2, alignItems: 'center', justifyContent: 'center',
  transform: [{ rotate: (it.r || 0) + 'deg' }] });
const fillAbs = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
export function Tint({ filter }) {
  const f = FILTERS[filter] || FILTERS.none;
  return <>{f.color ? <View pointerEvents="none" style={[fillAbs, { backgroundColor: f.color }]} /> : null}
    {f.grad ? <LinearGradient pointerEvents="none" colors={f.grad} style={fillAbs} /> : null}</>;
}
export function ReplayOverlay({ overlay }) {
  const [box, setBox] = useState(null);
  if (!overlay) return null;
  const texts = normTexts(overlay);
  return (
    <View pointerEvents="none" style={[fillAbs, { overflow: 'hidden' }]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Tint filter={overlay.filter} />
      {box ? texts.map((it, i) => <View key={i} style={spot(it, box)}><TextChip it={it} W={box.w} /></View>) : null}
    </View>
  );
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtT = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60); const sec = t - m * 60; return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1); };

// text you can drag with one finger, pinch to resize and twist to rotate; tap it to edit
function DragText({ it, box, onChange, onEdit, onDrag, onDrop }) {
  const live = useRef(it); live.current = it; const k = useRef({});
  const cb = useRef({}); cb.current = { onChange, onEdit, onDrag, onDrop, box };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { const g = k.current; g.start = { ...live.current }; g.s = live.current.s || 1; g.r = live.current.r || 0; g.t0 = Date.now(); g.moved = false; g.pinch = null; },
    onPanResponderMove: (e, d) => {
      const g = k.current; const ts = e.nativeEvent.touches || []; const { box: b } = cb.current;
      if (Math.abs(d.dx) + Math.abs(d.dy) > 6) { if (!g.moved) cb.current.onDrag(true); g.moved = true; }
      if (ts.length >= 2) {
        const [p, q] = ts; const dist = Math.hypot(q.pageX - p.pageX, q.pageY - p.pageY) || 1; const ang = Math.atan2(q.pageY - p.pageY, q.pageX - p.pageX) * 180 / Math.PI;
        if (!g.pinch) g.pinch = { dist, ang, s: g.s, r: g.r };
        g.s = clamp(g.pinch.s * dist / g.pinch.dist, 0.35, 5); g.r = g.pinch.r + ang - g.pinch.ang;
        if (!g.moved) cb.current.onDrag(true); g.moved = true;
      } else g.pinch = null;
      let x = clamp(g.start.x + d.dx / b.w, 0.03, 0.97); const y = clamp(g.start.y + d.dy / b.h, 0.04, 0.96);
      if (Math.abs(x - 0.5) < 0.018) x = 0.5; // snap to the centre line
      let r = g.r; const rr = ((r % 90) + 90) % 90; if (rr < 3) r -= rr; else if (rr > 87) r += 90 - rr; // snap to straight
      cb.current.onChange({ ...live.current, x, y, s: g.s, r }, d.moveY);
    },
    onPanResponderRelease: (e, d) => { const g = k.current; if (!g.moved && Date.now() - g.t0 < 350) { cb.current.onEdit(); return; } cb.current.onDrop(d.moveY); },
    onPanResponderTerminate: (e, d) => cb.current.onDrop(-1),
  })).current;
  return <View pointerEvents="box-none" style={spot(it, box)}><View {...pan.panHandlers} hitSlop={10}><TextChip it={it} W={box.w} /></View></View>;
}

// TikTok-style trim bar: frames from the clip, drag either handle, white playhead
function Timeline({ dur, start, end, thumbs, onChange, onScrub, onScrubEnd, getTime }) {
  const [w, setW] = useState(0); const [now, setNow] = useState(start);
  useEffect(() => { const t = setInterval(() => { const v = getTime(); if (v != null) setNow(v); }, 90); return () => clearInterval(t); }, []);
  const cur = useRef({}); cur.current = { dur, start, end, w, onChange, onScrub, onScrubEnd };
  const mk = (which) => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { const c = cur.current; c.v0 = which === 's' ? c.start : c.end; },
    onPanResponderMove: (e, d) => {
      const c = cur.current; if (!c.w) return; const v = c.v0 + (d.dx / c.w) * c.dur;
      if (which === 's') { const ns = clamp(v, 0, c.end - 1); c.onChange(ns, c.end); c.onScrub(ns); }
      else { const ne = clamp(v, c.start + 1, c.dur); c.onChange(c.start, ne); c.onScrub(ne); }
    },
    onPanResponderRelease: () => cur.current.onScrubEnd(), onPanResponderTerminate: () => cur.current.onScrubEnd(),
  });
  const pans = useRef({ s: mk('s'), e: mk('e') }).current;
  const px = (t) => (dur ? (t / dur) * w : 0); const HW = 18, SH = 58;
  const handle = (which) => (
    <View {...pans[which].panHandlers} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      style={{ position: 'absolute', top: -3, height: SH + 6, width: HW, left: which === 's' ? px(start) - HW : px(end), backgroundColor: '#ff5500',
        borderTopLeftRadius: which === 's' ? 9 : 0, borderBottomLeftRadius: which === 's' ? 9 : 0, borderTopRightRadius: which === 'e' ? 9 : 0, borderBottomRightRadius: which === 'e' ? 9 : 0,
        alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: '#fff' }} />
    </View>);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T h style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>{fmtT(start)}</T>
        <View style={{ backgroundColor: 'rgba(255,85,0,.18)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 }}><T h style={{ color: '#ff8a2b', fontSize: 13 }}>{(end - start).toFixed(1)}s</T></View>
        <T h style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>{fmtT(end)}</T>
      </View>
      <View style={{ marginHorizontal: HW }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <View style={{ height: SH, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#1c1c1c' }}>
          {thumbs && thumbs.length ? thumbs.map((th, i) => <XImage key={i} source={th} style={{ flex: 1, height: SH }} contentFit="cover" />)
            : <LinearGradient colors={['#2a2a2a', '#3a2010', '#2a2a2a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />}
        </View>
        {w ? <>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, height: SH, left: 0, width: px(start), backgroundColor: 'rgba(0,0,0,.66)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, height: SH, left: px(end), right: 0, backgroundColor: 'rgba(0,0,0,.66)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: -3, height: SH + 6, left: px(start), width: Math.max(0, px(end) - px(start)), borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#ff5500' }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: -7, height: SH + 14, width: 3, borderRadius: 2, backgroundColor: '#fff', left: clamp(px(now), px(start), px(end)) - 1.5,
            shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } }} />
          {handle('s')}{handle('e')}
        </> : null}
      </View>
    </View>
  );
}

const SPEEDS = [0.5, 1, 1.5, 2];
// the editor: full-bleed preview, tool rail on the right, panels slide up from the bottom
function Editor({ clip, onRetake, onClose }) {
  const { C, s, run, nav } = useApp(); const ins = useSafeAreaInsets();
  const [box, setBox] = useState(null); const playerRef = useRef(null);
  const [filter, setFilter] = useState('none'); const [speed, setSpeed] = useState(1);
  const [texts, setTexts] = useState([]); const [typing, setTyping] = useState(null); // { i, t, c, st }
  const [dragging, setDragging] = useState(false); const [overTrash, setOverTrash] = useState(false); const [guide, setGuide] = useState(false);
  const [trim, setTrim] = useState({ s: 0, e: clip.dur }); const [tool, setTool] = useState(null); // filters | trim | speed
  const [caption, setCaption] = useState(''); const [busy, setBusy] = useState(false); const [thumbs, setThumbs] = useState(null);
  const [kb, setKb] = useState(0); const scrubbing = useRef(false);
  const SH = Dimensions.get('window').height; const trashY = SH - ins.bottom - 120;
  useEffect(() => { const a = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height)), b = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    const c = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates.height)), d = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => { a.remove(); b.remove(); c.remove(); d.remove(); }; }, []);
  useEffect(() => { let dead = false; const t = setTimeout(async () => {
    const pl = playerRef.current; if (!pl || !pl.generateThumbnailsAsync) return; const n = 10;
    try { const th = await pl.generateThumbnailsAsync(Array.from({ length: n }, (_, i) => ((i + 0.5) * clip.dur) / n), { maxWidth: 160 }); if (!dead) setThumbs(th); } catch (e) {}
  }, 700); return () => { dead = true; clearTimeout(t); }; }, [clip.uri]);
  const pl = () => playerRef.current;
  const seek = (t) => { try { const p = pl(); if (p) { p.pause(); p.currentTime = t; } } catch (e) {} };
  const resume = () => { try { const p = pl(); if (p) { p.currentTime = trim.s; p.play(); } } catch (e) {} };
  const openText = (i) => { const it = i == null ? { t: '', c: '#ffffff', st: 'plain' } : texts[i]; setTool(null); setTyping({ i, t: it.t, c: it.c, st: it.st || 'plain' }); };
  const doneText = () => {
    const tp = typing; setTyping(null); Keyboard.dismiss(); if (!tp) return; const t = tp.t.trim();
    if (tp.i == null) { if (t) setTexts([...texts, { t, x: 0.5, y: 0.42, s: 1, r: 0, c: tp.c, st: tp.st }]); return; }
    setTexts(t ? texts.map((x, j) => (j === tp.i ? { ...x, t, c: tp.c, st: tp.st } : x)) : texts.filter((_, j) => j !== tp.i));
  };
  async function post() {
    if (busy) return; setBusy(true);
    const overlay = { v: 2, filter, texts: texts.map((x) => ({ ...x, x: +x.x.toFixed(4), y: +x.y.toFixed(4), s: +x.s.toFixed(3), r: +(x.r || 0).toFixed(1) })), speed,
      trimStart: +trim.s.toFixed(1), trimEnd: +trim.e.toFixed(1), dur: +clip.dur.toFixed(1) };
    const isMov = /\.mov$/i.test(clip.uri);
    const asset = { uri: clip.uri, type: 'video', mimeType: clip.mimeType || (isMov ? 'video/quicktime' : 'video/mp4'), fileName: clip.fileName || (isMov ? 'replay.mov' : 'replay.mp4') };
    const ok = await run(() => act.post(s.me, { text: caption.trim(), asset, reel: true, overlay }), { toast: 'Replay posted' });
    setBusy(false); if (ok) { onClose(); nav.tab('replay'); }
  }
  const rail = ({ icon, label, onPress, on }) => (
    <Pressable key={label} onPress={onPress} accessibilityLabel={label} style={{ alignItems: 'center', gap: 3 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: on ? '#ff5500' : 'rgba(0,0,0,.38)', alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'Aa' ? <T d style={{ color: '#fff', fontSize: 17, letterSpacing: -1 }}>Aa</T> : <Ionicons name={icon} size={22} color="#fff" />}</View>
      <T h style={{ color: '#fff', fontSize: 11, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>{label}</T>
    </Pressable>);
  const panel = (title, children) => (
    <View style={{ backgroundColor: 'rgba(12,12,12,.94)', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 14, paddingHorizontal: 16, paddingBottom: ins.bottom + 14, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T d style={{ color: '#fff', fontSize: 16, flex: 1 }}>{title}</T>
        <Pressable onPress={() => { setTool(null); resume(); }} accessibilityLabel="Done" hitSlop={10} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#ff5500', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={20} color="#fff" /></Pressable>
      </View>
      {children}
    </View>);
  const tp = typing; const showChrome = !typing && !dragging;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flex: 1 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Video uri={clip.uri} style={{ flex: 1 }} controls={false} autoPlay loop trim={{ trimStart: trim.s, trimEnd: trim.e }} rate={speed} playerRef={playerRef} />
        <Tint filter={filter} />
        <Pressable style={fillAbs} onPress={() => { if (tool) { setTool(null); resume(); return; } try { const p = pl(); if (p) p.playing ? p.pause() : p.play(); } catch (e) {} }} accessibilityLabel="Play or pause" />
        {guide ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, marginLeft: -0.75, backgroundColor: '#ff8a2b' }} /> : null}
        {box ? texts.map((it, i) => typing && typing.i === i ? null : <DragText key={i} it={it} box={box}
          onChange={(n, y) => { setTexts((xs) => xs.map((x, j) => (j === i ? n : x))); setGuide(n.x === 0.5); setOverTrash(y > trashY); }}
          onEdit={() => openText(i)} onDrag={() => setDragging(true)}
          onDrop={(y) => { setDragging(false); setGuide(false); setOverTrash(false); if (y > trashY) setTexts((xs) => xs.filter((_, j) => j !== i)); }} />) : null}
      </View>

      {showChrome ? <View style={{ position: 'absolute', top: ins.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onRetake} accessibilityLabel="Retake" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" /><T h style={{ color: '#fff' }}>Retake</T></Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} accessibilityLabel="Discard" hitSlop={10}><Ionicons name="close" size={28} color="#fff" /></Pressable>
      </View> : null}

      {showChrome && !tool ? <View style={{ position: 'absolute', right: 12, top: ins.top + 64, gap: 16 }}>
        {rail({ icon: 'Aa', label: 'Text', onPress: () => openText(null) })}
        {rail({ icon: 'color-filter-outline', label: 'Filters', onPress: () => setTool('filters') })}
        {rail({ icon: 'cut-outline', label: 'Trim', onPress: () => setTool('trim') })}
        {rail({ icon: 'speedometer-outline', label: speed === 1 ? 'Speed' : speed + 'x', on: speed !== 1, onPress: () => setTool('speed') })}
      </View> : null}

      {dragging ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 30, alignItems: 'center' }}>
        <View style={{ width: overTrash ? 66 : 54, height: overTrash ? 66 : 54, borderRadius: 40, backgroundColor: overTrash ? '#ff2d55' : 'rgba(0,0,0,.5)', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trash-outline" size={overTrash ? 28 : 24} color="#fff" /></View></View> : null}

      {showChrome ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: tool ? 0 : kb || 0 }}>
        {tool === 'filters' ? panel('Filters', <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {Object.entries(FILTERS).map(([k, f]) => <Pressable key={k} onPress={() => setFilter(k)} accessibilityLabel={f.name} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 62, height: 80, borderRadius: 14, overflow: 'hidden', borderWidth: 2.5, borderColor: filter === k ? '#ff5500' : 'transparent', backgroundColor: '#222' }}>
                {thumbs && thumbs[4] ? <XImage source={thumbs[4]} style={fillAbs} contentFit="cover" /> : <LinearGradient colors={['#ff8a2b', '#401a08', '#0a0a0a']} style={fillAbs} />}
                <Tint filter={k} /></View>
              <T h style={{ color: filter === k ? '#fff' : 'rgba(255,255,255,.6)', fontSize: 12 }}>{f.name}</T></Pressable>)}
          </ScrollView></>) : null}
        {tool === 'trim' ? panel('Trim', <>
          <Timeline dur={clip.dur} start={trim.s} end={trim.e} thumbs={thumbs} onChange={(a, b) => setTrim({ s: a, e: b })}
            onScrub={(t) => { scrubbing.current = true; seek(t); }} onScrubEnd={() => { scrubbing.current = false; setTimeout(resume, 30); }}
            getTime={() => { try { return pl() ? pl().currentTime : null; } catch (e) { return null; } }} /></>) : null}
        {tool === 'speed' ? panel('Speed', <>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 10, padding: 4 }}>
            {SPEEDS.map((v) => <Pressable key={v} onPress={() => setSpeed(v)} accessibilityLabel={v + 'x speed'}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: speed === v ? '#fff' : 'transparent' }}>
              <T h style={{ color: speed === v ? '#000' : '#fff', fontSize: 14 }}>{v}x</T></Pressable>)}
          </View></>) : null}
        {!tool ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: kb ? 10 : ins.bottom + 12 }}>
          <TextInput value={caption} onChangeText={setCaption} placeholder="Caption… #hashtags" placeholderTextColor="rgba(255,255,255,.65)" maxLength={280}
            style={{ flex: 1, color: '#fff', fontFamily: F.body, fontSize: 16, backgroundColor: 'rgba(0,0,0,.38)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,.45)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }} />
          <Btn kind="orange" title={busy ? 'Posting…' : 'Post'} disabled={busy} onPress={post} />
        </View> : null}
      </View> : null}

      {tp ? <View style={[fillAbs, { backgroundColor: 'rgba(0,0,0,.55)' }]}>
        <View style={{ paddingTop: ins.top + 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => setTyping({ ...tp, st: TEXT_STYLES[(TEXT_STYLES.indexOf(tp.st) + 1) % TEXT_STYLES.length] })} accessibilityLabel="Text style"
            style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
              backgroundColor: tp.st === 'box' ? '#fff' : tp.st === 'soft' ? 'rgba(255,255,255,.3)' : 'transparent' }}>
            <T d style={{ color: tp.st === 'box' ? '#000' : '#fff', fontSize: 17, letterSpacing: -1 }}>A</T></Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={doneText} accessibilityLabel="Done" hitSlop={10} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#ff5500' }}>
            <T h style={{ color: '#fff', fontSize: 15 }}>Done</T></Pressable>
        </View>
        <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }} onPress={doneText}>
          {(() => { const W = box ? box.w : 390; const fs = W * BASE * 1.15; const st = tp.st; const bg = st === 'box' ? tp.c : st === 'soft' ? 'rgba(0,0,0,.5)' : 'transparent';
            const col = st === 'box' ? (isLight(tp.c) ? '#0a0a0a' : '#fff') : tp.c;
            return <TextInput value={tp.t} onChangeText={(t) => setTyping({ ...tp, t })} autoFocus multiline maxLength={120} placeholder="Type something" placeholderTextColor="rgba(255,255,255,.5)"
              style={{ fontFamily: F.display, fontSize: fs, lineHeight: fs * 1.2, color: col, textAlign: 'center', backgroundColor: bg, borderRadius: fs * 0.3, paddingHorizontal: fs * 0.35, paddingVertical: fs * 0.1, minWidth: 60, maxWidth: W * 0.9 }} />; })()}
        </Pressable>
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: (kb || ins.bottom) + 12 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
          {TEXT_COLORS.map((c) => <Pressable key={c} onPress={() => setTyping({ ...tp, c })} accessibilityLabel={'Text color ' + c}
            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: tp.c === c ? 3.5 : 2, borderColor: tp.c === c ? '#ff5500' : '#fff' }} />)}
        </ScrollView>
      </View> : null}
    </View>
  );
}

const MAX = 120; // longest Replay (2 min)
const LENGTHS = [[60, '60s'], [90, '90s'], [120, '2m']];
export function Recorder({ onClose, startMode = 'replay' }) {
  const { C, s, run, nav } = useApp(); const ins = useSafeAreaInsets();
  const [camPerm, askCam] = useCameraPermissions(); const [micPerm, askMic] = useMicrophonePermissions();
  const cam = useRef(null); const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState('back'); const [torch, setTorch] = useState(false); const [countdown, setCountdown] = useState(false);
  const [phase, setPhase] = useState('camera'); // camera | counting | recording | edit
  const [count, setCount] = useState(3); const [elapsed, setElapsed] = useState(0); const started = useRef(0); const tick = useRef(null);
  const [clip, setClip] = useState(null); const [filter, setFilter] = useState('none'); const [len, setLen] = useState(60); const lastTap = useRef(0);
  const prog = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState(startMode); const [shot, setShot] = useState('photo'); // story: photo | video
  const maxLen = mode === 'story' ? 15 : len;
  const camMode = mode === 'story' && shot === 'photo' ? 'picture' : 'video';
  async function fromGallery() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mode === 'story' ? ['images', 'videos'] : ['videos'], quality: 0.85, videoMaxDuration: mode === 'story' ? 15 : MAX,
      videoExportPreset: ImagePicker.VideoExportPreset ? ImagePicker.VideoExportPreset.H264_1280x720 : undefined });
    if (r.canceled || !r.assets || !r.assets[0]) return;
    const a = r.assets[0];
    if (mode === 'story') { onClose(); setTimeout(() => nav.sheet('storyDraft', { asset: a }), 200); return; }
    const dur = Math.max(1, Math.min(MAX, (a.duration || MAX * 1000) / 1000));
    if (a.fileSize && a.fileSize > 49 * 1024 * 1024) { nav.toast('That video is too big (50 MB max). Pick a shorter one.'); return; }
    setClip({ uri: a.uri, dur, mimeType: a.mimeType, fileName: a.fileName }); setPhase('edit');
  }
  async function snap() {
    if (!ready || !cam.current) return;
    try { const p = await cam.current.takePictureAsync({ quality: 0.85 }); onClose(); setTimeout(() => nav.sheet('storyDraft', { asset: { uri: p.uri, type: 'image', mimeType: 'image/jpeg', fileName: 'story.jpg' } }), 200); }
    catch (e) { nav.toast('Couldn’t take the photo. Try again.'); }
  }

  useEffect(() => () => clearInterval(tick.current), []);
  const permsOk = camPerm && camPerm.granted && micPerm && micPerm.granted;

  async function begin() {
    if (!ready || !cam.current) return;
    setPhase('recording'); started.current = Date.now(); setElapsed(0); prog.setValue(0);
    Animated.timing(prog, { toValue: 1, duration: maxLen * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    tick.current = setInterval(() => setElapsed((Date.now() - started.current) / 1000), 200);
    try {
      const v = await cam.current.recordAsync({ maxDuration: maxLen });
      clearInterval(tick.current); prog.stopAnimation();
      const dur = Math.max(1, Math.min(maxLen, (Date.now() - started.current) / 1000));
      if (v && v.uri && mode === 'story') { const mov = /\.mov$/i.test(v.uri); onClose(); setTimeout(() => nav.sheet('storyDraft', { asset: { uri: v.uri, type: 'video', mimeType: mov ? 'video/quicktime' : 'video/mp4', fileName: mov ? 'story.mov' : 'story.mp4' } }), 200); return; }
      if (v && v.uri) { setClip({ uri: v.uri, dur }); setPhase('edit'); } else setPhase('camera');
    } catch (e) { clearInterval(tick.current); setPhase('camera'); nav.toast('Recording stopped. Try again.'); }
  }
  function shutter() {
    if (phase === 'recording') { cam.current && cam.current.stopRecording(); return; }
    if (phase !== 'camera') return;
    if (camMode === 'picture') return snap();
    if (!countdown) return begin();
    setPhase('counting'); setCount(3); let n = 3;
    const t = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(t); begin(); } else setCount(n); }, 1000);
  }
  // double tap anywhere on the camera to flip it (before you record — the camera can't switch mid-take)
  const camTap = () => { const now = Date.now(); if (now - lastTap.current < 300) { lastTap.current = 0; if (phase !== 'recording') setFacing((f) => (f === 'back' ? 'front' : 'back')); } else lastTap.current = now; };

  if (!permsOk) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
          <Ionicons name="videocam" size={44} color="#fff" />
          <T d style={{ color: '#fff', fontSize: 20, textAlign: 'center' }}>Record a Replay</T>
          <T style={{ color: 'rgba(255,255,255,.75)', textAlign: 'center' }}>Temp needs your camera and microphone to record.</T>
          <Btn kind="orange" title="Allow camera and mic" onPress={async () => { await askCam(); await askMic(); }} />
          <Pressable onPress={onClose}><T h style={{ color: 'rgba(255,255,255,.7)' }}>Not now</T></Pressable>
        </View>
      </Modal>
    );
  }

  const Chip = ({ on, label, onPress }) => (
    <Pressable onPress={onPress} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: on ? '#fff' : 'rgba(255,255,255,.16)' }}>
      <T h style={{ color: on ? '#000' : '#fff', fontSize: 13 }}>{label}</T></Pressable>);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {phase !== 'edit' ? (
          <View style={{ flex: 1 }}>
            <CameraView ref={cam} style={{ flex: 1 }} mode={camMode} facing={facing} enableTorch={torch} videoQuality="720p" videoBitrate={2500000} onCameraReady={() => setReady(true)} />
            <Tint filter={filter} />
            <Pressable style={fillAbs} onPress={camTap} accessibilityLabel="Double tap to flip the camera" />
            <View style={{ position: 'absolute', top: ins.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}><Ionicons name="close" size={30} color="#fff" /></Pressable>
              <View style={{ flex: 1 }} />
              {phase === 'recording' ? <T h style={{ color: '#fff', fontSize: 15 }}>{elapsed.toFixed(0)}s / {maxLen}s</T> : <>
                <Pressable onPress={() => setTorch(!torch)} accessibilityLabel="Flash" style={{ padding: 6 }}><Ionicons name={torch ? 'flash' : 'flash-off'} size={24} color="#fff" /></Pressable>
                <Pressable onPress={() => setCountdown(!countdown)} accessibilityLabel="3 second countdown" style={{ padding: 6 }}><Ionicons name="timer-outline" size={24} color={countdown ? C.orange : '#fff'} /></Pressable>
                <Pressable onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} accessibilityLabel="Flip camera" style={{ padding: 6 }}><Ionicons name="camera-reverse-outline" size={26} color="#fff" /></Pressable>
              </>}
            </View>
            {phase === 'counting' ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <T d style={{ color: '#fff', fontSize: 120 }}>{count}</T></View> : null}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 16, alignItems: 'center', gap: 16 }}>
              {phase === 'camera' && mode === 'replay' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
                {Object.entries(FILTERS).map(([k, f]) => <Chip key={k} on={filter === k} label={f.name} onPress={() => setFilter(k)} />)}</ScrollView> : null}
              {phase === 'camera' && mode === 'story' ? <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip on={shot === 'photo'} label="Photo" onPress={() => setShot('photo')} /><Chip on={shot === 'video'} label="Video" onPress={() => setShot('video')} /></View> : null}
              {phase === 'camera' && mode === 'replay' ? <View style={{ flexDirection: 'row', gap: 4, backgroundColor: 'rgba(0,0,0,.35)', borderRadius: 10, padding: 3 }}>
                {LENGTHS.map(([v, l]) => <Pressable key={v} onPress={() => setLen(v)} accessibilityLabel={'Record up to ' + l}
                  style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10, backgroundColor: len === v ? '#fff' : 'transparent' }}>
                  <T h style={{ color: len === v ? '#000' : '#fff', fontSize: 13 }}>{l}</T></Pressable>)}</View> : null}
              <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34 }}>
                <Pressable onPress={fromGallery} disabled={phase !== 'camera'} accessibilityLabel="Choose from your photos"
                  style={{ width: 46, height: 46, borderRadius: 12, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: phase === 'camera' ? 1 : 0 }}>
                  <Ionicons name="images-outline" size={22} color="#fff" /></Pressable>
                <Pressable onPress={shutter} accessibilityLabel={phase === 'recording' ? 'Stop recording' : camMode === 'picture' ? 'Take photo' : 'Record'} style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: phase === 'recording' ? 30 : 64, height: phase === 'recording' ? 30 : 64, borderRadius: phase === 'recording' ? 8 : 32, backgroundColor: camMode === 'picture' ? '#fff' : C.orange }} />
                </Pressable>
                <View style={{ width: 46 }} />
              </View>
              {phase === 'recording' ? <View style={{ width: '70%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
                <Animated.View style={{ height: 4, backgroundColor: C.orange, width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} /></View> : null}
              {phase === 'camera' ? <View style={{ flexDirection: 'row', gap: 22 }}>
                {[['story', 'STORY'], ['replay', 'REPLAY']].map(([k, l]) => <Pressable key={k} onPress={() => setMode(k)} hitSlop={8}>
                  <T h style={{ color: mode === k ? '#fff' : 'rgba(255,255,255,.55)', fontSize: 14, letterSpacing: 1 }}>{l}</T></Pressable>)}
              </View> : null}
              {!ready ? <ActivityIndicator color="#fff" /> : null}
            </View>
          </View>
        ) : (
          <Editor clip={clip} onRetake={() => { setClip(null); setPhase('camera'); }} onClose={onClose} />
        )}
      </View>
    </Modal>
  );
}
