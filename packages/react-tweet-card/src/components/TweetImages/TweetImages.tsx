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

const TweetImages = ({ tweetImages = [] }: TweetImagesProps) => {
  const r = useRef(null);
  const count = tweetImages.length;
  return (
    <div {...className(globalClassName('imageContainer'), css.imageContainer)}>
      <div style={{ paddingBottom: '56.25%' }} />
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
            if (index === 0 && count === 3) {
              return (
                <div style={{ gridRow: '1 / span 2' }}>
                  <TweetImageItem url={i.src} />
                </div>
              );
            }
            return (
              <div>
                <TweetImageItem url={i.src} />
              </div>
            );
          })}
        </Gallery>
      </div>
    </div>

  );
};

export default TweetImages;
