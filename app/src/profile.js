import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, Image, TextInput, Switch, Alert, Modal, Animated, Easing, Dimensions, PanResponder, KeyboardAvoidingView, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, FlowBox, tapAway, SegTabs, StoryOrb, T, Btn, IconBtn, Avatar, Thermo, Sticker, StickerPicker, Sheet, Empty } from './ui';
import { PostCard, Video } from './posts';
import { Header, pickMedia, ReplayGrid } from './screens';
import { GifPicker } from './gif';
import { act } from './data';
import { sb, kfmt, F, THEMES, GLOW, STICKER_PACKS, ago, friendly } from './lib';

import { HEADER_FX, HeaderFx } from './fx';
import { AshBurn } from './ash';
import { StoryPhoto, StoryPhotoEditor } from './storyframe';

export function ProfileScreen({ id, isTab }) {
  const { s, C, nav, run } = useApp(); const ins = useSafeAreaInsets();
  const uid = id || s.me; const u = s.users[uid]; const isMe = uid === s.me;
  const [tab, setTab] = useState('posts'); const [pick, setPick] = useState(false); const [edit, setEdit] = useState(false);
  if (!u) return <View style={{ flex: 1, backgroundColor: C.bg }}><Header back /><Empty text="Loading…" /></View>;
  const blocked = s.blocked[uid];
  const all = s.posts.filter((p) => p.userId === uid);
  const reposted = (s.repostsBy[uid] || []).map((id) => s.posts.find((p) => p.id === id)).filter(Boolean);
  const list = tab === 'posts' ? all.filter((p) => !p.reel) : tab === 'replays' ? all.filter((p) => p.reel) : tab === 'reposts' ? reposted : s.posts.filter((p) => p.saved);
  const fx = u.headerFx && HEADER_FX[u.headerFx];
  const setStickers = (next) => run(() => act.profileStickers(s.me, next));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ backgroundColor: C.card, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: 16, paddingBottom: 18 }}>
          <View style={{ height: 180 + ins.top, marginHorizontal: -16, overflow: 'hidden' }}>
            {u.header && !fx ? <Image source={{ uri: u.header }} style={{ width: '100%', height: '100%' }} /> :
              <HeaderFx id={fx ? u.headerFx : null} fallback={[C.orange, C.orange2, '#0a0a0a']} />}
            {!isTab ? <IconBtn name="chevron-back" label="Back" onPress={nav.back} color="#fff" style={{ position: 'absolute', top: ins.top + 8, left: 12, backgroundColor: 'rgba(0,0,0,.45)' }} /> : null}
            {isMe ? <IconBtn name="settings-outline" label="Settings" onPress={() => nav.push('settings')} color="#fff" style={{ position: 'absolute', top: ins.top + 8, right: 12, backgroundColor: 'rgba(0,0,0,.45)' }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -46 }}>
            {(() => { const story = s.stories.find((x) => x.userId === uid); if (!story) return <View style={{ borderWidth: 5, borderColor: C.card, borderRadius: 60 }}><Avatar u={u} size={92} /></View>;
              const unseen = story.items.some((i) => !s.seen[i.id]);
              return <View style={{ backgroundColor: C.card, borderRadius: 60, padding: 3 }}><StoryOrb u={u} size={96} seen={!unseen} onPress={() => nav.sheet('story', { userId: uid })} label={'Story from @' + u.handle} /></View>; })()}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1, alignSelf: 'flex-start', marginTop: -4 }}>
              {isMe ? <>
                <Pressable onPress={() => nav.push('shop')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <Ionicons name="flame" size={15} color={C.orange} /><T h style={{ color: C.bg, fontSize: 14 }}>{kfmt(s.priv.points)}</T></Pressable>
                <Btn kind="ghost" title="Edit profile" onPress={() => setEdit(true)} /></>
                : blocked ? <Btn kind="ghost" title="Unblock" onPress={() => run(() => act.unblock(uid, s.me))} />
                : <>
                  <Btn kind="ghost" title="Message" onPress={() => nav.push('thread', { id: uid })} />
                  <Btn kind={u.following ? 'ghost' : 'orange'} title={u.following ? 'Following' : u.followsMe ? 'Follow back' : 'Follow'} onPress={() => run(() => act.follow(uid, u.following, s.me))} />
                  <IconBtn name="ban-outline" label="Block" style={{ backgroundColor: C.soft }} onPress={() => Alert.alert('Block @' + u.handle + '?', 'Their posts, stories, comments and messages will be hidden from you.', [
                    { text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => run(() => act.block(uid), { toast: 'Blocked @' + u.handle }) }])} /></>}
            </View>
          </View>
          <T d style={{ fontSize: 25, letterSpacing: -1.2, marginTop: 12 }}>{u.name}{u.isPrivate ? '  🔒' : ''}</T>
          <T muted style={{ fontSize: 15 }}>@{u.handle}{!isMe && u.followsMe ? ' · Follows you' : ''}</T>
          {u.bio ? <T style={{ marginTop: 10 }}>{u.bio}</T> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {[[all.length, 'Posts'], [u.followers, 'Followers'], [u.followingCount, 'Following']].map(([n, l]) => (
              <View key={l} style={{ backgroundColor: C.soft, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, minWidth: 76 }}>
                <T d style={{ fontSize: 17 }}>{kfmt(n)}</T><T b muted style={{ fontSize: 12 }}>{l}</T></View>))}
          </View>
          {!blocked && (isMe || all.length) ? <Thermo w={s.week[uid]} isMe={isMe} stickers={u.stickers} onAddSticker={() => setPick(true)}
            onRemoveSticker={(i) => setStickers(u.stickers.filter((_, j) => j !== i))} /> : null}
        </View>
        {blocked ? <Empty text="Blocked" /> : <View style={{ paddingHorizontal: 16 }}>
          <SegTabs items={[['posts', 'Posts'], ['replays', 'Replays'], ['reposts', 'Reposts'], ...(isMe ? [['saved', 'Saved']] : [])]} value={tab} onChange={setTab} style={{ marginTop: 12, marginBottom: 10 }} />
          {tab === 'replays' ? <ReplayGrid posts={list} /> : <>
            {list.some((p) => p.reel) ? <View style={{ marginBottom: 10 }}><ReplayGrid posts={list.filter((p) => p.reel)} /></View> : null}
            {list.filter((p) => !p.reel).length ? list.filter((p) => !p.reel).map((p) => <PostCard key={p.id} p={p} />) : list.length ? null : <Empty text="Nothing here yet" />}</>}
        </View>}
      </ScrollView>
      {pick ? <Sheet visible onClose={() => setPick(false)} title="Add a sticker" right={<Btn small kind="ghost" title="Fire Sale" onPress={() => { setPick(false); nav.push('shop'); }} />}>
        <StickerPicker onPick={(e) => { setPick(false); setStickers([...(u.stickers || []), e].slice(0, 3)); }} /></Sheet> : null}
      {edit ? <EditProfile onClose={() => setEdit(false)} /> : null}
    </View>
  );
}

// Defined outside EditProfile so typing doesn't rebuild the box and close the keyboard.
function Input({ C, style, ...p }) {
  return <TextInput placeholderTextColor={C.muted} {...p} style={[{ backgroundColor: C.soft, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, color: C.ink, fontFamily: F.body, fontSize: 16, marginTop: 6 }, style]} />;
}

function EditProfile({ onClose }) {
  const { s, C, run } = useApp(); const me = s.users[s.me];
  const [name, setName] = useState(me.name); const [bio, setBio] = useState(me.bio); const [handle, setHandle] = useState(me.handle);
  const [avatar, setAvatar] = useState(null); const [header, setHeader] = useState(null); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const ok = await run(() => act.profile(s.me, { name: name.trim(), bio: bio.trim(), handle: handle.trim().replace(/^@/, '') !== me.handle ? handle.trim().replace(/^@/, '') : undefined, avatar, header }), { toast: 'Saved' }); setBusy(false); if (ok) onClose(); };
  return (
    <Sheet visible onClose={onClose} title="Edit profile" full right={<Btn small kind="orange" title={busy ? 'Saving…' : 'Save'} disabled={busy || !name.trim() || !handle.trim()} onPress={save} />}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" keyboardShouldPersistTaps="handled">
        <Pressable onPress={async () => { const a = await pickMedia('image'); if (a) setHeader(a); }} style={{ height: 120, borderRadius: 22, overflow: 'hidden' }} accessibilityLabel="Change header">
          {header || me.header ? <Image source={{ uri: (header && header.uri) || me.header }} style={{ width: '100%', height: '100%' }} /> : <LinearGradient colors={[C.orange, C.orange2, '#0a0a0a']} style={{ flex: 1 }} />}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.3)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="camera" size={24} color="#fff" /></View>
        </Pressable>
        <Pressable onPress={async () => { const a = await pickMedia('image'); if (a) setAvatar(a); }} style={{ marginTop: -36, marginLeft: 14, width: 82 }} accessibilityLabel="Change photo">
          <View style={{ borderWidth: 4, borderColor: C.card, borderRadius: 50 }}><Avatar u={{ ...me, avatar: (avatar && avatar.uri) || me.avatar, ring: null }} size={74} /></View>
          <View style={{ position: 'absolute', top: 4, left: 4, width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(0,0,0,.3)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="camera" size={18} color="#fff" /></View>
        </Pressable>
        <T b muted style={{ marginTop: 12, fontSize: 13 }}>Display name</T><Input C={C} value={name} onChangeText={setName} maxLength={40} />
        <T b muted style={{ marginTop: 12, fontSize: 13 }}>Username</T><Input C={C} value={handle} onChangeText={(v) => setHandle(v.replace(/\s/g, ''))} autoCapitalize="none" maxLength={20} />
        <T b muted style={{ marginTop: 12, fontSize: 13 }}>Bio</T><Input C={C} value={bio} onChangeText={setBio} multiline maxLength={160} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      </ScrollView>
    </Sheet>
  );
}

/* ---------------- settings ---------------- */
export function SettingsScreen() {
  const { s, C, nav, run } = useApp(); const me = s.users[s.me] || {}; const st = s.priv.settings || {};
  const setSetting = (k, v) => run(() => act.settings(s.me, { ...st, [k]: v }));
  const Group = ({ children }) => <FlowBox r={24} style={{ backgroundColor: C.card, overflow: 'hidden', marginTop: 12 }}>{children}</FlowBox>;
  const Item = ({ icon, label, val, onPress, right, warn }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56, borderTopWidth: 1, borderTopColor: C.line, marginTop: -1 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={17} color={warn ? C.orange : C.ink} /></View>
      <T h style={{ flex: 1, color: warn ? C.orange : C.ink }}>{label}</T>{val ? <T b muted>{val}</T> : null}
      {right ? <View style={{ alignSelf: 'stretch', justifyContent: 'center' }}>{right}</View> : null}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={C.muted} /> : null}</Pressable>);
  const dmFrom = st.dmFrom || 'everyone'; const dmNext = { everyone: 'following', following: 'none', none: 'everyone' }; const dmLabel = { everyone: 'Everyone', following: 'People you follow', none: 'No one' };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Settings" back />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        <Group>
          <Item icon="star-outline" label="Temp+" val="Coming soon" />
          <Item icon="flame-outline" label="Fire Sale" val={kfmt(s.priv.points) + ' pts'} onPress={() => nav.push('shop')} />
        </Group>
        <Group>
          <Item icon="lock-closed-outline" label="Private account" right={<Switch value={!!me.isPrivate} onValueChange={(v) => run(() => act.profile(s.me, { isPrivate: v }))} trackColor={{ true: C.orange }} />} />
          <Item icon="chatbubbles-outline" label="Who can message you" val={dmLabel[dmFrom]} onPress={() => setSetting('dmFrom', dmNext[dmFrom])} />
          <Item icon="contrast-outline" label="Appearance" val={{ system: 'Match phone', light: 'Light', dark: 'Dark' }[st.theme || 'system']}
            onPress={() => setSetting('theme', { system: 'light', light: 'dark', dark: 'system' }[st.theme || 'system'])} />
          <Item icon="eye-off-outline" label="Hide counts" right={<Switch value={!!st.hideCounts} onValueChange={(v) => setSetting('hideCounts', v)} trackColor={{ true: C.orange }} />} />
        </Group>
        <Group>
          <Item icon="information-circle-outline" label="About" val="Temp 1.0" />
        </Group>
        <Group>
          <Item icon="log-out-outline" label="Log out" onPress={() => Alert.alert('Log out of Temp?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', onPress: () => sb.auth.signOut() }])} />
          <Item icon="trash-outline" label="Delete account" warn onPress={() => Alert.alert('Delete your account?', 'This removes your profile and everything you posted. It can’t be undone.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run(async () => { const { error } = await sb.rpc('delete_me'); if (error) throw error; await sb.auth.signOut(); }) }])} />
        </Group>
      </ScrollView>
    </View>
  );
}

/* ---------------- fire sale ---------------- */
export function ShopScreen() {
  const { s, C, run } = useApp(); const me = s.users[s.me] || {};
  const [tab, setTab] = useState('stickers');
  const owned = s.priv.owned || {}; const deals = s.deals || [];
  const live = (i) => !i.available_until || new Date(i.available_until) > Date.now(); // limited items leave the shop when their time is up
  const items = s.shop.filter((i) => i.kind === tab && !i.plus_only && live(i));
  const isOwned = (k, id) => !!(owned[k] && owned[k][id]);
  const using = (k, id) => (k === 'themes' ? (s.priv.theme || 'ember') === id : k === 'rings' ? me.ring === id : k === 'headers' ? me.headerFx === id : false);
  const Action = ({ k, it, price }) => {
    if (!isOwned(k, it.id) && it.price > 0) return <Btn small kind="orange" title={price + ' pts'} disabled={s.priv.points < price} onPress={() => run(() => act.buy(k, it.id), { toast: 'Unlocked' })} />;
    if (k === 'stickers' || it.id === 'gif' || it.id === 'studio') return <Btn small kind="ghost" title="Owned" disabled />;
    const on = using(k, it.id);
    return <Btn small kind={on ? 'ghost' : 'ink'} title={on ? (k === 'themes' ? 'Using' : 'Remove') : 'Use'} onPress={() => run(() => act.equip(s.me, k, on ? (k === 'themes' ? 'ember' : null) : it.id))} />;
  };
  const Preview = ({ k, it }) => {
    if (k === 'stickers') { const pk = STICKER_PACKS[it.id];
      if (!pk) return <Sticker v="T|YOUR TEXT|y" size={34} fit />;
      const txt = pk.filter((e) => e.startsWith('T|')), emo = pk.filter((e) => !e.startsWith('T|'));
      // text packs: two stickers stacked, shrunk to fit; emoji packs: a row of three
      return txt.length ? <View style={{ alignItems: 'center', gap: 6, width: '100%', paddingHorizontal: 8 }}>{txt.slice(0, 2).map((e, i) => <Sticker key={i} v={e} size={30} fit />)}</View>
        : <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>{emo.slice(0, 3).map((e, i) => <Sticker key={i} v={e} size={30} />)}</View>; }
    if (k === 'themes') { const c = THEMES[it.id] || THEMES.ember; const g = GLOW[it.id];
      return <View style={g ? { borderRadius: 18, shadowColor: c[0], shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10 } : null}><LinearGradient colors={c} style={{ width: 54, height: 54, borderRadius: 18, borderWidth: g ? 2 : 0, borderColor: c[1] }} /></View>; }
    if (k === 'rings') return <Avatar u={{ ...me, ring: it.id }} size={60} />;
    return <HeaderFx id={it.id} fallback={[C.orange, '#0a0a0a']} />;
  };
  const Card = ({ k, it, price, off }) => (
    <FlowBox r={22} style={{ backgroundColor: C.card, padding: 10, gap: 10, width: '48.5%' }}>
      <FlowBox r={16} style={{ height: 92, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><Preview k={k} it={it} />
        {it.available_until ? <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#1a0b2e', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}><T h style={{ color: '#ffb347', fontSize: 10.5 }}>{it.drop_week ? '✨ New · ' : '🎃 '}{Math.max(0, Math.ceil((new Date(it.available_until) - Date.now()) / 864e5))}d left</T></View> : null}
        {off ? <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: C.orange, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}><T h style={{ color: C.onOrange, fontSize: 11 }}>-{off}%</T></View> : null}</FlowBox>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}><T h numberOfLines={1} style={{ flex: 1 }}>{it.name}</T>{off ? <T muted style={{ textDecorationLine: 'line-through', fontSize: 12 }}>{it.price}</T> : null}</View>
      <Action k={k} it={it} price={price} />
    </FlowBox>);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Fire Sale" back />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        <LinearGradient colors={['#0a0a0a', '#3a1204']} style={{ borderRadius: 28, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="flame" size={30} color="#ff5500" /><T d style={{ color: '#fff', fontSize: 30, letterSpacing: -1.5 }}>Fire Sale</T></View>
          <T b style={{ color: 'rgba(255,255,255,.7)', marginTop: 12, fontSize: 13 }}>Your points</T>
          <T d style={{ color: '#fff', fontSize: 28 }}>{(s.priv.points || 0).toLocaleString()}</T>
          <T b style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 6 }}>Earn points when your heated takes go viral. Point packs are coming soon.</T>
        </LinearGradient>
        {deals.length ? <><T d style={{ fontSize: 15, marginTop: 20, marginBottom: 10 }}>Today’s deals</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
            {deals.slice(0, 4).map((d) => { const it = s.shop.find((x) => x.kind === d.kind && x.id === d.id); if (!it) return null; return <Card key={d.kind + d.id} k={d.kind} it={it} price={d.price} off={d.off} />; })}
          </View></> : null}
        <SegTabs items={[['stickers', 'Stickers'], ['themes', 'Themes'], ['rings', 'Rings'], ['headers', 'Headers']]} value={tab} onChange={setTab} size={13} style={{ marginTop: 20, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {items.map((it) => <Card key={it.id} k={tab} it={it} price={it.price} />)}
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------------- composer ---------------- */
export function Composer({ reel: reel0, onClose }) {
  const { s, C, run, nav } = useApp(); const me = s.users[s.me] || {};
  const [reel, setReel] = useState(!!reel0); const [gifOpen, setGifOpen] = useState(false); const [text, setText] = useState(''); const [asset, setAsset] = useState(null); const [busy, setBusy] = useState(false);
  const max = 280, over = text.length > max;
  const ok = !over && (reel ? text.trim() || (asset && asset.type === 'video') : text.trim() || asset);
  const post = async () => { setBusy(true); const done = await run(() => act.post(s.me, { text: text.trim(), asset, reel }), { toast: reel ? 'Replay posted' : 'Posted' }); setBusy(false); if (done) onClose(); };
  return (
    <Sheet visible onClose={onClose} full>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Btn small kind="ghost" title="Cancel" onPress={onClose} />
        <FlowBox r={15} style={{ flexDirection: 'row', backgroundColor: C.soft, padding: 3 }}>
          {[[false, 'Post'], [true, 'Replay']].map(([v, l]) => <Pressable key={l} onPress={() => { setReel(v); if (v && asset && asset.type !== 'video') setAsset(null); }}
            style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 15, backgroundColor: reel === v ? C.card : 'transparent' }}><T h style={{ color: reel === v ? C.ink : C.muted, fontSize: 13 }}>{l}</T></Pressable>)}
          <Pressable onPress={() => { onClose(); setTimeout(() => nav.push('live'), 250); }} accessibilityLabel="Live Takes" style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#ff2d2d' }} /><T h style={{ color: C.muted, fontSize: 13 }}>Live</T></Pressable>
        </FlowBox>
        <Btn small kind="orange" title={busy ? 'Posting…' : 'Post'} disabled={!ok || busy} onPress={post} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Avatar u={me} size={42} />
        <View style={{ flex: 1 }}>
          <TextInput value={text} onChangeText={setText} multiline placeholder={reel ? 'Caption, or a take to animate' : 'What’s your take?'} placeholderTextColor={C.muted}
            style={{ color: C.ink, fontFamily: F.body, fontSize: 19, minHeight: 100, textAlignVertical: 'top', paddingTop: 8 }} />
          {asset ? <View style={{ borderRadius: 20, overflow: 'hidden', marginTop: 6 }}>
            {asset.type === 'video' ? <Video uri={asset.uri} style={{ width: '100%', height: 220 }} /> : <Image source={{ uri: asset.uri }} style={{ width: '100%', height: 220 }} />}
            <Pressable onPress={() => setAsset(null)} accessibilityLabel="Remove" style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color="#fff" /></Pressable></View> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {!reel ? <Btn small kind="ghost" icon="image-outline" title="Photo" onPress={async () => { const a = await pickMedia('image'); if (a) { setAsset(a); setGifOpen(false); } }} /> : null}
          {!reel ? <Btn small kind={gifOpen ? 'ink' : 'ghost'} title="GIF" onPress={() => setGifOpen(!gifOpen)} /> : null}
          {reel ? <Btn small kind="orange" icon="radio-button-on" title="Record" onPress={() => { onClose(); setTimeout(() => nav.sheet('recorder', { mode: 'replay' }), 250); }} /> : null}
          <Btn small kind="ghost" icon="videocam-outline" title={reel ? 'Upload' : 'Video'} onPress={async () => { const a = await pickMedia('video'); if (a) setAsset(a); }} />
        </View>
        <T b style={{ color: over ? C.orange : C.muted, fontSize: 13 }}>{max - text.length}</T>
      </View>
      {gifOpen && !reel ? <GifPicker onClose={() => setGifOpen(false)} onPick={(g) => { setAsset({ uri: g.url, type: 'image', remote: true, gif: true }); setGifOpen(false); }} /> : null}
    </Sheet>
  );
}

/* ---------------- story viewer ---------------- */
const STORY_REACTS = ['🔥', '😂', '😮', '🧊'];
const glass = { backgroundColor: 'rgba(14,14,14,.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)' };
// more emoji for the + in the story reaction tray (or type any emoji yourself)
const MORE_EMOJI = ['❤️','😍','🥵','🥶','💀','😭','🤣','🙌','👏','👀','🫡','🤯','😤','🥹','😈','🤡','💅','🗿','🫠','😬','🤝','💯','✨','⚡','🌶️','🍿','👑','💎','🏆','🎯','🚨','🧨','☄️','🌋','🫶','🙏','😮‍💨','🤌','🐐','🔥'];
const oneEmoji = (t) => { const v = (t || '').trim(); if (!v || v.length > 16) return null; try { const seg = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)]; if (seg.length !== 1) return null; } catch (e) {} let ok; try { ok = new RegExp('\\p{Extended_Pictographic}', 'u').test(v); } catch (e) { ok = !/[A-Za-z0-9\s]/.test(v) && v.length <= 8; } return ok ? v : null; };

export function StoryDraft({ asset, onClose }) {
  const { C, postStory } = useApp(); const ins = useSafeAreaInsets(); const [cap, setCap] = useState(''); const layout = useRef({ s: 1, x: 0, y: 0, fill: false });
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView {...tapAway} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#000' }}>
        {asset.type === 'video' ? <Video uri={asset.uri} style={{ flex: 1 }} controls={false} autoPlay loop /> : <StoryPhotoEditor uri={asset.uri} onChange={(l) => { layout.current = l; }} />}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <T h style={{ color: '#fff', flex: 1, fontSize: 17 }}>New story{asset.type !== 'video' ? <T b style={{ color: 'rgba(255,255,255,.7)', fontSize: 13 }}>{'  '}pinch to zoom · drag to move</T> : null}</T>
          <Pressable onPress={onClose} accessibilityLabel="Cancel" hitSlop={12}><Ionicons name="close" size={28} color="#fff" /></Pressable>
        </View>
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: ins.bottom + 12, gap: 10 }}>
          {cap.trim() ? <T h style={{ color: '#fff', fontSize: 16, textShadowColor: 'rgba(0,0,0,.7)', textShadowRadius: 8 }}>{cap}</T> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput value={cap} onChangeText={setCap} placeholder="Add a caption…" placeholderTextColor="rgba(255,255,255,.7)" maxLength={150}
              style={{ flex: 1, color: '#fff', fontFamily: F.body, fontSize: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.55)', borderRadius: 15, paddingHorizontal: 16, paddingVertical: 11 }} />
            <Btn kind="orange" title="Share" onPress={() => postStory(asset, cap.trim(), asset.type === 'video' ? null : layout.current)} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function StoryViewer({ userId, onClose }) {
  const { s, C, run, nav, reload } = useApp(); const ins = useSafeAreaInsets();
  const [burning, setBurning] = useState(null);
  const order = [...(s.stories.find((x) => x.userId === s.me) ? [s.me] : []), ...s.stories.filter((x) => x.userId !== s.me && !s.blocked[x.userId]).map((x) => x.userId)];
  const [ui, setUi] = useState(Math.max(0, order.indexOf(userId))); const [ii, setIi] = useState(0);
  const [text, setText] = useState(''); const [picker, setPicker] = useState(false); const [panel, setPanel] = useState(false); const [more, setMore] = useState(false); const [custom, setCustom] = useState('');
  const [mine2, setMine2] = useState({}); // instant local reaction/comment feedback until the reload lands
  const prog = useRef(new Animated.Value(0)).current; const anim = useRef(null); const left = useRef(0);
  const st = s.stories.find((x) => x.userId === order[ui]); const item = st && st.items[ii];
  const next = () => { if (!st) return onClose(); if (ii < st.items.length - 1) setIi(ii + 1); else if (ui < order.length - 1) { setUi(ui + 1); setIi(0); } else onClose(); };
  const prev = () => { if (ii > 0) setIi(ii - 1); else if (ui > 0) { setUi(ui - 1); setIi(0); } };
  const [hold, setHold] = useState(0); // seconds left while holding to pause
  const player = useRef(null); const drag = useRef(new Animated.Value(0)).current;
  const paused = picker || more || panel || text.length > 0 || hold > 0 || !!burning;
  const restart = () => { anim.current && anim.current.stop(); prog.setValue(0); if (!paused) startAnim(0);
    try { if (player.current) { player.current.currentTime = 0; player.current.play(); } } catch (e) {} };
  // hold to pause, up to 15 seconds with a countdown in the middle
  useEffect(() => { if (!hold) return; const t = setTimeout(() => setHold(hold - 1), 1000); return () => clearTimeout(t); }, [hold]);
  const g = useRef({}); g.current = { next, restart, onClose, setHold, hold };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (e, d) => d.dy > 8 && Math.abs(d.dy) > Math.abs(d.dx),
    onPanResponderGrant: () => { g.current.moved = false; g.current.held = false;
      g.current.timer = setTimeout(() => { g.current.held = true; g.current.setHold(15); }, 220); },
    onPanResponderMove: (e, d) => { if (d.dy > 8 && Math.abs(d.dy) > Math.abs(d.dx)) { g.current.moved = true; clearTimeout(g.current.timer); drag.setValue(d.dy); } },
    onPanResponderRelease: (e, d) => {
      clearTimeout(g.current.timer); const x = e.nativeEvent.pageX;
      if (Keyboard.isVisible() && !g.current.moved) { Keyboard.dismiss(); g.current.setHold(0); return; }
      if (g.current.moved) {
        if (d.dy > 120 || d.vy > 1) Animated.timing(drag, { toValue: Dimensions.get('window').height, duration: 180, useNativeDriver: true }).start(() => g.current.onClose());
        else { Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(); g.current.setHold(0); }
        return;
      }
      if (g.current.held) { g.current.setHold(0); return; }
      if (x < Dimensions.get('window').width * 0.35) g.current.restart(); else g.current.next();
    },
    onPanResponderTerminate: () => { clearTimeout(g.current.timer); Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(); g.current.setHold(0); },
  })).current;
  const startAnim = (from) => {
    const total = item.type === 'video' ? 15000 : 5000;
    anim.current = Animated.timing(prog, { toValue: 1, duration: Math.max(200, total * (1 - from)), easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => finished && next());
  };
  useEffect(() => { if (!item) return; act.seenStory(item.id); setPicker(false); setPanel(false); setText(''); setHold(0); prog.setValue(0); startAnim(0); return () => anim.current && anim.current.stop(); }, [ui, ii]);
  useEffect(() => { if (!item) return;
    try { if (player.current) paused ? player.current.pause() : player.current.play(); } catch (e) {}
    if (paused) { anim.current && anim.current.stop(); } else { prog.stopAnimation((v) => startAnim(v || 0)); } }, [paused]);
  if (!st || !item) return null;
  const u = s.users[st.userId] || {}; const mine = st.userId === s.me;
  const local = mine2[item.id] || {};
  const myReact = local.react !== undefined ? local.react : item.myReact;
  const comments = [...(item.comments || []), ...(local.comments || [])].filter((c) => !s.blocked[c.userId]);
  const reacts = item.reacts || {}; const total = Object.values(reacts).reduce((n, v) => n + (v || 0), 0);
  const sendComment = () => { const t = text.trim(); if (!t) return; setText(''); setPanel(true);
    setMine2({ ...mine2, [item.id]: { ...local, comments: [...(local.comments || []), { id: 'l' + Date.now(), userId: s.me, text: t, at: Date.now() }] } });
    run(() => act.storyComment(item.id, t)); };
  const react = (e) => { setPicker(false); setMore(false); setCustom(''); setMine2({ ...mine2, [item.id]: { ...local, react: myReact === e ? null : e } }); run(() => act.storyReact(item.id, e, myReact, s.me)); };
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: '#000', opacity: drag.interpolate({ inputRange: [0, 600], outputRange: [1, 0.3], extrapolate: 'clamp' }) }}>
      <Animated.View style={{ flex: 1, transform: [{ translateY: drag.interpolate({ inputRange: [-1, 0, 2000], outputRange: [0, 0, 2000] }) }] }}>
      <KeyboardAvoidingView {...tapAway} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#000' }}>
        {item.type === 'video' ? <Video key={item.id} uri={item.url} style={{ flex: 1 }} controls={false} autoPlay playerRef={player} /> : item.layout ? <StoryPhoto key={item.id} uri={item.url} layout={item.layout} /> : <Image source={{ uri: item.url }} style={{ flex: 1 }} resizeMode="cover" />}
        {burning === item.id ? <AshBurn onDone={async () => {
          const id = burning; setBurning(null); onClose();
          try { const left = await act.burnStory(id); nav.toast('Story burned · ' + left + ' burn' + (left === 1 ? '' : 's') + ' left this week'); } catch (e) { nav.toast(friendly(e)); }
          reload();
        }} /> : null}
        <View style={{ position: 'absolute', top: ins.top + 8, left: 12, right: 12, flexDirection: 'row', gap: 4 }}>
          {st.items.map((it, i) => <View key={it.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.3)', overflow: 'hidden' }}>
            <Animated.View style={{ height: 3, backgroundColor: '#fff', width: i < ii ? '100%' : i === ii ? prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }} /></View>)}
        </View>
        <View style={{ position: 'absolute', top: ins.top + 22, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar u={u} size={32} /><T h style={{ color: '#fff', flex: 1 }}>{u.handle}  <T style={{ color: 'rgba(255,255,255,.7)', fontSize: 13 }}>{ago(Date.now() - item.at)}</T></T>
          {mine ? <Pressable onPress={() => {
            const n = s.storyBurns == null ? 3 : s.storyBurns;
            if (n <= 0) { nav.toast('You’ve used your 3 story burns this week'); return; }
            Alert.alert('Burn this story?', 'It burns to ash right now instead of waiting out its 24 hours. Free — ' + n + ' of 3 burns left this week.', [
              { text: 'Cancel', style: 'cancel' }, { text: 'Burn it', style: 'destructive', onPress: () => setBurning(item.id) }]);
          }} accessibilityLabel="Burn this story" hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,.35)', borderRadius: 15, paddingHorizontal: 9, paddingVertical: 5 }}>
            <Ionicons name="flame" size={15} color="#ff5500" /><T h style={{ color: '#fff', fontSize: 12 }}>{s.storyBurns == null ? 3 : s.storyBurns}</T></Pressable> : null}
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={12}><Ionicons name="close" size={26} color="#fff" /></Pressable>
        </View>
        <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, right: 0, top: 100, bottom: 160 }} accessible accessibilityLabel="Story. Tap left to replay, tap right for next, hold to pause, swipe down to close" />
        {hold ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontFamily: F.display, fontSize: 96, color: '#000', textShadowColor: 'rgba(255,255,255,.85)', textShadowRadius: 18 }}>{hold}</T></View> : null}
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: ins.bottom + 12, gap: 8 }}>
          {item.caption ? <View style={[glass, { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 }]}><T h style={{ color: '#fff', fontSize: 16, lineHeight: 21 }}>{item.caption}</T></View> : null}
          {panel ? <View style={[glass, { borderRadius: 22, padding: 12, maxHeight: 280 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <T h style={{ color: '#fff', flex: 1 }}>{comments.length ? comments.length + (comments.length === 1 ? ' comment' : ' comments') : 'No comments yet'}</T>
              <Pressable onPress={() => setPanel(false)} hitSlop={10} accessibilityLabel="Hide comments"><Ionicons name="close" size={18} color="#fff" /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">{comments.map((c) => { const cu = s.users[c.userId] || {}; return (
              <View key={c.id} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5 }}><Avatar u={cu} size={28} />
                <View style={{ flex: 1 }}><T style={{ color: '#fff', fontSize: 14 }}><T h style={{ color: '#fff', fontSize: 14 }}>{cu.handle} </T>{c.text}</T></View></View>); })}</ScrollView>
          </View> : null}
          {mine && total > 0 ? <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>{Object.entries(reacts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([e, n]) => <T key={e} h style={{ color: '#fff', fontSize: 15 }}>{e} {n}</T>)}</View> : null}
          {more ? <FlowBox r={22} style={[glass, { padding: 12, gap: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={custom} onChangeText={setCustom} placeholder="Type any emoji" placeholderTextColor="rgba(255,255,255,.6)" maxLength={16} autoFocus
                onSubmitEditing={() => { const e = oneEmoji(custom); if (e) react(e); }} returnKeyType="done"
                style={{ flex: 1, height: 44, borderRadius: 14, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 20 }} />
              <Pressable disabled={!oneEmoji(custom)} onPress={() => react(oneEmoji(custom))} accessibilityLabel="React with this emoji"
                style={{ height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', opacity: oneEmoji(custom) ? 1 : 0.4 }}><T h style={{ color: C.onOrange }}>React</T></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 170 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {MORE_EMOJI.map((e) => <Pressable key={e} onPress={() => react(e)} accessibilityLabel={'React ' + e} style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: myReact === e ? 'rgba(255,255,255,.22)' : 'transparent' }}><T style={{ fontSize: 26 }}>{e}</T></Pressable>)}
            </View></ScrollView>
          </FlowBox> : null}
          {picker ? <FlowBox r={20} style={[glass, { alignSelf: 'flex-end', flexDirection: 'row', gap: 4, padding: 6 }]}>
            {[...STORY_REACTS, ...(myReact && !STORY_REACTS.includes(myReact) ? [myReact] : [])].map((e) => <Pressable key={e} onPress={() => react(e)} accessibilityLabel={'React ' + e}
              style={{ width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: myReact === e ? 'rgba(255,255,255,.22)' : 'transparent' }}><T style={{ fontSize: 30 }}>{e}</T></Pressable>)}
            <Pressable onPress={() => { setPicker(false); setMore(true); }} accessibilityLabel="More emoji"
              style={{ width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)' }}><Ionicons name="add" size={26} color="#fff" /></Pressable>
          </FlowBox> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FlowBox r={16} style={[glass, { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6 }]}>
              <TextInput value={text} onChangeText={setText} placeholder={mine ? 'Reply to comments…' : 'Add a comment…'} placeholderTextColor="rgba(255,255,255,.7)" maxLength={300}
                onSubmitEditing={sendComment} returnKeyType="send" style={{ flex: 1, color: '#fff', fontFamily: F.body, fontSize: 16, paddingVertical: 8 }} />
              {text.trim() ? <Pressable onPress={sendComment} accessibilityLabel="Post comment" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="paper-plane" size={15} color={C.onOrange} /></Pressable> : null}
            </FlowBox>
            <Pressable onPress={() => { setPanel(!panel); setPicker(false); }} accessibilityLabel="Comments" style={[glass, { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="chatbubble-outline" size={21} color="#fff" />
              {comments.length ? <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><T h style={{ color: C.onOrange, fontSize: 11 }}>{comments.length}</T></View> : null}
            </Pressable>
            {!mine ? <Pressable onPress={() => { setPicker(!picker); setMore(false); setPanel(false); }} accessibilityLabel="React" style={[glass, { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }]}>
              {myReact ? <T style={{ fontSize: 22 }}>{myReact}</T> : <Ionicons name="heart-outline" size={22} color="#fff" />}</Pressable> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
      </Animated.View>
      </Animated.View>
    </Modal>
  );
}
