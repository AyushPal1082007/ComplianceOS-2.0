/**
 * useARIAChat — React hook for ARIA Akinator-style intake.
 *
 * Manages the conversation state, message history, profile chips,
 * progress tracking, voice recording, and agent trace.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sendStart, sendText, sendOptionTap, sendVoice } from "../services/ariaChat";

const MAX_RECORD_MS = 30000;

function initialState() {
  return {
    messages: [],         // All outbound messages from backend
    currentCard: null,    // The latest option_card / list / confirm_card
    profileChips: [],     // Filled profile fields as chips
    progress: null,       // { done, total }
    transcript: null,     // "Maine suna: ..." line
    trace: [],            // Agent trace events
    phase: "idle",        // idle | loading | asking | reveal | done | error
    error: null,
    language: "hinglish",
    history: [],          // Chat bubble history for drawer
  };
}

export function useARIAChat() {
  const [state, setState] = useState(initialState);
  const activeRequest = useRef(null);
  const mediaRecorder = useRef(null);
  const recordTimeout = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordInterval = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────

  const setLoading = useCallback(() => {
    setState((s) => ({ ...s, phase: "loading", error: null }));
  }, []);

  const processMessages = useCallback((messages, traceEvents = []) => {
    setState((prev) => {
      const newHistory = [...prev.history];
      let currentCard = prev.currentCard;
      let progress = prev.progress;
      let phase = prev.phase;
      let transcript = prev.transcript;
      const chips = [...prev.profileChips];

      for (const msg of messages) {
        newHistory.push({ ...msg, from: "agent", ts: Date.now() });

        if (msg.type === "option_card" || msg.type === "list") {
          currentCard = msg;
          phase = "asking";
          if (msg.progress) progress = msg.progress;
        } else if (msg.type === "confirm_card") {
          currentCard = msg;
          phase = msg.id === "aria-reveal" ? "reveal" : "asking";
        } else if (msg.type === "text") {
          // Check for transcript line
          if (msg.text?.startsWith("Maine suna:") || msg.text?.startsWith("मैंने सुना:")) {
            transcript = msg.text;
          }
          // If it's a NEEDS_INPUT retry, stay in asking
          if (msg.questionId) phase = "asking";
        }
      }

      // Extract chips from trace profilePatch info
      for (const te of traceEvents) {
        if (te.outputSummary?.filledFields) {
          for (const f of te.outputSummary.filledFields) {
            if (!chips.find((c) => c.field === f.field)) {
              chips.push({ field: f.field, value: f.value, emoji: f.emoji || "✓" });
            }
          }
        }
      }

      return {
        ...prev,
        messages: [...prev.messages, ...messages],
        currentCard,
        progress,
        phase,
        transcript,
        trace: [...prev.trace, ...traceEvents],
        history: newHistory,
        profileChips: chips,
      };
    });
  }, []);

  const callbacks = useCallback(
    () => ({
      onMessage: (msg) => processMessages([msg]),
      onComplete: ({ status, trace, claims }) => {
        processMessages([], trace);
        setState((s) => {
          let phase = s.phase;
          if (status === "OK" && s.currentCard?.id === "aria-reveal") phase = "reveal";
          if (s.currentCard === null && status === "OK") phase = "done";
          return { ...s, phase: phase === "loading" ? "asking" : phase };
        });
      },
      onError: (err) => {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err?.message || "Kuch gadbad ho gayi. Dubara try karein.",
        }));
      },
    }),
    [processMessages]
  );

  // ── Actions ──────────────────────────────────────────────────

  const start = useCallback(
    (language = "hinglish") => {
      setState({ ...initialState(), language, phase: "loading" });
      activeRequest.current?.abort?.();
      activeRequest.current = sendStart(language, callbacks());
    },
    [callbacks]
  );

  const sendMessage = useCallback(
    (text) => {
      if (!text?.trim()) return;
      setState((s) => ({
        ...s,
        history: [...s.history, { type: "text", text, from: "user", ts: Date.now() }],
        phase: "loading",
        transcript: null,
      }));
      activeRequest.current?.abort?.();
      activeRequest.current = sendText(text, callbacks());
    },
    [callbacks]
  );

  const tapOption = useCallback(
    (questionId, optionId) => {
      setState((s) => ({
        ...s,
        history: [
          ...s.history,
          { type: "tap", questionId, optionId, from: "user", ts: Date.now() },
        ],
        phase: "loading",
        transcript: null,
      }));
      activeRequest.current?.abort?.();
      activeRequest.current = sendOptionTap(questionId, optionId, callbacks());
    },
    [callbacks]
  );

  const back = useCallback(() => {
    tapOption("_nav", "back");
  }, [tapOption]);

  const skip = useCallback(() => {
    if (state.currentCard?.id) {
      tapOption(state.currentCard.id, "skip");
    }
  }, [tapOption, state.currentCard]);

  // ── Voice recording ──────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordInterval.current);
        clearTimeout(recordTimeout.current);
        setIsRecording(false);
        setRecordDuration(0);

        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mr.mimeType });

        setState((s) => ({
          ...s,
          phase: "loading",
          transcript: null,
          history: [...s.history, { type: "voice", from: "user", ts: Date.now() }],
        }));

        sendVoice(blob, mr.mimeType, callbacks());
      };

      mr.start();
      mediaRecorder.current = mr;
      setIsRecording(true);
      setRecordDuration(0);
      recordInterval.current = setInterval(() => setRecordDuration((d) => d + 1), 1000);
      recordTimeout.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
    } catch (err) {
      setState((s) => ({
        ...s,
        error: "Microphone access denied. Please allow microphone access.",
      }));
    }
  }, [callbacks]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRequest.current?.abort?.();
      clearInterval(recordInterval.current);
      clearTimeout(recordTimeout.current);
      if (mediaRecorder.current?.state === "recording") {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  return {
    ...state,
    isRecording,
    recordDuration,
    start,
    sendMessage,
    tapOption,
    back,
    skip,
    startRecording,
    stopRecording,
  };
}

export default useARIAChat;
