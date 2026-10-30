import { useCallback, useRef, useState } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Why from "./components/Why";
import Purpose from "./components/Purpose";
import Impact from "./components/Impact";
import Journey from "./components/Journey";
import Tiers from "./components/Tiers";
import Join from "./components/Join";
import Faq from "./components/Faq";
import Footer, { Closing } from "./components/Footer";

export default function App() {
  const formRef = useRef(null);
  const [amountChoice, setAmountChoice] = useState("");
  const [selectedPurposes, setSelectedPurposes] = useState([]);

  const focusForm = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById("join")?.scrollIntoView({ behavior: "smooth" });
      const form = formRef.current;
      if (!form) return;
      form.classList.remove("flash");
      void form.offsetWidth;
      form.classList.add("flash");
    });
  }, []);

  const chooseTier = (amount) => {
    setAmountChoice(amount);
    focusForm();
  };

  const choosePurpose = (id) => {
    setSelectedPurposes((list) => (list.includes(id) ? list : [...list, id]));
    focusForm();
  };

  const togglePurpose = (id) =>
    setSelectedPurposes((list) => (list.includes(id) ? list.filter((p) => p !== id) : [...list, id]));

  const resetForm = () => {
    setAmountChoice("");
    setSelectedPurposes([]);
    focusForm();
  };

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Why />
        <Purpose onChoose={choosePurpose} />
        <Impact />
        <Journey />
        <Tiers onChoose={chooseTier} />
        <Join
          formRef={formRef}
          amountChoice={amountChoice}
          onAmountChoice={setAmountChoice}
          selectedPurposes={selectedPurposes}
          onTogglePurpose={togglePurpose}
          onReset={resetForm}
        />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </>
  );
}
