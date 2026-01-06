import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User as FirebaseUser, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { User } from '../types';

export class AuthService {
  static async signIn(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  static async signUp(email: string, password: string, displayName: string): Promise<FirebaseUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile
      await updateProfile(user, {
        displayName: displayName,
      });

      // Create user document in Firestore
      await this.createUserDocument(user.uid, {
        id: user.uid,
        email: user.email!,
        displayName: displayName,
        role: 'employee', // Default role
        createdAt: new Date(),
      });

      return user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  static async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return null;

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  private static async createUserDocument(uid: string, userData: User): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, userData);
    } catch (error) {
      console.error('Error creating user document:', error);
      throw error;
    }
  }
}