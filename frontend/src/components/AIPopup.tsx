import React, { useState, useEffect } from "react";
import "../styles/SummarizerPage.css";

interface AIPopupProps {
  popup: { text: string; x: number; y: number } | null;
  onExplain: (role: string) => void;
  onFlag: () => void;
  onDiscuss: () => void;
  onClose: () => void;
  aiResponse: string;
  loading: boolean;
}

const AIPopup: React.FC<AIPopupProps> = ({
  popup,
  onExplain,
  onFlag,
  onDiscuss,
  onClose,
  aiResponse,
  loading,
}) => {
  const [role, setRole] = useState<string>("Tenant");
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  // Update position when popup changes
  useEffect(() => {
    if (popup) {
      const { x, y } = popup;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const popupWidth = 380; // maxWidth of popup
      const popupHeight = 200; // approximate height

      let left = x;
      let top = y;

      // Adjust if popup would overflow the screen
      if (x + popupWidth > screenWidth) left = screenWidth - popupWidth - 10;
      if (y + popupHeight > screenHeight) top = screenHeight - popupHeight - 10;

      setPosition({ left, top });
    }
  }, [popup]);

  if (!popup) return null;

  return (
    <div
      className="ai-popup"
      style={{
        position: "absolute",
        left: popup.x,
        top: popup.y,
        zIndex: 1000,
        background: "#fff",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        borderRadius: "12px",
        padding: "16px",
        maxWidth: "500px", 
        minWidth: "300px", 
        wordWrap: "break-word",
      }}
    >
      {/* Title */}
      <div style={{ fontWeight: 600, color: "#4b2178", marginBottom: 6 }}>AI Analysis Lens</div>
      <div style={{ fontSize: "0.9rem", color: "#444", marginBottom: 10 }}>
        Get AI insights on the selected text.
      </div>

      {/* Role Selection */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Your role:</div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            width: "100%",
            padding: "5px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            fontSize: "0.9rem",
          }}
        >
          <option value="Tenant">Tenant</option>
          <option value="Landlord">Landlord</option>
          <option value="Employee">Employee</option>
          <option value="Freelancer">Freelancer</option>
          <option value="Neutral">Something Else</option>
        </select>
      </div>

      {/* Highlighted text */}
      <div
        style={{
          fontStyle: "italic",
          background: "#f7f7fa",
          padding: "6px 8px",
          borderRadius: "6px",
          marginBottom: 10,
          fontSize: "0.9rem",
        }}
      >
        "{popup.text}"
      </div>

      {/* Buttons stacked */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: 10,
        }}
      >
        <button
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "7px",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
          onClick={() => onExplain(role)}
        >
          Explain This
        </button>

        <button
          style={{
            background: "#fff3f3",
            color: "#d32f2f",
            border: "1px solid #d32f2f",
            borderRadius: "6px",
            padding: "7px",
            fontWeight: 500,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
          onClick={onFlag}
        >
          🚩 Risk Analysis
        </button>

        <button
          style={{
            background: "#f7f7fa",
            color: "#222",
            border: "1px solid #e0e0e0",
            borderRadius: "6px",
            padding: "7px",
            fontWeight: 500,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
          onClick={onDiscuss}
        >
          Discuss
        </button>
      </div>

      {/* AI response box */}
      <div
        style={{
          marginTop: 6,
          background: "#fffbea",
          borderRadius: 6,
          padding: "8px 10px",
          color: "#333",
          fontSize: "0.9rem",
          border: "1px solid #f3e08c",
          minHeight: 80,
          maxHeight: 160,
          overflowY: "auto",
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#9c6e00",
          }}
        >
          💡 AI Explanation
        </div>
        {loading ? (
          <div style={{ color: "#666", fontStyle: "italic" }}>Analyzing...</div>
        ) : aiResponse ? (
          aiResponse
        ) : (
          <div style={{ color: "#888", fontStyle: "italic" }}>No analysis yet.</div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          float: "right",
          background: "none",
          border: "none",
          color: "#888",
          fontSize: "1.2rem",
          marginTop: 6,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
};

export default AIPopup;


