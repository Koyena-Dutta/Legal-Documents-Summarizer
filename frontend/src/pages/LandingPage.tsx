import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Ellipses from "../components/Ellipses";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-100 to-purple-200 flex flex-col relative">
      <Navbar />
      <Hero />
      <Ellipses />
    </div>
  );
};

export default LandingPage;

