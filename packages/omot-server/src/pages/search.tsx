import 'instantsearch.css/themes/satellite.css';
import { InstantSearch, SearchBox, Highlight, InfiniteHits } from 'react-instantsearch';
import searchClient from '@/util/search';
import MainLayout from '@/layouts/MainLayout';
import { Box,  Button,  useMediaQuery, useTheme, Link } from '@mui/material';

const Hit = ({ hit }: {hit:any}) => {
  const tweetUrl = hit.tweetUrl;
  const splited = tweetUrl.split('/');
  const userName = splited[splited.indexOf('status') - 1];
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isiPad = useMediaQuery('(max-width: 1372px)');
  const mw = isMobile ? '100%' : (isiPad ? '60vw' : '40vw');
  const computedUserLink = `/user/${userName}/?userId=${hit.userId}`;
  const computedLink = `/user/${userName}/?userId=${hit.userId}&showReply=${hit.repliesToOriginalId == null ? "false" : "true"}#tweet${hit.originalId}`;
  return (<Box width={mw}>
    <Highlight attribute="content" hit={hit} highlightedTagName="mark" />
    <Box display={'flex'} sx={{
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      padding: '0.5em 0',
    }}>
    <Box>
      From: <Link href={computedUserLink} >{userName}</Link>
    </Box>
    <Button variant='contained' sx={{width:"50%"}} href={computedLink}>
      GOTO
    </Button>
    </Box>
  </Box>)
};

function Search() {
  return (<InstantSearch
    indexName="postIndex"
    // @ts-ignore
    searchClient={searchClient}
  >
    <SearchBox />
    <InfiniteHits hitComponent={Hit} />
  </InstantSearch>);
}

export default function SearchPage() {
  return (<MainLayout>
    <Search />
  </MainLayout>);
}
