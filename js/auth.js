import { auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Login Function
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user role from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Store user data in sessionStorage
      sessionStorage.setItem('userRole', userData.role);
      sessionStorage.setItem('userEmail', userData.email);
      sessionStorage.setItem('userId', user.uid);
      
      return { success: true, role: userData.role };
    } else {
      throw new Error('User data not found in database');
    }
  } catch (error) {
    console.error('Login error:', error);
    let errorMessage = 'Login gagal';
    
    if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Email atau password salah';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'User tidak ditemukan';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Password salah';
    }
    
    return { success: false, error: errorMessage };
  }
}

// Logout Function
export async function logout() {
  try {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Gagal logout: ' + error.message);
  }
}

// Check Authentication
export function checkAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Verify user role exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        sessionStorage.setItem('userRole', userData.role);
        sessionStorage.setItem('userEmail', userData.email);
        callback(user, userData);
      } else {
        // User authenticated but no data in Firestore
        await signOut(auth);
        window.location.href = 'login.html';
      }
    } else {
      window.location.href = 'login.html';
    }
  });
}

// Get Current User Role
export function getUserRole() {
  return sessionStorage.getItem('userRole');
}

// Get Current User Email
export function getUserEmail() {
  return sessionStorage.getItem('userEmail');
}

// Check if user is admin
export function isAdmin() {
  return getUserRole() === 'admin';
}