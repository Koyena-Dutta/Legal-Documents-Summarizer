import axios from "axios";

const API = axios.create({ baseURL: "http://127.0.0.1:8000" });

// Upload document for summarization
export const uploadDocument = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/upload", formData);
};

// Ask a question about uploaded document
export const askQuestion = (query) => {
  return API.post("/ask", { question: query });
};

export const exportSummary = async (fileHash) => {
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
