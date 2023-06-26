import React, { useEffect, useState } from 'react';
import './App.css';
import { filterUniqueCdxItems, getCdxItemId, getCdxList } from './Data';
import { LoadableTCard } from './LoadableTCard';

function App() {
  let [lst, setLst] = useState<JSX.Element[]>([])

  useEffect(() => {
    const f = async () => {
      const cdxData = await getCdxList("_iori_n");
      const l = filterUniqueCdxItems(cdxData)
        .map((i) => <LoadableTCard cdxItem={i} key={getCdxItemId(i)} />);
      setLst(l);
    }

    f()
  }, []);

  return (<ul className='App'>
    {lst}
  </ul>);
}


export default App;
