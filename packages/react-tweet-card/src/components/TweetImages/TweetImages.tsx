import React, { RefObject, useRef } from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import { TweetCardProps } from 'index';
// import VideoButton from 'components/VideoButton';
import { Gallery, Item } from 'react-photoswipe-gallery';
import 'photoswipe/style.css';
import css from './TweetImages.module.css';

type TweetImagesProps = Pick<TweetCardProps, 'tweetImages'>;

const TweetImages = ({ tweetImages = [] }: TweetImagesProps) => {
  const r = useRef(null);
  const count = 2;
  console.log(tweetImages);
  return (
    <div {...className(globalClassName('imageContainer'), css.imageContainer)}>
      <div
        {...className(globalClassName('imageContent'), css.imageContent)}
        ref={r}
        style={{
          gridTemplateRows: count > 2 ? '1fr 1fr' : '1fr',
          gridTemplateColumns: count > 1 ? '1fr 1fr' : '1fr',
        }}
      >
        <Gallery>
          <div
            {...className(globalClassName('image'), css.imageBackground)}
          >
            <Item
              original="https://placekitten.com/1024/768?image=1"
              thumbnail="https://placekitten.com/1024/768?image=1"
              width="1024"
              height="768"
            >
              {({ ref, open }) => (
                // eslint-disable-next-line max-len
                // eslint-disable-next-line jsx-a11y/alt-text, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                <img ref={ref as RefObject<HTMLImageElement>} onClick={open} src="https://placekitten.com/1024/768?image=1" />
              )}
            </Item>
          </div>
          <div
            {...className(globalClassName('image'), css.imageBackground)}
          >
            <Item
              original="https://placekitten.com/1024/768?image=2"
              thumbnail="https://placekitten.com/80/60?image=2"
              width="1024"
              height="768"
            >
              {({ ref, open }) => (
                // eslint-disable-next-line max-len
                // eslint-disable-next-line jsx-a11y/alt-text, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                <img ref={ref as RefObject<HTMLImageElement>} onClick={open} src="https://placekitten.com/80/60?image=2" />
              )}
            </Item>
          </div>
        </Gallery>
      </div>
    </div>

  );
};

export default TweetImages;
