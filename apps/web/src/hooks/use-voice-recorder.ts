"use client";

import { useEffect, useRef, useState } from "react";

export type VoiceRecording = { blob: Blob; durationMs: number };

export function useVoiceRecorder(
  onRecorded: (recording: VoiceRecording) => void,
) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onRecorded);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    callbackRef.current = onRecorded;
  }, [onRecorded]);

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function start() {
    if (startingRef.current || recorderRef.current?.state === "recording")
      return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("当前浏览器暂不支持录音");
      return;
    }
    startingRef.current = true;
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const chunks: BlobPart[] = [];
      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (mountedRef.current) setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        if (cancelledRef.current || !mountedRef.current) return;
        callbackRef.current({
          blob: new Blob(chunks, {
            type: recorder.mimeType || preferred || "audio/mp4",
          }),
          durationMs: Math.min(Date.now() - startedAtRef.current, 60_000),
        });
      };
      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);
      timerRef.current = setTimeout(stop, 60_000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (mountedRef.current) setError("需要麦克风权限才能发送语音");
    } finally {
      startingRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      stop();
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    recording,
    error,
    start,
    stop,
    cancel: () => {
      cancelledRef.current = true;
      stop();
    },
  };
}
