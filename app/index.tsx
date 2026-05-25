import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { useRef, useState, useCallback } from 'react';
import Constants from 'expo-constants';

const TYCOON_URL = 'https://tycoon.us';

// Domains that should open inside the WebView (keep navigation in-app)
const INTERNAL_DOMAINS = ['tycoon.us', 'tycoon.cool'];

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

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
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
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

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <WebView
        ref={webViewRef}
        source={{ uri: TYCOON_URL }}
        style={styles.webview}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        // Allow media playback for any video/audio in the web app
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Allow geolocation and camera access prompts to pass through
        geolocationEnabled
        // Better scrolling
        bounces={false}
        overScrollMode="never"
        // JS injection for native feel
        injectedJavaScript={`
          // Remove tap highlight on mobile
          document.documentElement.style.webkitTapHighlightColor = 'transparent';
          // Signal we're in native WebView
          window.__TYCOON_NATIVE__ = true;
          window.__TYCOON_PLATFORM__ = '${Platform.OS}';
          true; // required by react-native-webview
        `}
        // Allow downloads
        allowFileAccess
        domStorageEnabled
        javaScriptEnabled
        // Cache control
        cacheEnabled
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    // Push content below the status bar on iOS notched devices
    paddingTop: Constants.statusBarHeight,
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
