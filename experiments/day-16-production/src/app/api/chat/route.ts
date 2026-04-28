/**
 * POST /api/chat — RAG chat endpoint with SSE streaming.
 *
 * Security layers:
 *   1. User-agent filter (block obvious bots)
 *   2. Payload size check (max 50KB)
 *   3. Honeypot field
 *   4. IP-based rate limiting (Upstash Redis, required in prod)
 *   5. Input validation (question length, history sanitization)
 *   6. Stream cancellation on client disconnect
 *
 * Pipeline: expand → retrieve → stream.
 */

import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { expandQuery, retrieve, streamAnswer, type Message } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 30;

// ── History validation ──

function sanitizeHistory(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];

  const valid: Message[] = [];

  for (const entry of raw.slice(-6)) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      (entry.role !== "user" && entry.role !== "assistant") ||
      typeof entry.content !== "string"
    ) {
      continue;
    }

    // Truncate long messages to prevent token stuffing
    const content = entry.content.slice(0, 1000);
    valid.push({ role: entry.role, content });
  }

  // Enforce alternating turns (user, assistant, user, ...)
  const cleaned: Message[] = [];
  for (const msg of valid) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === msg.role) continue; // skip consecutive same-role
    cleaned.push(msg);
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    // ── Bot protection ──
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";

    const botPatterns = /bot|crawl|spider|curl|wget|python|httpx|postman|insomnia/i;
    if (!userAgent || botPatterns.test(userAgent)) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Payload size check ──
    const contentLength = parseInt(headersList.get("content-length") || "0");
    if (contentLength > 50_000) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Parse request ──
    const body = await req.json();

    // Honeypot: if this hidden field is filled, it's a bot
    if (body.website) {
      return new Response(
        JSON.stringify({ error: "Something went wrong" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Rate limit ──
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "";

    if (!ip) {
      return new Response(
        JSON.stringify({ error: "Unable to identify client" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const rateLimit = await checkRateLimit(ip);

    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. You can send 10 messages per day. Come back tomorrow!",
          remaining: 0,
          limit: rateLimit.limit,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Validate input ──
    const question: string = body.question?.trim();

    if (!question) {
      return new Response(
        JSON.stringify({ error: "No question provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (question.length > 500) {
      return new Response(
        JSON.stringify({ error: "Question too long (max 500 chars)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sanitize history: validate types, enforce alternating, truncate content
    const trimmedHistory = sanitizeHistory(body.history);

    // ── RAG pipeline ──

    // 1. Expand query (also translates to English for retrieval)
    const expanded = await expandQuery(question, trimmedHistory);

    // 2. Retrieve
    const chunks = await retrieve(expanded, 5);

    // 3. Stream response via SSE
    const stream = streamAnswer(question, trimmedHistory, chunks);

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata (no internal details like expanded query)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "meta",
                sources: chunks.map((c) => c.title),
                remaining: rateLimit.remaining,
              })}\n\n`
            )
          );

          // Stream tokens — cancel if client disconnects
          for await (const event of stream) {
            if (req.signal.aborted) {
              stream.abort();
              break;
            }

            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "token", text: event.delta.text })}\n\n`
                )
              );
            }
          }

          if (!req.signal.aborted) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            );
          }

          controller.close();
        } catch (err) {
          if (!req.signal.aborted) {
            controller.error(err);
          }
        }
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
