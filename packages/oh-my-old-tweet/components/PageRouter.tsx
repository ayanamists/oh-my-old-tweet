"use client"
import { Routes, Route, HashRouter } from 'react-router-dom';
import MainPage from './MainPage';
import StatusPage from './StatusPage';
import UserPage from './UserPage';
import { ConfigContext, ConfigContextProvider } from 'src/context/ConfigContext';
import { FilterContextProvider } from 'src/context/FilterContext';
import { useEffect, useContext } from 'react';
import { getDefaultConfig } from 'src/corsUrl';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';

export default function AppWrapper() {
  return (
    <ConfigContextProvider>
      <App />
    </ConfigContextProvider>
  );
}

function App() {
  const { config, setConfig } = useContext(ConfigContext);

  useEffect(() => {
    const cfg = getDefaultConfig();
    setConfig(cfg);
  }, []);

  return config == null ? null : (
    <FilterContextProvider>
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/:user" element={<UserPage />} />
            <Route path='/status/:user/:timestamp/:id' element={<StatusPage />} />
          </Routes>
        </HashRouter>
      </LocalizationProvider>
    </FilterContextProvider>
  );
}
