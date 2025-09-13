import "./index.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from './pages/LandingPage';
import LoginPage from "./pages/LoginPage"; 
import SignupPage from "./pages/SignupPage";
import UploadPage from "./pages/UploadPage";
import SummarizerPage from "./pages/SummarizerPage";
import { FileProvider } from "./context/FileContext";

function App() {
  return (
    <FileProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/summary" element={<SummarizerPage />} />
        </Routes>
      </Router>

    </FileProvider>
    
  );
}


export default App;
