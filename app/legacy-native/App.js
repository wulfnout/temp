import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Pressable, Text, BackHandler, Animated, ActivityIndicator, AppState, PanResponder, Dimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { Figtree_500Medium, Figtree_700Bold, Figtree_800ExtraBold } from '@expo-google-fonts/figtree';
import { sb, useColors, friendly, isNetErr, F } from './src/lib';
import { loadAll, EMPTY, act } from './src/data';
import { Ctx, Avatar, tapAway } from './src/ui';
import { AuthScreen, TermsGate, TermsScreen, TERMS_V } from './src/auth';
import { HomeScreen, ReplayScreen, SearchScreen, ActivityScreen, DMListScreen, ThreadScreen, PostScreen, accRemember } from './src/screens';
import { ProfileScreen, SettingsScreen, ShopScreen, Composer, StoryViewer, StoryDraft } from './src/profile';
import { CommentsSheet, ShareSheet, PostMenu } from './src/posts';
import { Recorder } from './src/recorder';
import { Intro } from './src/ash';
import { LiveScreen, GoLiveScreen } from './src/live';
import { ClockKeeper } from './src/fx';

// Android: show what went wrong instead of a frozen screen
class AndroidBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err || Platform.OS !== 'android') { if (this.state.err) throw this.state.err; return this.props.children; }
    return <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Temp hit a snag</Text>
      <Text selectable style={{ color: 'rgba(255,255,255,.7)', textAlign: 'center' }}>{String((this.state.err && this.state.err.message) || this.state.err)}</Text>
      <Pressable onPress={() => this.setState({ err: null })} style={{ backgroundColor: '#ff5500', borderRadius: 15, paddingHorizontal: 22, paddingVertical: 12 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Try again</Text></Pressable>
    </View>;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({ Unbounded_700Bold, Unbounded_800ExtraBold, Figtree_500Medium, Figtree_700Bold, Figtree_800ExtraBold });
  const [ready, setReady] = useState(false); const [intro, setIntro] = useState(true);
  useEffect(() => { const t = setTimeout(() => setReady(true), 2500); return () => clearTimeout(t); }, []);
  // Android: the intro always gets out of the way, even if its animation never reports finishing
  useEffect(() => { if (Platform.OS !== 'android') return; const t = setTimeout(() => setIntro(false), 6500); return () => clearTimeout(t); }, []);
  return (
    <SafeAreaProvider>
      {fontsLoaded || ready ? <View style={{ flex: 1 }}>{Platform.OS === 'android' ? <AndroidBoundary><Root /></AndroidBoundary> : <Root />}{intro ? <Intro onDone={() => setIntro(false)} /> : null}</View> : <View style={{ flex: 1, backgroundColor: '#000' }} />}
    </SafeAreaProvider>
  );
}

function Root() {
  const [session, setSession] = useState(undefined); const [bootErr, setBootErr] = useState(null);
  const [s, setS] = useState(EMPTY);
  const C = useColors(s.priv.theme, (s.priv.settings || {}).theme);
  const [tab, setTab] = useState({ name: 'home', params: {} });
  const [stack, setStack] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const myId = session && session.user && session.user.id;

  useEffect(() => {
    if (Platform.OS === 'android') {
      // Android safety net: never sit on the spinner — if restoring the session fails or hangs, say so and offer a retry
      let done = false; const t = setTimeout(() => { if (!done) setBootErr('Taking too long to connect.'); }, 9000);
      sb.auth.getSession().then(({ data }) => { done = true; clearTimeout(t); setSession(data.session || null); })
        .catch((e) => { done = true; clearTimeout(t); setBootErr((e && e.message) || 'Couldn’t start.'); });
    } else sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data } = sb.auth.onAuthStateChange((_e, ses) => { if (ses) accRemember(ses); setSession(ses || null); });
    return () => data.subscription.unsubscribe();
  }, []);

  const loading = useRef(false), again = useRef(false);
  const [typing, setTyping] = useState({}); const typingT = useRef({}); const liveRef = useRef(null); const lastTyped = useRef(0);
  const sendTyping = (to) => { const n = Date.now(); if (n - lastTyped.current < 1500 || !liveRef.current) return; lastTyped.current = n;
    try { liveRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: myId, to } }); } catch (e) {} };
  const remembered = useRef(false);
  useEffect(() => { remembered.current = false; }, [myId]);
  const reload = useCallback(async () => {
    if (!myId) return;
    if (loading.current) { again.current = true; return; }
    loading.current = true;
    // background refresh: quietly retry dropped connections instead of showing an error
    for (let i = 0; i < 3; i++) {
      try { const d = await loadAll(myId); setS(d); if (!remembered.current) { remembered.current = true; sb.auth.getSession().then(({ data }) => accRemember(data.session, d.users[d.me])); } break; }
      catch (e) { if (!isNetErr(e)) { say(friendly(e)); break; } await new Promise((r) => setTimeout(r, 1200 * (i + 1))); }
    }
    loading.current = false;
    if (again.current) { again.current = false; reload(); }
  }, [myId]);

  // stories disappear 24 hours after they're posted, even while the app stays open
  useEffect(() => { const t = setInterval(() => setS((x) => {
    const fresh = x.stories.map((g) => ({ ...g, items: g.items.filter((i) => Date.now() - i.at < 864e5) })).filter((g) => g.items.length);
    return fresh.reduce((n, g) => n + g.items.length, 0) === x.stories.reduce((n, g) => n + g.items.length, 0) ? x : { ...x, stories: fresh };
  }), 30000); return () => clearInterval(t); }, []);
  // refresh when coming back to the app
  useEffect(() => { const sub = AppState.addEventListener('change', (st) => { if (st === 'active') reload(); }); return () => sub.remove(); }, [reload]);

  useEffect(() => {
    if (!myId) { setS(EMPTY); setStack([]); setTab({ name: 'home', params: {} }); return; }
    reload();
    let t = null; const soon = () => { clearTimeout(t); t = setTimeout(reload, 400); };
    const ch = sb.channel('app-' + myId).on('postgres_changes', { event: '*', schema: 'public' }, soon).subscribe();
    // "is typing…" — shares the website's live channel so it works between app and web
    const live = sb.channel('live', { config: { presence: { key: myId } } });
    live.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload || payload.to !== myId) return; const from = payload.from;
      setTyping((x) => ({ ...x, [from]: true })); clearTimeout(typingT.current[from]);
      typingT.current[from] = setTimeout(() => setTyping((x) => ({ ...x, [from]: false })), 3500);
    }).subscribe(); liveRef.current = live;
    const tick = setInterval(reload, 60000); // catches posts that expired on the server
    return () => { clearTimeout(t); clearInterval(tick); sb.removeChannel(ch); sb.removeChannel(live); liveRef.current = null; };
  }, [myId]);

  const toastT = useRef(null);
  function say(msg) { setToast(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2400); }

  // run a write: optional instant local change, then reload from the database
  async function run(fn, opts = {}) {
    if (opts.optimistic) {
      const { post, patch } = opts.optimistic;
      setS((x) => ({ ...x, posts: x.posts.map((p) => (p.id === post ? { ...p, ...patch } : p)) }));
    }
    try { await fn(); if (opts.toast) say(opts.toast); await reload(); return true; }
    catch (e) { say(friendly(e)); await reload(); return false; }
  }

  const lastTab = useRef(null);
  // swipe in from the left edge to go back a page
  const edgeX = useRef(new Animated.Value(0)).current; const stackRef = useRef(stack); stackRef.current = stack;
  const edge = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, d) => stackRef.current.length > 0 && d.x0 < 40 && d.dx > 10 && Math.abs(d.dx) > Math.abs(d.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (e, d) => edgeX.setValue(Math.max(0, d.dx)),
    onPanResponderRelease: (e, d) => {
      const W = Dimensions.get('window').width;
      if (d.dx > W * 0.3 || d.vx > 0.6) Animated.timing(edgeX, { toValue: W, duration: 170, useNativeDriver: true }).start(() => { setStack((st) => st.slice(0, -1)); requestAnimationFrame(() => edgeX.setValue(0)); }); // always bound to edgeX so the page underneath slides back to 0 (an unbound native transform stayed off-screen = blank page)
      else Animated.spring(edgeX, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(edgeX, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  const nav = {
    tab: (name, params = {}) => { if (tab.name !== 'replay' && tab.name !== name) lastTab.current = tab; setStack([]); setTab({ name, params }); },
    leaveReplay: () => { const t = lastTab.current; setStack([]); setTab(t && t.name !== 'replay' ? t : { name: 'home', params: {} }); },
    push: (name, params = {}) => setStack((st) => [...st, { name, params }]),
    back: () => setStack((st) => st.slice(0, -1)),
    sheet: (name, params = {}) => setSheet({ name, params }),
    toast: say,
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) { setSheet(null); return true; }
      if (stack.length) { nav.back(); return true; }
      if (tab.name !== 'home') { nav.tab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [sheet, stack, tab]);

  async function postStory(asset, caption, layout) {
    setSheet(null); setUploading(true); say('Uploading your story…');
    await run(() => act.story(s.me, asset, caption, layout), { toast: 'Your story is up' });
    setUploading(false);
  }
  // home feed hides the header and tab bar while scrolling down
  const bars = useRef(new Animated.Value(0)).current; const barsHidden = useRef(false);
  const setBars = useCallback((hide) => { if (barsHidden.current === hide) return; barsHidden.current = hide;
    Animated.timing(bars, { toValue: hide ? 1 : 0, duration: 200, useNativeDriver: true }).start(); }, []);
  const [tabH, setTabH] = useState(90);
  // Ash: burn your own post away for points. The animation plays first, then the server takes the points and removes it.
  const ASH_COST = 100; const [ashing, setAshing] = useState(null); const ashDone = useRef(null);
  const finishAsh = async (id) => {
    if (ashDone.current === id) return; ashDone.current = id; setAshing(null);
    setS((x) => ({ ...x, posts: x.posts.filter((q) => q.id !== id) }));
    try { await act.ash(id); say('Burned to ash'); } catch (e) { say(friendly(e)); }
    reload();
  };
  const ash = (p) => {
    if ((s.priv.points || 0) < ASH_COST) return say('Ashing a post costs ' + ASH_COST + ' pts.');
    ashDone.current = null; setAshing(p.id); setTimeout(() => finishAsh(p.id), 4000);
  };
  const ctx = { s, C, run, nav, reload, uploading, postStory, bars, setBars, ashing, ash, finishAsh, ASH_COST, typing, sendTyping };

  if (session === undefined) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30 }}>
    {bootErr ? <>
      <Text style={{ color: C.ink, fontSize: 16, textAlign: 'center' }}>{bootErr}</Text>
      <Pressable onPress={() => { setBootErr(null); sb.auth.getSession().then(({ data }) => setSession(data.session || null)).catch((e) => setBootErr((e && e.message) || 'Couldn’t start.')); }}
        style={{ backgroundColor: C.orange, borderRadius: 15, paddingHorizontal: 22, paddingVertical: 12 }}><Text style={{ color: C.onOrange, fontWeight: '800' }}>Try again</Text></Pressable>
      <Pressable onPress={() => setSession(null)}><Text style={{ color: C.muted }}>Sign in again</Text></Pressable>
    </> : <ActivityIndicator color={C.orange} />}</View>;
  if (!session) return <Ctx.Provider value={ctx}><StatusBar style={C.dark ? 'light' : 'dark'} /><AuthScreen /></Ctx.Provider>;
  if (((session.user || {}).user_metadata || {}).terms_version !== TERMS_V) return <Ctx.Provider value={ctx}><StatusBar style={C.dark ? 'light' : 'dark'} /><TermsGate /></Ctx.Provider>;

  const top = stack[stack.length - 1];
  const screen = (r) => {
    switch (r.name) {
      case 'home': return <HomeScreen />;
      case 'search': return <SearchScreen q={r.params.q} />;
      case 'replay': return <ReplayScreen startId={r.params.startId} />;
      case 'live': return <LiveScreen />;
      case 'golive': return <GoLiveScreen stream={r.params.stream} />;
      case 'me': return <ProfileScreen isTab />;
      case 'profile': return <ProfileScreen id={r.params.id} />;
      case 'activity': return <ActivityScreen />;
      case 'post': return <PostScreen id={r.params.id} />;
      case 'terms': return <TermsScreen />;
      case 'dms': return <DMListScreen />;
      case 'thread': return <ThreadScreen id={r.params.id} />;
      case 'settings': return <SettingsScreen />;
      case 'shop': return <ShopScreen />;
      default: return null;
    }
  };
  const current = top || tab;
  const dark = current.name === 'replay';
  const onHome = current.name === 'home';

  return (
    <Ctx.Provider value={ctx}>
      <StatusBar style={dark || C.dark ? 'light' : 'dark'} />
      <View {...tapAway} style={{ flex: 1, backgroundColor: C.bg }}>
        <ClockKeeper />
        <Animated.View {...edge.panHandlers} style={{ flex: 1, transform: [{ translateX: edgeX }] }}>{screen(current)}</Animated.View>
        {current.name !== 'thread' ? <Animated.View onLayout={(e) => setTabH(e.nativeEvent.layout.height)}
          style={onHome ? { position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ translateY: bars.interpolate({ inputRange: [0, 1], outputRange: [0, tabH] }) }] } : null}>
          <TabBar tab={tab.name} stacked={!!top} dark={dark} onTab={(n) => { setBars(false); return n === 'compose' ? nav.sheet('compose', { reel: tab.name === 'replay' }) : nav.tab(n); }} /></Animated.View> : null}
      </View>
      {sheet && sheet.name === 'compose' ? <Composer reel={sheet.params.reel} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.name === 'comments' ? <CommentsSheet id={sheet.params.id} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.name === 'share' ? <ShareSheet post={sheet.params.post} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.name === 'menu' ? <PostMenu post={sheet.params.post} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.name === 'story' ? <StoryViewer userId={sheet.params.userId} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.name === 'recorder' ? <Recorder startMode={sheet.params.mode || 'replay'} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.name === 'storyDraft' ? <StoryDraft asset={sheet.params.asset} onClose={() => setSheet(null)} /> : null}
      {toast ? <Toast text={toast} /> : null}
    </Ctx.Provider>
  );
}

function TabBar({ tab, stacked, dark, onTab }) {
  const { s, C } = React.useContext(Ctx); const ins = useSafeAreaInsets();
  const bg = dark ? '#000' : C.card, idle = dark ? '#8d8883' : C.muted, on = dark ? '#fff' : C.ink;
  const Item = ({ name, icon, label, children }) => {
    const active = !stacked && tab === name;
    return <Pressable onPress={() => onTab(name)} accessibilityLabel={label} style={{ width: 56, height: 46, alignItems: 'center', justifyContent: 'center' }}>
      {children || <Ionicons name={active ? icon : icon + '-outline'} size={25} color={active ? on : idle} />}
      {active ? <View style={{ position: 'absolute', bottom: 0, width: 5, height: 5, borderRadius: 2, backgroundColor: C.orange }} /> : null}
    </Pressable>;
  };
  return (
    <View style={{ backgroundColor: bg, borderTopWidth: 1, borderTopColor: dark ? '#1c1c1c' : C.line, paddingTop: 8, paddingBottom: ins.bottom + 8, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
      <Item name="home" icon="home" label="Home" />
      <Item name="search" icon="search" label="Search" />
      <Pressable onPress={() => onTab('compose')} accessibilityLabel="New post" style={{ ...(C.glow ? { shadowColor: C.orange, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 } : null), width: 54, height: 44, borderRadius: 15, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="add" size={28} color={C.onOrange} /></Pressable>
      <Item name="replay" icon="play-circle" label="Replay" />
      <Item name="me" label="Profile"><Avatar u={s.users[s.me]} size={28} /></Item>
    </View>
  );
}

function Toast({ text }) {
  const { C } = React.useContext(Ctx); const ins = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(a, { toValue: 1, useNativeDriver: true }).start(); }, [text]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: ins.bottom + 80, alignSelf: 'center', maxWidth: '88%', backgroundColor: C.ink, borderRadius: 15, paddingVertical: 11, paddingHorizontal: 18, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <Text style={{ color: C.bg, fontFamily: F.heavy, fontSize: 14, textAlign: 'center' }}>{text}</Text>
    </Animated.View>
  );
}
