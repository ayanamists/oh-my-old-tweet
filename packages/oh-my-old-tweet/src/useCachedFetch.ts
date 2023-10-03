import { useContext, useEffect } from "react";
import SemaContext from "./SemaContext";
import Post from "./Post";
import { getCdxItemId, getCdxItemUrl, getOnePage } from "./Data";
import { ConfigContext } from "./context/ConfigContext";

function parseStorageItem(str: string): Post | boolean {
  const data = JSON.parse(str);
  if (data.data == null) {
    return false;
  }
  const post = data.data as Post;
  if (! (post.date instanceof Date)) {
    post.date = new Date(post.date);
  }

  return post;
}

const useCachedFetch = (cdxItem: string[], setData: (p: Post | boolean) => void) => {
  const sema = useContext(SemaContext);
  const config = useContext(ConfigContext);
  useEffect(() => {
    const id = getCdxItemId(cdxItem);
    const item = localStorage.getItem(id);
    if (item != null) {
      setData(parseStorageItem(item));
    } else {
      (async () => {
        await sema.acquire();

        try {
          await (getOnePage(config, cdxItem).then((response) => {
            try {
              localStorage.setItem(id, JSON.stringify({ data: response }));
            } catch (err) {
              console.info(`encounter ${err}, local storage full, clear all`);
              localStorage.clear();
            } finally {
              if (response == null) {
                setData(false);
              } else {
                setData(response);
              }
            }
          })
          .catch((err) => {
            // TODO: add retry
            setData(false)
            console.warn(`fail to load ${getCdxItemUrl(cdxItem)}, dut to ${err}`);
          }));
        } finally {
          sema.release();
        }
      })();
    }
  }, [cdxItem, config, sema, setData]);
};

export default useCachedFetch;