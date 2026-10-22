// Voice messages for chats: record with the mic, play back with a little waveform.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useApp, T } from './ui';
import { hashStr } from './lib';

export const fmtSec = (ms) => { const t = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function rng(seed) { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }

export function VoiceBubble({ url, ms, mine }) {
  const { C } = useApp();
  const player = useAudioPlayer(url); const st = useAudioPlayerStatus(player);
  const bars = useMemo(() => { const r = rng(Math.abs(hashStr(url || 'v')) % 9973 + 1); return Array.from({ length: 26 }, () => 0.25 + r() * 0.75); }, [url]);
  const dur = st.duration ? st.duration * 1000 : ms || 0; const pos = (st.currentTime || 0) * 1000; const frac = dur ? Math.min(1, pos / dur) : 0;
  useEffect(() => { if (st.didJustFinish) { try { player.seekTo(0); player.pause(); } catch (e) {} } }, [st.didJustFinish]);
  const toggle = async () => { try { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }); } catch (e) {} if (st.playing) player.pause(); else player.play(); };
  const fg = mine ? '#fff' : C.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 }}>
      <Pressable onPress={toggle} accessibilityLabel={st.playing ? 'Pause voice message' : 'Play voice message'} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: mine ? '#fff' : C.orange, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={st.playing ? 'pause' : 'play'} size={16} color={mine ? C.orange : '#fff'} /></Pressable>
      <View style={{ flex: 1, height: 26, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {bars.map((h, i) => <View key={i} style={{ flex: 1, height: (h * 100) + '%', minHeight: 3, borderRadius: 2, backgroundColor: fg, opacity: i / bars.length <= frac ? 1 : 0.4 }} />)}
      </View>
      <T h style={{ color: fg, fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 32, textAlign: 'right' }}>{fmtSec(st.playing || pos > 0 ? pos : dur)}</T>
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
