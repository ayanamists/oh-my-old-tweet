import React, { useState } from 'react';

type Props = {
  shareLink: string
}

export default function CopyShareLink({ shareLink }: Props) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
  };

  return (
    <button onClick={copyToClipboard} style={{ background: 'none', border: 'none' }} type="button">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" stroke="silver" strokeWidth="1" fill="none" />
        <text x="50%" y="50%" textAnchor="middle" dy=".3em" fontSize="20" color="black">
          {copied ? '✔' : '🔗'}
        </text>
      </svg>
    </button>
  );
}
