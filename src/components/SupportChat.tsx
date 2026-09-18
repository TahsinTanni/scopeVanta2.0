"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, Button, Input } from "@/components/ui";

type Message = { role: "user" | "assistant"; text: string };

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessages((m) => [...m, { role: "assistant", text: data.reply || "" }]);
        setConversationId(data.conversationId);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: "Sorry, I couldn't respond just now — try again in a moment." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, I couldn't respond just now — try again in a moment." }]);
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {open && (
        <Card className="fixed bottom-20 right-5 z-50 flex w-80 max-w-[calc(100vw-2.5rem)] max-h-[480px] flex-col overflow-hidden rounded-[8px] border-border-hairline bg-surface-1 shadow-2xl">
          <div className="-mx-5 -mt-5 flex items-center justify-between border-b border-border-hairline px-4 py-3">
            <span className="text-sm font-semibold text-ink-primary font-display">ScopeVanta Guide</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-[4px] p-1 text-ink-muted hover:bg-surface-3 hover:text-ink-primary transition-colors"
              aria-label="Close support chat"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div ref={listRef} className="-mx-5 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {!messages.length && (
              <p className="text-xs text-ink-muted">Ask about getting started, plan limits, or how a feature works.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[8px] px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-accent/15 text-ink-primary" : "bg-surface-2 text-ink-secondary"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="-mx-5 border-t border-border-hairline px-4 py-2">
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`} className="text-[11px] text-ink-muted hover:text-ink-primary transition-colors">
                Need a human? Email {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
              </a>
            ) : (
              <span className="text-[11px] text-ink-muted">Contact support via your account email</span>
            )}
          </div>

          <div className="-mx-5 -mb-5 flex items-center gap-2 border-t border-border-hairline px-3 py-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask a question…"
              className="text-xs"
            />
            <Button
              disabled={sending || !input.trim()}
              onClick={sendMessage}
              className="shrink-0 text-xs py-1.5 px-3"
            >
              Send
            </Button>
          </div>
        </Card>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[#002116] hover:bg-accent-hover active:bg-accent-pressed transition-colors shadow-lg"
      >
        <span className="material-symbols-outlined text-[22px]">{open ? "close" : "support_agent"}</span>
      </button>
    </>,
    document.body
  );
}
