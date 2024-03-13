"use client"
import { Routes, Route, HashRouter } from 'react-router-dom';
import MainPage from './MainPage';
import StatusPage from './StatusPage';
import UserPage from './UserPage';

export default function App() {
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