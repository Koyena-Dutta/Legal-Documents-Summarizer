import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between px-12 py-16">
      {/* Left Text Section */}
      <div className="flex-1 flex flex-col items-start justify-center text-left pl-24 relative">
        <h2 className="text-lg md:text-5xl font-bold text-gray-900 leading-tight ">
          Understand <span className="text-purple-600">Your</span> <br />
          <span className="text-purple-900">Legal Documents</span>
          <br /> in Simple Language
        </h2>
        <p className="mt-6 text-gray-700 max-w-md font-semibold">
          Transform complex legal jargon into clear, actionable insights. Upload
          your legal documents and get instant summaries with key dates,
          financial terms, and potential red flags.
        </p>

        {/* Buttons */}
        <div className="mt-8 flex space-x-4">
          <Link
            to="/login"
            className="px-6 py-2 bg-purple-600 text-white rounded-full shadow hover:bg-purple-700 transition"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="px-6 py-2 border border-gray-400 hover:text-white text-gray-700 rounded-full hover:bg-purple-700 transition"
          >
            Sign Up
          </Link>
        </div>
      </div>

      {/* Right Ellipses */}
      <div className="relative md:w-1/2 flex justify-center mt-10 md:mt-0">
        {/* Add Ellipses images here later */}
      </div>
    </div>
  );
};

export default Hero;

