// Utility functions

import { AsyncIterableStream } from "ai";

interface StreamMessage {
  chunk: string;
  isComplete: boolean;
  timestamp: string;
}

interface PublishCallback<T = void> {
  (message: StreamMessage): Promise<T>;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return timestamp;
  }
}

export async function publishTokenByTokenUpdates<T>(
  textStream: AsyncIterableStream<string>,
  callback: PublishCallback<T>
) {
  let fullResponse = "";

  // Stream chunks to frontend
  for await (const chunk of textStream) {
    fullResponse += chunk;

    callback({
      chunk,
      isComplete: false,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error("Error publishing chunk:", err));
  }

  await callback({
    chunk: "",
    isComplete: true,
    timestamp: new Date().toISOString(),
  }).catch((err) => console.error("Error publishing chunk:", err));

  return fullResponse;
}
