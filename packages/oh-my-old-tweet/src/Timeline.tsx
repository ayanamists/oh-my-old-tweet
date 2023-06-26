import { useEffect, useState } from "react";
import { filterUniqueCdxItems, getCdxItemId, getCdxList } from "./Data";
import { LoadableTCard } from "./LoadableTCard";

export function Timeline({ user }: { user : string }) {
    let [lst, setLst] = useState<JSX.Element[]>([])

    useEffect(() => {
        const f = async () => {
            const cdxData = await getCdxList(user);
            const l = filterUniqueCdxItems(cdxData)
                .map((i) => <LoadableTCard cdxItem={i} key={getCdxItemId(i)} />);
            setLst(l);
        }

        f()
    }, [user]);

    return (<ul className='App'>
        {lst}
    </ul>);
}