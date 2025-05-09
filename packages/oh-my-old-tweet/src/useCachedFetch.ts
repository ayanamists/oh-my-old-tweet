import { useContext, useEffect } from "react";
import { Post } from "twitter-data-parser";
import { ConfigContext } from "./context/ConfigContext";
import { MinimalCdxInfo, getArchivePageUrl, getOnePage } from "./Data";

function parseStorageItem(str: string): Post | boolean {
  const data = JSON.parse(str);
  if (data.data == null) {
    return false;
  }
  const post = data.data as Post;
  if (!(post.date instanceof Date)) {
    post.date = new Date(post.date);
  }

  return post;
}

const useCachedFetch = (cdxItem: MinimalCdxInfo, setData: (p: Post | boolean) => void) => {
  const { config } = useContext(ConfigContext);
  useEffect(() => {
    const id = cdxItem.id;
    const item = localStorage.getItem(id);
    if (item != null) {
      setData(parseStorageItem(item));
    } else {
      (async () => {
        await (getOnePage(config!, cdxItem).then((response) => {
          try {
            localStorage.setItem(id, JSON.stringify({ data: response }));
          } catch (err) {
            console.info(`encounter ${err}, local storage full, clear all`);
            localStorage.clear();
          } finally {
            if (response == null) {
              console.warn(`fail to parse ${getArchivePageUrl(cdxItem)}`)
              setData(false);
            } else {
              setData(response);
            }
          }
        })
          .catch((err) => {
            // TODO: add retry
            setData(false)
            console.warn(`fail to load ${getArchivePageUrl(cdxItem)}, due to ${err}`);
          }));
      })();
    }
  }, [cdxItem, config, setData]);
};

export default useCachedFetch;
