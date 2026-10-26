import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api.ts';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: () => void;
}

export function useVoice({
  onTranscriptReady,
  wakeWordEnabled = false,
  wakePhrase = 'hey edith',
}: {
  onTranscriptReady: (transcript: string) => void;
  wakeWordEnabled?: boolean;
  wakePhrase?: string;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detectedIntent, setDetectedIntent] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 volume meter
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [micError, setMicError] = useState<string | null>(null);

  const isListeningRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const liveInterimTranscriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone permissions on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          setMicPermission(permissionStatus.state as 'prompt' | 'granted' | 'denied');
          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state as 'prompt' | 'granted' | 'denied');
          };
        })
        .catch(() => {});
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.abort();
    };
  }, []);

  // Stop recording and process audio
  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;

    isListeningRef.current = false;
    setIsListening(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stop speech recognition if running
    try {
      recognitionRef.current?.stop();
    } catch {}

    // Stop audio meter animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);

    const capturedBrowserText = liveInterimTranscriptRef.current.trim();

    // If browser speech recognition captured transcript directly, emit immediately!
    if (capturedBrowserText.length > 0) {
      setTranscript(capturedBrowserText);
      setIsTranscribing(false);
      onTranscriptReady(capturedBrowserText);
      liveInterimTranscriptRef.current = '';

      // Release microphone tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      return;
    }

    // Otherwise finalize via MediaRecorder and backend transcription
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setIsTranscribing(true);

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        audioChunksRef.current = [];

        if (audioBlob.size > 800) {
          try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64Audio = reader.result as string;
              try {
                const res = await api.transcribeAudio(
                  base64Audio,
                  audioBlob.type || 'audio/webm',
                  capturedBrowserText
                );
                const finalTranscript = res.transcript?.trim() || '';
                if (finalTranscript) {
                  setTranscript(finalTranscript);
                  onTranscriptReady(finalTranscript);
                }
              } catch (err) {
                console.warn('Backend STT failed:', err);
                // Even if backend fails, if any words were detected, dispatch
                if (capturedBrowserText) {
                  setTranscript(capturedBrowserText);
                  onTranscriptReady(capturedBrowserText);
                }
              } finally {
                setIsTranscribing(false);
              }
            };
          } catch {
            setIsTranscribing(false);
          }
        } else {
          setIsTranscribing(false);
        }
      };

      try {
        recorder.stop();
      } catch {
        setIsTranscribing(false);
      }
    } else {
      setIsTranscribing(false);
    }

    // Release microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, [onTranscriptReady]);

  // Start listening: request getUserMedia + start MediaRecorder + Web Speech API
  const startListening = useCallback(async () => {
    setMicError(null);
    setTranscript('');
    setDetectedIntent('');
    liveInterimTranscriptRef.current = '';
    audioChunksRef.current = [];
    isListeningRef.current = true;

    // Barge-in: Stop speech if EDITH is currently vocalizing
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    let streamAcquired = false;

    // 1. Attempt getUserMedia for hardware waveform analysis & server-side STT
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        mediaStreamRef.current = stream;
        setMicPermission('granted');
        streamAcquired = true;

        // 2. Set up Web Audio Analyser for live visualizer feedback
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const sourceNode = audioCtx.createMediaStreamSource(stream);
          sourceNode.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!mediaStreamRef.current || !isListeningRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const level = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(level);

            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        } catch (err) {
          console.warn('AudioContext meter unavailable:', err);
        }

        // 3. Set up MediaRecorder
        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }

          const recorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };

          recorder.start(250);
        }
      } catch (mediaErr: unknown) {
        console.warn('getUserMedia audio stream was not directly acquired, attempting SpeechRecognition fallback:', mediaErr);
      }
    }

    // 4. Start Web Speech API with auto-silence finalization
    let speechRecognitionStarted = false;
    const win = window as unknown as Record<string, new () => SpeechRecognitionInstance>;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = '';
          for (let i = 0; i < event.results.length; i++) {
            interim += event.results[i][0].transcript;
          }
          const cleanInterim = interim.trim();
          if (cleanInterim) {
            liveInterimTranscriptRef.current = cleanInterim;
            setTranscript(cleanInterim);

            // Reset silence timer on every spoken word: auto-submit after 1.5s of silence!
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (isListeningRef.current && liveInterimTranscriptRef.current.trim().length > 0) {
                stopListening();
              }
            }, 1500);

            // Check for wake phrase if armed
            if (wakeWordEnabled && cleanInterim.toLowerCase().includes(wakePhrase.toLowerCase())) {
              setDetectedIntent('WAKE_WORD_ACTIVATED');
            }
          }
        };

        recognition.onerror = (e: Event) => {
          console.warn('SpeechRecognition error:', e);
        };

        recognition.onend = () => {
          if (isListeningRef.current && liveInterimTranscriptRef.current.trim().length > 0) {
            stopListening();
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        speechRecognitionStarted = true;
      } catch (e) {
        console.warn('SpeechRecognition start failed:', e);
      }
    }

    if (streamAcquired || speechRecognitionStarted) {
      setIsListening(true);
    } else {
      setMicPermission('denied');
      setMicError('Microphone unavailable or blocked. You can type commands or click quick presets below.');
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [wakeWordEnabled, wakePhrase, stopListening]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // Text-to-Speech synthesis with barge-in support and voice ID selection
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    // Strip markdown formatting for crisp voice delivery
    const cleanSpeech = text
      .replace(/[*_#`[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/\{[\s\S]*?\}/g, '')
      .slice(0, 350);

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.08;
    utterance.pitch = 1.05;

    // Pick crisp English voice matching tactical profile
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.name.includes('Google UK English Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Victoria') ||
        v.name.includes('Daniel') ||
        (v.lang.startsWith('en') && !v.name.includes('Bad'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const simulateVoice = useCallback((simulatedText: string) => {
    setTranscript(simulatedText);
    onTranscriptReady(simulatedText);
  }, [onTranscriptReady]);

  return {
    isListening,
    isSpeaking,
    isTranscribing,
    transcript,
    detectedIntent,
    audioLevel,
    micPermission,
    micError,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    setTranscript,
    simulateVoice,
  };
}
