import { TweetCardProps } from 'index';
import React, { useCallback, useEffect, useState } from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import css from './ProfilePicture.module.css';

type ProfilePictureProps = Pick<TweetCardProps['author'], 'image' | 'fallbackImage'> &
  Pick<TweetCardProps, 'clickableProfileLink'>;

const ProfilePicture = ({
  image,
  fallbackImage,
  clickableProfileLink,
}: ProfilePictureProps) => {
  const [activeImage, setActiveImage] = useState(image);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    setActiveImage(image);
    setUsingFallback(false);
  }, [image, fallbackImage]);

  const handleError = useCallback(() => {
    if (!usingFallback && fallbackImage && fallbackImage !== activeImage) {
      setActiveImage(fallbackImage);
      setUsingFallback(true);
    }
  }, [activeImage, fallbackImage, usingFallback]);

  return (
    <div
      {...className(
        globalClassName('author-image'),
        css.profilePictureContainer,
        clickableProfileLink && css.clickable
      )}
    >
      <img
        src={activeImage}
        alt=""
        aria-hidden
        onError={handleError}
        {...className(css.profilePictureProbe)}
      />
      <div
        style={{ backgroundImage: `url(${activeImage})` }}
        aria-hidden
        {...className(css.profilePicture)}
      />
      <div aria-hidden {...className(css.fallbackPicture)} />
    </div>
  );
};

export default ProfilePicture;
