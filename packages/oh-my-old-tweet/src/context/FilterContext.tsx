import { createContext, useCallback, useState } from "react";

type ContentType = "reply" | "post"

export interface TweetFilter {
    contentBelongTo: ContentType[]
    mustContainImage: boolean
    dateInRange?: [Date, Date]
}

interface FilterContext {
    tweetFilter: TweetFilter
    setTweetFilter: (_: TweetFilter) => void
}

const initFilter: TweetFilter = {
    contentBelongTo: [ "reply", "post" ],
    mustContainImage: false
};

export const FilterContext = createContext<FilterContext>(
    { tweetFilter: initFilter, setTweetFilter: () => {} });

export function FilterContextProvider({children}: {children: React.ReactNode}) {
    const [ filter, setFilter ] = useState<TweetFilter>(initFilter);

    return (<FilterContext.Provider value={{ tweetFilter: filter, setTweetFilter: setFilter }}>
        {children}
    </FilterContext.Provider>)
}
