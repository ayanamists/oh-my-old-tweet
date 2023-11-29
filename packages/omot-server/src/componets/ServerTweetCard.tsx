import TweetCard from "react-tweet-card";
import { useColorScheme } from '@mui/material/styles';
import { DisplayTweet } from "./TimeLine";
import dynamic from 'next/dynamic'


function ServerTweetCard({ tweet, user }: DisplayTweet) {
  const mode = useColorScheme();
  console.log(mode);
  // some hack here, tweet.date will be string in ssr
  // see https://stackoverflow.com/questions/70449092/reason-object-object-date-cannot-be-serialized-as-json-please-only-return
  const date = new Date(tweet.date);
  return (<TweetCard
    author={{
      name: user.fullName,
      username: user.userName,
      image: ""
    }}
    tweet={tweet.content}
    time={date}
    source="Twitter for iPhone"
    permalink={tweet.tweetUrl}
    archiveLink={tweet.archiveUrl ?? undefined}
    theme={mode.colorScheme === 'dark' ? 'dark' : 'light'}
    tweetImages={tweet.images.length === 0 ? undefined
      : tweet.images.map(i => ({
        src: i.url,
        width: i.width ?? undefined,
        height: i.height ?? undefined
      }))
    }
  />);
}

// TODO: Use ssr for tweet card 
//       1. seems that the `react-photoswipe-gallery` fix the ssr problem in alpha 3.0.0
//       see https://github.com/dromru/react-photoswipe-gallery/issues/1163
//       but when I use this version, the `react-photoswipe-gallery` is not working
//       find out what's wrong with it
//       2. note the date problem in ssr (see above)
export default dynamic(() => Promise.resolve(ServerTweetCard), {
  ssr: false
});
