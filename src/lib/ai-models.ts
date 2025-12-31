import { createOpenAI } from "@ai-sdk/openai";

// LiteLLM Proxy configuration
const litellmProxy = createOpenAI({
  baseURL: "http://khoadue.me:4010",
  apiKey: process.env.LITELLM_API_KEY || "sk-not-needed", // LiteLLM often doesn't need API key for local proxy
});

/**
 * AI Model configurations for different agents
 * Each model is specialized for a specific task
 */
export const models = {
  // GPT-4: Deep analysis and detailed responses
  analyst: litellmProxy("gpt-4o"),

  // Claude: Summarization and concise explanations
  summarizer: litellmProxy("gpt-4o"),

  // Gemini: Fact-checking and validation
  factChecker: litellmProxy("gpt-4o-mini"),

  // Mistral: Topic classification and categorization
  classifier: litellmProxy("gpt-4o"),

  // GPT-4: Final synthesis combining all agent outputs
  synthesizer: litellmProxy("gpt-4o"),
};

/**
 * Model metadata for display purposes
 */
export const modelInfo = {
  analyst: {
    name: "GPT-4 Analyst",
    provider: "OpenAI",
    icon: "🔍",
    description: "Deep analysis and detailed insights",
    color: "blue",
  },
  summarizer: {
    name: "Claude Summarizer",
    provider: "Anthropic",
    icon: "📝",
    description: "Concise summaries and key points",
    color: "purple",
  },
  factChecker: {
    name: "Gemini Fact-Checker",
    provider: "Google",
    icon: "✓",
    description: "Validates claims and checks accuracy",
    color: "green",
  },
  classifier: {
    name: "Mistral Classifier",
    provider: "Mistral AI",
    icon: "🏷️",
    description: "Categorizes and classifies content",
    color: "orange",
  },
  synthesizer: {
    name: "GPT-4 Synthesizer",
    provider: "OpenAI",
    icon: "🧠",
    description: "Combines insights from all agents",
    color: "indigo",
  },
} as const;

export type AgentType = keyof typeof models;
