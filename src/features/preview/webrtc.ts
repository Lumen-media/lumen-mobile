import Constants from 'expo-constants';

type WebRtcModule = typeof import('react-native-webrtc');

/**
 * react-native-webrtc has native code that is not bundled in Expo Go.
 * Load it defensively so the rest of the app works there; the preview
 * simply reports as unavailable (development builds get the real module).
 */
function loadWebRtc(): WebRtcModule | null {
  if (Constants.executionEnvironment === 'storeClient') return null;
  try {
    return require('react-native-webrtc') as WebRtcModule;
  } catch {
    return null;
  }
}

const webrtc = loadWebRtc();

export const isWebRtcAvailable = webrtc !== null;
export const RTCView = webrtc?.RTCView ?? null;
export const RTCPeerConnection = webrtc?.RTCPeerConnection ?? null;
