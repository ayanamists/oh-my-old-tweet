import { useEffect } from 'react';
import { Timeline } from '../Timeline';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../Layout/MainLayout';

export default function Page() {
  const { user } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);
  
  console.log(user);
  return (user == null) ? null : (
    <MainLayout>
      <Timeline user={user} />
    </MainLayout>
  );
}