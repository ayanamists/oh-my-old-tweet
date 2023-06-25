import React, { useEffect, useState } from 'react';
import './App.css';
import { getCdxList, getOnePage } from './Data';
import { TCard } from './TCard';

function App() {
  let [lst, setLst] = useState<JSX.Element[]>([])
  useEffect(() => {
    const f = async () => {
      const cdxData = await getCdxList("_iori_n");
      const posts = (await Promise.all(cdxData.map(async (i, idx, _) => {
        if (idx !== 0 && idx < 50) {
          let p = await getOnePage(i);
          return p;
        }
        return null;
      })))
      if (posts !== undefined && posts !== null) {
        const l : JSX.Element[] = [];
        posts.forEach(i => {
          if (i !== undefined && i !== null) {
            l.push(<TCard p={i} />);
          }
        });

        setLst(l);
      }
    }

    f()
  }, [])
  return (<ul className='App'>
    {lst}
  </ul>);
}

export default App;
