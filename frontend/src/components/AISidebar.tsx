import React from "react";
import "../styles/SummarizerPage.css";
interface AISidebarProps {
  open: boolean;
  text: string;
  chatInput: string;
  setChatInput: (val: string) => void;
  onClose: () => void;
  docChunks?: string[];
}

const AISidebar: React.FC<AISidebarProps> = ({ open, text, chatInput, setChatInput, onClose, docChunks }) => {
  const [aiResponse, setAIResponse] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);
  const [messages, setMessages] = React.useState<Array<{ role: "user" | "ai" | "thinking", content: string }>>([]);
  if (!open) return null;
  // Use docChunks from props directly
  const handleSendMessage = async () => {
    if (!chatInput || !Array.isArray(docChunks) || docChunks.length === 0) return;
    setMessages(prev => [...prev, { role: "user", content: chatInput }, { role: "thinking", content: "Thinking..." }]);
    setChatInput(""); // Clear input immediately after sending
    setLoading(true);
    setAIResponse("");
    try {
      const response = await fetch("http://localhost:8000/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: chatInput, chunks: docChunks }),
      });
      const data = await response.json();
      setMessages(prev => {
        // Remove last 'thinking...' and add AI response
        const filtered = prev.filter((msg, idx) => !(msg.role === "thinking" && idx === prev.length - 1));
        return [...filtered, { role: "ai", content: data.answer || "No answer returned." }];
      });
      setAIResponse(data.answer || "No answer returned.");
    } catch (err) {
      setMessages(prev => {
        const filtered = prev.filter((msg, idx) => !(msg.role === "thinking" && idx === prev.length - 1));
        return [...filtered, { role: "ai", content: "Error connecting to AI backend." }];
      });
      setAIResponse("Error connecting to AI backend.");
    }
    setLoading(false);
  };
  return (
    <div className="ai-sidebar" style={{ position: "fixed", right: 0, top: 0, height: "100vh", width: "420px", background: "#f3eaff", boxShadow: "-2px 0 16px rgba(0,0,0,0.10)", zIndex: 2000, padding: "32px 32px 32px 24px", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: "0 0 auto" }}>
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
      </div>
      <div style={{ flex: "1 1 auto", overflowY: "auto", marginBottom: 18 }}>
        {messages.length > 0 && (
          <div style={{ marginTop: "16px", maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#e3d7f7" : msg.role === "ai" ? "#fff" : "#f7f7fa",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#222",
                fontSize: "1rem",
                border: "1px solid #e0e0e0",
                minWidth: "80px",
                maxWidth: "90%"
              }}>
                {msg.role === "ai" && <strong>AI:</strong>} {msg.content}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: "0 0 auto", marginBottom: 0 }}>
        <input
          type="text"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !loading) {
              handleSendMessage();
            }
          }}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "1rem", marginBottom: "10px", backgroundColor: "#fff" }}
          placeholder="Type your question..."
        />
        <button style={{ width: "100%", background: "#2563eb", color: "#fff", borderRadius: "8px", padding: "10px 0", fontWeight: 600, fontSize: "1rem", border: "none" }} onClick={handleSendMessage} disabled={loading || !chatInput}>{loading ? "Sending..." : "Send Message"}</button>
      </div>
    </div>
  );
};

export default AISidebar;
