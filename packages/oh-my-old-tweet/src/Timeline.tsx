import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CdxItem } from "twitter-data-parser";
import { getCdxList } from "./Data";
import { LoadableTCard } from "./LoadableTCard";
import { ConfigContext } from "./context/ConfigContext";
import { ErrorBoundary, useErrorBoundary, } from "react-error-boundary";
import { Box, CircularProgress, List, ListItem, Typography } from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
import { FilterContext } from "./context/FilterContext";
import { DateTime } from "luxon";

function LoadingCircle() {
  return (<CircularProgress size={60} />);
}

function fallbackRender({ error }: { error: Error }) {
  return (<Box>
    <Typography variant="h1">Error</Typography>
    <Typography>{error.message}</Typography>
    <Typography variant="h3" sx={{ mt: 3 }}>Solution</Typography>
    <List>
      <ListItem>
        <Typography>1. Change CORS Proxy Settings</Typography>
      </ListItem>
      <ListItem>
        <Typography>2. Contact Authors</Typography>
      </ListItem>
    </List>
  </Box>
  );
}

function Timeline1({ user }: { user: string }) {
  const [lst, setLst] = useState<JSX.Element[]>([]);
  const cdxList = useRef<CdxItem[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { config } = useContext(ConfigContext);
  const [isInitLoading, setIsInitLoading] = useState(true);
  const { showBoundary } = useErrorBoundary();
  const page = useRef(0);
  const pageSize = 30;
  const updateLst = useCallback((cdxData, init: boolean) => {
    const l = cdxData.map((i: CdxItem) =>
      <LoadableTCard user={user} cdxItem={{ ... i, origUrl: i.original }} key={i.id} />);
    setLst(lst => init ? l : lst.concat(l));
  }, []);
  const fetchData = (init: boolean) => {
    if (init) {
      page.current = 0;
    }
    if (cdxList.current == null) return; // that should not happen
    const pageNow = page.current;
    if (pageNow * pageSize >= cdxList.current.length) {
      setHasMore(false);
    } else {
      const nextData = cdxList.current.slice(pageNow * pageSize, (pageNow + 1) * pageSize);
      page.current += 1;
      updateLst(nextData, init);
    }
  }
  const { tweetFilter } = useContext(FilterContext);
  const { dateInRange } = tweetFilter;
  useEffect(() => {
    getCdxList(config!, user, dateInRange).then((data) => {
      cdxList.current = data.filter(i => dateInRange.contains(DateTime.fromJSDate(i.date)));
      console.log(cdxList.current);
      fetchData(true);
      setIsInitLoading(false);
    }).catch((e) => {
      showBoundary(e);
    });
  }, [config, user, showBoundary, dateInRange]);

  // TODO: fix empty logic
  return ((isInitLoading) ? <LoadingCircle /> :
    <InfiniteScroll
      dataLength={lst.length}
      next={() => fetchData(false)}
      hasMore={hasMore}
      loader={null}
      endMessage={null}
    >
      <div className="min-h-screen w-full md:w-[80mw] lg:w-[800px]">
        {lst}
      </div>
    </InfiniteScroll>
  );
}

export function Timeline({ user }: { user: string }) {
  return (<ErrorBoundary fallbackRender={fallbackRender}>
    <Timeline1 user={user} />
  </ErrorBoundary>)
}

