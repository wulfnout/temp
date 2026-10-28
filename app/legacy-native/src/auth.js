import React, { useState } from 'react';
import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, FlowBox, T, Btn } from './ui';
import { sb, F, friendly } from './lib';

function Field({ label, ...p }) {
  const { C } = useApp();
  return (
    <View style={{ gap: 6, marginTop: 14 }}>
      <T b muted style={{ fontSize: 13 }}>{label}</T>
      <TextInput placeholderTextColor={C.muted} autoCapitalize="none" {...p}
        style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: C.ink, fontFamily: F.body, fontSize: 16 }} />
    </View>
  );
}

export const TERMS_V = '2026-10-28';
export const TERMS_URL = 'https://temptakes.com/terms.html';
function Agree({ on, set }) {
  const { C } = useApp();
  return (
    <Pressable onPress={() => set(!on)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16 }} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: on ? C.orange : C.muted, backgroundColor: on ? C.orange : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on ? <Ionicons name="checkmark" size={15} color={C.onOrange} /> : null}</View>
      <T muted style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>I'm at least 13 and I agree to the <T h style={{ color: C.orange, fontSize: 14 }} onPress={() => Linking.openURL(TERMS_URL)}>User Agreement</T>, including the Community Rules.</T>
    </Pressable>
  );
}
// anyone who hasn't accepted the current version accepts it before using Temp
export function TermsGate() {
  const { C } = useApp(); const ins = useSafeAreaInsets(); const [on, setOn] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const accept = async () => { setBusy(true); const { error } = await sb.auth.updateUser({ data: { terms_version: TERMS_V, terms_at: new Date().toISOString() } }); if (!error) await sb.auth.refreshSession(); setBusy(false); if (error) setErr(friendly(error)); };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: ins.top + 12, paddingHorizontal: 16, paddingBottom: ins.bottom + 12 }}>
      <T d style={{ fontSize: 24, letterSpacing: -0.8 }}>User Agreement</T>
      <T muted style={{ marginTop: 4, marginBottom: 10 }}>Before you keep going, read and accept Temp's User Agreement and Community Rules.</T>
      <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: C.card }}><WebView source={{ uri: TERMS_URL + '?theme=' + (C.dark ? 'dark' : 'light') }} style={{ flex: 1, backgroundColor: C.card }} /></View>
      <Agree on={on} set={setOn} />
      {err ? <T b style={{ color: C.orange, marginTop: 10 }}>{err}</T> : null}
      <Btn kind="orange" title={busy ? '…' : 'Agree and continue'} disabled={!on || busy} onPress={accept} style={{ marginTop: 14, paddingVertical: 16 }} />
      <Pressable onPress={() => sb.auth.signOut({ scope: 'local' })} style={{ alignSelf: 'center', marginTop: 10 }}><T h muted>Log out</T></Pressable>
    </View>
  );
}
export function TermsScreen() {
  const { C, nav } = useApp(); const ins = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: ins.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <Pressable onPress={nav.back} accessibilityLabel="Back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={22} color={C.ink} /></Pressable>
        <T d style={{ fontSize: 19 }}>User Agreement</T></View>
      <WebView source={{ uri: TERMS_URL + '?theme=' + (C.dark ? 'dark' : 'light') }} style={{ flex: 1, backgroundColor: C.bg }} />
    </View>
  );
}

export function AuthScreen() {
  const { C } = useApp(); const ins = useSafeAreaInsets();
  const [mode, setMode] = useState('signup');
  const [f, setF] = useState({ name: '', handle: '', email: '', birth: '', pw: '', agree: false });
  const [err, setErr] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const up = (k) => (v) => { setF({ ...f, [k]: v }); setErr(''); };
  const go = (m) => { setMode(m); setErr(''); setNote(''); };

  async function submit() {
    if (busy) return; setErr(''); setNote('');
    const email = f.email.trim().toLowerCase();
    try {
      setBusy(true);
      if (mode === 'signup') {
        const handle = f.handle.trim().toLowerCase().replace(/^@/, '');
        if (!f.name.trim()) throw new Error('Enter your name.');
        if (!/^[a-z0-9._]{3,20}$/.test(handle)) throw new Error('Usernames are 3–20 letters, numbers, dots or underscores.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f.birth.trim())) throw new Error('Enter your birthday as YYYY-MM-DD.');
        const age = (Date.now() - new Date(f.birth.trim()).getTime()) / 31557600000;
        if (!(age >= 13)) throw new Error('You need to be 13 or older to use Temp.');
        if (f.pw.length < 8) throw new Error('Passwords need at least 8 characters.');
        if (!f.agree) throw new Error('Read and agree to the User Agreement to create your account.');
        const { data: free } = await sb.rpc('handle_available', { h: handle });
        if (free === false) throw new Error('@' + handle + ' is taken. Try another.');
        const { data, error } = await sb.auth.signUp({ email, password: f.pw, options: { data: { name: f.name.trim(), handle, birth: f.birth.trim(), terms_version: TERMS_V, terms_at: new Date().toISOString() } } });
        if (error) throw error;
        if (!data.session) { setNote('Check ' + email + ' to confirm your account, then sign in.'); go('signin'); setNote('Check ' + email + ' to confirm your account, then sign in.'); }
      } else if (mode === 'signin') {
        if (!email || !f.pw) throw new Error('Enter your email and password.');
        const { error } = await sb.auth.signInWithPassword({ email, password: f.pw });
        if (error) throw new Error(/confirm/i.test(error.message) ? 'Confirm your email first. Check your inbox.' : 'That email and password don’t match.');
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.');
        await sb.auth.resetPasswordForEmail(email);
        setNote('If ' + email + ' has an account, a reset link is on its way.');
      }
    } catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  }

  const Seg = ({ k, label }) => (
    <Pressable onPress={() => go(k)} style={{ flex: 1, paddingVertical: 10, borderRadius: 15, backgroundColor: mode === k ? C.ink : 'transparent', alignItems: 'center' }}>
      <T h style={{ color: mode === k ? C.bg : C.muted }}>{label}</T></Pressable>);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ padding: 20, paddingTop: ins.top + 40, paddingBottom: ins.bottom + 30, flexGrow: 1, justifyContent: 'space-between' }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 30 }}>
          <T d style={{ fontSize: 76, letterSpacing: -5, lineHeight: 80 }}>temp</T>
          <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: C.orange, marginBottom: 14 }} />
        </View>
        <View>
          {mode !== 'forgot' ? <FlowBox r={15} style={{ flexDirection: 'row', backgroundColor: C.card, padding: 4 }}><Seg k="signup" label="Sign up" /><Seg k="signin" label="Sign in" /></FlowBox>
            : <T d style={{ fontSize: 22 }}>Reset password</T>}
          {mode === 'signup' ? <>
            <Field label="Name" value={f.name} onChangeText={up('name')} autoCapitalize="words" maxLength={40} />
            <Field label="Username" value={f.handle} onChangeText={(v) => up('handle')(v.replace(/\s/g, ''))} maxLength={21} />
          </> : null}
          <Field label="Email" value={f.email} onChangeText={up('email')} keyboardType="email-address" autoComplete="email" />
          {mode === 'signup' ? <Field label="Birthday (YYYY-MM-DD)" value={f.birth} onChangeText={up('birth')} placeholder="2000-01-31" keyboardType="numbers-and-punctuation" maxLength={10} /> : null}
          {mode !== 'forgot' ? <View>
            <Field label="Password" value={f.pw} onChangeText={up('pw')} secureTextEntry={!show} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            <Pressable onPress={() => setShow(!show)} style={{ position: 'absolute', right: 14, bottom: 15 }}><T h muted style={{ fontSize: 13 }}>{show ? 'Hide' : 'Show'}</T></Pressable>
          </View> : null}
          {mode === 'signup' ? <Agree on={f.agree} set={(v) => setF((x) => ({ ...x, agree: v }))} /> : null}
          {mode === 'signin' ? <Pressable onPress={() => go('forgot')} style={{ alignSelf: 'flex-end', marginTop: 10 }}><T h style={{ color: C.orange, fontSize: 14 }}>Forgot password?</T></Pressable> : null}
          {err ? <T b style={{ color: C.orange, marginTop: 12 }}>{err}</T> : null}
          {note ? <FlowBox r={14} style={{ backgroundColor: C.card, padding: 12, marginTop: 12 }}><T b>{note}</T></FlowBox> : null}
          <Btn kind="orange" title={busy ? '…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'} onPress={submit} disabled={busy} style={{ marginTop: 18, paddingVertical: 16 }} />
          {mode === 'forgot' ? <Pressable onPress={() => go('signin')} style={{ alignSelf: 'center', marginTop: 12 }}><T h style={{ color: C.orange }}>Back to sign in</T></Pressable> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
