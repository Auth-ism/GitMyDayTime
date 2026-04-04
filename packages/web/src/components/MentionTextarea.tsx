import { useRef, useState } from "react";
import type { ProjectMember } from "@gmd/shared";

interface Props {
  value: string;
  onChange: (val: string) => void;
  members?: ProjectMember[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/** Renders @mention tokens as highlighted spans inside a <p>. */
export function CommentText({ content }: { content: string }) {
  const parts = content.split(/(@\w+)/g);
  return (
    <p className="text-xs text-text leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        /^@\w+$/.test(part)
          ? <span key={i} className="text-accent font-medium">{part}</span>
          : part
      )}
    </p>
  );
}

export default function MentionTextarea({ value, onChange, members = [], placeholder, className, autoFocus, onKeyDown }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null); // null = closed
  const [dropUp, setDropUp] = useState(false);

  // Detect @trigger from current cursor position
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const pos = e.target.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const match = before.match(/@(\w*)$/);
    if (match) {
      // Decide drop direction
      const rect = e.target.getBoundingClientRect();
      setDropUp(rect.bottom > window.innerHeight - 200);
      setQuery(match[1]);
    } else {
      setQuery(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && query !== null) {
      e.stopPropagation();
      setQuery(null);
      return;
    }
    onKeyDown?.(e);
  };

  const insertMention = (username: string) => {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    // Replace the @query prefix
    const atIdx = before.lastIndexOf("@");
    const newVal = before.slice(0, atIdx) + `@${username} ` + after;
    onChange(newVal);
    setQuery(null);
    // Restore focus
    requestAnimationFrame(() => {
      el.focus();
      const newPos = atIdx + username.length + 2;
      el.setSelectionRange(newPos, newPos);
    });
  };

  const filtered = query === null ? [] : members.filter(m => {
    const name = (m.displayName || m.username || m.email || "").toLowerCase();
    const un = (m.username || "").toLowerCase();
    return name.includes(query.toLowerCase()) || un.includes(query.toLowerCase());
  }).slice(0, 8);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {query !== null && filtered.length > 0 && (
        <div className={`absolute left-0 right-0 z-30 bg-bg-elevated border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {filtered.map(m => (
            <button
              key={m.userId}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => insertMention(m.username || m.email || m.userId)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 text-left"
            >
              <div className="w-5 h-5 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                {m.avatarUrl
                  ? <img src={m.avatarUrl} className="w-5 h-5 rounded-full object-cover" />
                  : <span className="text-[9px] font-semibold text-text-secondary">{(m.username || m.email || "?").slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-text">{m.displayName || m.username}</span>
                {m.displayName && m.username && (
                  <span className="text-[10px] text-text-tertiary ml-1">@{m.username}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
