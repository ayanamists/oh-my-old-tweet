import { useContext, useEffect } from "react";
import { Post } from "twitter-data-parser";
import { ConfigContext } from "./context/ConfigContext";
import { MinimalCdxInfo, getArchivePageUrl, getOnePage } from "./Data";
import { getCached, setCached } from "./cache/IdbCache";
import SemaContext from "./SemaContext";

const useCachedFetch = (cdxItem: MinimalCdxInfo, setData: (p: Post | boolean) => void) => {
  const { config } = useContext(ConfigContext);
  const sema = useContext(SemaContext);

  useEffect(() => {
    let cancelled = false;
    const id = cdxItem.id;

    (async () => {
      const lookup = await getCached(id);
      if (cancelled) return;

      if (lookup.kind === 'hit') {
        setData(lookup.post);
        return;
      }
      if (lookup.kind === 'negative') {
        setData(false);
        return;
      }

      let acquired = false;
      try {
        await sema.acquire();
        acquired = true;
        if (cancelled) return;

        const response = await getOnePage(config!, cdxItem);
        if (cancelled) return;
        if (response == null) {
          console.warn(`fail to parse ${getArchivePageUrl(cdxItem)}`);
          await setCached(id, null);
          setData(false);
        } else {
          await setCached(id, response);
          setData(response);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn(`fail to load ${getArchivePageUrl(cdxItem)}, due to ${err}`);
        setData(false);
      } finally {
        if (acquired) sema.release();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cdxItem, config, sema, setData]);
};

export default useCachedFetch;
