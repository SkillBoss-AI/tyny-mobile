/**
 * Tycoon Mobile — Main WebView screen
 *
 * Features:
 * - Loads tycoon.us inside a full-screen WebView
 * - iOS Safe Area handled via react-native-safe-area-context
 * - Push notification permission requested on first launch
 * - Device push token registered with the Tycoon backend via a JS bridge
 *   (runs inside the WebView so the wos-session cookie is automatically
 *    included in the fetch — no separate native auth needed)
 * - External links open in the system browser
 * - `window.__TYCOON_NATIVE__` + `window.__TYCOON_PLATFORM__` flags injected
 *   so the web app can adapt its UI for the native shell
 *
 * Auth (WebView approach):
 * The user authenticates via the WorkOS AuthKit sign-in page that loads
 * inside the WebView when unauthenticated. The hosted AuthKit page supports
 * Email, Apple Sign In, and Google Sign In — providers are configured in
 * the WorkOS Dashboard (no code change needed to add/remove providers).
 * The wos-session cookie is stored in the WebView cookie jar and reused on
 * every subsequent request. sharedCookiesEnabled + thirdPartyCookiesEnabled
 * ensure the session survives app restarts on iOS.
 *
 * Push token registration:
 * After login is detected (nav state leaves /auth/* or workos.com), a small
 * JS snippet is injected into the WebView to POST /api/mobile/push-token.
 * The wos-session cookie travels with that fetch automatically.
 */

import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { useRef, useState, useCallback, useEffect } from 'react';
import { usePushNotifications } from './hooks/usePushNotifications';

const TYCOON_URL = 'https://tycoon.us';

// Domains that should open inside the WebView (keep navigation in-app)
const INTERNAL_DOMAINS = ['tycoon.us', 'tycoon.cool'];

/**
 * Inject the Expo push token into the WebView after login.
 * The WebView's fetch() carries the wos-session cookie automatically,
 * so no extra auth is needed for the backend call.
 */
function buildPushTokenScript(token: string, platform: string): string {
  // Sanitise inputs before embedding in JS
  const safeToken = token.replace(/['"\\]/g, '');
  const safePlatform = platform.replace(/['"\\]/g, '');
  return `
    (function() {
      if (window.__TYCOON_PUSH_REGISTERED__) return;
      window.__TYCOON_PUSH_REGISTERED__ = true;
      fetch('/api/mobile/push-token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '${safeToken}', platform: '${safePlatform}' })
      }).then(function(r) {
        if (r.ok) console.log('[tycoon-native] push token registered');
        else r.text().then(function(t) { console.warn('[tycoon-native] push token error', r.status, t); });
      }).catch(function(e) {
        console.warn('[tycoon-native] push token fetch failed', e);
      });
    })();
    true;
  `;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { expoPushToken } = usePushNotifications();

  // Once we have a push token AND the user is authenticated, register it
  // via the WebView JS bridge.
  const pushRegisteredRef = useRef(false);

  useEffect(() => {
    if (expoPushToken && isAuthenticated && !pushRegisteredRef.current) {
      pushRegisteredRef.current = true;
      const script = buildPushTokenScript(expoPushToken, Platform.OS);
      webViewRef.current?.injectJavaScript(script);
    }
  }, [expoPushToken, isAuthenticated]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const url = request.url;

      // Allow about:blank and data URIs
      if (url === 'about:blank' || url.startsWith('data:')) {
        return true;
      }

      try {
        const parsed = new URL(url);
        const isInternal = INTERNAL_DOMAINS.some(
          (domain) =>
            parsed.hostname === domain ||
            parsed.hostname.endsWith('.' + domain)
        );

        if (isInternal) {
          return true; // Load inside WebView
        }

        // Open external links in device browser
        Linking.openURL(url);
        return false;
      } catch {
        return true;
      }
    },
    []
  );

  /**
   * Detect whether the user is logged in by watching navigation state.
   * The tycoon.us web app redirects unauthenticated users to /login.
   * Once we see a non-login URL, we consider the user authenticated.
   */
  const handleNavigationStateChange = useCallback(
    (navState: { url: string }) => {
      const url = navState.url;
      if (!url) return;
      const isLoginPage =
        url.includes('/login') ||
        url.includes('/auth/') ||
        url.includes('authkit.app') ||
        url.includes('workos.com');
      if (!isLoginPage && !isAuthenticated) {
        setIsAuthenticated(true);
      } else if (isLoginPage && isAuthenticated) {
        // User signed out
        setIsAuthenticated(false);
        pushRegisteredRef.current = false;
      }
    },
    [isAuthenticated]
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style="light" />
      <WebView
        ref={webViewRef}
        source={{ uri: TYCOON_URL }}
        style={styles.webview}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={handleNavigationStateChange}
        // Allow media playback for any video/audio in the web app
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Allow geolocation and camera access prompts to pass through
        geolocationEnabled
        // Better scrolling
        bounces={false}
        overScrollMode="never"
        // JS injection for native feel + platform signal
        injectedJavaScript={`
          (function() {
            // Remove tap highlight on mobile
            document.documentElement.style.webkitTapHighlightColor = 'transparent';
            // Signal we're in native WebView
            window.__TYCOON_NATIVE__ = true;
            window.__TYCOON_PLATFORM__ = '${Platform.OS}';
          })();
          true; // required by react-native-webview
        `}
        // Allow downloads
        allowFileAccess
        domStorageEnabled
        javaScriptEnabled
        // Cache control
        cacheEnabled
        // Pass cookies from the system cookie store so WorkOS sessions persist
        sharedCookiesEnabled
        // Required on iOS for sharedCookiesEnabled to work
        thirdPartyCookiesEnabled
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
