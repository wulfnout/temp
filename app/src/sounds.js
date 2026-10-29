// Sounds for Replays: Temp's own music loops and meme-style sound effects (same files as the website),
// kept in sync with the video, plus the original-sound volume.
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, PanResponder, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer } from 'expo-audio';
import { T } from './ui';

const SITE = 'https://temptakes.com';
export const MUSIC = [['ember-trap', 'Ember Trap', 'Dark trap · 140'], ['late-night-lofi', 'Late Night Lofi', 'Chill · 80'], ['heat-check-drill', 'Heat Check Drill', 'Drill · 142'], ['sunset-house', 'Sunset House', 'House · 124'],
  ['phonk-drift', 'Phonk Drift', 'Phonk · 130'], ['afro-glow', 'Afro Glow', 'Afrobeats · 108'], ['main-character', 'Main Character', 'Cinematic · 90'], ['plot-twist', 'Plot Twist', 'Funny · 112']]
  .map(([id, name, mood]) => ({ id, name, mood, u: '/sounds/lib/' + id + '.mp3' }));
export const SFX = [['boom', 'Boom'], ['air-horn', 'Air Horn'], ['record-scratch', 'Record Scratch'], ['sad-trombone', 'Sad Trombone'], ['crickets', 'Crickets'], ['drum-roll', 'Drum Roll'], ['ba-dum-tss', 'Ba Dum Tss'], ['dun-dun-dun', 'Dun Dun Dunnn'],
  ['suspense', 'Suspense'], ['ding', 'Ding'], ['wrong-buzzer', 'Wrong Buzzer'], ['whoosh', 'Whoosh'], ['cha-ching', 'Cha-Ching'], ['bonk', 'Bonk'], ['glitch', 'Glitch'], ['uh-oh', 'Uh Oh']]
  .map(([id, name]) => ({ id, name, u: '/sounds/sfx/' + id + '.mp3' }));
export const absUrl = (u) => (!u ? null : /^https?:|^file:|^blob:/.test(u) ? u : SITE + (u[0] === '/' ? '' : '/') + u);

// plays a sound alongside a video player: loops music, plays effects once at their moment; follows play/pause
export function useSoundTrack(player, snd) {
  useEffect(() => {
    if (!player || !snd) return;
    const o = snd.o == null ? 1 : snd.o;
    try { player.volume = Math.max(0, Math.min(1, o)); player.muted = o === 0; } catch (e) {}
    if (!snd.u) return () => { try { player.volume = 1; player.muted = false; } catch (e) {} };
    let a; try { a = createAudioPlayer(absUrl(snd.u)); a.loop = !snd.once; a.volume = snd.v == null ? 1 : snd.v; } catch (e) { return; }
    let started = false;
    const iv = setInterval(() => {
      try {
        if (!player.playing) { if (a.playing) a.pause(); return; }
        const d = a.duration || 0; const want = (+snd.st || 0) + (player.currentTime - (+snd.t0 || 0));
        if (snd.once && (want < 0 || (d && want >= d - 0.05))) { if (a.playing) a.pause(); started = false; return; }
        const w = snd.once || !d ? want : ((want % d) + d) % d;
        if (!started || Math.abs(a.currentTime - w) > 0.35) { a.seekTo(Math.max(0, w)); started = true; }
        if (!a.playing) a.play();
      } catch (e) {}
    }, 250);
    return () => { clearInterval(iv); try { a.pause(); a.remove(); } catch (e) {} try { player.volume = 1; player.muted = false; } catch (e) {} };
  }, [player, snd && snd.u, snd && snd.v, snd && snd.o, snd && snd.st, snd && snd.t0, snd && snd.once]);
}

// a plain slider (0..1 by default)
export function Slider({ value, onChange, min = 0, max = 1, step = 0.05 }) {
  const [w, setW] = useState(1); const wr = useRef(1); wr.current = w;
  const cb = useRef(onChange); cb.current = onChange;
  const set = (x) => { let v = min + Math.max(0, Math.min(1, x / wr.current)) * (max - min); v = Math.round(v / step) * step; cb.current(+v.toFixed(3)); };
  const pr = useRef(PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => set(e.nativeEvent.locationX), onPanResponderMove: (e) => set(e.nativeEvent.locationX) })).current;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pr.panHandlers} style={{ height: 34, justifyContent: 'center' }} hitSlop={{ top: 8, bottom: 8 }}>
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.18)' }}><View style={{ width: pct + '%', height: 6, borderRadius: 3, backgroundColor: '#ff5500' }} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', left: (pct / 100) * w - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }} />
    </View>
  );
}

// the Sound panel: music, effects, and the mix
export function SoundPanel({ value, onChange, maxT = 60 }) {
  const v = value || null; const set = (p) => onChange({ ...(v || {}), ...p });
  const [prev, setPrev] = useState(null); const au = useRef(null);
  const stop = () => { try { if (au.current) { au.current.pause(); au.current.remove(); } } catch (e) {} au.current = null; };
  useEffect(() => stop, []);
  const play = (x) => { stop(); if (prev === x.u) { setPrev(null); return; } try { const a = createAudioPlayer(absUrl(x.u)); a.play(); au.current = a; setPrev(x.u); } catch (e) {} };
  const Row = ({ x, sub }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <Pressable onPress={() => play(x)} accessibilityLabel={(prev === x.u ? 'Stop ' : 'Play ') + x.name} style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#ff5500', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={prev === x.u ? 'pause' : 'play'} size={18} color="#fff" /></Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => set({ u: x.u, n: x.name, st: 0, once: 0, t0: 0, v: v && v.v != null ? v.v : 1, o: v && v.o != null ? v.o : 0.4 })}>
        <T h style={{ color: '#fff' }}>{x.name}</T><T b style={{ color: 'rgba(255,255,255,.55)', fontSize: 12.5 }}>{sub}</T></Pressable>
      {v && v.u === x.u ? <Ionicons name="checkmark" size={20} color="#ff8a2b" /> : null}
    </View>);
  const H = ({ t }) => <T h style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, letterSpacing: 1, marginTop: 10, marginBottom: 4 }}>{t}</T>;
  return (
    <View style={{ gap: 4 }}>
      <ScrollView style={{ maxHeight: 290 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => { stop(); setPrev(null); onChange(v && v.o != null && v.o !== 1 ? { o: v.o } : null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="volume-mute-outline" size={20} color="#fff" /></View>
          <T h style={{ color: '#fff', flex: 1 }}>Original sound only</T>{!v || !v.u ? <Ionicons name="checkmark" size={20} color="#ff8a2b" /> : null}</Pressable>
        <H t="MUSIC" />
        {MUSIC.map((x) => <Row key={x.id} x={x} sub={x.mood + ' · Temp Sounds'} />)}
        <H t="SOUND EFFECTS" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SFX.map((x) => { const on = v && v.u === x.u; return (
            <View key={x.id} style={{ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 14, backgroundColor: on ? 'rgba(255,85,0,.2)' : 'rgba(255,255,255,.08)', borderWidth: 1.5, borderColor: on ? '#ff5500' : 'transparent' }}>
              <Pressable onPress={() => play(x)} accessibilityLabel={(prev === x.u ? 'Stop ' : 'Play ') + x.name} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#ff5500', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={prev === x.u ? 'pause' : 'play'} size={14} color="#fff" /></Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => set({ u: x.u, n: x.name, st: 0, once: 1, t0: v && v.once ? v.t0 || 0 : 0, v: v && v.v != null ? v.v : 1, o: v && v.o != null ? v.o : 1 })}>
                <T h numberOfLines={1} style={{ color: '#fff', fontSize: 14 }}>{x.name}</T></Pressable>
            </View>); })}
        </View>
      </ScrollView>
      {v && v.u ? <View style={{ gap: 2, marginTop: 6 }}>
        <T h style={{ color: '#fff', fontSize: 13 }}>{v.once ? 'Effect' : 'Sound'} volume {Math.round((v.v == null ? 1 : v.v) * 100)}%</T>
        <Slider value={v.v == null ? 1 : v.v} onChange={(x) => set({ v: x })} />
        {v.once ? <><T h style={{ color: '#fff', fontSize: 13 }}>Plays at {(+v.t0 || 0).toFixed(1)}s</T><Slider value={+v.t0 || 0} min={0} max={Math.max(1, maxT)} step={0.5} onChange={(x) => set({ t0: x })} /></>
          : <><T h style={{ color: '#fff', fontSize: 13 }}>Start the song at {Math.round(v.st || 0)}s</T><Slider value={v.st || 0} min={0} max={25} step={1} onChange={(x) => set({ st: x })} /></>}
      </View> : null}
    </View>
  );
}
