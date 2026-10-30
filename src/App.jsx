import './App.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Expenses from './components/Expenses';
import Gallery from './components/Gallery';
import Donate from './components/Donate';
import Footer from './components/Footer';

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <Expenses />
      <Gallery />
      <Donate />
      <Footer />
    </>
  );
}

export default App;
