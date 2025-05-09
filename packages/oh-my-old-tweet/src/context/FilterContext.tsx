import { DateTime } from "luxon";
import { createContext, useState } from "react";

type ContentType = "reply" | "post"

type DateOrAny = DateTime | "any"

export interface TweetFilter {
  contentBelongTo: ContentType[]
  mustContainImage: boolean
  dateInRange: [DateOrAny, DateOrAny]
}

interface FilterContext {
  tweetFilter: TweetFilter
  setTweetFilter: (_: TweetFilter) => void
}

const initFilter: TweetFilter = {
  contentBelongTo: ["reply", "post"],
  mustContainImage: false,
  dateInRange: ["any", "any"]
};

export const FilterContext = createContext<FilterContext>(
  { tweetFilter: initFilter, setTweetFilter: () => {} });

export function FilterContextProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<TweetFilter>(initFilter);

  return (<FilterContext.Provider value={{ tweetFilter: filter, setTweetFilter: setFilter }}>
    {children}
  </FilterContext.Provider>)
}
