import { createContext, useContext } from 'react';

export const AuthSessionContext = createContext({
  currentUser: null,
  authLoading: true,
});

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
