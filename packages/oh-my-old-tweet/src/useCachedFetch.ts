import { useContext, useEffect } from "react";
import SemaContext from "./SemaContext";
import Post from "./Post";
import { getCdxItemId, getCdxItemUrl, getOnePage } from "./Data";

const useCachedFetch = (cdxItem: string[], setData: (p: Post | boolean) => void) => {
  const sema = useContext(SemaContext);

  useEffect(() => {
    const id = getCdxItemId(cdxItem);
    const item = localStorage.getItem(id);
    if (item != null) {
      const cachedData = JSON.parse(item);
      setData(cachedData.data ?? false);
    } else {
      (async () => {
        await sema.acquire();

        try {
          await (getOnePage(cdxItem).then((response) => {
            try {
              localStorage.setItem(id, JSON.stringify({ data: response }));
              // TODO: clear storage if full
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
            console.warn(`fail to load ${getCdxItemUrl(cdxItem)}, dut to ${err}`);
          }));
        } finally {
          sema.release();
        }
      })();
    }
  }, [cdxItem, sema, setData]);
};

export default useCachedFetch;