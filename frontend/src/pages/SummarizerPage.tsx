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

const BACKEND_ENDPOINT = "http://localhost:8000/upload";

const SummarizerPage: React.FC = () => {
  const { addFile, selectedFiles } = useFile();

  const [docText, setDocText] = useState<string>("Document will be shown here...");
  const [docChunks, setDocChunks] = useState<string[]>([]);
  const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);
  const [hasLoadedFromNavigation, setHasLoadedFromNavigation] = useState(false);
  const location = useLocation();

  // 📌 Load from navigation state ONLY ONCE
  useEffect(() => {
    if (location.state?.data && !hasLoadedFromNavigation) {
      console.log("Loading from navigation state (one time only):", location.state.data);
      const { text, chunks, fileHash } = location.state.data;
      if (text) setDocText(text);
      if (chunks) setDocChunks(chunks);

      // Push into FileContext so sidebar sees it
      const newFile = {
        name: location.state?.data?.name || fileHash || "Uploaded Document",
        summary: { text, chunks },
        type: "uploaded",
        size: text.length,
        fileHash: fileHash || ""
      };
      console.log("Adding file from navigation (one time):", newFile);
      addFile(newFile);
      setHasLoadedFromNavigation(true); // Prevent re-running
    }
  }, []); // Empty dependency array - only run once

  const [chatInput, setChatInput] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  // Popup & AI state
  const [popup, setPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [aiResponse, setAIResponse] = useState("");

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docMessages, setDocMessages] = useState<
    Array<{ role: "user" | "ai" | "thinking"; content: string }>
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual file upload inside SummarizerPage
  const handleAddDocClick = () => {
    console.log("Add document button clicked");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input changed");
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log("Selected file:", file.name, file.size, file.type);
      
      setShowLoadingOverlay(true);
      setProgress(0);

      // Fake progress
      let percent = 0;
      const interval = setInterval(() => {
        percent += 10;
        setProgress(percent);
        if (percent >= 100) clearInterval(interval);
      }, 200);

      try {
        console.log("Uploading to backend...");
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(BACKEND_ENDPOINT, {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Upload response:", data);

        const text = data.text || data.data?.text || "No text found in document.";
        const chunks = data.chunks || [];
        const fileHash = data.file_hash || `hash_${Date.now()}`;
        
        console.log("Extracted data:", { text: text.substring(0, 100) + "...", chunks: chunks.length, fileHash });
        
        setDocText(text);
        setDocChunks(chunks);

        // Store into context
        const newFile = {
          name: file.name,
          type: file.type,
          size: file.size,
          fileHash: fileHash,
          summary: { text, chunks },
        };
        
        console.log("Adding file to context:", newFile);
        addFile(newFile);

        // Set the newly added file as selected
        setSelectedDocIndex(selectedFiles.length); // This will be the index of the new file
        
      } catch (err) {
        console.error("Upload error:", err);
        setDocText("Error loading document.");
      }
      
      setShowLoadingOverlay(false);
      
      // Clear the file input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle document selection from the list
  const handleSelectDoc = (index: number) => {
    console.log("Selecting document at index:", index);
    setSelectedDocIndex(index);
    if (selectedFiles[index]?.summary) {
      const selectedFile = selectedFiles[index];
      console.log("Loading document:", selectedFile.name);
      setDocText(selectedFiles[index]?.summary?.text || "No content available");
      setDocChunks(selectedFiles[index]?.summary?.chunks || []);
    }
  };

  // ---- AI Handlers ----
  const handleExplain = async (role: string) => {
    setAIResponse("Thinking...");
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText ,role}),
      });
      const data = await response.json();
      setAIResponse(data.explanation || "No explanation returned.");
    } catch {
      setAIResponse("⚠️ Error connecting to AI backend.");
    }
    setLoading(false);
  };

  const handleDiscuss = () => {
    setAIResponse("Copied to Document Chat!");
    setChatInput(selectedText);
    setSidebarOpen(true);
    setShowAIPopup(false);
  };

  const handleRiskAnalysis = async () => {
    setAIResponse("Analyzing risk...");
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/risk/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      });
      const data = await response.json();
      setAIResponse(data.analysis || "No risk analysis returned.");
    } catch {
      setAIResponse("⚠️ Error connecting to risk analysis backend.");
    }
    setLoading(false);
  };

  const handleOpenAIPopup = (text: string) => {
  const selection = window.getSelection();
  if (!selection || selection.toString().trim() === "") return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const container = document.querySelector(".document-content") as HTMLElement;
  if (!container) return;

  const containerRect = container.getBoundingClientRect();

  // Calculate coordinates relative to the container
  const x = rect.left - containerRect.left + container.scrollLeft;
  const y = rect.bottom - containerRect.top + container.scrollTop + 5; // +5 for a small offset

  setSelectedText(text);
  setPopup({ text, x, y });
  setShowAIPopup(true);
  setAIResponse("");
};


  const wordCount = docText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="summarizer-bg">
      <LoadingOverlay isProcessing={showLoadingOverlay} progress={progress} />
      
      <div className="summarizer-container">
        {/* Updated Header with Add Document */}
        <div className="summarizer-header">
          <div className="header-buttons">
            <button className="chat-btn" onClick={() => setSidebarOpen(true)}>
              Chat with AI
            </button>
            <button className="export-btn" onClick={() => exportSummary(docText)}>
              Export Summary
            </button>
            <button className="add-document-btn" onClick={handleAddDocClick}>
              Add Document
            </button>
          </div>
        </div>

        <div className="summarizer-main">
          {/* Left: Document List - NO KEY PROP */}
          <DocumentList 
            onAddDoc={handleAddDocClick}
            selectedDocIndex={selectedDocIndex}
            onSelectDoc={handleSelectDoc}
          />

          {/* Hidden file input for document upload */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt"
          />

          {/* Center: Document Viewer */}
          <div className="document-content">
            <DocumentContent
              docText={docText}
              onTextSelect={(sel) => sel && handleOpenAIPopup(sel.text)}
            />

            {showAIPopup && (
              <AIPopup
                popup={popup}
                onExplain={handleExplain}
                onFlag={handleRiskAnalysis}
                onDiscuss={handleDiscuss}
                onClose={() => setShowAIPopup(false)}
                aiResponse={aiResponse}
                loading={loading}
              />
            )}
          </div>

          
          
          {/* Right: Insights */}
          <DocumentInsights
            wordCount={wordCount}
            redFlags={""}
            textChunks={docChunks.join("\n")}
            fileHashes={selectedFiles.map((f: any) => f.fileHash || "")}
            selectedDocIndex={selectedDocIndex}
            selectedFiles={selectedFiles}
          />

          {/* Sidebar */}
          {sidebarOpen && (
            <AISidebar
              open={sidebarOpen}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onClose={() => setSidebarOpen(false)}
              docChunks={docChunks}
              docMessages={docMessages}
              setDocMessages={setDocMessages}
              fileHashes={selectedFiles.map((f: any) => f.fileHash || "")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SummarizerPage;