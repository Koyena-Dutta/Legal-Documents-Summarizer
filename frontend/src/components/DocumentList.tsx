import React from "react";
import { useFile } from "../context/FileContext";
import "../styles/SummarizerPage.css";
interface DocumentListProps {
  onAddDoc: () => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ onAddDoc }) => {
  const { selectedFiles } = useFile();
  return (
    <div className="documents-panel">
      <div className="documents-title">Documents</div>
      <div className="document-list">
        {selectedFiles.length > 0 ? (
          selectedFiles.map((file, idx) => (
            <div key={file.name + idx} className="document-item selected">{file.name} <span className="doc-status">1 ch</span></div>
          ))
        ) : (
          <div className="document-item">No file selected</div>
        )}
        <button className="add-doc-btn" onClick={onAddDoc}>+ Add Doc</button>
      </div>
    </div>
  );
};

export default DocumentList;
