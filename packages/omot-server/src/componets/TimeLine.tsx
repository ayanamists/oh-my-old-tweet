import { Post, User, UserName } from "@prisma/client";
import ServerTweetCard from "./ServerTweetCard";
import { Box, List, ListItem, useMediaQuery, useTheme } from "@mui/material";

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
  tweets: DisplayTweet[]
}

export default function Timeline({ tweets }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isiPad = useMediaQuery('(max-width: 1372px)');
  const mw = isMobile ? '100%' : (isiPad ? '60vw' : '40vw');
  return (<Box sx={{
    padding: 0,
    width: mw
  }}>
    <List sx={{
      padding: 0,
    }}>
      {tweets.map((tweet) => (
        <ListItem key={tweet.tweet.id} sx={{
          padding: 0,
        }}>
          <ServerTweetCard tweet={tweet.tweet} user={tweet.user} />
        </ListItem>
      ))}
    </List>
  </Box>);
}
