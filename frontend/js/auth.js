// Google sign-in (Firebase) + the watchlist store.
// If firebase-config.js is empty, sign-in is switched off and the watchlist lives in this browser only.
import { firebaseConfig } from "../firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const LOCAL_KEY = "datavest.watchlist";

export const authConfigured = Boolean(firebaseConfig && firebaseConfig.apiKey);

let fb = null;
let user = null;
let watchlist = readLocal();
const userListeners = new Set();
const listListeners = new Set();

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
}
function writeLocal(list) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
}

const ready = (async () => {
  if (!authConfigured) return null;
  try {
    const [appM, authM, fsM] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = appM.initializeApp(firebaseConfig);
    fb = { auth: authM.getAuth(app), db: fsM.getFirestore(app), authM, fsM };
    await new Promise((resolve) => {
      authM.onAuthStateChanged(fb.auth, async (u) => {
        user = u;
        if (u) await syncFromCloud();
        userListeners.forEach((cb) => cb(user));
        resolve();
      });
    });
    return fb;
  } catch (err) {
    console.warn("Sign-in is unavailable:", err);
    return null;
  }
})();

async function syncFromCloud() {
  const { doc, getDoc, setDoc } = fb.fsM;
  const ref = doc(fb.db, "users", user.uid);
  try {
    const snap = await getDoc(ref);
    const cloud = snap.exists() ? snap.data().watchlist || [] : [];
    // Merge what was starred before signing in with what's saved to the account.
    const merged = [...new Set([...cloud, ...watchlist])];
    if (merged.length !== cloud.length) await setDoc(ref, { watchlist: merged }, { merge: true });
    setList(merged, false);
  } catch (err) {
    console.warn("Could not load your saved watchlist:", err);
  }
}

function setList(list, save = true) {
  watchlist = list;
  writeLocal(list);
  listListeners.forEach((cb) => cb(watchlist));
  if (save && user && fb) {
    const { doc, setDoc } = fb.fsM;
    setDoc(doc(fb.db, "users", user.uid), { watchlist: list }, { merge: true })
      .catch((err) => console.warn("Could not save your watchlist:", err));
  }
}

export function onUser(cb) {
  userListeners.add(cb);
  ready.then(() => cb(user));
}
export function onWatchlist(cb) {
  listListeners.add(cb);
  cb(watchlist);
}
export const getWatchlist = () => watchlist;
export const isWatched = (symbol) => watchlist.includes(symbol);
export function toggleWatch(symbol) {
  setList(isWatched(symbol) ? watchlist.filter((s) => s !== symbol) : [...watchlist, symbol]);
}

export async function signInWithGoogle() {
  await ready;
  if (!fb) throw new Error("Sign-in isn't switched on for this site yet.");
  const { GoogleAuthProvider, signInWithPopup } = fb.authM;
  return signInWithPopup(fb.auth, new GoogleAuthProvider());
}
export async function signOut() {
  await ready;
  if (fb) await fb.authM.signOut(fb.auth);
}
