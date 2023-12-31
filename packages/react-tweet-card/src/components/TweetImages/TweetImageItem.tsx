import React, { MutableRefObject, useCallback, useState } from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import { Item } from 'react-photoswipe-gallery';
import fullFillImage from 'utils/fullFillImage';
import css from './TweetImageItem.module.css';

type ImageInfo = {
  width: number,
  height: number,
}

type TweetImageItemProps = {
  url: string,
  imgInfo?: ImageInfo
}

type TweetImageItemInternalProps = {
  url: string,
  imgInfo: ImageInfo
}

function TweetImageItemInternal({ url, imgInfo }: TweetImageItemInternalProps) {
  const { width, height } = imgInfo;
  return (
    <div
      {...className(globalClassName('image'), css.imageBackground)}
      style={{ backgroundImage: `url(${url})` }}
    >
      <div {...className(globalClassName('imageDiv'), css.imageDiv)}> </div>
      <div {...className(globalClassName('temp'), css.imageData)}>
        <Item
          cropped
          original={url}
          thumbnail={url}
          width={width.toString()}
          height={height.toString()}
        >
          {({ ref, open }) => (
            // eslint-disable-next-line max-len
            // eslint-disable-next-line jsx-a11y/alt-text, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
            <img
              ref={ref as MutableRefObject<HTMLImageElement>}
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

function ClientTweetImageItem({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [width2, setWidth] = useState(0);
  const [height2, setHeight] = useState(0);
  const onLoad = useCallback((i: any) => {
    setLoaded(true);
    const targetHeight = i.target.height;
    const targetWidth = i.target.width;
    const [width, height] = fullFillImage(targetWidth, targetHeight);
    setWidth(width);
    setHeight(height);
  }, []);

  if (!loaded) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img className="notLoaded" src={url} onLoad={onLoad} style={{ opacity: 0 }} />;
  }
  return (
    <TweetImageItemInternal
      url={url}
      imgInfo={
    { width: width2, height: height2 }
  } />
  );
}

export default function TweetImageItem({ url, imgInfo }: TweetImageItemProps) {
  if (imgInfo) {
    const [width, height] = fullFillImage(imgInfo.width, imgInfo.height);
    return <TweetImageItemInternal url={url} imgInfo={{ width, height }} />;
  }
  return <ClientTweetImageItem url={url} />;
}
