import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js';
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

let firebaseConfig = {
  apiKey: "AIzaSyA3rJ4aQemAe_ITR_dftDdmPf11A6jLgTE",
  authDomain: "attendenceapp-209e9.firebaseapp.com",
  projectId: "attendenceapp-209e9",
  storageBucket: "attendenceapp-209e9.firebasestorage.app",
  messagingSenderId: "107409632890",
  appId: "1:107409632890:web:5c2e5a83a3bf791e1a15c3",
  measurementId: "G-Y4ZX678GBF"
};

try {
  const configResponse = await fetch('/api/firebase-config');
  if (configResponse.ok) {
    const remoteConfig = await configResponse.json();
    if (remoteConfig && remoteConfig.apiKey) {
      firebaseConfig = { ...firebaseConfig, ...remoteConfig };
    }
  }
} catch (e) {
  console.warn('Could not fetch remote Firebase config, using default config:', e);
}

const firebaseApp = initializeApp(firebaseConfig);

try {
  if (await isAnalyticsSupported()) {
    getAnalytics(firebaseApp);
  }
} catch (e) {
  // Analytics optional
}

const auth = getAuth(firebaseApp);
try {
  await setPersistence(auth, browserSessionPersistence);
} catch (e) {
  console.warn('Failed to set persistence:', e);
}

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
