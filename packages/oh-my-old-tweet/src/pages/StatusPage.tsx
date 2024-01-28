import { useParams } from 'react-router-dom';
import MainLayout from '../Layout/MainLayout';
import { LoadableTCard } from '../LoadableTCard';

export default function Page() {
  const { timestamp, user, id } = useParams();
  const origUrl = `https://twitter.com/${user}/status/${id}`;
  if (user == null || timestamp == null || id == null) {
    return null;
  } else {
    const minimalCdxInfo = { timestamp, origUrl, id };
    return (
      <MainLayout>
        <div className="min-h-screen w-full md:w-[80vw] lg:w-[800px]">
          <LoadableTCard user={user} cdxItem={minimalCdxInfo} />
        </div>
      </MainLayout>
    );
  }
}