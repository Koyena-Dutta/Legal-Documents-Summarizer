import { useState, useEffect } from "react";
import SummaryCard from "./SummaryCard";
import "../styles/DocumentInsights.css";

interface DocumentInsightsProps {
  wordCount: number;
  redFlags: string;
  textChunks?: string;
  fileHashes: string[];
  selectedDocIndex?: number;
  selectedFiles?: any[];
}

function DocumentInsights({
  wordCount,
  redFlags,
  textChunks,
  fileHashes,
  selectedDocIndex = 0,
  selectedFiles = [],
}: DocumentInsightsProps) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  const selectedFileHash = selectedFiles[selectedDocIndex]?.fileHash;
  const selectedFileName = selectedFiles[selectedDocIndex]?.name;
  const textChunksCount = textChunks
    ? textChunks.split("\n").filter((chunk) => chunk.trim()).length
    : 0;

  useEffect(() => {
    if (!fileHashes || fileHashes.length === 0) return;

    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch status for all files
        const statusRes = await fetch("http://127.0.0.1:8000/summary/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fileHashes),
        });

        const statusJson = await statusRes.json();
        if (cancelled) return;

        const newStatus = statusJson.status || {};
        setStatus(newStatus);

        // 2. Collect all ready files that we don't have summaries for
        const readyFiles = fileHashes.filter(
          (fh) => newStatus[fh] && !summaries[fh]
        );

        if (readyFiles.length > 0) {
          try {
            // 3. Fetch all summaries in one batch request
            const batchRes = await fetch("http://127.0.0.1:8000/summary/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileHashes: readyFiles }),
            });

            if (batchRes.ok) {
              const batchJson = await batchRes.json();

              // batchJson should be something like { summaries: { [fileHash]: summaryText } }
              if (!cancelled) {
                setSummaries((prev) => ({
                  ...prev,
                  ...batchJson.summaries,
                }));
              }
            } else {
              console.error("Batch summary fetch failed", batchRes.status);
            }
          } catch (err) {
            console.error("Error fetching batch summaries:", err);
          }
        }
      } catch (err) {
        console.error("Error fetching summaries/status:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fileHashes, summaries]);

  return (
    <div className="document-insights-panel">
      <div className="insights-container">
        <h3 className="insights-title">Document Insights</h3>
        <div className="insights-grid">
          <div className="insight-item">
            <span className="insight-label">Red Flags</span>
            <span className="insight-value red-flags">{redFlags || "0"}</span>
          </div>
          <div className="insight-item">
            <span className="insight-label">Text Chunks</span>
            <span className="insight-value text-chunks">{textChunksCount}</span>
          </div>
          <div className="insight-item">
            <span className="insight-label">Word Count</span>
            <span className="insight-value word-count">{wordCount}</span>
          </div>
        </div>
      </div>

      <div className="summaries-container">
        <div className="summaries-header">
          <span className="summaries-icon">💡</span>
          <h3 className="summaries-title">Summaries (Selected)</h3>
        </div>

        <div className="summaries-content">
          {!selectedFileHash ? (
            <p className="no-document-message">No document selected</p>
          ) : isLoading && !summaries[selectedFileHash] ? (
            <p className="loading-message">Checking summary status...</p>
          ) : (
            <SummaryCard
              key={selectedFileHash}
              title={
                selectedFileName || `Document ${selectedFileHash.substring(0, 8)}...`
              }
              summary={summaries[selectedFileHash]}
              status={
    status[selectedFileHash] ? "Ready" : "Waiting for summary..."
  }
  
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentInsights;
