# Temp — Expo Go app

Same accounts, posts, DMs and stories as the website (both talk to the Supabase project `temp`).

## Run it on your phone with Expo Go

You need a computer with Node.js 20+ for this, plus the Expo Go app on your phone.

1. `git clone https://github.com/wulfnout/temp.git`
2. `cd temp/app`
3. `npm install`
4. `npx expo install --fix` (lines every package up with your Expo SDK)
5. `npx expo start --tunnel`
6. Scan the QR code: on iPhone with the Camera app, on Android inside Expo Go.

The project targets **Expo SDK 54**, the version the App Store's Expo Go runs.
If Expo Go says the project is incompatible, check which SDK your Expo Go shows on its home screen, then run
`npx expo install expo@^<that SDK>` and `npx expo install --fix`.

## Files

- `App.js`: sign-in gate, data loading, live updates, tabs and navigation
- `src/lib.js`: Supabase client, colors, helpers, uploads
- `src/data.js`: loads everything for the signed-in user; every write
- `src/ui.js`: shared pieces (avatar rings, stickers, timers, morphing story orbs, thermometer, sheets)
- `src/posts.js`: post card, comments, share and post menu
- `src/screens.js`: home, Replay, search, activity, messages
- `src/profile.js`: profile, edit profile, settings, Fire Sale, composer, story viewer
- `src/auth.js`: sign up, sign in, password reset
