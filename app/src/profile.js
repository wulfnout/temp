import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, Image, TextInput, Switch, Alert, Modal, Animated, Easing, Dimensions, PanResponder, KeyboardAvoidingView, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, FlowBox, tapAway, SegTabs, StoryOrb, GradRing, DieIcon, T, Btn, IconBtn, Avatar, Thermo, Sticker, StickerPicker, Sheet, Empty } from './ui';
import { PostCard, Video, QuoteCard } from './posts';
import { Header, pickMedia, ReplayGrid, Drawer } from './screens';
import { CropEditor } from './crop';
import { GifPicker } from './gif';
import { act } from './data';
import { sb, kfmt, F, THEMES, GLOW, STICKER_PACKS, ago, friendly } from './lib';

import { HEADER_FX, HeaderFx } from './fx';
import { AshBurn } from './ash';
import { StoryPhoto, StoryPhotoEditor } from './storyframe';

export function ProfileScreen({ id, isTab }) {
  const { s, C, nav, run } = useApp(); const ins = useSafeAreaInsets();
  const uid = id || s.me; const u = s.users[uid]; const isMe = uid === s.me;
  const [tab, setTab] = useState('posts'); const [pick, setPick] = useState(false); const [edit, setEdit] = useState(false); const [more, setMore] = useState(false); const [menuAt, setMenuAt] = useState(null); const [thought, setThought] = useState(false);
  if (!u) return <View style={{ flex: 1, backgroundColor: C.bg }}><Header back /><Empty text="Loading…" /></View>;
  const blocked = s.blocked[uid];
  const all = s.posts.filter((p) => p.userId === uid);
  const reposted = (s.repostsBy[uid] || []).map((id) => s.posts.find((p) => p.id === id)).filter(Boolean);
  const pin = u.pinned; const own = all.filter((p) => !p.reel);
  const list = tab === 'posts' ? (pin ? [...own.filter((p) => p.id === pin), ...own.filter((p) => p.id !== pin)] : own) : tab === 'replays' ? all.filter((p) => p.reel) : tab === 'reposts' ? reposted : s.posts.filter((p) => p.saved);
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
            {isMe ? <IconBtn die="rgba(0,0,0,.6)" name="settings-outline" label="Settings" onPress={() => nav.push('settings')} color="#fff" style={{ position: 'absolute', top: ins.top + 8, right: 12 }} /> : null}
            {!isMe && !blocked ? <Pressable onPress={() => setMore(true)} accessibilityLabel="More options" hitSlop={8}
              style={{ position: 'absolute', top: ins.top + 8, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {[0, 1, 2].map((i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />)}</Pressable> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -46 }}>
            {(() => { const story = s.stories.find((x) => x.userId === uid);
              // your own picture opens your menu as a drop-down card
              const openMenu = (e) => { const { pageX, pageY, locationX, locationY } = e.nativeEvent; setMenuAt({ top: pageY - locationY + 104, left: Math.max(12, pageX - locationX) }); };
              const unseen = story ? story.items.some((i) => !s.seen[i.id]) : false;
              // the profile picture always wears the ring the person bought and picked
              const pic = <View style={{ backgroundColor: C.card, borderRadius: 60, padding: 3 }}><Avatar u={u} size={100} /></View>;
              if (isMe) return <Pressable onPress={openMenu} accessibilityLabel="Your menu">{pic}</Pressable>;
              return story ? <Pressable onPress={() => nav.sheet('story', { userId: uid })} accessibilityLabel={'Story from @' + u.handle}>{pic}</Pressable> : pic; })()}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1, alignSelf: 'flex-start', marginTop: -4 }}>
              {!blocked && (isMe || u.thought) ? <ThoughtBubble u={u} isMe={isMe} onOpen={() => setThought(true)} /> : null}
              {isMe ? null
                : blocked ? <Btn kind="ghost" title="Unblock" onPress={() => run(() => act.unblock(uid, s.me))} />
                : <>
                  <Btn kind="ghost" title="Message" onPress={() => nav.push('thread', { id: uid })} />
                  <Btn kind={u.following ? 'ghost' : 'orange'} title={u.following ? 'Following' : u.followsMe ? 'Follow back' : 'Follow'} onPress={() => run(() => act.follow(uid, u.following, s.me))} />
</>}
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
          <SegTabs items={[['posts', 'Posts'], ['replays', 'Replays'], ['reposts', 'Reflames'], ...(isMe ? [['saved', 'Saved']] : [])]} value={tab} onChange={setTab} style={{ marginTop: 12, marginBottom: 10 }} />
          {tab === 'replays' ? <ReplayGrid posts={list} /> : <>
            {list.some((p) => p.reel) ? <View style={{ marginBottom: 10 }}><ReplayGrid posts={list.filter((p) => p.reel)} /></View> : null}
            {list.filter((p) => !p.reel).length ? list.filter((p) => !p.reel).map((p) => <View key={p.id}>{tab === 'posts' && p.id === pin ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 14, marginBottom: 6 }}><Ionicons name="pin" size={13} color={C.muted} /><T h muted style={{ fontSize: 13 }}>Pinned</T></View> : null}<PostCard p={p} /></View>) : list.length ? null : <Empty text="Nothing here yet" />}</>}
        </View>}
      </ScrollView>
      {pick ? <Sheet visible onClose={() => setPick(false)} title="Add a sticker" right={<Btn small kind="ghost" title="Fire Sale" onPress={() => { setPick(false); nav.push('shop'); }} />}>
        <StickerPicker onPick={(e) => { setPick(false); setStickers([...(u.stickers || []), e].slice(0, 3)); }} /></Sheet> : null}
      {edit ? <EditProfile onClose={() => setEdit(false)} /> : null}
      {menuAt ? <Drawer at={menuAt} onClose={() => setMenuAt(null)} onEdit={() => setEdit(true)} /> : null}
      {thought ? <ThoughtSheet u={u} uid={uid} isMe={isMe} onClose={() => setThought(false)} /> : null}
      {more ? <Sheet visible onClose={() => setMore(false)} title={'@' + u.handle}>
        <View style={{ gap: 8, paddingTop: 4 }}>
          <Pressable onPress={() => { setMore(false); setTimeout(() => Alert.alert('Block @' + u.handle + '?', 'Their posts, stories, comments and messages will be hidden from you.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => run(() => act.block(uid), { toast: 'Blocked @' + u.handle }) }]), 250); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.soft }} accessibilityLabel={'Block @' + u.handle}>
            <Ionicons name="ban-outline" size={21} color="#ff3b30" /><T h style={{ color: '#ff3b30', fontSize: 16 }}>Block @{u.handle}</T></Pressable>
          <Pressable onPress={() => setMore(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.soft }} accessibilityLabel="Cancel">
            <Ionicons name="close" size={21} color={C.ink} /><T h style={{ fontSize: 16 }}>Cancel</T></Pressable>
        </View>
      </Sheet> : null}
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
export function SettingsScreen({ start }) {
  const { s, C, nav, run } = useApp(); const me = s.users[s.me] || {}; const st = s.priv.settings || {};
  const [sub, setSub] = useState(start || null); const [q, setQ] = useState(''); const [editing, setEditing] = useState(false);
  const setSetting = (k, v) => run(() => act.settings(s.me, { ...st, [k]: v }));
  const notif = st.notif || {}; const setNotif = (k, v) => setSetting('notif', { ...notif, [k]: v });
  const Group = ({ children }) => <FlowBox r={24} style={{ backgroundColor: C.card, overflow: 'hidden', marginTop: 12 }}>{children}</FlowBox>;
  const Item = ({ icon, label, val, onPress, right, warn }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56, borderTopWidth: 1, borderTopColor: C.line, marginTop: -1 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={17} color={warn ? C.orange : C.ink} /></View>
      <T h style={{ flex: 1, color: warn ? C.orange : C.ink }}>{label}</T>{val ? <T b muted>{val}</T> : null}
      {right ? <View style={{ alignSelf: 'stretch', justifyContent: 'center' }}>{right}</View> : null}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={C.muted} /> : null}</Pressable>);
  const Sw = ({ v, on }) => <Switch value={!!v} onValueChange={on} trackColor={{ true: C.orange }} />;
  const dmFrom = st.dmFrom || 'everyone'; const dmNext = { everyone: 'following', following: 'none', none: 'everyone' }; const dmLabel = { everyone: 'Everyone', following: 'People you follow', none: 'No one' };
  const titles = { account: 'Your account', notifications: 'Notifications', privacy: 'Privacy and safety', display: 'Display and languages', help: 'Help Center' };
  const page = (children) => (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={titles[sub]} back onBack={() => setSub(null)} />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>{children}</ScrollView>
    </View>);
  if (sub === 'account') return page(<>
    {editing ? <EditProfile onClose={() => setEditing(false)} /> : null}
    <Group><Item icon="person-outline" label="Edit profile" onPress={() => setEditing(true)} />
      <Item icon="bookmark-outline" label="Saved" onPress={() => nav.push('profile', { id: s.me, tab: 'saved' })} /></Group>
    <Group>
      <Item icon="log-out-outline" label="Log out" onPress={() => Alert.alert('Log out of Temp?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', onPress: () => sb.auth.signOut() }])} />
      <Item icon="trash-outline" label="Delete account" warn onPress={() => Alert.alert('Delete your account?', 'This removes your profile and everything you posted. It can’t be undone.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run(async () => { const { error } = await sb.rpc('delete_me'); if (error) throw error; await sb.auth.signOut(); }) }])} />
    </Group></>);
  if (sub === 'notifications') return page(<>
    <Group><Item icon="notifications-off-outline" label="Pause all" right={<Sw v={notif.pause} on={(v) => setNotif('pause', v)} />} /></Group>
    <Group>{[['heat', 'flame-outline', 'Heat on your posts'], ['freeze', 'snow-outline', 'Freezes on your posts'], ['comments', 'chatbubble-outline', 'Comments and replies'], ['likes', 'heart-outline', 'Likes on your comments'], ['follows', 'person-add-outline', 'New followers'], ['messages', 'paper-plane-outline', 'Messages']].map(([k, ic, l]) =>
      <Item key={k} icon={ic} label={l} right={<Sw v={notif[k] !== false} on={(v) => setNotif(k, v)} />} />)}</Group></>);
  if (sub === 'privacy') return page(<Group>
    <Item icon="lock-closed-outline" label="Private account" right={<Sw v={me.isPrivate} on={(v) => run(() => act.profile(s.me, { isPrivate: v }))} />} />
    <Item icon="chatbubbles-outline" label="Who can message you" val={dmLabel[dmFrom]} onPress={() => setSetting('dmFrom', dmNext[dmFrom])} />
    <Item icon="eye-off-outline" label="Hide counts" right={<Sw v={st.hideCounts} on={(v) => setSetting('hideCounts', v)} />} />
  </Group>);
  if (sub === 'display') return page(<Group>
    <Item icon="contrast-outline" label="Theme" val={{ system: 'Match phone', light: 'Light', dark: 'Dark' }[st.theme || 'system']} onPress={() => setSetting('theme', { system: 'light', light: 'dark', dark: 'system' }[st.theme || 'system'])} />
  </Group>);
  if (sub === 'help') return page(<Group>
    <Item icon="document-text-outline" label="User agreement" onPress={() => nav.push('terms')} />
    <Item icon="flag-outline" label="Report a problem" onPress={() => nav.toast('Report sent')} />
    <Item icon="information-circle-outline" label="About" val="Temp 1.0" />
  </Group>);
  // X-style main list: icon, bold title, one-line description, chevron, with a search box
  const rows = [
    ['account', 'person-outline', 'Your account', 'Edit your profile and saved posts, or log out and delete your account.', 'edit profile saved log out delete'],
    ['earnings', 'sparkles-outline', 'Creator Studio', 'See the Sparks you’ve earned from gifts, your history, and cash out.', 'earnings cash out sparks gifts payout'],
    ['shop', 'flame-outline', 'Fire Sale and Temp+', 'Spend your ' + kfmt(s.priv.points) + ' points on themes, rings and headers.', 'points shop themes rings premium'],
    ['notifications', 'notifications-outline', 'Notifications', 'Choose which heat, comments, follows and messages you hear about.', 'pause heat freeze comments likes follows messages'],
    ['privacy', 'shield-checkmark-outline', 'Privacy and safety', 'Private account, who can message you, and hidden counts.', 'private message hide counts'],
    ['display', 'contrast-outline', 'Display and languages', 'Theme and appearance.', 'theme dark light appearance'],
    ['help', 'help-circle-outline', 'Help Center', 'User agreement, report a problem and about Temp.', 'agreement terms report about'],
  ];
  const ql = q.trim().toLowerCase(); const shown = ql ? rows.filter((r) => (r[2] + ' ' + r[3] + ' ' + r[4]).toLowerCase().includes(ql)) : rows;
  const go = (k) => (k === 'shop' ? nav.push('shop') : k === 'earnings' ? nav.push('earnings') : setSub(k));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Settings" sub={'@' + (me.handle || '')} back />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 16, height: 46, marginTop: 4, marginBottom: 6 }}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search settings" placeholderTextColor={C.muted} style={{ flex: 1, color: C.ink, fontSize: 16, fontFamily: F.b }} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close" size={18} color={C.muted} /></Pressable> : null}
        </View>
        {shown.map(([k, ic, t, d]) => (
          <Pressable key={k} onPress={() => go(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Ionicons name={ic} size={24} color={C.ink} />
            <View style={{ flex: 1 }}><T h style={{ fontSize: 16.5 }}>{t}</T><T muted style={{ fontSize: 14, marginTop: 3, lineHeight: 19 }}>{d}</T></View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>))}
        {!shown.length ? <Empty text={'No settings match “' + q + '”'} /> : null}
      </ScrollView>
    </View>
  );
}

/* ---------------- Creator Studio: Sparks you earned from gifts, and cash out ---------------- */
const money = (c) => '$' + (Math.max(0, +c || 0) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const PAYOUT = [['paypal', 'PayPal', 'PayPal email'], ['cashapp', 'Cash App', '$Cashtag'], ['venmo', 'Venmo', '@username'], ['zelle', 'Zelle', 'Zelle email or phone'], ['bank', 'Bank', 'Bank']];
const GIFT_NAMES = { spark: 'Spark', ember: 'Ember', icecube: 'Ice Cube', hotsauce: 'Hot Sauce', rose: 'Ember Rose', thermo: 'Heat Check', heart: 'Molten Heart', mic: 'Mic Drop', crown: 'Fire Crown', volcano: 'Volcano', meteor: 'Meteor', phoenix: 'Phoenix' };
export function EarningsScreen() {
  const { C, nav } = useApp(); const [d, setD] = useState(null); const [err, setErr] = useState(''); const [edit, setEdit] = useState(false); const [pick, setPick] = useState(false);
  const [m, setM] = useState('paypal'); const [h, setH] = useState(''); const [nm, setNm] = useState(''); const [amt, setAmt] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const load = async () => { const { data, error } = await sb.rpc('my_earnings'); if (error) { setErr(/function|schema cache|does not exist/i.test(error.message) ? 'Creator Studio is being set up. Check back soon.' : friendly(error)); return; } setD(data); };
  useEffect(() => { load(); }, []);
  const startEdit = () => { const p = d && d.payout; setM(p ? p.method : 'paypal'); setH(p ? p.handle : ''); setNm(p ? p.legal_name : ''); setMsg(''); setEdit(true); };
  const save = async () => { setMsg(''); setBusy(true); const { data, error } = await sb.rpc('set_payout_details', { method: m, handle: h, legal_name: nm }); setBusy(false);
    if (error) return setMsg(friendly(error)); setD(data); setEdit(false); nav.toast('Payout details saved'); };
  const cash = async (all) => { setMsg(''); let cents = null;
    if (!all) { cents = Math.round(parseFloat(String(amt).replace(/[^0-9.]/g, '')) * 100); if (!(cents >= 1000)) return setMsg('The smallest cash out is $10.'); if (cents > d.balance) return setMsg('That’s more than your balance.'); }
    setBusy(true); const { data, error } = await sb.rpc('request_cashout', { amount_cents: cents }); setBusy(false);
    if (error) return setMsg(friendly(error)); setD(data); setPick(false); setAmt(''); nav.toast('Cashed out! It’s on its way to you.'); };
  const bal = d ? Math.round(+d.balance) : 0; const INP = { backgroundColor: C.bg, borderRadius: 14, padding: 13, color: C.ink, fontFamily: F.body, fontSize: 16 };
  const Row = ({ left, sub, right, plus }) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, marginTop: -1 }}>
    <View style={{ flex: 1 }}>{left}{sub ? <T muted style={{ fontSize: 13, marginTop: 2 }}>{sub}</T> : null}</View><T h style={{ color: plus ? C.orange : C.ink }}>{right}</T></View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Creator Studio" back />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        {err ? <Empty text={err} /> : !d ? <Empty text="Loading…" /> : <>
          <FlowBox r={26} style={{ backgroundColor: C.card, padding: 20 }}>
            <T muted>Your balance</T><T d style={{ fontSize: 42, letterSpacing: -1.6, marginTop: 4 }}>{money(bal)}</T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>{[[(+d.sparks || 0).toLocaleString(), 'Sparks received'], [money(d.lifetime), 'Earned all time'], [money(d.paid), 'Paid out']].map(([a, b]) =>
              <View key={b} style={{ flex: 1 }}><T h style={{ fontSize: 16 }}>{a}</T><T muted style={{ fontSize: 12.5 }}>{b}</T></View>)}</View>
            {d.pending > 0 ? <T muted style={{ marginTop: 10 }}>{money(d.pending)} on its way to you.</T> : null}
            {bal < 1000 ? <>
              <View style={{ height: 10, borderRadius: 6, backgroundColor: C.bg, marginTop: 14, overflow: 'hidden' }}><View style={{ width: Math.max(2, bal / 10) + '%', height: '100%', borderRadius: 6, backgroundColor: C.orange }} /></View>
              <T muted style={{ marginTop: 8 }}>{money(1000 - Math.max(0, bal))} to go. You can cash out the moment you hit $10.00, any time, as often as you want.</T></>
            : <>
              <Btn kind="orange" title={busy ? 'One sec…' : 'Cash out ' + money(bal) + ' now'} disabled={busy || !d.adult || !d.payout} onPress={() => cash(true)} style={{ marginTop: 14 }} />
              {d.payout && d.adult ? <Pressable onPress={() => { setPick(!pick); setAmt((bal / 100).toFixed(2)); }} style={{ marginTop: 10, alignSelf: 'center' }}><T h muted style={{ fontSize: 14 }}>Cash out a different amount</T></Pressable> : null}
              {pick ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><TextInput value={amt} onChangeText={setAmt} placeholder="Amount" placeholderTextColor={C.muted} keyboardType="decimal-pad" style={[INP, { flex: 1 }]} /><Btn kind="orange" title="Cash out" disabled={busy} onPress={() => cash(false)} /></View> : null}</>}
            {!d.adult ? <T b style={{ color: C.orange, marginTop: 10 }}>You need to be 18 or older to cash out. Check your birthday in Settings.</T> : null}
            {bal >= 1000 && d.adult && !d.payout ? <T muted style={{ marginTop: 10 }}>Add where to send your money below, then cash out.</T> : null}
            {msg && !edit ? <T b style={{ color: C.orange, marginTop: 10 }}>{msg}</T> : null}
          </FlowBox>
          <T b muted style={{ marginTop: 18, marginBottom: 6, marginLeft: 4 }}>PAYOUT DETAILS</T>
          {!edit ? <Pressable onPress={startEdit}><FlowBox r={24} style={{ backgroundColor: C.card, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="wallet-outline" size={20} color={C.ink} />
            <View style={{ flex: 1 }}>{d.payout ? <><T h>{(PAYOUT.find((x) => x[0] === d.payout.method) || [0, d.payout.method])[1]} · {d.payout.handle}</T><T muted style={{ fontSize: 13, marginTop: 2 }}>{d.payout.legal_name}</T></>
              : <><T h>Add payout details</T><T muted style={{ fontSize: 13, marginTop: 2 }}>PayPal, Cash App, Venmo or Zelle</T></>}</View>
            <T muted>{d.payout ? 'Edit' : ''}</T><Ionicons name="chevron-forward" size={18} color={C.muted} /></FlowBox></Pressable>
          : <FlowBox r={24} style={{ backgroundColor: C.card, padding: 16, gap: 10 }}>
            <T h>Send my money to</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{PAYOUT.filter((x) => x[0] !== 'bank').map(([k, l]) => <Pressable key={k} onPress={() => setM(k)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 13, backgroundColor: m === k ? C.ink : C.bg }}><T h style={{ color: m === k ? C.bg : C.ink }}>{l}</T></Pressable>)}</View>
            <TextInput value={h} onChangeText={setH} placeholder={PAYOUT.find((x) => x[0] === m)[2]} placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} maxLength={120} style={INP} />
            <TextInput value={nm} onChangeText={setNm} placeholder="Full name on that account" placeholderTextColor={C.muted} autoComplete="name" textContentType="name" maxLength={100} style={INP} />
            <T muted style={{ fontSize: 13 }}>Only you can see this. Double check it, we send your money exactly here.</T>
            {msg ? <T b style={{ color: C.orange }}>{msg}</T> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}><Btn kind="ghost" title="Cancel" onPress={() => setEdit(false)} style={{ flex: 1 }} /><Btn kind="orange" title={busy ? 'One sec…' : 'Save'} disabled={busy} onPress={save} style={{ flex: 1 }} /></View>
          </FlowBox>}
          <T b muted style={{ marginTop: 18, marginBottom: 6, marginLeft: 4 }}>HOW IT WORKS</T>
          <FlowBox r={24} style={{ backgroundColor: C.card, padding: 16 }}><T style={{ lineHeight: 21 }}>When someone sends you a gift on Live with Sparks they bought, you keep <T h>{Math.round((d.rate || 0.6) * 100)}%</T> of what those Sparks are worth and Temp keeps the rest to run the app. Gifts made with free daily Sparks show up here but don’t earn money. Cash out any time once you have $10. No waiting periods, no monthly limits, no fees from Temp. We send it as fast as we can, usually within 2 business days.</T></FlowBox>
          <T b muted style={{ marginTop: 18, marginBottom: 6, marginLeft: 4 }}>HISTORY</T>
          <FlowBox r={24} style={{ backgroundColor: C.card, paddingHorizontal: 16 }}>
            {(d.history || []).length ? d.history.map((r) => <Row key={r.id} left={<T h>{r.kind === 'gift' ? (GIFT_NAMES[r.gift_id] || 'Gift') + ' from @' + (r.from_handle || 'someone') : r.kind === 'cashout' ? 'Cash out' : r.kind === 'refund' ? 'Cash out returned' : 'Adjustment'}</T>}
              sub={(r.kind === 'gift' ? (r.sparks || 0).toLocaleString() + ' Sparks' + (r.note ? ' · ' + r.note : '') : r.note || '') + ' · ' + ago(Date.now() - new Date(r.created_at))}
              right={+r.cents < 0 ? '−' + money(-r.cents) : '+' + money(r.cents)} plus={+r.cents >= 0} />)
              : <T muted style={{ paddingVertical: 14 }}>Gifts you receive on Live show up here.</T>}
          </FlowBox>
          {(d.cashouts || []).length ? <><T b muted style={{ marginTop: 18, marginBottom: 6, marginLeft: 4 }}>CASH OUTS</T>
            <FlowBox r={24} style={{ backgroundColor: C.card, paddingHorizontal: 16 }}>{d.cashouts.map((c) => <Row key={c.id} left={<T h>{money(c.cents)} to {(PAYOUT.find((x) => x[0] === c.method) || [0, c.method])[1]}</T>} sub={ago(Date.now() - new Date(c.created_at))} right={c.status === 'pending' ? 'On its way' : c.status === 'paid' ? 'Paid' : 'Returned'} plus={c.status === 'paid'} />)}</FlowBox></> : null}
        </>}
      </ScrollView>
    </View>
  );
}

/* ---------------- lingering thoughts ---------------- */
// a short daily thought floating on your profile like a see-through bubble, with a three-bubble tail toward your picture
function ThoughtBubble({ u, isMe, onOpen }) {
  const { C } = useApp(); const t = u.thought; const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 2300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 2300, easing: Easing.inOut(Easing.ease), useNativeDriver: true })])); a.start(); return () => a.stop(); }, []);
  const y = (d) => ({ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4 + d] }) }] });
  const glass = { backgroundColor: C.dark ? 'rgba(28,28,28,.62)' : 'rgba(255,255,255,.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,.45)', shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } };
  const rs = t ? Object.entries(t.reacts).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  return (
    <Pressable onPress={onOpen} accessibilityLabel={t ? 'Lingering thought: ' + t.text : 'Add a lingering thought'} style={{ marginTop: -64, marginRight: 2, maxWidth: 240 }}>
      <Animated.View style={[{ borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 }, glass, y(0)]}>
        {t ? <T h style={{ fontSize: 14.5, lineHeight: 19 }}>{t.text}</T> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Ionicons name="add" size={15} color={C.muted} /><T h muted style={{ fontSize: 14.5 }}>Lingering thought…</T></View>}
        {rs.length ? <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>{rs.map(([e, n]) => <T key={e} h style={{ fontSize: 12.5 }}>{e}{n > 1 ? n : ''}</T>)}</View> : null}
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 6, bottom: -12, width: 14, height: 14, borderRadius: 7 }, glass, y(0.6)]} />
      <Animated.View style={[{ position: 'absolute', left: -6, bottom: -24, width: 9, height: 9, borderRadius: 5 }, glass, y(1.2)]} />
      <Animated.View style={[{ position: 'absolute', left: -16, bottom: -33, width: 6, height: 6, borderRadius: 3 }, glass, y(1.8)]} />
    </Pressable>
  );
}
const THOUGHT_REACTS = ['🔥', '😂', '😮', '🧊', '💯', '👀'];
function ThoughtSheet({ u, uid, isMe, onClose }) {
  const { s, C, run } = useApp(); const t = u.thought; const [txt, setTxt] = useState(isMe && t ? t.text : ''); const [reply, setReply] = useState('');
  const sendReply = () => { const r = reply.trim(); if (!r) return; onClose(); run(() => act.dm(uid, { text: r, note: 'Replied to your thought: “' + t.text + '”' }), { toast: 'Sent to @' + u.handle }); };
  return (
    <Sheet visible onClose={onClose} title={isMe ? 'Your lingering thought' : 'Lingering thought'}>
      {isMe ? <View style={{ gap: 10 }}>
        <T muted>A short thought that floats on your profile for 24 hours. People can react or reply in your DMs.</T>
        <TextInput value={txt} onChangeText={setTxt} maxLength={80} multiline placeholder="What’s on your mind?" placeholderTextColor={C.muted}
          style={{ backgroundColor: C.soft, borderRadius: 16, padding: 14, color: C.ink, fontFamily: F.bold, fontSize: 17, minHeight: 70 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><T muted style={{ flex: 1 }}>{80 - txt.length}</T>
          {t ? <Btn kind="ghost" title="Clear" onPress={() => { onClose(); run(() => act.thought(s.me, null), { toast: 'Thought cleared' }); }} /> : null}
          <Btn kind="orange" title={t ? 'Update' : 'Share'} disabled={!txt.trim() || (t && txt.trim() === t.text)} onPress={() => { const v = txt.trim(); onClose(); run(() => act.thought(s.me, v), { toast: 'Thought posted' }); }} /></View>
        {t && Object.keys(t.reacts).length ? <T muted>Reactions: {Object.entries(t.reacts).map(([e, n]) => e + ' ' + n).join('   ')}</T> : null}
      </View> : <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}><Avatar u={u} size={40} /><View style={{ flex: 1 }}><T h>{u.name} <T muted>· {ago(Date.now() - t.at)}</T></T><T b style={{ fontSize: 17, marginTop: 4 }}>{t.text}</T></View></View>
        <View style={{ flexDirection: 'row', gap: 8 }}>{THOUGHT_REACTS.map((e) => <Pressable key={e} onPress={() => run(() => act.thoughtReact(uid, s.me, t.mine === e ? null : e), { toast: t.mine === e ? null : 'Reacted ' + e })}
          style={{ flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: t.mine === e ? 'rgba(255,85,0,.22)' : C.soft, borderWidth: t.mine === e ? 2 : 0, borderColor: C.orange }}><T style={{ fontSize: 24 }}>{e}</T></Pressable>)}</View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={reply} onChangeText={setReply} placeholder={'Reply to @' + u.handle + '…'} placeholderTextColor={C.muted} maxLength={280} onSubmitEditing={sendReply} returnKeyType="send"
            style={{ flex: 1, backgroundColor: C.soft, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11, color: C.ink, fontFamily: F.body, fontSize: 16 }} />
          <Btn kind="orange" small title="Send" disabled={!reply.trim()} onPress={sendReply} /></View>
      </View>}
    </Sheet>
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
  const using = (k, id) => (k === 'themes' ? (s.priv.theme || 'ember') === id : k === 'rings' ? me.ring === id : k === 'headers' ? me.headerFx === id : k === 'styles' ? (s.priv.settings || {}).btn === id : false);
  const Action = ({ k, it, price }) => {
    if (!isOwned(k, it.id) && it.price > 0) return <Btn small kind="orange" title={price + ' pts'} disabled={s.priv.points < price} onPress={() => run(() => act.buy(k, it.id), { toast: 'Unlocked' })} />;
    if (k === 'stickers' || it.id === 'gif' || it.id === 'studio') return <Btn small kind="ghost" title="Owned" disabled />;
    const on = using(k, it.id);
    if (k === 'styles') return <Btn small kind={on ? 'ghost' : 'ink'} title={on ? 'Remove' : 'Use'} onPress={() => run(() => act.settings(s.me, { ...(s.priv.settings || {}), btn: on ? null : it.id }))} />;
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
    if (k === 'styles') return <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Ionicons name="flame" size={24} color="#ff5500" /><Ionicons name="snow" size={24} color={C.ink} /><Ionicons name="heart-outline" size={24} color={C.ink} /></View>;
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
        <SegTabs items={[['stickers', 'Stickers'], ['themes', 'Themes'], ['rings', 'Rings'], ['headers', 'Headers'], ['styles', 'Icons']]} value={tab} onChange={setTab} size={13} style={{ marginTop: 20, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {items.map((it) => <Card key={it.id} k={tab} it={it} price={it.price} />)}
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------------- composer ---------------- */
export function Composer({ reel: reel0, onClose, quoteOf }) {
  const { s, C, run, nav } = useApp(); const me = s.users[s.me] || {};
  const [reel, setReel] = useState(!!reel0); const [gifOpen, setGifOpen] = useState(false); const [text, setText] = useState(''); const [asset, setAsset] = useState(null); const [busy, setBusy] = useState(false); const [crop, setCrop] = useState(false); const [poll, setPoll] = useState(null);
  const max = 280, over = text.length > max;
  const ok = !over && (reel ? text.trim() || (asset && asset.type === 'video') : text.trim() || asset || quoteOf);
  const pl = !reel && poll ? poll.map((x) => x.trim()).filter(Boolean) : null;
  const post = async () => { if (pl && pl.length < 2) { nav.toast('Give your poll at least 2 options.'); return; } setBusy(true); const done = await run(() => act.post(s.me, { text: text.trim(), asset, reel: reel && !quoteOf, quoteOf, poll: pl ? { o: pl.map((x) => x.slice(0, 40)) } : null }), { toast: quoteOf ? 'Quote reflamed' : reel ? 'Replay posted' : 'Posted' }); setBusy(false); if (done) onClose(); };
  return (
    <Sheet visible onClose={onClose} full>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Btn small kind="ghost" title="Cancel" onPress={onClose} />
        <FlowBox r={15} style={{ flexDirection: 'row', backgroundColor: C.soft, padding: 3 }}>
          {(quoteOf ? [[false, 'Quote']] : [[false, 'Post'], [true, 'Replay']]).map(([v, l]) => <Pressable key={l} onPress={() => { setReel(v); if (v && asset && asset.type !== 'video') setAsset(null); }}
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
          {quoteOf ? <QuoteCard id={quoteOf} /> : null}
          {poll && !reel ? <View style={{ gap: 8, marginTop: 8 }}>
            {poll.map((v, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TextInput value={v} onChangeText={(x) => setPoll(poll.map((y, j) => (j === i ? x : y)))} placeholder={'Option ' + (i + 1)} placeholderTextColor={C.muted} maxLength={40}
                style={{ flex: 1, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: C.ink, fontFamily: F.body, fontSize: 16 }} />
              {poll.length > 2 ? <Pressable onPress={() => setPoll(poll.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove option"><Ionicons name="close" size={18} color={C.muted} /></Pressable> : null}</View>)}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {poll.length < 4 ? <Pressable onPress={() => setPoll([...poll, ''])}><T h style={{ color: C.orange }}>+ Add option</T></Pressable> : <View />}
              <Pressable onPress={() => setPoll(null)}><T h muted>Remove poll</T></Pressable></View>
            <T muted style={{ fontSize: 12.5 }}>Polls stay open for 24 hours.</T></View> : null}
          {asset ? <View style={{ borderRadius: 20, overflow: 'hidden', marginTop: 6 }}>
            {asset.type === 'video' ? <Video uri={asset.uri} style={{ width: '100%', height: 220 }} /> : <Image source={{ uri: asset.uri }} resizeMode="cover" style={{ width: '100%', aspectRatio: asset.width && asset.height ? Math.max(0.6, Math.min(2, asset.width / asset.height)) : 1.4, backgroundColor: C.soft }} />}
            {asset.type !== 'video' && !asset.gif ? <Pressable onPress={() => setCrop(true)} accessibilityLabel="Crop and resize" style={{ position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,.6)' }}>
              <Ionicons name="crop" size={16} color="#fff" /><T h style={{ color: '#fff', fontSize: 13 }}>Crop</T></Pressable> : null}
            <Pressable onPress={() => setAsset(null)} accessibilityLabel="Remove" style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color="#fff" /></Pressable></View> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {!reel ? <Btn small kind="ghost" icon="image-outline" title="Photo" onPress={async () => { const a = await pickMedia('image'); if (a) { setAsset(a); setGifOpen(false); setCrop(true); } }} /> : null}
          {!reel ? <Btn small kind={gifOpen ? 'ink' : 'ghost'} title="GIF" onPress={() => setGifOpen(!gifOpen)} /> : null}
          {!reel && !quoteOf ? <Btn small kind={poll ? 'ink' : 'ghost'} icon="stats-chart-outline" title="Poll" onPress={() => setPoll(poll ? null : ['', ''])} /> : null}
          {reel ? <Btn small kind="orange" icon="radio-button-on" title="Record" onPress={() => { onClose(); setTimeout(() => nav.sheet('recorder', { mode: 'replay' }), 250); }} /> : null}
          <Btn small kind="ghost" icon="videocam-outline" title={reel ? 'Upload' : 'Video'} onPress={async () => { const a = await pickMedia('video'); if (a) setAsset(a); }} />
        </View>
        <T b style={{ color: over ? C.orange : C.muted, fontSize: 13 }}>{max - text.length}</T>
      </View>
      {crop && asset ? <CropEditor asset={asset} onClose={() => setCrop(false)} onDone={(a) => { setAsset(a); setCrop(false); }} /> : null}
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
  const g = useRef({}); g.current = { next, back: () => { if (ii > 0 || ui > 0) prev(); else restart(); }, onClose, setHold, hold };
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
      if (x < Dimensions.get('window').width * 0.35) g.current.back(); else g.current.next();
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
        <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, right: 0, top: 100, bottom: 160 }} accessible accessibilityLabel="Story. Tap left for the previous story, tap right for next, hold to pause, swipe down to close" />
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
