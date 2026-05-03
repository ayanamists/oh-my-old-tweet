"use client";
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from 'src/Layout/MainLayout';
import { Timeline } from 'src/Timeline';

export default function Page() {
  const { user } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);
  
  return (user == null) ? null : (
    <MainLayout>
      <Timeline user={user} />
    </MainLayout>
  );
}