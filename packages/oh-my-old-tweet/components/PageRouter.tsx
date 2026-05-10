"use client"
import { Routes, Route, HashRouter } from 'react-router-dom';
import MainPage from './MainPage';
import SearchPage from './SearchPage';
import StatusPage from './StatusPage';
import UserPage from './UserPage';
import { ConfigContext, ConfigContextProvider } from 'src/context/ConfigContext';
import { FilterContextProvider } from 'src/context/FilterContext';
import { useEffect, useContext, useState } from 'react';
import { getDefaultConfig } from 'src/corsUrl';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Aligned with omot-edge's FRESH_MS (24h) — archive.org snapshots arrive days
// apart at most, so cdx data is safe to reuse across navigations within a
// session. Tweet snapshots (per-id) keep using the IDB cache layer.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 24 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export default function AppWrapper() {
  // useState (not module-level) so HMR / tests get fresh clients and so SSR
  // doesn't leak query cache across requests.
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigContextProvider>
        <App />
      </ConfigContextProvider>
    </QueryClientProvider>
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
            <Route path="/search" element={<SearchPage />} />
            <Route path="/:user" element={<UserPage />} />
            <Route path='/status/:user/:timestamp/:id' element={<StatusPage />} />
          </Routes>
        </HashRouter>
      </LocalizationProvider>
    </FilterContextProvider>
  );
}
