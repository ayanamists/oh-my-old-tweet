import React, {
  MutableRefObject, useCallback, useEffect, useState,
} from 'react';
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
  fallbackUrl?: string,
  imgInfo?: ImageInfo
}

type TweetImageItemInternalProps = {
  url: string,
  onError: () => void,
  imgInfo: ImageInfo
}

function TweetImageItemInternal({ url, onError, imgInfo }: TweetImageItemInternalProps) {
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
              onError={onError}
              src={url}
              style={{ height: '100%', width: '100%' }}
            />
          )}
        </Item>
      </div>
    </div>
  );
}

function ClientTweetImageItem({ url, onError }: { url: string, onError: () => void }) {
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
    return <img className="notLoaded" src={url} onLoad={onLoad} onError={onError} style={{ opacity: 0 }} />;
  }
  return (
    <TweetImageItemInternal
      url={url}
      onError={onError}
      imgInfo={
    { width: width2, height: height2 }
  } />
  );
}

export default function TweetImageItem({ url, fallbackUrl, imgInfo }: TweetImageItemProps) {
  const [activeUrl, setActiveUrl] = useState(url);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    setActiveUrl(url);
    setUsingFallback(false);
  }, [url, fallbackUrl]);

  const handleError = useCallback(() => {
    if (!usingFallback && fallbackUrl && fallbackUrl !== activeUrl) {
      setActiveUrl(fallbackUrl);
      setUsingFallback(true);
    }
  }, [activeUrl, fallbackUrl, usingFallback]);

  if (imgInfo) {
    const [width, height] = fullFillImage(imgInfo.width, imgInfo.height);
    return <TweetImageItemInternal url={activeUrl} onError={handleError} imgInfo={{ width, height }} />;
  }
  return <ClientTweetImageItem url={activeUrl} onError={handleError} />;
}
