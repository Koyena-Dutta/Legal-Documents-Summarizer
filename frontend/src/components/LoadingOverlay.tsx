import React from "react";
import "../styles/SummarizerPage.css";
interface LoadingOverlayProps {
  isProcessing: boolean;
  progress: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isProcessing, progress }) => {
  if (!isProcessing) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 4000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        padding: '32px 40px',
        minWidth: '340px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ width: '60%', height: '8px', background: '#e0e0e0', borderRadius: '4px', marginBottom: '18px' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#4b2178', borderRadius: '4px', transition: 'width 0.2s' }}></div>
        </div>
        <div style={{ textAlign: 'center', color: '#4b2178', fontSize: '1.1rem', marginBottom: '8px', width: '100%' }}>
          {`Processing... (${progress}%)`}
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
