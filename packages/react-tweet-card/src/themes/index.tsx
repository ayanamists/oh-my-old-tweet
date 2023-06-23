import light from './light';
import dark from './dark';
import dim from './dim';

export type TweetCardTheme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
};

export type TweetCardColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
};

export type ThemeOption = 'light' | 'dark' | 'dim';

export default { light, dark, dim };
