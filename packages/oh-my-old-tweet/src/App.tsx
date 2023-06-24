import React, { useEffect, useState } from 'react';
import './App.css';
import User from './User';
import { getPosts, getPostsByUser } from './Data';
import { TCard } from './TCard';
import Post from './Post';

function App() {
  let [lst, setLst] = useState<JSX.Element[]>([])
  useEffect(() => {
    const f = async () => {
      let posts = await getPostsByUser("_iori_n");
      setLst(posts.map(i => { 
        return <TCard p={i} /> 
      }))
    }
    
    f()
  }, [])
  return (<ul className='App'>
    {lst}
  </ul>);
}

export default App;
