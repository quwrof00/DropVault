import {Routes, Route} from "react-router-dom";
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

function App() {

  return (
    <>
    <Navbar/>
    <Routes>
      <Route path="/" element={<HomePage/>}/>
      <Route path="/main" element={<Main/>}/>
      <Route path="/dashboard" element={<Dashboard/>}/>
    <Route path="/register" element={<RegisterPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/rooms" element={<RoomsPage />}/>
    <Route path="/room" element={<RoomMain />} />
    </Routes> 
    <Footer/>
    <ToastContainer className='rounded' position="top-center" autoClose={2000} />
    </>
  )
}

export default App
