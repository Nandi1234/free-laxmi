import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

// Replace these values with your Firebase project's Web App configuration.
const firebaseConfig = {
  apiKey: 'AIzaSyAjsmaqqqhQ1JV7-tjQLHb66zdpLWzLD-c',
  authDomain: 'freelaxmi-9bcaa.firebaseapp.com',
  projectId: 'freelaxmi-9bcaa',
  storageBucket: 'freelaxmi-9bcaa.appspot.com',
  messagingSenderId: '234632594260',
  appId: '1:123456789012:web:1234567890123456789012'
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// Separate auth instance allows admin to create an account without signing themselves out.
const secondaryApp = initializeApp(firebaseConfig, 'secondary-user-creation');
const secondaryAuth = getAuth(secondaryApp);

const $ = id => document.getElementById(id);
let currentUser = null,
  profile = null,
  dealers = [],
  currentPosition = null,
  activeAttendance = null,
  todayAttendance = null,
  previewUrl = null;
const pageNames = {
  overview: 'Overview',
  employees: 'Employees',
  dealers: 'Dealers',
  attendance: 'Attendance',
  visits: 'Dealer visits'
};

function toast(message, error = false) {
  const el = $('toast');
  el.textContent = message;
  el.style.background = error ? '#a93446' : '#24243a';
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 4200)
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]))
}

function dateLabel(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(value) {
  if (!value) return 'Pending';
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleString()
}

function localDayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d)
}

function roleIsAdmin() {
  return profile?.role === 'admin'
}

function setLoading(button, loading, label) {
  if (loading) {
    button.dataset.oldLabel = button.textContent;
    button.textContent = label || 'Please wait…';
    button.disabled = true
  } else {
    button.textContent = button.dataset.oldLabel || button.textContent;
    button.disabled = false
  }
}

function showApp() {
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('userName').textContent = profile.name || currentUser.email;
  $('userRole').textContent = profile.role || 'employee';
  $('userAvatar').textContent = (profile.name || currentUser.email || 'U').charAt(0).toUpperCase();
  $('topUserEmail').textContent = currentUser.email || '';
  $('welcomeTitle').textContent = `Hello, ${(profile.name || 'there').split(' ')[0]}`;
  $('todayLabel').textContent = dateLabel();
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !roleIsAdmin()));
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('hidden', el.classList.contains('admin-only') && !roleIsAdmin()));
  navigate('overview');
  loadDashboard();
  loadDealers();
  loadAttendance();
  loadVisits();
}

function navigate(page) {
  if (['employees', 'dealers'].includes(page) && !roleIsAdmin()) {
    toast('Admin access required.', true);
    page = 'overview'
  }
  document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
  $('page-' + page)?.classList.remove('hidden');
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $('pageTitle').textContent = pageNames[page] || 'Overview';
  $('pageEyebrow').textContent = roleIsAdmin() ? 'ADMIN WORKSPACE' : 'EMPLOYEE WORKSPACE';
  if (page === 'employees') loadEmployees();
  if (page === 'dealers') renderDealers();
  if (page === 'attendance') loadAttendance();
  if (page === 'visits') loadVisits()
}
document.querySelectorAll('.nav').forEach(el => el.addEventListener('click', () => navigate(el.dataset.page)));
document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.go)));
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter;
  setLoading(btn, true, 'Signing in…');
  //   import { collection, getDocs }
  // from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
  console.log("hello");
  try {
    await signInWithEmailAndPassword(auth, $('loginEmail').value.trim(), $('loginPassword').value)
  } catch (err) {
    console.warn(err);
    toast(friendlyError(err), true)
  } finally {
    setLoading(btn, false)
  }
});
$('logoutBtn').addEventListener('click', () => signOut(auth).catch(e => toast(friendlyError(e), true)));
onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    profile = null;
    $('appView').classList.add('hidden');
    $('authView').classList.remove('hidden');
    return
  }
  currentUser = user;
  console.log("currentUser", currentUser);
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    console.log("snap", snap.data());
    if (!snap.exists()) {
      await signOut(auth);
      toast('Your account has no user profile. Ask an admin to configure your role.', true);
      return
    }
    profile = snap.data();
    console.log("profile", profile);
    if (!['admin', 'employee'].includes(profile.role)) {
      await signOut(auth);
      toast('Invalid user role.', true);
      return
    }
    showApp()
  } catch (err) {
    toast('Could not load your profile: ' + friendlyError(err), true)
  }
});

function friendlyError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'That email is already registered.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'permission-denied': 'Permission denied. Check your Firestore/Storage security rules.',
    'storage/unauthorized': 'Photo upload denied by Storage rules.'
  };
  return map[code] || err?.message || 'Something went wrong.'
}
async function loadDashboard() {
  try {
    if (roleIsAdmin()) {
      const [u, d] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'dealers'))]);
      $('statEmployees').textContent = u.size;
      $('statDealers').textContent = d.size
    } else {
      $('statEmployees').textContent = '—';
      const d = await getDocs(collection(db, 'dealers'));
      $('statDealers').textContent = d.size
    }
    const [a, v] = await Promise.all([getDocs(query(collection(db, 'attendance'), where('userId', '==', currentUser.uid), where('checkIn', '>=', localDayStart()))), getDocs(query(collection(db, 'visits'), where('userId', '==', currentUser.uid), where('createdAt', '>=', localDayStart())))]);
    $('statAttendance').textContent = a.size;
    $('statVisits').textContent = v.size
  } catch (e) {
    console.warn(e);
  }
}
$('employeeForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!roleIsAdmin()) return;
  const btn = e.submitter;
  setLoading(btn, true, 'Creating…');
  let newUser = null;
  try {
    const name = $('empName').value.trim(),
      email = $('empEmail').value.trim(),
      password = $('empPassword').value,
      role = $('empRole').value;
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    newUser = cred.user;
    await setDoc(doc(db, 'users', newUser.uid), {
      name,
      email,
      role,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    await signOut(secondaryAuth);
    e.target.reset();
    toast('User created successfully. Share the temporary password securely.');
    loadEmployees();
    loadDashboard()
  } catch (err) {
    if (secondaryAuth.currentUser) await signOut(secondaryAuth).catch(() => { });
    toast(friendlyError(err) + (newUser ? ' The Auth account may exist without a profile; check Firebase Console.' : ''), true)
  } finally {
    setLoading(btn, false)
  }
});
$('refreshEmployees').addEventListener('click', loadEmployees);
async function loadEmployees() {
  if (!roleIsAdmin()) return;
  const area = $('employeeList');
  area.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)));
    console.log("snap", snap);
    if (!snap.size) {
      area.innerHTML = '<div class="empty">No team members yet.</div>';
      return
    }
    area.innerHTML = snap.docs.map(d => {
      const u = d.data();
      return `<div class="list-item"><div class="list-bullet">${escapeHtml((u.name || u.email || 'U')[0].toUpperCase())}</div><div class="list-main"><strong>${escapeHtml(u.name || 'Unnamed user')}</strong><small>${escapeHtml(u.email || '')}<br>Added ${escapeHtml(formatTime(u.createdAt))}</small></div><span class="tag">${escapeHtml(u.role || 'employee')}</span></div>`
    }).join('')
  } catch (e) {
    area.innerHTML = `<p class="muted">${escapeHtml(friendlyError(e))}</p>`
  }
}
$('dealerForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!roleIsAdmin()) return;
  const btn = e.submitter;
  setLoading(btn, true, 'Saving…');
  try {
    const lat = Number($('dealerLat').value),
      lng = Number($('dealerLng').value);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('Latitude must be -90 to 90 and longitude -180 to 180.');
    await addDoc(collection(db, 'dealers'), {
      name: $('dealerName').value.trim(),
      address: $('dealerAddress').value.trim(),
      lat,
      lng,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    e.target.reset();
    toast('Dealer saved.');
    await loadDealers();
    loadDashboard()
  } catch (err) {
    toast(friendlyError(err), true)
  } finally {
    setLoading(btn, false)
  }
});
$('useDealerLocation').addEventListener('click', () => getPosition().then(p => {
  $('dealerLat').value = p.latitude.toFixed(7);
  $('dealerLng').value = p.longitude.toFixed(7);
  toast('Current coordinates filled in.')
}).catch(e => toast(e.message, true)));
async function loadDealers() {
  try {
    const snap = await getDocs(query(collection(db, 'dealers'), orderBy('name')));
    dealers = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    renderDealers();
    populateVisitDealers()
  } catch (e) {
    console.warn(e);
    if ($('dealerList')) $('dealerList').innerHTML = `<p class="muted">${escapeHtml(friendlyError(e))}</p>`
  }
}

function renderDealers() {
  const area = $('dealerList');
  if (!area) return;
  const search = ($('dealerSearch')?.value || '').toLowerCase();
  const list = dealers.filter(d => (d.name || '').toLowerCase().includes(search) || (d.address || '').toLowerCase().includes(search));
  area.innerHTML = list.length ? list.map(d => `<div class="list-item"><div class="list-bullet">⌖</div><div class="list-main"><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.address)}<br>${Number(d.lat).toFixed(5)}, ${Number(d.lng).toFixed(5)}</small></div><a class="tag" href="https://www.google.com/maps?q=${encodeURIComponent(d.lat + ',' + d.lng)}" target="_blank" rel="noopener">Map ↗</a></div>`).join('') : '<div class="empty">No dealers found.</div>'
}
$('dealerSearch').addEventListener('input', renderDealers);

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not supported by this browser.'));
    navigator.geolocation.getCurrentPosition(p => resolve({
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy
    }), e => reject(new Error(({
      1: 'Location permission denied.',
      2: 'Current location unavailable.',
      3: 'Location request timed out.'
    })[e.code] || e.message)), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    })
  })
}

function distanceKm(a, b) {
  const rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.latitude),
    dLon = rad(b.lng - a.longitude),
    x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
$('locateDealers').addEventListener('click', async () => {
  const btn = $('locateDealers');
  setLoading(btn, true, 'Getting location…');
  try {
    currentPosition = await getPosition();
    populateVisitDealers();
    toast('Dealer distances calculated from your current location.')
  } catch (e) {
    toast(e.message, true)
  } finally {
    setLoading(btn, false)
  }
});

function populateVisitDealers() {
  const sel = $('visitDealer');
  if (!sel) return;
  const prior = sel.value;
  const sorted = [...dealers].sort((a, b) => currentPosition ? distanceKm(currentPosition, a) - distanceKm(currentPosition, b) : (a.name || '').localeCompare(b.name || ''));
  sel.innerHTML = '<option value="">Select a dealer…</option>' + sorted.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}${currentPosition ? ' · ' + distanceKm(currentPosition, d).toFixed(1) + ' km' : ''}</option>`).join('');
  if (sorted.some(d => d.id === prior)) sel.value = prior;
  updateSelectedDealer()
}
$('visitDealer').addEventListener('change', updateSelectedDealer);

function updateSelectedDealer() {
  const d = dealers.find(x => x.id === $('visitDealer').value);
  $('selectedDealerInfo').textContent = d ? `${d.address}${currentPosition ? ' · ' + distanceKm(currentPosition, d).toFixed(2) + ' km away (straight-line distance)' : ''}` : 'Select a dealer to see its address and distance.'
}


let cameraStream = null;
let capturedPhotoFile = null;

const cameraPreview = document.getElementById("cameraPreview");
const cameraCanvas = document.getElementById("cameraCanvas");
const photoPreview = document.getElementById("photoPreview");
const cameraStatus = document.getElementById("cameraStatus");

document.getElementById("startCamera").addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Live camera is not supported. Open the app using HTTPS.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    cameraPreview.srcObject = cameraStream;
    cameraPreview.classList.remove("hidden");
    photoPreview.classList.add("hidden");

    document.getElementById("capturePhoto").disabled = false;
    document.getElementById("retakePhoto").classList.add("hidden");

    cameraStatus.textContent = "Camera is ready. Capture your visit photo.";
  } catch (error) {
    console.error(error);
    cameraStatus.textContent = error.message || "Unable to access camera.";
  }
});

document.getElementById("capturePhoto").addEventListener("click", () => {
  if (!cameraStream) return;

  const video = cameraPreview;

  if (!video.videoWidth || !video.videoHeight) {
    cameraStatus.textContent = "Camera is not ready yet.";
    return;
  }

  cameraCanvas.width = video.videoWidth;
  cameraCanvas.height = video.videoHeight;

  const context = cameraCanvas.getContext("2d");
  context.drawImage(video, 0, 0);

  cameraCanvas.toBlob(blob => {
    if (!blob) {
      cameraStatus.textContent = "Could not capture photo.";
      return;
    }

    capturedPhotoFile = new File(
      [blob],
      `visit-${Date.now()}.jpg`,
      { type: "image/jpeg" }
    );

    photoPreview.src = URL.createObjectURL(capturedPhotoFile);
    photoPreview.classList.remove("hidden");
    cameraPreview.classList.add("hidden");

    stopCamera();

    document.getElementById("capturePhoto").disabled = true;
    document.getElementById("retakePhoto").classList.remove("hidden");

    cameraStatus.textContent = "Photo captured successfully.";
  }, "image/jpeg", 0.90);
});

document.getElementById("retakePhoto").addEventListener("click", async () => {
  capturedPhotoFile = null;
  photoPreview.classList.add("hidden");
  await openCameraAgain();
});

async function openCameraAgain() {
  document.getElementById("startCamera").click();
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}


$('visitForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('submitVisitBtn');
  const dealer = dealers.find(d => d.id === $('visitDealer').value),
  file = capturedPhotoFile;
  if (!dealer || !file) {
    toast('Select a dealer and take a photo first.', true);
    return
  }
  setLoading(btn, true, 'Uploading photo…');
  try {
    let pos = currentPosition;
    try {
      pos = await getPosition();
      currentPosition = pos
    } catch (err) {
      if (!pos) throw err
    }
    const visitRef = doc(collection(db, 'visits'));
    const uploadedPhoto = await uploadToCloudinary(
      file,
      currentUser.uid,
      visitRef.id
    );
    console.log("uploadedPhoto", uploadedPhoto);
    const photoUrl = uploadedPhoto.url;
    const photoPublicId = uploadedPhoto.public_id;
    await setDoc(visitRef, {
      userId: currentUser.uid,
      userName: profile.name || currentUser.email,
      dealerId: dealer.id,
      dealerName: dealer.name,
      dealerAddress: dealer.address,
      dealerLat: dealer.lat,
      dealerLng: dealer.lng,
      notes: $('visitNotes').value.trim(),
      photoUrl,
      photoPublicId: photoPublicId,
      photoStorage: 'cloudinary',
      employeeLat: pos.latitude,
      employeeLng: pos.longitude,
      accuracyMeters: pos.accuracy || null,
      distanceKm: distanceKm(pos, dealer),
      createdAt: serverTimestamp()
    });
    e.target.reset();
    $('photoPreview').classList.add('hidden');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    toast('Visit submitted with photo and location.');
    loadVisits();
    loadDashboard()
  } catch (err) {
    toast(friendlyError(err), true)
  } finally {
    setLoading(btn, false)
  }
  capturedPhotoFile = null;
  photoPreview.removeAttribute("src");
  photoPreview.classList.add("hidden");
  cameraStatus.textContent = "Open the camera and capture a live photo.";
});


async function uploadToCloudinary(file, userId, visitId) {
  const CLOUDINARY_CLOUD_NAME = "o0eicmjo";
  const CLOUDINARY_UPLOAD_PRESET = "debasish";
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `fieldops/visit-photos/${userId}`);
  formData.append("public_id", visitId + "_" + Date.now());

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );
  console.log("Cloudinary response", response);
  // console.log("Cloudinary response status", response.json());
  const result = await response.json();
  return result
}
$('refreshVisits').addEventListener('click', loadVisits);
async function loadVisits() {
  if (!currentUser) return;
  const area = $('visitList');
  area.innerHTML = '<p class="muted">Loading visits…</p>';
  try {
    const q = roleIsAdmin() ? query(collection(db, 'visits'), orderBy('createdAt', 'desc'), limit(50)) : query(collection(db, 'visits'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    area.innerHTML = snap.size ? snap.docs.map(docSnap => {
      const v = docSnap.data();
      return `<div class="list-item"><div class="list-bullet">☑</div><div class="list-main"><strong>${escapeHtml(v.dealerName || 'Dealer visit')}</strong><small>${roleIsAdmin() ? escapeHtml(v.userName || 'Employee') + ' · ' : ''}${escapeHtml(formatTime(v.createdAt))}<br>${v.distanceKm != null ? escapeHtml(Number(v.distanceKm).toFixed(2) + ' km from dealer') + ' · ' : ''}${escapeHtml(v.notes || 'No notes')}</small><a href="${escapeHtml(v.photoUrl || '#')}" target="_blank" rel="noopener">View visit photo ↗</a></div></div>`
    }).join('') : '<div class="empty">No visits submitted yet.</div>'
  } catch (e) {
    area.innerHTML = `<p class="muted">${escapeHtml(friendlyError(e))}</p>`
  }
}
$('checkInBtn').addEventListener('click', () => attendanceAction('in'));
$('checkOutBtn').addEventListener('click', () => attendanceAction('out'));
async function attendanceAction(kind) {
  const btn = kind === 'in' ? $('checkInBtn') : $('checkOutBtn');
  setLoading(btn, true, kind === 'in' ? 'Checking in…' : 'Checking out…');
  try {
    let pos = null;
    try {
      pos = await getPosition()
    } catch (e) {
      if (!confirm('Could not get your location: ' + e.message + '\nContinue without location?')) return
    }
    if (kind === 'in') {
      if (activeAttendance) {
        toast('You are already checked in.', true);
        return
      }
      const ref = await addDoc(collection(db, 'attendance'), {
        userId: currentUser.uid,
        userName: profile.name || currentUser.email,
        checkIn: serverTimestamp(),
        checkInLat: pos?.latitude ?? null,
        checkInLng: pos?.longitude ?? null,
        status: 'checked-in'
      });
      activeAttendance = ref.id;
      toast('Checked in successfully.')
    } else {
      if (!activeAttendance) {
        toast('No open check-in found.', true);
        return
      }
      await setDoc(doc(db, 'attendance', activeAttendance), {
        checkOut: serverTimestamp(),
        checkOutLat: pos?.latitude ?? null,
        checkOutLng: pos?.longitude ?? null,
        status: 'checked-out'
      }, {
        merge: true
      });
      activeAttendance = null;
      toast('Checked out successfully.')
    }
    await loadAttendance();
    loadDashboard()
  } catch (e) {
    toast(friendlyError(e), true)
  } finally {
    setLoading(btn, false);
    syncAttendanceButtons()
  }
}
async function loadAttendance() {
  if (!currentUser) return;
  const area = $('attendanceList');
  try {
    const snap = await getDocs(query(collection(db, 'attendance'), where('userId', '==', currentUser.uid), orderBy('checkIn', 'desc'), limit(20)));
    const docs = snap.docs;
    todayAttendance = docs.find(d => {
      const x = d.data(),
        t = x.checkIn?.toDate?.();
      return t && t.toDateString() === new Date().toDateString()
    });
    activeAttendance = null;
    const open = docs.find(d => !d.data().checkOut);
    if (open) activeAttendance = open.id;
    area.innerHTML = docs.length ? docs.map(d => {
      const a = d.data();
      return `<div class="list-item"><div class="list-bullet">◷</div><div class="list-main"><strong>${escapeHtml(a.checkIn?.toDate?.().toLocaleDateString() || 'Attendance')}</strong><small>In: ${escapeHtml(formatTime(a.checkIn))}<br>Out: ${escapeHtml(formatTime(a.checkOut))}</small></div><span class="tag">${escapeHtml(a.status || 'recorded')}</span></div>`
    }).join('') : '<div class="empty">No attendance records yet.</div>';
    if (todayAttendance) {
      const a = todayAttendance.data();
      $('attendanceStatusText').textContent = a.checkOut ? 'Attendance completed for today.' : 'You are checked in.'
    } else $('attendanceStatusText').textContent = 'You have not checked in today.';
    syncAttendanceButtons()
  } catch (e) {
    area.innerHTML = `<p class="muted">${escapeHtml(friendlyError(e))}</p>`
  }
}

function syncAttendanceButtons() {
  $('checkInBtn').disabled = !!activeAttendance;
  $('checkOutBtn').disabled = !activeAttendance
}

function updateClock() {
  const now = new Date();
  $('liveClock').textContent = now.toLocaleTimeString();
  $('clockDate').textContent = dateLabel(now)
}
updateClock();
setInterval(updateClock, 1000);
