import { useCallback, useRef, useState } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import ProgressTracker from "./components/ProgressTracker";
import Verse from "./components/Verse";
import Why from "./components/Why";
import Purpose from "./components/Purpose";
import Impact from "./components/Impact";
import Journey from "./components/Journey";
import Tiers from "./components/Tiers";
import Join from "./components/Join";
import Faq from "./components/Faq";
import Footer, { Closing } from "./components/Footer";
import StickyCta from "./components/StickyCta";
import useParallax from "./hooks/useParallax";

export default function App() {
  useParallax();
  const formRef = useRef(null);
  const [amountChoice, setAmountChoice] = useState("");
  const [sevaChoice, setSevaChoice] = useState("prachar");

  const focusForm = useCallback(() => {
    requestAnimationFrame(() => {
      (formRef.current ?? document.getElementById("join"))?.scrollIntoView({ behavior: "smooth" });
      const form = formRef.current;
      if (!form) return;
      form.classList.remove("flash");
      void form.offsetWidth;
      form.classList.add("flash");
    });
  }, []);

  const chooseSeva = (seva, amount) => {
    setSevaChoice(seva);
    setAmountChoice(amount);
    focusForm();
  };

  const resetForm = () => {
    setAmountChoice("");
    focusForm();
  };

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProgressTracker />
        <Verse />
        <Why />
        <Purpose onChoose={focusForm} />
        <Impact />
        <Journey />
        <Tiers onChoose={chooseSeva} />
        <Join
          formRef={formRef}
          amountChoice={amountChoice}
          onAmountChoice={setAmountChoice}
          sevaChoice={sevaChoice}
          onSevaChoice={setSevaChoice}
          onReset={resetForm}
        />
        <Faq />
        <Closing />
      </main>
      <Footer />
      <StickyCta />
    </>
  );
}
