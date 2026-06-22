"use client";

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Search, HelpCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.604-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
import { Toaster, toast } from 'sonner';
import { DateTime, Interval } from 'luxon';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';

import { ConfigContext } from '../context/ConfigContext';
import { CorsProxyConfig, defaultConfig, saveToLocal } from '../corsUrl';
import { FilterContext } from 'src/context/FilterContext';
import { parseUserName } from '../InputParser';
import { cn } from '../../lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setIncludeContent(
  filter: { contentBelongTo: ('reply' | 'post')[] },
  content: 'reply' | 'post',
  value: boolean,
) {
  const next = [...filter.contentBelongTo];
  if (value) {
    if (!next.includes(content)) next.push(content);
  } else {
    const i = next.indexOf(content);
    if (i !== -1) next.splice(i, 1);
  }
  return next;
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
  const { config, setConfig } = React.useContext(ConfigContext);
  const { tweetFilter, setTweetFilter } = React.useContext(FilterContext);
  const cfg = config!;

  const [prefix, setPrefix] = React.useState(cfg.prefix);
  const [edgeUrl, setEdgeUrl] = React.useState(cfg.edgeUrl ?? '');
  const [apiKey, setApiKey] = React.useState(cfg.apiKey ?? '');
  const [mediaCacheUrl, setMediaCacheUrl] = React.useState(cfg.mediaCacheUrl ?? '');
  const [mediaCacheKey, setMediaCacheKey] = React.useState(cfg.mediaCacheKey ?? '');

  const save = React.useCallback(
    (patch: Partial<CorsProxyConfig>) => {
      const next = { ...cfg, ...patch };
      setConfig(next);
      saveToLocal(next);
      toast.success('Settings saved');
    },
    [cfg, setConfig],
  );

  const includeReply = tweetFilter.contentBelongTo.includes('reply');
  const includePost  = tweetFilter.contentBelongTo.includes('post');

  const startIso = (tweetFilter.dateInRange.start as DateTime).toISODate() ?? '';
  const endIso   = (tweetFilter.dateInRange.end   as DateTime).toISODate() ?? '';

  const handleDateChange = (which: 'start' | 'end', value: string) => {
    const dt = DateTime.fromISO(value);
    if (!dt.isValid) return;
    const start = which === 'start' ? dt : (tweetFilter.dateInRange.start as DateTime);
    const end   = which === 'end'   ? dt : (tweetFilter.dateInRange.end   as DateTime);
    const next  = Interval.fromDateTimes(start, end);
    if (next.isValid) setTweetFilter({ ...tweetFilter, dateInRange: next });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 overflow-y-auto pt-2">
      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general"  className="min-w-0 px-2 text-xs sm:text-sm">General</TabsTrigger>
          <TabsTrigger value="proxy"    className="min-w-0 px-2 text-xs sm:text-sm">Proxy</TabsTrigger>
          <TabsTrigger value="edge"     className="min-w-0 px-2 text-xs sm:text-sm">Edge</TabsTrigger>
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general" className="space-y-5 mt-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content</h3>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="incl-reply">Include Replies</Label>
              <Checkbox
                id="incl-reply"
                checked={includeReply}
                onCheckedChange={v => {
                  const next = setIncludeContent(tweetFilter, 'reply', Boolean(v));
                  setTweetFilter({ ...tweetFilter, contentBelongTo: next });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="incl-post">Include Posts</Label>
              <Checkbox
                id="incl-post"
                checked={includePost}
                onCheckedChange={v => {
                  const next = setIncludeContent(tweetFilter, 'post', Boolean(v));
                  setTweetFilter({ ...tweetFilter, contentBelongTo: next });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="img-only">Images Only</Label>
              <Switch
                id="img-only"
                checked={tweetFilter.mustContainImage}
                onCheckedChange={v =>
                  setTweetFilter({ ...tweetFilter, mustContainImage: v })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeline-order">Order</Label>
              <Select
                value={tweetFilter.sortOrder}
                onValueChange={v =>
                  setTweetFilter({ ...tweetFilter, sortOrder: v === 'desc' ? 'desc' : 'asc' })
                }
              >
                <SelectTrigger id="timeline-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Oldest first</SelectItem>
                  <SelectItem value="desc">Newest first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="internal-user-links">Open @ users in OMOT</Label>
              <Switch
                id="internal-user-links"
                checked={tweetFilter.linkUsersInternally}
                onCheckedChange={v =>
                  setTweetFilter({ ...tweetFilter, linkUsersInternally: v })
                }
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    Filters by archive.org capture date, not the original tweet date.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-start">From</Label>
              <Input
                id="date-start"
                type="date"
                value={startIso}
                onChange={e => handleDateChange('start', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-end">To</Label>
              <Input
                id="date-end"
                type="date"
                value={endIso}
                onChange={e => handleDateChange('end', e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                setTweetFilter({
                  ...tweetFilter,
                  dateInRange: Interval.fromDateTimes(
                    DateTime.fromISO('2006-03-21'),
                    DateTime.now(),
                  ),
                })
              }
            >
              Reset Date Range
            </Button>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cache</h3>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                localStorage.clear();
                saveToLocal(cfg);
                toast.success('Cache cleared');
              }}
            >
              Clear Cache
            </Button>
          </section>
        </TabsContent>

        {/* ── Proxy ── */}
        <TabsContent value="proxy" className="space-y-5 mt-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CORS Proxy</h3>

            <div className="space-y-2">
              <Label htmlFor="proxy-mode">Mode</Label>
              <Select
                value={String(cfg.mode)}
                onValueChange={v => {
                  const intValue = Number.parseInt(v);
                  const next = intValue === 1 ? defaultConfig : {
                    ...cfg,
                    mode: intValue,
                    prefix: intValue === 2 ? '' : cfg.prefix,
                  };
                  save(next);
                  setPrefix(next.prefix);
                }}
              >
                <SelectTrigger id="proxy-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Cloudflare (default)</SelectItem>
                  <SelectItem value="2">None (direct)</SelectItem>
                  <SelectItem value="3">Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {cfg.mode === 1 && 'Uses a shared Cloudflare Worker as CORS proxy.'}
                {cfg.mode === 2 && 'Fetches archive.org directly — may fail due to CORS restrictions.'}
                {cfg.mode === 3 && 'Uses the URL below as CORS proxy prefix.'}
              </p>
            </div>

            {cfg.mode === 3 && (
              <div className="space-y-2">
                <Label htmlFor="proxy-url">Proxy URL prefix</Label>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <Input
                    id="proxy-url"
                    className="min-w-0"
                    value={prefix}
                    onChange={e => setPrefix(e.target.value)}
                    placeholder="https://my-proxy.example.com/?target="
                  />
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => save({ prefix })}>Save</Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="url-encoding">URL Encoding</Label>
              <Switch
                id="url-encoding"
                checked={cfg.urlEncoding}
                onCheckedChange={v => save({ urlEncoding: v })}
              />
            </div>
          </section>
        </TabsContent>

        {/* ── Edge ── */}
        <TabsContent value="edge" className="space-y-5 mt-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edge Worker</h3>
            <p className="text-xs text-muted-foreground">
              Optional. Powers the search feature and R2 snapshot cache.
            </p>

            <div className="space-y-2">
              <Label htmlFor="edge-url">Worker URL</Label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <Input
                  id="edge-url"
                  className="min-w-0"
                  value={edgeUrl}
                  onChange={e => setEdgeUrl(e.target.value)}
                  placeholder="https://omot-edge.yourname.workers.dev"
                />
                <Button size="sm" className="w-full sm:w-auto" onClick={() => save({ edgeUrl: edgeUrl || undefined })}>Save</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <Input
                  id="api-key"
                  className="min-w-0"
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Leave blank if no key is set"
                />
                <Button size="sm" className="w-full sm:w-auto" onClick={() => save({ apiKey: apiKey || undefined })}>Save</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="media-cache-url">Media Cache URL</Label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <Input
                  id="media-cache-url"
                  className="min-w-0"
                  value={mediaCacheUrl}
                  onChange={e => setMediaCacheUrl(e.target.value)}
                  placeholder="https://media.example.com"
                />
                <Button size="sm" className="w-full sm:w-auto" onClick={() => save({ mediaCacheUrl: mediaCacheUrl || undefined })}>Save</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="media-cache-key">Media Cache Key</Label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <Input
                  id="media-cache-key"
                  className="min-w-0"
                  type="password"
                  value={mediaCacheKey}
                  onChange={e => setMediaCacheKey(e.target.value)}
                  placeholder="Leave blank if no key is set"
                />
                <Button size="sm" className="w-full sm:w-auto" onClick={() => save({ mediaCacheKey: mediaCacheKey || undefined })}>Save</Button>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── AppBar ───────────────────────────────────────────────────────────────────

function AppBar() {
  const navigate = useNavigate();
  const { config } = React.useContext(ConfigContext);
  const [inputValue, setInputValue] = React.useState('');

  const handleSearch = () => {
    const user = parseUserName(inputValue.trim());
    if (user) navigate(`/${user}`);
  };

  const renderActions = () => (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search archive"
              onClick={() => navigate('/search')}
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {config?.edgeUrl ? 'Search archive' : 'Search (requires Edge Worker)'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="ghost" size="icon" aria-label="GitHub" asChild>
        <a href="https://github.com/ayanamists/oh-my-old-tweet" target="_blank" rel="noreferrer">
          <GithubIcon className="h-4 w-4" />
        </a>
      </Button>

      <Button variant="ghost" size="icon" aria-label="Help / CORS Proxy docs" asChild>
        <a href="https://github.com/ayanamists/oh-my-old-tweet/wiki/About_CORS_Proxy" target="_blank" rel="noreferrer">
          <HelpCircle className="h-4 w-4" />
        </a>
      </Button>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-full overflow-y-auto p-4 sm:w-96 sm:max-w-sm sm:p-6">
          <SheetHeader className="mb-4 pr-8 text-left">
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <SettingsPanel />
        </SheetContent>
      </Sheet>
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-2 md:h-14 md:flex-row md:items-center md:gap-3 md:px-4 md:py-0">

        {/* Logo */}
        <div className="flex h-10 w-full items-center gap-2 md:h-auto md:w-auto md:shrink-0">
          <button
            onClick={() => navigate('/')}
            className="shrink-0 text-base font-bold tracking-tight text-foreground transition-colors hover:text-primary"
          >
            OMOT
          </button>

          <Separator orientation="vertical" className="hidden h-5 md:block" />

          <div className="ml-auto flex shrink-0 items-center gap-1 md:hidden">
            {renderActions()}
          </div>
        </div>

        {/* Username input */}
        <div className="flex w-full min-w-0 items-center gap-2 md:max-w-sm md:flex-1">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span className="flex h-9 shrink-0 items-center border-r border-input bg-muted px-2.5 text-sm text-muted-foreground select-none md:h-8">
              @
            </span>
            <Input
              className="h-9 min-w-0 flex-1 border-0 px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:h-8"
              placeholder="username"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button size="sm" className="h-9 px-3 md:h-8" onClick={handleSearch}>
            Go
          </Button>
        </div>

        <div className="hidden md:block md:flex-1" />

        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {renderActions()}
        </div>

      </div>
    </header>
  );
}

// ─── MainLayout ───────────────────────────────────────────────────────────────

type MainLayoutProps = { children: React.ReactNode };

function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className={cn('flex min-h-svh flex-col bg-background text-foreground md:min-h-screen')}>
      <AppBar />
      <main className="min-w-0 flex-1">
        {children}
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default MainLayout;
