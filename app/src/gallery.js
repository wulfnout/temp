// web-only check page (?gallery): every store item, so the app and the website can be compared side by side
import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { Ctx, Avatar, Sticker, StoryOrb } from './ui';
import { HeaderFx, ClockKeeper } from './fx';
import { THEMES, GLOW, STICKER_PACKS, useColors, F } from './lib';

const HEADERS = ['templogo', 'lava', 'aurora', 'static', 'embers', 'hazard', 'sunburst', 'snow', 'thermal', 'disco', 'checker', 'synth', 'rain', 'wildfire', 'heatwave', 'blizzard', 'glitchtv', 'starfield', 'lavalamp', 'haunted', 'pumpkinpatch', 'ghosts'];
const RINGS = ['fire', 'ice', 'morph', 'gold', 'glitch', 'plus'];

export function Gallery() {
  const C = useColors('ember', 'light');
  const only = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('gallery')) || '';
  const u = (ring) => ({ name: 'Wulf', handle: 'wulf', color: '#222', ring });
  const H = ({ children }) => <Text style={{ fontFamily: F.display, fontSize: 18, marginTop: 18, marginBottom: 8, color: C.ink }}>{children}</Text>;
  const L = ({ children }) => <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>{children}</Text>;
  return (
    <Ctx.Provider value={{ C, s: { users: {}, priv: {}, posts: [] }, nav: {}, run: () => {} }}>
      <ClockKeeper />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
        {!only || only === 'headers' ? <><H>Headers</H><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {HEADERS.map((id) => <View key={id} style={{ width: '48%', gap: 4 }}><View style={{ height: 120, borderRadius: 18, overflow: 'hidden' }}><HeaderFx id={id} /></View><L>{id}</L></View>)}</View></> : null}
        {!only || only === 'rings' ? <><H>Rings</H><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {RINGS.map((r) => <View key={r} style={{ alignItems: 'center', gap: 4 }}><Avatar u={u(r)} size={96} /><L>{r}</L></View>)}
          <View style={{ alignItems: 'center', gap: 4 }}><StoryOrb u={u(null)} size={96} seen={false} onPress={() => {}} /><L>story</L></View></View></> : null}
        {!only || only === 'stickers' ? <><H>Stickers</H><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {Object.values(STICKER_PACKS).flatMap((p) => p.slice(0, 3)).map((v, i) => <Sticker key={i} v={v} size={46} />)}</View></> : null}
        {!only || only === 'themes' ? <><H>Themes</H><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {Object.entries(THEMES).map(([id, c]) => <View key={id} style={{ alignItems: 'center', gap: 4 }}><View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c[0], borderWidth: 0, ...(GLOW[id] ? { shadowColor: c[0], shadowOpacity: 1, shadowRadius: 9 } : null) }} /><L>{id}</L></View>)}</View></> : null}
      </ScrollView>
    </Ctx.Provider>
  );
}
