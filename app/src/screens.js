import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, FlatList, Pressable, TextInput, Image, ScrollView, RefreshControl, PanResponder, ActivityIndicator, Dimensions, Modal, Animated, Easing, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, FlowBox, T, Btn, IconBtn, Avatar, StoryOrb, Thermo, Sticker, StickerPicker, Sheet, Empty, Timer, stickerLabel } from './ui';
import { PostCard, Video, RichText, useVideoTaps } from './posts';
import { VoiceBubble, useVoiceRecorder, fmtSec } from './voice';
import { act } from './data';
import { ReplayOverlay } from './recorder';
import { useLiveNow } from './live';
import { GifPicker } from './gif';
import { GoLiveSide } from './live';
import { sb, ago, kfmt, F, THEMES, tempOf, upload, friendly } from './lib';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function pickMedia(kind = 'all') {
  const types = kind === 'image' ? ['images'] : kind === 'video' ? ['videos'] : ['images', 'videos'];
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: types, quality: 0.85, videoMaxDuration: 180 });
  if (r.canceled || !r.assets || !r.assets[0]) return null;
  return r.assets[0];
}

export function Header({ title, back, right, sub, onBack }) {
  const { C, nav } = useApp(); const ins = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: ins.top + 8, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {back ? <IconBtn name="chevron-back" label="Back" onPress={onBack || nav.back} /> : null}
      {title ? <View style={{ flex: 1 }}><T d numberOfLines={1} style={{ fontSize: 19, letterSpacing: -0.6 }}>{title}</T>{sub ? <T b style={{ fontSize: 12.5, color: C.orange }}>{sub}</T> : null}</View> : <View style={{ flex: 1 }} />}
      {right}
    </View>
  );
}

/* ---------------- side menu (tap your picture), with accounts on this phone ---------------- */
const ACC_KEY = 'temp-accounts';
export async function accList() { try { return JSON.parse((await AsyncStorage.getItem(ACC_KEY)) || '[]'); } catch (e) { return []; } }
export async function accRemember(ses, prof) { if (!ses || !ses.user) return; const l = await accList(); const old = l.find((a) => a.id === ses.user.id) || {};
  const next = [{ ...old, id: ses.user.id, rt: ses.refresh_token, ...(prof ? { handle: prof.handle, name: prof.name, avatar: prof.avatar || null, color: prof.color } : {}) }, ...l.filter((a) => a.id !== ses.user.id)].slice(0, 5);
  try { await AsyncStorage.setItem(ACC_KEY, JSON.stringify(next)); } catch (e) {} }
export async function accSwitch(a) { const { error } = await sb.auth.refreshSession({ refresh_token: a.rt });
  if (error) { const l = (await accList()).filter((x) => x.id !== a.id); await AsyncStorage.setItem(ACC_KEY, JSON.stringify(l)); throw new Error('That account was signed out. Add it again.'); } }
export function Drawer({ onClose, at }) {
  const { s, C, nav } = useApp(); const ins = useSafeAreaInsets(); const me = s.users[s.me] || {}; const W = Math.min(Dimensions.get('window').width * 0.84, 330);
  const k = useRef(new Animated.Value(0)).current; const [accts, setAccts] = useState([]); const [accOpen, setAccOpen] = useState(false);
  useEffect(() => { Animated.spring(k, { toValue: 1, damping: 20, stiffness: 300, useNativeDriver: true }).start(); accList().then(setAccts); }, []);
  const close = (then) => Animated.timing(k, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => { onClose(); then && then(); });
  const following = Object.values(s.users).filter((u) => u.following).length; const others = accts.filter((a) => a.id !== s.me);
  const sw = async (a) => { close(); try { await accSwitch(a); } catch (e) { nav.toast(e.message); } };
  const hasStory = s.stories.some((x) => x.userId === s.me);
  const items = [...(hasStory ? [['eye-outline', 'Your story', () => nav.sheet('story', { userId: s.me })]] : []), ['person-outline', 'Profile', () => nav.tab('me')], ['bookmark-outline', 'Saved', () => nav.push('profile', { id: s.me })], ['flame-outline', 'Fire Sale', () => nav.push('shop')], ['radio-outline', 'Live Takes', () => nav.tab('live')], ['rocket-outline', 'Creator Studio', () => nav.push('earnings')]];
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close()}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.18)', opacity: k }}><Pressable style={{ flex: 1 }} onPress={() => close()} /></Animated.View>
      <Animated.View style={{ position: 'absolute', left: (at && at.left) || 16, top: Math.max(ins.top + 10, Math.min((at && at.top) || ins.top + 80, Dimensions.get('window').height - 560)), width: Math.min(290, Dimensions.get('window').width - 32), backgroundColor: C.card, borderRadius: 26, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 25, shadowOffset: { width: 0, height: 14 }, elevation: 12,
        opacity: k, transform: [{ scale: k.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { translateY: k.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => close(() => nav.tab('me'))}><Avatar u={me} size={40} /></Pressable><View style={{ flex: 1 }} />
          {others.slice(0, 1).map((a) => <Pressable key={a.id} onPress={() => sw(a)} accessibilityLabel={'Switch to @' + a.handle}><Avatar u={{ name: a.name, avatar: a.avatar, color: a.color || C.orange }} size={30} /></Pressable>)}
          <Pressable onPress={() => setAccOpen(true)} accessibilityLabel="Accounts" style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.6, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="ellipsis-horizontal" size={16} color={C.ink} /></Pressable>
        </View>
        <T h style={{ fontSize: 17, marginTop: 8 }}>{me.name || 'You'}</T><T muted style={{ fontSize: 15 }}>@{me.handle}</T>
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 8, marginBottom: 4 }}><T muted><T h>{following}</T> Following</T><T muted><T h>{kfmt(me.followers || 0)}</T> Followers</T></View>
        {items.map(([ic, l, f]) => <Pressable key={l} onPress={() => close(f)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}><Ionicons name={ic} size={22} color={C.ink} /><T h style={{ fontSize: 17 }}>{l}</T></Pressable>)}
        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 10 }} />
        <Pressable onPress={() => close(() => nav.push('settings'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9 }}><Ionicons name="settings-outline" size={20} color={C.ink} /><T h style={{ fontSize: 15 }}>Settings and privacy</T></Pressable>
        <Pressable onPress={() => close(() => nav.push('terms'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9 }}><Ionicons name="help-circle-outline" size={20} color={C.ink} /><T h style={{ fontSize: 15 }}>Help Center</T></Pressable>
      </Animated.View>
      {accOpen ? <Sheet visible onClose={() => setAccOpen(false)} title="Accounts">
        {[{ id: s.me, handle: me.handle, name: me.name, avatar: me.avatar, color: me.color }, ...others].map((a) => (
          <Pressable key={a.id} onPress={() => (a.id === s.me ? setAccOpen(false) : (setAccOpen(false), sw(a)))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Avatar u={{ name: a.name, avatar: a.avatar, color: a.color || C.orange }} size={46} /><View style={{ flex: 1 }}><T h>{a.name || a.handle}</T><T muted>@{a.handle}</T></View>
            {a.id === s.me ? <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={16} color={C.onOrange} /></View> : null}
          </Pressable>))}
        <Pressable onPress={async () => { setAccOpen(false); close(); await sb.auth.signOut({ scope: 'local' }); }} style={{ paddingVertical: 14 }}><T h style={{ color: C.orange, fontSize: 16 }}>Add an account</T></Pressable>
      </Sheet> : null}
    </Modal>
  );
}

/* ---------------- home ---------------- */
export function HomeScreen() {
  const { s, C, nav, reload, run } = useApp(); const ins = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const posts = s.posts.filter((p) => !p.reel && !s.blocked[p.userId]);
  const unreadN = s.notifs.filter((n) => !n.read).length, unreadDM = Object.keys(s.unread).filter((k) => !s.blocked[k]).length;
  const viewed = useRef(new Set());
  const [onScreen, setOnScreen] = useState({});
  const onViewable = useRef(({ viewableItems }) => { setOnScreen(Object.fromEntries(viewableItems.map((v) => [v.item && v.item.id, 1]))); viewableItems.forEach((v) => { const id = v.item && v.item.id; if (id && !viewed.current.has(id)) { viewed.current.add(id); act.view(id); } }); }).current;
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
        extraData={onScreen} renderItem={({ item }) => <PostCard p={item} active={!!onScreen[item.id]} />} />
      <GoLiveSide />
    </View>
  );
}

/* ---------------- replay ---------------- */
// a live creator in the Replay feed: blurred backdrop, pulsing ring, tap anywhere to join
function LiveCard({ x, h, onOpen }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true })); l.start(); return () => l.stop(); }, []);
  const host = x.host || {}; const u = { id: x.host_id, name: host.name || host.handle || 'Someone', handle: host.handle, avatar: host.avatar_url };
  const ring = (d) => ({ position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: '#ff2d55',
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: d ? [0.5, 0] : [1, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: d ? [1.05, 1.5] : [0.85, 1.3] }) }] });
  return (
    <Pressable onPress={onOpen} style={{ height: h, backgroundColor: '#120604', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} accessibilityLabel={'Watch ' + u.name + ' live'}>
      {u.avatar ? <Image source={{ uri: u.avatar }} blurRadius={40} style={{ position: 'absolute', top: -40, left: -40, right: -40, bottom: -40, opacity: 0.6 }} /> : null}
      <LinearGradient colors={['rgba(255,85,0,.28)', 'rgba(0,0,0,.25)', 'rgba(0,0,0,.75)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={ring(0)} /><Animated.View style={ring(1)} />
        <View style={{ borderRadius: 70, borderWidth: 4, borderColor: '#ff2d55' }}><Avatar u={u} size={124} /></View>
      </View>
      <View style={{ backgroundColor: '#ff2d2d', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 12 }}><T h style={{ color: '#fff', fontSize: 11, letterSpacing: 1 }}>LIVE</T></View>
      <T d style={{ color: '#fff', fontSize: 26, letterSpacing: -1, marginTop: 8 }}>{u.name}</T>
      {x.title ? <T style={{ color: 'rgba(255,255,255,.9)', fontSize: 15, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>{x.title}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}><Ionicons name="eye-outline" size={14} color="rgba(255,255,255,.85)" /><T h style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>{x.watching} watching</T></View>
      <View style={{ position: 'absolute', bottom: 60 }}><Btn kind="orange" title="Watch LIVE" onPress={onOpen} /></View>
    </Pressable>
  );
}

export function ReplayScreen({ startId }) {
  const { s, C, nav } = useApp(); const ins = useSafeAreaInsets();
  const [H, setH] = useState(0); // exact page height, measured, so the next Replay never peeks in
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, d) => d.dx > 14 && Math.abs(d.dx) > Math.abs(d.dy) * 2,
    onPanResponderRelease: (e, d) => { if (d.dx > 70 || d.vx > 0.5) nav.leaveReplay(); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  const reels0 = s.posts.filter((p) => p.reel && !s.blocked[p.userId]);
  // live creators slot in after the 2nd Replay, then every 5 — like TikTok
  const lives = useLiveNow().filter((x) => !s.blocked[x.host_id]);
  const reels = React.useMemo(() => { const out = []; let li = 0;
    reels0.forEach((p, i) => { out.push(p); if (li < lives.length && (i === 1 || (i > 1 && (i - 1) % 5 === 0))) out.push({ id: 'live-' + lives[li].id, live: lives[li++] }); });
    if (!reels0.length) lives.forEach((l) => out.push({ id: 'live-' + l.id, live: l })); return out; }, [reels0, lives]);
  const startIndex = Math.max(0, reels.findIndex((p) => p.id === startId));
  const [active, setActive] = useState(startId || (reels[0] && reels[0].id));
  useEffect(() => { if (!active && reels[0]) setActive(reels[0].id); }, [reels.length]);
  useEffect(() => { if (startId) setActive(startId); }, [startId]);
  const onViewable = useRef(({ viewableItems }) => { const v = viewableItems[0]; if (v) { setActive(v.item.id); if (!v.item.live) act.view(v.item.id); } }).current;
  return (
    <View {...swipe.panHandlers} onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h && h !== H) setH(h); }} style={{ flex: 1, backgroundColor: '#000' }}>
      {H ? <FlatList key={'reels-' + (startId || 'top') + H} data={reels} keyExtractor={(p) => String(p.id)} pagingEnabled showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" snapToInterval={H} decelerationRate="fast"
        initialScrollIndex={reels.length ? startIndex : undefined} windowSize={3} maxToRenderPerBatch={2} initialNumToRender={2}
        getItemLayout={(_, i) => ({ length: H, offset: H * i, index: i })} onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListEmptyComponent={<View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}><T b style={{ color: '#fff' }}>No Replays yet. Tap + to post one.</T></View>}
        renderItem={({ item }) => item.live ? <LiveCard x={item.live} h={H} onOpen={() => nav.push('golive', { stream: item.live.id })} /> : <Reel p={item} h={H} active={item.id === active} />} /> : null}
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
        </Pressable>))}
    </View>
  );
}

function Reel({ p, h, active }) {
  const { s, C, nav, run } = useApp(); const u = s.users[p.userId] || {}; const frozen = false; const mine = p.userId === s.me;
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
  // one tap pauses or plays; double tap the middle heats, the sides skip 5s; hold for 2x
  const heatTap = () => { heat(); burst.setValue(0); Animated.sequence([Animated.spring(burst, { toValue: 1, useNativeDriver: true }), Animated.timing(burst, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true })]).start(); };
  const g = useVideoTaps(() => playerRef.current, { onSingle: togglePlay, onCenterDouble: heatTap });

  const Rail = ({ icon: ic, n, on, onColor, onPress, label, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} accessibilityState={{ selected: !!on }} hitSlop={6} style={{ alignItems: 'center', gap: 2, opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={ic} size={31} color={on ? onColor || C.orange : '#fff'} style={{ textShadowColor: 'rgba(0,0,0,.45)', textShadowRadius: 6 }} />
      {n !== undefined ? <T h style={{ color: '#fff', fontSize: 12.5, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>{kfmt(n)}</T> : null}
    </Pressable>);
  return (
    <View style={{ height: h, backgroundColor: '#0a0a0a' }}>
      <Pressable {...g.press} style={{ flex: 1, opacity: frozen ? 0.5 : 1 }}>
        {p.mediaUrl ? <View pointerEvents="none" style={{ flex: 1 }}><Video uri={p.mediaUrl} style={{ flex: 1 }} controls={false} autoPlay={active} loop playerRef={playerRef} trim={p.overlay} rate={p.overlay && p.overlay.speed} /></View>
          : <TextReel p={p} active={active} />}
        <ReplayOverlay overlay={p.overlay} />
      </Pressable>
      {p.mediaUrl ? <g.Overlay top={110} /> : null}
      {p.mediaUrl ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: '44%', alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,.4)', alignItems: 'center', justifyContent: 'center',
        opacity: paused || ended ? 1 : icon, transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        <Ionicons name={ended ? 'refresh' : paused ? 'play' : 'pause'} size={34} color="#fff" /></Animated.View> : null}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: '38%', alignSelf: 'center', opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        <Ionicons name="flame" size={130} color={C.orange} /></Animated.View>
      <View style={{ position: 'absolute', left: 16, right: 78, bottom: 22, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => nav.push('profile', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar u={u} size={36} /><T h style={{ color: '#fff' }}>{u.handle}</T></Pressable>
          {!mine && !u.following ? <Pressable onPress={() => run(() => act.follow(u.id, false, s.me))} style={{ borderWidth: 1.5, borderColor: 'rgba(255,255,255,.7)', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 5 }}>
            <T h style={{ color: '#fff', fontSize: 12.5 }}>Follow</T></Pressable> : null}
        </View>
        {p.text && p.mediaUrl ? <RichText text={p.text} style={{ color: '#fff', fontFamily: F.bold }} onTag={(t) => nav.tab('search', { q: t })} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="play" size={12} color="rgba(255,255,255,.8)" /><T b style={{ color: 'rgba(255,255,255,.8)', fontSize: 12.5 }}>{kfmt(p.views)} views</T></View>
      </View>
      <View style={{ position: 'absolute', right: 12, bottom: 22, gap: 18, alignItems: 'center' }}>
        <Rail icon={p.myHeat ? 'flame' : 'flame-outline'} n={p.heat} on={p.myHeat} label="Heat" onPress={heat} />
        <Rail icon="chatbubble-ellipses-outline" n={p.comments.length} label={frozen ? 'Comments are off while frozen' : 'Comments'} disabled={frozen} onPress={() => nav.sheet('comments', { id: p.id })} />
        <Rail icon="flame-outline" n={p.reposts} on={p.myRepost} label={p.myRepost ? 'Undo reflame' : 'Reflame'} onPress={() => nav.sheet('reflame', { post: p })} />
        <Rail icon="paper-plane-outline" label="Send" onPress={() => nav.sheet('share', { post: p })} />
        <Rail icon={p.saved ? 'bookmark' : 'bookmark-outline'} on={p.saved} onColor="#ffd60a" label="Save" onPress={() => run(() => act.save(p.id, p.saved, s.me), { optimistic: { post: p.id, patch: { saved: !p.saved } } })} />
        <Rail icon="ellipsis-horizontal" label="More" onPress={() => nav.sheet('menu', { post: p })} />
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
        <FlowBox r={15} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, paddingHorizontal: 16, height: 46 }}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search Temp" placeholderTextColor={C.muted} autoCapitalize="none" style={{ flex: 1, color: C.ink, fontFamily: F.bold, fontSize: 15 }} />
          {q ? <Pressable onPress={() => setQ('')} accessibilityLabel="Clear"><Ionicons name="close" size={18} color={C.muted} /></Pressable> : null}
        </FlowBox>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        {!k ? <>
          <T d style={{ fontSize: 13, marginTop: 10, marginBottom: 6 }}>Hottest this week</T>
          <FlowBox r={26} style={{ backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 4 }}>
            {board.map(({ u, d }, i) => (
              <Pressable key={u.id} onPress={() => nav.push('profile', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <T d style={{ width: 18, textAlign: 'center' }}>{i + 1}</T><Avatar u={u} size={40} />
                <View style={{ flex: 1 }}><T h numberOfLines={1}>{u.name}</T>
                  <View style={{ height: 6, borderRadius: 3, marginTop: 6, width: Math.max(8, Math.min(100, ((d - 32) / 180) * 100)) + '%', backgroundColor: C.orange }} /></View>
                <T d style={{ fontSize: 14 }}>{d}°</T></Pressable>))}
          </FlowBox>
          {trending.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {trending.map(([t, n]) => <Pressable key={t} onPress={() => setQ(t)} style={{ backgroundColor: C.card, borderRadius: 15, paddingVertical: 9, paddingHorizontal: 14 }}>
              <T h>{t} <T muted style={{ fontSize: 12 }}>{n}</T></T></Pressable>)}</View> : null}
        </> : <>
          {users.length ? <FlowBox r={26} style={{ backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 10 }}>
            {users.map((u) => <UserRow key={u.id} u={u} />)}</FlowBox> : null}
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
const GROUPS = { social: ['follow', 'heat', 'freeze', 'viral', 'saved', 'burned', 'storyReact', 'repost', 'reflame', 'quote'], comments: ['mention', 'likeComment', 'reply', 'comment', 'storyComment'] };
export function ActivityScreen() {
  const { s, C, nav, run } = useApp(); const [tab, setTab] = useState('social'); const [seenNow, setSeenNow] = useState({});
  // tapping one opens what it's about and marks only that one as seen; it stays in the list until newer ones push it out
  const markSeen = (n) => { if (n.read || seenNow[n.id]) return; setSeenNow((x) => ({ ...x, [n.id]: 1 })); run(() => act.readNotif(s.me, n.id)); };
  const go = (n) => { markSeen(n); const p = n.postId && s.posts.find((x) => x.id === n.postId);
    if (n.type === 'storyComment' || n.type === 'storyReact') return nav.sheet('story', { userId: s.me });
    if (p && p.reel) return nav.tab('replay', { startId: p.id });
    if (p) { nav.push('post', { id: p.id }); if (GROUPS.comments.includes(n.type)) setTimeout(() => nav.sheet('comments', { id: p.id }), 250); return; }
    if (n.userId) nav.push('profile', { id: n.userId }); };
  const list = s.notifs.filter((n) => !s.blocked[n.userId] && GROUPS[tab].includes(n.type)).slice(0, 60).map((n) => (seenNow[n.id] ? { ...n, read: true } : n));
  const unread = (k) => s.notifs.filter((n) => !n.read && GROUPS[k].includes(n.type)).length;
  const text = (n) => ({ follow: 'started following you', mention: 'mentioned you: ' + n.text, likeComment: 'liked your comment: ' + n.text, reply: 'replied: ' + n.text, comment: 'commented: ' + n.text,
    heat: 'heated your post: ' + n.text, freeze: 'froze your post: ' + n.text, viral: 'Your take stayed hot for a day: ' + n.text, saved: 'Your take survived the freeze: ' + n.text, burned: 'Your take froze out and burned off the timeline: ' + n.text,
    storyComment: 'commented on your story: ' + n.text, repost: 'reflamed your take: ' + n.text, reflame: 'reflamed your take: ' + n.text, quote: 'quoted your take: ' + n.text, storyReact: 'reacted ' + n.text + ' to your story' }[n.type] || n.text);
  const icon = { repost: 'flame', reflame: 'flame', quote: 'chatbubble', storyComment: 'chatbubble', storyReact: 'heart', follow: 'person-add', mention: 'at', likeComment: 'heart', reply: 'chatbubble', comment: 'chatbubble', heat: 'flame', freeze: 'snow', viral: 'flame', saved: 'flame', burned: 'snow' };
  const Seg = ({ k, label }) => (
    <Pressable onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 15, backgroundColor: tab === k ? C.ink : 'transparent', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      <T h style={{ color: tab === k ? C.bg : C.muted, fontSize: 14 }}>{label}</T>
      {unread(k) ? <View style={{ backgroundColor: C.orange, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><T h style={{ color: C.onOrange, fontSize: 11 }}>{unread(k)}</T></View> : null}
    </Pressable>);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Activity" back />
      <View style={{ paddingHorizontal: 16 }}><FlowBox r={15} style={{ flexDirection: 'row', backgroundColor: C.card, padding: 4 }}><Seg k="social" label="Heat & follows" /><Seg k="comments" label="Comments" /></FlowBox>
        {list.some((n) => !n.read) ? <Pressable onPress={() => { const ids = {}; list.forEach((n) => { ids[n.id] = 1; }); setSeenNow((x) => ({ ...x, ...ids })); run(() => act.readNotifs(s.me, GROUPS[tab])); }} style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 }}><T b muted style={{ fontSize: 13 }}>Mark all as seen</T></Pressable> : null}</View>
      <FlatList showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" data={list} keyExtractor={(n) => String(n.id)} contentContainerStyle={{ padding: 16, paddingBottom: 110 }} ListEmptyComponent={<Empty text="Nothing yet" />}
        renderItem={({ item: n }) => { const u = s.users[n.userId] || {}; return (
          <Pressable onPress={() => go(n)}><FlowBox r={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.card, marginBottom: 6 }}>
            <Pressable onPress={() => { markSeen(n); nav.push('profile', { id: u.id }); }}><Avatar u={u} size={44} />
              <View style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 7, backgroundColor: C.orange, borderWidth: 2, borderColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon[n.type] || 'notifications'} size={10} color={C.onOrange} /></View></Pressable>
            <T style={{ flex: 1, fontSize: 14.5 }}>{n.type === 'viral' ? null : <T h style={{ fontSize: 14.5 }} onPress={() => u.id && nav.push('profile', { id: u.id })} accessibilityRole="link">{u.handle} </T>}{text(n)} <T muted style={{ fontSize: 13 }}>{ago(Date.now() - n.at)}</T></T>
            {!n.read ? <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: C.orange }} /> : null}
          </FlowBox></Pressable>); }} />
    </View>
  );
}

// one take on its own page (opened from a notification)
export function PostScreen({ id }) {
  const { s, C } = useApp(); const p = s.posts.find((x) => x.id === id);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Take" back />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        {p && p.status !== 'gone' ? <PostCard p={p} active /> : <Empty text="This take has burned away." />}
      </ScrollView>
    </View>
  );
}

/* ---------------- messages ---------------- */
export function DMListScreen() {
  const { s, C, nav } = useApp();
  const ids = Object.keys(s.threads).filter((id) => !s.blocked[id] && s.threads[id].length).sort((a, b) => s.threads[b].slice(-1)[0].at - s.threads[a].slice(-1)[0].at);
  const others = Object.values(s.users).filter((u) => u.id !== s.me && !s.blocked[u.id] && !ids.includes(u.id)).slice(0, 30);
  const last = (m) => m.points ? (m.from === s.me ? 'You sent ' + kfmt(m.points) + ' pts' : 'Sent you ' + kfmt(m.points) + ' pts 🔥') : m.postId || m.snap ? (m.from === s.me ? 'You sent a post' : 'Sent a post') : (m.from === s.me ? 'You: ' : '') + (m.sticker ? stickerLabel(m.sticker) : m.text);
  const Row = ({ u, sub, unread }) => (
    <Pressable onPress={() => nav.push('thread', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Avatar u={u} size={52} /><View style={{ flex: 1 }}><T h numberOfLines={1}>{u.name}</T><T numberOfLines={1} muted={!unread} b={unread} style={{ fontSize: 14 }}>{sub}</T></View>
      {unread ? <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: C.orange }} /> : null}
    </Pressable>);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Messages" back />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        {ids.length ? <FlowBox r={26} style={{ backgroundColor: C.card, paddingHorizontal: 14 }}>
          {ids.map((id) => { const m = s.threads[id].slice(-1)[0]; return <Row key={id} u={s.users[id]} sub={last(m) + ' · ' + ago(Date.now() - m.at)} unread={s.unread[id]} />; })}</FlowBox> : null}
        {others.length ? <><T d style={{ fontSize: 13, marginTop: 20, marginBottom: 6 }}>Suggested</T>
          <FlowBox r={26} style={{ backgroundColor: C.card, paddingHorizontal: 14 }}>{others.map((u) => <Row key={u.id} u={u} sub={'@' + u.handle} />)}</FlowBox></> : null}
        {!ids.length && !others.length ? <Empty text="No one to message yet" /> : null}
      </ScrollView>
    </View>
  );
}
// three bouncing dots while the other person types
function TypingDots() {
  const { C } = useApp(); const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })); l.start(); return () => l.stop(); }, []);
  return <View accessibilityLabel="typing" style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 4, backgroundColor: C.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 }}>
    {[0, 1, 2].map((i) => { const o = i * 0.15; return <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted,
      transform: [{ translateY: a.interpolate({ inputRange: [0, o, o + 0.15, o + 0.3, 1], outputRange: [0, 0, -5, 0, 0] }) }] }} />; })}</View>;
}

// points sent in a chat: an orange card with the amount and an optional note
function PointsCard({ m, mine }) {
  const { C } = useApp();
  return (
    <FlowBox r={20} style={{ backgroundColor: mine ? C.orange : C.card, borderWidth: mine ? 0 : 2, borderColor: C.orange, paddingVertical: 12, paddingHorizontal: 16, minWidth: 150, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="flame" size={20} color={mine ? C.onOrange : C.orange} />
        <T d style={{ fontSize: 24, letterSpacing: -1, color: mine ? C.onOrange : C.ink }}>{kfmt(m.points)}</T>
        <T h style={{ color: mine ? C.onOrange : C.muted, fontSize: 13, marginTop: 6 }}>pts</T>
      </View>
      <T h style={{ fontSize: 12, color: mine ? C.onOrange : C.muted, opacity: 0.85 }}>{mine ? 'You sent points' : 'Sent you points'}</T>
      {m.text ? <T style={{ color: mine ? C.onOrange : C.ink, marginTop: 4 }}>{m.text}</T> : null}
    </FlowBox>
  );
}
function SendPointsSheet({ to, onClose }) {
  const { s, C, run, reload } = useApp(); const u = s.users[to] || {};
  const [amt, setAmt] = useState(25); const [custom, setCustom] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const bal = s.priv.points || 0; const n = custom ? Math.floor(+custom || 0) : amt;
  const send = async () => { if (busy || n < 1 || n > bal) return; setBusy(true);
    const ok = await run(() => act.sendPoints(to, n, note.trim()), { toast: 'Sent ' + kfmt(n) + ' points to @' + (u.handle || 'them') }); setBusy(false); if (ok) { reload && reload(); onClose(); } };
  return (
    <Sheet visible onClose={onClose} title="Send points">
      <View style={{ gap: 14, paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="flame" size={16} color={C.orange} /><T b muted>You have {kfmt(bal)} pts</T></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[10, 25, 50, 100, 250, 500].map((v) => <Pressable key={v} onPress={() => { setAmt(v); setCustom(''); }} accessibilityLabel={v + ' points'}
            style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 15, backgroundColor: !custom && amt === v ? C.orange : C.soft, opacity: v > bal ? 0.4 : 1 }}>
            <T h style={{ color: !custom && amt === v ? C.onOrange : C.ink }}>{v}</T></Pressable>)}
        </View>
        <TextInput value={custom} onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="Other amount" placeholderTextColor={C.muted}
          style={{ backgroundColor: C.soft, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, color: C.ink, fontFamily: F.bold, fontSize: 16 }} />
        <TextInput value={note} onChangeText={setNote} maxLength={140} placeholder="Add a note (optional)" placeholderTextColor={C.muted}
          style={{ backgroundColor: C.soft, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, color: C.ink, fontFamily: F.body, fontSize: 15 }} />
        <Btn kind="orange" title={busy ? 'Sending…' : n > bal ? 'Not enough points' : 'Send ' + kfmt(n || 0) + ' pts to @' + (u.handle || '')} disabled={busy || n < 1 || n > bal} onPress={send} />
      </View>
    </Sheet>
  );
}

export function ThreadScreen({ id }) {
  const [pts, setPts] = useState(false);
  const { s, C, nav, run, reload, typing, sendTyping } = useApp(); const u = s.users[id] || {}; const ins = useSafeAreaInsets();
  const isTyping = !!(typing && typing[id]);
  const [t, setT] = useState(''); const [pick, setPick] = useState(false); const [gif, setGif] = useState(false); const list = useRef(null);
  const msgs = s.threads[id] || [];
  useEffect(() => { act.read(id, s.me); }, [id, msgs.length]);
  const lastMine = [...msgs].reverse().find((m) => m.from === s.me);
  const seen = lastMine && s.seenBy[id] && s.seenBy[id] >= lastMine.at && msgs[msgs.length - 1] === lastMine;
  const send = () => { if (!t.trim()) return; const v = t.trim(); setT(''); run(() => act.dm(id, { text: v })); };
  const lastTap = useRef({});
  const [vsend, setVsend] = useState(false);
  const vr = useVoiceRecorder(async (asset, ms) => { setVsend(true); try { const url = await upload(s.me, asset); await run(() => act.dm(id, { audio: url, ms })); } catch (e) { nav.toast(friendly(e)); } setVsend(false); });
  // drag the chat sideways to peek at send times, like iMessage
  const shift = useRef(new Animated.Value(0)).current; const [peekLeft, setPeekLeft] = useState(false);
  const peek = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, d) => d.x0 > 40 && d.dx < -10 && Math.abs(d.dx) > Math.abs(d.dy) * 1.4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (e, d) => shift.setValue(Math.max(-72, Math.min(0, d.dx))),
    onPanResponderRelease: () => Animated.spring(shift, { toValue: 0, useNativeDriver: true, speed: 18 }).start(),
    onPanResponderTerminate: () => Animated.spring(shift, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  const clock = (at) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  // hidden until you drag the chat left, then the times slide in from the right edge
  const timeOp = shift.interpolate({ inputRange: [-72, -24, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' });
  const TimeTag = ({ at }) => <Animated.Text style={{ position: 'absolute', top: '50%', marginTop: -8, right: -76, width: 66, fontSize: 11.5, fontFamily: F.bold, color: C.muted, opacity: timeOp }}>{clock(at)}</Animated.Text>;
  const lastSeenAt = lastMine ? Math.max(lastMine.readAt || 0, s.seenBy[id] || 0) : 0;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <Header back title={u.name} sub={isTyping ? 'typing…' : null} right={<Pressable onPress={() => nav.push('profile', { id })}><Avatar u={u} size={36} /></Pressable>} />
      <View {...peek.panHandlers} style={{ flex: 1, overflow: 'hidden' }}>
      <FlatList showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" ref={list} data={msgs} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: 16, gap: 4 }}
        onContentSizeChange={() => list.current && list.current.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Empty text={'Say hi to @' + u.handle} />}
        ListFooterComponent={<>{lastMine && msgs[msgs.length - 1] === lastMine && !isTyping ? <T b muted style={{ alignSelf: 'flex-end', fontSize: 12, marginTop: 2 }}>{seen || lastMine.readAt ? 'Seen ' + clock(lastSeenAt) : 'Delivered'}</T> : null}{isTyping ? <TypingDots /> : null}</>}
        renderItem={({ item: m }) => {
          const mine = m.from === s.me;
          const dbl = () => { const n = Date.now(); if (n - (lastTap.current[m.id] || 0) < 280) run(() => act.reactMsg(m)); lastTap.current[m.id] = n; };
          if (m.postId || m.snap) {
            const live = s.posts.find((x) => x.id === m.postId); const p = live ? { userId: live.userId, text: live.text, media: live.mediaUrl ? { type: live.mediaType, url: live.mediaUrl } : null } : m.snap;
            if (!p) return null;
            return <Animated.View style={{ transform: [{ translateX: shift }] }}><TimeTag at={m.at} /><View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', width: '75%', backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', marginVertical: 2 }}>
              {p.media && p.media.type !== 'video' ? <Image source={{ uri: p.media.url }} style={{ width: '100%', height: 180 }} /> : null}
              {p.media && p.media.type === 'video' ? <Video uri={p.media.url} style={{ width: '100%', height: 200 }} /> : null}
              <View style={{ padding: 12 }}><T h muted style={{ fontSize: 12 }}>@{(s.users[p.userId] || {}).handle}{!live ? ' · gone from the timeline' : ''}</T>{p.text ? <T>{p.text}</T> : null}</View></View></Animated.View>;
          }
          return <Animated.View style={{ transform: [{ translateX: shift }] }}><TimeTag at={m.at} />
            {m.note ? <T b muted style={{ fontSize: 12, alignSelf: mine ? 'flex-end' : 'flex-start', marginHorizontal: 6 }}>{m.note}</T> : null}
            <Pressable onPress={dbl} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', marginBottom: m.react ? 12 : 0 }}>
              {m.points ? <PointsCard m={m} mine={mine} /> : m.audio ? <VoiceBubble url={m.audio} ms={m.ms} mine={mine} />
                : m.sticker ? <View style={{ padding: 4 }}><Sticker v={m.sticker} size={58} /></View>
                : <View style={{ backgroundColor: mine ? C.orange : C.card, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 15 }}><T style={{ color: mine ? C.onOrange : C.ink }}>{m.text}</T></View>}
              {m.react ? <T style={{ position: 'absolute', bottom: -12, [mine ? 'left' : 'right']: 8, backgroundColor: C.card, borderRadius: 15, paddingHorizontal: 5, fontSize: 13, overflow: 'hidden' }}>{m.react}</T> : null}
            </Pressable></Animated.View>;
        }} />
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: ins.bottom + 8, paddingTop: 6 }}>
        {pick ? <StickerPicker onPick={(e) => { setPick(false); run(() => act.dm(id, { sticker: e })); }} /> : null}
        {gif ? <GifPicker onClose={() => setGif(false)} onPick={(g) => { setGif(false); run(() => act.dm(id, { sticker: 'G|' + g.url })); }} /> : null}
        {vr.on || vsend ? <FlowBox r={15} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, backgroundColor: C.card, paddingLeft: 16, padding: 4, height: 48 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff2d2d' }} />
          <T h style={{ fontVariant: ['tabular-nums'] }}>{vsend ? 'Sending…' : fmtSec(vr.on.ms)}</T><T muted b style={{ flex: 1 }}>{vsend ? '' : 'Recording'}</T>
          {!vsend ? <><Pressable onPress={() => vr.stop(false)} accessibilityLabel="Cancel voice message" style={{ padding: 8 }}><Ionicons name="close" size={22} color={C.muted} /></Pressable>
            <Pressable onPress={() => vr.stop(true)} accessibilityLabel="Send voice message" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="paper-plane" size={17} color={C.onOrange} /></Pressable></> : null}
        </FlowBox> :
        <FlowBox r={15} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: C.card, paddingLeft: 16, padding: 4 }}>
          <TextInput value={t} onChangeText={(v) => { setT(v); if (v) sendTyping(id); }} placeholder="Message…" placeholderTextColor={C.muted} onSubmitEditing={send} returnKeyType="send" style={{ flex: 1, color: C.ink, fontFamily: F.body, fontSize: 15, paddingVertical: 10 }} />
          <Pressable onPress={() => { setGif(!gif); setPick(false); }} accessibilityLabel="GIFs" style={{ paddingHorizontal: 6, paddingVertical: 8 }}><T h style={{ color: gif ? C.orange : C.muted, fontSize: 12 }}>GIF</T></Pressable>
          <Pressable onPress={() => setPick(!pick)} accessibilityLabel="Stickers" style={{ padding: 8 }}><Ionicons name="happy-outline" size={22} color={C.muted} /></Pressable>
          {id !== 'temp' ? <Pressable onPress={() => setPts(true)} accessibilityLabel="Send points" style={{ padding: 6 }}><Ionicons name="flame-outline" size={22} color={C.muted} /></Pressable> : null}
          <Pressable onPress={t.trim() ? send : vr.start} accessibilityLabel={t.trim() ? 'Send' : 'Record a voice message'} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={t.trim() ? 'paper-plane' : 'mic'} size={t.trim() ? 17 : 19} color={C.onOrange} /></Pressable>
        </FlowBox>}
      </View>
      {pts ? <SendPointsSheet to={id} onClose={() => setPts(false)} /> : null}
    </KeyboardAvoidingView>
  );
}
