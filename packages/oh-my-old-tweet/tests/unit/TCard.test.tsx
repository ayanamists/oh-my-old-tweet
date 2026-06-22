import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Post } from 'twitter-data-parser';
import { ConfigContext } from '../../src/context/ConfigContext';
import { defaultConfig } from '../../src/corsUrl';

const { tweetCardProps } = vi.hoisted(() => ({
  tweetCardProps: { current: null as null | Record<string, any> },
}));

vi.mock('react-tweet-card', () => ({
  default: (props: Record<string, any>) => {
    tweetCardProps.current = props;
    return <div data-testid="tweet-card" />;
  },
}));

function makePost(): Post {
  return {
    id: '1',
    user: {
      userName: 'alice',
      fullName: 'Alice',
      avatar: 'https://web.archive.org/web/1im_/https://pbs.twimg.com/profile/a.jpg',
    },
    text: 'hello',
    date: new Date('2020-01-01T00:00:00.000Z'),
    images: [
      'https://web.archive.org/web/1im_/https://pbs.twimg.com/media/a.jpg',
    ],
    tweetUrl: 'https://twitter.com/alice/status/1',
    archiveUrl: 'https://web.archive.org/web/1/https://twitter.com/alice/status/1',
  };
}

describe('TCard media fallback', () => {
  it('passes original media URLs as fallbacks for media-cache URLs', async () => {
    const { TCard } = await import('../../src/TCard');
    const post = makePost();

    render(
      <ConfigContext.Provider
        value={{
          config: {
            ...defaultConfig,
            mediaCacheUrl: 'https://media.example.com',
            mediaCacheKey: 'secret',
          },
          setConfig: vi.fn(),
        }}
      >
        <TCard p={post} shareLink="https://share.example.com" />
      </ConfigContext.Provider>,
    );

    expect(tweetCardProps.current?.author.image).toContain('https://media.example.com/media?');
    expect(tweetCardProps.current?.author.fallbackImage).toBe(post.user.avatar);
    expect(tweetCardProps.current?.tweetImages?.[0].src).toContain('https://media.example.com/media?');
    expect(tweetCardProps.current?.tweetImages?.[0].fallbackSrc).toBe(post.images[0]);
  });
});
