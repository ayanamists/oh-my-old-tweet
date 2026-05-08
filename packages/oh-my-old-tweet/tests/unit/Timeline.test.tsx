import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DateTime, Interval } from 'luxon';
import type { Post } from 'twitter-data-parser';
import { ConfigContext } from '../../src/context/ConfigContext';
import { FilterContext } from '../../src/context/FilterContext';
import type { TweetFilter } from '../../src/context/FilterContext';
import { defaultConfig } from '../../src/corsUrl';

// State shared between vi.mock factories and the test bodies. vi.hoisted is
// the supported way to do this — plain top-level `let` would be hoisted AFTER
// the mocks and read as undefined inside the factory closures.
const { mockPostMap, mockCdxList, infiniteScrollState } = vi.hoisted(() => ({
  mockPostMap: new Map<string, Post>(),
  mockCdxList: { fn: undefined as unknown as ReturnType<typeof vi.fn> },
  infiniteScrollState: { props: null as null | Record<string, unknown> },
}));

vi.mock('../../src/Data', async () => {
  const actual = await vi.importActual<typeof import('../../src/Data')>('../../src/Data');
  return {
    ...actual,
    getCdxList: (...args: unknown[]) => mockCdxList.fn(...args),
  };
});

// useCachedFetch normally pulls from IDB / archive.org. Replace with a sync
// mock that mirrors the real dependency contract: re-fires when `setData`
// identity changes (which is what happens when tweetFilter changes upstream).
vi.mock('../../src/useCachedFetch', async () => {
  const ReactMod = await import('react');
  return {
    default: (cdxItem: { id: string }, setData: (p: Post | boolean) => void) => {
      ReactMod.useEffect(() => {
        const post = mockPostMap.get(cdxItem.id);
        setData(post == null ? false : post);
      }, [cdxItem, setData]);
    },
  };
});

// TCard pulls in react-tweet-card. Stub it out to a marker.
vi.mock('../../src/TCard', () => ({
  TCard: ({ p }: { p: Post }) => (
    <div data-testid="tcard">{p.user.userName}:{p.id}</div>
  ),
}));

// Capture InfiniteScroll props so we can assert hasMore/dataLength directly.
vi.mock('react-infinite-scroll-component', async () => {
  const ReactMod = await import('react');
  return {
    default: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
      infiniteScrollState.props = props;
      return ReactMod.createElement(
        'div',
        { 'data-testid': 'infinite-scroll' },
        props.children,
      );
    },
  };
});

function makeCdxItem(id: string, dateIso: string) {
  return { id, original: `https://twitter.com/foo/status/${id}`, date: new Date(dateIso) };
}

function makePost(id: string, opts: { user?: string; isReply?: boolean; bio?: string } = {}): Post {
  const userName = opts.user ?? 'foo';
  return {
    id,
    user: {
      userName,
      fullName: userName,
      avatar: '',
      ...(opts.bio !== undefined ? { profileInfo: { text: opts.bio } } : {}),
    },
    text: `tweet ${id}`,
    date: new Date('2020-06-01'),
    images: [],
    tweetUrl: `https://twitter.com/${userName}/status/${id}`,
    archiveUrl: '',
    ...(opts.isReply
      ? { replyInfo: { targetUser: { userName: 'bar' } } }
      : {}),
  };
}

const baseFilter: TweetFilter = {
  contentBelongTo: ['post', 'reply'],
  mustContainImage: false,
  dateInRange: Interval.fromDateTimes(DateTime.fromISO('2006-01-01'), DateTime.now()),
};

function Wrap({ filter, children }: { filter: TweetFilter; children: React.ReactNode }) {
  return (
    <ConfigContext.Provider value={{ config: defaultConfig, setConfig: vi.fn() }}>
      <FilterContext.Provider value={{ tweetFilter: filter, setTweetFilter: vi.fn() }}>
        <MemoryRouter>{children}</MemoryRouter>
      </FilterContext.Provider>
    </ConfigContext.Provider>
  );
}

beforeEach(() => {
  mockPostMap.clear();
  mockCdxList.fn = vi.fn();
  infiniteScrollState.props = null;
});

afterEach(cleanup);

describe('Timeline — subtle filter/scroll behaviour', () => {
  it('auto-advances pages when the filter hides every card so the user is never stuck on an empty page', async () => {
    // 60 cdx items → 2 pages of 30. Every fetched post is a reply.
    // Filter excludes replies → every loaded card collapses to null.
    // Without the auto-advance fix, InfiniteScroll's scroll-bottom trigger
    // never fires (no scrollable content) and the user is stuck. The fix
    // walks pages until the cdx list is exhausted.
    const items = Array.from({ length: 60 }, (_, i) => makeCdxItem(`r${i}`, '2020-06-01'));
    items.forEach(it => mockPostMap.set(it.id, makePost(it.id, { isReply: true })));
    mockCdxList.fn.mockResolvedValue(items);

    const filter: TweetFilter = { ...baseFilter, contentBelongTo: ['post'] };
    const { Timeline } = await import('../../src/Timeline');

    render(<Wrap filter={filter}><Timeline user="foo" /></Wrap>);

    // Eventually every cdx item is mounted and InfiniteScroll knows there's
    // nothing left to fetch. (jsdom reports zero-height layout, which is the
    // same "page fits in viewport" condition that triggers the auto-advance.)
    await waitFor(() => {
      expect(infiniteScrollState.props).not.toBeNull();
      expect(infiniteScrollState.props!.dataLength).toBe(60);
      expect(infiniteScrollState.props!.hasMore).toBe(false);
    });

    // Filter still excludes everything → no visible tweet cards.
    expect(screen.queryAllByTestId('tcard')).toHaveLength(0);
  });

  it('clears the profile sidebar when navigating from user A to user B', async () => {
    // Repro: open user A -> topbar typed user B. Profile column must reflect
    // user B, not the leftover snapshot from A. Without resetting the
    // accumulated `profiles` state on `user` change, A's bio sticks around.
    const itemsA = [makeCdxItem('a1', '2020-06-01')];
    const itemsB = [makeCdxItem('b1', '2020-06-01')];
    mockPostMap.set('a1', makePost('a1', { user: 'alice', bio: 'I am alice' }));
    mockPostMap.set('b1', makePost('b1', { user: 'bob', bio: 'I am bob' }));
    mockCdxList.fn.mockImplementation((_config: unknown, user: string) =>
      Promise.resolve(user === 'alice' ? itemsA : itemsB),
    );

    const { Timeline } = await import('../../src/Timeline');

    const { rerender } = render(
      <Wrap filter={baseFilter}><Timeline user="alice" /></Wrap>,
    );

    // Alice's profile snapshot is loaded into the sidebar.
    await waitFor(() => expect(screen.queryByText('I am alice')).not.toBeNull());

    // Navigate to bob (mirrors the topbar submit → /:user route change).
    rerender(<Wrap filter={baseFilter}><Timeline user="bob" /></Wrap>);

    // Sidebar must switch over: bob shown, alice gone (not just appended).
    await waitFor(() => {
      expect(screen.queryByText('I am bob')).not.toBeNull();
      expect(screen.queryByText('I am alice')).toBeNull();
    });
  });

  it('changing tweetFilter re-evaluates already-loaded LoadableTCards', async () => {
    const items = [
      makeCdxItem('p1', '2020-01-01'),
      makeCdxItem('r1', '2020-02-01'),
      makeCdxItem('p2', '2020-03-01'),
      makeCdxItem('r2', '2020-04-01'),
    ];
    mockPostMap.set('p1', makePost('p1'));
    mockPostMap.set('r1', makePost('r1', { isReply: true }));
    mockPostMap.set('p2', makePost('p2'));
    mockPostMap.set('r2', makePost('r2', { isReply: true }));
    mockCdxList.fn.mockResolvedValue(items);

    const { Timeline } = await import('../../src/Timeline');

    const { rerender } = render(
      <Wrap filter={baseFilter}><Timeline user="foo" /></Wrap>,
    );

    // Initial filter allows post + reply → all 4 cards visible.
    await waitFor(() => expect(screen.queryAllByTestId('tcard')).toHaveLength(4));

    // Tighten filter to posts only. Already-loaded reply cards must collapse.
    rerender(
      <Wrap filter={{ ...baseFilter, contentBelongTo: ['post'] }}>
        <Timeline user="foo" />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryAllByTestId('tcard')).toHaveLength(2));
  });
});
