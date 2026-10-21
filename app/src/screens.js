import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, FlatList, Pressable, TextInput, Image, ScrollView, RefreshControl, ActivityIndicator, Dimensions, Modal, Animated, Easing, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, T, Btn, IconBtn, Avatar, StoryOrb, Thermo, Sticker, StickerPicker, Sheet, Empty, Timer, stickerLabel } from './ui';
import { PostCard, Video, RichText } from './posts';
import { act } from './data';
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
  const [uploading, setUploading] = useState(false);
  const addStory = async () => { const a = await pickMedia(); if (!a) return; setUploading(true); nav.toast('Uploading your story…'); await run(() => act.story(s.me, a), { toast: 'Your story is up' }); setUploading(false); };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, flex: 1 }}>
          <T d style={{ fontSize: 27, letterSpacing: -1.3 }}>temp</T><View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: C.orange, marginBottom: 6 }} /></View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn name="heart-outline" label="Activity" badge={unreadN || null} onPress={() => nav.push('activity')} />
          <IconBtn name="chatbubble-ellipses-outline" label="Messages" badge={unreadDM || null} onPress={() => nav.push('dms')} />
        </View>
      </View>
      <FlatList data={posts} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.orange} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}
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
export function ReplayScreen() {
  const { s, C, nav, run } = useApp();
  const H = Dimensions.get('window').height - 64 - useSafeAreaInsets().bottom;
  const reels = s.posts.filter((p) => p.reel && !s.blocked[p.userId]);
  const [active, setActive] = useState(reels[0] && reels[0].id);
  const onViewable = useRef(({ viewableItems }) => { const v = viewableItems[0]; if (v) { setActive(v.item.id); act.view(v.item.id); } }).current;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList data={reels} keyExtractor={(p) => String(p.id)} pagingEnabled showsVerticalScrollIndicator={false} snapToInterval={H} decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: H, offset: H * i, index: i })} onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListEmptyComponent={<View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}><T b style={{ color: '#fff' }}>No Replays yet. Tap + to post one.</T></View>}
        renderItem={({ item }) => <Reel p={item} h={H} active={item.id === active} />} />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: useSafeAreaInsets().top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
        <T d style={{ color: '#fff', fontSize: 22, letterSpacing: -1, flex: 1 }}>Replay</T>
        <IconBtn name="videocam-outline" color="#fff" label="New Replay" style={{ backgroundColor: 'rgba(255,255,255,.14)' }} onPress={() => nav.sheet('compose', { reel: true })} />
      </View>
    </View>
  );
}
function Reel({ p, h, active }) {
  const { s, C, nav, run } = useApp(); const u = s.users[p.userId] || {}; const frozen = p.status === 'frozen';
  const playerRef = useRef(null); const [ended, setEnded] = useState(false); const [paused, setPaused] = useState(false);
  useEffect(() => { const pl = playerRef.current; if (!pl) return; try { if (active) { pl.currentTime = 0; pl.play(); setEnded(false); setPaused(false); } else pl.pause(); } catch (e) {} }, [active]);
  const tap = () => { const pl = playerRef.current; if (!pl) return; if (ended) { pl.currentTime = 0; pl.play(); setEnded(false); return; } if (paused) { pl.play(); setPaused(false); } else { pl.pause(); setPaused(true); } };
  const Rail = ({ icon, n, on, onPress, label, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} style={{ alignItems: 'center', gap: 3, opacity: disabled ? 0.35 : 1 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: on ? (icon === 'snow' ? '#fff' : C.orange) : 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={23} color={on && icon === 'snow' ? '#000' : '#fff'} /></View>
      {n !== undefined ? <T h style={{ color: '#fff', fontSize: 12.5 }}>{kfmt(n)}</T> : null}
    </Pressable>);
  return (
    <View style={{ height: h, backgroundColor: '#0a0a0a' }}>
      <Pressable onPress={tap} style={{ flex: 1, opacity: frozen ? 0.5 : 1 }}>
        {p.mediaUrl ? <Video uri={p.mediaUrl} style={{ flex: 1 }} controls={false} playerRef={playerRef} onEnd={() => setEnded(true)} />
          : <TextReel p={p} active={active} />}
      </Pressable>
      {(ended || paused) && p.mediaUrl ? <View pointerEvents="none" style={{ position: 'absolute', top: '45%', alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={ended ? 'refresh' : 'play'} size={32} color="#fff" /></View> : null}
      <View style={{ position: 'absolute', top: 62, left: 16 }}><Timer p={p} /></View>
      <View style={{ position: 'absolute', left: 16, right: 84, bottom: 24, gap: 10 }}>
        <Pressable onPress={() => nav.push('profile', { id: u.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar u={u} size={36} /><T h style={{ color: '#fff' }}>{u.handle}</T>
          {u.id !== s.me && !u.following ? <Pressable onPress={() => run(() => act.follow(u.id, false, s.me))} style={{ borderWidth: 1.5, borderColor: 'rgba(255,255,255,.7)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <T h style={{ color: '#fff', fontSize: 12.5 }}>Follow</T></Pressable> : null}
        </Pressable>
        {p.text && p.mediaUrl ? <RichText text={p.text} style={{ color: '#fff', fontFamily: F.bold }} onTag={(t) => nav.tab('search', { q: t })} /> : null}
      </View>
      <View style={{ position: 'absolute', right: 10, bottom: 24, gap: 14 }}>
        <Rail icon="flame" n={p.heat} on={p.myHeat} label="Heat" onPress={() => !p.myHeat && run(() => act.react(p.id, 'heat'), { optimistic: { post: p.id, patch: { myHeat: true, heat: p.heat + 1 } } })} />
        <Rail icon="snow" n={p.freeze} on={p.myFreeze} label="Freeze" onPress={() => !p.myFreeze && run(() => act.react(p.id, 'freeze'), { optimistic: { post: p.id, patch: { myFreeze: true, freeze: p.freeze + 1 } } })} />
        <Rail icon="chatbubble-outline" n={p.comments.length} label="Comments" disabled={frozen} onPress={() => nav.sheet('comments', { id: p.id })} />
        <Rail icon="paper-plane-outline" label="Send" onPress={() => nav.sheet('share', { post: p })} />
        <Rail icon={p.saved ? 'bookmark' : 'bookmark-outline'} on={p.saved} label="Save" onPress={() => run(() => act.save(p.id, p.saved, s.me), { optimistic: { post: p.id, patch: { saved: !p.saved } } })} />
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
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
const GROUPS = { social: ['follow', 'heat', 'freeze', 'viral'], comments: ['mention', 'likeComment', 'reply', 'comment'] };
export function ActivityScreen() {
  const { s, C, nav } = useApp(); const [tab, setTab] = useState('social');
  useEffect(() => { const t = setTimeout(() => act.readNotifs(s.me, GROUPS[tab]), 1200); return () => clearTimeout(t); }, [tab]);
  const list = s.notifs.filter((n) => !s.blocked[n.userId] && GROUPS[tab].includes(n.type));
  const unread = (k) => s.notifs.filter((n) => !n.read && GROUPS[k].includes(n.type)).length;
  const text = (n) => ({ follow: 'started following you', mention: 'mentioned you: ' + n.text, likeComment: 'liked your comment: ' + n.text, reply: 'replied: ' + n.text, comment: 'commented: ' + n.text,
    heat: 'heated your post: ' + n.text, freeze: 'froze your post: ' + n.text, viral: 'Your take went viral. ' + n.text }[n.type] || n.text);
  const icon = { follow: 'person-add', mention: 'at', likeComment: 'heart', reply: 'chatbubble', comment: 'chatbubble', heat: 'flame', freeze: 'snow', viral: 'flame' };
  const Seg = ({ k, label }) => (
    <Pressable onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 999, backgroundColor: tab === k ? C.ink : 'transparent', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      <T h style={{ color: tab === k ? C.bg : C.muted, fontSize: 14 }}>{label}</T>
      {unread(k) ? <View style={{ backgroundColor: C.orange, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><T h style={{ color: '#fff', fontSize: 11 }}>{unread(k)}</T></View> : null}
    </Pressable>);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Activity" back />
      <View style={{ paddingHorizontal: 16 }}><View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 999, padding: 4 }}><Seg k="social" label="Heat & follows" /><Seg k="comments" label="Comments" /></View></View>
      <FlatList data={list} keyExtractor={(n) => String(n.id)} contentContainerStyle={{ padding: 16, paddingBottom: 110 }} ListEmptyComponent={<Empty text="Nothing yet" />}
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
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
  const [t, setT] = useState(''); const [pick, setPick] = useState(false); const list = useRef(null);
  const msgs = s.threads[id] || [];
  useEffect(() => { act.read(id, s.me); }, [id, msgs.length]);
  const lastMine = [...msgs].reverse().find((m) => m.from === s.me);
  const seen = lastMine && s.seenBy[id] && s.seenBy[id] >= lastMine.at && msgs[msgs.length - 1] === lastMine;
  const send = () => { if (!t.trim()) return; const v = t.trim(); setT(''); run(() => act.dm(id, { text: v })); };
  const lastTap = useRef({});
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <Header back title={u.name} right={<Pressable onPress={() => nav.push('profile', { id })}><Avatar u={u} size={36} /></Pressable>} />
      <FlatList ref={list} data={msgs} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: 16, gap: 4 }}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: C.card, borderRadius: 999, paddingLeft: 16, padding: 4 }}>
          <TextInput value={t} onChangeText={setT} placeholder="Message…" placeholderTextColor={C.muted} onSubmitEditing={send} returnKeyType="send" style={{ flex: 1, color: C.ink, fontFamily: F.body, fontSize: 15, paddingVertical: 10 }} />
          <Pressable onPress={() => setPick(!pick)} accessibilityLabel="Stickers" style={{ padding: 8 }}><Ionicons name="happy-outline" size={22} color={C.muted} /></Pressable>
          <Pressable onPress={send} disabled={!t.trim()} accessibilityLabel="Send" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', opacity: t.trim() ? 1 : 0.3 }}>
            <Ionicons name="paper-plane" size={17} color="#fff" /></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
