require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const MASTER_DATA = require('./master-data');

// Prevent unexpected process terminations
process.on('uncaughtException', (err) => {
  console.error('Unhandled process error:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// Safely load firebase-admin without crashing older or mismatched Node environments
let firebaseAdminApp = null;
let firebaseAdminFirestore = null;
let firebaseAdminAuth = null;

try {
  firebaseAdminApp = require('firebase-admin/app');
  firebaseAdminFirestore = require('firebase-admin/firestore');
  firebaseAdminAuth = require('firebase-admin/auth');
} catch (err) {
  console.warn('firebase-admin not loaded, running in pure mock/memory mode:', err.message);
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const COLS = ['1','2','3','4','5','6','7','8','9','0'];
const OPEN_NUMBERS = ['1','2','3','4','5','6','7','8','9','0'];

// Read static assets into memory so they are bundled by @vercel/nft and served instantly
let adminLoginHtml = '';
let indexHtml = '';
let firebaseAuthMjs = '';
let scriptJs = '';
let adminLoginMjs = '';

try {
  adminLoginHtml = fs.readFileSync(path.join(__dirname, 'admin-login.html'), 'utf8');
} catch (e) {
  console.error("Could not read admin-login.html:", e.message);
}

try {
  indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
} catch (e) {
  console.error("Could not read index.html:", e.message);
}

try {
  firebaseAuthMjs = fs.readFileSync(path.join(__dirname, 'firebase-auth.mjs'), 'utf8');
} catch (e) {
  console.error("Could not read firebase-auth.mjs:", e.message);
}

try {
  scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
} catch (e) {
  console.error("Could not read script.js:", e.message);
}

try {
  adminLoginMjs = fs.readFileSync(path.join(__dirname, 'admin-login.mjs'), 'utf8');
} catch (e) {
  console.error("Could not read admin-login.mjs:", e.message);
}

// Firebase Admin setup with fallbacks
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

if (firebaseAdminApp) {
  try {
    const { applicationDefault, cert } = firebaseAdminApp;
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      adminCredential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      });
      hasApplicationCredentials = true;
    } else if (serviceAccount && serviceAccount.project_id) {
      adminCredential = cert(serviceAccount);
      hasApplicationCredentials = true;
    } else if (
      (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
      (defaultCredentialsPath && fs.existsSync(defaultCredentialsPath))
    ) {
      adminCredential = applicationDefault();
      hasApplicationCredentials = true;
    }
  } catch (err) {
    console.error("Firebase Admin credential initialization failed:", err.message);
    adminCredential = null;
    hasApplicationCredentials = false;
  }
}

let firebaseApp = null;
let db = null;
let firebaseAuth = null;

if (hasApplicationCredentials && firebaseAdminApp && firebaseAdminFirestore) {
  try {
    const { getApps, initializeApp } = firebaseAdminApp;
    const { getFirestore } = firebaseAdminFirestore;
    const { getAuth } = firebaseAdminAuth || {};

    firebaseApp = getApps()[0] || initializeApp({
      credential: adminCredential,
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || 'attendenceapp-209e9'
    });
    db = getFirestore(firebaseApp);
    if (getAuth) firebaseAuth = getAuth(firebaseApp);
  } catch (err) {
    console.error("Firebase services initialization failed:", err.message);
    hasApplicationCredentials = false;
  }
}

// Robust CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('localhost')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

function sendStatic(res, filename, mimeType, fallbackContent) {
  res.setHeader('Content-Type', mimeType);
  try {
    const content = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    return res.send(content);
  } catch (e) {
    return res.send(fallbackContent);
  }
}

// Static Asset Routes
app.get('/admin-login.html', (req, res) => sendStatic(res, 'admin-login.html', 'text/html; charset=utf-8', adminLoginHtml));
app.get('/login', (req, res) => sendStatic(res, 'admin-login.html', 'text/html; charset=utf-8', adminLoginHtml));
app.get('/admin-login', (req, res) => sendStatic(res, 'admin-login.html', 'text/html; charset=utf-8', adminLoginHtml));
app.get('/index.html', (req, res) => sendStatic(res, 'index.html', 'text/html; charset=utf-8', indexHtml));
app.get('/', (req, res) => sendStatic(res, 'index.html', 'text/html; charset=utf-8', indexHtml));
app.get('/firebase-auth.mjs', (req, res) => sendStatic(res, 'firebase-auth.mjs', 'application/javascript; charset=utf-8', firebaseAuthMjs));
app.get('/script.js', (req, res) => sendStatic(res, 'script.js', 'application/javascript; charset=utf-8', scriptJs));
app.get('/admin-login.mjs', (req, res) => sendStatic(res, 'admin-login.mjs', 'application/javascript; charset=utf-8', adminLoginMjs));

// Middleware for auth
async function auth(req, res, next) {
  req.user = { id: 'local-admin-id', username: 'admin@localhost', role: 'admin' };
  return next();
}

const VALID_NUMBERS = new Set([
  ...MASTER_DATA.sp_table.flat(),
  ...MASTER_DATA.dp_table.flat(),
  ...Object.values(MASTER_DATA.families).flat()
]);
const VALID_OPEN = new Set(['1','2','3','4','5','6','7','8','9','0']);

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

const stateDir = path.join(__dirname, 'data');
const stateFilePath = path.join(stateDir, 'shared_state.json');

let mockNumberAmounts = {};
let mockOpenAmounts = {};
let mockHistoryLog = [];

try {
  if (fs.existsSync(stateFilePath)) {
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    mockNumberAmounts = parsed.numberAmounts || {};
    mockOpenAmounts = parsed.openAmounts || {};
    mockHistoryLog = parsed.historyLog || [];
  }
} catch (e) {
  console.warn("Could not load local shared_state.json:", e.message);
}

function saveLocalState() {
  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(stateFilePath, JSON.stringify({
      numberAmounts: mockNumberAmounts,
      openAmounts: mockOpenAmounts,
      historyLog: mockHistoryLog,
      updated_at: new Date().toISOString()
    }, null, 2));
  } catch (e) {
    console.warn("Could not save to shared_state.json:", e.message);
  }
}

async function getState() {
  if (!hasApplicationCredentials || !db) {
    return { numberAmounts: mockNumberAmounts, openAmounts: mockOpenAmounts, historyLog: mockHistoryLog };
  }
  try {
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
  } catch (err) {
    console.warn('getState Firestore read error, using mock state:', err.message);
    return { numberAmounts: mockNumberAmounts, openAmounts: mockOpenAmounts, historyLog: mockHistoryLog };
  }
}

// API Endpoints Router
const apiRouter = express.Router();

apiRouter.get('/firebase-config', (req, res) => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyA3rJ4aQemAe_ITR_dftDdmPf11A6jLgTE',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'attendenceapp-209e9.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'attendenceapp-209e9',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'attendenceapp-209e9.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '107409632890',
    appId: process.env.FIREBASE_APP_ID || '1:107409632890:web:5c2e5a83a3bf791e1a15c3',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-Y4ZX678GBF'
  };
  res.json(config);
});

apiRouter.get('/health', async (req, res) => {
  if (!hasApplicationCredentials || !db) {
    return res.json({ ok: true, mode: 'mock' });
  }
  try {
    await db.collection('number_amounts').limit(1).get();
    res.json({ ok: true, mode: 'firestore' });
  } catch (e) {
    res.json({ ok: true, mode: 'mock_fallback', error: e.message });
  }
});

apiRouter.get('/state', auth, async (req, res) => {
  try {
    res.json(await getState());
  } catch (e) {
    res.json({ numberAmounts: mockNumberAmounts, openAmounts: mockOpenAmounts, historyLog: mockHistoryLog });
  }
});

let mockVersion = 1;
apiRouter.get('/state/version', auth, async (req, res) => {
  try {
    if (!hasApplicationCredentials || !db) return res.json({ version: mockVersion });
    const snapshot = await db.collection('_metadata').doc('shared_state').get();
    res.json({ version: snapshot.exists ? Number(snapshot.get('version') || 0) : 0 });
  } catch (e) {
    res.json({ version: mockVersion });
  }
});

apiRouter.post('/transactions/apply', auth, async (req, res) => {
  try {
    const { mode, num, amount, targets, modeDesc, totalAdd } = req.body || {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });
    if (!Array.isArray(targets) || targets.length === 0) return res.status(400).json({ error: 'No target numbers supplied' });
    if (mode === 'OPEN') {
      if (targets.some(n => !VALID_OPEN.has(String(n)))) return res.status(400).json({ error: 'Invalid Open number' });
    } else if (targets.some(n => !VALID_NUMBERS.has(String(n)))) {
      return res.status(400).json({ error: 'One or more target numbers are not in master data' });
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
    
    if (!hasApplicationCredentials || !db) {
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
      saveLocalState();
      return res.json(await getState());
    }

    const FieldValue = firebaseAdminFirestore.FieldValue;
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
    res.status(500).json({ error: e.message });
  }
});

apiRouter.delete('/history/:id', auth, async (req, res) => {
  const historyId = String(req.params.id);
  
  if (!hasApplicationCredentials || !db) {
    const historyIndex = mockHistoryLog.findIndex(h => h.id === historyId);
    if (historyIndex === -1) return res.status(404).json({ error: 'Transaction not found.' });
    
    const history = mockHistoryLog[historyIndex];
    if (history.username !== req.user.username && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can delete only your own transactions.' });
    }
    
    mockHistoryLog.splice(historyIndex, 1);
    mockVersion++;
    saveLocalState();
    return res.json(await getState());
  }

  const FieldValue = firebaseAdminFirestore.FieldValue;
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
  if (!db) return;
  const collection = db.collection(collectionName);
  while (true) {
    const snapshot = await collection.limit(450).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

apiRouter.post('/reset', auth, async (req, res) => {
  try {
    if (!hasApplicationCredentials || !db) {
      mockNumberAmounts = {};
      mockOpenAmounts = {};
      mockHistoryLog = [];
      mockVersion++;
      saveLocalState();
      return res.json(await getState());
    }
    const FieldValue = firebaseAdminFirestore.FieldValue;
    await Promise.all(['number_amounts', 'open_amounts', 'history'].map(deleteCollection));
    await db.collection('_metadata').doc('shared_state').set({ version: FieldValue.increment(1) }, { merge: true });
    res.json(await getState());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.get('/me', auth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// Mount API router on both /api and root
app.use('/api', apiRouter);
app.use(apiRouter);

// Fallback for any other GET requests to admin login page
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(adminLoginHtml);
  }
  next();
});

// Global Express error handler
app.use((err, req, res, next) => {
  console.error("Unhandled express error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Wrapper handler for Vercel
const handler = (req, res) => {
  try {
    return app(req, res);
  } catch (err) {
    console.error("Top-level invocation error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>Server Error</h1><pre>${err.message}\n${err.stack}</pre>`);
    }
  }
};

// Start persistent server ONLY when run directly locally
if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, () => console.log(`Pana backend running on port ${PORT}`));
}

module.exports = handler;
module.exports.default = handler;
