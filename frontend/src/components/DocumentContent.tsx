import React from "react";
import "../styles/SummarizerPage.css";
interface DocumentContentProps {
  docText: string;
  onTextSelect: (selected: { text: string; x: number; y: number } | null) => void;
}

const DocumentContent: React.FC<DocumentContentProps> = ({ docText, onTextSelect }) => {
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      onTextSelect({
        text: selection.toString(),
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 8,
      });
    } else {
      onTextSelect(null);
    }
  };

  return (
    <div
      className="doc-textarea selectable-doc"
      style={{ whiteSpace: "pre-wrap", cursor: "text", minHeight: "420px", background: "#fff", borderRadius: "8px", padding: "12px", color: "#222", fontSize: "1rem", border: "1px solid #e0e0e0" }}
      tabIndex={0}
      onMouseUp={handleMouseUp}
    >
      {docText}
    </div>
  );
};

export default DocumentContent;
