import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from './authSessionContext';

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const { currentUser, authLoading } = useAuthSession();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/');
    }
  }, [authLoading, currentUser, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDF5]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-[#8B5CF6]/20 rounded-full mb-4" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return children;
}
