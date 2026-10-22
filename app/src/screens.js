import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, FlatList, Pressable, TextInput, Image, ScrollView, RefreshControl, PanResponder, ActivityIndicator, Dimensions, Modal, Animated, Easing, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, T, Btn, IconBtn, Avatar, StoryOrb, Thermo, Sticker, StickerPicker, Sheet, Empty, Timer, stickerLabel } from './ui';
import { PostCard, Video, RichText } from './posts';
import { act } from './data';
import { ReplayOverlay } from './recorder';
import { GifPicker } from './gif';
import { sb, ago, kfmt, F, THEMES, tempOf } from './lib';

export async function pickMedia(kind = 'all') {
  const types = kind === 'image' ? ['images'] : kind === 'video' ? ['videos'] : ['images', 'videos'];
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: types, quality: 0.85, videoMaxDuration: 180 });
  if (r.canceled || !r.assets || !r.assets[0]) return null;
  return r.assets[0];
}

export function Header({ title, back, right }) {
  const { C, nav } = useApp(); const ins = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: ins.top + 8, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {back ? <IconBtn name="chevron-back" label="Back" onPress={nav.back} /> : null}
      {title ? <T d numberOfLines={1} style={{ fontSize: 19, letterSpacing: -0.6, flex: 1 }}>{title}</T> : <View style={{ flex: 1 }} />}
      {right}
    </View>
  );
}

/* ---------------- home ---------------- */
export function HomeScreen() {
  const { s, C, nav, reload, run } = useApp(); const ins = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const posts = s.posts.filter((p) => !p.reel && !s.blocked[p.userId]);
  const unreadN = s.notifs.filter((n) => !n.read).length, unreadDM = Object.keys(s.unread).filter((k) => !s.blocked[k]).length;
  const viewed = useRef(new Set());
  const onViewable = useRef(({ viewableItems }) => viewableItems.forEach((v) => { const id = v.item && v.item.id; if (id && !viewed.current.has(id)) { viewed.current.add(id); act.view(id); } })).current;
  const mine = s.stories.find((x) => x.userId === s.me);
  const others = s.stories.filter((x) => x.userId !== s.me && !s.blocked[x.userId]);
  const unseen = (st) => st.items.some((i) => !s.seen[i.id]);
  const { uploading, bars, setBars } = useApp();
  const addStory = () => nav.sheet('recorder', { mode: 'story' });
  const [hh, setHh] = useState(ins.top + 60); const lastY = useRef(0);
  useEffect(() => () => setBars(false), []);
  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y + (Platform.OS === 'ios' ? hh : 0); const dy = y - lastY.current; lastY.current = y;
    if (y < 40) setBars(false); else if (dy > 6) setBars(true); else if (dy < -6) setBars(false);
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View onLayout={(e) => setHh(e.nativeEvent.layout.height)} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, backgroundColor: C.bg, paddingTop: ins.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center',
        transform: [{ translateY: bars.interpolate({ inputRange: [0, 1], outputRange: [0, -hh] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, flex: 1 }}>
          <T d style={{ fontSize: 27, letterSpacing: -1.3 }}>temp</T><View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: C.orange, marginBottom: 6, ...(C.glow ? { shadowColor: C.orange, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } } : null) }} /></View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn name="heart-outline" label="Activity" badge={unreadN || null} onPress={() => nav.push('activity')} />
          <IconBtn name="chatbubble-ellipses-outline" label="Messages" badge={unreadDM || null} onPress={() => nav.push('dms')} />
        </View>
      </Animated.View>
      <FlatList showsVerticalScrollIndicator={false} data={posts} keyExtractor={(p) => String(p.id)} onScroll={onScroll} scrollEventThrottle={16}
        contentInset={Platform.OS === 'ios' ? { top: hh } : undefined} contentOffset={Platform.OS === 'ios' ? { x: 0, y: -hh } : undefined} scrollIndicatorInsets={{ top: hh }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130, paddingTop: Platform.OS === 'ios' ? 0 : hh }}
        onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.orange} progressViewOffset={hh} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View>
                <StoryOrb u={s.users[s.me]} seen={!mine || !unseen(mine)} add={!uploading} onAdd={addStory} onPress={() => (uploading ? null : mine ? nav.sheet('story', { userId: s.me }) : addStory())} label={uploading ? 'Your story is uploading' : mine ? 'Your story' : 'Add to your story'} />
                {uploading ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: 78, height: 74, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.orange} /></View> : null}
              </View>
              <T b muted style={{ fontSize: 12 }}>{uploading ? 'Posting…' : 'Your story'}</T></View>
            {others.sort((a, b) => unseen(b) - unseen(a)).map((st) => { const u = s.users[st.userId]; return (
              <View key={st.userId} style={{ alignItems: 'center', gap: 6 }}>
                <StoryOrb u={u} seen={!unseen(st)} onPress={() => nav.sheet('story', { userId: st.userId })} label={'Story from @' + u.handle} />
                <T b muted numberOfLines={1} style={{ fontSize: 12, maxWidth: 76 }}>{u.handle}</T></View>); })}
          </ScrollView>}
        ListEmptyComponent={<Empty text={s.loaded ? 'Nothing here yet. Tap + to post the first take.' : 'Loading…'} />}
        renderItem={({ item }) => <PostCard p={item} />} />
    </View>
  );
}

/* ---------------- replay ---------------- */
export function ReplayScreen({ startId }) {
  const { s, C, nav } = useApp(); const ins = useSafeAreaInsets();
  const [H, setH] = useState(0); // exact page height, measured, so the next Replay never peeks in
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, d) => d.dx > 14 && Math.abs(d.dx) > Math.abs(d.dy) * 2,
    onPanResponderRelease: (e, d) => { if (d.dx > 70 || d.vx > 0.5) nav.leaveReplay(); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  const reels = s.posts.filter((p) => p.reel && !s.blocked[p.userId]);
  const startIndex = Math.max(0, reels.findIndex((p) => p.id === startId));
  const [active, setActive] = useState(startId || (reels[0] && reels[0].id));
  useEffect(() => { if (!active && reels[0]) setActive(reels[0].id); }, [reels.length]);
  useEffect(() => { if (startId) setActive(startId); }, [startId]);
  const onViewable = useRef(({ viewableItems }) => { const v = viewableItems[0]; if (v) { setActive(v.item.id); act.view(v.item.id); } }).current;
  return (
    <View {...swipe.panHandlers} onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h && h !== H) setH(h); }} style={{ flex: 1, backgroundColor: '#000' }}>
      {H ? <FlatList key={'reels-' + (startId || 'top') + H} data={reels} keyExtractor={(p) => String(p.id)} pagingEnabled showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" snapToInterval={H} decelerationRate="fast"
        initialScrollIndex={reels.length ? startIndex : undefined} windowSize={3} maxToRenderPerBatch={2} initialNumToRender={2}
        getItemLayout={(_, i) => ({ length: H, offset: H * i, index: i })} onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListEmptyComponent={<View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}><T b style={{ color: '#fff' }}>No Replays yet. Tap + to post one.</T></View>}
        renderItem={({ item }) => <Reel p={item} h={H} active={item.id === active} />} /> : null}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
        <T d style={{ color: '#fff', fontSize: 22, letterSpacing: -1, flex: 1 }}>Replay</T>
        <IconBtn name="videocam-outline" color="#fff" label="New Replay" style={{ backgroundColor: 'rgba(255,255,255,.14)' }} onPress={() => nav.sheet('compose', { reel: true })} />
      </View>
    </View>
  );
}

// Thumbnail grid used on profiles and in search. Tapping opens the full-screen Replay viewer, already playing.
export function ReplayGrid({ posts }) {
  const { s, C, nav } = useApp();
  if (!posts.length) return <Empty text="No Replays yet" />;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: 20, overflow: 'hidden' }}>
      {posts.map((p) => (
        <Pressable key={p.id} onPress={() => nav.tab('replay', { startId: p.id })} accessibilityLabel={'Play Replay' + (p.text ? ': ' + p.text : '')}
          style={{ width: '32.6%', aspectRatio: 9 / 16, backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
          {p.mediaUrl ? <><Video uri={p.mediaUrl} style={{ flex: 1 }} controls={false} muted trim={p.overlay && p.overlay.trimStart ? { trimStart: p.overlay.trimStart } : null} /><ReplayOverlay overlay={p.overlay} small /></> : (
            <LinearGradient colors={REEL_SETS[(p.seed || 1) % REEL_SETS.length]} style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
              <T d numberOfLines={5} style={{ color: REEL_SETS[(p.seed || 1) % REEL_SETS.length][0] === '#f3ece6' ? '#0a0a0a' : '#fff', fontSize: 11, lineHeight: 14 }}>{p.text}</T>
            </LinearGradient>)}
          <View pointerEvents="none" style={{ position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="play" size={12} color="#fff" /><T h style={{ color: '#fff', fontSize: 11, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>{kfmt(p.views)}</T></View>
          {p.status === 'frozen' ? <View pointerEvents="none" style={{ position: 'absolute', top: 6, right: 6 }}><Ionicons name="snow" size={14} color="#fff" /></View> : null}
        </Pressable>))}
    </View>
  );
}

function Reel({ p, h, active }) {
  const { s, C, nav, run } = useApp(); const u = s.users[p.userId] || {}; const frozen = p.status === 'frozen'; const mine = p.userId === s.me;
  const playerRef = useRef(null); const [ended, setEnded] = useState(false); const [paused, setPaused] = useState(false);
  const icon = useRef(new Animated.Value(0)).current; const burst = useRef(new Animated.Value(0)).current; const lastTap = useRef(0); const tapTimer = useRef(null);
  useEffect(() => {
    const pl = playerRef.current; if (!pl) return;
    try { if (active) { pl.currentTime = (p.overlay && p.overlay.trimStart) || 0; pl.play(); setEnded(false); setPaused(false); } else { pl.pause(); } } catch (e) {}
  }, [active]);
  const flash = () => { icon.setValue(1); Animated.timing(icon, { toValue: 0, duration: 700, delay: 250, useNativeDriver: true }).start(); };
  const heat = () => { if (!p.myHeat) run(() => act.react(p.id, 'heat'), { optimistic: { post: p.id, patch: { myHeat: true, heat: p.heat + 1 } } }); };
  const togglePlay = () => {
    const pl = playerRef.current; if (!pl) return;
    if (ended) { pl.currentTime = (p.overlay && p.overlay.trimStart) || 0; pl.play(); setEnded(false); setPaused(false); return; }
    if (paused) { pl.play(); setPaused(false); } else { pl.pause(); setPaused(true); }
    flash();
  };
  // one tap pauses or plays, a double tap heats
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) { clearTimeout(tapTimer.current); heat(); burst.setValue(0); Animated.sequence([Animated.spring(burst, { toValue: 1, useNativeDriver: true }), Animated.timing(burst, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true })]).start(); }
    else tapTimer.current = setTimeout(togglePlay, 280);
    lastTap.current = now;
  };
  const Rail = ({ icon: ic, n, on, onColor, onPress, label, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} accessibilityState={{ selected: !!on }} hitSlop={6} style={{ alignItems: 'center', gap: 2, opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={ic} size={31} color={on ? onColor || C.orange : '#fff'} style={{ textShadowColor: 'rgba(0,0,0,.45)', textShadowRadius: 6 }} />
      {n !== undefined ? <T h style={{ color: '#fff', fontSize: 12.5, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>{kfmt(n)}</T> : null}
    </Pressable>);
  return (
    <View style={{ height: h, backgroundColor: '#0a0a0a' }}>
      <Pressable onPress={tap} style={{ flex: 1, opacity: frozen ? 0.5 : 1 }}>
        {p.mediaUrl ? <View pointerEvents="none" style={{ flex: 1 }}><Video uri={p.mediaUrl} style={{ flex: 1 }} controls={false} autoPlay={active} loop playerRef={playerRef} trim={p.overlay} /></View>
          : <TextReel p={p} active={active} />}
        <ReplayOverlay overlay={p.overlay} />
      </Pressable>
      {p.mediaUrl ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: '44%', alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,.4)', alignItems: 'center', justifyContent: 'center',
        opacity: paused || ended ? 1 : icon, transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        <Ionicons name={ended ? 'refresh' : paused ? 'play' : 'pause'} size={34} color="#fff" /></Animated.View> : null}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: '38%', alignSelf: 'center', opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        <Ionicons name="flame" size={130} color={C.orange} /></Animated.View>
      <View style={{ position: 'absolute', left: 16, right: 78, bottom: 22, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => nav.push('profile', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar u={u} size={36} /><T h style={{ color: '#fff' }}>{u.handle}</T></Pressable>
          {!mine && !u.following ? <Pressable onPress={() => run(() => act.follow(u.id, false, s.me))} style={{ borderWidth: 1.5, borderColor: 'rgba(255,255,255,.7)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <T h style={{ color: '#fff', fontSize: 12.5 }}>Follow</T></Pressable> : null}
        </View>
        {p.text && p.mediaUrl ? <RichText text={p.text} style={{ color: '#fff', fontFamily: F.bold }} onTag={(t) => nav.tab('search', { q: t })} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="play" size={12} color="rgba(255,255,255,.8)" /><T b style={{ color: 'rgba(255,255,255,.8)', fontSize: 12.5 }}>{kfmt(p.views)} views</T></View>
      </View>
      <View style={{ position: 'absolute', right: 12, bottom: 22, gap: 18, alignItems: 'center' }}>
        <Rail icon={p.myHeat ? 'flame' : 'flame-outline'} n={p.heat} on={p.myHeat} label="Heat" onPress={heat} />
        <Rail icon="snow" n={p.freeze} on={p.myFreeze} onColor="#9fdcff" label="Freeze" onPress={() => !p.myFreeze && run(() => act.react(p.id, 'freeze'), { optimistic: { post: p.id, patch: { myFreeze: true, freeze: p.freeze + 1 } } })} />
        <Rail icon="chatbubble-ellipses-outline" n={p.comments.length} label={frozen ? 'Comments are off while frozen' : 'Comments'} disabled={frozen} onPress={() => nav.sheet('comments', { id: p.id })} />
        <Rail icon="repeat" n={p.reposts} on={p.myRepost} onColor="#4ade80" label={p.myRepost ? 'Undo repost' : 'Repost'} disabled={mine}
          onPress={() => run(() => act.repost(p.id, p.myRepost, s.me), { toast: p.myRepost ? 'Repost removed' : 'Reposted to your profile', optimistic: { post: p.id, patch: { myRepost: !p.myRepost, reposts: p.reposts + (p.myRepost ? -1 : 1) } } })} />
        <Rail icon="paper-plane-outline" label="Send" onPress={() => nav.sheet('share', { post: p })} />
        <Rail icon={p.saved ? 'bookmark' : 'bookmark-outline'} on={p.saved} onColor="#ffd60a" label="Save" onPress={() => run(() => act.save(p.id, p.saved, s.me), { optimistic: { post: p.id, patch: { saved: !p.saved } } })} />
      </View>
    </View>
  );
}
const REEL_SETS = [['#ff5500', '#ff8a2b'], ['#0a0a0a', '#ff5c0a'], ['#f3ece6', '#ff8a2b'], ['#120904', '#ff5500']];
function TextReel({ p, active }) {
  const words = String(p.text || '').split(/\s+/).filter(Boolean);
  const [n, setN] = useState(active ? 0 : words.length);
  useEffect(() => { if (!active) { setN(words.length); return; } setN(0); let i = 0; const t = setInterval(() => { i++; setN(i); if (i >= words.length) clearInterval(t); }, 260); return () => clearInterval(t); }, [active]);
  const cols = REEL_SETS[(p.seed || 1) % REEL_SETS.length]; const dark = cols[0] === '#f3ece6';
  return (
    <LinearGradient colors={cols} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, justifyContent: 'center', padding: 28 }}>
      <T d style={{ color: dark ? '#0a0a0a' : '#fff', fontSize: 34, lineHeight: 40, letterSpacing: -1.5 }}>{words.slice(0, n).join(' ')}</T>
    </LinearGradient>
  );
}

/* ---------------- search ---------------- */
export function SearchScreen({ q: q0 }) {
  const { s, C, nav, run } = useApp(); const ins = useSafeAreaInsets();
  const [q, setQ] = useState(q0 || ''); useEffect(() => { if (q0 !== undefined) setQ(q0); }, [q0]);
  const k = q.trim().toLowerCase().replace(/^@/, '');
  const users = k ? Object.values(s.users).filter((u) => u.id !== s.me && !s.blocked[u.id] && ((u.name || '').toLowerCase().includes(k) || (u.handle || '').includes(k))) : [];
  const posts = k ? s.posts.filter((p) => !s.blocked[p.userId] && (p.text || '').toLowerCase().includes(q.trim().toLowerCase())) : [];
  const trending = useMemo(() => { const t = {}; s.posts.forEach((p) => ((p.text || '').match(/#\w+/g) || []).forEach((x) => (t[x] = (t[x] || 0) + 1 + p.heat))); return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 8); }, [s.posts]);
  const board = Object.values(s.users).filter((u) => !s.blocked[u.id]).map((u) => ({ u, d: tempOf(s.week[u.id]) })).sort((a, b) => b.d - a.d).slice(0, 5);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 16, height: 46 }}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search Temp" placeholderTextColor={C.muted} autoCapitalize="none" style={{ flex: 1, color: C.ink, fontFamily: F.bold, fontSize: 15 }} />
          {q ? <Pressable onPress={() => setQ('')} accessibilityLabel="Clear"><Ionicons name="close" size={18} color={C.muted} /></Pressable> : null}
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        {!k ? <>
          <T d style={{ fontSize: 13, marginTop: 10, marginBottom: 6 }}>Hottest this week</T>
          <View style={{ backgroundColor: C.card, borderRadius: 26, paddingHorizontal: 14, paddingVertical: 4 }}>
            {board.map(({ u, d }, i) => (
              <Pressable key={u.id} onPress={() => nav.push('profile', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <T d style={{ width: 18, textAlign: 'center' }}>{i + 1}</T><Avatar u={u} size={40} />
                <View style={{ flex: 1 }}><T h numberOfLines={1}>{u.name}</T>
                  <View style={{ height: 6, borderRadius: 3, marginTop: 6, width: Math.max(8, Math.min(100, ((d - 32) / 180) * 100)) + '%', backgroundColor: C.orange }} /></View>
                <T d style={{ fontSize: 14 }}>{d}°</T></Pressable>))}
          </View>
          {trending.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {trending.map(([t, n]) => <Pressable key={t} onPress={() => setQ(t)} style={{ backgroundColor: C.card, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
              <T h>{t} <T muted style={{ fontSize: 12 }}>{n}</T></T></Pressable>)}</View> : null}
        </> : <>
          {users.length ? <View style={{ backgroundColor: C.card, borderRadius: 26, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 10 }}>
            {users.map((u) => <UserRow key={u.id} u={u} />)}</View> : null}
          {posts.some((p) => p.reel) ? <View style={{ marginBottom: 10 }}><ReplayGrid posts={posts.filter((p) => p.reel)} /></View> : null}
          {posts.filter((p) => !p.reel).map((p) => <PostCard key={p.id} p={p} />)}
          {!users.length && !posts.length ? <Empty text={'No results for “' + q + '”'} /> : null}
        </>}
      </ScrollView>
    </View>
  );
}
export function UserRow({ u, right }) {
  const { s, C, nav, run } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
      <Pressable onPress={() => nav.push('profile', { id: u.id })}><Avatar u={u} size={46} /></Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => nav.push('profile', { id: u.id })}><T h numberOfLines={1}>{u.name}</T><T muted numberOfLines={1} style={{ fontSize: 13 }}>@{u.handle} · {kfmt(u.followers)} followers</T></Pressable>
      {right !== undefined ? right : u.id !== s.me ? <Btn small kind={u.following ? 'ghost' : 'orange'} title={u.following ? 'Following' : u.followsMe ? 'Follow back' : 'Follow'} onPress={() => run(() => act.follow(u.id, u.following, s.me))} /> : null}
    </View>
  );
}

/* ---------------- activity ---------------- */
const GROUPS = { social: ['follow', 'heat', 'freeze', 'viral', 'storyReact', 'repost'], comments: ['mention', 'likeComment', 'reply', 'comment', 'storyComment'] };
export function ActivityScreen() {
  const { s, C, nav } = useApp(); const [tab, setTab] = useState('social');
  useEffect(() => { const t = setTimeout(() => act.readNotifs(s.me, GROUPS[tab]), 1200); return () => clearTimeout(t); }, [tab]);
  const list = s.notifs.filter((n) => !s.blocked[n.userId] && GROUPS[tab].includes(n.type));
  const unread = (k) => s.notifs.filter((n) => !n.read && GROUPS[k].includes(n.type)).length;
  const text = (n) => ({ follow: 'started following you', mention: 'mentioned you: ' + n.text, likeComment: 'liked your comment: ' + n.text, reply: 'replied: ' + n.text, comment: 'commented: ' + n.text,
    heat: 'heated your post: ' + n.text, freeze: 'froze your post: ' + n.text, viral: 'Your take went viral. ' + n.text,
    storyComment: 'commented on your story: ' + n.text, repost: 'reposted your post: ' + n.text, storyReact: 'reacted ' + n.text + ' to your story' }[n.type] || n.text);
  const icon = { repost: 'repeat', storyComment: 'chatbubble', storyReact: 'heart', follow: 'person-add', mention: 'at', likeComment: 'heart', reply: 'chatbubble', comment: 'chatbubble', heat: 'flame', freeze: 'snow', viral: 'flame' };
  const Seg = ({ k, label }) => (
    <Pressable onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 999, backgroundColor: tab === k ? C.ink : 'transparent', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      <T h style={{ color: tab === k ? C.bg : C.muted, fontSize: 14 }}>{label}</T>
      {unread(k) ? <View style={{ backgroundColor: C.orange, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><T h style={{ color: '#fff', fontSize: 11 }}>{unread(k)}</T></View> : null}
    </Pressable>);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Activity" back />
      <View style={{ paddingHorizontal: 16 }}><View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 999, padding: 4 }}><Seg k="social" label="Heat & follows" /><Seg k="comments" label="Comments" /></View></View>
      <FlatList showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" data={list} keyExtractor={(n) => String(n.id)} contentContainerStyle={{ padding: 16, paddingBottom: 110 }} ListEmptyComponent={<Empty text="Nothing yet" />}
        renderItem={({ item: n }) => { const u = s.users[n.userId] || {}; return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.card, borderRadius: 20, marginBottom: 6 }}>
            <Pressable onPress={() => nav.push('profile', { id: u.id })}><Avatar u={u} size={44} />
              <View style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 7, backgroundColor: C.orange, borderWidth: 2, borderColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon[n.type] || 'notifications'} size={10} color="#fff" /></View></Pressable>
            <T style={{ flex: 1, fontSize: 14.5 }}>{n.type === 'viral' ? null : <T h style={{ fontSize: 14.5 }}>{u.handle} </T>}{text(n)} <T muted style={{ fontSize: 13 }}>{ago(Date.now() - n.at)}</T></T>
            {!n.read ? <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: C.orange }} /> : null}
          </View>); }} />
    </View>
  );
}

/* ---------------- messages ---------------- */
export function DMListScreen() {
  const { s, C, nav } = useApp();
  const ids = Object.keys(s.threads).filter((id) => !s.blocked[id] && s.threads[id].length).sort((a, b) => s.threads[b].slice(-1)[0].at - s.threads[a].slice(-1)[0].at);
  const others = Object.values(s.users).filter((u) => u.id !== s.me && !s.blocked[u.id] && !ids.includes(u.id)).slice(0, 30);
  const last = (m) => m.postId || m.snap ? (m.from === s.me ? 'You sent a post' : 'Sent a post') : (m.from === s.me ? 'You: ' : '') + (m.sticker ? stickerLabel(m.sticker) : m.text);
  const Row = ({ u, sub, unread }) => (
    <Pressable onPress={() => nav.push('thread', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Avatar u={u} size={52} /><View style={{ flex: 1 }}><T h numberOfLines={1}>{u.name}</T><T numberOfLines={1} muted={!unread} b={unread} style={{ fontSize: 14 }}>{sub}</T></View>
      {unread ? <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: C.orange }} /> : null}
    </Pressable>);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Messages" back />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        {ids.length ? <View style={{ backgroundColor: C.card, borderRadius: 26, paddingHorizontal: 14 }}>
          {ids.map((id) => { const m = s.threads[id].slice(-1)[0]; return <Row key={id} u={s.users[id]} sub={last(m) + ' · ' + ago(Date.now() - m.at)} unread={s.unread[id]} />; })}</View> : null}
        {others.length ? <><T d style={{ fontSize: 13, marginTop: 20, marginBottom: 6 }}>Suggested</T>
          <View style={{ backgroundColor: C.card, borderRadius: 26, paddingHorizontal: 14 }}>{others.map((u) => <Row key={u.id} u={u} sub={'@' + u.handle} />)}</View></> : null}
        {!ids.length && !others.length ? <Empty text="No one to message yet" /> : null}
      </ScrollView>
    </View>
  );
}
export function ThreadScreen({ id }) {
  const { s, C, nav, run, reload } = useApp(); const u = s.users[id] || {}; const ins = useSafeAreaInsets();
  const [t, setT] = useState(''); const [pick, setPick] = useState(false); const [gif, setGif] = useState(false); const list = useRef(null);
  const msgs = s.threads[id] || [];
  useEffect(() => { act.read(id, s.me); }, [id, msgs.length]);
  const lastMine = [...msgs].reverse().find((m) => m.from === s.me);
  const seen = lastMine && s.seenBy[id] && s.seenBy[id] >= lastMine.at && msgs[msgs.length - 1] === lastMine;
  const send = () => { if (!t.trim()) return; const v = t.trim(); setT(''); run(() => act.dm(id, { text: v })); };
  const lastTap = useRef({});
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <Header back title={u.name} right={<Pressable onPress={() => nav.push('profile', { id })}><Avatar u={u} size={36} /></Pressable>} />
      <FlatList showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" ref={list} data={msgs} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: 16, gap: 4 }}
        onContentSizeChange={() => list.current && list.current.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Empty text={'Say hi to @' + u.handle} />}
        ListFooterComponent={seen ? <T b muted style={{ alignSelf: 'flex-end', fontSize: 12, marginTop: 2 }}>Seen</T> : null}
        renderItem={({ item: m }) => {
          const mine = m.from === s.me;
          const dbl = () => { const n = Date.now(); if (n - (lastTap.current[m.id] || 0) < 280) run(() => act.reactMsg(m)); lastTap.current[m.id] = n; };
          if (m.postId || m.snap) {
            const live = s.posts.find((x) => x.id === m.postId); const p = live ? { userId: live.userId, text: live.text, media: live.mediaUrl ? { type: live.mediaType, url: live.mediaUrl } : null } : m.snap;
            if (!p) return null;
            return <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', width: '75%', backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', marginVertical: 2 }}>
              {p.media && p.media.type !== 'video' ? <Image source={{ uri: p.media.url }} style={{ width: '100%', height: 180 }} /> : null}
              {p.media && p.media.type === 'video' ? <Video uri={p.media.url} style={{ width: '100%', height: 200 }} /> : null}
              <View style={{ padding: 12 }}><T h muted style={{ fontSize: 12 }}>@{(s.users[p.userId] || {}).handle}{!live ? ' · gone from the timeline' : ''}</T>{p.text ? <T>{p.text}</T> : null}</View></View>;
          }
          return <>
            {m.note ? <T b muted style={{ fontSize: 12, alignSelf: mine ? 'flex-end' : 'flex-start', marginHorizontal: 6 }}>{m.note}</T> : null}
            <Pressable onPress={dbl} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', marginBottom: m.react ? 12 : 0 }}>
              {m.sticker ? <View style={{ padding: 4 }}><Sticker v={m.sticker} size={58} /></View>
                : <View style={{ backgroundColor: mine ? C.orange : C.card, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 15 }}><T style={{ color: mine ? '#fff' : C.ink }}>{m.text}</T></View>}
              {m.react ? <T style={{ position: 'absolute', bottom: -12, [mine ? 'left' : 'right']: 8, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 5, fontSize: 13, overflow: 'hidden' }}>{m.react}</T> : null}
            </Pressable></>;
        }} />
      <View style={{ paddingHorizontal: 16, paddingBottom: ins.bottom + 8, paddingTop: 6 }}>
        {pick ? <StickerPicker onPick={(e) => { setPick(false); run(() => act.dm(id, { sticker: e })); }} /> : null}
        {gif ? <GifPicker onClose={() => setGif(false)} onPick={(g) => { setGif(false); run(() => act.dm(id, { sticker: 'G|' + g.url })); }} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: C.card, borderRadius: 999, paddingLeft: 16, padding: 4 }}>
          <TextInput value={t} onChangeText={setT} placeholder="Message…" placeholderTextColor={C.muted} onSubmitEditing={send} returnKeyType="send" style={{ flex: 1, color: C.ink, fontFamily: F.body, fontSize: 15, paddingVertical: 10 }} />
          <Pressable onPress={() => { setGif(!gif); setPick(false); }} accessibilityLabel="GIFs" style={{ paddingHorizontal: 6, paddingVertical: 8 }}><T h style={{ color: gif ? C.orange : C.muted, fontSize: 12 }}>GIF</T></Pressable>
          <Pressable onPress={() => setPick(!pick)} accessibilityLabel="Stickers" style={{ padding: 8 }}><Ionicons name="happy-outline" size={22} color={C.muted} /></Pressable>
          <Pressable onPress={send} disabled={!t.trim()} accessibilityLabel="Send" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', opacity: t.trim() ? 1 : 0.3 }}>
            <Ionicons name="paper-plane" size={17} color="#fff" /></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
