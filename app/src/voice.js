// Voice messages for chats: record with the mic, play back with a little waveform.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Alert, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useApp, T } from './ui';
import { hashStr } from './lib';

export const fmtSec = (ms) => { const t = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function rng(seed) { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }

// Messenger-style voice pill: play button, waveform you can drag along to scrub, time and speed
export function VoiceBubble({ url, ms, mine }) {
  const { C } = useApp();
  const player = useAudioPlayer(url); const st = useAudioPlayerStatus(player);
  const bars = useMemo(() => { const r = rng(Math.abs(hashStr(url || 'v')) % 9973 + 1); return Array.from({ length: 30 }, () => 0.2 + r() * 0.8); }, [url]);
  const dur = st.duration ? st.duration * 1000 : ms || 0;
  const [drag, setDrag] = useState(null); const [w, setW] = useState(1); const [rate, setRate] = useState(1);
  const pos = drag != null ? drag * dur : (st.currentTime || 0) * 1000; const frac = dur ? Math.min(1, pos / dur) : 0;
  const started = st.playing || pos > 50;
  useEffect(() => { if (st.didJustFinish) { try { player.seekTo(0); player.pause(); } catch (e) {} } }, [st.didJustFinish]);
  const mode = async () => { try { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }); } catch (e) {} };
  const toggle = async () => { await mode(); if (st.playing) player.pause(); else player.play(); };
  const seekTo = (f) => { try { player.seekTo(Math.max(0, Math.min(1, f)) * dur / 1000); } catch (e) {} };
  const k = useRef({}); k.current = { w, dur };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponderCapture: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / (k.current.w || 1))); k.current.f0 = f; setDrag(f); },
    onPanResponderMove: (e, g) => setDrag(Math.max(0, Math.min(1, (k.current.f0 || 0) + g.dx / (k.current.w || 1)))),
    onPanResponderRelease: () => setDrag((x) => { if (x != null) { seekTo(x); mode().then(() => { try { player.play(); } catch (e) {} }); } return null; }),
    onPanResponderTerminate: () => setDrag(null),
  })).current;
  const fg = mine ? '#fff' : C.ink; const bg = mine ? C.orange : C.card;
  const nextRate = () => { const r = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1; setRate(r); try { player.setPlaybackRate(r); } catch (e) { try { player.playbackRate = r; } catch (e2) {} } };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: bg, borderRadius: 999, paddingVertical: 5, paddingLeft: 5, paddingRight: 12, width: 250 }}>
      <Pressable onPress={toggle} accessibilityLabel={st.playing ? 'Pause voice message' : 'Play voice message'} hitSlop={6}
        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: mine ? 'rgba(0,0,0,.22)' : C.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={st.playing ? 'pause' : 'play'} size={15} color={fg} style={st.playing ? null : { marginLeft: 2 }} /></Pressable>
      <View {...pan.panHandlers} onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ flex: 1, height: 30, flexDirection: 'row', alignItems: 'center', gap: 2 }} accessibilityLabel="Drag to scrub">
        {bars.map((h, i) => <View key={i} pointerEvents="none" style={{ flex: 1, height: (h * 100) + '%', minHeight: 3, borderRadius: 2, backgroundColor: fg, opacity: (i + 0.5) / bars.length <= frac ? 1 : 0.38 }} />)}
        {started || drag != null ? <View pointerEvents="none" style={{ position: 'absolute', left: frac * w - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 }} /> : null}
      </View>
      <View style={{ alignItems: 'center', gap: 1 }}>
        <T h style={{ color: fg, fontSize: 12, fontVariant: ['tabular-nums'] }}>{fmtSec(started || drag != null ? pos : dur)}</T>
        {started ? <Pressable onPress={nextRate} hitSlop={6} accessibilityLabel="Playback speed"><T h style={{ color: fg, fontSize: 10.5, opacity: 0.85 }}>{rate}x</T></Pressable> : null}
      </View>
    </View>
  );
}

// tap the mic to start; then send or cancel. Stops on its own at 60 seconds.
export function useVoiceRecorder(onDone) {
  const rec = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [on, setOn] = useState(null); const startAt = useRef(0);
  useEffect(() => { if (!on) return; const t = setInterval(() => { const ms = Date.now() - startAt.current; setOn({ ms }); if (ms >= 60000) stop(true); }, 200); return () => clearInterval(t); }, [!!on]);
  async function start() {
    try {
      const p = await AudioModule.requestRecordingPermissionsAsync();
      if (!p.granted) { Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.'); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await rec.prepareToRecordAsync(); rec.record(); startAt.current = Date.now(); setOn({ ms: 0 });
    } catch (e) { Alert.alert('Couldn’t start recording', String(e.message || e)); }
  }
  async function stop(send) {
    if (!startAt.current) return; const ms = Date.now() - startAt.current; startAt.current = 0; setOn(null);
    try { await rec.stop(); } catch (e) {}
    try { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }); } catch (e) {}
    if (send && ms > 600 && rec.uri) onDone({ uri: rec.uri, mimeType: 'audio/mp4', fileName: 'voice.m4a' }, ms);
  }
  return { on, start, stop };
}
