import React from 'react';
import svg from 'assets/TwitterLogo.svg';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import { TweetCardProps } from 'index';
import css from './TwitterLogo.module.css';

type TwitterLogoProps = Pick<TweetCardProps, 'permalink'>;

const TwitterLogo = ({ permalink }: TwitterLogoProps) => {
  const Tag = permalink ? 'a' : 'div';
  const linkProps = {
    href: permalink,
    target: '_blank',
    rel: 'noreferrer',
    'aria-label': 'View tweet on twitter.com',
  };
  const divProps = { 'aria-hidden': true };

  return (
    <Tag {...(permalink ? linkProps : divProps)}>
      <img
        src={svg}
        {...className(globalClassName('twitter-logo'), css.twitterLogo)}
        alt=""
      />
    </Tag>
  );
};

export default TwitterLogo;
