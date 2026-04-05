import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AuthSessionContext } from './authSessionContext';

export function AuthSessionProvider({ children }) {
  const hasAuthInstance = Boolean(auth);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(hasAuthInstance);

  useEffect(() => {
    if (!hasAuthInstance) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [hasAuthInstance]);

  const value = useMemo(
    () => ({ currentUser, authLoading }),
    [currentUser, authLoading]
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}
