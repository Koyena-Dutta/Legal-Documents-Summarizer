import React, { createContext, useContext, useState } from "react";
import "../styles/SummarizerPage.css";
// Define the correct type for context value
interface FileContextType {
  selectedFiles: File[];
  addFile: (file: File) => void;
}

const FileContext = createContext<FileContextType>({
  selectedFiles: [],
  addFile: () => {},
});

export const useFile = () => useContext(FileContext);

export const FileProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const addFile = (file: File) => {
    setSelectedFiles((prev) => [...prev, file]);
  };
  return (
    <FileContext.Provider value={{ selectedFiles, addFile }}>
      {children}
    </FileContext.Provider>
  );
};
