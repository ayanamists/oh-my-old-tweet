import React from 'react';
import useResizeObserver from 'use-resize-observer';

const useTwitterLogo = (ref: React.RefObject<HTMLDivElement>) => {
  const { width = 0, height = 0 } = useResizeObserver<HTMLDivElement>({
    ref,
    box: 'border-box',
  });

  return height > width && 'hideTwitterLogo';
};

export default useTwitterLogo;
