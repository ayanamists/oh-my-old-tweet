import React from 'react';

const Emoji = ({ children } : { children: any }) => (
  <span><b>{children}</b></span>
);

const emojis = {
  replies: () => <Emoji>💬</Emoji>,
  retweets: () => <Emoji>🔁</Emoji>,
  likes: () => <Emoji>❤️</Emoji>,
};

export default emojis;
