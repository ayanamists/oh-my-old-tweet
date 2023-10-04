import { createContext, useCallback, useState } from "react";

type ShowReplyContextType = {
    showReply: boolean
    toggleShowReply: () => void
}

export const ShowReplyContext = createContext<ShowReplyContextType>(
    { showReply: false, toggleShowReply: () => { } });

export function ShowReplyContextProvider({children}: {children: React.ReactNode}) {
    const [showReply, setShowReply] = useState(false);
    const toggle = useCallback(() => {
        setShowReply(prevShowReply => !prevShowReply);
    }, []);

    return (<ShowReplyContext.Provider value={{ showReply: showReply, toggleShowReply: toggle }}>
        {children}
    </ShowReplyContext.Provider>)
}