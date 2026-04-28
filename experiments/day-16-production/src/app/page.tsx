"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Meta {
  sources: string[];
  remaining: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput("");
    setError(null);
    setMeta(null);
    setIsStreaming(true);

    const userMessage: Message = { role: "user", content: question };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: messages,
          website: "",  // honeypot — bots fill this
        }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        setError(data.error || "Something went wrong");
        setMessages(newMessages);
        setIsStreaming(false);
        if (data.remaining !== undefined) setRemaining(data.remaining);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "meta") {
              setMeta(data);
              setRemaining(data.remaining);
            } else if (data.type === "token") {
              fullText += data.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: fullText,
                };
                return updated;
              });
            } else if (data.type === "done") {
              // done
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Network error");
      setMessages(newMessages);
    }

    setIsStreaming(false);
  }

  return (
    <>
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          background: #0a0a0a;
          color: #e5e5e5;
          height: 100dvh;
          -webkit-text-size-adjust: 100%;
        }
        /* Markdown styles */
        .md-content p { margin-bottom: 0.5em; }
        .md-content p:last-child { margin-bottom: 0; }
        .md-content strong { color: #fff; font-weight: 600; }
        .md-content em { color: #ccc; }
        .md-content ul, .md-content ol {
          margin: 0.4em 0;
          padding-left: 1.4em;
        }
        .md-content li { margin-bottom: 0.2em; }
        .md-content code {
          background: #1a1a2e;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .md-content blockquote {
          border-left: 3px solid #333;
          padding-left: 12px;
          color: #999;
          margin: 0.5em 0;
        }
        .md-content h1, .md-content h2, .md-content h3 {
          color: #fff;
          margin: 0.6em 0 0.3em;
          font-size: 1em;
          font-weight: 600;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
        {/* Header */}
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #222",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, fontWeight: 600 }}>
              The Bro Code Chat
            </h1>
            <p style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              Ask anything about The Bro Code — in any language
            </p>
          </div>
          {remaining !== null && (
            <span
              style={{
                fontSize: 11,
                color: remaining > 3 ? "#666" : remaining > 0 ? "#f59e0b" : "#ef4444",
                whiteSpace: "nowrap",
                marginLeft: 12,
              }}
            >
              {remaining} left today
            </span>
          )}
        </header>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                color: "#444",
                padding: "0 16px",
              }}
            >
              <div style={{ fontSize: 48 }}>🤵</div>
              <p style={{ fontSize: 14, textAlign: "center" }}>
                Suit up and ask a question! Works in any language.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                  maxWidth: 500,
                }}
              >
                {[
                  "Can I date my bro's ex?",
                  "What's the wingman oath?",
                  "¿Puedo elegir a mi novia sobre mis bros?",
                  "Можно ли отказаться от дай пять?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    style={{
                      background: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: "#999",
                      fontSize: 13,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                maxWidth: 680,
                width: "100%",
                margin: "0 auto",
                ...(msg.role === "user"
                  ? {
                      background: "#1a1a2e",
                      padding: "10px 14px",
                      borderRadius: 12,
                    }
                  : { padding: "4px 0" }),
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase" as const,
                  letterSpacing: 0.5,
                  color: "#555",
                  marginBottom: 4,
                }}
              >
                {msg.role === "user" ? "You" : "Barney's AI"}
              </div>
              {msg.role === "user" ? (
                <div style={{ lineHeight: 1.6 }}>{msg.content}</div>
              ) : (
                <div className="md-content" style={{ lineHeight: 1.6 }}>
                  <ReactMarkdown
                    components={{
                      a: ({ children }) => <span>{children}</span>,
                    }}
                  >{msg.content}</ReactMarkdown>
                  {isStreaming && i === messages.length - 1 && (
                    <span style={{ opacity: 0.5 }}>▊</span>
                  )}
                </div>
              )}
            </div>
          ))}

          {meta && (
            <div
              style={{
                maxWidth: 680,
                width: "100%",
                margin: "0 auto",
                fontSize: 11,
                color: "#444",
              }}
            >
              Sources: {meta.sources.join(", ")}
            </div>
          )}

          {error && (
            <div
              style={{
                maxWidth: 680,
                width: "100%",
                margin: "0 auto",
                padding: "10px 14px",
                background: "#2a1515",
                borderRadius: 8,
                color: "#ef4444",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: "12px",
            borderTop: "1px solid #222",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              maxWidth: 680,
              margin: "0 auto",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about The Bro Code... in any language"
              disabled={isStreaming || remaining === 0}
              style={{
                flex: 1,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "12px 14px",
                color: "#e5e5e5",
                fontSize: 16, // 16px prevents iOS zoom on focus
                outline: "none",
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim() || remaining === 0}
              style={{
                background: "#e5e5e5",
                color: "#0a0a0a",
                border: "none",
                borderRadius: 8,
                padding: "12px 18px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                opacity: isStreaming || !input.trim() ? 0.3 : 1,
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#333",
              marginTop: 8,
            }}
          >
            Built by{" "}
            <a
              href="https://kovalevanton.xyz"
              target="_blank"
              style={{ color: "#555" }}
            >
              Anton Kovalev
            </a>
            {" · "}Day 16 of 90-day AI engineering journey
          </p>
        </form>
      </div>
    </>
  );
}
