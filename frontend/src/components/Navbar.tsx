import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/upload"); // navigate to the UploadPage route
  };

  return (
    <nav className="flex justify-between items-center px-8 py-4">
      <h1 className="text-4xl font-extrabold text-purple-700">
        Legal <span className="text-gray-900">Summariser</span>
      </h1>

      {/* Center box with About / Features / Contact */}
      <div className="flex border-0 border-purple-400 rounded-full px-4 py-1 space-x-6 font-bold">
        <a href="#about" className="px-4 py-2 rounded-full text-gray-1000 bg-purple-600 text-white">About</a>
        
      </div>

      <button
        onClick={handleGetStarted}
        className="font-bold ml-4 px-5 py-2 bg-purple-600 text-white rounded-full shadow hover:bg-purple-700 transition cursor-pointer"
      >
        Get Started
      </button>
    </nav>
  );
};

export default Navbar;

