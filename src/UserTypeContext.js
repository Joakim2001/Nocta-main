import React, { createContext, useState, useContext } from 'react';

export const UserTypeContext = createContext();

export function UserTypeProvider({ children }) {
  const [userType, setUserTypeState] = useState(() => localStorage.getItem('userType') || null);
  const setUserType = (type) => {
    setUserTypeState(type);
    if (type) {
      localStorage.setItem('userType', type);
    } else {
      localStorage.removeItem('userType');
    }
  };
  return (
    <UserTypeContext.Provider value={{ userType, setUserType }}>
      {children}
    </UserTypeContext.Provider>
  );
}

export function useUserType() {
  return useContext(UserTypeContext);
} 