// Live Takes tab: the live audio rooms run inside an embedded page (the same rooms as the website),
// signed in with this app's session so everyone ends up in the same rooms.
import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './ui';
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
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: ins.top }}>
      {uri ? <WebView ref={web} source={{ uri }} style={{ flex: 1, backgroundColor: C.bg }} originWhitelist={['*']}
        allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="grant"
        javaScriptEnabled domStorageEnabled startInLoadingState
        renderLoading={() => <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.orange} /></View>} />
        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.orange} /></View>}
    </View>
  );
}
