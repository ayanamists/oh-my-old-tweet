import React, { useRef, useMemo, HTMLAttributes } from 'react';
import useTwitterLogo from 'hooks/useTwitterLogo';
import useFontSize from 'hooks/useFontSize';
import classNameUtil from 'utils/className';
import './Container.css';
import getCSSVariables from 'utils/getCSSVariables';
import themes from 'themes';
import globalClassName from 'utils/globalClassName';
import useGradientBackground from 'hooks/useGradientBackground';
import useBlurredBackground from 'hooks/useBlurredBackground';
import useTheme from 'hooks/useTheme';
import { TweetCardProps } from 'index';
import css from './Container.module.css';

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: any;
  className?: string;
} & Pick<
    TweetCardProps,
    | 'theme'
    | 'colors'
    | 'gradientBackground'
    | 'blurredBackground'
    | 'fitInsideContainer'
  >;

const Container = ({
  children,
  className,
  colors = {},
  gradientBackground,
  blurredBackground,
  fitInsideContainer = false,
  ...rest
}: ContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const twitterLogo = useTwitterLogo(containerRef);
  useFontSize(fitInsideContainer, containerRef);

  const theme = useTheme(rest.theme);

  const gradientStyle = useMemo(
    () => useGradientBackground(gradientBackground, colors, themes[theme]),
    [gradientBackground, theme, colors.background]
  );

  const blurredStyle = useMemo(
    () => useBlurredBackground(blurredBackground, colors, themes[theme]),
    [blurredBackground, theme, colors.background]
  );

  return (
    <div
      ref={containerRef}
      {...classNameUtil(
        globalClassName('container'),
        fitInsideContainer && css.fitInsideContainer,
        className,
        css.container,
        twitterLogo
      )}
      {...rest}
      style={{
        ...getCSSVariables(colors, themes[theme]),
        ...gradientStyle,
        ...blurredStyle,
        ...rest.style,
      }}
    >
      {children}
    </div>
  );
};

export default Container;
