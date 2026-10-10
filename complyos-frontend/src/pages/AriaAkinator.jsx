import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Send,
  RotateCcw,
  SkipForward,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  X,
  Volume2,
  Building2,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import AIOrb from "../components/aria/AIOrb";
import MessageRenderer from "../components/aria/MessageRenderer";
import useARIAChat from "../hooks/useARIAChat";
import { setToken, setRole, setUserId } from "../utils/helpers";
import { setProfile, getProfile } from "../utils/profileStore";

export default function AriaAkinator() {
  const navigate = useNavigate();
  const {
    currentCard,
    profileChips,
    progress,
    transcript,
    phase,
    error,
    language,
    history,
    isRecording,
    recordDuration,
    start,
    sendMessage,
    tapOption,
    back,
    skip,
    startRecording,
    stopRecording,
  } = useARIAChat();

  const [textInput, setTextInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("hinglish");
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [highlightedOption, setHighlightedOption] = useState(null);
  const inputRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Initialize ARIA intake on mount
  useEffect(() => {
    start(selectedLanguage);
  }, []);

  // Sync profile chips to localStorage profileStore
  useEffect(() => {
    if (profileChips.length > 0) {
      const patch = {};
      profileChips.forEach((c) => {
        if (c.field === "businessName") patch.businessName = c.value;
        if (c.field === "state") patch.state = c.value;
        if (c.field === "sector") patch.sector = c.value;
        if (c.field === "turnover") patch.turnover = c.value;
        if (c.field === "gstRegistered") patch.gstin = c.value;
        if (c.field === "udyam") patch.udyam = c.value;
      });
      setProfile(patch);
    }
  }, [profileChips]);

  // Scroll chat history drawer to bottom on new message
  useEffect(() => {
    if (showHistoryDrawer) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, showHistoryDrawer]);

  // Determine current AI Orb state
  const getOrbState = () => {
    if (phase === "error") return "error";
    if (phase === "reveal" || phase === "done") return "reveal";
    if (isRecording) return "listening";
    if (phase === "loading") return "thinking";
    return "idle";
  };

  // Determine status label under the AI Orb
  const getOrbLabel = () => {
    if (phase === "error") return "Connection Error";
    if (phase === "reveal" || phase === "done") return "Profile Blueprint Ready ✨";
    if (isRecording) return `Listening... ${recordDuration}s`;
    if (phase === "loading") return "Analyzing...";
    return "ARIA Intake Active";
  };

  // Handle option tap with feedback
  const handleOptionTap = (questionId, optionId) => {
    setHighlightedOption(optionId);
    setTimeout(() => {
      tapOption(questionId, optionId);
      setHighlightedOption(null);
    }, 180);
  };

  // Handle text submit
  const handleTextSubmit = (e) => {
    e?.preventDefault();
    if (!textInput.trim() || phase === "loading") return;
    sendMessage(textInput.trim());
    setTextInput("");
    inputRef.current?.focus();
  };

  // Complete onboarding and navigate to dashboard
  const handleCompleteAndLaunch = () => {
    setToken("cos-business-token");
    setRole("business_owner");
    setUserId("user-" + Date.now());
    navigate("/dashboard");
  };

  // Switch language
  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    start(lang);
  };

  // Calculate completion percentage
  const totalQuestions = progress?.total || 8;
  const doneQuestions = progress?.done || Math.min(profileChips.length + 1, totalQuestions);
  const progressPercent = Math.min(Math.round((doneQuestions / totalQuestions) * 100), 100);

  return (
    <div className="relative min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* ── Background Subtle Mesh Aura ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-gradient-to-b from-cyan-600/10 via-indigo-600/10 to-transparent rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      {/* ── Top Header Navigation Bar ── */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl px-4 md:px-8 py-3.5 flex items-center justify-between">
        
        {/* Brand & Badge */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-extrabold text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              ComplianceOS
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            ARIA Akinator Intake
          </div>
        </div>

        {/* Center Progress Pill */}
        <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/90 shadow-inner">
          <span className="text-xs font-medium text-slate-400">
            Progress: <span className="text-cyan-400 font-bold">{progressPercent}%</span>
          </span>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {doneQuestions}/{totalQuestions}
          </span>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* Language Selector */}
          <div className="flex bg-slate-900/90 border border-slate-800 p-0.5 rounded-xl text-xs font-medium">
            {[
              { id: "hinglish", label: "Hinglish" },
              { id: "en", label: "EN" },
              { id: "hi", label: "हिंदी" },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleLanguageChange(lang.id)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedLanguage === lang.id
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Profile Blueprint Drawer Toggle */}
          <button
            onClick={() => setShowProfileDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-all shadow-sm"
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Profile</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800/50">
              {profileChips.length}
            </span>
          </button>

          {/* History Drawer Toggle */}
          <button
            onClick={() => setShowHistoryDrawer(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all"
            title="Chat History"
          >
            <MessageSquare size={15} />
          </button>
        </div>
      </header>

      {/* ── Main Akinator Stage Area ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-10 max-w-4xl mx-auto w-full">
        
        {/* ── Siri / Apple Intelligence AI Orb ── */}
        <div className="mb-6 md:mb-8 transition-transform duration-500 hover:scale-[1.02]">
          <AIOrb
            state={getOrbState()}
            size="md"
            label={getOrbLabel()}
            interactive={true}
            onClick={isRecording ? stopRecording : startRecording}
          />
        </div>

        {/* ── Transcript bar (when voice is used) ── */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-2 rounded-2xl bg-slate-900/90 border border-cyan-800/50 text-cyan-300 text-xs flex items-center gap-2 max-w-md text-center shadow-lg"
            >
              <Volume2 size={14} className="text-cyan-400 shrink-0" />
              <span>{transcript}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error Notification ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-2.5 rounded-2xl bg-rose-950/70 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2 max-w-md shadow-lg"
            >
              <span>{error}</span>
              <button
                onClick={() => start(selectedLanguage)}
                className="ml-auto underline font-bold hover:text-white"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Current Active Stage Card ── */}
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            
            {/* Reveal / Blueprint Celebration Stage */}
            {phase === "reveal" ? (
              <motion.div
                key="reveal-screen"
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl shadow-emerald-500/10 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 size={32} className="text-slate-950" />
                </div>

                <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
                  Compliance Profile Unlocked!
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                  ARIA has mapped your business profile and pre-screened relevant government schemes, filing deadlines, and tax exemptions.
                </p>

                {/* Live Discovered Blueprint Summary Grid */}
                <div className="grid grid-cols-2 gap-3 text-left mb-6 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Business</span>
                    <span className="text-sm font-bold text-slate-100 truncate block">
                      {getProfile().businessName || "Your Enterprise"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Location</span>
                    <span className="text-sm font-bold text-slate-100 truncate block">
                      {getProfile().state || "Verified State"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Schemes Matched</span>
                    <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                      <TrendingUp size={14} /> 3 Subsidies Available
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Risk Shield</span>
                    <span className="text-sm font-bold text-cyan-400">100% Protected</span>
                  </div>
                </div>

                {/* Primary CTA */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCompleteAndLaunch}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all hover:brightness-110"
                >
                  <span>Launch ComplianceOS Dashboard</span>
                  <ArrowRight size={18} />
                </motion.button>
              </motion.div>
            ) : currentCard ? (
              
              /* Active Question Stage Card */
              <motion.div
                key={currentCard.id || "card"}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="bg-slate-900/70 border border-slate-800/90 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl shadow-black/40"
              >
                {/* Question Content via MessageRenderer */}
                <MessageRenderer
                  message={currentCard}
                  layout="stage"
                  onTap={handleOptionTap}
                  language={selectedLanguage}
                  highlightedOption={highlightedOption}
                  disabled={phase === "loading"}
                />
              </motion.div>
            ) : (
              
              /* Loading Initial Card */
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>ARIA is preparing your intake assessment...</span>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── Bottom Floating Input Dock ── */}
      <footer className="relative z-20 border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-4 md:px-8 py-3.5">
        <div className="max-w-2xl mx-auto flex flex-col gap-2.5">
          
          <div className="flex items-center gap-2">
            
            {/* Back Button */}
            <button
              onClick={back}
              disabled={phase === "loading" || doneQuestions <= 1}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all"
              title="Previous Question"
            >
              <RotateCcw size={16} />
            </button>

            {/* Voice Input Button (Hold / Click to speak) */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-center ${
                isRecording
                  ? "bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30 animate-pulse"
                  : "bg-slate-900 border-slate-800 text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/30 shadow-sm"
              }`}
              title={isRecording ? "Stop Recording" : "Voice Input (Hindi/English)"}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </motion.button>

            {/* Text Input Form */}
            <form onSubmit={handleTextSubmit} className="flex-1 relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  isRecording
                    ? "Listening to voice input..."
                    : "Type your answer or ask ARIA anything..."
                }
                disabled={isRecording || phase === "loading" || phase === "reveal"}
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500/60 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || phase === "loading"}
                className="absolute right-2 p-2 rounded-xl bg-cyan-500 text-slate-950 disabled:opacity-20 hover:bg-cyan-400 transition-all"
              >
                <Send size={14} />
              </button>
            </form>

            {/* Skip Button */}
            <button
              onClick={skip}
              disabled={phase === "loading" || phase === "reveal"}
              className="px-3.5 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all text-xs font-semibold flex items-center gap-1"
              title="Skip Question"
            >
              <span>Skip</span>
              <SkipForward size={13} />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>Voice recognition enabled (Hinglish, Hindi, English)</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              DPDP Act &amp; 256-Bit Vault Protected
            </span>
          </div>
        </div>
      </footer>

      {/* ── Slide-Over Profile Blueprint Drawer ── */}
      <AnimatePresence>
        {showProfileDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm bg-slate-950 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl z-10"
            >
              <div>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-400" />
                    <h3 className="font-bold text-base text-white">Business Blueprint</h3>
                  </div>
                  <button
                    onClick={() => setShowProfileDrawer(false)}
                    className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 text-center">
                  <span className="text-xs text-slate-400">Intake Completion</span>
                  <div className="text-2xl font-extrabold text-cyan-400 mt-1">
                    {progressPercent}%
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Captured Fields ({profileChips.length})
                </h4>

                {profileChips.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    Answer questions to discover your business attributes.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {profileChips.map((chip, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
                      >
                        <span className="text-slate-400 capitalize">{chip.field}</span>
                        <span className="font-semibold text-slate-200">{chip.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowProfileDrawer(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 transition"
                >
                  Close Drawer
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ── Slide-Over Chat History Drawer ── */}
      <AnimatePresence>
        {showHistoryDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-slate-950 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-cyan-400" />
                  <h3 className="font-bold text-base text-white">Intake Transcript</h3>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Message History Feed */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-2">
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-6">
                    No transcript yet. Conversation just started.
                  </p>
                ) : (
                  history.map((msg, index) => {
                    const isUser = msg.from === "user";
                    return (
                      <div
                        key={index}
                        className={`flex flex-col ${
                          isUser ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                            isUser
                              ? "bg-cyan-600 text-slate-950 font-medium rounded-br-none"
                              : "bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none"
                          }`}
                        >
                          {msg.text || (msg.type === "tap" ? `Selected: ${msg.optionId}` : "Voice message")}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 transition"
                >
                  Back to Intake
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
