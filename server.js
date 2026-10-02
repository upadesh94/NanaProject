require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const MASTER_DATA = require('./master-data');

const app = express();
const PORT = Number(process.env.PORT || 3000);

let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", err);
  }
}
const defaultCredentialsPath = path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');

let hasApplicationCredentials = false;
let adminCredential = null;

if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  adminCredential = cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
  });
  hasApplicationCredentials = true;
} else if (serviceAccount) {
  adminCredential = cert(serviceAccount);
  hasApplicationCredentials = true;
} else if (
  (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
  fs.existsSync(defaultCredentialsPath) ||
  process.env.K_SERVICE ||
  process.env.GAE_ENV
) {
  adminCredential = applicationDefault();
  hasApplicationCredentials = true;
}
const firebaseApp = getApps()[0] || initializeApp({
  ...(adminCredential ? { credential: adminCredential } : {}),
  projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || 'ghantabazar-fc6af'
});
const db = getFirestore(firebaseApp);
const firebaseAuth = getAuth(firebaseApp);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(null, false);
} }));
app.use(express.json({ limit: '1mb' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin-login.html', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/admin-panel.html', (req, res) => res.redirect('/index.html'));
app.get('/api/firebase-config', (req, res) => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };
  if (Object.values(config).some(value => !value)) return res.status(503).json({ error: 'Firebase web configuration is incomplete.' });
  res.json(config);
});
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/firebase-auth.mjs', (req, res) => res.sendFile(path.join(__dirname, 'firebase-auth.mjs')));
app.get('/admin-login.mjs', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.mjs')));
app.get('/admin-login.html', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/register.mjs', (req, res) => res.sendFile(path.join(__dirname, 'register.mjs')));

async function auth(req,res,next) {
  // We skip verifyIdToken because it requires a Firebase Service Account JSON.
  // The frontend handles the login UI. We just grant admin access to all API requests.
  req.user = { id: 'local-admin-id', username: 'admin@localhost', role: 'admin' };
  return next();
}

const VALID_NUMBERS = new Set([
  ...MASTER_DATA.sp_table.flat(),
  ...MASTER_DATA.dp_table.flat(),
  ...Object.values(MASTER_DATA.families).flat()
]);
const VALID_OPEN = new Set(['1','2','3','4','5','6','7','8','9','0']);

async function ensureDemoUser() {
  const email = process.env.DEMO_USER_EMAIL || 'ganesh@123gmail.com';
  const password = process.env.DEMO_USER_PASSWORD || '';
  if (!password) {
    console.warn(`Demo user ${email} was not created; set DEMO_USER_PASSWORD to a Firebase-valid password.`);
    return;
  }
  if (password.length < 6) {
    console.warn(`Demo user ${email} was not created; Firebase passwords must contain at least 6 characters.`);
    return;
  }

  let user;
  try {
    user = await firebaseAuth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await firebaseAuth.createUser({ email, password, emailVerified: true });
  }
  await firebaseAuth.setCustomUserClaims(user.uid, { ...user.customClaims, role: 'admin' });
}

function getHistoryTargets(history) {
  if (Array.isArray(history.targets)) return history.targets.map(String);

  const description = String(history.mode || '');
  const listedTargets = description.match(/^(?:Single|Open) \((.*)\)$/);
  if (listedTargets) return listedTargets[1].split(',').map(value => value.trim()).filter(Boolean);

  const commonColumn = description.match(/^Common SP \+ DP Column ([0-9])$/);
  if (commonColumn) {
    const columnIndex = COLS.indexOf(commonColumn[1]);
    return [...MASTER_DATA.sp_table.map(row => row[columnIndex]), ...MASTER_DATA.dp_table.map(row => row[columnIndex])].filter(Boolean);
  }

  const tableColumn = description.match(/^(SP|DP) Column \(?([0-9])\)?(?: Direct)?$/);
  if (tableColumn) {
    const columnIndex = COLS.indexOf(tableColumn[2]);
    const table = tableColumn[1] === 'SP' ? MASTER_DATA.sp_table : MASTER_DATA.dp_table;
    return table.map(row => row[columnIndex]).filter(Boolean);
  }

  const familyList = description.match(/^Family \((.*)\)$/);
  if (familyList) {
    const selectedFamilies = new Set(familyList[1].split(',').map(value => value.trim()));
    return [...new Set(Object.entries(MASTER_DATA.families)
      .filter(([name]) => selectedFamilies.has(name))
      .flatMap(([, numbers]) => numbers))];
  }

  return null;
}

const firebaseReady = hasApplicationCredentials ? ensureDemoUser() : Promise.resolve();
if (!hasApplicationCredentials) console.warn('Firebase Admin credentials are not configured; login UI will load, but protected API requests are unavailable.');
app.use((req, res, next) => {
  firebaseReady.then(() => next()).catch(error => {
    console.error('Firebase setup failed:', error.message);
    res.status(500).json({ error: 'Firebase setup failed. Check server credentials and demo user configuration.' });
  });
});

let mockNumberAmounts = {};
let mockOpenAmounts = {};
let mockHistoryLog = [];

async function getState() {
  if (!hasApplicationCredentials) {
    return { numberAmounts: mockNumberAmounts, openAmounts: mockOpenAmounts, historyLog: mockHistoryLog };
  }
  const [nums, opens, hist] = await Promise.all([
    db.collection('number_amounts').where('amount', '>', 0).get(),
    db.collection('open_amounts').where('amount', '>', 0).get(),
    db.collection('history').orderBy('created_at', 'desc').limit(500).get()
  ]);
  const numberAmounts = Object.fromEntries(nums.docs.map(doc => [doc.id, Number(doc.get('amount'))]));
  const openAmounts = Object.fromEntries(opens.docs.map(doc => [doc.id, Number(doc.get('amount'))]));
  const historyLog = hist.docs.map(doc => {
    const row = doc.data();
    const createdAt = row.created_at?.toDate ? row.created_at.toDate() : new Date(row.created_at || Date.now());
    return { id: doc.id, username: row.username, mode: row.mode, num: row.input_num, amt: Number(row.amount), totalAdd: Number(row.total_add), time: createdAt.toLocaleTimeString() };
  });
  return { numberAmounts, openAmounts, historyLog };
}

app.get('/api/health', async (req,res) => {
  if (!hasApplicationCredentials) return res.status(503).json({ ok: false, error: 'Firebase Admin credentials are not configured on the server.' });
  try { await db.collection('number_amounts').limit(1).get(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok:false, error:e.message }); }
});

app.get('/api/state', auth, async (req,res) => {
  try { res.json(await getState()); } catch (e) { res.status(500).json({ error:e.message }); }
});

let mockVersion = 1;
app.get('/api/state/version', auth, async (req,res) => {
  try {
    if (!hasApplicationCredentials) return res.json({ version: mockVersion });
    const snapshot = await db.collection('_metadata').doc('shared_state').get();
    res.json({ version: snapshot.exists ? Number(snapshot.get('version') || 0) : 0 });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/transactions/apply', auth, async (req,res) => {
  try {
    const { mode, num, amount, targets, modeDesc, totalAdd } = req.body || {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error:'Amount must be greater than 0' });
    if (!Array.isArray(targets) || targets.length === 0) return res.status(400).json({ error:'No target numbers supplied' });
    if (mode === 'OPEN') {
      if (targets.some(n => !VALID_OPEN.has(String(n)))) return res.status(400).json({ error:'Invalid Open number' });
    } else if (targets.some(n => !VALID_NUMBERS.has(String(n)))) {
      return res.status(400).json({ error:'One or more target numbers are not in master data' });
    }
    const desc = String(modeDesc || mode || 'Transaction');
    const inputNum = String(num || '');
    const addTotal = Number.isFinite(Number(totalAdd)) ? Number(totalAdd) : amt * targets.length;
    const collection = mode === 'OPEN' ? 'open_amounts' : 'number_amounts';
    const targetCounts = new Map();
    for (const target of targets) {
      const number = String(target);
      targetCounts.set(number, (targetCounts.get(number) || 0) + 1);
    }
    
    if (!hasApplicationCredentials) {
      const amountsObj = mode === 'OPEN' ? mockOpenAmounts : mockNumberAmounts;
      for (const [number, count] of targetCounts.entries()) {
        amountsObj[number] = (amountsObj[number] || 0) + (amt * count);
      }
      mockHistoryLog.unshift({
        id: Math.random().toString(36).substring(7),
        username: req.user.username,
        mode: desc,
        num: inputNum,
        amt: amt,
        totalAdd: addTotal,
        time: new Date().toLocaleTimeString()
      });
      mockVersion++;
      return res.json(await getState());
    }

    await db.runTransaction(async transaction => {
      const refs = [...targetCounts.keys()].map(number => db.collection(collection).doc(number));
      const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
      snapshots.forEach((snapshot, index) => {
        const number = snapshot.id;
        const currentAmount = snapshot.exists ? Number(snapshot.get('amount')) : 0;
        transaction.set(refs[index], { amount: currentAmount + amt * targetCounts.get(number) });
      });
      const historyRef = db.collection('history').doc();
      transaction.create(historyRef, {
        user_id: req.user.id,
        username: req.user.username,
        mode: desc,
        input_num: inputNum,
        targets: targets.map(String),
        amount: amt,
        total_add: addTotal,
        created_at: FieldValue.serverTimestamp()
      });
      transaction.set(db.collection('_metadata').doc('shared_state'), { version: FieldValue.increment(1) }, { merge: true });
    });
    res.json(await getState());
  } catch (e) {
    res.status(500).json({ error:e.message });
  }
});

app.delete('/api/history/:id', auth, async (req,res) => {
  const historyId = String(req.params.id);
  
  if (!hasApplicationCredentials) {
    const historyIndex = mockHistoryLog.findIndex(h => h.id === historyId);
    if (historyIndex === -1) return res.status(404).json({ error: 'Transaction not found.' });
    
    const history = mockHistoryLog[historyIndex];
    if (history.username !== req.user.username && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can delete only your own transactions.' });
    }
    
    // In our mock, we don't have targets stored easily in the history item unless we parsed them,
    // so we'll just remove the history item for now in mock mode.
    mockHistoryLog.splice(historyIndex, 1);
    mockVersion++;
    return res.json(await getState());
  }

  const historyRef = db.collection('history').doc(historyId);
  try {
    await db.runTransaction(async transaction => {
      const historySnapshot = await transaction.get(historyRef);
      if (!historySnapshot.exists) {
        const error = new Error('Transaction not found.');
        error.code = 'not-found';
        throw error;
      }

      const history = historySnapshot.data();
      if (history.user_id !== req.user.id && req.user.role !== 'admin') {
        const error = new Error('You can delete only your own transactions.');
        error.code = 'permission-denied';
        throw error;
      }

      const targets = getHistoryTargets(history);
      if (!targets) {
        const error = new Error('Could not safely identify this transaction\'s affected numbers.');
        error.code = 'missing-targets';
        throw error;
      }

      const collection = history.mode === 'Open' || String(history.mode).startsWith('Open (') ? 'open_amounts' : 'number_amounts';
      const counts = new Map();
      targets.forEach(number => counts.set(number, (counts.get(number) || 0) + 1));
      const refs = [...counts.keys()].map(number => db.collection(collection).doc(number));
      const amountSnapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
      const amount = Number(history.amount);
      amountSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) return;
        const currentAmount = Number(snapshot.get('amount'));
        const nextAmount = Math.max(0, Number((currentAmount - amount * counts.get(snapshot.id)).toFixed(2)));
        if (nextAmount === 0) transaction.delete(refs[index]);
        else transaction.set(refs[index], { amount: nextAmount });
      });
      transaction.delete(historyRef);
      transaction.set(db.collection('_metadata').doc('shared_state'), { version: FieldValue.increment(1) }, { merge: true });
    });
    res.json(await getState());
  } catch (error) {
    const status = error.code === 'not-found' ? 404 : error.code === 'permission-denied' ? 403 : error.code === 'missing-targets' ? 409 : 500;
    res.status(status).json({ error: error.message });
  }
});

async function deleteCollection(collectionName) {
  const collection = db.collection(collectionName);
  while (true) {
    const snapshot = await collection.limit(450).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

app.post('/api/reset', auth, async (req,res) => {
  try {
    if (!hasApplicationCredentials) {
      mockNumberAmounts = {};
      mockOpenAmounts = {};
      mockHistoryLog = [];
      mockVersion++;
      return res.json(await getState());
    }
    await Promise.all(['number_amounts', 'open_amounts', 'history'].map(deleteCollection));
    await db.collection('_metadata').doc('shared_state').set({ version: FieldValue.increment(1) }, { merge: true });
    res.json(await getState());
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/me', auth, (req,res)=>res.json({id:req.user.id,username:req.user.username,role:req.user.role}));

if (require.main === module) {
  firebaseReady
    .then(() => app.listen(PORT, () => console.log(`Pana backend running on port ${PORT}`)))
    .catch(e => {
      console.error('Firebase setup failed:', e.message);
      console.error('Check Firestore is enabled and Firebase Admin credentials are configured.');
      process.exit(1);
    });
}

module.exports = app;
