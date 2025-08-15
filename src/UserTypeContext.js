import React, { createContext, useState, useContext } from 'react';

export const UserTypeContext = createContext();

export function UserTypeProvider({ children }) {
  const [userType, setUserTypeState] = useState(() => {
    const stored = localStorage.getItem('userType');
    console.log('🔍 UserTypeContext: Initial userType from localStorage:', stored);
    return stored || null;
  });
  
  const setUserType = (type) => {
    console.log('🔍 UserTypeContext: Setting userType to:', type);
    setUserTypeState(type);
    if (type) {
      localStorage.setItem('userType', type);
    } else {
      localStorage.removeItem('userType');
    }
  };
  
  console.log('🔍 UserTypeContext: Current userType:', userType);
  
  return (
    <UserTypeContext.Provider value={{ userType, setUserType }}>
      {children}
    </UserTypeContext.Provider>
  );
}

export function useUserType() {
  return useContext(UserTypeContext);
} 