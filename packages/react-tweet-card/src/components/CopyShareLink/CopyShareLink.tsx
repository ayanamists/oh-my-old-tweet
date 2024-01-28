import React, { useState } from 'react';

type Props = {
  shareLink: string
}

function MarkSymbol() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="none" stroke="silver" strokeWidth="1" />
      <polyline points="15 26 23 34 37 20" fill="none" stroke="green" strokeWidth="2" />
    </svg>
  );
}

function CopySymbol() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" stroke="silver" strokeWidth="1" fill="none" />
      <text x="50%" y="50%" textAnchor="middle" dy=".3em" fontSize="20" color="green">
        🔗
      </text>
    </svg>
  );
}

export default function CopyShareLink({ shareLink }: Props) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
  };

  return (
    <button onClick={copyToClipboard} style={{ background: 'none', border: 'none' }} type="button">
      {copied ? <MarkSymbol /> : <CopySymbol />}
    </button>
  );
}
