import React from "react";
import "../styles/SummarizerPage.css";
interface DocumentInsightsProps {
  wordCount: number;
}

const DocumentInsights: React.FC<DocumentInsightsProps> = ({ wordCount }) => (
  <div className="document-insights">
    <div className="insights-title">Document Insights</div>
    <div className="insight-item">Red Flags <span className="insight-value">0</span></div>
    <div className="insight-item">Text Chunks <span className="insight-value">0</span></div>
    <div className="insight-item">Word Count <span className="insight-value">{wordCount}</span></div>
  </div>
);

export default DocumentInsights;
