import React from "react";
import { useFile } from "../context/FileContext";
import "../styles/SummarizerPage.css";
import "../styles/DocumentList.css";

interface DocumentListProps {
  onAddDoc: () => void;
  selectedDocIndex?: number;
  onSelectDoc?: (index: number) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
  onAddDoc, 
  selectedDocIndex = 0, 
  onSelectDoc 
}) => {
  const { selectedFiles } = useFile();

  return (
    <div className="documents-panel">
      {/* Documents container box */}
      <div className="documents-container">
        <div className="documents-title">Documents</div>
        <div className="document-list">
          {selectedFiles.length > 0 ? (
            selectedFiles.map((file, idx) => (
              <div
                key={`${file.fileHash}-${idx}`} // Use fileHash for stable keys
                className={`document-item ${selectedDocIndex === idx ? 'selected' : ''}`}
                onClick={() => onSelectDoc?.(idx)}
              >
                <div className="document-info">
                  <div className="document-name">{file.name}</div>
                  <div className="document-size">
                    {file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'Unknown size'}
                  </div>
                </div>
                {/* Status indicator */}
                <div className="document-status"></div>
              </div>
            ))
          ) : (
            <div className="document-item no-selection">
              No file selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentList;