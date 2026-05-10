import React from 'react';
import { TweetCardProps } from 'index';
import ProfilePicture from '../ProfilePicture';
import Name from '../Name';
import Username from '../Username';
import css from './UserDetails.module.css';

type UserDetailsProps = TweetCardProps['author'] &
  Pick<TweetCardProps, 'clickableProfileLink' | 'profileLinkHref'>;

const UserDetails = ({
  name,
  username,
  image,
  isVerified,
  isGovernment,
  isBusiness,
  isProtected,
  clickableProfileLink,
  profileLinkHref,
}: UserDetailsProps) => {
  const Tag = clickableProfileLink ? 'a' : 'div';
  const href = profileLinkHref ?? `https://twitter.com/${username}`;
  const opensExternally = /^https?:\/\//.test(href);

  return (
    <Tag
      {...(clickableProfileLink && {
        href,
        ...(opensExternally && {
          target: '_blank',
          rel: 'noreferrer',
        }),
      })}
      className={css.userDetails}
      aria-label={[
        `Tweet by Twitter user ${name} (@${username})`,
        isVerified && 'This twitter account is verified',
        isProtected && "This twitter account's tweets are protected",
        clickableProfileLink &&
          'Click this link to open their profile',
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <ProfilePicture {...{ image, clickableProfileLink }} />
      <Name
        {...{
          name,
          isVerified,
          isGovernment,
          isBusiness,
          isProtected,
          clickableProfileLink,
        }}
      />
      <Username {...{ username }} />
    </Tag>
  );
};

export default UserDetails;
