import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp, T } from './ui';
import { F } from './lib';

// GIF search powered by GIPHY. The key is meant to ship inside apps.
export const GIPHY_KEY = 'b2Iegy5NrTJZ6CeatyDooV0oumjBTBYH';

export async function giphy(q) {
  const base = 'https://api.giphy.com/v1/gifs/' + (q ? 'search' : 'trending');
  const u = base + '?api_key=' + GIPHY_KEY + '&limit=30&rating=pg-13&bundle=messaging_non_clips' + (q ? '&q=' + encodeURIComponent(q) : '');
  const r = await fetch(u);
  if (!r.ok) throw new Error('GIF search isn’t available right now.');
  const j = await r.json();
  return (j.data || []).map((g) => ({
    id: g.id, title: g.title,
    thumb: (g.images.fixed_width_small || g.images.fixed_width).url,
    url: (g.images.downsized_medium || g.images.downsized || g.images.original).url,
    w: +g.images.fixed_width.width || 1, h: +g.images.fixed_width.height || 1,
  }));
}

export function GifPicker({ onPick, onClose }) {
  const { C } = useApp();
  const [q, setQ] = useState(''); const [list, setList] = useState([]); const [busy, setBusy] = useState(true); const [err, setErr] = useState('');
  useEffect(() => {
    let live = true; setBusy(true);
    const t = setTimeout(() => {
      giphy(q.trim()).then((l) => { if (live) { setList(l); setErr(''); } }).catch((e) => { if (live) setErr(e.message); }).finally(() => { if (live) setBusy(false); });
    }, q ? 350 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  // three columns, each GIF keeps its shape
  const cols = [[], [], []]; const hts = [0, 0, 0];
  list.forEach((g) => { const i = hts.indexOf(Math.min(...hts)); cols[i].push(g); hts[i] += g.h / g.w; });
  return (
    <View style={{ backgroundColor: C.soft, borderRadius: 20, padding: 10, marginTop: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 17, borderBottomRightRadius: 28, borderBottomLeftRadius: 15, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={16} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search GIPHY" placeholderTextColor={C.muted} autoCapitalize="none"
            style={{ flex: 1, color: C.ink, fontFamily: F.body, fontSize: 16, paddingVertical: 9 }} />
        </View>
        {onClose ? <Pressable onPress={onClose} accessibilityLabel="Close GIFs" hitSlop={8} style={{ padding: 4 }}><Ionicons name="close" size={20} color={C.muted} /></Pressable> : null}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {cols.map((col, i) => (
            <View key={i} style={{ flex: 1, gap: 6 }}>
              {col.map((g) => (
                <Pressable key={g.id} onPress={() => onPick(g)} accessibilityLabel={g.title || 'GIF'}>
                  <Image source={{ uri: g.thumb }} style={{ width: '100%', aspectRatio: g.w / g.h, borderRadius: 10, backgroundColor: C.line }} />
                </Pressable>))}
            </View>))}
        </View>
        {busy && !list.length ? <ActivityIndicator color={C.orange} style={{ marginVertical: 20 }} /> : null}
        {!busy && !list.length ? <T muted b style={{ textAlign: 'center', marginVertical: 20 }}>{err || 'No GIFs found'}</T> : null}
      </ScrollView>
      <T b muted style={{ fontSize: 11, textAlign: 'right', letterSpacing: 0.5 }}>Powered by GIPHY</T>
    </View>
  );
}
