/* eslint-disable no-plusplus, no-param-reassign */

import { useEffect, RefObject } from 'react';
import binarySearch from 'utils/binarySearch';
import useResizeObserver from 'use-resize-observer';

function isOverflowing(el: HTMLElement) {
  return el.clientWidth < el.scrollWidth
        || el.clientHeight < el.scrollHeight;
}

function canOverflow(el: HTMLElement) {
  if (isOverflowing(el)) {
    return true;
  }
  const initialFontSize = el.style.fontSize;
  el.style.fontSize = '100000px';
  const storedResult = isOverflowing(el);
  el.style.fontSize = initialFontSize;
  return storedResult;
}

function setFontSize(el: HTMLElement, fontSize: number) {
  el.style.fontSize = `${fontSize}px`;
}

function getFontSize(el: HTMLElement) {
  return parseFloat(window.getComputedStyle(el, null).getPropertyValue('font-size').replace('px', ''));
}

function findFontSizeBinary(el: HTMLElement) {
  return binarySearch(getFontSize(el), (fontSize: number) => {
    setFontSize(el, fontSize);
    return isOverflowing(el);
  });
}

function calculateAndApplyFontSize(el: HTMLElement | null | undefined) {
  if (el) {
    setFontSize(el, findFontSizeBinary(el));
  }
}

const useFontSize = (fitInsideContainer: boolean, ref: RefObject<HTMLDivElement>) => {
  const handleResize = () => {
    if (ref?.current && canOverflow(ref?.current)) {
      calculateAndApplyFontSize(ref?.current);
    }
  };

  useResizeObserver<HTMLDivElement>({
    ref: fitInsideContainer ? ref : undefined,
    box: 'border-box',
    onResize: fitInsideContainer ? handleResize : undefined,
  });

  useEffect(() => {
    setTimeout(handleResize, 100);
  }, [ref]);
};

export default useFontSize;
