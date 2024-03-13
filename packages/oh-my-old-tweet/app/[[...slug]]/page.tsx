import './App.css';
import dynamic from 'next/dynamic';

const PageRouter = dynamic(() => import('components/PageRouter'), { ssr: false });

export function generateStaticParams() {
  return [{ slug: [''] }];
}

function App() {
  return <PageRouter />;
}

export default App;
