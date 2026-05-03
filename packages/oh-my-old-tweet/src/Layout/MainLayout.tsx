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
    <div className="flex flex-col gap-6 overflow-y-auto pt-2">
      <Tabs defaultValue="general">
        <TabsList className="w-full">
          <TabsTrigger value="general"  className="flex-1">General</TabsTrigger>
          <TabsTrigger value="proxy"    className="flex-1">Proxy</TabsTrigger>
          <TabsTrigger value="edge"     className="flex-1">Edge</TabsTrigger>
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general" className="space-y-5 mt-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content</h3>

            <div className="flex items-center justify-between">
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

            <div className="flex items-center justify-between">
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

            <div className="flex items-center justify-between">
              <Label htmlFor="img-only">Images Only</Label>
              <Switch
                id="img-only"
                checked={tweetFilter.mustContainImage}
                onCheckedChange={v =>
                  setTweetFilter({ ...tweetFilter, mustContainImage: v })
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
                <div className="flex gap-2">
                  <Input
                    id="proxy-url"
                    value={prefix}
                    onChange={e => setPrefix(e.target.value)}
                    placeholder="https://my-proxy.example.com/?target="
                  />
                  <Button size="sm" onClick={() => save({ prefix })}>Save</Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
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
              <div className="flex gap-2">
                <Input
                  id="edge-url"
                  value={edgeUrl}
                  onChange={e => setEdgeUrl(e.target.value)}
                  placeholder="https://omot-edge.yourname.workers.dev"
                />
                <Button size="sm" onClick={() => save({ edgeUrl: edgeUrl || undefined })}>Save</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Leave blank if no key is set"
                />
                <Button size="sm" onClick={() => save({ apiKey: apiKey || undefined })}>Save</Button>
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

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-3 px-4 max-w-5xl mx-auto">

        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="font-bold text-base tracking-tight text-foreground hover:text-primary transition-colors shrink-0"
        >
          OMOT
        </button>

        <Separator orientation="vertical" className="h-5" />

        {/* Username input */}
        <div className="flex items-center gap-1 flex-1 max-w-xs">
          <span className="text-muted-foreground text-sm select-none">@</span>
          <Input
            className="h-8 text-sm"
            placeholder="username"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <Button size="sm" className="h-8 px-3 shrink-0" onClick={handleSearch}>
            Go
          </Button>
        </div>

        <div className="flex-1" />

        {/* Search */}
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

        {/* GitHub */}
        <Button variant="ghost" size="icon" aria-label="GitHub" asChild>
          <a href="https://github.com/ayanamists/oh-my-old-tweet" target="_blank" rel="noreferrer">
            <GithubIcon className="h-4 w-4" />
          </a>
        </Button>

        {/* Help */}
        <Button variant="ghost" size="icon" aria-label="Help / CORS Proxy docs" asChild>
          <a href="https://github.com/ayanamists/oh-my-old-tweet/wiki/About_CORS_Proxy" target="_blank" rel="noreferrer">
            <HelpCircle className="h-4 w-4" />
          </a>
        </Button>

        {/* Settings */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 sm:w-96 overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>Settings</SheetTitle>
            </SheetHeader>
            <SettingsPanel />
          </SheetContent>
        </Sheet>

      </div>
    </header>
  );
}

// ─── MainLayout ───────────────────────────────────────────────────────────────

type MainLayoutProps = { children: React.ReactNode };

function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-background text-foreground')}>
      <AppBar />
      <main className="min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default MainLayout;
