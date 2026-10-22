import React, { useState, useRef } from 'react';
import { View, Pressable, Image, TextInput, Animated, Alert, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApp, T, Avatar, Timer, Sticker, StickerPicker, Sheet, Btn, Empty, stickerLabel } from './ui';
import { ago, kfmt, F } from './lib';
import { act } from './data';
import { GifPicker } from './gif';

export function Video({ uri, style, autoPlay, controls = true, loop = false, muted = false, onEnd, playerRef, trim }) {
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
  React.useEffect(() => {
    if (!onEnd) return;
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={controls} pointerEvents={controls ? 'auto' : 'none'} />;
}

export function RichText({ text, style, onTag }) {
  const { C } = useApp();
  const parts = String(text || '').split(/(#[\w]+|@[\w.]+)/g);
  return <T style={style}>{parts.map((t, i) => /^[#@]/.test(t)
    ? <T key={i} b style={[style, { color: C.orange, fontFamily: F.bold }]} onPress={() => onTag && onTag(t)}>{t}</T> : t)}</T>;
}

export function PostCard({ p }) {
  const { s, C, run, nav } = useApp();
  const u = s.users[p.userId]; const frozen = p.status === 'frozen';
  const [burst] = useState(() => new Animated.Value(0)); const lastTap = useRef(0);
  const cs = p.comments.filter((c) => !s.blocked[c.userId]);
  const top = cs.length ? [...cs].sort((a, b) => b.likes - a.likes)[0] : null;
  const heat = () => { if (!p.myHeat) run(() => act.react(p.id, 'heat'), { optimistic: { post: p.id, patch: { myHeat: true, heat: p.heat + 1 } } }); };
  const dbl = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) { heat(); burst.setValue(0); Animated.sequence([Animated.spring(burst, { toValue: 1, useNativeDriver: true }), Animated.timing(burst, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true })]).start(); }
    lastTap.current = now;
  };
  if (!u) return null;
  return (
    <View style={{ backgroundColor: frozen ? C.soft : C.card, borderRadius: 26, padding: 14, marginBottom: 10, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => nav.push('profile', { id: u.id })} style={{ opacity: frozen ? 0.45 : 1 }}><Avatar u={u} size={40} /></Pressable>
        <Pressable onPress={() => nav.push('profile', { id: u.id })} style={{ flex: 1, minWidth: 0, opacity: frozen ? 0.45 : 1 }}>
          <T h numberOfLines={1}>{u.name}</T><T muted numberOfLines={1} style={{ fontSize: 13 }}>@{u.handle} · {ago(Date.now() - p.createdAt)}</T>
        </Pressable>
        <Timer p={p} />
        <Pressable onPress={() => nav.sheet('menu', { post: p })} hitSlop={10} accessibilityLabel="Post options" style={{ padding: 6 }}><Ionicons name="ellipsis-horizontal" size={20} color={C.muted} /></Pressable>
      </View>
      <View style={{ opacity: frozen ? 0.45 : 1 }}>
        {p.text ? <RichText text={p.text} onTag={(t) => nav.tab('search', { q: t })}
          style={!p.mediaUrl && p.text.length < 90 ? { fontFamily: F.displayB, fontSize: 18, lineHeight: 24, marginTop: 12, letterSpacing: -0.5 } : { fontSize: 16.5, lineHeight: 23, marginTop: 12 }} /> : null}
        {p.mediaUrl ? (
          <Pressable onPress={dbl} style={{ marginTop: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: C.soft }}>
            {p.mediaType === 'video' ? <Video uri={p.mediaUrl} style={{ width: '100%', aspectRatio: 1 }} /> : <Image source={{ uri: p.mediaUrl }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />}
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
              <Ionicons name="flame" size={120} color={C.orange} /></Animated.View>
          </Pressable>) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <Pressable onPress={heat} accessibilityLabel="Heat" accessibilityState={{ selected: p.myHeat }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 13, borderRadius: 999, backgroundColor: p.myHeat ? C.orange : C.soft }}>
          <Ionicons name={p.myHeat ? 'flame' : 'flame-outline'} size={19} color={p.myHeat ? '#fff' : C.ink} /><T h style={{ color: p.myHeat ? '#fff' : C.ink }}>{kfmt(p.heat)}</T></Pressable>
        <Pressable onPress={() => { if (!p.myFreeze) run(() => act.react(p.id, 'freeze'), { optimistic: { post: p.id, patch: { myFreeze: true, freeze: p.freeze + 1 } } }); }} accessibilityLabel="Freeze" accessibilityState={{ selected: p.myFreeze }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 13, borderRadius: 999, backgroundColor: p.myFreeze ? C.ink : C.soft }}>
          <Ionicons name="snow" size={19} color={p.myFreeze ? C.bg : C.ink} /><T h style={{ color: p.myFreeze ? C.bg : C.ink }}>{kfmt(p.freeze)}</T></Pressable>
        <View style={{ flex: 1 }} />
        <Pressable disabled={frozen} onPress={() => nav.sheet('comments', { id: p.id })} accessibilityLabel={frozen ? 'Comments are off while frozen' : 'Comments'} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, opacity: frozen ? 0.3 : 1 }}>
          <Ionicons name="chatbubble-outline" size={20} color={C.ink} />{cs.length ? <T muted b>{cs.length}</T> : null}</Pressable>
        <Pressable onPress={() => nav.sheet('share', { post: p })} accessibilityLabel="Send" style={{ padding: 6 }}><Ionicons name="paper-plane-outline" size={20} color={C.ink} /></Pressable>
        <Pressable onPress={() => run(() => act.save(p.id, p.saved, s.me), { optimistic: { post: p.id, patch: { saved: !p.saved } } })} accessibilityLabel="Save" style={{ padding: 6 }}>
          <Ionicons name={p.saved ? 'bookmark' : 'bookmark-outline'} size={20} color={p.saved ? C.orange : C.ink} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 2 }} accessibilityLabel={kfmt(p.views) + ' views'}>
          <Ionicons name="stats-chart" size={14} color={C.muted} /><T b muted style={{ fontSize: 13 }}>{kfmt(p.views)}</T></View>
      </View>
      {top && !frozen ? <Pressable onPress={() => nav.sheet('comments', { id: p.id })}><T muted numberOfLines={2} style={{ fontSize: 14, marginTop: 10 }}>
        <T b style={{ fontSize: 14 }}>{(s.users[top.userId] || {}).handle} </T>{top.sticker ? stickerLabel(top.sticker) : top.text}{cs.length > 1 ? ' · View all ' + cs.length : ''}</T></Pressable> : null}
      {p.status === 'burning' ? <BurnBar p={p} /> : null}
    </View>
  );
}
function BurnBar({ p }) {
  const { C } = useApp(); const [, f] = useState(0);
  React.useEffect(() => { const t = setInterval(() => f((x) => x + 1), 5000); return () => clearInterval(t); }, []);
  const pct = Math.max(0, Math.min(1, (p.burnEnds - Date.now()) / 864e5));
  return <View style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: pct * 100 + '%', backgroundColor: C.orange }} />;
}

/* ---------- sheets ---------- */
export function CommentsSheet({ id, onClose }) {
  const { s, C, run, nav } = useApp();
  const p = s.posts.find((x) => x.id === id);
  const [t, setT] = useState(''); const [pick, setPick] = useState(false); const [gif, setGif] = useState(false); const inp = useRef(null);
  if (!p) return null;
  const list = [...p.comments.filter((c) => !s.blocked[c.userId])].sort((a, b) => b.likes - a.likes || a.at - b.at);
  const frozen = p.status === 'frozen';
  const send = () => { if (!t.trim()) return; const v = t.trim(); setT(''); run(() => act.comment(p.id, v)); };
  return (
    <Sheet visible onClose={onClose} title="Comments" full>
      <FlatList showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" data={list} keyExtractor={(c) => String(c.id)} style={{ maxHeight: 420 }} ListEmptyComponent={<Empty text="No comments yet" />}
        renderItem={({ item: c }) => { const u = s.users[c.userId] || {}; return (
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 9 }}>
            <Pressable onPress={() => { onClose(); nav.push('profile', { id: c.userId }); }}><Avatar u={u} size={34} /></Pressable>
            <View style={{ flex: 1 }}>
              <T><T h>{u.handle}</T><T muted style={{ fontSize: 13 }}>  {ago(Date.now() - c.at)}</T></T>
              {c.sticker ? <View style={{ paddingVertical: 6 }}><Sticker v={c.sticker} size={46} /></View> : <RichText text={c.text} style={{ marginTop: 2 }} />}
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
        {gif ? <GifPicker onClose={() => setGif(false)} onPick={(g) => { setGif(false); run(() => act.comment(p.id, '', 'G|' + g.url)); }} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: C.soft, borderRadius: 999, paddingLeft: 16, padding: 4 }}>
          <TextInput ref={inp} value={t} onChangeText={setT} placeholder="Add a comment…" placeholderTextColor={C.muted} onSubmitEditing={send} returnKeyType="send"
            style={{ flex: 1, color: C.ink, fontFamily: F.body, fontSize: 15, paddingVertical: 10 }} />
          <Pressable onPress={() => { setGif(!gif); setPick(false); }} accessibilityLabel="GIFs" style={{ paddingHorizontal: 6, paddingVertical: 8 }}><T h style={{ color: gif ? C.orange : C.muted, fontSize: 12 }}>GIF</T></Pressable>
          <Pressable onPress={() => setPick(!pick)} accessibilityLabel="Stickers" style={{ padding: 8 }}><Ionicons name="happy-outline" size={22} color={C.muted} /></Pressable>
          <Pressable onPress={send} disabled={!t.trim()} accessibilityLabel="Send comment" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', opacity: t.trim() ? 1 : 0.3 }}>
            <Ionicons name="paper-plane" size={17} color="#fff" /></Pressable>
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

export function PostMenu({ post, onClose }) {
  const { s, C, run, nav } = useApp(); const u = s.users[post.userId] || {}; const mine = post.userId === s.me;
  const Item = ({ icon, label, onPress, warn }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={20} color={warn ? C.orange : C.ink} /><T h style={{ color: warn ? C.orange : C.ink }}>{label}</T></Pressable>);
  return (
    <Sheet visible onClose={onClose}>
      <View style={{ backgroundColor: C.soft, borderRadius: 20, overflow: 'hidden' }}>
        <Item icon={post.saved ? 'bookmark' : 'bookmark-outline'} label={post.saved ? 'Unsave' : 'Save'} onPress={() => { onClose(); run(() => act.save(post.id, post.saved, s.me)); }} />
        {!mine ? <Item icon="person-add-outline" label={(u.following ? 'Unfollow' : 'Follow') + ' @' + u.handle} onPress={() => { onClose(); run(() => act.follow(u.id, u.following, s.me)); }} /> : null}
        <Item icon="person-outline" label="View profile" onPress={() => { onClose(); nav.push('profile', { id: u.id }); }} />
        {!mine ? <Item icon="chatbubbles-outline" label="Message" onPress={() => { onClose(); nav.push('thread', { id: u.id }); }} /> : null}
        <Item icon="paper-plane-outline" label="Send" onPress={() => { onClose(); setTimeout(() => nav.sheet('share', { post }), 300); }} />
        {!mine ? <Item icon="flag-outline" label="Report" onPress={() => { onClose(); nav.toast('Reported. Thanks.'); }} /> : null}
        {!mine ? <Item icon="ban-outline" label={'Block @' + u.handle} warn onPress={() => {
          Alert.alert('Block @' + u.handle + '?', 'Their posts, stories, comments and messages will be hidden from you.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => { onClose(); run(() => act.block(u.id), { toast: 'Blocked @' + u.handle }); } }]);
        }} /> : null}
      </View>
    </Sheet>
  );
}
