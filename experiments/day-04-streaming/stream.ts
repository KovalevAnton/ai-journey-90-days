import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PROMPT = "What are the three most important things a frontend engineer should understand about LLMs before building AI products? Be concise.";

// ── Non-streaming baseline ─────────────────────────────

async function runNonStreaming() {
  const t0 = performance.now();
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: PROMPT }],
  });
  const elapsed = performance.now() - t0;
  const block = msg.content[0];
  if (block.type !== "text") throw new Error("non-text block");

  console.log("── NON-STREAMING ──");
  console.log(block.text);
  console.log(`\nTotal: ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`Tokens: ${msg.usage.input_tokens} in, ${msg.usage.output_tokens} out`);
  return elapsed;
}

// ── Streaming ──────────────────────────────────────────

async function runStreaming() {
  const t0 = performance.now();
  let firstTokenTime: number | null = null;
  let outputTokens = 0;

  console.log("\n── STREAMING ──");

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: PROMPT }],
  });

  stream.on("text", (text) => {
    if (firstTokenTime === null) firstTokenTime = performance.now() - t0;
    process.stdout.write(text);
  });

  const finalMessage = await stream.finalMessage();
  const elapsed = performance.now() - t0;
  outputTokens = finalMessage.usage.output_tokens;

  console.log(`\n\nTime to first token: ${(firstTokenTime! / 1000).toFixed(2)}s`);
  console.log(`Total: ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`Tokens: ${finalMessage.usage.input_tokens} in, ${outputTokens} out`);
  return { ttft: firstTokenTime!, total: elapsed };
}

// ── Compare ────────────────────────────────────────────

async function main() {
  const nonStreamingTime = await runNonStreaming();
  const { ttft, total } = await runStreaming();

  console.log("\n── COMPARISON ──");
  console.log(`Non-streaming total:   ${(nonStreamingTime / 1000).toFixed(2)}s`);
  console.log(`Streaming total:       ${(total / 1000).toFixed(2)}s`);
  console.log(`Streaming first token: ${(ttft / 1000).toFixed(2)}s`);
  console.log(`Perceived speedup:     ${(nonStreamingTime / ttft).toFixed(1)}x faster first token`);
}

main().catch(console.error);
