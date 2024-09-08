"use client";

import 'instantsearch.css/themes/satellite.css';
import {
  InstantSearch, Highlight, InfiniteHits, useSearchBox
} from 'react-instantsearch';
import MainLayout from '@/layouts/MainLayout';
import { Search as SearchIcon } from '@mui/icons-material';
import { useMediaQuery, useTheme, Link } from '@mui/material';
import { TextField, Box, Button, IconButton } from '@mui/material';
import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import UserRefineList from '@/componets/UserRefineList';
import { instantMeiliSearch } from  "@meilisearch/instant-meilisearch";

// FIXME There're so many hack and workaround when querying backend
// FIXME Correctly layout for moblie

const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
const { searchClient } =
  instantMeiliSearch(`${protocol}//${host}/api/meilisearch/`, "MASTER_KEY");
/* const meiliClient = new MeiliSearch({
*   host: `${protocol}//${host}/api/meilisearch/`,
*   apiKey: "MASTER_KEY"
* }); */

// ensure filterable attrs
/* if (typeof window !== 'undefined') {
*   const indexedAttrs = await meiliClient.index('postIndex').getFilterableAttributes();
*   // console.log(await meiliClient.index('postIndex').getFilterableAttributes());
*   const needIndexedAttrs = ['date', 'userId'];
*   if (needIndexedAttrs.map((attr) => !indexedAttrs.includes(attr))
*     .reduce((a, b) => a || b)) {
*     console.log(`update meilisearch attr: ${needIndexedAttrs}`);
*     await meiliClient.index('postIndex').updateFilterableAttributes(needIndexedAttrs);
*   }
* } */

const Hit = ({ hit }: { hit: any }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isiPad = useMediaQuery('(max-width: 1372px)');
  const mw = isMobile ? '100%' : (isiPad ? '60vw' : '40vw');
  const [userName, setUserName] = useState(hit.userNameId);
  const computedUserLink = `/user/${userName}/?userId=${hit.userId}`;
  const computedLink = `/user/${userName}/?userId=${hit.userId}&tweetId=${hit.originalId}`;

  // FIXME very bad, send to much request, caching basicly cannot solve it
  useEffect(() => {
    fetch('/api/userName', {
      method: 'POST',
      body: JSON.stringify({
        userNameId: hit.userNameId
      })
    }).then(async (response) => {
      const r = await response.json();
      setUserName(r.userName as string);
    });
  }, [hit.userNameId]);
  return (<Box width={mw} id={hit.id}>
    <Highlight attribute="content" hit={hit} highlightedTagName="mark" />
    <Box display={'flex'} sx={{
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      padding: '0.5em 0',
    }}>
      <Box>
        From: <Link href={computedUserLink}>{userName}</Link>
      </Box>
      <Button variant='contained' sx={{ width: "50%" }} href={computedLink}>
        GOTO
      </Button>
    </Box>
  </Box>);
};

function mkTimeFilter(dateRange: [DateTime | null, DateTime | null]) {
  if (dateRange[0] != null && dateRange[1] != null) {
    const start = dateRange[0].toUnixInteger();
    const end = dateRange[1].toUnixInteger();
    return `date >= ${start} AND date < ${end}`;
  }
  return null;
}

// TODO add a time filter
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mkFilter(dateRange: [DateTime | null, DateTime | null]) {
  return [mkTimeFilter(dateRange)].filter(f => f != null);
}

function Search() {
  return (<>
    <Box sx={{
      display: 'grid', gridTemplateColumns: '1fr 3fr',
      gap: 4,
      maxWidth: '80vw'
    }}>
      <Box sx={{
        position: 'sticky',
        top: '100px',
        maxHeight: '80vh',
        minWidth: '20vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        overflowY: 'auto'
      }}>
        <UserRefineList />
     </Box>
      <Box sx={{
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyItems: 'center',
          marginTop: 3, flexDirection: 'row',
          position: 'sticky', top: '60px',
        }}>
          <SearchBox />
        </Box>

        <InfiniteHits hitComponent={Hit} />
      </Box>
    </Box>
  </>);
}

function SearchBox() {
  const {
    refine,
  } = useSearchBox();
  // FIXME can be used, but still not so good
  return (
    <TextField id="search-box" label="Search" variant="filled"
      onInput={e => {
      // @ts-expect-error I don't know why tsc cannot check this, it's correct
        refine(e.target.value);
      }}
      fullWidth
      InputProps={{
        endAdornment: (
          <IconButton color="primary">
            <SearchIcon />
          </IconButton>
        ),
      }}
    />);
}

export default function SearchPage() {
  return (<MainLayout>
    <InstantSearch
      indexName="postIndex"
      searchClient={searchClient}
      future={{ preserveSharedStateOnUnmount: true }}
    >
      <Search />
    </InstantSearch>
  </MainLayout>);
}
