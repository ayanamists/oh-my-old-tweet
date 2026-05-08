"use client";

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dynamic from 'next/dynamic';
import { parseUserName } from '../src/InputParser';
import { Button } from '../components/ui/button';

const MainLayout = dynamic(() => import('../src/Layout/MainLayout'), { ssr: false });

function MainPage() {
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    const user = parseUserName(inputValue.trim());
    if (user) navigate(`/${user}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-10 sm:py-12 md:py-16">
      <div className="space-y-6">
        <div className="space-y-3 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Wayback timeline browser
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Oh my old tweet
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Browse archived Twitter timelines from the Wayback Machine.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="flex h-11 shrink-0 items-center border-r border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                @
              </span>
              <input
                type="text"
                className="h-11 min-w-0 flex-1 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="username or profile URL"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                autoFocus
              />
            </div>
            <Button className="h-11 w-full sm:w-auto" onClick={handleStart} disabled={!inputValue.trim()}>
              Browse
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground sm:text-left">
            Try <button className="font-medium text-primary hover:underline" onClick={() => { setInputValue('_iori_n'); }}>@_iori_n</button> as an example.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function page() {
  return (
    <MainLayout>
      <MainPage />
    </MainLayout>
  );
}
