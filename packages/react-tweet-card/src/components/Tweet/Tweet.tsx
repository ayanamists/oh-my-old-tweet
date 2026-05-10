import React, { useRef } from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import useLinksUsernamesHashtags from 'hooks/useLinksUsernamesHashtags';
import { TweetCardProps } from 'index';
import css from './Tweet.module.css';

type TweetProps = Pick<TweetCardProps, 'tweet' | 'usernameLinkHref' | 'usernameLinkTarget'>;

const Tweet = ({ tweet, usernameLinkHref, usernameLinkTarget }: TweetProps) => {
  const ref = useRef(null);
  useLinksUsernamesHashtags(ref, tweet, { usernameLinkHref, usernameLinkTarget });

  return (
    <p
      ref={ref}
      {...className(
        globalClassName('tweet'),
        css.tweet,
        tweet.length > 180 && css.longTweet
      )}
    >
      {tweet}
    </p>
  );
};

export default Tweet;
