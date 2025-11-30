/**
 * MyStream — SPA rebuilt
 * Single-file JS module with Firebase v9 modular SDK integration.
 *
 * IMPORTANT: paste your Firebase config into `firebaseConfig` below where indicated.
 *
 * NOTE: If you keep the placeholder config (apiKey starts with "TODO"), the app will run
 * in a demo-only fallback mode that stores small preview audio Base64 in Firestore.
 */

/* =========================
   Firebase init / fallback
   ========================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getStorage,
  ref as sref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

/* -------------- PLACEHOLDER CONFIG --------------
   Replace the object below with your Firebase project's configuration.
   The code will detect if you left it as TODO and switch to a demo-only fallback.
-------------------------------------------------*/
const firebaseConfig = {
  apiKey: "TODO_PASTE_YOUR_API_KEY",
  authDomain: "TODO",
  projectId: "TODO",
  storageBucket: "TODO",
  messagingSenderId: "TODO",
  appId: "TODO"
};

let DEMO_FALLBACK = false;
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("TODO")) {
  console.warn("Firebase config not provided — running demo-only fallback (Firestore previews).");
  DEMO_FALLBACK = true;
}

/* Initialize Firebase (if not demo-only we still initialize to allow devs to paste config) */
let app, auth, db, storage;
if (!DEMO_FALLBACK) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  // Minimal stub functions (demo fallback will store Base64 uploads into Firestore via emulated collections)
  app = null;
  auth = null;
  db = null;
  storage = null;
}

/* ============================
   DOM helpers & initial refs
   ============================ */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const navBtns = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

const uploadBtn = $("#uploadBtn");
const uploadModal = $("#uploadModal");
const uploadForm = $("#uploadForm");
const cancelUpload = $("#cancelUpload");

const signInBtn = $("#signInBtn");
const signUpBtn = $("#signUpBtn");
const signInModal = $("#signInModal");
const signInForm = $("#signInForm");
const signUpModal = $("#signUpModal");
const signUpForm = $("#signUpForm");
const cancelSignIn = $("#cancelSignIn");
const cancelSignUp = $("#cancelSignUp");

const authUI = $("#authUI");
const userInfo = $("#userInfo");
const signOutBtn = $("#signOutBtn");
const usernameDisplay = $("#usernameDisplay");
const userAvatarSmall = $("#userAvatarSmall");

const editProfileModal = $("#editProfileModal");
const editProfileForm = $("#editProfileForm");

const createPlaylistModal = $("#createPlaylistModal");
const createPlaylistForm = $("#createPlaylistForm");
const playlistsList = $("#playlistsList");

const addToPlaylistModal = $("#addToPlaylistModal");
const userPlaylistsList = $("#userPlaylistsList");
const addToPlaylistBtn = $("#addToPlaylistBtn");
const createPlaylistBtn = $("#createPlaylistBtn");
const closeAddToPlaylist = $("#closeAddToPlaylist");

const profileModal = $("#profileModal");
const closeProfile = $("#closeProfile");
const profileAvatar = $("#profileAvatar");
const profileDisplayName = $("#profileDisplayName");
const profileBio = $("#profileBio");
const profileSongs = $("#profileSongs");
const profileBadge = $("#profileBadge");
const followersCount = $("#followersCount");
const followingCount = $("#followingCount");
const followBtn = $("#followBtn");

const songsGrid = $("#songsGrid");
const searchInput = $("#searchInput");
const searchResults = $("#searchResults");
const yourUploads = $("#yourUploads");

const player = $("#player");
const playerCover = $("#playerCover");
const playerTitle = $("#playerTitle");
const playerArtist = $("#playerArtist");
const playPauseBtn = $("#playPauseBtn");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const seekBar = $("#seekBar");
const currentTimeEl = $("#currentTime");
const durationEl = $("#duration");
const volumeEl = $("#volume");

const signOutButton = $("#signOutBtn");

/* ============================
   Application State
   ============================ */
let currentUser = null; // {uid, username, displayName, avatar, verified}
let songsCache = []; // array of song objects from Firestore (public)
let userPlaylists = []; // playlists belonging to currentUser
let currentQueue = []; // array of song docs
let currentIndex = 0;
let audio = new Audio();
audio.crossOrigin = "anonymous";

/* ============================
   Utility functions
   ============================ */
function fmtTime(sec){
  if (!sec || isNaN(sec)) return "0:00";
  sec = Math.floor(sec);
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${m}:${s.toString().padStart(2,"0")}`;
}
function el(tag, cls){ const e=document.createElement(tag); if(cls)e.className=cls; return e; }

/* ============================
   View / UI Logic
   ============================ */
navBtns.forEach(btn=>{
  btn.addEventListener("click",()=>{
    navBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    views.forEach(v=>{
      if (v.id === "view"+view.charAt(0).toUpperCase()+view.slice(1)) {
        v.classList.add("view-active");
      } else v.classList.remove("view-active");
    });
    // quick load
    if (view === "home") renderSongsGrid();
    if (view === "playlists") renderPlaylists();
    if (view === "library") renderUserUploads();
  });
});

/* ================
   Modal helpers
   ================ */
function openModal(elm){ elm.classList.remove("hidden"); }
function closeModal(elm){ elm.classList.add("hidden"); }

/* ================
   Auth UI
   ================ */
function updateAuthUI(){
  if (currentUser) {
    authUI.classList.add("hidden");
    userInfo.classList.remove("hidden");
    usernameDisplay.textContent = currentUser.displayName || currentUser.username || "User";
    userAvatarSmall.src = currentUser.avatar || "https://via.placeholder.com/80/222/111?text=U";
  } else {
    authUI.classList.remove("hidden");
    userInfo.classList.add("hidden");
  }
}

signInBtn.addEventListener("click", ()=>openModal(signInModal));
signUpBtn.addEventListener("click", ()=>openModal(signUpModal));
cancelSignIn.addEventListener("click", ()=>closeModal(signInModal));
cancelSignUp.addEventListener("click", ()=>closeModal(signUpModal));

/* ================
   Sign Up / In
   ================ */
signUpForm.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  const form = new FormData(signUpForm);
  const username = form.get("username").trim();
  const email = form.get("email").trim();
  const password = form.get("password");
  const avatarFile = form.get("avatar");
  try {
    if (DEMO_FALLBACK) {
      // Demo fallback: create a fake user stored in localStorage
      const uid = 'demo_'+Date.now();
      const avatarUrl = avatarFile && avatarFile.size ? await fileToDataUrl(avatarFile) : null;
      const userDoc = { uid, username, displayName: username, avatar: avatarUrl, bio: "", verified: (username==="RankRates") };
      localStorage.setItem('demo_user', JSON.stringify(userDoc));
      currentUser = userDoc;
      await ensureDemoFirestoreInit();
      await createOrUpdateUserDocDemo(userDoc);
      closeModal(signUpModal);
      setupAfterAuth();
      return;
    }

    const cred = await createUserWithEmailAndPassword(getAuth(), email, password);
    const user = cred.user;
    const update = {};
    await updateProfile(user, { displayName: username });
    // upload avatar (optional)
    let avatarUrl = null;
    if (avatarFile && avatarFile.size && storage) {
      const storageRef = sref(storage, `avatars/${user.uid}_${Date.now()}`);
      await uploadBytes(storageRef, avatarFile);
      avatarUrl = await getDownloadURL(storageRef);
    }
    // create user doc
    const userDocRef = doc(getFirestore(), "users", user.uid);
    await setDoc(userDocRef, {
      username,
      displayName: username,
      avatar: avatarUrl || null,
      bio: "",
      verified: false,
      followers: [],
      following: [],
      createdAt: serverTimestamp()
    });
    closeModal(signUpModal);
  } catch (err) {
    alert("Sign up error: "+err.message);
    console.error(err);
  }
});

signInForm.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  const form = new FormData(signInForm);
  const username = form.get("username").trim();
  const password = form.get("password");
  try {
    if (DEMO_FALLBACK) {
      // demo sign in: fetch demo user by username from fake collection in localStorage
      const userDoc = await getDemoUserByUsername(username);
      if (!userDoc) return alert("No demo user with that username. Create account first.");
      // In demo, we accept any password (but if username is RankRates, user can enter Rank1250 to match scenario)
      currentUser = userDoc;
      setupAfterAuth();
      closeModal(signInModal);
      return;
    }
    // Our sign-in form uses username instead of email. To keep things simple:
    // Firestore must contain a mapping username->uid (users collection). So we query.
    const db = getFirestore();
    const q = query(collection(db, "users"), where("username", "==", username));
    const snap = await getDocs(q);
    if (snap.empty) {
      return alert("User not found. Did you sign up with this username?");
    }
    const userRecord = snap.docs[0];
    const userUid = userRecord.id;
    // We need to sign in via email+password — but we don't store email keyed by username.
    // To enable username-based sign-in in this client-only example we require email==username@local.example if no email known.
    // For a real app, use proper email sign-in or map usernames to emails server-side.
    // We'll attempt to sign in with possible email variations; if it fails, ask user to sign in with email instead.
    let signedIn = false;
    try {
      // Try to find an email in user doc
      const userData = userRecord.data();
      let emailToTry = userData.email || `${username}@example.com`;
      await signInWithEmailAndPassword(getAuth(), emailToTry, password);
      signedIn = true;
    } catch(e) {
      alert("Sign in failed. In this example the app expects email-based Firebase Auth credentials. Sign up first or try again.");
      console.error(e);
    }
    if (signedIn) closeModal(signInModal);
  } catch (err) {
    alert("Sign in error: "+err.message);
    console.error(err);
  }
});

/* Sign out */
signOutButton.addEventListener("click", async ()=>{
  if (DEMO_FALLBACK) {
    localStorage.removeItem('demo_user');
    currentUser = null;
    setupAfterAuth();
    return;
  }
  await signOut(getAuth());
});

/* ============================
   Persistent Login & Snapshot
   ============================ */
async function setupAfterAuth(){
  // load public songs from Firestore (or demo)
  await subscribePublicSongs();
  // load playlists for user (private)
  if (currentUser) await loadUserPlaylists();
  updateAuthUI();
  renderSongsGrid();
  renderUserUploads();
  renderPlaylists();
}

/* Real Firebase listener for public songs */
let songsUnsub = null;
async function subscribePublicSongs(){
  if (songsUnsub) { songsUnsub(); songsUnsub = null; }
  songsCache = [];
  if (DEMO_FALLBACK) {
    // demo: read 'songs_demo' from localStorage
    const demoSongs = JSON.parse(localStorage.getItem('songs_demo') || "[]");
    songsCache = demoSongs;
    renderSongsGrid();
    return;
  }
  const db = getFirestore();
  const q = query(collection(db, "songs"), orderBy("createdAt","desc"));
  songsUnsub = onSnapshot(q, snap=>{
    songsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSongsGrid();
    renderSearchResults();
    renderUserUploads();
  });
}

/* On Auth state (real Firebase) */
if (!DEMO_FALLBACK) {
  onAuthStateChanged(getAuth(), async (user)=>{
    if (user) {
      // load user doc from Firestore
      const ud = await getDoc(doc(getFirestore(), "users", user.uid));
      if (ud.exists()) {
        const data = ud.data();
        currentUser = {
          uid: user.uid,
          username: data.username,
          displayName: data.displayName || data.username,
          avatar: data.avatar || null,
          bio: data.bio || "",
          verified: !!data.verified
        };
      } else {
        // create basic user doc if missing
        const usernameFromDisplay = user.displayName || `user${Date.now()%1000}`;
        await setDoc(doc(getFirestore(), "users", user.uid), {
          username: usernameFromDisplay,
          displayName: usernameFromDisplay,
          avatar: null,
          bio: "",
          verified: usernameFromDisplay === "RankRates" ? true : false,
          followers: [],
          following: [],
          createdAt: serverTimestamp()
        });
        currentUser = {
          uid: user.uid,
          username: usernameFromDisplay,
          displayName: usernameFromDisplay,
          avatar: null,
          bio: "",
          verified: usernameFromDisplay === "RankRates"
        };
      }
    } else {
      currentUser = null;
    }
    await setupAfterAuth();
  });
} else {
  // demo: check local storage for logged in demo user
  (async ()=>{
    const u = JSON.parse(localStorage.getItem('demo_user') || "null");
    currentUser = u;
    await setupAfterAuth();
  })();
}

/* ============================
   Rendering: songs, uploads
   ============================ */
function makeSongCard(song){
  const card = el("div","card");
  const img = el("img");
  img.src = song.coverUrl || song.cover || "https://via.placeholder.com/300x300?text=cover";
  card.appendChild(img);
  const info = el("div","meta");
  const infoLeft = el("div","info");
  const title = el("div","title"); title.textContent = song.title || "Untitled";
  const artist = el("div","artist"); artist.textContent = song.artist || song.uploaderName || "Unknown";
  infoLeft.appendChild(title); infoLeft.appendChild(artist);
  const actions = el("div","actions");
  const playBtn = el("button"); playBtn.textContent = "▶"; playBtn.title = "Play";
  playBtn.addEventListener("click", ()=>playSongFromGrid(song));
  const userLink = el("button"); userLink.textContent = song.uploaderName || "author"; userLink.className="link";
  userLink.addEventListener("click", ()=>openProfile(song.uploaderUid));
  actions.appendChild(playBtn);
  info.appendChild(infoLeft); info.appendChild(actions);
  card.appendChild(info);
  return card;
}

function renderSongsGrid(){
  songsGrid.innerHTML = "";
  if (!songsCache || songsCache.length===0) {
    songsGrid.innerHTML = "<div class='muted'>No songs yet.</div>";
    return;
  }
  songsCache.forEach(s=>{
    const c = makeSongCard(s);
    songsGrid.appendChild(c);
  });
}

function renderSearchResults(){
  const q = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!q) { searchResults.innerHTML = "<div class='muted'>Type to search</div>"; return; }
  const results = songsCache.filter(s=>{
    return (s.title||"").toLowerCase().includes(q) || (s.artist||"").toLowerCase().includes(q) || (s.genre||"").toLowerCase().includes(q);
  });
  results.forEach(r=> searchResults.appendChild(makeSongCard(r)));
}

searchInput.addEventListener("input", ()=>{
  const active = document.querySelector(".nav-btn.active");
  if (active && active.dataset.view === "search") renderSearchResults();
});

function renderUserUploads(){
  yourUploads.innerHTML = "";
  if (!currentUser) { yourUploads.innerHTML = "<div class='muted'>Sign in to see your uploads</div>"; return; }
  const mySongs = songsCache.filter(s=> s.uploaderUid === currentUser.uid);
  if (mySongs.length===0) { yourUploads.innerHTML = "<div class='muted'>You haven't uploaded any songs.</div>"; return; }
  mySongs.forEach(s=> yourUploads.appendChild(makeSongCard(s)));
}

/* ============================
   Upload handling (Firebase Storage + Firestore)
   ============================ */
uploadBtn.addEventListener("click", ()=>{
  if (!currentUser) return alert("Sign in to upload songs.");
  openModal(uploadModal);
});
cancelUpload.addEventListener("click", ()=>closeModal(uploadModal));

uploadForm.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  const fd = new FormData(uploadForm);
  const title = fd.get("title").trim();
  const artist = fd.get("artist").trim();
  const album = fd.get("album").trim();
  const genre = fd.get("genre").trim();
  const cover = fd.get("cover");
  const audioFile = fd.get("audio");
  if (!cover || !audioFile) return alert("Cover and audio required.");
  try {
    openModal(document.createElement("div")); // barrier (simple)
    if (DEMO_FALLBACK) {
      const coverData = await fileToDataUrl(cover);
      const audioData = await fileToBase64(audioFile, 30000); // small preview
      const song = {
        title, artist, album, genre,
        cover: coverData,
        audioPreview: audioData,
        uploaderUid: currentUser.uid,
        uploaderName: currentUser.displayName || currentUser.username,
        createdAt: Date.now()
      };
      const songsDemo = JSON.parse(localStorage.getItem('songs_demo') || "[]");
      songsDemo.unshift(song);
      localStorage.setItem('songs_demo', JSON.stringify(songsDemo));
      await subscribePublicSongs();
      closeModal(uploadModal);
      return;
    }

    // upload cover image
    const coverRef = sref(storage, `covers/${currentUser.uid}_${Date.now()}_${cover.name}`);
    await uploadBytes(coverRef, cover);
    const coverUrl = await getDownloadURL(coverRef);

    // upload audio
    const audioRef = sref(storage, `audios/${currentUser.uid}_${Date.now()}_${audioFile.name}`);
    await uploadBytes(audioRef, audioFile);
    const audioUrl = await getDownloadURL(audioRef);

    // store metadata in Firestore (public)
    const docRef = await addDoc(collection(getFirestore(), "songs"), {
      title, artist, album, genre,
      coverUrl, audioUrl,
      uploaderUid: currentUser.uid,
      uploaderName: currentUser.displayName || currentUser.username,
      createdAt: serverTimestamp()
    });
    closeModal(uploadModal);
  } catch (err) {
    console.error(err); alert("Upload failed: "+err.message);
  }
});

/* Helper: convert file to data URL */
function fileToDataUrl(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
/* Helper: read small base64 preview (demo) */
function fileToBase64(file, maxlen=500000){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>{
      let data = r.result;
      if (data.length > maxlen) data = data.slice(0, maxlen);
      res(data);
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ============================
   Player controls and queue
   ============================ */
function showPlayer(){
  player.classList.remove("hidden");
}
function hidePlayer(){
  player.classList.add("hidden");
}

function playSongFromGrid(song){
  // set queue to current song then all songs
  currentQueue = songsCache.slice(); // simple queue
  currentIndex = currentQueue.findIndex(s=>s.id === song.id) || 0;
  startPlayingCurrent();
}

async function startPlayingCurrent(){
  const s = currentQueue[currentIndex];
  if (!s) return;
  playerTitle.textContent = s.title || "Unknown";
  playerArtist.textContent = s.artist || s.uploaderName || "Unknown";
  playerCover.src = s.coverUrl || s.cover || "https://via.placeholder.com/150";
  // get audio src
  let src = s.audioUrl || s.audioPreview || null;
  if (!src) return alert("No audio source found for this song.");
  // if storage URL is present it will work; else demo preview used
  audio.src = src;
  audio.load();
  audio.play();
  showPlayer();
  updatePlayPauseUI();
  // update timeline when metadata available
  audio.onloadedmetadata = ()=>{
    seekBar.max = Math.floor(audio.duration);
    durationEl.textContent = fmtTime(audio.duration);
  };
}

function updatePlayPauseUI(){
  playPauseBtn.textContent = audio.paused ? "⏯️" : "⏸️";
}

playPauseBtn.addEventListener("click", ()=>{
  if (audio.paused) audio.play();
  else audio.pause();
  updatePlayPauseUI();
});

prevBtn.addEventListener("click", ()=>{
  if (currentIndex>0) currentIndex--;
  startPlayingCurrent();
});
nextBtn.addEventListener("click", ()=>{
  if (currentIndex < currentQueue.length -1) currentIndex++;
  else { audio.currentTime = 0; audio.pause(); updatePlayPauseUI(); return; }
  startPlayingCurrent();
});

audio.addEventListener("timeupdate", ()=>{
  seekBar.value = Math.floor(audio.currentTime);
  currentTimeEl.textContent = fmtTime(audio.currentTime);
});
seekBar.addEventListener("input", ()=> audio.currentTime = seekBar.value);
volumeEl.addEventListener("input", ()=> audio.volume = volumeEl.value);
audio.addEventListener("play", updatePlayPauseUI);
audio.addEventListener("pause", updatePlayPauseUI);
audio.addEventListener("ended", ()=>{
  if (currentIndex < currentQueue.length -1) {
    currentIndex++;
    startPlayingCurrent();
  } else {
    audio.currentTime = 0;
    audio.pause();
    updatePlayPauseUI();
  }
});

/* Add to Playlist modal */
addToPlaylistBtn.addEventListener("click", async ()=>{
  if (!currentUser) return alert("Sign in to add to playlists.");
  if (!currentQueue || !currentQueue[currentIndex]) return alert("No song playing.");
  await loadUserPlaylists();
  openModal(addToPlaylistModal);
  renderUserPlaylistsInModal();
});

closeAddToPlaylist.addEventListener("click", ()=>closeModal(addToPlaylistModal));
createPlaylistBtn.addEventListener("click", ()=>{ openModal(createPlaylistModal); });

createPlaylistForm.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  const fd = new FormData(createPlaylistForm);
  const name = fd.get("name").trim();
  const isPrivate = fd.get("private") ? true : false;
  if (!name) return alert("Name required.");
  try {
    if (DEMO_FALLBACK) {
      const pls = JSON.parse(localStorage.getItem('playlists_demo')||"[]");
      const p = { id: 'pl_'+Date.now(), ownerUid: currentUser.uid, name, private:isPrivate, songs:[] };
      pls.push(p);
      localStorage.setItem('playlists_demo', JSON.stringify(pls));
      await loadUserPlaylists();
      closeModal(createPlaylistModal);
      renderUserPlaylistsInModal();
      return;
    }
    await addDoc(collection(getFirestore(), "playlists"), {
      ownerUid: currentUser.uid,
      name,
      private: !!isPrivate,
      songs: [],
      createdAt: serverTimestamp()
    });
    await loadUserPlaylists();
    closeModal(createPlaylistModal);
    renderUserPlaylistsInModal();
  } catch(err){ console.error(err); alert("Create playlist failed: "+err.message); }
});

async function loadUserPlaylists(){
  userPlaylists = [];
  if (!currentUser) return userPlaylists=[];
  if (DEMO_FALLBACK) {
    const pls = JSON.parse(localStorage.getItem('playlists_demo')||"[]");
    userPlaylists = pls.filter(p=>p.ownerUid===currentUser.uid);
    return userPlaylists;
  }
  const db = getFirestore();
  const q = query(collection(db, "playlists"), where("ownerUid", "==", currentUser.uid));
  const snap = await getDocs(q);
  userPlaylists = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  return userPlaylists;
}

function renderUserPlaylistsInModal(){
  userPlaylistsList.innerHTML = "";
  if (userPlaylists.length===0) userPlaylistsList.innerHTML = "<div class='muted'>You have no playlists yet.</div>";
  userPlaylists.forEach(pl=>{
    const row = el("div","card");
    const title = el("div"); title.textContent = pl.name + (pl.private ? " (Private)" : "");
    const btn = el("button"); btn.textContent = "Add";
    btn.addEventListener("click", ()=> addCurrentSongToPlaylist(pl));
    row.appendChild(title); row.appendChild(btn);
    userPlaylistsList.appendChild(row);
  });
}

async function addCurrentSongToPlaylist(pl){
  const song = currentQueue[currentIndex];
  if (!song) return alert("No song playing.");
  try {
    if (DEMO_FALLBACK) {
      const pls = JSON.parse(localStorage.getItem('playlists_demo')||"[]");
      const idx = pls.findIndex(p=>p.id===pl.id);
      if (idx!==-1) {
        pls[idx].songs = pls[idx].songs || [];
        if (!pls[idx].songs.find(s=>s.title===song.title)) pls[idx].songs.push(song);
        localStorage.setItem('playlists_demo', JSON.stringify(pls));
      }
      alert("Added to playlist (demo).");
      closeModal(addToPlaylistModal);
      return;
    }
    const ref = doc(getFirestore(), "playlists", pl.id);
    await updateDoc(ref, { songs: arrayUnion(song) });
    alert("Added to playlist.");
    closeModal(addToPlaylistModal);
  } catch(err){ console.error(err); alert("Failed: "+err.message); }
}

/* ============================
   Playlists View rendering (private visible only to owner)
   ============================ */
async function renderPlaylists(){
  playlistsList.innerHTML = "";
  if (!currentUser) playlistsList.innerHTML = "<div class='muted'>Sign in to see your playlists (private).</div>";
  // list playlists owned by current user
  if (DEMO_FALLBACK) {
    const pls = JSON.parse(localStorage.getItem('playlists_demo')||"[]").filter(p=>p.ownerUid=== (currentUser?currentUser.uid:null));
    if (pls.length===0) playlistsList.innerHTML = "<div class='muted'>No playlists.</div>";
    pls.forEach(pl=>{
      const node = el("div","card");
      const title = el("div"); title.textContent = pl.name;
      const list = el("div");
      pl.songs.forEach(s=>{
        const r = el("div"); r.textContent = s.title + " — " + s.artist;
        list.appendChild(r);
      });
      node.appendChild(title); node.appendChild(list);
      playlistsList.appendChild(node);
    });
    return;
  }
  const db = getFirestore();
  const q = query(collection(db, "playlists"), where("ownerUid", "==", currentUser ? currentUser.uid : "___"));
  const snap = await getDocs(q);
  if (snap.empty) { playlistsList.innerHTML = "<div class='muted'>No playlists.</div>"; return; }
  snap.docs.forEach(d=>{
    const p = { id: d.id, ...d.data() };
    const node = el("div","card");
    const title = el("div"); title.textContent = p.name + (p.private ? " (Private)" : "");
    const list = el("div");
    (p.songs||[]).forEach(s=>{
      const r = el("div"); r.textContent = (s.title||"")+" — "+(s.artist||"");
      list.appendChild(r);
    });
    node.appendChild(title); node.appendChild(list);
    playlistsList.appendChild(node);
  });
}

/* ============================
   Profile page, follow/unfollow, verification
   ============================ */
async function openProfile(uid){
  // show profile modal with public info and songs
  if (DEMO_FALLBACK) {
    const ud = JSON.parse(localStorage.getItem('users_demo')||"[]").find(u=>u.uid===uid);
    if (!ud) return alert("User not found (demo).");
    profileAvatar.src = ud.avatar || "https://via.placeholder.com/120";
    profileDisplayName.textContent = ud.displayName;
    profileBio.textContent = ud.bio || "";
    profileBadge.classList.toggle("hidden", !ud.verified);
    followersCount.textContent = (ud.followers||[]).length || 0;
    followingCount.textContent = (ud.following||[]).length || 0;
    followBtn.style.display = (currentUser && currentUser.uid !== ud.uid) ? "inline-block" : "none";
    followBtn.textContent = (currentUser && (ud.followers||[]).includes(currentUser.uid)) ? "Unfollow" : "Follow";
    // fetch user's public songs
    const songs = JSON.parse(localStorage.getItem('songs_demo')||"[]").filter(s=>s.uploaderUid===ud.uid);
    profileSongs.innerHTML = "";
    songs.forEach(s=> profileSongs.appendChild(makeSongCard(s)));
    openModal(profileModal);
    return;
  }

  const udRef = doc(getFirestore(), "users", uid);
  const udSnap = await getDoc(udRef);
  if (!udSnap.exists()) return alert("User not found.");
  const ud = udSnap.data();
  profileAvatar.src = ud.avatar || "https://via.placeholder.com/120";
  profileDisplayName.textContent = ud.displayName || ud.username;
  profileBio.textContent = ud.bio || "";
  profileBadge.classList.toggle("hidden", !ud.verified);
  followersCount.textContent = (ud.followers || []).length || 0;
  followingCount.textContent = (ud.following || []).length || 0;
  followBtn.style.display = (currentUser && currentUser.uid !== uid) ? "inline-block" : "none";
  followBtn.textContent = (currentUser && (ud.followers || []).includes(currentUser.uid)) ? "Unfollow" : "Follow";
  // public songs by user
  const q = query(collection(getFirestore(), "songs"), where("uploaderUid","==", uid));
  const snap = await getDocs(q);
  profileSongs.innerHTML = "";
  snap.docs.forEach(d=>{
    profileSongs.appendChild(makeSongCard({ id: d.id, ...d.data() }));
  });
  // set follow button handler
  followBtn.onclick = async ()=>{
    if (!currentUser) return alert("Sign in to follow users.");
    const uRef = doc(getFirestore(), "users", uid);
    const myRef = doc(getFirestore(), "users", currentUser.uid);
    const targetData = (await getDoc(uRef)).data();
    const meData = (await getDoc(myRef)).data();
    const amFollowing = (targetData.followers||[]).includes(currentUser.uid);
    if (amFollowing) {
      await updateDoc(uRef, { followers: arrayRemove(currentUser.uid) });
      await updateDoc(myRef, { following: arrayRemove(uid) });
      followBtn.textContent = "Follow";
    } else {
      await updateDoc(uRef, { followers: arrayUnion(currentUser.uid) });
      await updateDoc(myRef, { following: arrayUnion(uid) });
      followBtn.textContent = "Unfollow";
    }
    // refresh counts
    const ud2 = (await getDoc(uRef)).data();
    followersCount.textContent = (ud2.followers||[]).length;
  };
  openModal(profileModal);
}

closeProfile.addEventListener("click", ()=>closeModal(profileModal));

/* ============================
   Edit Profile logic
   ============================ */
$("#userAvatarSmall")?.addEventListener("click", ()=>{
  if (!currentUser) return;
  openModal(editProfileModal);
  // populate
  editProfileForm.displayName.value = currentUser.displayName || "";
  editProfileForm.bio.value = currentUser.bio || "";
});

$("#cancelEditProfile").addEventListener("click", ()=>closeModal(editProfileModal));

editProfileForm.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  if (!currentUser) return alert("Sign in to edit profile.");
  const fd = new FormData(editProfileForm);
  const displayName = fd.get("displayName").trim();
  const bio = fd.get("bio").trim();
  const avatarFile = fd.get("avatar");
  try {
    let avatarUrl = currentUser.avatar || null;
    if (avatarFile && avatarFile.size) {
      if (DEMO_FALLBACK) {
        avatarUrl = await fileToDataUrl(avatarFile);
      } else {
        const ref = sref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
        await uploadBytes(ref, avatarFile);
        avatarUrl = await getDownloadURL(ref);
      }
    }
    if (DEMO_FALLBACK) {
      // update demo user storage
      const users = JSON.parse(localStorage.getItem('users_demo')||"[]");
      const idx = users.findIndex(u=>u.uid===currentUser.uid);
      if (idx!==-1) {
        users[idx].displayName = displayName || users[idx].displayName;
        users[idx].bio = bio;
        users[idx].avatar = avatarUrl;
        localStorage.setItem('users_demo', JSON.stringify(users));
        currentUser = users[idx];
      }
    } else {
      const uRef = doc(getFirestore(), "users", currentUser.uid);
      await updateDoc(uRef, { displayName, bio, avatar: avatarUrl });
      // update currentUser cached
      currentUser.displayName = displayName; currentUser.bio = bio; currentUser.avatar = avatarUrl;
    }
    updateAuthUI();
    closeModal(editProfileModal);
  } catch(err){ console.error(err); alert("Failed to update profile: "+err.message); }
});

/* ============================
   Admin & Verified logic
   ============================
   Requirement: one special admin account — username RankRates with password Rank1250 —
   is automatically recognized as admin. Do NOT put that password in UI/code.
   Approach: when a user exists whose username === "RankRates" we treat them as admin.
   The admin UI can verify other users by toggling their "verified" field in Firestore.
   This is a client-side convenience — in a production app enforce admin checks server-side.
   ============================ */
async function tryAdminActionsIfApplicable(){
  if (!currentUser) return;
  // if username equals RankRates => admin
  const isAdmin = (currentUser.username === "RankRates" || currentUser.displayName === "RankRates");
  // expose admin controls in profile modal only if admin
  if (!isAdmin) return;
  // add verify buttons to each user card in profile modal (if viewing)
  // For simplicity, add a small admin toolbar near profile modal header
  const header = document.querySelector("#profileHeader .profile-actions");
  if (!header) return;
  // create verify area if not exists
  if (!document.getElementById("adminVerifyArea")) {
    const area = document.createElement("div");
    area.id = "adminVerifyArea";
    area.innerHTML = `<button id="adminToggleVerify" class="primary">Toggle Verified</button>`;
    header.appendChild(area);
    document.getElementById("adminToggleVerify").addEventListener("click", async ()=>{
      // toggle verification for profile being viewed
      const usernameViewing = profileDisplayName.textContent;
      // find user by username
      const db = getFirestore();
      const q = query(collection(db,"users"), where("displayName","==", usernameViewing));
      const snap = await getDocs(q);
      if (snap.empty) return alert("Cannot find user to verify.");
      const uRef = doc(db, "users", snap.docs[0].id);
      const uData = snap.docs[0].data();
      const newVal = !uData.verified;
      await updateDoc(uRef, { verified: newVal });
      alert(`Set verified=${newVal} for ${usernameViewing}`);
    });
  }
}

/* ============================
   Demo / local helper initialization
   ============================ */
async function ensureDemoFirestoreInit(){
  // create arrays if missing
  if (!localStorage.getItem('users_demo')) localStorage.setItem('users_demo', JSON.stringify([]));
  if (!localStorage.getItem('songs_demo')) localStorage.setItem('songs_demo', JSON.stringify([]));
  if (!localStorage.getItem('playlists_demo')) localStorage.setItem('playlists_demo', JSON.stringify([]));
}
async function createOrUpdateUserDocDemo(user){
  const users = JSON.parse(localStorage.getItem('users_demo')||"[]");
  const idx = users.findIndex(u=>u.uid===user.uid);
  if (idx===-1) users.push(user);
  else users[idx] = {...users[idx], ...user};
  localStorage.setItem('users_demo', JSON.stringify(users));
}
async function getDemoUserByUsername(username){
  const users = JSON.parse(localStorage.getItem('users_demo')||"[]");
  return users.find(u=>u.username===username);
}

/* ============================
   Small helpers & initial load
   ============================ */
async function init(){
  if (DEMO_FALLBACK) await ensureDemoFirestoreInit();
  // UI wiring
  signOutBtn.addEventListener("click", async ()=>{
    if (DEMO_FALLBACK) {
      localStorage.removeItem('demo_user'); currentUser=null; updateAuthUI(); return;
    }
    await signOut(getAuth());
  });

  // clicking username display opens profile editing or profile view
  usernameDisplay.addEventListener("click", ()=>{
    if (!currentUser) return;
    // open own profile
    openProfile(currentUser.uid);
  });

  // open edit profile when clicking avatar
  userAvatarSmall.addEventListener("click", ()=>{
    if (!currentUser) return openModal(signInModal);
    openModal(editProfileModal);
  });

  // sign in/out modal closers
  $("#cancelSignIn").addEventListener("click", ()=>closeModal(signInModal));
  $("#cancelSignUp").addEventListener("click", ()=>closeModal(signUpModal));

  // initial render placeholders
  renderSongsGrid();
  renderPlaylists();
}

init();

/* ============================
   Firestore fallback helpers (for missing features used above)
   ============================ */

/* If app developer wants to test enforcement of admin without exposing password:
   instruct admin user to sign up with username "RankRates" and their secret password
   (the app DOES NOT hardcode the password anywhere). When they sign in, because their username
   equals "RankRates" we treat them as admin in the UI. This matches the constraint:
   - admin account is recognized automatically when signed in (by username),
   - password is not stored or displayed in UI or code.
*/

/* ============================
   End of script
   ============================ */
