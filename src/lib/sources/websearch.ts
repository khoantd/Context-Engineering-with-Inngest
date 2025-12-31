import type { WebSearchResult } from "@/inngest/types";

interface SerpApiResult {
  snippet?: string;
  title?: string;
  link?: string;
}

export async function fetchWebSearch(query: string): Promise<WebSearchResult[]> {
  if (!process.env.SERP_API_KEY) {
    console.log("SERP_API_KEY not set, skipping web search");
    return [];
  }

  try {
    // Using SerpAPI for web search
    const response = await fetch(
      `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${process.env.SERP_API_KEY}&num=5`
    );

    if (!response.ok) {
      console.error("SerpAPI error:", response.statusText);
      return [];
    }

    const data = await response.json();

    return (
      data.organic_results?.map((result: SerpApiResult) => ({
        source: "websearch" as const,
        text: result.snippet || "",
        title: result.title || "Untitled",
        url: result.link || "",
        relevance: 0,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching from web search:", error);
    return [];
  }
}

