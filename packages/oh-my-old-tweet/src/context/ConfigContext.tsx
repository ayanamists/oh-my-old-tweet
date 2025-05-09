import { createContext } from 'react';
import { CorsProxyConfig, defaultConfig } from '../corsUrl';
import React from 'react';

export const ConfigContext = createContext<ConfigContextType>({
  config: defaultConfig,
  setConfig: () => {},
});

interface ConfigContextType {
  config: CorsProxyConfig | null;
  setConfig: (config: CorsProxyConfig) => void;
}

export const ConfigContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [currentConfig, setCurrentConfig] = React.useState<CorsProxyConfig | null>(null);
  return (
    <ConfigContext.Provider value={{ config: currentConfig, setConfig: setCurrentConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
