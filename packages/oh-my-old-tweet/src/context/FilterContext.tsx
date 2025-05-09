import { DateTime, Interval } from "luxon";
import { createContext, useState } from "react";

export type ContentType = "reply" | "post"

export interface TweetFilter {
  contentBelongTo: ContentType[]
  mustContainImage: boolean
  dateInRange: Interval
}

interface FilterContext {
  tweetFilter: TweetFilter
  setTweetFilter: (_: TweetFilter) => void
}

const initFilter: TweetFilter = {
  contentBelongTo: ["reply", "post"],
  mustContainImage: false,
  dateInRange: Interval.fromDateTimes(DateTime.fromISO('2006-03-21'), DateTime.now())
};

export const FilterContext = createContext<FilterContext>(
  { tweetFilter: initFilter, setTweetFilter: () => {} });

export function FilterContextProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<TweetFilter>(initFilter);

  return (<FilterContext.Provider value={{ tweetFilter: filter, setTweetFilter: setFilter }}>
    {children}
  </FilterContext.Provider>)
}
