import { Routes, Route, useLocation } from "react-router-dom";
import RegisterPage from "./pages/auth/register";
import LoginPage from "./pages/auth/login";
import HomePage from "./pages/Home";
import RoomsPage from "./pages/RoomsPage";
import { Navbar } from "./components/Bars/Navbar";
import RoomMain from "./pages/RoomMain";
import Main from "./pages/Main";
import Footer from "./components/Bars/Footer";
import { ToastContainer } from "react-toastify";
import Dashboard from "./pages/Dashboard";
import { Protector } from "./components/Auth/Protector";

function App() {
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/main" element={<Protector><Main /></Protector>} />
        <Route path="/dashboard" element={<Protector><Dashboard /></Protector>} />
        <Route path="/rooms" element={<Protector><RoomsPage /></Protector>} />
        <Route path="/room" element={<Protector><RoomMain /></Protector>} />
      </Routes>
      {isHomePage && <Footer />}
      <ToastContainer className='rounded' position="top-center" autoClose={2000} style={{ zIndex: 9999 }} />
    </>
  )
}

export default App
