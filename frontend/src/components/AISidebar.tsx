import React from "react";
import "../styles/SummarizerPage.css";
interface AISidebarProps {
  open: boolean;
  text: string;
  chatInput: string;
  setChatInput: (val: string) => void;
  onClose: () => void;
}

const AISidebar: React.FC<AISidebarProps> = ({ open, text, chatInput, setChatInput, onClose }) => {
  if (!open) return null;
  return (
    <div className="ai-sidebar" style={{ position: "fixed", right: 0, top: 0, height: "100vh", width: "420px", background: "#f3eaff", boxShadow: "-2px 0 16px rgba(0,0,0,0.10)", zIndex: 2000, padding: "32px 32px 32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>Ask About the Document</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
      </div>
      <div style={{ color: "#444", fontSize: "0.98rem", marginBottom: 16 }}>
        Chat with AI. Switch modes or mix in another document.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={{ background: "#222", color: "#fff", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "0.98rem", border: "none" }}>Document Chat</button>
        <button style={{ background: "#f7f7fa", color: "#222", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "0.98rem", border: "none" }}>Conversation Mode</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={{ background: "#e3d7f7", color: "#4b2178", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "0.98rem", border: "none" }}>+ Mix Doc</button>
        <button style={{ background: "#f7f7fa", color: "#222", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "0.98rem", border: "none" }}>New Chat</button>
      </div>
      <div style={{ marginBottom: 18 }}>
        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "1rem", marginBottom: "10px" }} />
        <button style={{ width: "100%", background: "#2563eb", color: "#fff", borderRadius: "8px", padding: "10px 0", fontWeight: 600, fontSize: "1rem", border: "none" }}>Send Message</button>
      </div>
    </div>
  );
};

export default AISidebar;
