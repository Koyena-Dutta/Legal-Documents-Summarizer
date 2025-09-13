import React, { useState } from "react";
import "../styles/UploadPage.css";
import { useFile } from "../context/FileContext";
import { useNavigate } from "react-router-dom";

const UploadPage = () => {
  const { addFile } = useFile();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFile(e.target.files[0]);
      setIsProcessing(true);
      setProgress(0);
      // Simulate processing progress
      let percent = 0;
      const interval = setInterval(() => {
        percent += 10;
        setProgress(percent);
        if (percent >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsProcessing(false);
            navigate("/summary");
          }, 1000);
        }
      }, 200);
    }
  };

  return (
    <div className="upload-page-bg">
      <div className="upload-page-container">
        <h1 className="text-4xl font-extrabold text-purple-700">
        Legal <span className="text-gray-900">Summariser</span>
      </h1>
        <h2 className="upload-title">Upload Your Document</h2>
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
                <span className="font-semibold">Click to upload</span> or drag and
                drop
              </p>
              <p className="text-xs text-gray-400">
                SVG, PNG, JPG or GIF (MAX. 800x400px)
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
        {/* Add gap between upload box and textarea */}
        <div style={{ height: '24px' }}></div>
        {/* Replace static text area box with editable textarea */}
        <textarea
          className="text-area-box"
          placeholder="Or Click here to add or paste text"
          rows={5}
          style={{ width: '350px', resize: 'vertical', borderRadius: '16px', padding: '12px', fontSize: '1rem', border: '1px solid #eaeaea', marginBottom: '18px', color: '#4b2178', background: '#eaeaea' }}
        />
        {isProcessing && (
          <div className="processing-box">
            <div className="progress-bar-bg" style={{ width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', margin: '16px 0' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: '#4b2178',
                  borderRadius: '4px',
                  transition: 'width 0.2s',
                }}
              ></div>
            </div>
            <div style={{ textAlign: 'center', color: '#4b2178', fontSize: '0.95rem', marginBottom: '8px' }}>
              {`Analyzing document structure with Document AI... (${progress}%)`}
            </div>
            <button className="processing-btn" disabled style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#888', color: '#fff', fontWeight: 'bold', fontSize: '1rem', border: 'none', opacity: 0.8 }}>
              Processing...
            </button>
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
