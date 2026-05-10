import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigContext } from '../../src/context/ConfigContext';
import { defaultConfig } from '../../src/corsUrl';
import type { CorsProxyConfig } from '../../src/corsUrl';
import React from 'react';

afterEach(cleanup);

// next/dynamic with { ssr: false } renders nothing in jsdom. Replace it with a
// passthrough so the component's children reach the DOM in tests.
vi.mock('next/dynamic', () => ({
  default: (fn: () => Promise<{ default: React.ComponentType<{ children?: React.ReactNode }> }>) => {
    return function DynamicPassthrough({ children }: { children?: React.ReactNode }) {
      return React.createElement(React.Fragment, null, children);
    };
  },
}));

function ConfigWrapper({ config, children }: { config: CorsProxyConfig; children: React.ReactNode }) {
  return (
    <ConfigContext.Provider value={{ config, setConfig: vi.fn() }}>
      <MemoryRouter>{children}</MemoryRouter>
    </ConfigContext.Provider>
  );
}

describe('SearchPage edge-URL guard', () => {
  it('builds a timeline URL focused on the selected search result', async () => {
    const { getSearchResultTimelinePath } = await import('../../components/SearchPage');

    expect(getSearchResultTimelinePath({ username: 'Mark_Leica', id: '1447772896802209794' }))
      .toBe('/Mark_Leica?focus=1447772896802209794');
  });

  it('shows "not configured" alert when edgeUrl is absent', async () => {
    const { default: SearchPage } = await import('../../components/SearchPage');
    render(
      <ConfigWrapper config={{ ...defaultConfig, edgeUrl: undefined }}>
        <SearchPage />
      </ConfigWrapper>,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/edge worker/i, { exact: false })).toBeDefined();
  });

  it('shows search form when edgeUrl is configured', async () => {
    const { default: SearchPage } = await import('../../components/SearchPage');
    render(
      <ConfigWrapper config={{ ...defaultConfig, edgeUrl: 'https://omot-edge.example.com' }}>
        <SearchPage />
      </ConfigWrapper>,
    );
    expect(screen.getByRole('button', { name: /search/i })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
