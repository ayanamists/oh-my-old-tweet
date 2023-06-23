import { TweetCardColors, TweetCardTheme } from 'themes';
import { getRGB, rgba } from 'utils/colors';

const useGradientBackground = (
  gradientBackground: boolean | undefined,
  colors: TweetCardColors | undefined,
  theme: TweetCardTheme,
) => {
  if (gradientBackground) {
    const backgroundColor = colors?.background || theme.background;
    const rgb = getRGB(backgroundColor);
    if (rgb) {
      return {
        background: `linear-gradient(96.27deg, ${rgba(rgb, 1)} 15.49%, ${rgba(rgb, 0.78)} 78.18%, ${rgba(rgb, 0.58)} 100%)`,
        backdropFilter: 'blur(4px)',
      };
    }
  }

  return {};
};

export default useGradientBackground;
