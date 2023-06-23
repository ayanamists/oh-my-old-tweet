import { TweetCardColors, TweetCardTheme } from 'themes';

const colorPrefix = '--tweet-card-';

const getCSSVariables = (colors: TweetCardColors, theme: TweetCardTheme) => ({
  ...(
    Object.keys(theme)
      .reduce(
        (a, b) => (
          { ...a, [`${colorPrefix}${b}`]: (theme as any)[b] }),
        {},
      )
  ),
  ...(
    Object.keys(colors)
      .filter((key) => Object.keys(theme).includes(key))
      .reduce(
        (a, b) => (
          { ...a, [`${colorPrefix}${b}`]: (colors as any)[b] }),
        {},
      )
  ),
});

export default getCSSVariables;
