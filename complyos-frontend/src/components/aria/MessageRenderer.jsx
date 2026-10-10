/**
 * MessageRenderer — renders all 5 message types from ARIA:
 *   text, option_card, list, confirm_card, file
 *
 * Used in both the "stage" (one-at-a-time) layout and the
 * "bubble" (chat history drawer) layout.
 *
 * Props:
 *   message      – The outbound message object
 *   layout       – "stage" | "bubble"
 *   onTap        – (questionId, optionId) => void
 *   language     – "hi" | "en" | "hinglish"
 *   highlightedOption – optionId that was just tapped (optimistic)
 *   disabled     – disable interactions (loading state)
 */
import React from "react";

// ── Shared option button ──────────────────────────────────────────────────────
function OptionButton({ option, cardId, onTap, highlighted, disabled }) {
  const isHighlighted = highlighted === option.id;
  return (
    <button
      onClick={() => !disabled && onTap?.(cardId, option.id)}
      disabled={disabled}
      className={`
        w-full text-left px-5 py-4 rounded-2xl text-base font-medium
        transition-all duration-200 border-2
        flex items-center gap-3 min-h-[52px]
        ${isHighlighted
          ? "bg-emerald-500 text-white border-emerald-500 scale-[0.98] shadow-lg shadow-emerald-500/20"
          : disabled
            ? "bg-white/40 text-cs-400 border-cs-200/50 cursor-not-allowed"
            : "bg-white text-cs-800 border-cs-200 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md active:scale-[0.97]"
        }
      `}
    >
      {option.emoji && <span className="text-xl">{option.emoji}</span>}
      <span>{typeof option.label === "object" ? option.label.hinglish || option.label.en : option.label}</span>
    </button>
  );
}

// ── Text message ──────────────────────────────────────────────────────────────
function TextBubble({ message, layout }) {
  if (layout === "bubble") {
    return (
      <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-cs-700 text-white text-sm shadow-md">
        {message.text}
      </div>
    );
  }
  return (
    <div className="text-center text-cs-500 text-sm py-2 px-4 animate-fadeIn">
      {message.text}
    </div>
  );
}

// ── Option card (stage layout) ────────────────────────────────────────────────
function OptionCardStage({ message, onTap, highlightedOption, disabled }) {
  return (
    <div className="w-full animate-slideUp">
      {/* Question text */}
      <div className="text-center mb-6 px-2">
        <h2 className="text-xl md:text-2xl font-bold text-cs-900 leading-relaxed">
          {message.text?.split("\n")[0]}
        </h2>
        {message.why && (
          <p className="text-cs-400 text-sm mt-2">{message.why}</p>
        )}
      </div>

      {/* Options grid */}
      <div className="space-y-3 w-full max-w-md mx-auto">
        {(message.options || []).map((opt) => (
          <OptionButton
            key={opt.id}
            option={opt}
            cardId={message.id}
            onTap={onTap}
            highlighted={highlightedOption}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// ── Option card (bubble layout) ───────────────────────────────────────────────
function OptionCardBubble({ message, onTap, disabled }) {
  return (
    <div className="max-w-[85%] bg-cs-700 text-white rounded-2xl rounded-bl-md p-4 shadow-md">
      <p className="text-sm mb-3">{message.text?.split("\n")[0]}</p>
      <div className="flex flex-wrap gap-2">
        {(message.options || []).slice(0, 6).map((opt) => (
          <button
            key={opt.id}
            onClick={() => !disabled && onTap?.(message.id, opt.id)}
            disabled={disabled}
            className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            {typeof opt.label === "object" ? opt.label.hinglish || opt.label.en : opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── List message (stage) ──────────────────────────────────────────────────────
function ListStage({ message, onTap, highlightedOption, disabled }) {
  return (
    <div className="w-full animate-slideUp">
      <div className="text-center mb-5 px-2">
        <h2 className="text-xl md:text-2xl font-bold text-cs-900 leading-relaxed">
          {message.text}
        </h2>
      </div>
      <div className="space-y-2 w-full max-w-md mx-auto max-h-[50vh] overflow-y-auto pr-1">
        {(message.rows || []).map((row) => (
          <button
            key={row.id}
            onClick={() => !disabled && onTap?.(message.id, row.id)}
            disabled={disabled}
            className={`
              w-full text-left px-5 py-3.5 rounded-xl text-sm
              transition-all duration-200 border
              ${highlightedOption === row.id
                ? "bg-emerald-500 text-white border-emerald-500"
                : disabled
                  ? "bg-white/40 text-cs-400 border-cs-200/50"
                  : "bg-white text-cs-800 border-cs-200 hover:border-emerald-400 hover:bg-emerald-50/50"
              }
            `}
          >
            <span className="font-medium">{typeof row.label === "object" ? row.label.hinglish || row.label.en : row.label || row.title}</span>
            {row.description && (
              <span className="block text-xs mt-0.5 opacity-70">{row.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Confirm card (reveal screen) ──────────────────────────────────────────────
function ConfirmCardStage({ message, onTap, disabled }) {
  return (
    <div className="w-full max-w-md mx-auto animate-slideUp">
      <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-3xl p-6 border border-emerald-200 shadow-xl shadow-emerald-500/10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            <span className="text-2xl">✨</span>
          </div>
          <p className="text-cs-800 text-base leading-relaxed whitespace-pre-line">
            {message.text}
          </p>
        </div>
        <div className="space-y-3">
          {(message.actions || []).map((action) => (
            <button
              key={action.id}
              onClick={() => !disabled && onTap?.(message.id, action.id)}
              disabled={disabled}
              className={`
                w-full py-4 px-5 rounded-2xl text-base font-semibold transition-all duration-200
                ${action.id === "confirm" || action.id === "finish"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.97]"
                  : "bg-white text-cs-700 border-2 border-cs-200 hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-[0.97]"
                }
              `}
            >
              {action.id === "confirm" || action.id === "finish" ? "✅ " : "✏️ "}
              {typeof action.label === "object" ? action.label.hinglish || action.label.en : action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── File message ──────────────────────────────────────────────────────────────
function FileMessage({ message }) {
  return (
    <a
      href={message.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-3 bg-cs-100 rounded-xl text-cs-700 hover:bg-cs-200 transition-colors text-sm"
    >
      📎 <span className="underline">Document</span>
    </a>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────
export default function MessageRenderer({
  message,
  layout = "stage",
  onTap,
  highlightedOption,
  disabled = false,
}) {
  if (!message) return null;

  if (layout === "bubble") {
    if (message.from === "user") {
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md bg-emerald-500 text-white text-sm shadow-md">
            {message.type === "tap" ? `🔘 Selected` : message.type === "voice" ? "🎤 Voice message" : message.text}
          </div>
        </div>
      );
    }
    switch (message.type) {
      case "text":
        return <TextBubble message={message} layout="bubble" />;
      case "option_card":
        return <OptionCardBubble message={message} onTap={onTap} disabled={disabled} />;
      case "confirm_card":
        return <ConfirmCardStage message={message} onTap={onTap} disabled={disabled} />;
      case "list":
        return <ListStage message={message} onTap={onTap} disabled={disabled} />;
      case "file":
        return <FileMessage message={message} />;
      default:
        return null;
    }
  }

  // Stage layout
  switch (message.type) {
    case "text":
      return <TextBubble message={message} layout="stage" />;
    case "option_card":
      return (
        <OptionCardStage
          message={message}
          onTap={onTap}
          highlightedOption={highlightedOption}
          disabled={disabled}
        />
      );
    case "list":
      return (
        <ListStage
          message={message}
          onTap={onTap}
          highlightedOption={highlightedOption}
          disabled={disabled}
        />
      );
    case "confirm_card":
      return <ConfirmCardStage message={message} onTap={onTap} disabled={disabled} />;
    case "file":
      return <FileMessage message={message} />;
    default:
      return null;
  }
}
