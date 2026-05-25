# Tycoon Mobile

Expo (React Native) WebView shell app for [tycoon.us](https://tycoon.us).  
Ships a native iOS + Android app that loads the Tycoon web app in a full-screen WebView.

## Stack

- **Expo SDK 51** (managed workflow)
- **expo-router** v3 for file-based navigation
- **react-native-webview** 13.x — full-screen WebView
- **EAS Build** for cloud builds (iOS + Android)

---

## Run Locally

### Prerequisites

```bash
npm install -g expo-cli eas-cli
```

### Install dependencies

```bash
npm install
```

### Start in Expo Go

```bash
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/client) on your iPhone or Android device.

> **Note:** react-native-webview is a native module. On Expo Go you can test it  
> but for a fully production build you need a development build or EAS build.

### Development build (recommended for testing native modules)

```bash
# iOS simulator
npx expo run:ios

# Android emulator
npx expo run:android
```

---

## Regenerate App Icons

The default icons are dark placeholders. To regenerate from the SVG logo:

```bash
# macOS: brew install imagemagick
# Linux: apt-get install imagemagick
node scripts/generate-assets.js
```

---

## EAS Build

### 1. Log in to EAS

```bash
eas login
```

### 2. Configure your project ID

Edit `app.json` → replace `YOUR_EAS_PROJECT_ID` with your actual EAS project ID.

```bash
eas init
```

This automatically sets the `projectId` in `app.json`.

### 3. Build for preview (TestFlight / internal testing)

```bash
# iOS (IPA for TestFlight)
eas build --platform ios --profile preview

# Android (APK for direct install)
eas build --platform android --profile preview

# Both at once
eas build --platform all --profile preview
```

### 4. Build for production

```bash
# Production builds (App Store / Play Store)
eas build --platform all --profile production
```

---

## Submit to App Store (TestFlight → App Store)

### Prerequisites

1. Apple Developer account — [developer.apple.com](https://developer.apple.com)
2. App Store Connect app record created for bundle ID `com.tycoon.app`
3. Fill in `eas.json` → `submit.production.ios`:
   - `appleId` — your Apple ID email
   - `ascAppId` — the App Store Connect numeric app ID
   - `appleTeamId` — your 10-character team ID

### Submit

```bash
# After a production build:
eas submit --platform ios --profile production

# Or build + submit in one step:
eas build --platform ios --profile production --auto-submit
```

---

## Submit to Google Play

### Prerequisites

1. Google Play Console account with the app created
2. Service account JSON with "Release Manager" permission  
   (save as `google-service-account.json` — it's in `.gitignore`)
3. Update `eas.json` → `submit.production.android.serviceAccountKeyPath`

### Submit

```bash
eas submit --platform android --profile production
```

---

## Auth — Apple Sign In + Google Sign In

Authentication uses **WorkOS AuthKit** via the WebView approach:

- The user lands on `tycoon.us/login` inside the WebView when unauthenticated
- WorkOS redirects to its hosted AuthKit sign-in page
- The hosted page shows all enabled social providers
- After sign-in, the `wos-session` cookie is stored in the WebView cookie jar
- Push token registration triggers automatically after login is detected

### Enabling Apple Sign In (required for App Store)

1. **WorkOS Dashboard** → AuthKit → Social Connections → enable **Apple**
2. **Apple Developer Portal** → Identifiers → create a Service ID (`com.tycoon.app.signin`)
   - Enable "Sign in with Apple"
   - Return URL: `https://api.workos.com/sso/saml/acs` (check WorkOS docs for exact URL)
3. The iOS entitlements (`com.apple.developer.applesignin`) and
   `usesAppleSignIn: true` are already set in `app.json`

### Enabling Google Sign In

1. **WorkOS Dashboard** → AuthKit → Social Connections → enable **Google**
2. Provide your Google OAuth Client ID + Secret in WorkOS Dashboard
3. No app.json changes needed — handled entirely in the WebView

---

## Deep Links

The app handles `tycoon://` scheme URLs.  
Configure associated domains in Xcode / `app.json` if you need universal links (`https://tycoon.us/...`).

To add universal links:

```json
// app.json → expo.ios
"associatedDomains": ["applinks:tycoon.us"]
```

---

## Project Structure

```
tycoon-mobile/
├── app/
│   ├── _layout.tsx       # Root layout — splash screen, navigation stack
│   └── index.tsx         # Main WebView screen
├── assets/
│   └── images/
│       ├── icon.png            # 1024×1024 app icon
│       ├── adaptive-icon.png   # Android adaptive icon foreground
│       ├── splash.png          # Splash screen
│       ├── favicon.png         # Web favicon (unused in native)
│       └── logo.svg            # Tycoon SVG logo (source)
├── scripts/
│   └── generate-assets.js  # Regenerate icons from logo.svg
├── app.json                # Expo configuration
├── eas.json                # EAS Build + Submit configuration
├── .easignore              # Files excluded from EAS builds
└── tsconfig.json           # TypeScript config
```

---

## Environment

The WebView injects two globals into `window` so the web app can detect it's running native:

```js
window.__TYCOON_NATIVE__ = true;
window.__TYCOON_PLATFORM__ = 'ios' | 'android'
```

Use these in the web app to show/hide mobile-specific UI (e.g., skip in-browser install prompts).

---

## Next Steps

| Step | Command / Action |
|---|---|
| 1. Init EAS project | `eas init` |
| 2. Regenerate proper icons | `node scripts/generate-assets.js` |
| 3. Build preview | `eas build --platform ios --profile preview` |
| 4. Upload to TestFlight | Build → Apple → TestFlight auto-upload |
| 5. Internal testers | Add in App Store Connect → TestFlight tab |
| 6. Production release | `eas build --platform all --profile production --auto-submit` |
