import { createContext } from 'react';
import { CorsProxyConfig, getDefaultConfig } from '../corsUrl';

export const ConfigContext = createContext<CorsProxyConfig>(getDefaultConfig());
