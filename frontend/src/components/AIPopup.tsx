import React from "react";
import "../styles/SummarizerPage.css";
interface AIPopupProps {
  popup: { text: string; x: number; y: number } | null;
  onExplain: () => void;
  onFlag: () => void;
  onDiscuss: () => void;
  onClose: () => void;
}

const AIPopup: React.FC<AIPopupProps> = ({ popup, onExplain, onFlag, onDiscuss, onClose }) => {
  if (!popup) return null;
  return (
    <div
      className="ai-popup"
      style={{ position: "absolute", left: popup.x, top: popup.y, zIndex: 1000, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", borderRadius: "12px", padding: "18px 20px", minWidth: "320px" }}
    >
      <div style={{ fontWeight: 600, color: "#4b2178", marginBottom: 8 }}>
        AI Analysis Lens
      </div>
      <div style={{ fontSize: "0.98rem", color: "#222", marginBottom: 10 }}>
        Get AI insights on the selected text passage.
      </div>
      <div style={{ fontStyle: "italic", background: "#f7f7fa", padding: "8px 10px", borderRadius: "6px", marginBottom: 12 }}>
        "{popup.text}"
      </div>
      <button style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontWeight: 600, fontSize: "1rem", marginRight: 10, cursor: "pointer" }} onClick={onExplain}>
        Explain This
      </button>
      <button style={{ background: "#fff3f3", color: "#d32f2f", border: "1px solid #d32f2f", borderRadius: "8px", padding: "8px 14px", fontWeight: 500, fontSize: "0.98rem", marginRight: 10, cursor: "pointer" }} onClick={onFlag}>
        Flag Risk
      </button>
      <button style={{ background: "#f7f7fa", color: "#222", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "8px 14px", fontWeight: 500, fontSize: "0.98rem", cursor: "pointer" }} onClick={onDiscuss}>
        Discuss
      </button>
      <button onClick={onClose} style={{ float: "right", background: "none", border: "none", color: "#888", fontSize: "1.2rem", marginTop: 8, cursor: "pointer" }}>
        ×
      </button>
    </div>
  );
};

export default AIPopup;
