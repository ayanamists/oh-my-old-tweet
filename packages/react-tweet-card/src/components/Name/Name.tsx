import React from 'react';
import className from 'utils/className';
import globalClassName from 'utils/globalClassName';
import { TweetCardProps } from 'index';
import css from './Name.module.css';
import Padlock from './Padlock';
import VerifiedBadge from './VerifiedBadge';

const badgeColors = {
  basic: '#1da1f2',
  business: '#dcab00',
  government: '#829aab',
};

type NameProps = Pick<
  TweetCardProps['author'],
  'name' | 'isVerified' | 'isBusiness' | 'isGovernment' | 'isProtected'
> &
  Pick<TweetCardProps, 'clickableProfileLink'>;

const Name = ({
  name,
  clickableProfileLink,
  isVerified,
  isGovernment,
  isProtected,
  isBusiness,
}: NameProps) => (
  <span
    {...className(
      globalClassName('author-name'),
      css.name,
      clickableProfileLink && css.clickable
    )}
  >
    <span>{name}</span>
    {isVerified && (
      <VerifiedBadge
        {...className(globalClassName('verified-badge'), css.verifiedBadge)}
        style={{
          fill:
            (isGovernment && badgeColors.government) ||
            (isBusiness && badgeColors.business) ||
            badgeColors.basic,
        }}
      />
    )}
    {isProtected && (
      <Padlock {...className(globalClassName('protected-icon'), css.padlock)} />
    )}
  </span>
);

export default Name;
