import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useUserType } from './UserTypeContext';

export default function UserTypeDetector() {
  const { userType, setUserType } = useUserType();

  useEffect(() => {
    console.log('🔍 UserTypeDetector: Component mounted, current userType:', userType);
    
    // Check if user is already authenticated when component mounts
    const currentUser = getAuth().currentUser;
    console.log('🔍 UserTypeDetector: Current user on mount:', currentUser ? currentUser.uid : 'No user');
    
    if (currentUser && !userType) {
      console.log('🔍 UserTypeDetector: User already authenticated on mount, detecting type...');
      detectUserType(currentUser);
    } else if (currentUser && userType) {
      console.log('🔍 UserTypeDetector: User already authenticated and userType set:', userType);
    } else {
      console.log('🔍 UserTypeDetector: No user on mount');
    }
    
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      console.log('🔍 UserTypeDetector: Auth state changed:', user ? 'User logged in' : 'No user');
      if (user) {
        console.log('🔍 UserTypeDetector: User details - UID:', user.uid, 'Email:', user.email);
      }
      
      if (user && !userType) {
        console.log('🔍 UserTypeDetector: User logged in but userType not set, detecting...');
        detectUserType(user);
      } else if (user && userType) {
        console.log('🔍 UserTypeDetector: User logged in and userType already set:', userType);
      } else if (!user) {
        console.log('🔍 UserTypeDetector: No user, clearing userType');
        setUserType(null);
      }
    });

    return () => {
      console.log('🔍 UserTypeDetector: Cleaning up auth listener');
      unsubscribe();
    };
  }, [userType, setUserType]);

  async function detectUserType(user) {
    try {
      console.log('🔍 UserTypeDetector: Starting user type detection for user:', user.uid);
      
      // Check if user exists in Club_Bar_Festival_profiles (company)
      console.log('🔍 UserTypeDetector: Checking Club_Bar_Festival_profiles...');
      const companyDocRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
      const companyDoc = await getDoc(companyDocRef);
      console.log('🔍 UserTypeDetector: Company doc exists:', companyDoc.exists());
      
      if (companyDoc.exists()) {
        // User is a company
        console.log('🔍 UserTypeDetector: Setting userType to company');
        setUserType('company');
        return;
      }
      
      // Check if user exists in profiles collection (private)
      console.log('🔍 UserTypeDetector: Checking profiles collection...');
      const userDocRef = doc(db, 'profiles', user.uid);
      const userDoc = await getDoc(userDocRef);
      console.log('🔍 UserTypeDetector: User doc exists:', userDoc.exists());
      
      if (userDoc.exists()) {
        // User is a private user
        console.log('🔍 UserTypeDetector: Setting userType to private');
        setUserType('private');
        return;
      }
      
      // If neither exists, default to private (for new users)
      console.log('🔍 UserTypeDetector: No docs found, defaulting to private');
      setUserType('private');
      
    } catch (error) {
      console.error('🔍 UserTypeDetector: Error detecting user type:', error);
      console.error('🔍 UserTypeDetector: Error details:', error.code, error.message);
      // Default to private if there's an error
      setUserType('private');
    }
  }

  return null; // This component doesn't render anything
} 