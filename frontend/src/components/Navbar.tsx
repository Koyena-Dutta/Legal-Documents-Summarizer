const Navbar = () => {
  return (
    <nav className="flex justify-between items-center px-8 py-4">
      <h1 className="text-4xl font-extrabold text-purple-700">
        Legal <span className="text-gray-900">Summariser</span>
      </h1>

      {/* Center box with About / Features / Contact */}
      <div className="flex border border-purple-400 rounded-full px-4 py-1 space-x-6 font-bold">
        <a href="#about" className="px-4 py-2 rounded-full text-gray-1000 bg-purple-600 text-white">About</a>
        <a href="#features" className="px-4 py-2 rounded-full text-gray-1000 hover:bg-purple-600 hover:text-white">Features</a>
        <a href="#contact" className="px-4 py-2 rounded-full text-gray-1000 hover:bg-purple-600 hover:text-white">Contact</a>
      </div>

      <button className="font-bold ml-4 px-5 py-2 bg-purple-600 text-white rounded-full shadow hover:bg-purple-700 transition">
        Get Started
      </button>
    </nav>
  );
};

export default Navbar;
