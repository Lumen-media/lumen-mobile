import { useEffect, useState } from 'react';
import { type MediaStream, RTCPeerConnection } from 'react-native-webrtc';

import { onServerMessage } from '@/src/core/connection/bus';
import { connection } from '@/src/core/connection/manager';
import { isKnown } from '@/src/core/protocol';

export type PreviewState = 'idle' | 'starting' | 'live' | 'error';

/**
 * Consumes the desktop's `app_preview` WebRTC stream (signaling over the
 * control WS). Call with `enabled` while the preview area is visible.
 */
export function useAppPreview(enabled: boolean): {
  state: PreviewState;
  stream: MediaStream | null;
} {
  const [state, setState] = useState<PreviewState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const pc = new RTCPeerConnection({ iceServers: [] });

    // react-native-webrtc types these handlers loosely; cast locally.
    pc.ontrack = (rawEvent) => {
      const event = rawEvent as unknown as { streams?: MediaStream[] };
      const remote = event.streams?.[0];
      if (!cancelled && remote) {
        setStream(remote);
        setState('live');
      }
    };
    pc.onicecandidate = (rawEvent) => {
      const candidate = (rawEvent as unknown as { candidate: unknown }).candidate;
      if (candidate) {
        connection.send({
          event: 'webrtc_ice_candidate',
          stream_type: 'app_preview',
          candidate,
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (cancelled) return;
      if (pc.connectionState === 'failed') setState('error');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        setStream(null);
        setState('idle');
      }
    };

    const unsubscribe = onServerMessage((message) => {
      if (cancelled || !isKnown(message)) return;
      if (message.event === 'stream_offer' && message.stream_type === 'app_preview') {
        void (async () => {
          try {
            await pc.setRemoteDescription({ type: 'offer', sdp: message.sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            connection.send({
              event: 'webrtc_answer',
              stream_type: 'app_preview',
              sdp: answer.sdp ?? '',
            });
          } catch {
            setState('error');
          }
        })();
      } else if (
        message.event === 'stream_ice_candidate' &&
        message.stream_type === 'app_preview'
      ) {
        pc.addIceCandidate(message.candidate).catch(() => {
          // Ignore candidates that arrive before the remote description.
        });
      } else if (message.event === 'stream_stopped' && message.stream_type === 'app_preview') {
        setStream(null);
        setState('idle');
      } else if (message.event === 'stream_error' && message.stream_type === 'app_preview') {
        setState('error');
      }
    });

    connection.send({ event: 'subscribe_stream', stream_type: 'app_preview' });

    return () => {
      cancelled = true;
      connection.send({ event: 'unsubscribe_stream', stream_type: 'app_preview' });
      unsubscribe();
      pc.close();
      setStream(null);
      setState('idle');
    };
  }, [enabled]);

  return {
    // "starting" covers the enabled-but-no-stream-yet window without a
    // synchronous setState inside the effect.
    state: !enabled ? 'idle' : state === 'idle' ? 'starting' : state,
    stream,
  };
}
