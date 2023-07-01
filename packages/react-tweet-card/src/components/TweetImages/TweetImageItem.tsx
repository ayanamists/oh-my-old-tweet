import React, { RefObject, useCallback, useState } from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import { Item } from 'react-photoswipe-gallery';
import fullFillImage from 'utils/fullFillImage';
import css from './TweetImageItem.module.css';

function TweetImageItemInternal({ url, width, height } :
  { url : string, width: number, height: number }) {
  return (
    <div
      {...className(globalClassName('image'), css.imageBackground)}
      style={{ backgroundImage: `url(${url})` }}
    >
      <div {...className(globalClassName('imageDiv'), css.imageDiv)}> </div>
      <div {...className(globalClassName('temp'), css.imageData)}>
        <Item
          original={url}
          thumbnail={url}
          width={width.toString()}
          height={height.toString()}
        >
          {({ ref, open }) => (
            // eslint-disable-next-line max-len
            // eslint-disable-next-line jsx-a11y/alt-text, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
            <img
              ref={ref as RefObject<HTMLImageElement>}
              onClick={open}
              src={url}
              style={{ height: '100%', width: '100%' }}
            />
          )}
        </Item>
      </div>
    </div>
  );
}

export default function TweetImageItem({ url } : { url : string}) {
  const [loaded, setLoaded] = useState(false);
  const [width2, setWidth] = useState(0);
  const [height2, setHeight] = useState(0);
  const onLoad = useCallback((i : any) => {
    setLoaded(true);
    const [width, height] = fullFillImage(i.target.width, i.target.height);
    setWidth(width);
    setHeight(height);
  }, []);

  if (!loaded) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img src={url} onLoad={onLoad} style={{ opacity: 0 }} />;
  }
  return <TweetImageItemInternal url={url} width={width2} height={height2} />;
}
