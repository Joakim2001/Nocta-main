import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useUserType } from './UserTypeContext';

export default function UserTypeDetector() {
  const { userType, setUserType } = useUserType();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (user && !userType) {
        // User is logged in but userType is not set, let's detect it
        try {
          // Check if user exists in Club_Bar_Festival_profiles (company)
          const companyDocRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
          const companyDoc = await getDoc(companyDocRef);
          
          if (companyDoc.exists()) {
            // User is a company
            setUserType('company');
            return;
          }
          
          // Check if user exists in users collection (private)
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            // User is a private user
            setUserType('private');
            return;
          }
          
          // If neither exists, default to private (for new users)
          setUserType('private');
          
        } catch (error) {
          console.error('Error detecting user type:', error);
          // Default to private if there's an error
          setUserType('private');
        }
      }
    });

    return () => unsubscribe();
  }, [userType, setUserType]);

  return null; // This component doesn't render anything
} 