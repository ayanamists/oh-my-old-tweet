import './App.css';
import MainPage from './pages/MainPage';
import UserPage from './pages/UserPage';
import StatusPage from './pages/StatusPage';
import { HashRouter, Routes, Route } from 'react-router-dom';


function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/:user" element={<UserPage />} />
        <Route path='/status/:user/:timestamp/:id' element={<StatusPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
