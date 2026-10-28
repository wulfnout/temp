// Temp app = the Temp website (temptakes.com) running full screen, so the app and every browser
// share one build: same designs, icons, themes, rings, headers and animations, always in sync.
// The native side only adds what a phone app needs: camera/mic access, picture-in-picture,
// the Android back button, status bar colour, an offline screen, and opening outside links.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, BackHandler, AppState, Linking, Platform, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const SITE = 'https://temptakes.com/';
const START = SITE + '?app=' + Platform.OS;
const ORIGIN = 'https://temptakes.com';

// runs before the page loads: lets the site know it's inside the app and gives it a way to talk back
const BOOT = `
  window.TEMP_APP = { platform: ${JSON.stringify(Platform.OS)}, version: 2 };
  window.tempNative = function (msg) { try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {} };
  true;
`;

export default function App() {
  const web = useRef(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(true);
  const [key, setKey] = useState(0);
  const backWait = useRef(null);

  const send = useCallback((js) => { try { web.current && web.current.injectJavaScript(js + ';true;'); } catch (e) {} }, []);

  // Android back button: the page closes sheets / goes back first; only when it has nowhere to go does the app close
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (failed) return false;
      send('(function(){var h=window.__tempBack&&window.__tempBack();window.tempNative({type:"back",handled:!!h})})()');
      clearTimeout(backWait.current);
      backWait.current = setTimeout(() => BackHandler.exitApp(), 600);
      return true;
    });
    return () => sub.remove();
  }, [failed]);

  // coming back to the app: let the page refresh what it shows
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => send('window.dispatchEvent(new CustomEvent("temp-app-state",{detail:' + JSON.stringify(st) + '}))'));
    return () => sub.remove();
  }, []);

  const onMessage = (e) => {
    let m; try { m = JSON.parse(e.nativeEvent.data); } catch (x) { return; }
    if (m.type === 'back') { if (m.handled) clearTimeout(backWait.current); }
    else if (m.type === 'theme') setDark(!!m.dark);
    else if (m.type === 'ready') setReady(true);
    else if (m.type === 'open' && m.url) Linking.openURL(m.url);
  };

  // links to other sites open in the phone's browser; temptakes.com stays in the app
  const onNav = (req) => {
    const u = req.url || '';
    if (u.startsWith(ORIGIN) || u.startsWith('about:') || u.startsWith('blob:') || u.startsWith('data:')) return true;
    if (/^https?:/.test(u) && req.isTopFrame !== false && req.navigationType === 'click') { Linking.openURL(u); return false; }
    return true;
  };

  if (failed) return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 16 }}>
      <StatusBar style="light" />
      <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1.5 }}>temp<Text style={{ color: '#ff5500' }}>.</Text></Text>
      <Text style={{ color: 'rgba(255,255,255,.7)', fontSize: 16, textAlign: 'center' }}>Temp can't connect right now. Check your connection and try again.</Text>
      <Pressable onPress={() => { setFailed(false); setReady(false); setKey((k) => k + 1); }} style={{ backgroundColor: '#ff5500', borderRadius: 16, paddingHorizontal: 26, paddingVertical: 13 }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Try again</Text></Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0a0a0a' : '#f4f2ef' }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <WebView
        key={key}
        ref={web}
        source={{ uri: START }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={BOOT}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onNav}
        onLoadEnd={() => setReady(true)}
        onError={() => setFailed(true)}
        onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed(true); }}
        onContentProcessDidTerminate={() => web.current && web.current.reload()}
        onRenderProcessGone={() => { setReady(false); setKey((k) => k + 1); }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsPictureInPictureMediaPlayback
        allowsAirPlayForMediaPlayback
        mediaCapturePermissionGrantType="grant"
        allowFileAccess
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        bounces={false}
        overScrollMode="never"
        pullToRefreshEnabled={false}
        setSupportMultipleWindows={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        textInteractionEnabled
        decelerationRate="normal"
        webviewDebuggingEnabled
      />
      {!ready ? (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <Text style={{ color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -2 }}>temp<Text style={{ color: '#ff5500' }}>.</Text></Text>
          <ActivityIndicator color="#ff5500" />
        </View>
      ) : null}
    </View>
  );
}
