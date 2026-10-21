# Temp — Expo Go app

Same accounts, posts, DMs and stories as the website (both talk to the Supabase project `temp`).

## Run it in Expo Go (automatic)

Every push to `main` that changes `app/` publishes a new test version through
`.github/workflows/expo-go.yml` (needs the `EXPO_TOKEN` repo secret). Open it from
expo.dev → project **temp** → **Updates** → newest update → **Preview** QR code, scanned with the iPhone camera.
If publishing fails, the log lands on the `expo-go-log` branch.

The app targets **Expo SDK 57**, matching Expo Go.

## Files

- `App.js`: sign-in gate, data loading, live updates, tabs and navigation
- `src/lib.js`: Supabase client, colors, helpers, uploads
- `src/data.js`: loads everything for the signed-in user; every write
- `src/ui.js`: shared pieces (avatar rings, stickers, timers, morphing story orbs, thermometer, sheets)
- `src/posts.js`: post card, comments, share and post menu
- `src/screens.js`: home, Replay, search, activity, messages
- `src/profile.js`: profile, edit profile, settings, Fire Sale, composer, story viewer
- `src/auth.js`: sign up, sign in, password reset
