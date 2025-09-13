import ellipse1 from "../assets/Ellipse 2 (1).png";
import ellipse2 from "../assets/Ellipse 3.png";

const Ellipses = () => {
  return (
    <>
      <img
        src={ellipse1}
        alt="ellipse1"
        className="absolute right-65 top-40 w-60 opacity-70"
      />
      <img
        src={ellipse2}
        alt="ellipse2"
        className="absolute right-45 top-70 w-72 opacity-70"
      />
    </>
  );
};

export default Ellipses;
