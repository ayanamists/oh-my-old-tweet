import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CdxItem, User } from "twitter-data-parser";
import { getCdxList } from "./Data";
import { LoadableTCard } from "./LoadableTCard";
import { SkeletonList } from "./SkeletonCard";
import { ConfigContext } from "./context/ConfigContext";
import { ErrorBoundary, useErrorBoundary } from "react-error-boundary";
import InfiniteScroll from "react-infinite-scroll-component";
import { FilterContext } from "./context/FilterContext";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, MapPin, Link as LinkIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";

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

function Timeline1({ user }: { user: string }) {
  const [lst, setLst]       = useState<JSX.Element[]>([]);
  const cdxList             = useRef<CdxItem[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { config }          = useContext(ConfigContext);
  const [cdxLoading, setCdxLoading] = useState(true);
  const { showBoundary }    = useErrorBoundary();
  const page                = useRef(0);
  const pageSize            = 30;
  const containerRef        = useRef<HTMLDivElement | null>(null);

  const [profiles, setProfiles]             = useState<User[]>([]);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [profileDate, setProfileDate]       = useState('');

  const updateLst = useCallback((cdxData: CdxItem[], init: boolean) => {
    const l = cdxData.map(i =>
      <LoadableTCard
        user={user}
        cdxItem={{ ...i, origUrl: i.original }}
        key={i.id}
        onProfileLoaded={post => {
          if (post.user?.profileInfo) {
            setProfiles(prev => {
              const exists = prev.some(
                p => p.userName === post.user.userName && p.profileInfo?.text === post.user.profileInfo?.text
              );
              return exists ? prev : [...prev, post.user];
            });
          }
        }}
      />
    );
    setLst(lst => init ? l : lst.concat(l));
  }, [user]);

  const fetchData = useCallback((init: boolean) => {
    if (init) page.current = 0;
    if (!cdxList.current) return;
    const pageNow = page.current;
    if (pageNow * pageSize >= cdxList.current.length) {
      setHasMore(false);
    } else {
      const nextData = cdxList.current.slice(pageNow * pageSize, (pageNow + 1) * pageSize);
      page.current += 1;
      updateLst(nextData, init);
    }
  }, [updateLst]);

  const { tweetFilter: { dateInRange } } = useContext(FilterContext);

  useEffect(() => {
    setCdxLoading(true);
    getCdxList(config!, user, dateInRange).then(data => {
      cdxList.current = data.filter(i => dateInRange.contains(DateTime.fromJSDate(i.date)));
      fetchData(true);
      setCdxLoading(false);
    }).catch(showBoundary);
  }, [config, user, showBoundary, dateInRange]);

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
    if (!hasMore || cdxLoading) return;
    const node = containerRef.current;
    if (!node) return;

    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const rect = node.getBoundingClientRect();
      if (rect.bottom <= window.innerHeight) fetchData(false);
    };

    const raf = requestAnimationFrame(check);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(node);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [lst.length, hasMore, cdxLoading, fetchData]);

  const currentProfile = profiles.length > 0 ? profiles[currentProfileIndex] : null;

  function tweetListContent() {
    if (cdxLoading) return <SkeletonList count={8} />;
    if (lst.length === 0) return (
      <div className="py-16 text-center space-y-2">
        <p className="text-muted-foreground">No archived tweets found for <strong>@{user}</strong>.</p>
        <p className="text-sm text-muted-foreground">Try adjusting the date range or content filters.</p>
      </div>
    );
    return (
      <InfiniteScroll
        dataLength={lst.length}
        next={() => fetchData(false)}
        hasMore={hasMore}
        loader={<SkeletonList count={3} />}
        endMessage={
          <p className="text-center text-xs text-muted-foreground py-6">All archived tweets loaded.</p>
        }
      >
        {lst}
      </InfiniteScroll>
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

export function Timeline({ user }: { user: string }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Timeline1 user={user} />
    </ErrorBoundary>
  );
}
