import { inngest } from "../../client";
import { researchChannel } from "../../channels";
import { models, modelInfo } from "@/lib/ai-models";
import { streamText } from "ai";
import type { ContextItem } from "../../types";

export const analystAgent = inngest.createFunction(
  {
    id: "analyst-agent",
    name: "GPT-4 Analyst Agent",
    retries: 2, // Auto-retry on failure
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "agent/analyze" },
  async ({ event, step, publish }) => {
    const { query, contexts, sessionId } = event.data;
    const startTime = +new Date(event.ts!);

    // Publish agent starting
    await step.run("publish-analyst-start", async () => {
      await publish(
        researchChannel(sessionId)["agent-update"]({
          agent: "analyst",
          status: "starting",
          message: `${modelInfo.analyst.name}: Starting deep analysis`,
          timestamp: new Date().toISOString(),
        })
      );
    });

    // Simulate potential failure for retry demo (10% chance)
    await step.run("check-availability", async () => {
      if (Math.random() < 0.1) {
        throw new Error("GPT-4 API temporarily unavailable");
      }
    });

    // Generate analysis with streaming
    const result = await step.run("gpt4-analysis", async () => {
      const contextText = contexts
        .map((c: ContextItem | null, i: number) => {
          if (!c) return `[${i + 1}] No context available`;
          return `[${i + 1}] ${c.source}: ${c.text}`;
        })
        .join("\n\n");

      const { textStream } = await streamText({
        model: models.analyst,
        prompt: `You are a deep analysis specialist. Provide a comprehensive, detailed analysis of the following query based on the provided context. Be thorough and insightful.

Query: ${query}

Context:
${contextText}

Provide your detailed analysis:`,
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
      await step.run(`publish-analyst-chunk-${Math.random().toString(36).substr(2, 9)}`, async () => {
        await publish(
          researchChannel(sessionId)["agent-chunk"]({
            agent: "analyst",
            chunk,
            isComplete: false,
            timestamp: new Date().toISOString(),
          })
        );
      });
    }
    
    // Signal completion
    await step.run("publish-analyst-complete-signal", async () => {
      await publish(
        researchChannel(sessionId)["agent-chunk"]({
          agent: "analyst",
          chunk: "",
          isComplete: true,
          timestamp: new Date().toISOString(),
        })
      );
    });

    const duration = Date.now() - startTime;

    // Publish completion
    await step.run("publish-analyst-complete", async () => {
      await publish(
        researchChannel(sessionId)["agent-update"]({
          agent: "analyst",
          status: "completed",
          message: `${modelInfo.analyst.name}: Analysis complete`,
          timestamp: new Date().toISOString(),
          duration,
        })
      );

      await publish(
        researchChannel(sessionId)["agent-result"]({
          agent: "analyst",
          response: result.fullResponse,
          model: "gpt-4-turbo-preview",
          timestamp: new Date().toISOString(),
        })
      );
    });

    return {
      agent: "analyst" as const,
      response: result.fullResponse,
      model: "gpt-4-turbo-preview",
      duration,
    };
  }
);
