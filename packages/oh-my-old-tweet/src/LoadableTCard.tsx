import { useRef, useState } from "react";
import { getCdxItemId, getCdxItemUrl } from "./Data";
import Post from "./Post";
import { TCard } from "./TCard";
import useCachedFetch from "./useCachedFetch";

export function LoadableTCard({ cdxItem }: { cdxItem: string[] }) {
  const [post, setPost] = useState<Post | boolean>();

  const elementRef = useRef<HTMLDivElement>(null);

  useCachedFetch(cdxItem, setPost);

  const pageUrl = getCdxItemUrl(cdxItem);
  return (<div ref={elementRef}>
    {
      (post === false || post === true) ? null :
        (post == null)
          ? <div style={{ height: '200px' }} 
            className="text-black dark:text-white text-center flex flex-col item-center justify-center">
            Loading ... 
            <a href={pageUrl} 
              className="text-tw-blue underline dark:text-blue-500 hover:no-underline"
              target="_blank" rel="noopener noreferrer">
              Tweet id: {getCdxItemId(cdxItem)}
            </a>
          </div>
          : <TCard p={post} />
    }
  </div>);
}
