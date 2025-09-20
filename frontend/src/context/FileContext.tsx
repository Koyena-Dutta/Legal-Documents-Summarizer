import React, { createContext, useContext, useState } from "react";

interface FileSummary {
  text: string;
  chunks: string[];
}

interface FileMeta {
  name: string;
  type: string;
  size: number;
  fileHash: string;
  summary?: FileSummary;
}

interface FileContextType {
  selectedFiles: FileMeta[];
  addFile: (file: FileMeta) => void;
  removeFile: (fileHash: string) => void;
  clearFiles: () => void;
}

const FileContext = createContext<FileContextType>({
  selectedFiles: [],
  addFile: () => {},
  removeFile: () => {},
  clearFiles: () => {},
});

export const useFile = () => useContext(FileContext);

export const FileProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedFiles, setSelectedFiles] = useState<FileMeta[]>([]);

  const addFile = (file: FileMeta) => {
    console.log("FileContext: Adding file:", file.name);
    
    // Check if file already exists (prevent duplicates)
    const exists = selectedFiles.some(f => f.fileHash === file.fileHash);
    if (exists) {
      console.log("FileContext: File already exists, skipping");
      return;
    }
    
    // Add the new file to the array
    setSelectedFiles(prev => {
      const newFiles = [...prev, file];
      console.log("FileContext: New files array:", newFiles.map(f => f.name));
      return newFiles;
    });
  };

  const removeFile = (fileHash: string) => {
    setSelectedFiles(prev => prev.filter(f => f.fileHash !== fileHash));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
  };

  return (
    <FileContext.Provider value={{ selectedFiles, addFile, removeFile, clearFiles }}>
      {children}
    </FileContext.Provider>
  );
};