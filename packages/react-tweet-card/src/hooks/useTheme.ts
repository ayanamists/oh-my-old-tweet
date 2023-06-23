import { ThemeOption } from 'themes';
import usePrefersDarkMode from './usePrefersDarkMode';

const useTheme = (theme: ThemeOption | undefined) => {
  const prefersDarkMode = usePrefersDarkMode();

  if (theme) {
    return theme;
  }

  return prefersDarkMode ? 'dark' : 'light';
};

export default useTheme;
