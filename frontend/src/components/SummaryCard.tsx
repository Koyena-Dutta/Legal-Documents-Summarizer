import React from "react";
import "../styles/SummaryCard.css";

interface SummaryCardProps {
  title: string;
  status?: string;
  summary?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, status, summary }) => {
  return (
    <div className="summary-card">
      <div className="summary-card-header">
        <span className="summary-card-title">{title}</span>
        {status && (
          <span className="summary-card-status">{status}</span>
        )}
      </div>
      <div className="summary-card-content">
        {summary ? (
          <div className="summary-text">{summary}</div>
        ) : (
          <div className="summary-placeholder">Waiting for summary...</div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;
