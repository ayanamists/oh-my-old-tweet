"use client";
import { useParams, useSearchParams } from 'react-router-dom';
import { LoadableTCard } from 'src/LoadableTCard';
import MainLayout from 'src/Layout/MainLayout';


export default function Page() {
  const { timestamp, user, id } = useParams();
  const [ searchParam, _ ] = useSearchParams();
  const mimetype = searchParam.get('mimetype');
  const origUrl = `https://twitter.com/${user}/status/${id}`;
  if (user == null || timestamp == null || mimetype == null || id == null) {
    return null;
  } else {
    const minimalCdxInfo = { timestamp, mimetype: decodeURIComponent(mimetype), origUrl, id };
    return (
      <MainLayout>
        <div className="min-h-screen w-full md:w-[80vw] lg:w-[800px]">
          <LoadableTCard user={user} cdxItem={minimalCdxInfo} />
        </div>
      </MainLayout>
    );
  }
}