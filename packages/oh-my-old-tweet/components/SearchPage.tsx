"use client";

import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dynamic from 'next/dynamic';
import { Search, AlertCircle, Info } from 'lucide-react';
import { ConfigContext } from '../src/context/ConfigContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';

const MainLayout = dynamic(() => import('../src/Layout/MainLayout'), { ssr: false });
const SEARCH_LIMIT = 500;

interface SearchResult {
  id: string;
  username: string;
  snapshot_ts: number;
  archive_url: string;
  text_snippet: string;
}

export function getSearchResultTimelinePath(result: Pick<SearchResult, 'id' | 'username'>): string {
  const params = new URLSearchParams({ focus: result.id });
  return `/${encodeURIComponent(result.username)}?${params.toString()}`;
}

async function fetchSearch(edgeUrl: string, q: string, user: string, apiKey?: string): Promise<{ results?: SearchResult[]; error?: string }> {
  const url = new URL(`${edgeUrl.replace(/\/$/, '')}/search`);
  if (q)    url.searchParams.set('q', q);
  if (user) url.searchParams.set('user', user);
  url.searchParams.set('limit', String(SEARCH_LIMIT));

  const headers: HeadersInit = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000), headers });
  return res.json();
}

function NoEdgePrompt() {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-lg space-y-4 rounded-lg border bg-card px-4 py-8 text-center shadow-sm sm:mt-16 sm:px-6">
      <Info className="h-8 w-8 text-muted-foreground mx-auto" />
      <h2 className="text-lg font-semibold">Search requires the Edge Worker</h2>
      <p className="text-sm text-muted-foreground">
        Deploy the <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">omot-edge</code> Cloudflare Worker and enter its URL in{' '}
        <strong>Settings → Edge</strong>.
      </p>
    </div>
  );
}

function ResultsList({ results, searched }: { results: SearchResult[]; searched: boolean }) {
  const navigate = useNavigate();

  if (!searched) return null;

  if (results.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-muted-foreground font-medium">No results found.</p>
        <p className="text-sm text-muted-foreground">Try different keywords or remove the username filter.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground mb-3">
        {results.length} result{results.length !== 1 ? 's' : ''}{results.length === SEARCH_LIMIT ? ' (limit reached)' : ''}
      </p>
      <div className="divide-y overflow-hidden rounded-lg border bg-card shadow-sm">
        {results.map((r, i) => {
          const date = new Date(r.snapshot_ts * 1000).toLocaleDateString();
          // Sanitize: use textContent instead of dangerouslySetInnerHTML
          const snippet = r.text_snippet.replace(/<[^>]*>/g, '').slice(0, 200);
          return (
            <button
              key={`${r.id}-${i}`}
              className="w-full min-w-0 px-4 py-3 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onClick={() => navigate(getSearchResultTimelinePath(r))}
            >
              <p className="line-clamp-2 break-words text-sm">{snippet}</p>
              <p className="mt-1 break-words text-xs text-muted-foreground">@{r.username} · {date}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchForm({ onResults, onSearched }: { onResults: (r: SearchResult[]) => void; onSearched: () => void }) {
  const { config } = useContext(ConfigContext);
  const [q, setQ]         = useState('');
  const [user, setUser]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const edgeUrl = config?.edgeUrl;
  const apiKey  = config?.apiKey;

  async function handleSearch() {
    if (!edgeUrl || (!q && !user)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSearch(edgeUrl, q, user, apiKey);
      if (data.error) {
        setError(data.error);
        onResults([]);
      } else {
        onResults(data.results ?? []);
        onSearched();
      }
    } catch (err) {
      setError(String(err));
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Search Archive</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search tweets…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          autoFocus
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="search-user" className="text-xs text-muted-foreground">Username (optional)</Label>
          <Input
            id="search-user"
            placeholder="@username"
            value={user}
            onChange={e => setUser(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={handleSearch}
            disabled={loading || (!q && !user)}
            className="h-10 w-full px-6 sm:w-auto"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Searching
              </span>
            ) : 'Search'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default function SearchPage() {
  const { config } = useContext(ConfigContext);
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  if (!config?.edgeUrl) {
    return (
      <MainLayout>
        <NoEdgePrompt />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 sm:py-8">
        <SearchForm onResults={setResults} onSearched={() => setSearched(true)} />
        <ResultsList results={results} searched={searched} />
      </div>
    </MainLayout>
  );
}
