import axios from "axios";

const API = axios.create({ baseURL: "http://127.0.0.1:8000" });

// Upload document for summarization
export const uploadDocument = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/upload", formData);
};

// Ask a question about uploaded document
export const askQuestion = (query: string) => {
  return API.post("/ask", { question: query });
};

export const exportSummary = async (fileHash: string): Promise<void> => {
  try {
    const response = await fetch("http://localhost:8000/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileHash }),
    });
    if (!response.ok) throw new Error("Export failed");
    const data = await response.json();
    if (data.public_url) {
      window.open(data.public_url, "_blank");
    } else {
      alert("No export URL returned.");
    }
  } catch (err) {
    alert("Failed to export summary.");
  }
};

// Fetch status for multiple file hashes
export async function fetchSummaryStatus(
  fileHashes: string[]
): Promise<Record<string, boolean>> {
  try {
    const response = await fetch("http://localhost:8000/summary/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fileHashes),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch summary status");
    }

    const data = await response.json(); // { status: { fileHash: true/false } }
    return data.status;
  } catch (error) {
    console.error("Error fetching summary status:", error);
    return {};
  }
}

// Fetch summary for one file hash
export async function fetchSummary(fileHash: string): Promise<string | null> {
  try {
    const response = await fetch("http://localhost:8000/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileHash }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch summary");
    }

    const data = await response.json(); // { summary: "..." }
    return data.summary;
  } catch (error) {
    console.error("Error fetching summary:", error);
    return null;
  }
}
