"use client";

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dynamic from 'next/dynamic';
import { parseUserName } from '../src/InputParser';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const MainLayout = dynamic(() => import('../src/Layout/MainLayout'), { ssr: false });

function MainPage() {
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    const user = parseUserName(inputValue.trim());
    if (user) navigate(`/${user}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Oh{' '}
            <span className="bg-primary text-primary-foreground px-2 rounded">my</span>
            {' '}old{' '}
            <span className="bg-primary text-primary-foreground px-2 rounded">tweet</span>
          </h1>
          <p className="text-muted-foreground text-base">
            Browse archived Twitter timelines from the Wayback Machine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center flex-1 border border-input rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span className="px-3 text-sm text-muted-foreground bg-muted border-r border-input h-10 flex items-center select-none">
              @
            </span>
            <input
              type="text"
              className="flex-1 h-10 px-3 text-sm bg-background outline-none placeholder:text-muted-foreground"
              placeholder="username or profile URL"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              autoFocus
            />
          </div>
          <Button onClick={handleStart} disabled={!inputValue.trim()}>
            Browse
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Try <button className="text-primary hover:underline" onClick={() => { setInputValue('_iori_n'); }}>@_iori_n</button> as an example.
        </p>
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
