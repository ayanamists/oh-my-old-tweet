import React from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import formatEngagement from 'utils/formatEngagement';
import { TweetCardProps } from 'index';
import css from './Engagement.module.css';
import TwitterIcon from './Twitter';
import Emoji from './Emoji';

type EngagementProps = TweetCardProps['engagement'] &
  Pick<TweetCardProps, 'emojis'>;

function Engagement({
  replies = 0,
  retweets = 0,
  likes = 0,
  emojis,
}: EngagementProps) {
  if (!(replies || retweets || likes)) {
    return null;
  }

  const icons = emojis ? Emoji : TwitterIcon;

  return (
    <div
      {...className(css.engagement, globalClassName('engagement-container'))}
    >
      <span
        role="img"
        aria-label={`${replies} ${replies === 1 ? 'reply' : 'replies'}`}
        className={globalClassName('replies')}
      >
        <icons.replies />
        {formatEngagement(replies)}
      </span>
      <span
        role="img"
        aria-label={`${retweets} ${retweets === 1 ? 'retweet' : 'retweets'}`}
        className={globalClassName('retweets')}
      >
        <icons.retweets />
        {formatEngagement(retweets)}
      </span>
      <span
        role="img"
        aria-label={`${likes} ${likes === 1 ? 'like' : 'likes'}`}
        className={globalClassName('likes')}
      >
        <icons.likes />
        {formatEngagement(likes)}
      </span>
    </div>
  );
}

export default Engagement;
