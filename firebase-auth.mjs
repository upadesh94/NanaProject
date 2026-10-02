import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js';
import {
  browserSessionPersistence,
  getAuth,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';

const configResponse = await fetch('/api/firebase-config');
if (!configResponse.ok) throw new Error('Firebase web configuration is unavailable.');
const firebaseConfig = await configResponse.json();

const firebaseApp = initializeApp(firebaseConfig);
const analytics = getAnalytics(firebaseApp);
const auth = getAuth(firebaseApp);
await setPersistence(auth, browserSessionPersistence);
const usernameEmail = username => `${username.trim().toLowerCase()}@users.${firebaseConfig.projectId}.firebaseapp.com`;

window.firebaseSignIn = async (identifier, password) => {
  const email = identifier.includes('@') ? identifier.trim() : usernameEmail(identifier);
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};
window.firebaseSignUp = async (email, password) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
};
window.firebaseSignUpUsername = async (username, password) => {
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalizedUsername) || normalizedUsername.includes('..') || normalizedUsername.endsWith('.')) {
    throw new Error('Use 3-30 letters, numbers, dots, underscores or hyphens for the username.');
  }
  const result = await createUserWithEmailAndPassword(auth, usernameEmail(normalizedUsername), password);
  await updateProfile(result.user, { displayName: normalizedUsername });
  return result.user;
};
window.firebaseSignOut = () => signOut(auth);
window.firebaseSendPasswordResetEmail = identifier => {
  if (!identifier.includes('@')) throw new Error('Enter the email address registered with Firebase to reset its password.');
  return sendPasswordResetEmail(auth, identifier.trim());
};
window.firebaseOnAuthStateChanged = callback => onIdTokenChanged(auth, callback);
