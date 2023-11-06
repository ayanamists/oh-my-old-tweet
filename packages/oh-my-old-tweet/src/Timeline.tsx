import { useContext, useEffect, useState } from "react";
import { filterUniqueCdxItems, getCdxItemId } from "twitter-data-parser";
import { getCdxList } from "./Data";
import { LoadableTCard } from "./LoadableTCard";
import SemaContext from "./SemaContext";
import { Sema } from "async-sema";
import Empty from "./Empty";
import { ConfigContext } from "./context/ConfigContext";
import { ErrorBoundary, useErrorBoundary, } from "react-error-boundary";
import { Box, CircularProgress, List, ListItem, Typography } from "@mui/material";

function LoadingCircle() {
  return (<CircularProgress size={60}/>);
}

function fallbackRender({ error } : { error: Error }) {
  return (<Box>
    <Typography variant="h1">Error</Typography>
    <Typography>{error.message}</Typography>
    <Typography variant="h3" sx={{mt: 3}}>Solution</Typography>
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

export function Timeline1({ user }: { user: string }) {
  let [lst, setLst] = useState<JSX.Element[]>();
  const config = useContext(ConfigContext);
  const { showBoundary } = useErrorBoundary();


  useEffect(() => {
    getCdxList(config, user)
      .then(
        (cdxData) => {
          const l = filterUniqueCdxItems(cdxData)
            .map((i) => <LoadableTCard user={user} cdxItem={i} key={getCdxItemId(i)} />);
          setLst(l);
        })
      .catch(error => showBoundary(error));
  }, [config, showBoundary, user]);

  return (lst == null ? <LoadingCircle /> :
    (lst.length === 0) ? <Empty username={user} /> :
      <SemaContext.Provider value={new Sema(5)}>
        <div className="min-h-screen">
          <ul className='App'>
            {lst}
          </ul>
        </div>
      </SemaContext.Provider>);
}

export function Timeline({ user }: { user: string }) {
  return (<ErrorBoundary fallbackRender={fallbackRender}>
    <Timeline1 user={user} />
  </ErrorBoundary>)
}

