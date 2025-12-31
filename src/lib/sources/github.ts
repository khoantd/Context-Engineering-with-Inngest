import type { GithubResult } from "@/inngest/types";

interface GithubRepository {
  name?: string;
  description?: string;
  html_url?: string;
}

export async function fetchGithub(query: string): Promise<GithubResult[]> {
  if (!process.env.GITHUB_TOKEN) {
    console.log("GITHUB_TOKEN not set, skipping GitHub search");
    return [];
  }

  try {
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=5&sort=stars`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      console.error("GitHub API error:", response.statusText);
      return [];
    }

    const data = await response.json();

    return (
      data.items?.map((item: GithubRepository) => ({
        source: "github" as const,
        text: item.description || item.name || "",
        title: item.name || "Untitled",
        url: item.html_url || "",
        relevance: 0,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching from GitHub:", error);
    return [];
  }
}

