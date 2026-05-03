"use client";

import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, CircularProgress, InputAdornment, List, ListItemButton,
  ListItemText, TextField, Typography, Alert, Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import dynamic from 'next/dynamic';
import { ConfigContext } from '../src/context/ConfigContext';

const MainLayout = dynamic(() => import('../src/Layout/MainLayout'), { ssr: false });

interface SearchResult {
  id: string;
  username: string;
  snapshot_ts: number;
  archive_url: string;
  text_snippet: string;
}

interface SearchResponse {
  results?: SearchResult[];
  error?: string;
}

async function fetchSearch(
  edgeUrl: string,
  q: string,
  user: string,
): Promise<SearchResponse> {
  const url = new URL(`${edgeUrl.replace(/\/$/, '')}/search`);
  if (q)    url.searchParams.set('q', q);
  if (user) url.searchParams.set('user', user);
  url.searchParams.set('limit', '50');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  return res.json() as Promise<SearchResponse>;
}

function SearchForm({
  onResults,
}: {
  onResults: (r: SearchResult[]) => void;
}) {
  const { config } = useContext(ConfigContext);
  const [q, setQ]       = useState('');
  const [user, setUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const edgeUrl = config?.edgeUrl;

  async function handleSearch() {
    if (!edgeUrl || (!q && !user)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSearch(edgeUrl, q, user);
      if (data.error) {
        setError(data.error);
        onResults([]);
      } else {
        onResults(data.results ?? []);
      }
    } catch (err) {
      setError(String(err));
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  if (!edgeUrl) {
    return (
      <Alert severity="info" sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        Search requires the Edge Worker to be deployed and configured.
        Set the <strong>Edge URL</strong> in settings to enable it.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h5" fontWeight="bold" mb={2}>Search Archive</Typography>

      <TextField
        fullWidth
        label="Search text"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSearch()}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon /></InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Username (optional)"
          value={user}
          onChange={e => setUser(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={loading || (!q && !user)}
          sx={{ px: 4 }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    </Box>
  );
}

function ResultsList({ results }: { results: SearchResult[] }) {
  const navigate = useNavigate();

  if (results.length === 0) return null;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, mt: 2 }}>
      <Typography variant="body2" color="text.secondary" mb={1}>
        {results.length} result{results.length !== 1 ? 's' : ''}
      </Typography>
      <Paper variant="outlined">
        <List disablePadding>
          {results.map((r, i) => {
            const date = new Date(r.snapshot_ts * 1000).toLocaleDateString();
            return (
              <ListItemButton
                key={`${r.id}-${i}`}
                divider={i < results.length - 1}
                onClick={() => navigate(`/${r.username}`)}
              >
                <ListItemText
                  primary={
                    <span dangerouslySetInnerHTML={{ __html: r.text_snippet }} />
                  }
                  secondary={`@${r.username} · ${date}`}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Paper>
    </Box>
  );
}

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);

  return (
    <MainLayout>
      <Box sx={{ width: '100%', pb: 4 }}>
        <SearchForm onResults={setResults} />
        <ResultsList results={results} />
      </Box>
    </MainLayout>
  );
}
