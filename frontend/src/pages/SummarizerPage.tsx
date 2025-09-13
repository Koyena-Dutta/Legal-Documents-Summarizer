import React, { useState, useRef } from "react";
import "../styles/SummarizerPage.css";
import { useFile } from "../context/FileContext";
import DocumentList from "../components/DocumentList";
import DocumentContent from "../components/DocumentContent";
import DocumentInsights from "../components/DocumentInsights";
import AIPopup from "../components/AIPopup";
import AISidebar from "../components/AISidebar";
import LoadingOverlay from "../components/LoadingOverlay";

const docText = `Document will be shown here...`;

const SummarizerPage = () => {
  const [popup, setPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [sidebar, setSidebar] = useState<{ open: boolean; text: string } | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);

  // Add doc upload logic
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addFile, selectedFiles } = useFile();

  const handleAddDocClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessing(true);
      setShowLoadingOverlay(true);
      setProgress(0);
      let percent = 0;
      const interval = setInterval(() => {
        percent += 10;
        setProgress(percent);
        if (percent >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsProcessing(false);
            setShowLoadingOverlay(false);
            if (e.target.files && e.target.files[0]) {
              addFile(e.target.files[0]);
            }
          }, 1000);
        }
      }, 200);
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
  const handleCloseSidebar = () => setSidebar(null);

  // Word count logic (for demo, use docText)
  const wordCount = docText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="summarizer-bg">
      <LoadingOverlay isProcessing={showLoadingOverlay} progress={progress} />
      <div className="summarizer-container">
        <div className="summarizer-header">
          <button className="chat-btn">Chat with AI</button>
          <button className="export-btn">Export Summary</button>
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
          />
        </div>
      </div>
    </div>
  );
};

export default SummarizerPage;