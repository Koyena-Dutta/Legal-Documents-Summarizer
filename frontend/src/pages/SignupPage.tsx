import bgImage from "../assets/Warning Icons on Document Display 1.png"; // replace with actual file name
import { Link } from "react-router-dom";

const SignupPage = () => {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(0,0,50,0.5), rgba(0,0,50,0.5)), url(${bgImage})`, backgroundBlendMode: 'overlay' }}
    >
      
      {/* Login Card */}
      <div className="relative bg-purple-200 bg-opacity-90 rounded-3xl shadow-xl p-10 w-full max-w-md">
        {/* Logo */}
        <h1 className="text-2xl font-bold text-center mb-8">
          <span className="text-purple-600">Legal</span>{" "}
          <span className="text-black">Summariser</span>
        </h1>

        {/* Form */}
        <form className="space-y-6">
          {/* Email */}
          <div>
            <label className="block font-semibold text-gray-800 mb-1">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email address"
              className="w-full px-4 py-2 rounded-md border bg-white border-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block font-semibold text-gray-800 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full px-4 py-2 rounded-md bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Link
              to="/forgot-password"
              className="text-sm text-blue-600 hover:underline mt-2 block"
            >
              Forgot password
            </Link>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full py-3 bg-purple-700 text-white rounded-full font-semibold shadow hover:bg-purple-800 transition"
          >
            Sign up
          </button>
        </form>

        {/* Sign Up link */}
        <p className="text-center mt-6 text-gray-800 font-medium">
          Already have an account?{" "}
          
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;

