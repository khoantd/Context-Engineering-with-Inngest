import { inngest } from "../../client";
import { researchChannel } from "../../channels";
import { models, modelInfo } from "@/lib/ai-models";
import { streamText } from "ai";
import type { ContextItem } from "../../types";

export const classifierAgent = inngest.createFunction(
  {
    id: "classifier-agent",
    name: "Mistral Classifier Agent",
    retries: 2,
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "agent/classify" },
  async ({ event, step, publish }) => {
    const { query, contexts, sessionId } = event.data;
    const startTime = +new Date(event.ts!);

    await step.run("publish-classifier-start", async () => {
      await publish(
        researchChannel(sessionId)["agent-update"]({
          agent: "classifier",
          status: "starting",
          message: `${modelInfo.classifier.name}: Starting classification`,
          timestamp: new Date().toISOString(),
        })
      );
    });

    // Simulate potential failure (10% chance)
    await step.run("check-availability", async () => {
      if (Math.random() < 0.1) {
        throw new Error("Mistral API temporarily unavailable");
      }
    });

    const result = await step.run("mistral-classification", async () => {
      const contextText = contexts
        .map((c: ContextItem | null, i: number) => {
          if (!c) return `[${i + 1}] No context available`;
          return `[${i + 1}] ${c.source}: ${c.text}`;
        })
        .join("\n\n");

      const { textStream } = await streamText({
        model: models.classifier,
        prompt: `You are a classification specialist. Categorize the query and identify key topics, themes, and relevant domains. Provide clear categorization.

Query: ${query}

Context:
${contextText}

Provide your classification and categorization:`,
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
      await step.run(`publish-classifier-chunk-${Math.random().toString(36).substr(2, 9)}`, async () => {
        await publish(
          researchChannel(sessionId)["agent-chunk"]({
            agent: "classifier",
            chunk,
            isComplete: false,
            timestamp: new Date().toISOString(),
          })
        );
      });
    }
    
    // Signal completion
    await step.run("publish-classifier-complete-signal", async () => {
      await publish(
        researchChannel(sessionId)["agent-chunk"]({
          agent: "classifier",
          chunk: "",
          isComplete: true,
          timestamp: new Date().toISOString(),
        })
      );
    });

    const duration = Date.now() - startTime;

    await step.run("publish-classifier-complete", async () => {
      await publish(
        researchChannel(sessionId)["agent-update"]({
          agent: "classifier",
          status: "completed",
          message: `${modelInfo.classifier.name}: Classification complete`,
          timestamp: new Date().toISOString(),
          duration,
        })
      );

      await publish(
        researchChannel(sessionId)["agent-result"]({
          agent: "classifier",
          response: result.fullResponse,
          model: "mistral-large-latest",
          timestamp: new Date().toISOString(),
        })
      );
    });

    return {
      agent: "classifier" as const,
      response: result.fullResponse,
      model: "mistral-large-latest",
      duration,
    };
  }
);
