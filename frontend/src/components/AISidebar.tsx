import React, { useRef, useEffect } from "react";
import "../styles/SummarizerPage.css";
import { useFile } from "../context/FileContext";

interface AISidebarProps {
  open: boolean;
  chatInput: string;
  setChatInput: (val: string) => void;
  onClose: () => void;
  docChunks?: string[];
  docMessages: Array<{ role: "user" | "ai" | "thinking"; content: string }>;
  fileHashes?: string[]; // Add this to get file hashes for summaries
  setDocMessages: React.Dispatch<
    React.SetStateAction<Array<{ role: "user" | "ai" | "thinking"; content: string }>>
  >;
}

// Helper function to generate a simple hash from file content
const generateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
};

const AISidebar: React.FC<AISidebarProps> = ({
  open,
  chatInput,
  setChatInput,
  onClose,
  docChunks,
  docMessages,
  setDocMessages,
  fileHashes = [], // Default to empty array
}) => {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [convMessages, setConvMessages] = React.useState<
    Array<{ role: "user" | "ai" | "thinking"; content: string }>
  >([]);
  const [conversationMode, setConversationMode] = React.useState<boolean>(false);
  const [newChatActive, setNewChatActive] = React.useState<boolean>(false);
  
  // Summary-related state
  const [summaries, setSummaries] = React.useState<Record<string, string>>({});
  const [summaryStatus, setSummaryStatus] = React.useState<Record<string, boolean>>({});
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [debugInfo, setDebugInfo] = React.useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addFile, selectedFiles } = useFile();

  if (!open) return null;

  // Effect to fetch summaries when fileHashes change
  useEffect(() => {
    // Debug: Log what we're working with
    console.log("=== AISidebar Debug Info ===");
    console.log("fileHashes prop:", fileHashes);
    console.log("selectedFiles from context:", selectedFiles);
    console.log("selectedFiles hashes:", selectedFiles.map(f => f.fileHash));
    
    // Use fileHashes from prop, or fall back to selectedFiles
    const hashesToUse = fileHashes.length > 0 ? fileHashes : selectedFiles.map(f => f.fileHash);
    
    setDebugInfo(`Using hashes: ${JSON.stringify(hashesToUse)}`);
    
    if (!hashesToUse || hashesToUse.length === 0) {
      console.log("No file hashes to process");
      setSummaries({});
      setSummaryStatus({});
      setDebugInfo("No file hashes available");
      return;
    }

    let cancelled = false;

    const fetchSummaries = async () => {
      console.log("Fetching summaries for hashes:", hashesToUse);
      setSummaryLoading(true);
      setDebugInfo(`Fetching summaries for: ${hashesToUse.join(', ')}`);
      
      try {
        // Check summary status for all fileHashes
        console.log("Calling /summary/status with:", hashesToUse);
        const statusRes = await fetch("http://127.0.0.1:8000/summary/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hashesToUse),
        });
        
        console.log("Status response:", statusRes.status, statusRes.statusText);
        
        if (!statusRes.ok) {
          console.warn('Status check failed:', statusRes.status);
          setDebugInfo(`Status check failed: ${statusRes.status}`);
          return;
        }
        
        const statusJson = await statusRes.json();
        console.log("Status JSON:", statusJson);
        
        if (!cancelled) setSummaryStatus(statusJson.status || {});

        // Fetch summaries for files that are ready
        const summariesData: Record<string, string> = {};
        
        for (const fileHash of hashesToUse) {
          console.log(`Processing hash: ${fileHash}, status:`, statusJson.status?.[fileHash]);
          
          if (statusJson.status && statusJson.status[fileHash]) {
            try {
              console.log(`Fetching summary for ${fileHash}`);
              const sumRes = await fetch("http://127.0.0.1:8000/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileHash }),
              });
              
              console.log(`Summary response for ${fileHash}:`, sumRes.status);
              
              if (sumRes.ok) {
                const sumJson = await sumRes.json();
                console.log(`Summary data for ${fileHash}:`, sumJson);
                summariesData[fileHash] = sumJson.summary || "No summary available";
              } else {
                summariesData[fileHash] = "Summary not ready";
              }
            } catch (err) {
              console.error('Error fetching summary for', fileHash, err);
              summariesData[fileHash] = "Error loading summary";
            }
          } else {
            summariesData[fileHash] = "Processing...";
          }
        }

        console.log("Final summaries data:", summariesData);
        if (!cancelled) {
          setSummaries(summariesData);
          setDebugInfo(`Loaded ${Object.keys(summariesData).length} summaries`);
        }
      } catch (err) {
        console.error("Error fetching summaries:", err);
        setDebugInfo(`Error: ${err.message}`);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    fetchSummaries();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchSummaries, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fileHashes, selectedFiles]);

  const messages = conversationMode ? convMessages : docMessages;
  const setMessages = conversationMode ? setConvMessages : setDocMessages;

  const handleSendMessage = async () => {
    if (!chatInput) return;
    if (!conversationMode && (!Array.isArray(docChunks) || docChunks.length === 0)) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: chatInput },
      { role: "thinking", content: "Thinking..." },
    ]);
    const userMessage = chatInput;
    setChatInput("");
    setLoading(true);
    try {
      if (conversationMode) {
        const response = await fetch("http://localhost:8000/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              ...messages.filter((m) => m.role !== "thinking"),
              { role: "user", content: userMessage },
            ],
            chunks: docChunks,
            mode: "general",
          }),
        });
        const reader = response.body?.getReader();
        let aiMsg = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            aiMsg += new TextDecoder().decode(value);
            setMessages((prev) => {
              const filtered = prev.filter(
                (msg, idx) =>
                  !(msg.role === "thinking" && idx === prev.length - 1)
              );
              if (
                filtered.length > 0 &&
                filtered[filtered.length - 1].role === "ai"
              ) {
                return [
                  ...filtered.slice(0, -1),
                  { role: "ai", content: aiMsg },
                ];
              }
              return [...filtered, { role: "ai", content: aiMsg }];
            });
          }
        }
      } else {
        const response = await fetch("http://localhost:8000/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: userMessage, chunks: docChunks }),
        });
        const data: { answer?: string } = await response.json();
        setMessages((prev) => {
          const filtered = prev.filter(
            (msg, idx) =>
              !(msg.role === "thinking" && idx === prev.length - 1)
          );
          return [
            ...filtered,
            { role: "ai", content: data.answer || "No answer returned." },
          ];
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const filtered = prev.filter(
          (msg, idx) => !(msg.role === "thinking" && idx === prev.length - 1)
        );
        return [
          ...filtered,
          { role: "ai", content: "⚠️ Error connecting to AI backend." },
        ];
      });
    }
    setLoading(false);
  };

  // Handle file selection and convert File to FileMeta
  const handleFileSelect = async (file: File) => {
    try {
      const fileHash = await generateFileHash(file);
      const fileMeta = {
        name: file.name,
        type: file.type,
        size: file.size,
        fileHash: fileHash,
        // summary will be added later when available
      };
      console.log("Adding file with hash:", fileHash);
      addFile(fileMeta);
    } catch (error) {
      console.error('Error processing file:', error);
      // Fallback: use a simple hash based on file properties
      const fallbackHash = btoa(`${file.name}-${file.size}-${file.lastModified}`).substring(0, 16);
      const fileMeta = {
        name: file.name,
        type: file.type,
        size: file.size,
        fileHash: fallbackHash,
      };
      console.log("Adding file with fallback hash:", fallbackHash);
      addFile(fileMeta);
    }
  };

  // Determine which hashes to use for display
  const hashesToDisplay = fileHashes.length > 0 ? fileHashes : selectedFiles.map(f => f.fileHash);

  return (
    <div
      className="ai-sidebar"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: "420px",
        background: "#f3eaff",
        boxShadow: "-2px 0 16px rgba(0,0,0,0.10)",
        zIndex: 2000,
        padding: "32px 32px 32px 24px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: "0 0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>
            Ask About the Document
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ color: "#444", fontSize: "0.98rem", marginBottom: 16 }}>
          Chat with AI. Switch modes or mix in another document.
        </div>

        

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            style={{
              background: !conversationMode ? "#222" : "#f7f7fa",
              color: !conversationMode ? "#fff" : "#222",
              borderRadius: "6px",
              padding: "6px 14px",
              fontWeight: 600,
              fontSize: "0.98rem",
              border: "none",
            }}
            onClick={() => {
              setConversationMode(false);
              setChatInput("");
              setDocMessages([]);
            }}
          >
            Document Chat
          </button>
          <button
            style={{
              background: conversationMode ? "#222" : "#f7f7fa",
              color: conversationMode ? "#fff" : "#222",
              borderRadius: "6px",
              padding: "6px 14px",
              fontWeight: 600,
              fontSize: "0.98rem",
              border: "none",
            }}
            onClick={() => {
              setConversationMode(true);
              setChatInput("");
              setConvMessages([]);
            }}
          >
            Conversation Mode
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={async (e) => {
              if (e.target.files && e.target.files[0]) {
                await handleFileSelect(e.target.files[0]);
              }
            }}
          />
          <button
            style={{
              background: "#e3d7f7",
              color: "#4b2178",
              borderRadius: "6px",
              padding: "6px 14px",
              fontWeight: 600,
              fontSize: "0.98rem",
              border: "none",
            }}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            + Mix Doc
          </button>
          <button
            style={{
              background: newChatActive ? "#222" : "#f7f7fa",
              color: newChatActive ? "#fff" : "#222",
              borderRadius: "6px",
              padding: "6px 14px",
              fontWeight: 600,
              fontSize: "0.98rem",
              border: "none",
            }}
            onClick={() => setNewChatActive(true)}
          >
            New Chat
          </button>
        </div>
      </div>

      

      {/* Chat messages */}
      <div style={{ flex: "1 1 auto", overflowY: "auto", marginBottom: 18 }}>
        {messages.length > 0 && (
          <div
            style={{
              marginTop: "16px",
              maxHeight: "300px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  background:
                    msg.role === "user"
                      ? "#e3d7f7"
                      : msg.role === "ai"
                      ? "#fff"
                      : "#f7f7fa",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#222",
                  fontSize: "1rem",
                  border: "1px solid #e0e0e0",
                  minWidth: "80px",
                  maxWidth: "90%",
                }}
              >
                {msg.role === "ai" && <strong>AI:</strong>} {msg.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input + Send */}
      <div style={{ flex: "0 0 auto", marginBottom: 0 }}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              handleSendMessage();
            }
          }}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #e0e0e0",
            fontSize: "1rem",
            marginBottom: "10px",
            backgroundColor: "#fff",
          }}
          placeholder="Type your question..."
        />
        <button
          style={{
            width: "100%",
            background: "#2563eb",
            color: "#fff",
            borderRadius: "8px",
            padding: "10px 0",
            fontWeight: 600,
            fontSize: "1rem",
            border: "none",
            cursor: "pointer"
          }}
          onClick={handleSendMessage}
          disabled={loading || !chatInput}
        >
          {loading ? "Sending..." : "Send Message"}
        </button>
      </div>
    </div>
  );
};

export default AISidebar;

