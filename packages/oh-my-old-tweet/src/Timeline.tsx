import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CdxItem, Post, User } from "twitter-data-parser";
import { getCdxList, MinimalCdxInfo } from "./Data";
import { LoadableTCard } from "./LoadableTCard";
import { SkeletonList } from "./SkeletonCard";
import { ConfigContext } from "./context/ConfigContext";
import { ErrorBoundary, useErrorBoundary } from "react-error-boundary";
import InfiniteScroll from "react-infinite-scroll-component";
import { FilterContext } from "./context/FilterContext";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, ChevronUp, MapPin, Link as LinkIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";

const PAGE_SIZE = 30;
const MAX_VISIBLE_ITEMS = 120;

interface VisibleRange {
  start: number;
  end: number;
}

function getInitialRange(total: number, focusIndex: number | undefined): VisibleRange {
  if (total === 0) return { start: 0, end: 0 };
  if (focusIndex == null || focusIndex < 0) {
    return { start: 0, end: Math.min(total, PAGE_SIZE) };
  }

  const halfPage = Math.floor(PAGE_SIZE / 2);
  const unclampedStart = focusIndex - halfPage;
  const maxStart = Math.max(0, total - PAGE_SIZE);
  const start = Math.min(Math.max(0, unclampedStart), maxStart);
  return { start, end: Math.min(total, start + PAGE_SIZE) };
}

function appendPage(range: VisibleRange, total: number): VisibleRange {
  if (range.end >= total) return range;
  const end = Math.min(total, range.end + PAGE_SIZE);
  return {
    start: end - range.start > MAX_VISIBLE_ITEMS ? end - MAX_VISIBLE_ITEMS : range.start,
    end,
  };
}

function prependPage(range: VisibleRange): VisibleRange {
  if (range.start <= 0) return range;
  const start = Math.max(0, range.start - PAGE_SIZE);
  return { start, end: Math.min(range.end, start + MAX_VISIBLE_ITEMS) };
}

function TimelineCdxItem({
  user,
  item,
  focused,
  onProfileLoaded,
}: {
  user: string;
  item: CdxItem;
  focused: boolean;
  onProfileLoaded: (post: Post) => void;
}) {
  const cdxItem = useMemo<MinimalCdxInfo>(() => ({
    ...item,
    origUrl: item.original,
  }), [item]);

  return (
    <div
      data-focus-tweet={focused ? 'true' : undefined}
      className={focused ? 'scroll-mt-24 rounded-lg ring-2 ring-primary/50 ring-offset-4 ring-offset-background' : undefined}
    >
      <LoadableTCard
        user={user}
        cdxItem={cdxItem}
        onProfileLoaded={onProfileLoaded}
      />
    </div>
  );
}

// ─── Error fallback ───────────────────────────────────────────────────────────

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="mx-auto mt-10 max-w-xl space-y-4 rounded-lg border bg-card px-4 py-8 text-center shadow-sm sm:mt-16 sm:px-6">
      <h2 className="text-2xl font-bold text-destructive">Something went wrong</h2>
      <p className="break-words text-sm text-muted-foreground">{error.message}</p>
      <p className="text-sm">Try changing the CORS Proxy settings or check your network.</p>
    </div>
  );
}

// ─── UserProfileCard ──────────────────────────────────────────────────────────

interface UserProfileCardProps {
  profile: User | null;
  profileDate: string;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function UserProfileCard({ profile, profileDate, onPrev, onNext, hasPrev, hasNext }: UserProfileCardProps) {
  if (!profile) return null;

  const info      = profile.profileInfo;
  const avatarUrl = info?.bigAvatar || profile.avatar;

  return (
    <div className="min-w-0 space-y-3 overflow-hidden rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      {/* Avatar + name */}
      <div className="flex min-w-0 items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profile.fullName}
            className="h-14 w-14 shrink-0 rounded-full border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
            {(profile.fullName ?? '?')[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">{profile.fullName}</p>
          <p className="truncate text-sm text-muted-foreground">@{profile.userName}</p>
        </div>
      </div>

      {info?.text && (
        <p className="break-words text-sm leading-relaxed">{info.text}</p>
      )}

      {(info?.location || (info?.urls && info.urls.length > 0)) && (
        <div className="space-y-1">
          {info.location && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{info.location}</span>
            </div>
          )}
          {info.urls && info.urls.length > 0 && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs">
              <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
              <a
                href={info.urls[0]}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-primary hover:underline"
              >
                {info.urls[0].replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            </div>
          )}
        </div>
      )}

      {(info?.followers !== undefined || info?.following !== undefined) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {info.followers !== undefined && (
            <span><strong>{info.followers.toLocaleString()}</strong> <span className="text-muted-foreground">Followers</span></span>
          )}
          {info.following !== undefined && (
            <span><strong>{info.following.toLocaleString()}</strong> <span className="text-muted-foreground">Following</span></span>
          )}
        </div>
      )}

      {info?.joined && (
        <p className="text-xs text-muted-foreground">Joined {info.joined}</p>
      )}

      <Separator />

      {/* Snapshot navigation */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrev} disabled={!hasPrev} aria-label="Previous profile snapshot">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-0 truncate text-xs text-muted-foreground">Snapshot: {profileDate}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNext} disabled={!hasNext} aria-label="Next profile snapshot">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Timeline1 ────────────────────────────────────────────────────────────────

function Timeline1({ user, focusId }: { user: string; focusId?: string }) {
  const cdxList             = useRef<CdxItem[] | null>(null);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({ start: 0, end: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const { config }          = useContext(ConfigContext);
  const [cdxLoading, setCdxLoading] = useState(true);
  const { showBoundary }    = useErrorBoundary();
  const containerRef        = useRef<HTMLDivElement | null>(null);
  const focusScrollPending  = useRef(false);

  const [profiles, setProfiles]             = useState<User[]>([]);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [profileDate, setProfileDate]       = useState('');

  const loadNextPage = useCallback(() => {
    setVisibleRange(range => appendPage(range, totalCount));
  }, [totalCount]);

  const loadPreviousPage = useCallback(() => {
    setVisibleRange(prependPage);
  }, []);

  const handleProfileLoaded = useCallback((post: Post) => {
    if (post.user?.profileInfo) {
      setProfiles(prev => {
        const exists = prev.some(
          p => p.userName === post.user.userName && p.profileInfo?.text === post.user.profileInfo?.text
        );
        return exists ? prev : [...prev, post.user];
      });
    }
  }, []);

  const renderCdxItem = useCallback((i: CdxItem) => (
    <TimelineCdxItem
      key={i.id}
      user={user}
      item={i}
      focused={focusId === i.id}
      onProfileLoaded={handleProfileLoaded}
    />
  ), [focusId, handleProfileLoaded, user]);

  const { tweetFilter } = useContext(FilterContext);
  const { dateInRange, sortOrder } = tweetFilter;

  useEffect(() => {
    setCdxLoading(true);
    cdxList.current = null;
    setVisibleRange({ start: 0, end: 0 });
    setTotalCount(0);
    // Drop the previous user's accumulated profile snapshots before fetching.
    // Otherwise switching A -> B leaves A's avatar/bio in the sidebar until
    // (and even after) B's posts append their own profile.
    setProfiles([]);
    setCurrentProfileIndex(0);
    setProfileDate('');
    getCdxList(config!, user, dateInRange).then(data => {
      const filtered = data
        .filter(i => dateInRange.contains(DateTime.fromJSDate(i.date)))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const ordered = sortOrder === 'desc' ? filtered.reverse() : filtered;
      const focusIndex = focusId ? ordered.findIndex(i => i.id === focusId) : -1;
      cdxList.current = ordered;
      setTotalCount(ordered.length);
      setVisibleRange(getInitialRange(ordered.length, focusIndex >= 0 ? focusIndex : undefined));
      focusScrollPending.current = focusIndex >= 0;
      setCdxLoading(false);
    }).catch(showBoundary);
  }, [config, user, showBoundary, dateInRange, sortOrder, focusId]);

  useEffect(() => {
    if (profiles.length > 0) {
      const profile = profiles[currentProfileIndex];
      // Use the archive timestamp from the profile if available, else today
      setProfileDate(DateTime.fromJSDate(new Date()).toFormat('MMM d, yyyy'));
      void profile; // suppress unused warning
    }
  }, [profiles, currentProfileIndex]);

  // If the current page leaves nothing visible (every card collapsed by
  // the filter, or the list is shorter than the viewport), InfiniteScroll's
  // scroll-bottom trigger never fires and the user sees an empty page that
  // never advances. Watch the container and pull the next page when it fits
  // entirely within the viewport.
  useEffect(() => {
    const hasNext = visibleRange.end < totalCount;
    if (!hasNext || cdxLoading) return;
    const node = containerRef.current;
    if (!node) return;

    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const rect = node.getBoundingClientRect();
      if (rect.bottom <= window.innerHeight) loadNextPage();
    };

    const raf = requestAnimationFrame(check);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(node);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [visibleRange.start, visibleRange.end, totalCount, cdxLoading, loadNextPage]);

  useEffect(() => {
    if (cdxLoading || !focusScrollPending.current) return;

    const raf = requestAnimationFrame(() => {
      const focusEl = document.querySelector('[data-focus-tweet="true"]');
      if (focusEl instanceof HTMLElement && typeof focusEl.scrollIntoView === 'function') {
        focusEl.scrollIntoView({ block: 'center' });
      }
      focusScrollPending.current = false;
    });

    return () => cancelAnimationFrame(raf);
  }, [cdxLoading, visibleRange.start, visibleRange.end, focusId]);

  const currentProfile = profiles.length > 0 ? profiles[currentProfileIndex] : null;

  function tweetListContent() {
    const items = cdxList.current?.slice(visibleRange.start, visibleRange.end) ?? [];
    const hasPrevious = visibleRange.start > 0;
    const hasNext = visibleRange.end < totalCount;
    const previousLabel = sortOrder === 'desc' ? 'Load newer tweets' : 'Load older tweets';

    if (cdxLoading) return <SkeletonList count={8} />;
    if (totalCount === 0) return (
      <div className="py-16 text-center space-y-2">
        <p className="text-muted-foreground">No archived tweets found for <strong>@{user}</strong>.</p>
        <p className="text-sm text-muted-foreground">Try adjusting the date range or content filters.</p>
      </div>
    );
    return (
      <>
        <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Showing {visibleRange.start + 1}-{visibleRange.end} of {totalCount}
          </span>
          {focusId && <Badge variant="secondary">Search result</Badge>}
        </div>

        {hasPrevious && (
          <Button
            variant="outline"
            size="sm"
            className="mb-3 w-full gap-2"
            onClick={loadPreviousPage}
          >
            <ChevronUp className="h-4 w-4" />
            {previousLabel}
          </Button>
        )}

        <InfiniteScroll
          dataLength={visibleRange.end}
          next={loadNextPage}
          hasMore={hasNext}
          loader={<SkeletonList count={3} />}
          endMessage={
            <p className="text-center text-xs text-muted-foreground py-6">All archived tweets loaded in this direction.</p>
          }
        >
          {items.map(renderCdxItem)}
        </InfiniteScroll>
      </>
    );
  }

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Profile banner (visible on all screen sizes, top of page) */}
      {currentProfile && (
        <div className="mb-6">
          <UserProfileCard
            profile={currentProfile}
            profileDate={profileDate}
            onPrev={() => setCurrentProfileIndex(i => Math.max(0, i - 1))}
            onNext={() => setCurrentProfileIndex(i => Math.min(profiles.length - 1, i + 1))}
            hasPrev={currentProfileIndex > 0}
            hasNext={currentProfileIndex < profiles.length - 1}
          />
          {profiles.length > 1 && (
            <div className="flex justify-center mt-2 gap-1">
              {profiles.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentProfileIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentProfileIndex ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  aria-label={`Go to snapshot ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tweet feed */}
      {tweetListContent()}
    </div>
  );
}

export function Timeline({ user, focusId }: { user: string; focusId?: string }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Timeline1 user={user} focusId={focusId} />
    </ErrorBoundary>
  );
}
