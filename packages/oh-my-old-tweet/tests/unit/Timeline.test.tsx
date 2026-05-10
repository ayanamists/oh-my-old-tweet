import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DateTime, Interval } from 'luxon';
import type { Post } from 'twitter-data-parser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  TCard: ({ p, linkUsersInternally }: { p: Post; linkUsersInternally?: boolean }) => (
    <div data-testid="tcard" data-internal-links={String(linkUsersInternally)}>{p.user.userName}:{p.id}</div>
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
  sortOrder: 'asc',
  linkUsersInternally: true,
};

// Fresh QueryClient per render so cache from a prior test never leaks. retry:0
// + gcTime:Infinity keeps tests deterministic without losing cached data
// during waitFor delays.
function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });
}

function Wrap({ filter, children, client }: {
  filter: TweetFilter;
  children: React.ReactNode;
  client?: QueryClient;
}) {
  // Lazy useState so a Wrap kept across `rerender()` calls preserves its
  // QueryClient — tests that simulate navigation (rerender with new user
  // prop) need cache continuity, while tests that mount fresh (separate
  // render() calls) start clean because Wrap unmounts in between.
  const [qc] = React.useState(() => client ?? makeTestQueryClient());
  return (
    <QueryClientProvider client={qc}>
      <ConfigContext.Provider value={{ config: defaultConfig, setConfig: vi.fn() }}>
        <FilterContext.Provider value={{ tweetFilter: filter, setTweetFilter: vi.fn() }}>
          <MemoryRouter>{children}</MemoryRouter>
        </FilterContext.Provider>
      </ConfigContext.Provider>
    </QueryClientProvider>
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

  it('matches archived usernames case-insensitively', async () => {
    const items = [makeCdxItem('m1', '2020-06-01')];
    mockPostMap.set('m1', makePost('m1', { user: 'Mark_Leica', bio: 'Mixed case profile' }));
    mockCdxList.fn.mockResolvedValue(items);

    const { Timeline } = await import('../../src/Timeline');

    render(<Wrap filter={baseFilter}><Timeline user="mark_leica" /></Wrap>);

    await waitFor(() => {
      expect(screen.queryAllByTestId('tcard')).toHaveLength(1);
      expect(screen.queryByText('Mixed case profile')).not.toBeNull();
    });
  });

  it('can reverse timeline order by archive capture date', async () => {
    const items = [
      makeCdxItem('old', '2020-01-01'),
      makeCdxItem('new', '2020-03-01'),
      makeCdxItem('mid', '2020-02-01'),
    ];
    items.forEach(it => mockPostMap.set(it.id, makePost(it.id)));
    mockCdxList.fn.mockResolvedValue(items);

    const { Timeline } = await import('../../src/Timeline');

    render(
      <Wrap filter={{ ...baseFilter, sortOrder: 'desc' }}>
        <Timeline user="foo" />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryAllByTestId('tcard')).toHaveLength(3));

    expect(screen.queryAllByTestId('tcard').map(el => el.textContent)).toEqual([
      'foo:new',
      'foo:mid',
      'foo:old',
    ]);
  });

  it('opens a focused search result inside a bounded timeline window', async () => {
    const items = Array.from({ length: 100 }, (_, i) => makeCdxItem(String(i), '2020-06-01'));
    items.forEach(it => mockPostMap.set(it.id, makePost(it.id)));
    mockCdxList.fn.mockResolvedValue(items);

    const { Timeline } = await import('../../src/Timeline');

    render(<Wrap filter={baseFilter}><Timeline user="foo" focusId="50" /></Wrap>);

    await waitFor(() => expect(screen.queryByText('foo:50')).not.toBeNull());
    expect(screen.queryByText('foo:0')).toBeNull();
    expect(screen.getByText(/showing/i).textContent).toContain('of 100');

    const previousButton = screen.getByRole('button', { name: /load older tweets/i });
    fireEvent.click(previousButton);

    await waitFor(() => expect(screen.queryByText('foo:20')).not.toBeNull());
  });

  it('keeps cards above the current scroll position mounted as the timeline grows past 120 items', async () => {
    // Pins the unbounded-window decision. The earlier MAX_VISIBLE_ITEMS=120
    // design slid `start` forward as `end` advanced, unmounting cards that
    // had scrolled out the top — this broke browser scroll anchoring during
    // fast scrolling (DOM height shrank under the viewport) and made
    // scroll-back flash skeletons while LoadableTCard re-mounted through
    // its async IDB lookup. Now the window only grows; older cards stay
    // live so scroll-back is instantaneous and the viewport never jumps.
    const N = 200;
    const items = Array.from({ length: N }, (_, i) => makeCdxItem(`x${i}`, '2020-06-01'));
    items.forEach(it => mockPostMap.set(it.id, makePost(it.id)));
    mockCdxList.fn.mockResolvedValue(items);

    const { Timeline } = await import('../../src/Timeline');
    render(<Wrap filter={baseFilter}><Timeline user="foo" /></Wrap>);

    // jsdom layout has zero height, so the auto-advance walks every page
    // until hasMore is false — same convergence as a real user scrolling
    // to the very bottom.
    await waitFor(() => {
      expect(infiniteScrollState.props).not.toBeNull();
      expect(infiniteScrollState.props!.dataLength).toBe(N);
      expect(infiniteScrollState.props!.hasMore).toBe(false);
    });

    // Old cap would have left start=N-120=80, evicting foo:x0..foo:x79.
    // New behaviour: both ends stay mounted.
    expect(screen.queryByText('foo:x0')).not.toBeNull();
    expect(screen.queryByText('foo:x199')).not.toBeNull();
  });

  it('passes the internal @ user link preference to tweet cards', async () => {
    const items = [makeCdxItem('p1', '2020-01-01')];
    mockPostMap.set('p1', makePost('p1'));
    mockCdxList.fn.mockResolvedValue(items);

    const { Timeline } = await import('../../src/Timeline');

    render(
      <Wrap filter={{ ...baseFilter, linkUsersInternally: false }}>
        <Timeline user="foo" />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryAllByTestId('tcard')).toHaveLength(1));
    expect(screen.getByTestId('tcard').getAttribute('data-internal-links')).toBe('false');
  });

  it('drops the previous user\'s profile on the very first commit after navigation', async () => {
    // Pins the cross-user residue fix. The old setProfiles([])-in-useEffect
    // approach left alice's bio in the DOM for one render after rerendering
    // to bob — the effect ran after commit, so the post-rerender paint still
    // had alice's profiles state. With key={user} the Timeline subtree is
    // a fresh instance on user change, so alice's profile is unreachable
    // immediately, with no waitFor, no settle delay.
    const itemsA = [makeCdxItem('a1', '2020-06-01')];
    const itemsB = [makeCdxItem('b1', '2020-06-01')];
    mockPostMap.set('a1', makePost('a1', { user: 'alice', bio: 'I am alice' }));
    mockPostMap.set('b1', makePost('b1', { user: 'bob', bio: 'I am bob' }));
    mockCdxList.fn.mockImplementation((_cfg: unknown, user: string) =>
      Promise.resolve(user === 'alice' ? itemsA : itemsB),
    );

    const { Timeline } = await import('../../src/Timeline');

    const { rerender } = render(
      <Wrap filter={baseFilter}><Timeline user="alice" /></Wrap>,
    );
    await waitFor(() => expect(screen.queryByText('I am alice')).not.toBeNull());

    rerender(<Wrap filter={baseFilter}><Timeline user="bob" /></Wrap>);

    // Synchronous assertion: alice must not be in the DOM as soon as React
    // commits the rerender. No waitFor — that would mask the bug we're
    // pinning, which is specifically about the first paint after the prop
    // change.
    expect(screen.queryByText('I am alice')).toBeNull();
  });

  it('a stale getCdxList resolve cannot pollute the current user\'s totalCount', async () => {
    // Pins the request-race fix. Old behaviour: a slow getCdxList() that
    // resolved after the user had already navigated away would write its
    // data into shared component state (via a captured-closure ref), so
    // bob's "Showing 1-N of N" would suddenly flip to alice's count. With
    // React Query, alice's promise resolves into queryKey ['cdx','alice',...]
    // and bob's UI subscribes only to ['cdx','bob',...], so cross-key
    // contamination is prevented at the data-structure level.
    const itemsA = Array.from({ length: 50 }, (_, i) => makeCdxItem(`a${i}`, '2020-06-01'));
    const itemsB = [makeCdxItem('b1', '2020-06-01')];

    let resolveAlice: (items: typeof itemsA) => void = () => {};

    mockCdxList.fn.mockImplementation((_cfg: unknown, user: string) => {
      if (user === 'alice') return new Promise<typeof itemsA>((r) => { resolveAlice = r; });
      return Promise.resolve(itemsB);
    });

    itemsA.forEach((it) => mockPostMap.set(it.id, makePost(it.id, { user: 'alice' })));
    mockPostMap.set('b1', makePost('b1', { user: 'bob' }));

    const { Timeline } = await import('../../src/Timeline');

    const { rerender } = render(
      <Wrap filter={baseFilter}><Timeline user="alice" /></Wrap>,
    );
    // alice's query is pending — never resolved yet.

    rerender(<Wrap filter={baseFilter}><Timeline user="bob" /></Wrap>);

    // bob renders with its 1 item.
    await waitFor(() => {
      const showing = screen.queryByText(/showing/i);
      expect(showing?.textContent).toContain('of 1');
    });

    // Now resolve alice's stale promise. Pre-fix, this would clobber the
    // visible totalCount; post-fix, it lands harmlessly in alice's cache.
    resolveAlice(itemsA);
    // Flush microtasks so any state propagation has a chance to occur.
    await new Promise((r) => setTimeout(r, 50));

    const showing = screen.queryByText(/showing/i);
    expect(showing?.textContent).toContain('of 1');
    expect(showing?.textContent).not.toContain('of 50');
  });
});
