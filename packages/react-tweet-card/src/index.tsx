import React from 'react';
import UserDetails from 'components/UserDetails';
import Details from 'components/Details';
import Tweet from 'components/Tweet';
import Container from 'components/Container';
import TwitterLogo from 'components/TwitterLogo';
import Engagement from 'components/Engagement';
import TweetImages from 'components/TweetImages';
import ArchiveLogo from 'components/ArchiveLogo';
import { ThemeOption, TweetCardColors } from './themes';
import './index.css';

export type TweetCardProps = React.HTMLAttributes<HTMLDivElement> & {
  author: {
    name: string;
    username: string;
    image: string;
    isVerified?: boolean;
    isProtected?: boolean;
    isBusiness?: boolean;
    isGovernment?: boolean;
  };
  engagement?: {
    replies?: number;
    retweets?: number;
    likes?: number;
  };
  tweet: string;
  tweetImages?: {
    src: string;
    isVideoThumbnail?: boolean;
    width?: number;
    height?: number;
  }[];
  time: Date | string;
  source?: string;
  permalink?: string;
  archiveLink?: string;
  clickableProfileLink?: boolean;
  theme: ThemeOption
  colors?: TweetCardColors;
  gradientBackground?: boolean;
  blurredBackground?: boolean;
  fitInsideContainer?: boolean;
  showDetails?: boolean;
  showEngagement?: boolean;
  emojis?: boolean;
};

function TweetCard({
  author,
  tweet,
  time,
  source,
  permalink,
  engagement,
  clickableProfileLink,
  showDetails = true,
  showEngagement = true,
  emojis,
  tweetImages,
  archiveLink,
  theme,
  ...rest
}: TweetCardProps) {
  return (
    <Container {...{ ...rest, theme }}>
      <UserDetails {...{ ...author, clickableProfileLink }} />
      <div className="icons">
        <TwitterLogo {...{ permalink }} />
        {archiveLink && <ArchiveLogo {...{ ...rest, archiveLink, theme }} />}
      </div>
      <Tweet {...{ tweet }} />
      {tweetImages?.length && <TweetImages {...{ tweetImages }} />}
      {showDetails && <Details {...{ time, source, permalink }} />}
      {showEngagement && <Engagement {...{ ...engagement, emojis }} />}
    </Container>
  );
}

export default TweetCard;
