import { createContext, Dispatch } from 'react';

interface TweetSettings {
  showReply: boolean;
  onlyShowImage: boolean;
}

interface TweetSettingAction {
  type: 'showReply' | 'onlyShowImage',
  payload: boolean
}

export const TweetContext = createContext<TweetSettings | null>(null);
export const TweetDispatchContext = createContext<Dispatch<TweetSettingAction> | null>(null);
