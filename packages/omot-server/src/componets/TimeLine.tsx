"use client";

import { Post, User, UserName } from "@prisma/client";
import { useQueryState } from "nuqs"
import ServerTweetCard from "./ServerTweetCard";
import { Box, List, ListItem, useMediaQuery, useTheme } from "@mui/material";
import { VList, VListHandle } from "virtua";
import { useContext, useEffect, useRef, useState, useMemo, MutableRefObject, useCallback } from "react";
import { TweetContext } from "@/contexts/TweetContext";

type DisplayImage = {
  url: string,
  width: number,
  height: number
}

export type DisplayTweet = {
  tweet: Post & { images: DisplayImage[] },
  user: User & UserName & { avatarUrl?: string } 
}

type Props = {
  tweets: DisplayTweet[],
  start: number,
}

interface FocusElem {
  idx: number,
  id: string
}

function implies(a: boolean, b: boolean) {
  return !a || b;
}

function useTweets(tweets: DisplayTweet[], focus: MutableRefObject<FocusElem>):
  [DisplayTweet[], FocusElem] {
  const settings = useContext(TweetContext);
  const showReply = settings?.showReply;
  const onlyShowImage = settings?.onlyShowImage;
  const p = useCallback((t: DisplayTweet) =>
    t.tweet != null &&
    (implies(!showReply ?? true,
             t.tweet.repliesToOriginalId == null && t.tweet.repliesToUserName == null))
      && (implies(onlyShowImage ?? false,
                  t.tweet.images != null && t.tweet.images?.length !== 0)),
    [showReply, onlyShowImage]);

  return useMemo(() => {
    const _tweets = tweets.filter(p);
    if (_tweets.length === 0) {
      return [_tweets, { id: "", idx: 0 }];
    }

    const zToCurrent = tweets.slice(0, tweets.findIndex(t =>
      t.tweet != null && t.tweet.originalId === focus.current.id) + 1);
    const lived = zToCurrent.filter(p);
    const newIdx = lived.length === 0 ? 0 : lived.length - 1;
    const newId = lived.length === 0 ? _tweets[0].tweet.originalId : lived[newIdx].tweet.originalId;
    // console.log(`old focus: ${focus.current.idx}, new: ${newIdx}`);
    return [_tweets, { id: newId, idx: newIdx }];
  }, [focus, p, tweets]);
}

function renewFoucs(focus: MutableRefObject<FocusElem>,
                    newFocus: FocusElem,
                    // eslint-disable-next-line no-unused-vars
                    post: (_: FocusElem) => void) {
  focus.current.id = newFocus.id;
  focus.current.idx = newFocus.idx;
  post(focus.current);
}

// TODO: iOS have some problem, related to <Toolbar /> in MainLayout
export default function Timeline({ tweets, start }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isiPadPortrait = useMediaQuery('(min-width: 768px) and (max-width: 1372px) and (orientation: portrait)');
  const isiPadLandscape = useMediaQuery('(min-width: 768px) and (max-width: 1372px) and (orientation: landscape)');

  const mw = isMobile
    ? '100vw'
    : (isiPadPortrait
      ? '80vw'
      : (isiPadLandscape
        ? '60vw'
        : '40vw'
      )
    );
  const ref = useRef<VListHandle>(null);
  const focus = useRef({ id: tweets[start].tweet.originalId, idx: start });
  const [idx, setIdx] = useState(start);
  const [_tweets, _focus] = useTweets(tweets, focus);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setQueryStart] = useQueryState('tweetId');
  const syncWithQuery = useCallback((focus: FocusElem) => {
    if (typeof window == 'undefined') return
    setQueryStart(focus.id);
  }, [setQueryStart]);
  if (_focus.idx !== idx) {
    renewFoucs(focus, _focus, syncWithQuery);
    setIdx(_focus.idx);
  }
  useEffect(() => {
    ref.current?.scrollToIndex(idx);
  }, [idx]);
  return (<Box sx={{
    padding: 0,
    margin: 'auto'
  }}>
    <List sx={{
      padding: 0,
    }}>
      <VList style={{
        width: '100vw',
        height: 'calc(100vh - 64px)'
       }}
       ref={ref}
       onRangeChange={(start) => {
         const newIdx = start + 1 >= _tweets.length ? _tweets.length - 1 : start + 1;
         const newFocus = {id: _tweets[newIdx].tweet.originalId,
                           idx: newIdx};
         renewFoucs(focus, newFocus, syncWithQuery);
         // console.log(`new focus: ${focus.current.idx}`)
       }}>
       {_tweets.map((tweet) => (
         <ListItem key={tweet.tweet.id} sx={{
           padding: 0,
           width: mw,
           margin: 'auto'
         }} id={`tweet${tweet.tweet.originalId}`}>
          <ServerTweetCard tweet={tweet.tweet} user={tweet.user} />
         </ListItem>
       ))}
      </VList>
    </List>
  </Box>);
}
