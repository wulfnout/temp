import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Modal, TextInput, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, T, Btn } from './ui';
import { Video } from './posts';
import { act } from './data';
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
export const TEXT_COLORS = ['#ffffff', '#0a0a0a', '#ff5500', '#ffd60a', '#4fd2ff'];

export function ReplayOverlay({ overlay, small }) {
  if (!overlay) return null;
  const f = FILTERS[overlay.filter] || FILTERS.none;
  const pos = overlay.textPos || 'middle';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {f.color ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: f.color }} /> : null}
      {f.grad ? <LinearGradient colors={f.grad} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      {overlay.text ? (
        <View style={{ position: 'absolute', left: 0, right: 0, paddingHorizontal: small ? 6 : 20, alignItems: 'center',
          top: pos === 'top' ? '14%' : pos === 'middle' ? '42%' : undefined, bottom: pos === 'bottom' ? '24%' : undefined }}>
          <T d style={{ color: overlay.color || '#fff', fontSize: small ? 11 : 30, lineHeight: small ? 14 : 36, textAlign: 'center', letterSpacing: -1,
            textShadowColor: overlay.color === '#0a0a0a' ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.55)', textShadowRadius: 8 }}>{overlay.text}</T>
        </View>) : null}
    </View>
  );
}

const MAX = 60;
export function Recorder({ onClose }) {
  const { C, s, run, nav } = useApp(); const ins = useSafeAreaInsets();
  const [camPerm, askCam] = useCameraPermissions(); const [micPerm, askMic] = useMicrophonePermissions();
  const cam = useRef(null); const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState('back'); const [torch, setTorch] = useState(false); const [countdown, setCountdown] = useState(false);
  const [phase, setPhase] = useState('camera'); // camera | counting | recording | edit
  const [count, setCount] = useState(3); const [elapsed, setElapsed] = useState(0); const started = useRef(0); const tick = useRef(null);
  const [clip, setClip] = useState(null);
  const [filter, setFilter] = useState('none'); const [text, setText] = useState(''); const [textPos, setTextPos] = useState('middle'); const [color, setColor] = useState('#ffffff');
  const [trimStart, setTrimStart] = useState(0); const [trimEnd, setTrimEnd] = useState(0); const [caption, setCaption] = useState(''); const [busy, setBusy] = useState(false);
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => () => clearInterval(tick.current), []);
  const permsOk = camPerm && camPerm.granted && micPerm && micPerm.granted;

  async function begin() {
    if (!ready || !cam.current) return;
    setPhase('recording'); started.current = Date.now(); setElapsed(0); prog.setValue(0);
    Animated.timing(prog, { toValue: 1, duration: MAX * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    tick.current = setInterval(() => setElapsed((Date.now() - started.current) / 1000), 200);
    try {
      const v = await cam.current.recordAsync({ maxDuration: MAX });
      clearInterval(tick.current); prog.stopAnimation();
      const dur = Math.max(1, Math.min(MAX, (Date.now() - started.current) / 1000));
      if (v && v.uri) { setClip({ uri: v.uri, dur }); setTrimStart(0); setTrimEnd(dur); setPhase('edit'); } else setPhase('camera');
    } catch (e) { clearInterval(tick.current); setPhase('camera'); nav.toast('Recording stopped. Try again.'); }
  }
  function shutter() {
    if (phase === 'recording') { cam.current && cam.current.stopRecording(); return; }
    if (phase !== 'camera') return;
    if (!countdown) return begin();
    setPhase('counting'); setCount(3); let n = 3;
    const t = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(t); begin(); } else setCount(n); }, 1000);
  }
  async function post() {
    if (!clip || busy) return; setBusy(true);
    const overlay = { filter, text: text.trim(), textPos, color, trimStart: +trimStart.toFixed(1), trimEnd: +trimEnd.toFixed(1), dur: +clip.dur.toFixed(1) };
    const isMov = /\.mov$/i.test(clip.uri);
    const asset = { uri: clip.uri, type: 'video', mimeType: isMov ? 'video/quicktime' : 'video/mp4', fileName: isMov ? 'replay.mov' : 'replay.mp4' };
    const ok = await run(() => act.post(s.me, { text: caption.trim(), asset, reel: true, overlay }), { toast: 'Replay posted' });
    setBusy(false); if (ok) { onClose(); nav.tab('replay'); }
  }

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
    <Pressable onPress={onPress} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? '#fff' : 'rgba(255,255,255,.16)' }}>
      <T h style={{ color: on ? '#000' : '#fff', fontSize: 13 }}>{label}</T></Pressable>);
  const Step = ({ label, value, onMinus, onPlus }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 6 }}>
      <Pressable onPress={onMinus} hitSlop={6} style={{ padding: 4 }}><Ionicons name="remove" size={18} color="#fff" /></Pressable>
      <T h style={{ color: '#fff', fontSize: 13, minWidth: 74, textAlign: 'center' }}>{label} {value.toFixed(1)}s</T>
      <Pressable onPress={onPlus} hitSlop={6} style={{ padding: 4 }}><Ionicons name="add" size={18} color="#fff" /></Pressable>
    </View>);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#000' }}>
        {phase !== 'edit' ? (
          <View style={{ flex: 1 }}>
            <CameraView ref={cam} style={{ flex: 1 }} mode="video" facing={facing} enableTorch={torch} onCameraReady={() => setReady(true)} />
            <ReplayOverlay overlay={{ filter }} />
            <View style={{ position: 'absolute', top: ins.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}><Ionicons name="close" size={30} color="#fff" /></Pressable>
              <View style={{ flex: 1 }} />
              {phase === 'recording' ? <T h style={{ color: '#fff', fontSize: 15 }}>{elapsed.toFixed(0)}s / {MAX}s</T> : <>
                <Pressable onPress={() => setTorch(!torch)} accessibilityLabel="Flash" style={{ padding: 6 }}><Ionicons name={torch ? 'flash' : 'flash-off'} size={24} color="#fff" /></Pressable>
                <Pressable onPress={() => setCountdown(!countdown)} accessibilityLabel="3 second countdown" style={{ padding: 6 }}><Ionicons name="timer-outline" size={24} color={countdown ? C.orange : '#fff'} /></Pressable>
                <Pressable onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} accessibilityLabel="Flip camera" style={{ padding: 6 }}><Ionicons name="camera-reverse-outline" size={26} color="#fff" /></Pressable>
              </>}
            </View>
            {phase === 'counting' ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <T d style={{ color: '#fff', fontSize: 120 }}>{count}</T></View> : null}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 20, alignItems: 'center', gap: 16 }}>
              {phase === 'camera' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
                {Object.entries(FILTERS).map(([k, f]) => <Chip key={k} on={filter === k} label={f.name} onPress={() => setFilter(k)} />)}</ScrollView> : null}
              <Pressable onPress={shutter} accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Record'} style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: phase === 'recording' ? 30 : 64, height: phase === 'recording' ? 30 : 64, borderRadius: phase === 'recording' ? 8 : 32, backgroundColor: C.orange }} />
              </Pressable>
              {phase === 'recording' ? <View style={{ width: '70%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
                <Animated.View style={{ height: 4, backgroundColor: C.orange, width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} /></View> : null}
              {!ready ? <ActivityIndicator color="#fff" /> : null}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Video key={clip.uri + trimStart + trimEnd} uri={clip.uri} style={{ flex: 1 }} controls={false} autoPlay loop trim={{ trimStart, trimEnd }} />
            <ReplayOverlay overlay={{ filter, text, textPos, color }} />
            <View style={{ position: 'absolute', top: ins.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => { setClip(null); setPhase('camera'); }} accessibilityLabel="Retake" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chevron-back" size={26} color="#fff" /><T h style={{ color: '#fff' }}>Retake</T></Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={onClose} accessibilityLabel="Discard" hitSlop={10}><Ionicons name="close" size={28} color="#fff" /></Pressable>
            </View>
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 12, gap: 10, paddingHorizontal: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {Object.entries(FILTERS).map(([k, f]) => <Chip key={k} on={filter === k} label={f.name} onPress={() => setFilter(k)} />)}</ScrollView>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Step label="Start" value={trimStart} onMinus={() => setTrimStart(Math.max(0, trimStart - 0.5))} onPlus={() => setTrimStart(Math.min(trimEnd - 1, trimStart + 0.5))} />
                <Step label="End" value={trimEnd} onMinus={() => setTrimEnd(Math.max(trimStart + 1, trimEnd - 0.5))} onPlus={() => setTrimEnd(Math.min(clip.dur, trimEnd + 0.5))} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TextInput value={text} onChangeText={setText} placeholder="Add text on the video" placeholderTextColor="rgba(255,255,255,.65)" maxLength={80}
                  style={{ flex: 1, color: '#fff', fontFamily: F.bold, fontSize: 16, backgroundColor: 'rgba(255,255,255,.14)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }} />
                <Pressable onPress={() => setTextPos(textPos === 'top' ? 'middle' : textPos === 'middle' ? 'bottom' : 'top')} accessibilityLabel="Move text" style={{ padding: 8 }}>
                  <Ionicons name={textPos === 'top' ? 'arrow-up' : textPos === 'bottom' ? 'arrow-down' : 'remove'} size={22} color="#fff" /></Pressable>
                {TEXT_COLORS.map((c) => <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={'Text color ' + c}
                  style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, borderWidth: color === c ? 3 : 1.5, borderColor: color === c ? '#fff' : 'rgba(255,255,255,.5)' }} />)}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput value={caption} onChangeText={setCaption} placeholder="Caption… #hashtags" placeholderTextColor="rgba(255,255,255,.65)" maxLength={280}
                  style={{ flex: 1, color: '#fff', fontFamily: F.body, fontSize: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.5)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }} />
                <Btn kind="orange" title={busy ? 'Posting…' : 'Post'} disabled={busy} onPress={post} />
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
