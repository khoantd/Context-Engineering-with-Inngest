import { inngest } from "../../client";
import { researchChannel } from "../../channels";
import { models, modelInfo } from "@/lib/ai-models";
import { streamText } from "ai";
import type { ContextItem } from "../../types";

export const factCheckerAgent = inngest.createFunction(
  {
    id: "fact-checker-agent",
    name: "Gemini Fact-Checker Agent",
    retries: 2,
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "agent/fact-check" },
  async ({ event, step, publish }) => {
    const { query, contexts, sessionId } = event.data;
    const startTime = +new Date(event.ts!);

    await step.run("publish-fact-checker-start", async () => {
      await publish(
        researchChannel(sessionId)["agent-update"]({
          agent: "factChecker",
          status: "starting",
          message: `${modelInfo.factChecker.name}: Starting fact verification`,
          timestamp: new Date().toISOString(),
        })
      );
    });

    // Simulate potential failure (10% chance)
    await step.run("check-availability", async () => {
      if (Math.random() < 0.1) {
        throw new Error("Gemini API temporarily unavailable");
      }
    });

    const result = await step.run("gemini-fact-checking", async () => {
      const contextText = contexts
        .map((c: ContextItem | null, i: number) => {
          if (!c) return `[${i + 1}] No context available`;
          return `[${i + 1}] ${c.source}: ${c.text}`;
        })
        .join("\n\n");

      const { textStream } = await streamText({
        model: models.factChecker,
        prompt: `You are a fact-checking specialist. Analyze the provided context and verify the accuracy of information related to the query. Identify any claims that need validation.

Query: ${query}

Context:
${contextText}

Provide your fact-checking analysis:`,
      });

      // Collect all chunks first
      const chunks: string[] = [];
      let fullResponse = "";
      for await (const chunk of textStream) {
        fullResponse += chunk;
        chunks.push(chunk);
      }

      return { fullResponse, chunks };
    });

    // Publish streaming updates outside of step.run to avoid nesting
    for (const chunk of result.chunks) {
      await step.run(`publish-fact-checker-chunk-${Math.random().toString(36).substr(2, 9)}`, async () => {
        await publish(
          researchChannel(sessionId)["agent-chunk"]({
            agent: "factChecker",
            chunk,
            isComplete: false,
            timestamp: new Date().toISOString(),
          })
        );
      });
    }
    
    // Signal completion
    await step.run("publish-fact-checker-complete-signal", async () => {
      await publish(
        researchChannel(sessionId)["agent-chunk"]({
          agent: "factChecker",
          chunk: "",
          isComplete: true,
          timestamp: new Date().toISOString(),
        })
      );
    });

    const duration = Date.now() - startTime;

    await step.run("publish-fact-checker-complete", async () => {
      await publish(
        researchChannel(sessionId)["agent-update"]({
          agent: "factChecker",
          status: "completed",
          message: `${modelInfo.factChecker.name}: Fact-checking complete`,
          timestamp: new Date().toISOString(),
          duration,
        })
      );

      await publish(
        researchChannel(sessionId)["agent-result"]({
          agent: "factChecker",
          response: result.fullResponse,
          model: "gemini-1.5-pro",
          timestamp: new Date().toISOString(),
        })
      );
    });

    return {
      agent: "factChecker" as const,
      response: result.fullResponse,
      model: "gemini-1.5-pro",
      duration,
    };
  }
);
