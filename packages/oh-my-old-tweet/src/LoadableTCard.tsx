import { RefObject, useEffect, useRef, useState } from "react";
import { getCdxItemUrl, getOnePage } from "./Data";
import Post from "./Post";
import { TCard } from "./TCard";

function useOnScreen(ref: RefObject<HTMLElement>) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isOnScreen, setIsOnScreen] = useState(false);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(([entry]) =>
      setIsOnScreen(entry.isIntersecting)
    );
  }, []);

  useEffect(() => {
    observerRef.current?.observe(ref.current as Element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [ref]);

  return isOnScreen;
}

export function LoadableTCard({ cdxItem }: { cdxItem: string[] }) {
  const [post, setPost] = useState<Post>();
  const [fail, setFail] = useState(false);

  const elementRef = useRef<HTMLDivElement>(null);
  const isOnScreen = useOnScreen(elementRef);

  useEffect(() => {
    let ignore = false;
    // note: if this post is reply, `fail` is true
    if (post == null && !fail && isOnScreen) {
      getOnePage(cdxItem).then(res => {
        if (!ignore) {
          if (res == null) {
            setFail(true);
          } else {
            setPost(res);
          }
        }
      }).catch(() => {
        setFail(true);
      });
    }
    return () => {
      ignore = true;
    }
  }, [cdxItem, fail, isOnScreen, post]);

  return (<div ref={elementRef}>
    {
      (fail) ? null :
        (post == null)
          ? <div style={{ height: '200px' }} className="dark: text-white">
            Loading ... {`url : ${getCdxItemUrl(cdxItem)}`}
          </div>
          : <TCard p={post} />
    }
  </div>);
}
