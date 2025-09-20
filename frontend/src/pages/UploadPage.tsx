import React, { useState } from "react";
import "../styles/UploadPage.css";
import { useFile } from "../context/FileContext";
import { useNavigate } from "react-router-dom";
import { fetchSummaryStatus } from "../api"; // 👈 import

const UploadPage = () => {
  const { addFile } = useFile();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  // Poll backend until summary is ready
  const pollSummaryStatus = async (fileHash: string) => {
    let attempts = 0;
    while (attempts < 15) {
      const status = await fetchSummaryStatus([fileHash]);
      if (status[fileHash]) {
        console.log("✅ Summary is ready!");
        return true;
      }
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;
    }
    return false;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);

      setIsProcessing(true);
      setProgress(20);

      try {
        const response = await fetch("http://localhost:8000/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");

        const data = await response.json();
        console.log("Backend response:", data);

        const fileHash = data?.file_hash;
        if (!fileHash) throw new Error("No file_hash returned from backend");

        setProgress(60);

        // 🔹 Poll for summary readiness
        const ready = await pollSummaryStatus(fileHash);
        setProgress(ready ? 100 : 90);

        // ✅ Push metadata + summary into context (not raw File)
        addFile({
          name: file.name,
          type: file.type,
          size: file.size,
          fileHash: fileHash,
          summary: {
            text: data.text,
            chunks: data.chunks,
          },
        });

        // small delay for smooth animation
        setTimeout(() => {
          setIsProcessing(false);
          navigate("/summary", {
            state: {
              data: {
                text: data.text,
                chunks: data.chunks,
                fileHash: fileHash,
                name: file.name
              }
            }
          });
        }, 1000);
      } catch (err) {
        console.error("Error uploading file:", err);
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="upload-page-bg">
      <div className="upload-page-container">
        <h1 className="text-4xl font-extrabold text-purple-700">
          Legal <span className="text-gray-900">Summariser</span>
        </h1>
        <h2 className="upload-title">Upload Your Document</h2>

        {/* Upload Box */}
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="dropzone-file"
            className="flex flex-col items-center justify-center w-full h-64 border-2 border-purple-400 border-dashed rounded-lg cursor-pointer bg-white hover:bg-purple-50"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-12 h-12 mb-4 text-purple-400"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 16"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-400">
                PDF, DOCX, TXT (max size 5MB)
              </p>
            </div>
            <input
              id="dropzone-file"
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Gap */}
        <div style={{ height: "24px" }}></div>

        

        {/* Progress UI */}
        {isProcessing && (
          <div className="processing-box">
            <div
              className="progress-bar-bg"
              style={{
                width: "100%",
                height: "8px",
                background: "#e0e0e0",
                borderRadius: "4px",
                margin: "16px 0",
              }}
            >
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "#4b2178",
                  borderRadius: "4px",
                  transition: "width 0.2s",
                }}
              ></div>
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#4b2178",
                fontSize: "0.95rem",
                marginBottom: "8px",
              }}
            >
              {`Analyzing document structure... (${progress}%)`}
            </div>
          </div>
        )}

        <div className="actions-row">
          <select className="analyze-dropdown">
            <option>Analyze Content</option>
          </select>
          <a href="#" className="show-original-link">
            Show original text
          </a>
        </div>
      </div>
      <div className="side-illustration"></div>
    </div>
  );
};

export default UploadPage;
