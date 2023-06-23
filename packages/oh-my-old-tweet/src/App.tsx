import React, { useEffect, useState } from 'react';
import './App.css';
import User from './User';
import { getPosts, getPostsByUser } from './Data';
import { TCard } from './TCard';
import Post from './Post';
import 'photoswipe/style.css'

function App() {
  let [lst, setLst] = useState<JSX.Element[]>([])
  useEffect(() => {
    const f = async () => {
      let posts = await getPostsByUser("SakiLovesU");
      setLst(posts.map(i => <TCard p={i} />))
    }
    
    f()
  }, [])
  return (<ul>
    {lst}
  </ul>);
}

export default App;
