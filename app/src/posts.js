import React, { useState, useRef } from 'react';
import { View, Pressable, Image, TextInput, Animated, Easing, Alert, FlatList, Modal, Dimensions, PanResponder, LayoutAnimation, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AshBurn } from './ash';
import { clock, jsClock, useClockKick } from './fx';
import { useApp, T, Avatar, Timer, Sticker, StickerPicker, Sheet, Btn, Empty, stickerLabel, DieIcon, FreezeIcon } from './ui';
import { ago, kfmt, F } from './lib';
import { act } from './data';
import { GifPicker } from './gif';
import { useSoundTrack } from './sounds';
import Svg, { Path } from 'react-native-svg';

// playback speed a Replay was posted at, so the hold-for-2x gesture can return to it
export const baseRate = new WeakMap();
export function Video({ uri, style, autoPlay, controls = true, loop = false, muted = false, onEnd, playerRef, trim, rate, sound }) {
  const t0 = (trim && trim.trimStart) || 0, t1 = trim && trim.trimEnd;
  const player = useVideoPlayer(uri, (p) => { p.loop = loop && !t1; p.muted = muted; if (t0) p.currentTime = t0; if (autoPlay) p.play(); });
  // Trimmed Replays: start at trimStart, stop (or loop back) at trimEnd.
  React.useEffect(() => {
    if (!t1 && !t0) return;
    try { player.timeUpdateEventInterval = 0.2; } catch (e) {}
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (t1 && currentTime >= t1) { if (loop) { player.currentTime = t0; } else { player.pause(); onEnd && onEnd(); } }
      else if (currentTime < t0 - 0.3) player.currentTime = t0;
    });
    return () => sub.remove();
  }, [player, t0, t1, loop]);
  if (playerRef) playerRef.current = player;
  useSoundTrack(player, sound);
  React.useEffect(() => { const r = rate || 1; baseRate.set(player, r); try { player.playbackRate = r; } catch (e) {} }, [player, rate]);
  React.useEffect(() => {
    if (!onEnd) return;
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);
  return <VideoView allowsVideoFrameAnalysis={false} allowsPictureInPicture={false} player={player} style={style} contentFit="cover" nativeControls={controls} pointerEvents={controls ? 'auto' : 'none'} />;
}

export function RichText({ text, style, onTag }) {
  const { C } = useApp();
  const parts = String(text || '').split(/(#[\w]+|@[\w.]+)/g);
  return <T style={style}>{parts.map((t, i) => /^[#@]/.test(t)
    ? <T key={i} b style={[style, { color: C.orange, fontFamily: F.bold }]} onPress={() => onTag && onTag(t)}>{t}</T> : t)}</T>;
}

// Video gestures shared by Replays and the full-screen player:
// double tap left = back 5s, right = forward 5s (keep tapping to skip more), middle = onCenterDouble;
// press and hold = 2x speed until you let go; one tap = onSingle.
export function useVideoTaps(getPlayer, { onSingle, onCenterDouble } = {}) {
  const [w, setW] = useState(1); const [fast, setFast] = useState(false); const [flash, setFlash] = useState(null);
  const r = useRef({ last: 0, timer: null, seekUntil: 0, side: null, total: 0, flashT: null });
  const seek = (side) => {
    const pl = getPlayer(); if (!pl) return; const d = side === 'L' ? -5 : 5;
    try { const dur = pl.duration || 0; pl.currentTime = Math.max(0, Math.min(dur ? dur - 0.2 : 1e9, (pl.currentTime || 0) + d)); } catch (e) {}
    const k = r.current; k.total = k.side === side && Date.now() < k.seekUntil ? k.total + 5 : 5; k.side = side; k.seekUntil = Date.now() + 650;
    setFlash({ side, n: k.total, id: Date.now() }); clearTimeout(k.flashT); k.flashT = setTimeout(() => setFlash(null), 650);
  };
  const onPress = (e) => {
    const x = e.nativeEvent.locationX; const zone = x < w * 0.33 ? 'L' : x > w * 0.67 ? 'R' : 'C'; const k = r.current; const now = Date.now();
    if (zone !== 'C' && zone === k.side && now < k.seekUntil) { clearTimeout(k.timer); k.last = 0; return seek(zone); } // still skipping
    if (now - k.last < 280) { clearTimeout(k.timer); k.last = 0; if (zone === 'C') onCenterDouble && onCenterDouble(); else seek(zone); return; }
    k.last = now; clearTimeout(k.timer); k.timer = setTimeout(() => onSingle && onSingle(), 280);
  };
  const onLongPress = () => { const pl = getPlayer(); if (!pl) return; try { pl.playbackRate = 2; pl.play(); } catch (e) {} setFast(true); };
  const onPressOut = () => { if (!fast) return; const pl = getPlayer(); try { pl && (pl.playbackRate = baseRate.get(pl) || 1); } catch (e) {} setFast(false); };
  const press = { onPress, onLongPress, delayLongPress: 350, onPressOut, onLayout: (e) => setW(e.nativeEvent.layout.width || 1) };
  const pill = { backgroundColor: 'rgba(0,0,0,.55)', borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6 };
  const Overlay = ({ top = 70 }) => <>
    {fast ? <View pointerEvents="none" style={[pill, { position: 'absolute', top, alignSelf: 'center' }]}><T h style={{ color: '#fff', fontSize: 13 }}>2x</T><Ionicons name="play-forward" size={14} color="#fff" /></View> : null}
    {flash ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, [flash.side === 'L' ? 'left' : 'right']: 0, width: '33%', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,.08)', borderTopRightRadius: flash.side === 'L' ? 999 : 0, borderBottomRightRadius: flash.side === 'L' ? 999 : 0, borderTopLeftRadius: flash.side === 'R' ? 999 : 0, borderBottomLeftRadius: flash.side === 'R' ? 999 : 0 }}>
      <View style={pill}><Ionicons name={flash.side === 'L' ? 'play-back' : 'play-forward'} size={15} color="#fff" /><T h style={{ color: '#fff', fontSize: 13 }}>{(flash.side === 'L' ? '-' : '+') + flash.n + 's'}</T></View></View> : null}
  </>;
  return { press, Overlay, fast };
}

// Feed video, Twitter-style: landscape 16:9 frame, plays muted on its own while on screen, loops, no system controls.
// Tap opens it full screen; double tap still heats the post.
function fmt(t) { t = Math.max(0, Math.round(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
export function FeedVideo({ uri, active = false, onHeat, postId }) {
  const [muted, setMuted] = useState(true); const [paused, setPaused] = useState(false); const [left, setLeft] = useState(null); const [ar, setAr] = useState(16 / 9);
  const [full, setFull] = useState(null); const taps = useRef({ t: 0, timer: null });
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  React.useEffect(() => {
    try { player.timeUpdateEventInterval = 0.5; } catch (e) {}
    const a = player.addListener('timeUpdate', ({ currentTime }) => { const d = player.duration; if (d) setLeft(d - currentTime); });
    const b = player.addListener('sourceLoad', (ev) => { const t = ev && ev.availableVideoTracks && ev.availableVideoTracks[0]; const sz = t && t.size; if (sz && sz.width && sz.height) setAr(sz.width / sz.height); });
    return () => { a.remove(); b.remove(); };
  }, [player]);
  React.useEffect(() => { try { if (active && !paused && !full) player.play(); else player.pause(); } catch (e) {} }, [active, paused, full, player]);
  React.useEffect(() => { try { player.muted = muted; } catch (e) {} }, [muted, player]);
  const tap = () => {
    const now = Date.now(); clearTimeout(taps.current.timer);
    if (now - taps.current.t < 280) { taps.current.t = 0; onHeat && onHeat(); return; }
    taps.current.t = now;
    taps.current.timer = setTimeout(() => { let at = 0; try { at = player.currentTime || 0; } catch (e) {} setFull({ at }); }, 280);
  };
  const chip = { backgroundColor: 'rgba(0,0,0,.6)', borderRadius: 15, alignItems: 'center', justifyContent: 'center' };
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
      <Pressable onPress={tap} style={{ flex: 1 }} accessibilityLabel="Open video full screen">
        <VideoView allowsVideoFrameAnalysis={false} allowsPictureInPicture={false} player={player} style={{ flex: 1 }} contentFit="contain" nativeControls={false} pointerEvents="none" />
      </Pressable>
      {left != null ? <View pointerEvents="none" style={[chip, { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 8, paddingVertical: 3 }]}>
        <T h style={{ color: '#fff', fontSize: 11.5, fontVariant: ['tabular-nums'] }}>{fmt(left)}</T></View> : null}
      <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 6 }}>
        <Pressable onPress={() => setPaused(!paused)} hitSlop={8} accessibilityLabel={paused ? 'Play' : 'Pause'} style={[chip, { width: 30, height: 30 }]}>
          <Ionicons name={paused ? 'play' : 'pause'} size={14} color="#fff" /></Pressable>
        <Pressable onPress={() => setMuted(!muted)} hitSlop={8} accessibilityLabel={muted ? 'Turn sound on' : 'Mute'} style={[chip, { width: 30, height: 30 }]}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={15} color="#fff" /></Pressable>
      </View>
      {paused ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[chip, { width: 58, height: 58 }]}><Ionicons name="play" size={26} color="#fff" /></View></View> : null}
      {full ? <FullVideo postId={postId} uri={uri} start={full.at} onClose={(at) => { setFull(null); try { if (at != null) player.currentTime = at; } catch (e) {} }} /> : null}
    </View>
  );
}

// Full-screen player: sound on, starts upright; the button turns it sideways (landscape) or back.
// Drag up: caption + comment box. Drag up again: comments while it keeps playing. Drag down: back / close.
function FullVideo({ postId, uri, start, onClose }) {
  const { s, C, run } = useApp(); const p = s.posts.find((x) => x.id === postId) || {};
  const ins = useSafeAreaInsets(); const { width: W, height: H } = Dimensions.get('window');
  const [landPick, setLand] = useState(false); const [ui, setUi] = useState(true); const [paused, setPaused] = useState(false); const [muted, setMuted] = useState(false);
  const [t, setT] = useState(start || 0); const [dur, setDur] = useState(0); const [barW, setBarW] = useState(1);
  const [panel, setPanel] = useState(0); const [text, setText] = useState(''); const [kb, setKb] = useState(0);
  const drag = useRef(new Animated.Value(0)).current;
  const player = useVideoPlayer(uri, (pl) => { pl.loop = true; pl.muted = false; if (start) pl.currentTime = start; pl.play(); });
  React.useEffect(() => {
    try { player.timeUpdateEventInterval = 0.25; } catch (e) {}
    const a = player.addListener('timeUpdate', ({ currentTime }) => { setT(currentTime); if (player.duration) setDur(player.duration); });
    return () => a.remove();
  }, [player]);
  React.useEffect(() => { try { paused ? player.pause() : player.play(); } catch (e) {} }, [paused, player]);
  React.useEffect(() => { try { player.muted = muted; } catch (e) {} }, [muted, player]);
  React.useEffect(() => { if (!ui || paused || panel) return; const k = setTimeout(() => setUi(false), 2800); return () => clearTimeout(k); }, [ui, paused, panel, t > 0]);
  React.useEffect(() => { const a = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height)), b = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => { a.remove(); b.remove(); }; }, []);
  const close = () => { let at = null; try { at = player.currentTime; } catch (e) {} onClose(at); };
  const land = landPick && !panel; // the panel always shows the video upright above it
  const panelH = panel === 2 ? Math.round(H * 0.62) : panel === 1 ? 170 + ins.bottom : 0;
  const vidH = H - panelH;
  const setP = (n) => { LayoutAnimation.configureNext(LayoutAnimation.create(240, 'easeInEaseOut', 'opacity')); if (n === 0) Keyboard.dismiss(); setPanel(n); };
  const st = useRef({}); st.current = { panel, panelH, setP, close, kb };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, d) => {
      const k = st.current; const inPanel = d.y0 > H - k.panelH - k.kb; const onHandle = inPanel && d.y0 < H - k.panelH - k.kb + 44;
      return (!inPanel || onHandle) && Math.abs(d.dy) > 12 && Math.abs(d.dy) > Math.abs(d.dx) * 1.5;
    },
    onPanResponderMove: (e, d) => { if (st.current.panel === 0 && d.dy > 0) drag.setValue(d.dy); },
    onPanResponderRelease: (e, d) => {
      const k = st.current;
      if (d.dy < -50) { k.setP(d.dy < -260 ? 2 : Math.min(2, k.panel + 1)); return; }
      if (d.dy > 60) {
        if (k.panel > 0) { k.setP(d.dy > 260 ? 0 : k.panel - 1); return; }
        Animated.timing(drag, { toValue: H, duration: 180, useNativeDriver: true }).start(() => k.close()); return;
      }
      Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  const g = useVideoTaps(() => player, { onSingle: () => (panel ? setP(0) : setUi((v) => !v)), onCenterDouble: () => setPaused((v) => !v) });
  const bw = land ? vidH : W, bh = land ? W : vidH;
  const pad = land ? { top: 14, side: Math.max(ins.top, 20), bottom: 14 } : { top: ins.top + 6, side: 14, bottom: panel ? 10 : ins.bottom + 10 };
  const btn = { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' };
  const seek = (x) => { if (!dur) return; const to = Math.max(0, Math.min(dur, (x / barW) * dur)); try { player.currentTime = to; } catch (e) {} setT(to); };
  const u = s.users[p.userId] || {}; const frozen = p.status === 'frozen';
  const comments = (p.comments || []).filter((c) => !s.blocked[c.userId]);
  const send = () => { const v = text.trim(); if (!v || !p.id) return; setText(''); if (panel < 2) setP(2); run(() => act.comment(p.id, v)); };
  return (
    <Modal visible animationType="fade" onRequestClose={close} supportedOrientations={['portrait']}>
      <Animated.View {...pan.panHandlers} style={{ flex: 1, backgroundColor: '#000', opacity: drag.interpolate({ inputRange: [0, 500], outputRange: [1, 0.4], extrapolate: 'clamp' }) }}>
        <Animated.View style={{ position: 'absolute', width: bw, height: bh, left: (W - bw) / 2, top: (vidH - bh) / 2, transform: [{ translateY: drag }, { rotate: land ? '90deg' : '0deg' }] }}>
          <Pressable {...g.press} style={{ flex: 1 }} accessibilityLabel={ui ? 'Hide controls' : 'Show controls'}>
            <VideoView allowsVideoFrameAnalysis={false} allowsPictureInPicture={false} player={player} style={{ flex: 1 }} contentFit="contain" nativeControls={false} pointerEvents="none" />
          </Pressable>
          <g.Overlay top={pad.top + 6} />
          {ui || panel ? <>
            <View style={{ position: 'absolute', top: pad.top, left: pad.side, right: pad.side, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pressable onPress={close} style={btn} accessibilityLabel="Close"><Ionicons name="close" size={24} color="#fff" /></Pressable>
              {!panel ? <Pressable onPress={() => setLand(!landPick)} style={btn} accessibilityLabel={land ? 'Turn upright' : 'Turn sideways'}>
                <Ionicons name="phone-landscape-outline" size={20} color="#fff" style={{ transform: [{ rotate: land ? '90deg' : '0deg' }] }} /></Pressable> : null}
            </View>
            {!panel ? <Pressable onPress={() => setPaused(!paused)} style={{ position: 'absolute', alignSelf: 'center', top: bh / 2 - 34, width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={paused ? 'Play' : 'Pause'}>
              <Ionicons name={paused ? 'play' : 'pause'} size={32} color="#fff" /></Pressable> : null}
            {!panel && (p.text || u.handle) ? <View pointerEvents="none" style={{ position: 'absolute', left: pad.side, right: pad.side + 40, bottom: pad.bottom + 30 }}>
              <T h style={{ color: '#fff', fontSize: 13.5, textShadowColor: 'rgba(0,0,0,.7)', textShadowRadius: 6 }}>@{u.handle}</T>
              {p.text ? <T numberOfLines={3} style={{ color: '#fff', fontSize: 14.5, marginTop: 2, textShadowColor: 'rgba(0,0,0,.7)', textShadowRadius: 6 }}>{p.text}</T> : null}
            </View> : null}
            <View style={{ position: 'absolute', left: pad.side, right: pad.side, bottom: pad.bottom, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {panel ? <Pressable onPress={() => setPaused(!paused)} hitSlop={8} accessibilityLabel={paused ? 'Play' : 'Pause'}><Ionicons name={paused ? 'play' : 'pause'} size={20} color="#fff" /></Pressable> : null}
              <T h style={{ color: '#fff', fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{fmt(t)}</T>
              <Pressable onLayout={(e) => setBarW(e.nativeEvent.layout.width || 1)} onPress={(e) => seek(e.nativeEvent.locationX)} hitSlop={14} style={{ flex: 1, height: 18, justifyContent: 'center' }} accessibilityLabel="Seek">
                <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.3)' }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: '#ff5500', width: (dur ? Math.min(1, t / dur) : 0) * 100 + '%' }} /></View>
                <View style={{ position: 'absolute', left: (dur ? Math.min(1, t / dur) : 0) * barW - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' }} />
              </Pressable>
              <T h style={{ color: 'rgba(255,255,255,.75)', fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{fmt(dur)}</T>
              <Pressable onPress={() => setMuted(!muted)} hitSlop={8} accessibilityLabel={muted ? 'Turn sound on' : 'Mute'}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" /></Pressable>
            </View>
          </> : null}
        </Animated.View>
        {!panel && ui ? <View pointerEvents="none" style={{ position: 'absolute', bottom: ins.bottom + 2, alignSelf: 'center', alignItems: 'center' }}>
          <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,.6)" /></View> : null}
        {panel ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: kb, height: panelH, backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: kb ? 8 : ins.bottom + 8 }}>
          <Pressable onPress={() => setP(panel === 2 ? 1 : 2)} style={{ alignItems: 'center', paddingVertical: 10 }} accessibilityLabel={panel === 2 ? 'Show less' : 'Show comments'}>
            <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#333' }} /></Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar u={u} size={32} />
            <View style={{ flex: 1 }}><T h numberOfLines={1} style={{ color: '#fff' }}>{u.name || u.handle}</T>
              {p.text ? <T numberOfLines={panel === 2 ? 4 : 2} style={{ color: 'rgba(255,255,255,.85)', fontSize: 14 }}>{p.text}</T> : null}</View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="flame" size={16} color="#ff5500" /><T h style={{ color: '#fff', fontSize: 13 }}>{kfmt(p.heat)}</T></View>
            <Pressable onPress={() => setP(2)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel="Comments"><Ionicons name="chatbubble-outline" size={16} color="#fff" /><T h style={{ color: '#fff', fontSize: 13 }}>{comments.length}</T></Pressable>
          </View>
          {panel === 2 ? <T h style={{ color: '#8d8883', fontSize: 12, letterSpacing: 0.6, marginTop: 14 }}>COMMENTS</T> : null}
          {panel === 2 ? <FlatList data={comments} keyExtractor={(c) => String(c.id)} style={{ flex: 1, marginTop: 6 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<T b style={{ color: '#8d8883', textAlign: 'center', marginTop: 20 }}>{frozen ? 'Comments are off while frozen' : 'No comments yet'}</T>}
            renderItem={({ item: c }) => { const cu = s.users[c.userId] || {}; return <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}><Avatar u={cu} size={26} />
              <View style={{ flex: 1 }}><T h style={{ color: '#fff', fontSize: 13 }}>{cu.handle} <T style={{ color: '#8d8883', fontSize: 12 }}>{ago(Date.now() - c.at)}</T></T>
                {c.sticker ? <Sticker v={c.sticker} size={40} /> : <T style={{ color: '#fff', fontSize: 14 }}>{c.text}</T>}</View></View>; }} /> : <View style={{ flex: 1 }} />}
          {!frozen ? <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1c1c', borderRadius: 15, paddingLeft: 14, padding: 4, marginTop: 8 }}>
            <TextInput value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor="#8d8883" maxLength={280} onSubmitEditing={send} returnKeyType="send"
              style={{ flex: 1, color: '#fff', fontFamily: F.body, fontSize: 16, paddingVertical: 8 }} />
            {text.trim() ? <Pressable onPress={send} accessibilityLabel="Post comment" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#ff5500', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="paper-plane" size={15} color="#fff" /></Pressable> : null}
          </View> : null}
        </View> : null}
      </Animated.View>
    </Modal>
  );
}

// Reflame icon: a flame with two turning arrows (same idea as the website's)
// a flame drawn as two chasing repost arrows (same artwork as the website)
export function ReflameIcon({ size = 20, color, w = 1.9 }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9.5 20.4C7.2 19.5 5.6 17.4 5.6 14.9c0-2.4 1.3-3.9 2.5-5.3" /><Path d="M5.7 10.4l2.4-.9.6 2.5" />
    <Path d="M10.2 7.2c.9-1.4 1.3-2.8 1.3-4.4 2.9 2 6.9 5.7 6.9 11.4 0 3.4-2.4 6-5.8 6.4" /><Path d="M15 18.8l-2.4 1.8 2.1 1.9" /></Svg>;
}
// a quoted take inside a quote (tap to open it)
export function QuoteCard({ id }) {
  const { s, C, nav } = useApp(); const q = s.posts.find((x) => x.id === id);
  if (!q || q.status === 'gone') return null; // burned takes leave no trace
  const u = s.users[q.userId] || {};
  return <Pressable onPress={() => (q.reel ? nav.tab('replay', { startId: q.id }) : nav.push('post', { id: q.id }))} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginTop: 10, gap: 6, backgroundColor: C.bg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Avatar u={{ ...u, ring: null }} size={20} /><T h numberOfLines={1} style={{ fontSize: 14 }}>{u.name}</T><T muted numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>@{u.handle} · {ago(Date.now() - q.createdAt)}</T></View>
    {q.text ? <T numberOfLines={4} style={{ fontSize: 15, lineHeight: 20 }}>{q.text}</T> : null}
    {q.mediaUrl && q.mediaType !== 'video' ? <Image source={{ uri: q.mediaUrl }} style={{ width: '100%', height: 180, borderRadius: 12 }} resizeMode="cover" /> : null}
    {q.reel || q.mediaType === 'video' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="play" size={14} color={C.muted} /><T b muted style={{ fontSize: 13 }}>Video</T></View> : null}
  </Pressable>;
}
// Reflame: keep a take alive past its timer, or quote it with your own words
export function ReflameSheet({ post, onClose }) {
  const { s, C, run, nav } = useApp(); const p = s.posts.find((x) => x.id === post.id) || post; const mine = p.userId === s.me;
  const Opt = ({ icon, title, sub, onPress }) => <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
    <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
    <View style={{ flex: 1 }}><T h style={{ fontSize: 17 }}>{title}</T><T muted style={{ fontSize: 14, lineHeight: 19 }}>{sub}</T></View></Pressable>;
  return <Sheet visible onClose={onClose}>
    {!mine ? <Opt icon={<ReflameIcon size={24} color={C.ink} />} title={p.myRepost ? 'Undo reflame' : 'Reflame'} sub={p.myRepost ? 'Take it off your profile.' : 'Share it to your profile and keep it alive past its timer.'}
      onPress={() => { onClose(); run(() => act.repost(p.id, p.myRepost, s.me), { toast: p.myRepost ? 'Reflame removed' : 'Reflamed. It lives on past its timer', optimistic: { post: p.id, patch: { myRepost: !p.myRepost, kept: p.kept || !p.myRepost, reposts: Math.max(0, (p.reposts || 0) + (p.myRepost ? -1 : 1)) } } }); }} /> : null}
    <Opt icon={<Ionicons name="chatbubble-outline" size={22} color={C.ink} />} title="Quote" sub="Add your own take on top. The original lives on too." onPress={() => { onClose(); setTimeout(() => nav.sheet('compose', { quoteOf: p.id }), 250); }} />
  </Sheet>;
}
export function PostCard({ p, active = false }) {
  const { s, C, run, nav, ashing, finishAsh } = useApp();
  const u = s.users[p.userId]; const frozen = p.status === 'frozen';
  const [burst] = useState(() => new Animated.Value(0)); const lastTap = useRef(0);
  const cs = p.comments.filter((c) => !s.blocked[c.userId]);
  const top = cs.length ? [...cs].sort((a, b) => b.likes - a.likes)[0] : null;
  const heat = () => { if (!p.myHeat) run(() => act.react(p.id, 'heat'), { optimistic: { post: p.id, patch: { myHeat: true, heat: p.heat + 1 } } }); };
  const heatBurst = () => { heat(); burst.setValue(0); Animated.sequence([Animated.spring(burst, { toValue: 1, useNativeDriver: true }), Animated.timing(burst, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true })]).start(); };
  const dbl = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) heatBurst();
    lastTap.current = now;
  };
  if (!u) return null;
  const rf = p.kept && (p.reposts > 0 || p.quoteOf);
  return (
    <View style={rf ? { marginTop: 8, marginBottom: 20 } : null}>
    {/* reflamed: a thick orb-shaped outline wraps the whole card with a little gap, slowly reshaping like the orbs */}
    {rf ? <OrbOutline color={C.orange} /> : null}
    <View style={{ backgroundColor: frozen ? C.soft : C.card, borderRadius: 26, padding: 14, marginBottom: rf ? 0 : 10, overflow: 'hidden', ...(rf ? { borderWidth: 2, borderColor: C.orange } : null) }}>
      {ashing === p.id ? <AshBurn onDone={() => finishAsh(p.id)} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => nav.push('profile', { id: u.id })} style={{ opacity: frozen ? 0.45 : 1 }}><Avatar u={u} size={40} /></Pressable>
        <Pressable onPress={() => nav.push('profile', { id: u.id })} style={{ flex: 1, minWidth: 0, opacity: frozen ? 0.45 : 1 }}>
          <T h numberOfLines={1}>{u.name}</T><T muted numberOfLines={1} style={{ fontSize: 13 }}>@{u.handle} · {ago(Date.now() - p.createdAt)}</T>
        </Pressable>
        <Timer p={p} />
        <Pressable onPress={() => nav.sheet('menu', { post: p })} hitSlop={10} accessibilityLabel="Post options" style={{ padding: 6 }}><Ionicons name="ellipsis-horizontal" size={20} color={C.muted} /></Pressable>
      </View>
      <View style={{ opacity: frozen ? 0.45 : 1 }}>
        {p.text ? <Pressable onPress={() => nav.push('post', { id: p.id })}><RichText text={p.text} onTag={(t) => nav.tab('search', { q: t })}
          style={!p.mediaUrl && !p.quoteOf && p.text.length < 90 ? { fontFamily: F.displayB, fontSize: 18, lineHeight: 24, marginTop: 12, letterSpacing: -0.5 } : { fontSize: 16.5, lineHeight: 23, marginTop: 12 }} /></Pressable> : null}
        {p.quoteOf ? <QuoteCard id={p.quoteOf} /> : null}
        {p.poll ? <PollBox p={p} /> : null}
        {p.mediaUrl ? (
          <Pressable onPress={dbl} style={{ marginTop: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: C.soft }}>
            {p.mediaType === 'video' ? <FeedVideo uri={p.mediaUrl} postId={p.id} active={active} onHeat={heatBurst} /> : <Image source={{ uri: p.mediaUrl }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />}
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
              <Ionicons name="flame" size={120} color={C.orange} /></Animated.View>
          </Pressable>) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, zIndex: 5 }}>
        <ReactPick p={p} onPick={(k) => (k === 'heat' ? heat() : run(() => act.react(p.id, 'freeze'), { optimistic: { post: p.id, patch: { myFreeze: true, freeze: p.freeze + 1 } } }))} />
        <Pressable disabled={frozen} onPress={() => nav.sheet('comments', { id: p.id })} accessibilityLabel={frozen ? 'Comments are off while frozen' : 'Comments'} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, marginLeft: 8, opacity: frozen ? 0.3 : 1 }}>
          <Ionicons name="chatbubble-outline" size={21} color={C.ink} />{cs.length ? <T muted b>{cs.length}</T> : null}</Pressable>
        <Pressable onPress={() => nav.sheet('share', { post: p })} accessibilityLabel="Send" style={{ padding: 6 }}><Ionicons name="paper-plane-outline" size={21} color={C.ink} /></Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => nav.sheet('reflame', { post: p })} accessibilityLabel={p.myRepost ? 'Undo reflame' : 'Reflame'} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}>
          <ReflameIcon size={23} color={p.myRepost ? C.orange : C.ink} />{p.reposts ? <T muted b>{p.reposts}</T> : null}</Pressable>
        <Pressable onPress={() => run(() => act.save(p.id, p.saved, s.me), { optimistic: { post: p.id, patch: { saved: !p.saved } } })} accessibilityLabel="Save" style={{ padding: 6 }}>
          <Ionicons name={p.saved ? 'bookmark' : 'bookmark-outline'} size={20} color={p.saved ? C.orange : C.ink} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 2 }} accessibilityLabel={kfmt(p.views) + ' views'}>
          <Ionicons name="stats-chart" size={14} color={C.muted} /><T b muted style={{ fontSize: 13 }}>{kfmt(p.views)}</T></View>
      </View>
      {top && !frozen ? <Pressable onPress={() => nav.sheet('comments', { id: p.id })}><T muted numberOfLines={2} style={{ fontSize: 14, marginTop: 10 }}>
        <T b style={{ fontSize: 14 }}>{(s.users[top.userId] || {}).handle} </T>{top.sticker ? stickerLabel(top.sticker) : top.text}{cs.length > 1 ? ' · View all ' + cs.length : ''}</T></Pressable> : null}
      {p.status === 'burning' && !p.kept ? <BurnBar p={p} /> : null}
    </View>
    </View>
  );
}
// heat countdown: the orange line shrinks toward its end with a small time pill riding on the tip
// reflamed cards: a thick outline with the orbs' uneven, rounded-but-angular corners
function OrbOutline({ color }) {
  useClockKick();
  const r = jsClock(9000), c = clock(9000);
  const corner = (ph) => r.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 1, 2, 3, 4].map((i) => 40 + 14 * Math.sin((i / 4 + ph) * Math.PI * 2)) });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -9, top: -9, right: -9, bottom: -9,
    transform: [{ rotate: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-0.6deg', '0.6deg', '-0.6deg'] }) }] }}>
    <Animated.View style={{ flex: 1, borderWidth: 3.5, borderColor: color, borderTopLeftRadius: corner(0), borderTopRightRadius: corner(0.27), borderBottomRightRadius: corner(0.55), borderBottomLeftRadius: corner(0.8) }} />
  </Animated.View>;
}
// time-left orb: a soft, lumpy orange orb that ticks round once every real second while the time stays upright
// time-left orb: moves like the Morph ring — a liquid orange orb that wobbles and reshapes, the time stays put
function TimeOrb({ label }) {
  const { C } = useApp(); useClockKick(); const S = 35; const c = clock(5600), r = jsClock(9000); // slow, calm motion
  const corner = (ph) => r.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 1, 2, 3, 4].map((i) => S * (0.5 + 0.13 * Math.sin((i / 4 + ph) * Math.PI * 2))) });
  const radii = { borderTopLeftRadius: corner(0), borderTopRightRadius: corner(0.27), borderBottomRightRadius: corner(0.55), borderBottomLeftRadius: corner(0.8) };
  return (
    <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: S, height: S, transform: [
        { scaleX: c.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 1.06, 0.97, 1.03, 1] }) },
        { scaleY: c.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.95, 1.05, 0.98, 1] }) },
        { rotate: clock(14000).interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Animated.View style={[{ flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: C.mono ? C.orange : '#ff5500' }, radii]}>
        </Animated.View>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <Ionicons name="flame" size={7} color={C.mono ? C.onOrange : '#fff'} /><T d style={{ color: C.mono ? C.onOrange : '#fff', fontSize: 8.5, letterSpacing: -0.4, textShadowColor: 'transparent' }}>{label}</T></View>
    </View>
  );
}
function BurnBar({ p }) {
  const { C } = useApp(); const [, f] = useState(0);
  React.useEffect(() => { const t = setInterval(() => f((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  const left = Math.max(0, p.burnEnds - Date.now()); const pct = Math.max(0.001, Math.min(1, left / 864e5));
  const h = Math.floor(left / 3600e3);
  const label = h ? h + 'h' : '<1h';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }} accessibilityLabel={'Heated, ' + label + ' left'}>
      {/* greyed-out trail: the full 24h path the orb has already travelled, with a faint imprint where it started */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: C.line }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, width: 32, height: 32, backgroundColor: C.line, borderTopLeftRadius: 17, borderTopRightRadius: 14, borderBottomRightRadius: 18, borderBottomLeftRadius: 13 }} />
      <View style={{ flex: pct, height: 3, borderRadius: 2, backgroundColor: C.orange, marginRight: -2 }} />
      <TimeOrb label={label} />
      <View style={{ flex: 1 - pct }} />
    </View>
  );
}

/* ---------- sheets ---------- */
export function CommentsSheet({ id, onClose }) {
  const { s, C, run, nav } = useApp();
  const p = s.posts.find((x) => x.id === id);
  const [t, setT] = useState(''); const [pick, setPick] = useState(false); const [gif, setGif] = useState(false); const inp = useRef(null);
  const [pending, setPending] = useState(null); // a picked GIF waiting for an optional caption
  if (!p) return null;
  const list = [...p.comments.filter((c) => !s.blocked[c.userId])].sort((a, b) => b.likes - a.likes || a.at - b.at);
  const frozen = p.status === 'frozen';
  const send = () => { const v = t.trim(); if (!v && !pending) return; const g = pending; setT(''); setPending(null); run(() => act.comment(p.id, v, g ? 'G|' + g : null)); };
  return (
    <Sheet visible onClose={onClose} title="Comments" full>
      <FlatList showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" data={list} keyExtractor={(c) => String(c.id)} style={{ maxHeight: 420 }} ListEmptyComponent={<Empty text="No comments yet" />}
        renderItem={({ item: c }) => { const u = s.users[c.userId] || {}; return (
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 9 }}>
            <Pressable onPress={() => { onClose(); nav.push('profile', { id: c.userId }); }}><Avatar u={u} size={34} /></Pressable>
            <View style={{ flex: 1 }}>
              <T><T h>{u.handle}</T><T muted style={{ fontSize: 13 }}>  {ago(Date.now() - c.at)}</T></T>
              {c.text ? <RichText text={c.text} style={{ marginTop: 2 }} /> : null}
              {c.sticker ? <View style={{ paddingVertical: 6 }}><Sticker v={c.sticker} size={46} /></View> : null}
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                {c.likes > 0 ? <T b muted style={{ fontSize: 12.5 }}>{kfmt(c.likes)} {c.likes === 1 ? 'like' : 'likes'}</T> : null}
                {!frozen ? <T b muted style={{ fontSize: 12.5 }} onPress={() => { setT('@' + u.handle + ' '); inp.current && inp.current.focus(); }}>Reply</T> : null}
              </View>
            </View>
            <Pressable onPress={() => run(() => act.likeComment(c.id, c.myLike, s.me))} accessibilityLabel="Like comment" style={{ paddingTop: 4, alignItems: 'center', width: 28 }}>
              <Ionicons name={c.myLike ? 'heart' : 'heart-outline'} size={17} color={c.myLike ? C.orange : C.muted} /></Pressable>
          </View>); }} />
      {frozen ? <T b muted style={{ textAlign: 'center', paddingVertical: 14 }}>Comments are off while this post is frozen</T> : <>
        {pick ? <StickerPicker onPick={(e) => { setPick(false); run(() => act.comment(p.id, '', e)); }} /> : null}
        {gif ? <GifPicker onClose={() => setGif(false)} onPick={(g) => { setGif(false); setPending(g.url); setTimeout(() => inp.current && inp.current.focus(), 50); }} /> : null}
        {pending ? <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 }}>
          <Image source={{ uri: pending }} style={{ width: 120, height: 90, borderRadius: 14, backgroundColor: C.soft }} />
          <Pressable onPress={() => setPending(null)} accessibilityLabel="Remove GIF" hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={16} color={C.ink} /></Pressable>
        </View> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: C.soft, borderRadius: 15, paddingLeft: 16, padding: 4 }}>
          <TextInput ref={inp} value={t} onChangeText={setT} placeholder={pending ? 'Say something with your GIF…' : 'Add a comment…'} placeholderTextColor={C.muted} onSubmitEditing={send} returnKeyType="send"
            style={{ flex: 1, color: C.ink, fontFamily: F.body, fontSize: 15, paddingVertical: 10 }} />
          <Pressable onPress={() => { setGif(!gif); setPick(false); }} accessibilityLabel="GIFs" style={{ paddingHorizontal: 6, paddingVertical: 8 }}><T h style={{ color: gif ? C.orange : C.muted, fontSize: 12 }}>GIF</T></Pressable>
          <Pressable onPress={() => setPick(!pick)} accessibilityLabel="Stickers" style={{ padding: 8 }}><Ionicons name="happy-outline" size={22} color={C.muted} /></Pressable>
          <Pressable onPress={send} disabled={!t.trim() && !pending} accessibilityLabel="Send comment" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', opacity: t.trim() || pending ? 1 : 0.3 }}>
            <Ionicons name="paper-plane" size={17} color={C.onOrange} /></Pressable>
        </View></>}
    </Sheet>
  );
}

export function ShareSheet({ post, onClose }) {
  const { s, run } = useApp(); const [sent, setSent] = useState({});
  const people = Object.values(s.users).filter((u) => u.id !== s.me && !s.blocked[u.id]).sort((a, b) => b.following - a.following);
  return (
    <Sheet visible onClose={onClose} title="Send to">
      <FlatList showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" data={people} keyExtractor={(u) => u.id} style={{ maxHeight: 460 }} ListEmptyComponent={<Empty text="Nobody to send to yet" />}
        renderItem={({ item: u }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
            <Avatar u={u} size={44} /><View style={{ flex: 1 }}><T h>{u.name}</T><T muted style={{ fontSize: 13 }}>@{u.handle}</T></View>
            <Btn small kind={sent[u.id] ? 'ghost' : 'orange'} disabled={sent[u.id]} title={sent[u.id] ? 'Sent' : 'Send'}
              onPress={() => { setSent({ ...sent, [u.id]: true }); run(() => act.dm(u.id, { post }), { toast: 'Sent to @' + u.handle }); }} />
          </View>)} />
    </Sheet>
  );
}

// polls: tap an option to vote; results show after you vote, on your own poll, or once it closes (24 hours)
// heat or freeze from one flame: hold it, slide to a reaction and let go (a quick tap opens the choices too)
export function ReactPick({ p, onPick }) {
  const { C, nav } = useApp(); const [open, setOpen] = useState(false); const [hover, setHover] = useState(null);
  const done = p.myHeat ? 'heat' : p.myFreeze ? 'freeze' : null;
  const pop = useRef(new Animated.Value(0)).current; const st = useRef({ t: null, held: false, x0: 0 }); const openR = useRef(false); openR.current = open;
  const cb = useRef({}); cb.current = { onPick, done };
  const show = (v) => { setOpen(v); Animated.spring(pop, { toValue: v ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 9 }).start(); };
  // the picker sits above the flame: Heat on the left half, Freeze on the right (positions relative to where the finger went down)
  const which = (dx) => (dx < -30 || dx > 150 ? null : dx < 60 ? 'heat' : 'freeze');
  const choose = (k) => { show(false); setHover(null); if (!k) return; const d = cb.current.done; if (d) { if (d !== k) nav.toast('You already ' + (d === 'heat' ? 'heated' : 'froze') + ' this take'); return; } cb.current.onPick(k); };
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => !st.current.held,
    onPanResponderGrant: (e) => { const S = st.current; S.held = false; S.x0 = e.nativeEvent.locationX; clearTimeout(S.t); S.t = setTimeout(() => { S.held = true; show(true); }, 260); },
    onPanResponderMove: (e, g) => { if (st.current.held) setHover(which(st.current.x0 + g.dx)); },
    onPanResponderRelease: (e, g) => { const S = st.current; clearTimeout(S.t); if (S.held) { S.held = false; choose(which(S.x0 + g.dx)); } else show(!openR.current); },
    onPanResponderTerminate: () => { clearTimeout(st.current.t); st.current.held = false; },
  })).current;
  const Orb = ({ k }) => { const h = hover === k; return (
    <Pressable onPress={() => choose(k)} accessibilityLabel={k === 'heat' ? 'Heat' : 'Freeze'} style={{ alignItems: 'center', gap: 3, paddingHorizontal: 4, transform: [{ translateY: h ? -8 : 0 }] }}>
      <View style={{ transform: [{ scale: h ? 1.22 : 1 }] }}>{k === 'heat'
        ? <LinearGradient colors={C.mono ? [C.orange, C.orange] : ['#ffc061', '#ff7a1a', '#ff4500']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="flame" size={26} color={C.mono ? C.onOrange : '#fff'} /></LinearGradient>
        : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#b9def5', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="snow" size={26} color="#0d3a57" /></View>}</View>
      <T h style={{ fontSize: 11.5, color: done === k ? C.orange : h ? C.ink : C.muted }}>{k === 'heat' ? 'Heat' : 'Freeze'}</T></Pressable>); };
  return (
    <View style={{ zIndex: 10 }}>
      <View {...pr.panHandlers} accessible accessibilityRole="button" accessibilityLabel={done ? 'You ' + (done === 'heat' ? 'heated' : 'froze') + ' this. Heat ' + p.heat + ', freeze ' + p.freeze : 'Hold to heat or freeze'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 42, paddingRight: 4 }}>
        {done === 'freeze' ? <FreezeIcon on /> : <DieIcon name={done === 'heat' ? 'flame' : 'flame-outline'} size={22} color={done === 'heat' ? (C.mono ? C.onOrange : '#fff') : C.ink} hot={done === 'heat' && !C.mono} die={done === 'heat' ? C.orange : C.dark ? '#2a2a2a' : '#dcd9d5'} />}
        <T h style={{ color: C.ink, fontSize: 15 }}>{kfmt(done === 'freeze' ? p.freeze : p.heat)}</T>
      </View>
      {open ? <Animated.View style={{ position: 'absolute', left: -6, bottom: 52, flexDirection: 'row', gap: 6, padding: 7, borderRadius: 40, backgroundColor: C.card,
        shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 12, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
        <Orb k="heat" /><Orb k="freeze" /></Animated.View> : null}
    </View>
  );
}

export function PollBox({ p }) {
  const { s, C, run } = useApp(); const P = p.poll; const n = P.o.length;
  const total = P.counts.slice(0, n).reduce((a, b) => a + b, 0); const left = p.createdAt + 864e5 - Date.now(); const closed = left <= 0;
  const show = P.mine != null || closed || p.userId === s.me; const top = Math.max(...P.counts.slice(0, n));
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {P.o.map((t, i) => { const c = P.counts[i] || 0; const pct = total ? Math.round((c / total) * 100) : 0;
        return show ? <View key={i} style={{ borderRadius: 14, backgroundColor: C.soft, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 }}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', borderRadius: 14, backgroundColor: c === top && total ? 'rgba(255,85,0,.32)' : C.dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)' }} />
          <T h style={{ flex: 1 }}>{t}{P.mine === i ? '  ✓' : ''}</T><T h>{pct}%</T></View>
          : <Pressable key={i} onPress={() => run(() => act.vote(p.id, i), { optimistic: { post: p.id, patch: { poll: { ...P, mine: i, counts: P.counts.map((x, j) => (j === i ? x + 1 : x)) } } } })}
            style={{ borderRadius: 14, borderWidth: 2, borderColor: C.orange, paddingHorizontal: 14, paddingVertical: 10 }}><T h style={{ color: C.orange }}>{t}</T></Pressable>; })}
      <T b muted style={{ fontSize: 13 }}>{total.toLocaleString()} vote{total === 1 ? '' : 's'} · {closed ? 'Final results' : (left > 36e5 ? Math.floor(left / 36e5) + 'h' : Math.max(1, Math.floor(left / 6e4)) + 'm') + ' left'}</T>
    </View>
  );
}

export function PostMenu({ post, onClose }) {
  const { s, C, run, nav, ash, ASH_COST } = useApp(); const u = s.users[post.userId] || {}; const mine = post.userId === s.me;
  const Item = ({ icon, label, onPress, warn }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={20} color={warn ? C.orange : C.ink} /><T h style={{ color: warn ? C.orange : C.ink }}>{label}</T></Pressable>);
  return (
    <Sheet visible onClose={onClose}>
      <View style={{ backgroundColor: C.soft, borderRadius: 20, overflow: 'hidden' }}>
        <Item icon={post.saved ? 'bookmark' : 'bookmark-outline'} label={post.saved ? 'Unsave' : 'Save'} onPress={() => { onClose(); run(() => act.save(post.id, post.saved, s.me)); }} />
        {mine ? <Item icon="pin-outline" label={s.users[s.me] && s.users[s.me].pinned === post.id ? 'Unpin from profile' : 'Pin to your profile'} onPress={() => { onClose(); const on = s.users[s.me] && s.users[s.me].pinned === post.id; run(() => act.pin(s.me, on ? null : post.id), { toast: on ? 'Unpinned' : 'Pinned to your profile' }); }} /> : null}
        {!mine ? <Item icon="volume-mute-outline" label={(s.muted && s.muted[u.id] ? 'Unmute' : 'Mute') + ' @' + u.handle} onPress={() => { onClose(); const on = !(s.muted && s.muted[u.id]); run(() => act.mute(u.id, on, s.me), { toast: on ? 'Muted. You won’t see their posts.' : 'Unmuted' }); }} /> : null}
        {!mine ? <Item icon="person-add-outline" label={(u.following ? 'Unfollow' : 'Follow') + ' @' + u.handle} onPress={() => { onClose(); run(() => act.follow(u.id, u.following, s.me)); }} /> : null}
        <Item icon="person-outline" label="View profile" onPress={() => { onClose(); nav.push('profile', { id: u.id }); }} />
        {!mine ? <Item icon="chatbubbles-outline" label="Message" onPress={() => { onClose(); nav.push('thread', { id: u.id }); }} /> : null}
        <Item icon="paper-plane-outline" label="Send" onPress={() => { onClose(); setTimeout(() => nav.sheet('share', { post }), 300); }} />
        {mine && post.reel ? <Item icon="trash-outline" label="Delete Replay" warn onPress={() => {
          Alert.alert('Delete this Replay?', 'It comes down for everyone. This can’t be undone.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { onClose(); run(() => act.deleteReplay(post.id), { toast: 'Replay deleted' }); } }]);
        }} /> : null}
        {mine && !post.reel ? <Item icon="flame-outline" label={'Ash this post · ' + ASH_COST + ' pts'} warn onPress={() => {
          Alert.alert('Ash this post?', 'It burns to ash and is gone for good. Costs ' + ASH_COST + ' pts (you have ' + (s.priv.points || 0) + ').', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Ash it', style: 'destructive', onPress: () => { onClose(); setTimeout(() => ash(post), 350); } }]);
        }} /> : null}
        {!mine ? <Item icon="flag-outline" label="Report" onPress={() => { onClose(); nav.toast('Reported. Thanks.'); }} /> : null}
        {!mine ? <Item icon="ban-outline" label={'Block @' + u.handle} warn onPress={() => {
          Alert.alert('Block @' + u.handle + '?', 'Their posts, stories, comments and messages will be hidden from you.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => { onClose(); run(() => act.block(u.id), { toast: 'Blocked @' + u.handle }); } }]);
        }} /> : null}
      </View>
    </Sheet>
  );
}
