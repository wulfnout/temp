// Live Takes tab: the live audio rooms run inside an embedded page (the same rooms as the website),
// signed in with this app's session so everyone ends up in the same rooms.
import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, AppState, Animated, PanResponder, Pressable } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, IconBtn, T } from './ui';
import { Header } from './screens';
import { sb } from './lib';

const SITE = 'https://wulfnout.github.io/temp/';

export function LiveScreen() {
  const { C } = useApp(); const ins = useSafeAreaInsets();
  const web = useRef(null); const [uri, setUri] = useState(null);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      const t = data.session && data.session.access_token; if (!t) return;
      setUri(SITE + '?embed=live&theme=' + (C.dark ? 'dark' : 'light') + '&accent=' + encodeURIComponent(C.orange) + '#t=' + encodeURIComponent(t));
    });
    // hand the page a fresh token whenever the app refreshes its sign-in
    const { data: sub } = sb.auth.onAuthStateChange((ev, ses) => {
      if (ses && web.current) web.current.injectJavaScript('window.__tempToken&&window.__tempToken(' + JSON.stringify(ses.access_token) + ');true;');
    });
    // keep room audio playing when the app goes to the background (listeners);
    // tell the page when we leave so speakers and hosts get muted
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, allowsRecording: true }).catch(() => {});
    const as = AppState.addEventListener('change', (st) => { if (st === 'background' && web.current) web.current.injectJavaScript('window.__tempBackground&&window.__tempBackground(true);true;'); });
    return () => { sub.subscription.unsubscribe(); as.remove(); setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, allowsRecording: false }).catch(() => {}); };
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header back title="Live Takes" />
      {uri ? <WebView ref={web} source={{ uri }} style={{ flex: 1, backgroundColor: C.bg }} originWhitelist={['*']}
        allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="grant"
        javaScriptEnabled domStorageEnabled startInLoadingState
        renderLoading={() => <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.orange} /></View>} />
        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.orange} /></View>}
    </View>
  );
}

// Go Live: a hidden page to the left of the home feed. Swipe in from the left edge to open it,
// swipe back (or tap back) to close. Every so often a little "GO LIVE" tab peeks out as a hint.
function GoLiveWeb({ onClose, stream }) {
  const { C } = useApp(); const web = useRef(null); const [uri, setUri] = useState(null);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { const t = data.session && data.session.access_token; if (t) setUri(SITE + '?embed=golive' + (stream ? '&stream=' + stream : '') + '&theme=' + (C.dark ? 'dark' : 'light') + '&accent=' + encodeURIComponent(C.orange) + '#t=' + encodeURIComponent(t)); });
    const { data: sub } = sb.auth.onAuthStateChange((ev, ses) => { if (ses && web.current) web.current.injectJavaScript('window.__tempToken&&window.__tempToken(' + JSON.stringify(ses.access_token) + ');true;'); });
    return () => sub.subscription.unsubscribe();
  }, []);
  // the page draws under the status bar itself (camera preview edge to edge), so no inset band at the top
  return uri ? <WebView ref={web} source={{ uri }} style={{ flex: 1, backgroundColor: '#000' }} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} originWhitelist={['*']} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
    mediaCapturePermissionGrantType="grant" javaScriptEnabled domStorageEnabled onMessage={(e) => { if (e.nativeEvent.data === 'close') onClose(); }} />
    : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.orange} /></View>;
}

export function GoLiveSide() {
  const { C, setBars } = useApp(); const { width: W } = require('react-native').Dimensions.get('window');
  const x = useRef(new Animated.Value(-W)).current; const [open, setOpen] = useState(false); const [mounted, setMounted] = useState(false);
  const peek = useRef(new Animated.Value(0)).current; const openRef = useRef(false); openRef.current = open;
  const show = (o) => { if (o) setMounted(true); setOpen(o); setBars && setBars(o); /* the live page covers the tab bar */ Animated.spring(x, { toValue: o ? 0 : -W, damping: 22, stiffness: 200, useNativeDriver: true }).start(() => { if (!o) setMounted(false); }); };
  const edge = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, d) => d.dx > 8 && Math.abs(d.dx) > Math.abs(d.dy) * 1.4,
    onPanResponderGrant: () => { setMounted(true); setBars && setBars(true); },
    onPanResponderMove: (e, d) => x.setValue(Math.min(0, -W + Math.max(0, d.dx))),
    onPanResponderRelease: (e, d) => show(d.dx > W * 0.3 || d.vx > 0.5),
    onPanResponderTerminate: () => show(false),
  })).current;
  // the hint: very occasionally, a tab slides out from the left edge and back
  useEffect(() => {
    let t; const plan = () => { t = setTimeout(() => {
      if (!openRef.current && Math.random() < 0.4) Animated.sequence([Animated.spring(peek, { toValue: 1, useNativeDriver: true }), Animated.delay(2200), Animated.timing(peek, { toValue: 0, duration: 350, useNativeDriver: true })]).start();
      plan(); }, (90 + Math.random() * 330) * 1000); };
    plan(); return () => clearTimeout(t);
  }, []);
  return <>
    <View {...edge.panHandlers} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, zIndex: 20 }} />
    <Animated.View style={{ position: 'absolute', left: 0, top: '30%', zIndex: 21, transform: [{ translateX: peek.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] }) }] }}>
      <Pressable onPress={() => show(true)} accessibilityLabel="Open Go Live" style={{ width: 44, height: 170, borderTopRightRadius: 26, borderBottomRightRadius: 26, backgroundColor: '#ff3d1a', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#ff5500', shadowOpacity: 0.6, shadowRadius: 14 }}>
        <T h style={{ color: '#fff', fontSize: 11.5, letterSpacing: 2, width: 140, textAlign: 'center', transform: [{ rotate: '-90deg' }] }}>GO LIVE</T></Pressable>
    </Animated.View>
    {mounted ? <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: W, zIndex: 30, backgroundColor: '#000', transform: [{ translateX: x }] }}>
      <GoLiveWeb onClose={() => show(false)} />
    </Animated.View> : null}
  </>;
}

// a specific live, opened from the Replay feed (full screen, back closes it)
export function GoLiveScreen({ stream }) {
  const { C, nav } = useApp();
  return <View style={{ flex: 1, backgroundColor: '#000' }}><GoLiveWeb stream={stream} onClose={() => nav.back()} /></View>;
}

// who's live right now, refreshed every 30s, for mixing into the Replay feed
export function useLiveNow() {
  const [list, setList] = useState([]);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      const since = new Date(Date.now() - 75e3).toISOString();
      const { data } = await sb.from('live_streams').select('id,host_id,title,created_at').is('ended_at', null).gte('last_seen', since).order('created_at', { ascending: false }).limit(10);
      if (!data || dead) return; const ids = [...new Set(data.map((x) => x.host_id))]; let prof = [];
      if (ids.length) { const r = await sb.from('profiles').select('id,name,handle,avatar_url,ring').in('id', ids); prof = r.data || []; }
      const pm = Object.fromEntries(prof.map((p) => [p.id, p]));
      const out = await Promise.all(data.map(async (x) => { const r = await sb.from('live_viewers').select('user_id', { count: 'exact', head: true }).eq('stream_id', x.id).gte('last_seen', new Date(Date.now() - 45e3).toISOString()); return { ...x, host: pm[x.host_id] || null, watching: Math.max(0, (r.count || 0) - 1) }; }));
      if (!dead) setList(out);
    };
    load(); const t = setInterval(load, 30000); return () => { dead = true; clearInterval(t); };
  }, []);
  return list;
}
