import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../styles/SummarizerPage.css";
import { useFile } from "../context/FileContext";
import DocumentList from "../components/DocumentList";
import DocumentContent from "../components/DocumentContent";
import DocumentInsights from "../components/DocumentInsights";
import AIPopup from "../components/AIPopup";
import AISidebar from "../components/AISidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { exportSummary } from "../api";

const BACKEND_ENDPOINT = "http://localhost:8000/upload"; // <-- update to your actual endpoint

const SummarizerPage: React.FC = () => {
  const [docText, setDocText] = useState<string>("Document will be shown here...");
  const [fileHash, setFileHash] = useState<string>("");
  const location = useLocation();
  const [docChunks, setDocChunks] = useState<string[]>([]);
  useEffect(() => {
    if (location.state && location.state.data) {
      if (location.state.data.text) {
        setDocText(location.state.data.text);
      }
      if (location.state.data.chunks) {
        setDocChunks(location.state.data.chunks);
      }
    }
  }, [location.state]);
  const [popup, setPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [sidebar, setSidebar] = useState<{ open: boolean; text: string } | null>(null);
  const [chatInput, setChatInput] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addFile } = useFile();

  const handleAddDocClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setShowLoadingOverlay(true);
      setProgress(0);
      let percent = 0;
      const interval = setInterval(() => {
        percent += 10;
        setProgress(percent);
        if (percent >= 100) {
          clearInterval(interval);
        }
      }, 200);
      const file = e.target.files[0];
      // Send file to backend
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await fetch(BACKEND_ENDPOINT, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        setDocText(data.text || "No text found in document.");
        if (data.fileHash) setFileHash(data.fileHash);
        addFile(file);
      } catch (err) {
        setDocText("Error loading document.");
      }
      setShowLoadingOverlay(false);
    }
  };

  // Popup handlers
  const handleTextSelect = (selected: { text: string; x: number; y: number } | null) => setPopup(selected);
  const handleClosePopup = () => setPopup(null);
  const handleDiscuss = () => {
    if (popup) {
      setSidebar({ open: true, text: popup.text });
      setChatInput(popup.text);
      setPopup(null);
    }
  };

  const handleChatWithAI = () => {
    setSidebar({ open: true, text: "" });
    setChatInput("");
  };
  const handleCloseSidebar = () => setSidebar(null);

  // Word count logic
  const wordCount = docText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="summarizer-bg">
      <LoadingOverlay isProcessing={showLoadingOverlay} progress={progress} />
      <div className="summarizer-container">
        <div className="summarizer-header">
          <button className="chat-btn" onClick={handleChatWithAI}>Chat with AI</button>
  <button className="export-btn" onClick={() => exportSummary(docText)}>Export Summary</button>
        </div>
        <div className="summarizer-main">
          <DocumentList onAddDoc={handleAddDocClick} />
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="document-content">
            <DocumentContent docText={docText} onTextSelect={handleTextSelect} />
            <AIPopup
              popup={popup}
              onExplain={() => {}}
              onFlag={() => {}}
              onDiscuss={handleDiscuss}
              onClose={handleClosePopup}
            />
          </div>
          <DocumentInsights wordCount={wordCount} />
          <AISidebar
            open={!!(sidebar && sidebar.open)}
            text={sidebar?.text || ""}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onClose={handleCloseSidebar}
            docChunks={docChunks}
          />
        </div>
      </div>
    </div>
  );
};

export default SummarizerPage;