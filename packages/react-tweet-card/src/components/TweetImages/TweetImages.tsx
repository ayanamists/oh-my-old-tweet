import React, { useRef } from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import { TweetCardProps } from 'index';
// import VideoButton from 'components/VideoButton';
import { Gallery } from 'react-photoswipe-gallery';
import 'photoswipe/style.css';
import css from './TweetImages.module.css';
import TweetImageItem from './TweetImageItem';

type TweetImagesProps = Pick<TweetCardProps, 'tweetImages'>;

const calcOneImageRatio = (width: number, height: number) => {
  const ratio = height / width;
  const upperBound = 1.3333;
  const lowerBound = 0.5625;
  if (ratio > upperBound) {
    return upperBound;
  }
  if (ratio < lowerBound) {
    return lowerBound;
  }
  return ratio;
};

const TweetImages = ({ tweetImages = [] }: TweetImagesProps) => {
  const r = useRef(null);
  const count = tweetImages.length;
  const numericRatio = calcOneImageRatio(tweetImages[0].width ?? 1, tweetImages[0].height ?? 1);
  const ratio = tweetImages.length > 1 || tweetImages[0].height == null ? '56.25%'
    : `${numericRatio * 100}%`;
  return (
    <div {...className(
      globalClassName('imageContainer'),
      css.imageContainer,
      count === 1 && numericRatio > 1 && css.singleImageRestriction
    )}
    >
      <div style={{ paddingBottom: ratio }} />
      <div
        {...className(globalClassName('imageContent'), css.imageContent)}
        ref={r}
        style={{
          gridTemplateRows: count > 2 ? '1fr 1fr' : '1fr',
          gridTemplateColumns: count > 1 ? '1fr 1fr' : '1fr',
        }}
      >
        <Gallery>
          {tweetImages.map((i, index) => {
            const imgInfo = (i.width && i.height)
              ? { width: i.width, height: i.height }
              : undefined;
            if (index === 0 && count === 3) {
              return (
                <div style={{ gridRow: '1 / span 2' }} key={i.src}>
                  <TweetImageItem url={i.src} imgInfo={imgInfo} />
                </div>
              );
            }
            return (
              <div key={i.src}>
                <TweetImageItem url={i.src} imgInfo={imgInfo} />
              </div>
            );
          })}
        </Gallery>
      </div>
    </div>

  );
};

export default TweetImages;
