/* =========================================================
   دوّر - script.js
   النسخة الكاملة والمصححة
   ========================================================= */


/* =========================================================
   FIREBASE V3
========================================================= */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC2utHZyGAdptjuNjp7FbTJSlRO6xs8G7U",
    authDomain: "suhayeb-25ef9.firebaseapp.com",
    projectId: "suhayeb-25ef9",
    storageBucket: "suhayeb-25ef9.firebasestorage.app",
    messagingSenderId: "904310961712",
    appId: "1:904310961712:web:178e457e45db1136d85ff5",
    measurementId: "G-KXMD8DQS2X"
};

let firebaseReady = false;
let firebaseDb = null;
let firebaseStorage = null;
let firebaseAuth = null;
let firebaseUser = null;

function initializeFirebase() {
    try {
        if (typeof firebase === "undefined") {
            console.warn("Firebase SDK غير متاح — سيستمر دوّر بالوضع المحلي.");
            return false;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }

        firebaseDb = firebase.firestore();
        // Storage اختياري حاليًا لأن المشروع ما زال على Spark.
        // نهيئه فقط عند محاولة رفع صورة.
        firebaseStorage = null;
        firebaseAuth = firebase.auth();
        firebaseReady = true;

        firebaseAuth.languageCode = "ar";

        firebaseAuth.onAuthStateChanged(user => {
            firebaseUser = user || null;
            window.doorrFirebaseUser = firebaseUser;

            // حسابات دوّر الجديدة تستخدم Firebase Email/Password داخليًا،
            // بينما المستخدم يرى ويتعامل فقط مع رقم الهاتف.
            if (user && user.email && user.email.endsWith("@doorr.app")) {
                const phone = phoneFromFirebaseEmail(user.email);
                if (phone) {
                    let localUser = getCurrentUser();

                    if (!localUser || normalizePhone(localUser.phone || "") !== phone) {
                        localUser = {
                            id: makeUserIdFromPhone(phone),
                            name: user.displayName || "مستخدم دوّر",
                            phone,
                            createdAt: Date.now()
                        };
                    }

                    // استرجاع بيانات الحساب المحفوظة محليًا/سحابيًا قبل تحديث الجلسة
                    // حتى لا تختفي صورة البروفايل إذا كان سجل Firebase القديم لا يحتوي photo.
                    const registeredMatch = getRegisteredUsers().find(item =>
                        String(item.id) === String(localUser.id)
                    );
                    if (registeredMatch) {
                        localUser = { ...registeredMatch, ...localUser };
                    }

                    localUser.phone = phone;
                    localUser.firebaseUid = user.uid;
                    localUser.authProvider = "password";
                    localUser.lastLogin = Date.now();
                    if (user.displayName) localUser.name = user.displayName;

                    saveCurrentUser(localUser);
                    registerUser(localUser);
                }
            }

            if (typeof updateProfileUI === "function") updateProfileUI();
            if (typeof updateMessagesBadge === "function") updateMessagesBadge();
        });

        return true;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        firebaseReady = false;
        return false;
    }
}

async function ensureFirebaseAuth() {
    if (!firebaseReady || !firebaseAuth) return null;
    if (firebaseAuth.currentUser) {
        firebaseUser = firebaseAuth.currentUser;
        return firebaseUser;
    }
    try {
        const result = await firebaseAuth.signInAnonymously();
        firebaseUser = result.user;
        return firebaseUser;
    } catch (error) {
        console.error("Firebase anonymous auth error:", error);
        return null;
    }
}

function firebaseTimestamp() {
    return firebaseReady && firebase.firestore && firebase.firestore.FieldValue
        ? firebase.firestore.FieldValue.serverTimestamp()
        : Date.now();
}

function cloudDocData(data) {
    if (!data) return data;
    const out = { ...data };
    Object.keys(out).forEach(key => {
        if (out[key] && typeof out[key].toDate === "function") {
            out[key] = out[key].toDate().getTime();
        }
    });
    return out;
}

async function firebaseSetDoc(collection, id, data) {
    if (!firebaseReady || !firebaseDb || !id) return false;
    try {
        await ensureFirebaseAuth();
        await firebaseDb.collection(collection).doc(String(id)).set({
            ...data,
            _updatedAt: firebaseTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error(`Firebase set ${collection}/${id}:`, error);
        return false;
    }
}

async function firebaseDeleteDoc(collection, id) {
    if (!firebaseReady || !firebaseDb || !id) return false;
    try {
        await ensureFirebaseAuth();
        await firebaseDb.collection(collection).doc(String(id)).delete();
        return true;
    } catch (error) {
        console.error(`Firebase delete ${collection}/${id}:`, error);
        return false;
    }
}

async function firebaseGetCollection(collection) {
    if (!firebaseReady || !firebaseDb) return [];
    try {
        await ensureFirebaseAuth();
        const snapshot = await firebaseDb.collection(collection).get();
        return snapshot.docs.map(doc => cloudDocData({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Firebase read ${collection}:`, error);
        return [];
    }
}

async function uploadAdImagesToFirebase(images, adId) {
    if (!firebaseReady || !Array.isArray(images) || !images.length) {
        return images || [];
    }

    try {
        if (!firebaseStorage && typeof firebase.storage === "function") {
            firebaseStorage = firebase.storage();
        }
    } catch (storageInitError) {
        console.warn("Firebase Storage غير متاح حاليًا:", storageInitError);
        return images || [];
    }

    if (!firebaseStorage) {
        return images || [];
    }

    const uploaded = [];

    for (let index = 0; index < images.length; index++) {
        const image = images[index];
        if (!image || typeof image !== "string") continue;

        if (!image.startsWith("data:image/")) {
            uploaded.push(image);
            continue;
        }

        try {
            const safeId = String(adId).replace(/[^a-zA-Z0-9_-]/g, "_");
            const ref = firebaseStorage.ref(`ads/${safeId}/${Date.now()}_${index}.jpg`);
            const upload = await ref.putString(image, "data_url", {
                contentType: "image/jpeg",
                cacheControl: "public,max-age=31536000"
            });
            uploaded.push(await upload.ref.getDownloadURL());
        } catch (error) {
            console.error("Firebase image upload error:", error);
            uploaded.push(image);
        }
    }

    return uploaded;
}

async function syncAdToFirebase(ad) {
    if (!ad || !ad.id) return;
    await firebaseSetDoc("ads", ad.id, ad);
}

async function syncAllAdsToFirebase(ads) {
    if (!firebaseReady || !Array.isArray(ads)) return;
    const batch = firebaseDb.batch();
    ads.forEach(ad => {
        if (!ad || !ad.id) return;
        const ref = firebaseDb.collection("ads").doc(String(ad.id));
        batch.set(ref, { ...ad, _updatedAt: firebaseTimestamp() }, { merge: true });
    });
    try {
        await ensureFirebaseAuth();
        await batch.commit();
    } catch (error) {
        console.error("Firebase ads batch error:", error);
    }
}

async function hydrateCloudData() {
    if (!firebaseReady) return;

    await ensureFirebaseAuth();

    try {
        const [cloudAds, cloudUsers, cloudReports, cloudMessages, cloudFollows, cloudNotifications] = await Promise.all([
            firebaseGetCollection("ads"),
            firebaseGetCollection("users"),
            firebaseGetCollection("reports"),
            firebaseGetCollection("messages"),
            firebaseGetCollection("follows"),
            firebaseGetCollection("notifications")
        ]);

        if (cloudAds.length) {
            const localAds = getAds();
            const map = new Map();
            [...localAds, ...cloudAds].forEach(ad => map.set(String(ad.id), ad));
            const merged = Array.from(map.values()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
            localStorage.setItem(ADS_KEY, JSON.stringify(merged));
        } else {
            const localAds = getAds();
            if (localAds.length) await syncAllAdsToFirebase(localAds);
        }

        if (cloudUsers.length) {
            const localUsers = getRegisteredUsers();
            const map = new Map();

            // دمج البيانات بدل استبدالها بالكامل.
            // هذا يحافظ على صورة البروفايل المحلية إذا كان سجل Firebase أقدم ولا يحتوي عليها.
            localUsers.forEach(user => map.set(String(user.id), { ...user }));
            cloudUsers.forEach(user => {
                const key = String(user.id);
                const previous = map.get(key) || {};
                map.set(key, {
                    ...previous,
                    ...user,
                    // لا نستبدل بيانات الملف الشخصي المحفوظة بقيم فارغة من سجل Firebase قديم.
                    photo: user.photo || previous.photo || "",
                    bio: user.bio || previous.bio || "",
                    city: user.city || previous.city || "",
                    name: user.name || previous.name || "مستخدم دوّر",
                    phone: user.phone || previous.phone || ""
                });
            });

            const mergedUsers = Array.from(map.values());
            saveRegisteredUsers(mergedUsers);

            // مزامنة المستخدم الحالي مع السجل المدمج، مع الحفاظ على الصورة.
            const current = getCurrentUser();
            if (current) {
                const matched = mergedUsers.find(item =>
                    String(item.id) === String(current.id)
                );
                if (matched) {
                    saveCurrentUser({ ...matched, ...current, photo: current.photo || matched.photo || "" });
                }
            }
        } else {
            const localUsers = getRegisteredUsers();
            for (const user of localUsers) await firebaseSetDoc("users", user.id, user);
        }

        const currentUserForFollows = getCurrentUser();
        if (currentUserForFollows) {
            const myFollowed = cloudFollows
                .filter(item => String(item.followerId || "") === String(currentUserForFollows.id))
                .map(item => String(item.sellerId || ""))
                .filter(Boolean);
            if (myFollowed.length) {
                saveFollowedSellers(myFollowed);
            }
        }

        if (cloudReports.length) {
            const localReports = getReports();
            const map = new Map();
            [...localReports, ...cloudReports].forEach(report => map.set(String(report.id), report));
            localStorage.setItem("doorrReports", JSON.stringify(Array.from(map.values())));
        }

        if (cloudMessages.length) {
            const localMessages = getMessagesData();
            const map = new Map();
            [...localMessages, ...cloudMessages].forEach(message => map.set(String(message.id), message));
            saveMessagesData(Array.from(map.values()).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)));
        }

        // مزامنة إشعارات الحساب الحالي من Firebase.
        // هذا مهم خصوصًا لإشعارات المتابعة والإشعارات التي أُنشئت على جهاز آخر.
        const currentForNotifications = getCurrentUser();
        if (currentForNotifications && cloudNotifications.length) {
            const currentId = String(currentForNotifications.id);
            const cloudMine = cloudNotifications.filter(item =>
                item && String(item.targetUserId || "") === currentId
            );
            const localMine = getNotifications(currentId);
            const map = new Map();
            [...localMine, ...cloudMine].forEach(item => {
                if (item && item.id) map.set(String(item.id), item);
            });
            const mergedNotifications = Array.from(map.values())
                .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
                .slice(0, 50);
            localStorage.setItem(
                getNotificationsStorageKey(currentId),
                JSON.stringify(mergedNotifications)
            );
        }
    } catch (error) {
        console.error("Firebase hydrate error:", error);
    }
}

initializeFirebase();

/* =========================================================
   STORAGE KEYS
========================================================= */

const CURRENT_USER_KEY = "doorrCurrentUser";
const ADS_KEY = "doorrAds";
const FAVORITES_KEY = "doorrFavorites";
const LOCATION_KEY = "doorrLocation";
const NOTIFICATIONS_KEY = "doorrNotifications";

const MESSAGES_KEY = "doorrMessages";
const CHAT_META_KEY = "doorrChatMeta";
const ACTIVE_CHAT_KEY = "doorrActiveChat";

const ADMIN_AUTH_KEY = "doorrAdminAuth";
const USERS_KEY = "doorrUsers";
const ADMIN_CONFIG = {
    password: "doorr-admin-2026"
};

/* =========================================================
   SECURITY / ANTI-SPAM
========================================================= */

const SECURITY_CONFIG = {
    maxActiveAdsPerUser: 15,
    maxImagesPerAd: 8,
    minTitleLength: 4,
    minDescriptionLength: 8
};

function normalizeAdText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[\s\-_.,،؛;:!?؟/\\]+/g, " ")
        .trim();
}

function getUserActiveAdsCount(userId, excludeAdId = null) {
    return getAds().filter(ad =>
        String(ad.sellerId) === String(userId) &&
        ad.status !== "suspended" &&
        !ad.sold &&
        String(ad.id) !== String(excludeAdId)
    ).length;
}

function findDuplicateAd(candidate, excludeAdId = null) {
    const title = normalizeAdText(candidate.title);
    if (!title) return null;

    return getAds().find(ad => {
        if (String(ad.id) === String(excludeAdId)) return false;
        if (String(ad.sellerId) !== String(candidate.sellerId)) return false;
        if (ad.sold || ad.status === "suspended") return false;

        const sameTitle = normalizeAdText(ad.title) === title;
        const sameCategory = String(ad.category || "") === String(candidate.category || "");
        const sameCity = String(ad.city || "") === String(candidate.city || "");
        const samePrice = Number(ad.price || 0) === Number(candidate.price || 0);

        return sameTitle && sameCategory && sameCity && samePrice;
    }) || null;
}

function validateAdSecurity(candidate, excludeAdId = null) {
    const title = String(candidate.title || "").trim();
    const description = String(candidate.description || "").trim();

    if (title.length < SECURITY_CONFIG.minTitleLength) {
        throw new Error("عنوان الإعلان قصير جدًا");
    }

    if (description && description.length < SECURITY_CONFIG.minDescriptionLength) {
        throw new Error("الوصف قصير جدًا، اكتب تفاصيل أكثر أو اتركه فارغًا");
    }

    if (Array.isArray(candidate.images) && candidate.images.length > SECURITY_CONFIG.maxImagesPerAd) {
        throw new Error(`الحد الأقصى للصور هو ${SECURITY_CONFIG.maxImagesPerAd} صور`);
    }

    const duplicate = findDuplicateAd(candidate, excludeAdId);
    if (duplicate) {
        throw new Error("عندك إعلان مشابه منشور بالفعل بنفس العنوان والسعر والمدينة");
    }

    const activeCount = getUserActiveAdsCount(candidate.sellerId, excludeAdId);
    if (!excludeAdId && activeCount >= SECURITY_CONFIG.maxActiveAdsPerUser) {
        throw new Error(`وصلت للحد الأقصى: ${SECURITY_CONFIG.maxActiveAdsPerUser} إعلان نشط`);
    }

    return true;
}

function getAdSecurityStatus(ad) {
    const reports = getReports();
    const count = reports.filter(report => String(report.adId) === String(ad.id)).length;

    if (ad.status === "suspended") return { label: "موقوف", className: "suspended", reports: count };
    if (ad.sold) return { label: "مباع", className: "sold", reports: count };
    return { label: "نشط", className: "active", reports: count };
}


/* =========================================================
   GLOBAL STATE
========================================================= */

let selectedCategory = "الكل";

let selectedAdImages = [];
let editAdImages = [];

let currentEditingAdId = null;
let currentDetailsAdId = null;

let searchText = "";
let currentSort = "الأحدث";

let carFilters = {
    brand: "", model: "", yearFrom: "", yearTo: "",
    priceFrom: "", priceTo: "", mileageFrom: "", mileageTo: "",
    fuel: "", transmission: "", body: ""
};

let electronicsFilters = {
    type: "", brand: "", model: "", yearFrom: "", yearTo: "",
    priceFrom: "", priceTo: "", condition: "", ram: "", storage: "",
    screenSize: "", color: "", warranty: "", processor: "",
    resolution: "", smart: "", network: ""
};

let currentChatId = null;
let currentChatMeta = null;

let toastTimer = null;

let lastChatSignature = "";

// Firebase Phone Authentication
let phoneConfirmationResult = null;
let phoneAuthRecaptcha = null;
let phoneAuthLastNumber = "";
let phoneAuthBusy = false;


/* =========================================================
   BASIC HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeQuotes(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}


function escapeMessageHTML(value) {

    return escapeHTML(value)
        .replace(/\n/g, "<br>");
}


function generateId(prefix = "id") {

    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );
}


function formatPrice(price) {

    const number = Number(price) || 0;

    return (
        new Intl.NumberFormat("ar-LY", {
            maximumFractionDigits: 2
        }).format(number) +
        " د.ل"
    );
}


function formatDate(timestamp) {

    if (!timestamp) {
        return "";
    }

    try {

        return new Intl.DateTimeFormat(
            "ar-LY",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        ).format(
            new Date(timestamp)
        );

    } catch (error) {

        return "";
    }
}


function getCategoryEmoji(category) {

    const icons = {

        "سيارات": "🚗",
        "إلكترونيات": "📱",
        "عقارات": "🏠",
        "ملابس": "👕",
        "أثاث": "🛋️",
        "معدات": "🔧",
        "حيوانات": "🐕",
        "أخرى": "📦"

    };

    return icons[category] || "📦";
}


function normalizeText(text) {

    return String(text || "")
        .toLowerCase()
        .trim();
}


function normalizePhone(phone) {

    let value = String(phone || "").trim();

    value = value.replace(
        /[^\d+]/g,
        ""
    );

    if (value.startsWith("+218")) {

        value =
            "0" +
            value.substring(4);
    }

    if (value.startsWith("218")) {

        value =
            "0" +
            value.substring(3);
    }

    return value;
}


/* =========================================================
   USER
========================================================= */

function getCurrentUser() {

    try {

        const data =
            localStorage.getItem(
                CURRENT_USER_KEY
            );

        if (!data) {
            return null;
        }

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "User error:",
            error
        );

        return null;
    }
}


function saveCurrentUser(user) {

    localStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify(user)
    );
}


function isLoggedIn() {

    return !!getCurrentUser();
}


function requireLogin() {

    if (!isLoggedIn()) {

        openLogin();

        showToast(
            "سجّل الدخول أولاً",
            "🔐"
        );

        return false;
    }

    return true;
}


/* =========================================================
   USER REGISTRY / ADMIN
========================================================= */

function getRegisteredUsers() {
    try {
        const data = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
        return Array.isArray(data) ? data : [];
    } catch (_) {
        return [];
    }
}

function saveRegisteredUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    if (firebaseReady && Array.isArray(users)) {
        users.forEach(user => {
            if (user && user.id) firebaseSetDoc("users", user.id, user);
        });
    }
}

function registerUser(user) {
    if (!user || !user.id) return;
    const users = getRegisteredUsers();
    const index = users.findIndex(item => String(item.id) === String(user.id));
    const record = {
        id: String(user.id),
        name: user.name || "مستخدم دوّر",
        phone: user.phone || "",
        photo: user.photo || "",
        bio: user.bio || "",
        city: user.city || "",
        createdAt: user.createdAt || Date.now(),
        lastLogin: user.lastLogin || Date.now(),
        suspended: !!user.suspended
    };
    if (index >= 0) users[index] = { ...users[index], ...record };
    else users.push(record);
    saveRegisteredUsers(users);
}

function isAdminAuthenticated() {
    return localStorage.getItem(ADMIN_AUTH_KEY) === "true";
}

function openAdminPanel() {
    if (!isAdminAuthenticated()) {
        openAdminLogin();
        return;
    }
    showPage("adminPage");
    renderAdminDashboard();
}

function openAdminLogin() {
    const old = $("adminLoginModal");
    if (old) old.remove();
    const modal = document.createElement("div");
    modal.id = "adminLoginModal";
    modal.className = "modal";
    modal.style.display = "block";
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeAdminLogin()"></div>
        <div class="modal-box admin-login-box">
            <button type="button" class="modal-close" onclick="closeAdminLogin()">×</button>
            <div class="admin-login-icon">👑</div>
            <h2>دخول الإدارة</h2>
            <p>لوحة تحكم دوّر الخاصة بالإدارة</p>
            <label class="admin-login-label">كلمة مرور الإدارة</label>
            <input id="adminPasswordInput" class="admin-login-input" type="password" autocomplete="off" placeholder="أدخل كلمة المرور">
            <button type="button" class="admin-login-submit" onclick="loginAdmin()">🔐 دخول لوحة الإدارة</button>
            <small class="admin-login-note">هذه النسخة تعمل محليًا على الجهاز. كلمة المرور الافتراضية: <b>doorr-admin-2026</b></small>
        </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
    setTimeout(() => $("adminPasswordInput")?.focus(), 80);
}

function closeAdminLogin() {
    const modal = $("adminLoginModal");
    if (modal) modal.remove();
    if (!$('adDetailsModal') || $('adDetailsModal').style.display !== 'block') document.body.style.overflow = "";
}

function loginAdmin() {
    const input = $("adminPasswordInput");
    if (!input) return;
    if (input.value !== ADMIN_CONFIG.password) {
        showToast("كلمة مرور الإدارة غير صحيحة", "!");
        input.value = "";
        input.focus();
        return;
    }
    localStorage.setItem(ADMIN_AUTH_KEY, "true");
    closeAdminLogin();
    openAdminPanel();
    showToast("تم دخول لوحة الإدارة ✓", "👑");
}

function logoutAdmin() {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    showPage("profilePage");
    updateProfileUI();
    showToast("تم تسجيل الخروج من الإدارة", "✓");
}

function adminGetUsers() {
    const users = getRegisteredUsers();
    const ads = getAds();
    const byId = new Map(users.map(user => [String(user.id), { ...user }]));
    ads.forEach(ad => {
        const id = String(ad.sellerId || "");
        if (!id) return;
        if (!byId.has(id)) {
            byId.set(id, {
                id,
                name: ad.sellerName || "مستخدم دوّر",
                phone: ad.sellerPhone || "",
                photo: "",
                createdAt: ad.createdAt || Date.now(),
                lastLogin: ad.updatedAt || ad.createdAt || Date.now(),
                suspended: false
            });
        }
    });
    return Array.from(byId.values());
}

function adminStats() {
    const ads = getAds();
    const reports = getReports();
    const users = adminGetUsers();
    return {
        users: users.length,
        ads: ads.length,
        active: ads.filter(ad => ad.status !== "suspended" && !ad.sold).length,
        sold: ads.filter(ad => !!ad.sold).length,
        suspended: ads.filter(ad => ad.status === "suspended").length,
        reportsNew: reports.filter(report => report.status === "جديد").length,
        reports: reports.length,
        views: ads.reduce((sum, ad) => sum + Number(ad.views || 0), 0)
    };
}

function formatAdminDate(value) {
    if (!value) return "غير معروف";
    try { return new Date(Number(value)).toLocaleDateString("ar-LY", { day: "numeric", month: "short", year: "numeric" }); }
    catch (_) { return "غير معروف"; }
}

function renderAdminDashboard() {
    if (!isAdminAuthenticated()) return;
    const stats = adminStats();
    const page = $("adminPage");
    if (!page) return;
    const statsBox = $("adminStats");
    if (statsBox) statsBox.innerHTML = `
        <div class="admin-stat"><span>👥</span><strong>${stats.users}</strong><small>المستخدمون</small></div>
        <div class="admin-stat"><span>📦</span><strong>${stats.ads}</strong><small>كل الإعلانات</small></div>
        <div class="admin-stat"><span>🟢</span><strong>${stats.active}</strong><small>نشطة</small></div>
        <div class="admin-stat"><span>🔴</span><strong>${stats.sold}</strong><small>مباعة</small></div>
        <div class="admin-stat"><span>⛔</span><strong>${stats.suspended}</strong><small>موقوفة</small></div>
        <div class="admin-stat ${stats.reportsNew ? "attention" : ""}"><span>🚨</span><strong>${stats.reportsNew}</strong><small>بلاغات جديدة</small></div>`;
    renderAdminAds();
    renderAdminReports();
    renderAdminUsers();
}

function renderAdminAds() {
    const box = $("adminAdsList");
    if (!box) return;
    const query = String($("adminAdSearch")?.value || "").trim().toLowerCase();
    const ads = getAds().filter(ad => !query || `${ad.title || ""} ${ad.city || ""} ${ad.sellerName || ""}`.toLowerCase().includes(query));
    if (!ads.length) {
        box.innerHTML = `<div class="admin-empty">📦<strong>لا توجد إعلانات</strong><span>لم يتم العثور على إعلانات مطابقة.</span></div>`;
        return;
    }
    box.innerHTML = ads.map(ad => {
        const status = getAdSecurityStatus(ad);
        return `<div class="admin-row">
            <div class="admin-row-main">
                <div class="admin-row-image">${getAdImage(ad) ? `<img src="${escapeHTML(getAdImage(ad))}" alt="">` : getCategoryEmoji(ad.category)}</div>
                <div><strong>${escapeHTML(ad.title || "بدون عنوان")}</strong><small>${escapeHTML(ad.city || "")} · ${escapeHTML(ad.sellerName || "مستخدم")}</small><small>${formatPrice(ad.price)} · 👁️ ${Number(ad.views || 0)} · 🚨 ${status.reports}</small></div>
            </div>
            <div class="admin-row-actions">
                <span class="admin-status ${status.className}">${status.label}</span>
                ${ad.status === "suspended" ? `<button onclick="adminSetAdStatus('${escapeQuotes(ad.id)}','active')">🟢 تفعيل</button>` : `<button onclick="adminSetAdStatus('${escapeQuotes(ad.id)}','suspended')">⛔ إيقاف</button>`}
                <button onclick="adminOpenAd('${escapeQuotes(ad.id)}')">👁️ عرض</button>
                <button class="danger" onclick="adminDeleteAd('${escapeQuotes(ad.id)}')">🗑 حذف</button>
            </div>
        </div>`;
    }).join("");
}

function adminOpenAd(adId) {
    closeAdminPanelToDetails();
    openAdDetails(adId);
}

function closeAdminPanelToDetails() {
    const page = $("adminPage");
    if (page) page.style.display = "none";
}

function adminSetAdStatus(adId, status) {
    if (!isAdminAuthenticated()) return;
    const ads = getAds();
    const ad = ads.find(item => String(item.id) === String(adId));
    if (!ad) return;
    ad.status = status;
    if (status === "active") ad.sold = false;
    ad.updatedAt = Date.now();
    saveAds(ads);
    addNotification(
        status === "suspended" ? "إيقاف إعلانك" : "إعادة تفعيل إعلانك",
        status === "suspended" ? `تم إيقاف إعلانك «${ad.title || ""}» من إدارة دوّر للمراجعة.` : `تمت إعادة تفعيل إعلانك «${ad.title || ""}».`,
        status === "suspended" ? "⛔" : "🟢",
        ad.sellerId,
        { type: "admin_status", adId: ad.id }
    );
    renderAdminDashboard();
    renderAllAds(); renderSearchPage(); renderMyAds(); renderFavorites();
    showToast(status === "suspended" ? "تم إيقاف الإعلان" : "تم تفعيل الإعلان", "✓");
}

function adminDeleteAd(adId) {
    if (!isAdminAuthenticated()) return;
    const ad = findAd(adId);
    if (!ad) return;
    if (!confirm(`حذف الإعلان «${ad.title || ""}» نهائيًا؟`)) return;
    saveAds(getAds().filter(item => String(item.id) !== String(adId)));
    saveReports(getReports().filter(report => String(report.adId) !== String(adId)));
    renderAdminDashboard(); renderAllAds(); renderSearchPage(); renderMyAds(); renderFavorites();
    showToast("تم حذف الإعلان", "✓");
}

function renderAdminReports() {
    const box = $("adminReportsList");
    if (!box) return;
    const reports = getReports().slice().sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    if (!reports.length) {
        box.innerHTML = `<div class="admin-empty">🛡️<strong>ما فيش بلاغات</strong><span>كل شيء هادئ حاليًا.</span></div>`;
        return;
    }
    box.innerHTML = reports.map(report => `<div class="admin-report-row">
        <div class="admin-report-icon">🚨</div>
        <div class="admin-report-main"><strong>${escapeHTML(report.adTitle || "إعلان")}</strong><span>${escapeHTML(report.reason || "سبب غير محدد")}</span><small>${escapeHTML(report.details || "بدون تفاصيل")} · ${formatAdminDate(report.createdAt)}</small></div>
        <span class="admin-report-status ${report.status === "مغلق" ? "closed" : "new"}">${escapeHTML(report.status || "جديد")}</span>
        <div class="admin-row-actions"><button onclick="adminReviewReport('${escapeQuotes(report.id)}')">${report.status === "مغلق" ? "📄 فتح" : "✅ مراجعة"}</button></div>
    </div>`).join("");
}

function adminReviewReport(reportId) {
    if (!isAdminAuthenticated()) return;
    const reports = getReports();
    const report = reports.find(item => String(item.id) === String(reportId));
    if (!report) return;
    const ad = findAd(report.adId);
    const action = prompt(`بلاغ: ${report.reason}\nالإعلان: ${report.adTitle}\n\nاكتب الإجراء:\n1 = إغلاق البلاغ فقط\n2 = إيقاف الإعلان وإغلاق البلاغ\n3 = حذف الإعلان وإغلاق البلاغ`, "1");
    if (!action) return;
    if (action === "2" && ad) {
        ad.status = "suspended"; ad.sold = false; ad.updatedAt = Date.now();
        saveAds(getAds());
        addNotification("تم إيقاف إعلانك", `تم إيقاف إعلانك «${ad.title || ""}» من إدارة دوّر للمراجعة.`, "⛔", ad.sellerId, { type: "admin_report", adId: ad.id });
    } else if (action === "3" && ad) {
        saveAds(getAds().filter(item => String(item.id) !== String(ad.id)));
    }
    report.status = "مغلق";
    report.reviewedAt = Date.now();
    report.reviewAction = action;
    saveReports(reports);
    renderAdminDashboard(); renderAllAds(); renderSearchPage(); renderMyAds(); renderFavorites();
    showToast("تمت مراجعة البلاغ", "✓");
}

function renderAdminUsers() {
    const box = $("adminUsersList");
    if (!box) return;
    const users = adminGetUsers().sort((a,b) => Number(b.lastLogin || 0) - Number(a.lastLogin || 0));
    if (!users.length) {
        box.innerHTML = `<div class="admin-empty">👥<strong>ما فيش مستخدمين مسجلين</strong><span>المستخدمون يظهرون بعد تسجيل الدخول.</span></div>`;
        return;
    }
    const ads = getAds();
    box.innerHTML = users.map(user => {
        const count = ads.filter(ad => String(ad.sellerId) === String(user.id)).length;
        const suspended = !!user.suspended;
        return `<div class="admin-user-row">
            <div class="admin-user-avatar">${user.photo ? `<img src="${escapeHTML(user.photo)}" alt="">` : escapeHTML((user.name || "م").charAt(0))}</div>
            <div class="admin-user-main"><strong>${escapeHTML(user.name || "مستخدم دوّر")}</strong><span>📱 ${escapeHTML(user.phone || "غير متوفر")}</span><small>${count} إعلان · آخر دخول ${formatAdminDate(user.lastLogin)}</small></div>
            <span class="admin-user-status ${suspended ? "blocked" : "ok"}">${suspended ? "موقوف" : "نشط"}</span>
            <button onclick="adminToggleUser('${escapeQuotes(user.id)}')">${suspended ? "🟢 تفعيل" : "⛔ إيقاف"}</button>
        </div>`;
    }).join("");
}

function adminToggleUser(userId) {
    if (!isAdminAuthenticated()) return;
    const users = getRegisteredUsers();
    const index = users.findIndex(user => String(user.id) === String(userId));
    if (index < 0) return;
    users[index].suspended = !users[index].suspended;
    saveRegisteredUsers(users);
    renderAdminDashboard();
    showToast(users[index].suspended ? "تم إيقاف المستخدم" : "تم تفعيل المستخدم", "✓");
}

function adminRefresh() {
    renderAdminDashboard();
    showToast("تم تحديث لوحة الإدارة", "↻");
}

/* =========================================================
   ADS STORAGE
========================================================= */

function getAds() {

    try {

        const data =
            localStorage.getItem(
                ADS_KEY
            );

        if (!data) {
            return [];
        }

        const ads =
            JSON.parse(data);

        return Array.isArray(ads)
            ? ads
            : [];

    } catch (error) {

        console.error(
            "Ads error:",
            error
        );

        return [];
    }
}


function saveAds(ads) {

    const safeAds = Array.isArray(ads) ? ads : [];
    localStorage.setItem(
        ADS_KEY,
        JSON.stringify(safeAds)
    );

    if (firebaseReady && firebaseDb) {
        const previousIds = (() => {
            try {
                return JSON.parse(localStorage.getItem("doorrCloudAdIds") || "[]");
            } catch (_) { return []; }
        })();
        const currentIds = safeAds.map(ad => String(ad.id));

        safeAds.forEach(ad => {
            if (ad && ad.id) firebaseSetDoc("ads", ad.id, ad);
        });
        previousIds
            .filter(id => !currentIds.includes(String(id)))
            .forEach(id => firebaseDeleteDoc("ads", id));

        localStorage.setItem("doorrCloudAdIds", JSON.stringify(currentIds));
    }
}


function findAd(id) {

    return getAds().find(
        ad =>
            String(ad.id) ===
            String(id)
    );
}


function getUserAds() {

    const user =
        getCurrentUser();

    if (!user) {
        return [];
    }

    return getAds().filter(
        ad =>
            String(ad.sellerId) ===
            String(user.id)
    );
}


function userOwnsAd(ad) {

    const user =
        getCurrentUser();

    if (!user || !ad) {
        return false;
    }

    return (
        String(ad.sellerId) ===
        String(user.id)
    );
}


/* =========================================================
   FAVORITES
========================================================= */

function getFavorites() {

    try {

        const data =
            localStorage.getItem(
                FAVORITES_KEY
            );

        if (!data) {
            return [];
        }

        const favorites =
            JSON.parse(data);

        return Array.isArray(favorites)
            ? favorites
            : [];

    } catch (error) {

        return [];
    }
}


function saveFavorites(favorites) {

    localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favorites)
    );
}


function isFavorite(adId) {

    return getFavorites().some(
        id =>
            String(id) ===
            String(adId)
    );
}


function toggleFavorite(
    adId,
    event
) {

    if (event) {
        event.stopPropagation();
    }

    let favorites =
        getFavorites();

    const index =
        favorites.findIndex(
            id =>
                String(id) ===
                String(adId)
        );

    if (index >= 0) {

        favorites.splice(
            index,
            1
        );

        showToast(
            "تمت إزالة الإعلان من المفضلة",
            "♡"
        );

    } else {

        favorites.push(adId);

        showToast(
            "تمت إضافة الإعلان للمفضلة",
            "❤️"
        );
    }

    saveFavorites(favorites);

    renderAllAds();
    renderFavorites();

    if (currentDetailsAdId) {

        openAdDetails(
            currentDetailsAdId,
            true
        );
    }
}


/* =========================================================
   LOCATION
========================================================= */

function getLocation() {

    return (
        localStorage.getItem(
            LOCATION_KEY
        ) ||
        "كل ليبيا"
    );
}


function setLocation(location) {

    localStorage.setItem(
        LOCATION_KEY,
        location
    );

    const current =
        $("currentLocation");

    if (current) {
        current.textContent =
            location;
    }

    closeLocation();

    renderAllAds();
    renderSearchPage();
    renderFavorites();

    showToast(
        "تم تغيير الموقع إلى " + location,
        "📍"
    );
}


function openLocation() {

    const modal =
        $("locationModal");

    if (!modal) {
        return;
    }

    modal.style.display =
        "block";

    document.body.style.overflow =
        "hidden";
}


function closeLocation() {

    const modal =
        $("locationModal");

    if (!modal) {
        return;
    }

    modal.style.display =
        "none";

    document.body.style.overflow =
        "";
}


function matchesLocation(ad) {

    const location =
        getLocation();

    if (
        !location ||
        location === "كل ليبيا"
    ) {
        return true;
    }

    return (
        String(ad.city || "") ===
        String(location)
    );
}


/* =========================================================
   SEARCH
========================================================= */

function adMatchesSearch(
    ad,
    text
) {

    if (!text) {
        return true;
    }

    const query =
        normalizeText(text);

    const content = [
        ad.title,
        ad.description,
        ad.category,
        ad.city,
        ad.sellerName
    ]
        .map(normalizeText)
        .join(" ");

    return content.includes(
        query
    );
}


function searchItems() {

    const input =
        $("searchInput");

    searchText =
        input
            ? input.value.trim()
            : "";

    renderAllAds();
}


function pageSearch() {

    const input =
        $("pageSearchInput");

    searchText =
        input
            ? input.value.trim()
            : "";

    renderSearchPage();
}


function clearSearch() {

    searchText = "";

    if ($("searchInput")) {
        $("searchInput").value = "";
    }

    if ($("pageSearchInput")) {
        $("pageSearchInput").value = "";
    }

    renderAllAds();
    renderSearchPage();
}


/* =========================================================
   CATEGORIES
========================================================= */

function selectCategory(category) {

    selectedCategory =
        category;

    if (category !== "سيارات") {
        resetCarFilters();
    }

    searchText = "";

    if ($("searchInput")) {
        $("searchInput").value = "";
    }

    renderAllAds();

    showToast(
        "قسم " + category,
        "📂"
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function filterByCategory(category) {

    selectedCategory =
        category;

    renderAllAds();
}


function filterProducts(category) {

    filterByCategory(category);
}


function showAllCategories() {

    selectedCategory =
        "الكل";

    renderAllAds();

    showToast(
        "تم عرض جميع الأقسام",
        "📂"
    );
}


/* =========================================================
   SORT / FILTER
========================================================= */

function sortAds(ads) {

    const list = [
        ...ads
    ];

    if (
        currentSort ===
        "الأقل سعرًا"
    ) {

        return list.sort(
            (a, b) =>
                Number(a.price || 0) -
                Number(b.price || 0)
        );
    }

    if (
        currentSort ===
        "الأعلى سعرًا"
    ) {

        return list.sort(
            (a, b) =>
                Number(b.price || 0) -
                Number(a.price || 0)
        );
    }

    return list.sort(
        (a, b) =>
            Number(b.createdAt || 0) -
            Number(a.createdAt || 0)
    );
}


function applyFilter(type) {

    currentSort =
        type;

    closeFilters();

    renderAllAds();
    renderSearchPage();
    renderFavorites();

    showToast(
        "تم الترتيب: " + type,
        "✓"
    );
}


function applyCategoryFilter(category) {

    selectedCategory =
        category;

    closeFilters();

    renderAllAds();
    renderSearchPage();
    renderFavorites();
}


function openFilters() {

    const modal = $("filtersModal");
    if (!modal) return;

    const options = modal.querySelector(".filter-options");
    if (options) {
        options.innerHTML = selectedCategory === "سيارات"
            ? carFilterHTML()
            : selectedCategory === "إلكترونيات"
                ? electronicsFilterHTML()
                : `
                <button type="button" onclick="applyFilter('الأحدث')">🕐 الأحدث أولاً</button>
                <button type="button" onclick="applyFilter('الأقل سعرًا')">💰 الأقل سعرًا</button>
                <button type="button" onclick="applyFilter('الأعلى سعرًا')">💰 الأعلى سعرًا</button>
              `;
    }

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
}


function closeFilters() {

    const modal =
        $("filtersModal");

    if (!modal) {
        return;
    }

    modal.style.display =
        "none";

    document.body.style.overflow =
        "";
}


/* =========================================================
   CAR FIELDS + CAR FILTERS
========================================================= */

const CAR_BRANDS = ["تويوتا","هيونداي","كيا","مرسيدس","بي إم دبليو","أودي","نيسان","هوندا","فورد","شيفروليه","ميتسوبيشي","لكزس","رينو","بيجو","فولكس واجن","فيات","جيلي","شيري","أخرى"];

function carBrandOptions(selected = "") {
    return `<option value="">اختر الماركة</option>` + CAR_BRANDS.map(x => `<option value="${escapeHTML(x)}" ${String(selected)===String(x)?"selected":""}>${escapeHTML(x)}</option>`).join("");
}

function ensureCarFields(type="add", force=false) {
    const category = $(type === "edit" ? "editAdCategory" : "adCategory");
    if (!category) return;
    const id = type === "edit" ? "editAdCarFields" : "adCarFields";
    let box = $(id);
    if (category.value !== "سيارات") {
        if (box) box.style.display="none";
        return;
    }

    /*
       مهم جدًا: لا نعيد بناء الحقول كل مرة.
       publishAd/saveEditedAd يستدعيان هذه الدالة قبل القراءة،
       ولو أعدنا innerHTML هنا سنمسح القيم التي كتبها المستخدم.
    */
    if (box && !force) {
        box.style.display="block";
        return;
    }

    if (!box) {
        box=document.createElement("div");
        box.id=id;
        box.className="car-fields-box";
        const row=category.closest(".form-row");
        if (row) row.insertAdjacentElement("afterend",box);
        else category.parentElement.appendChild(box);
    }

    const old = type === "edit" && currentEditingAdId ? (findAd(currentEditingAdId)?.car || {}) : {};
    const pre = type === "edit" ? "edit" : "";
    box.innerHTML=`
      <div class="car-fields-title">🚗 بيانات السيارة</div>
      <div class="form-row">
        <div class="form-group"><label>الماركة</label><select id="${pre}CarBrand">${carBrandOptions(old.brand||"")}</select></div>
        <div class="form-group"><label>الموديل</label><input id="${pre}CarModel" value="${escapeHTML(old.model||"")}" placeholder="مثال: Elantra"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>سنة الصنع</label><input id="${pre}CarYear" type="number" min="1950" max="${new Date().getFullYear()+1}" value="${escapeHTML(old.year||"")}" placeholder="2018"></div>
        <div class="form-group"><label>الممشى (كم)</label><input id="${pre}CarMileage" type="number" min="0" value="${escapeHTML(old.mileage||"")}" placeholder="120000"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>الوقود</label><select id="${pre}CarFuel"><option value="">الكل</option>${["بنزين","ديزل","هايبرد","كهرباء","غاز","أخرى"].map(x=>`<option value="${x}" ${old.fuel===x?"selected":""}>${x}</option>`).join("")}</select></div>
        <div class="form-group"><label>القير</label><select id="${pre}CarTransmission"><option value="">الكل</option>${["أوتوماتيك","عادي","CVT","نصف أوتوماتيك"].map(x=>`<option value="${x}" ${old.transmission===x?"selected":""}>${x}</option>`).join("")}</select></div>
      </div>
      <div class="form-group"><label>نوع السيارة</label><select id="${pre}CarBody"><option value="">الكل</option>${["سيدان","SUV","دفع رباعي","بيك أب","كوبيه","هاتشباك","فان","شاحنة","أخرى"].map(x=>`<option value="${x}" ${old.body===x?"selected":""}>${x}</option>`).join("")}</select></div>`;
    box.style.display="block";
}

function readCarFields(type="add") {
    const category=$(type==="edit"?"editAdCategory":"adCategory")?.value;
    if(category!=="سيارات") return null;
    const p=type==="edit"?"edit":"";
    return {brand:$(p+"CarBrand")?.value||"",model:$(p+"CarModel")?.value.trim()||"",year:$(p+"CarYear")?.value||"",mileage:$(p+"CarMileage")?.value||"",fuel:$(p+"CarFuel")?.value||"",transmission:$(p+"CarTransmission")?.value||"",body:$(p+"CarBody")?.value||""};
}

function resetCarFilters(){ carFilters={brand:"",model:"",yearFrom:"",yearTo:"",priceFrom:"",priceTo:"",mileageFrom:"",mileageTo:"",fuel:"",transmission:"",body:""}; }

function matchesCarFilters(ad){
    if(selectedCategory!=="سيارات") return true;
    const f=carFilters,c=ad.car||{};
    if(f.brand && c.brand!==f.brand) return false;
    if(f.model && !String(c.model||"").toLowerCase().includes(f.model.toLowerCase())) return false;
    if(f.yearFrom && Number(c.year||0)<Number(f.yearFrom)) return false;
    if(f.yearTo && Number(c.year||0)>Number(f.yearTo)) return false;
    if(f.priceFrom && Number(ad.price||0)<Number(f.priceFrom)) return false;
    if(f.priceTo && Number(ad.price||0)>Number(f.priceTo)) return false;
    if(f.mileageFrom && Number(c.mileage||0)<Number(f.mileageFrom)) return false;
    if(f.mileageTo && Number(c.mileage||0)>Number(f.mileageTo)) return false;
    if(f.fuel && c.fuel!==f.fuel) return false;
    if(f.transmission && c.transmission!==f.transmission) return false;
    if(f.body && c.body!==f.body) return false;
    return true;
}

function carFilterHTML(){
 const f=carFilters;
 return `<div class="car-filter-box"><div class="car-fields-title">🚗 فلترة السيارات</div>
 <div class="form-group"><label>الماركة</label><select id="filterCarBrand">${carBrandOptions(f.brand)}</select></div>
 <div class="form-group"><label>الموديل</label><input id="filterCarModel" value="${escapeHTML(f.model)}" placeholder="مثال: Elantra"></div>
 <div class="form-row"><div class="form-group"><label>سنة من</label><input id="filterYearFrom" type="number" value="${escapeHTML(f.yearFrom)}"></div><div class="form-group"><label>سنة إلى</label><input id="filterYearTo" type="number" value="${escapeHTML(f.yearTo)}"></div></div>
 <div class="form-row"><div class="form-group"><label>السعر من</label><input id="filterPriceFrom" type="number" min="0" value="${escapeHTML(f.priceFrom)}"></div><div class="form-group"><label>السعر إلى</label><input id="filterPriceTo" type="number" min="0" value="${escapeHTML(f.priceTo)}"></div></div>
 <div class="form-row"><div class="form-group"><label>الممشى من</label><input id="filterMileageFrom" type="number" min="0" value="${escapeHTML(f.mileageFrom)}"></div><div class="form-group"><label>الممشى إلى</label><input id="filterMileageTo" type="number" min="0" value="${escapeHTML(f.mileageTo)}"></div></div>
 <div class="form-row"><div class="form-group"><label>الوقود</label><select id="filterCarFuel"><option value="">الكل</option>${["بنزين","ديزل","هايبرد","كهرباء","غاز","أخرى"].map(x=>`<option value="${x}" ${f.fuel===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-group"><label>القير</label><select id="filterCarTransmission"><option value="">الكل</option>${["أوتوماتيك","عادي","CVT","نصف أوتوماتيك"].map(x=>`<option value="${x}" ${f.transmission===x?"selected":""}>${x}</option>`).join("")}</select></div></div>
 <div class="form-group"><label>نوع السيارة</label><select id="filterCarBody"><option value="">الكل</option>${["سيدان","SUV","دفع رباعي","بيك أب","كوبيه","هاتشباك","فان","شاحنة","أخرى"].map(x=>`<option value="${x}" ${f.body===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="car-filter-actions"><button type="button" class="primary-btn" onclick="applyCarFilters()">تطبيق الفلاتر</button><button type="button" class="secondary-btn" onclick="clearCarFilters()">مسح الفلاتر</button></div></div>`;
}

function applyCarFilters(){ carFilters={brand:$("filterCarBrand")?.value||"",model:$("filterCarModel")?.value.trim()||"",yearFrom:$("filterYearFrom")?.value||"",yearTo:$("filterYearTo")?.value||"",priceFrom:$("filterPriceFrom")?.value||"",priceTo:$("filterPriceTo")?.value||"",mileageFrom:$("filterMileageFrom")?.value||"",mileageTo:$("filterMileageTo")?.value||"",fuel:$("filterCarFuel")?.value||"",transmission:$("filterCarTransmission")?.value||"",body:$("filterCarBody")?.value||""}; closeFilters(); renderAllAds(); renderSearchPage(); renderFavorites(); showToast("تم تطبيق فلاتر السيارات","🚗"); }
function clearCarFilters(){ resetCarFilters(); closeFilters(); renderAllAds(); renderSearchPage(); renderFavorites(); showToast("تم مسح فلاتر السيارات","✓"); }
function setupCarFeatures(){ ["adCategory","editAdCategory"].forEach(id=>{const el=$(id); if(!el||el.dataset.carReady) return; el.dataset.carReady="1"; el.addEventListener("change",()=>ensureCarFields(id==="editAdCategory"?"edit":"add", true));}); }

function electronicsBrandOptions(selected = "") {
    const brands = ["Apple","Samsung","Xiaomi","Huawei","Lenovo","HP","Dell","Asus","Acer","Sony","LG","TCL","Nintendo","PlayStation","Xbox","Canon","Nikon","JBL","Anker","Casio","Epson","Brother","أخرى"];
    return `<option value="">اختر الماركة</option>` + brands.map(x => `<option value="${escapeHTML(x)}" ${String(selected)===String(x)?"selected":""}>${escapeHTML(x)}</option>`).join("");
}

const ELECTRONICS_TYPES = ["هواتف","لابتوبات","تلفزيونات","ألعاب","صوتيات","كاميرات","ساعات","شاشات","طابعات","أخرى"];
const ELECTRONICS_CONDITIONS = ["جديد","مستعمل","مجدد"];
const ELECTRONICS_RAM = ["2GB","4GB","6GB","8GB","12GB","16GB","24GB","32GB","64GB","أخرى"];
const ELECTRONICS_STORAGE = ["32GB","64GB","128GB","256GB","512GB","1TB","2TB","4TB","أخرى"];
const ELECTRONICS_COLORS = ["أسود","أبيض","فضي","ذهبي","أزرق","أحمر","أخضر","رمادي","أخرى"];

function electronicsSelect(id, label, options, selected="") {
    return `<div class="form-group"><label>${label}</label><select id="${id}"><option value="">الكل</option>${options.map(x=>`<option value="${escapeHTML(x)}" ${String(selected)===String(x)?"selected":""}>${escapeHTML(x)}</option>`).join("")}</select></div>`;
}

function ensureElectronicsFields(type="add", force=false) {
    const category = $(type === "edit" ? "editAdCategory" : "adCategory");
    if (!category) return;

    const id = type === "edit" ? "editAdElectronicsFields" : "adElectronicsFields";
    let box = $(id);

    if (category.value !== "إلكترونيات") {
        if (box) box.style.display = "none";
        return;
    }

    // عند إعادة البناء بسبب تغيير نوع الجهاز، نحفظ القيم التي كتبها المستخدم أولاً.
    const pre = type === "edit" ? "edit" : "";
    let current = {};
    if (box) {
        current = {
            type: $(pre+"ElectronicsType")?.value || "",
            brand: $(pre+"ElectronicsBrand")?.value || "",
            model: $(pre+"ElectronicsModel")?.value || "",
            year: $(pre+"ElectronicsYear")?.value || "",
            condition: $(pre+"ElectronicsCondition")?.value || "",
            ram: $(pre+"ElectronicsRam")?.value || "",
            storage: $(pre+"ElectronicsStorage")?.value || "",
            screenSize: $(pre+"ElectronicsScreenSize")?.value || "",
            color: $(pre+"ElectronicsColor")?.value || "",
            warranty: $(pre+"ElectronicsWarranty")?.value || "",
            processor: $(pre+"ElectronicsProcessor")?.value || "",
            resolution: $(pre+"ElectronicsResolution")?.value || "",
            smart: $(pre+"ElectronicsSmart")?.value || "",
            network: $(pre+"ElectronicsNetwork")?.value || "",
            displayTech: $(pre+"ElectronicsDisplayTech")?.value || "",
            refreshRate: $(pre+"ElectronicsRefreshRate")?.value || "",
            megapixels: $(pre+"ElectronicsMegapixels")?.value || "",
            lens: $(pre+"ElectronicsLens")?.value || "",
            connectivity: $(pre+"ElectronicsConnectivity")?.value || "",
            generation: $(pre+"ElectronicsGeneration")?.value || "",
            os: $(pre+"ElectronicsOS")?.value || "",
            battery: $(pre+"ElectronicsBattery")?.value || "",
            size: $(pre+"ElectronicsSize")?.value || "",
            power: $(pre+"ElectronicsPower")?.value || "",
            printerType: $(pre+"ElectronicsPrinterType")?.value || "",
            colorPrint: $(pre+"ElectronicsColorPrint")?.value || ""
        };
    }

    const saved = type === "edit" && currentEditingAdId
        ? (findAd(currentEditingAdId)?.electronics || {})
        : {};
    const old = Object.assign({}, saved, current);
    const t = old.type || "هواتف";

    if (!box) {
        box = document.createElement("div");
        box.id = id;
        box.className = "electronics-fields-box car-fields-box";
        const row = category.closest(".form-row");
        if (row) row.insertAdjacentElement("afterend", box);
        else if (category.parentElement) category.parentElement.appendChild(box);
    }

    const val = key => escapeHTML(old[key] || "");
    const select = (id2, label, options, selected="") =>
        `<div class="form-group"><label>${label}</label><select id="${id2}"><option value="">اختر</option>${options.map(x => `<option value="${escapeHTML(x)}" ${String(selected)===String(x)?"selected":""}>${escapeHTML(x)}</option>`).join("")}</select></div>`;
    const input = (id2, label, value, placeholder="") =>
        `<div class="form-group"><label>${label}</label><input id="${id2}" value="${val(value)}" placeholder="${placeholder}"></div>`;

    const commonTop = `
      <div class="car-fields-title">📱 مواصفات الإلكترونيات</div>
      <div class="form-row">
        ${electronicsSelect(pre+"ElectronicsType","نوع الجهاز",ELECTRONICS_TYPES,t)}
        <div class="form-group"><label>الماركة</label><select id="${pre}ElectronicsBrand">${electronicsBrandOptions(old.brand||"")}</select></div>
      </div>
      <div class="form-row">
        ${input(pre+"ElectronicsModel","الموديل","model","مثال: 55 C Series / iPhone 15 Pro")}
        ${input(pre+"ElectronicsYear","سنة الصنع","year","2024")}
      </div>
      <div class="form-row">
        ${electronicsSelect(pre+"ElectronicsCondition","الحالة",ELECTRONICS_CONDITIONS,old.condition||"")}
        <div class="form-group"><label>اللون</label><select id="${pre}ElectronicsColor"><option value="">اختر</option>${ELECTRONICS_COLORS.map(x=>`<option value="${x}" ${old.color===x?"selected":""}>${x}</option>`).join("")}</select></div>
      </div>`;

    let specific = "";

    if (t === "تلفزيونات") {
        specific = `
        <div class="form-row">
            ${input(pre+"ElectronicsScreenSize","حجم الشاشة","screenSize","55 بوصة")}
            ${input(pre+"ElectronicsResolution","الدقة","resolution","4K / 8K / Full HD")}
        </div>
        <div class="form-row">
            ${select(pre+"ElectronicsDisplayTech","تقنية الشاشة",["LED","QLED","OLED","Mini LED","NanoCell","Plasma","أخرى"],old.displayTech)}
            ${select(pre+"ElectronicsRefreshRate","معدل التحديث",["60Hz","90Hz","120Hz","144Hz","240Hz"],old.refreshRate)}
        </div>
        <div class="form-row">
            ${select(pre+"ElectronicsSmart","Smart TV",["نعم","لا"],old.smart)}
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Wi-Fi","Wi-Fi + Ethernet","Wi-Fi + Bluetooth","أخرى"],old.connectivity)}
        </div>
        <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / سنة / بدون ضمان"></div>`;
    } else if (t === "هواتف") {
        specific = `
        <div class="form-row">
            <div class="form-group"><label>RAM</label><select id="${pre}ElectronicsRam"><option value="">اختر</option>${ELECTRONICS_RAM.map(x=>`<option value="${x}" ${old.ram===x?"selected":""}>${x}</option>`).join("")}</select></div>
            <div class="form-group"><label>التخزين</label><select id="${pre}ElectronicsStorage"><option value="">اختر</option>${ELECTRONICS_STORAGE.map(x=>`<option value="${x}" ${old.storage===x?"selected":""}>${x}</option>`).join("")}</select></div>
        </div>
        <div class="form-row">
            ${input(pre+"ElectronicsScreenSize","حجم الشاشة","screenSize","6.7 بوصة")}
            ${input(pre+"ElectronicsProcessor","المعالج","processor","Snapdragon / A17 Pro")}
        </div>
        <div class="form-row">
            ${input(pre+"ElectronicsResolution","الدقة","resolution","FHD+ / 2K")}
            ${select(pre+"ElectronicsNetwork","الشبكة",["4G","5G","Wi-Fi","Wi-Fi + Cellular"],old.network)}
        </div>
        <div class="form-row">
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Bluetooth","NFC","Bluetooth + NFC","أخرى"],old.connectivity)}
            ${input(pre+"ElectronicsOS","نظام التشغيل","os","Android / iOS")}
        </div>
        <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / 6 أشهر / بدون ضمان"></div>`;
    } else if (t === "لابتوبات") {
        specific = `
        <div class="form-row">
            ${input(pre+"ElectronicsProcessor","المعالج","processor","Core i7 / Ryzen 7 / M3")}
            ${input(pre+"ElectronicsScreenSize","حجم الشاشة","screenSize","15.6 بوصة")}
        </div>
        <div class="form-row">
            <div class="form-group"><label>RAM</label><select id="${pre}ElectronicsRam"><option value="">اختر</option>${ELECTRONICS_RAM.map(x=>`<option value="${x}" ${old.ram===x?"selected":""}>${x}</option>`).join("")}</select></div>
            <div class="form-group"><label>التخزين</label><select id="${pre}ElectronicsStorage"><option value="">اختر</option>${ELECTRONICS_STORAGE.map(x=>`<option value="${x}" ${old.storage===x?"selected":""}>${x}</option>`).join("")}</select></div>
        </div>
        <div class="form-row">
            ${input(pre+"ElectronicsResolution","الدقة","resolution","Full HD / 2.5K / 4K")}
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Wi-Fi","Wi-Fi + Bluetooth","Wi-Fi + Ethernet","أخرى"],old.connectivity)}
        </div>
        <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / سنة / بدون ضمان"></div>`;
    } else if (t === "ألعاب") {
        specific = `
        <div class="form-row">
            ${input(pre+"ElectronicsGeneration","الجيل / الإصدار","generation","PS5 / Xbox Series X")}
            <div class="form-group"><label>التخزين</label><select id="${pre}ElectronicsStorage"><option value="">اختر</option>${ELECTRONICS_STORAGE.map(x=>`<option value="${x}" ${old.storage===x?"selected":""}>${x}</option>`).join("")}</select></div>
        </div>
        <div class="form-row">
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Wi-Fi","Wi-Fi + Bluetooth","Bluetooth","أخرى"],old.connectivity)}
            ${input(pre+"ElectronicsBattery","البطارية","battery","ساعات / mAh")}
        </div>
        <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / بدون ضمان"></div>`;
    } else if (t === "كاميرات") {
        specific = `
        <div class="form-row">
            ${input(pre+"ElectronicsMegapixels","الدقة / ميجابكسل","megapixels","24MP")}
            ${input(pre+"ElectronicsLens","العدسة","lens","18-55mm")}
        </div>
        <div class="form-row">
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Wi-Fi","Bluetooth","Wi-Fi + Bluetooth","أخرى"],old.connectivity)}
            <div class="form-group"><label>التخزين</label><select id="${pre}ElectronicsStorage"><option value="">اختر</option>${ELECTRONICS_STORAGE.map(x=>`<option value="${x}" ${old.storage===x?"selected":""}>${x}</option>`).join("")}</select></div>
        </div>
        <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / بدون ضمان"></div>`;
    } else if (t === "صوتيات") {
        specific = `
        <div class="form-row">
            ${input(pre+"ElectronicsPower","القدرة","power","100W")}
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Bluetooth","Wi-Fi","Bluetooth + Wi-Fi","AUX","أخرى"],old.connectivity)}
        </div>
        <div class="form-row">
            ${input(pre+"ElectronicsBattery","البطارية","battery","10 ساعات")}
            <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / بدون ضمان"></div>
        </div>`;
    } else if (t === "ساعات") {
        specific = `
        <div class="form-row">
            ${input(pre+"ElectronicsSize","المقاس","size","44mm")}
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Bluetooth","Bluetooth + Wi-Fi","LTE","أخرى"],old.connectivity)}
        </div>
        <div class="form-row">
            ${input(pre+"ElectronicsBattery","البطارية","battery","18 ساعة")}
            ${input(pre+"ElectronicsOS","النظام","os","watchOS / Wear OS")}
        </div>
        <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / بدون ضمان"></div>`;
    } else if (t === "طابعات") {
        specific = `
        <div class="form-row">
            ${select(pre+"ElectronicsPrinterType","نوع الطابعة",["Inkjet","Laser","Thermal","Multifunction","أخرى"],old.printerType)}
            ${select(pre+"ElectronicsColorPrint","الطباعة الملونة",["نعم","لا"],old.colorPrint)}
        </div>
        <div class="form-row">
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Wi-Fi","USB","Wi-Fi + USB","Ethernet","أخرى"],old.connectivity)}
            <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / بدون ضمان"></div>
        </div>`;
    } else {
        specific = `
        <div class="form-row">
            ${input(pre+"ElectronicsScreenSize","الحجم / المقاس","screenSize","حسب الجهاز")}
            ${select(pre+"ElectronicsConnectivity","الاتصال",["Wi-Fi","Bluetooth","Wi-Fi + Bluetooth","USB","أخرى"],old.connectivity)}
        </div>
        <div class="form-row">
            ${input(pre+"ElectronicsBattery","البطارية","battery","اختياري")}
            <div class="form-group"><label>الضمان</label><input id="${pre}ElectronicsWarranty" value="${val("warranty")}" placeholder="ساري / بدون ضمان"></div>
        </div>`;
    }

    box.innerHTML = commonTop + specific;
    box.style.display = "block";

    const typeEl = $(pre+"ElectronicsType");
    if (typeEl) {
        typeEl.addEventListener("change", () => ensureElectronicsFields(type, true));
    }
}

function readElectronicsFields(type="add") {
    const category = $(type === "edit" ? "editAdCategory" : "adCategory")?.value;
    if (category !== "إلكترونيات") return null;
    const p = type === "edit" ? "edit" : "";
    const get = key => $(p+key)?.value || "";
    const trim = key => String(get(key)).trim();
    return {
        type: get("ElectronicsType"),
        brand: get("ElectronicsBrand"),
        model: trim("ElectronicsModel"),
        year: get("ElectronicsYear"),
        condition: get("ElectronicsCondition"),
        ram: get("ElectronicsRam"),
        storage: get("ElectronicsStorage"),
        screenSize: trim("ElectronicsScreenSize"),
        color: get("ElectronicsColor"),
        warranty: trim("ElectronicsWarranty"),
        processor: trim("ElectronicsProcessor"),
        resolution: trim("ElectronicsResolution"),
        smart: get("ElectronicsSmart"),
        network: get("ElectronicsNetwork"),
        displayTech: get("ElectronicsDisplayTech"),
        refreshRate: get("ElectronicsRefreshRate"),
        megapixels: trim("ElectronicsMegapixels"),
        lens: trim("ElectronicsLens"),
        connectivity: get("ElectronicsConnectivity"),
        generation: trim("ElectronicsGeneration"),
        os: trim("ElectronicsOS"),
        battery: trim("ElectronicsBattery"),
        size: trim("ElectronicsSize"),
        power: trim("ElectronicsPower"),
        printerType: get("ElectronicsPrinterType"),
        colorPrint: get("ElectronicsColorPrint")
    };
}

function resetElectronicsFilters(){ electronicsFilters={type:"",brand:"",model:"",yearFrom:"",yearTo:"",priceFrom:"",priceTo:"",condition:"",ram:"",storage:"",screenSize:"",color:"",warranty:"",processor:"",resolution:"",smart:"",network:""}; }
function matchesElectronicsFilters(ad){
    if(selectedCategory!=="إلكترونيات") return true;
    const f=electronicsFilters,e=ad.electronics||{};
    if(f.type && e.type!==f.type) return false;
    if(f.brand && e.brand!==f.brand) return false;
    if(f.model && !String(e.model||"").toLowerCase().includes(f.model.toLowerCase())) return false;
    if(f.yearFrom && Number(e.year||0)<Number(f.yearFrom)) return false;
    if(f.yearTo && Number(e.year||0)>Number(f.yearTo)) return false;
    if(f.priceFrom && Number(ad.price||0)<Number(f.priceFrom)) return false;
    if(f.priceTo && Number(ad.price||0)>Number(f.priceTo)) return false;
    if(f.condition && e.condition!==f.condition) return false;
    if(f.ram && e.ram!==f.ram) return false;
    if(f.storage && e.storage!==f.storage) return false;
    if(f.screenSize && !String(e.screenSize||"").toLowerCase().includes(f.screenSize.toLowerCase())) return false;
    if(f.color && e.color!==f.color) return false;
    if(f.warranty && !String(e.warranty||"").toLowerCase().includes(f.warranty.toLowerCase())) return false;
    if(f.processor && !String(e.processor||"").toLowerCase().includes(f.processor.toLowerCase())) return false;
    if(f.resolution && !String(e.resolution||"").toLowerCase().includes(f.resolution.toLowerCase())) return false;
    if(f.smart && e.smart!==f.smart) return false;
    if(f.network && e.network!==f.network) return false;
    return true;
}
function electronicsFilterHTML(){
    const f=electronicsFilters;
    return `<div class="car-filter-box electronics-filter-box"><div class="car-fields-title">📱 فلترة الإلكترونيات</div>
      <div class="form-row"><div class="form-group"><label>نوع الجهاز</label><select id="filterElectronicsType"><option value="">الكل</option>${ELECTRONICS_TYPES.map(x=>`<option value="${x}" ${f.type===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-group"><label>الماركة</label><select id="filterElectronicsBrand">${electronicsBrandOptions(f.brand)}</select></div></div>
      <div class="form-row"><div class="form-group"><label>الموديل</label><input id="filterElectronicsModel" value="${escapeHTML(f.model)}" placeholder="مثال: iPhone 15"></div><div class="form-group"><label>الحالة</label><select id="filterElectronicsCondition"><option value="">الكل</option>${ELECTRONICS_CONDITIONS.map(x=>`<option value="${x}" ${f.condition===x?"selected":""}>${x}</option>`).join("")}</select></div></div>
      <div class="form-row"><div class="form-group"><label>السنة من</label><input id="filterElectronicsYearFrom" type="number" value="${escapeHTML(f.yearFrom)}"></div><div class="form-group"><label>السنة إلى</label><input id="filterElectronicsYearTo" type="number" value="${escapeHTML(f.yearTo)}"></div></div>
      <div class="form-row"><div class="form-group"><label>السعر من</label><input id="filterElectronicsPriceFrom" type="number" min="0" value="${escapeHTML(f.priceFrom)}"></div><div class="form-group"><label>السعر إلى</label><input id="filterElectronicsPriceTo" type="number" min="0" value="${escapeHTML(f.priceTo)}"></div></div>
      <div class="form-row"><div class="form-group"><label>RAM</label><select id="filterElectronicsRam"><option value="">الكل</option>${ELECTRONICS_RAM.map(x=>`<option value="${x}" ${f.ram===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-group"><label>التخزين</label><select id="filterElectronicsStorage"><option value="">الكل</option>${ELECTRONICS_STORAGE.map(x=>`<option value="${x}" ${f.storage===x?"selected":""}>${x}</option>`).join("")}</select></div></div>
      <div class="form-row"><div class="form-group"><label>اللون</label><select id="filterElectronicsColor"><option value="">الكل</option>${ELECTRONICS_COLORS.map(x=>`<option value="${x}" ${f.color===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-group"><label>Smart</label><select id="filterElectronicsSmart"><option value="">الكل</option><option value="نعم" ${f.smart==="نعم"?"selected":""}>نعم</option><option value="لا" ${f.smart==="لا"?"selected":""}>لا</option></select></div></div>
      <div class="form-row"><div class="form-group"><label>الشبكة</label><select id="filterElectronicsNetwork"><option value="">الكل</option>${["4G","5G","Wi-Fi","Wi-Fi + Cellular","أخرى"].map(x=>`<option value="${x}" ${f.network===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="form-group"><label>المعالج</label><input id="filterElectronicsProcessor" value="${escapeHTML(f.processor)}"></div></div>
      <div class="form-row"><div class="form-group"><label>حجم الشاشة</label><input id="filterElectronicsScreenSize" value="${escapeHTML(f.screenSize)}" placeholder="6.7"></div><div class="form-group"><label>الدقة</label><input id="filterElectronicsResolution" value="${escapeHTML(f.resolution)}" placeholder="4K"></div></div>
      <div class="form-group"><label>الضمان</label><input id="filterElectronicsWarranty" value="${escapeHTML(f.warranty)}"></div>
      <div class="car-filter-actions"><button type="button" class="primary-btn" onclick="applyElectronicsFilters()">تطبيق الفلاتر</button><button type="button" class="secondary-btn" onclick="clearElectronicsFilters()">مسح الفلاتر</button></div></div>`;
}
function applyElectronicsFilters(){ electronicsFilters={type:$('filterElectronicsType')?.value||'',brand:$('filterElectronicsBrand')?.value||'',model:$('filterElectronicsModel')?.value.trim()||'',yearFrom:$('filterElectronicsYearFrom')?.value||'',yearTo:$('filterElectronicsYearTo')?.value||'',priceFrom:$('filterElectronicsPriceFrom')?.value||'',priceTo:$('filterElectronicsPriceTo')?.value||'',condition:$('filterElectronicsCondition')?.value||'',ram:$('filterElectronicsRam')?.value||'',storage:$('filterElectronicsStorage')?.value||'',screenSize:$('filterElectronicsScreenSize')?.value.trim()||'',color:$('filterElectronicsColor')?.value||'',warranty:$('filterElectronicsWarranty')?.value.trim()||'',processor:$('filterElectronicsProcessor')?.value.trim()||'',resolution:$('filterElectronicsResolution')?.value.trim()||'',smart:$('filterElectronicsSmart')?.value||'',network:$('filterElectronicsNetwork')?.value||''}; closeFilters(); renderAllAds(); renderSearchPage(); renderFavorites(); showToast('تم تطبيق فلاتر الإلكترونيات','📱'); }
function clearElectronicsFilters(){ resetElectronicsFilters(); closeFilters(); renderAllAds(); renderSearchPage(); renderFavorites(); showToast('تم مسح فلاتر الإلكترونيات','✓'); }
function setupElectronicsFeatures(){ ["adCategory","editAdCategory"].forEach(id=>{const el=$(id); if(!el||el.dataset.electronicsReady) return; el.dataset.electronicsReady="1"; el.addEventListener("change",()=>ensureElectronicsFields(id==="editAdCategory"?"edit":"add", true));}); }

// تشغيل حقول القسم يدويًا عند فتح نموذج الإعلان لضمان ظهورها حتى لو لم يتم ربط الحدث بعد.
function refreshCategorySpecificFields(type="add") {
    ensureCarFields(type, true);
    ensureElectronicsFields(type, true);
}



/* =========================================================
   IMAGE FUNCTIONS
========================================================= */

function compressImage(
    file,
    maxWidth = 1000,
    quality = 0.72
) {

    return new Promise(
        (resolve, reject) => {

            if (
                !file ||
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
            ) {

                reject(
                    new Error(
                        "الملف ليس صورة"
                    )
                );

                return;
            }

            const url =
                URL.createObjectURL(
                    file
                );

            const img =
                new Image();

            img.onload =
                function () {

                    let width =
                        img.width;

                    let height =
                        img.height;

                    if (
                        width >
                        maxWidth
                    ) {

                        const ratio =
                            maxWidth /
                            width;

                        width =
                            maxWidth;

                        height =
                            Math.round(
                                height *
                                ratio
                            );
                    }

                    const canvas =
                        document.createElement(
                            "canvas"
                        );

                    canvas.width =
                        width;

                    canvas.height =
                        height;

                    const ctx =
                        canvas.getContext(
                            "2d"
                        );

                    if (!ctx) {

                        URL.revokeObjectURL(
                            url
                        );

                        reject(
                            new Error(
                                "تعذر معالجة الصورة"
                            )
                        );

                        return;
                    }

                    ctx.drawImage(
                        img,
                        0,
                        0,
                        width,
                        height
                    );

                    canvas.toBlob(
                        blob => {

                            URL.revokeObjectURL(
                                url
                            );

                            if (!blob) {

                                reject(
                                    new Error(
                                        "فشل ضغط الصورة"
                                    )
                                );

                                return;
                            }

                            const reader =
                                new FileReader();

                            reader.onload =
                                () => {

                                    resolve(
                                        reader.result
                                    );
                                };

                            reader.onerror =
                                () => {

                                    reject(
                                        new Error(
                                            "فشل قراءة الصورة"
                                        )
                                    );
                                };

                            reader.readAsDataURL(
                                blob
                            );

                        },
                        "image/jpeg",
                        quality
                    );
                };

            img.onerror =
                function () {

                    URL.revokeObjectURL(
                        url
                    );

                    reject(
                        new Error(
                            "تعذر فتح الصورة"
                        )
                    );
                };

            img.src = url;
        }
    );
}


/* =========================================================
   ADD IMAGE PREVIEW
========================================================= */

function renderImagePreview() {

    const container =
        $("imagePreview");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    selectedAdImages.forEach(
        (item, index) => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "preview-item";

            div.innerHTML = `
                <img
                    src="${escapeHTML(item.previewUrl)}"
                    alt="صورة الإعلان"
                >

                <button
                    type="button"
                    class="preview-remove"
                    onclick="removeSelectedImage(${index})"
                >
                    ×
                </button>
            `;

            container.appendChild(
                div
            );
        }
    );
}


function removeSelectedImage(index) {

    const item =
        selectedAdImages[index];

    if (
        item &&
        item.previewUrl &&
        item.previewUrl.startsWith(
            "blob:"
        )
    ) {

        URL.revokeObjectURL(
            item.previewUrl
        );
    }

    selectedAdImages.splice(
        index,
        1
    );

    renderImagePreview();
}


function handleAdImages(event) {

    const files =
        Array.from(
            event.target.files || []
        );

    if (!files.length) {
        return;
    }

    const available =
        8 -
        selectedAdImages.length;

    if (available <= 0) {

        showToast(
            "الحد الأقصى 8 صور",
            "📷"
        );

        event.target.value = "";

        return;
    }

    files
        .slice(0, available)
        .forEach(
            file => {

                if (
                    !file.type.startsWith(
                        "image/"
                    )
                ) {
                    return;
                }

                selectedAdImages.push({

                    file: file,

                    previewUrl:
                        URL.createObjectURL(
                            file
                        ),

                    dataUrl: null
                });
            }
        );

    renderImagePreview();

    event.target.value = "";

    if (
        files.length >
        available
    ) {

        showToast(
            "الحد الأقصى 8 صور",
            "📷"
        );
    }
}


/* =========================================================
   EDIT IMAGE PREVIEW
========================================================= */

function renderEditImagePreview() {

    const container =
        $("editImagePreview");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    editAdImages.forEach(
        (item, index) => {

            const src =
                typeof item === "string"
                    ? item
                    : item.previewUrl;

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "edit-ad-image";

            div.innerHTML = `
                <img
                    src="${escapeHTML(src)}"
                    alt="صورة الإعلان"
                >

                <button
                    type="button"
                    class="edit-image-remove"
                    onclick="removeEditImage(${index})"
                >
                    ×
                </button>
            `;

            container.appendChild(
                div
            );
        }
    );
}


function removeEditImage(index) {

    const item =
        editAdImages[index];

    if (
        item &&
        typeof item === "object" &&
        item.previewUrl &&
        item.previewUrl.startsWith(
            "blob:"
        )
    ) {

        URL.revokeObjectURL(
            item.previewUrl
        );
    }

    editAdImages.splice(
        index,
        1
    );

    renderEditImagePreview();
}


function handleEditImages(event) {

    const files =
        Array.from(
            event.target.files || []
        );

    if (!files.length) {
        return;
    }

    const available =
        8 -
        editAdImages.length;

    if (available <= 0) {

        showToast(
            "الحد الأقصى 8 صور",
            "📷"
        );

        event.target.value = "";

        return;
    }

    files
        .slice(0, available)
        .forEach(
            file => {

                if (
                    !file.type.startsWith(
                        "image/"
                    )
                ) {
                    return;
                }

                editAdImages.push({

                    file: file,

                    previewUrl:
                        URL.createObjectURL(
                            file
                        ),

                    dataUrl: null
                });
            }
        );

    renderEditImagePreview();

    event.target.value = "";
}


/* =========================================================
   PREPARE IMAGES
========================================================= */

async function prepareImagesForSaving(
    images
) {

    const result = [];

    for (
        const item of images
    ) {

        if (!item) {
            continue;
        }

        if (
            typeof item === "string"
        ) {

            result.push(item);

            continue;
        }

        if (item.dataUrl) {

            result.push(
                item.dataUrl
            );

            continue;
        }

        if (item.file) {

            try {

                const dataUrl =
                    await compressImage(
                        item.file
                    );

                result.push(
                    dataUrl
                );

            } catch (error) {

                console.error(
                    "Image error:",
                    error
                );
            }
        }
    }

    return result;
}


/* =========================================================
   ADD AD
========================================================= */

function resetAddAdForm() {

    const form =
        $("addAdForm");

    if (form) {
        form.reset();
    }

    selectedAdImages.forEach(
        item => {

            if (
                item &&
                item.previewUrl &&
                item.previewUrl.startsWith(
                    "blob:"
                )
            ) {

                URL.revokeObjectURL(
                    item.previewUrl
                );
            }
        }
    );

    selectedAdImages = [];

    // بعد إعادة ضبط النموذج نخفي حقول السيارات والإلكترونيات حتى اختيار القسم.
    ensureCarFields("add", true);
    ensureElectronicsFields("add", true);

    renderImagePreview();
}


function openAddAd() {

    if (!requireLogin()) {
        return;
    }

    resetAddAdForm();

    const modal =
        $("addAdModal");

    if (!modal) {
        return;
    }

    modal.style.display =
        "block";

    document.body.style.overflow =
        "hidden";
}


function closeAddAd() {

    const modal =
        $("addAdModal");

    if (modal) {

        modal.style.display =
            "none";
    }

    document.body.style.overflow =
        "";

    selectedAdImages.forEach(
        item => {

            if (
                item &&
                item.previewUrl &&
                item.previewUrl.startsWith(
                    "blob:"
                )
            ) {

                URL.revokeObjectURL(
                    item.previewUrl
                );
            }
        }
    );

    selectedAdImages = [];

    renderImagePreview();
}


function setLocationFields(type, latitude, longitude) {
    const prefix = type === "edit" ? "editAd" : "ad";
    const lat = $(prefix + "Latitude");
    const lng = $(prefix + "Longitude");
    const status = $(prefix + "LocationStatus");

    if (lat) lat.value = Number(latitude).toFixed(6);
    if (lng) lng.value = Number(longitude).toFixed(6);
    if (status) {
        status.textContent = "✓ تم حفظ موقع الإعلان";
        status.classList.add("saved");
    }
}

function pickAdLocation(type = "add") {
    if (!navigator.geolocation) {
        showToast("جهازك لا يدعم تحديد الموقع", "!");
        return;
    }

    const prefix = type === "edit" ? "editAd" : "ad";
    const status = $(prefix + "LocationStatus");
    if (status) status.textContent = "جاري تحديد موقعك...";

    navigator.geolocation.getCurrentPosition(
        position => {
            setLocationFields(type, position.coords.latitude, position.coords.longitude);
            showToast("تم حفظ موقع الإعلان 📍", "✓");
        },
        error => {
            let message = "تعذر تحديد الموقع";
            if (error && error.code === 1) message = "اسمح للمتصفح بالوصول إلى موقعك أولاً";
            if (error && error.code === 2) message = "تعذر العثور على موقعك";
            if (status) status.textContent = message;
            showToast(message, "!");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
}

function getAdCoordinates(ad) {
    const lat = Number(ad && (ad.latitude ?? ad.location?.latitude));
    const lng = Number(ad && (ad.longitude ?? ad.location?.longitude));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
}

function adMapHTML(ad) {
    const coords = getAdCoordinates(ad);
    const city = encodeURIComponent(ad.city || "ليبيا");

    if (!coords) {
        return `
            <section class="details-section location-section">
                <div class="details-section-title">
                    <span>📍</span>
                    <div><strong>موقع الإعلان</strong><small>${escapeHTML(ad.city || "كل ليبيا")}</small></div>
                </div>
                <div class="location-no-map">
                    <div class="location-big-icon">📍</div>
                    <strong>${escapeHTML(ad.city || "كل ليبيا")}</strong>
                    <span>لم يحدد البائع موقعًا دقيقًا للإعلان</span>
                </div>
                <a class="location-open-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${city}">🗺️ فتح المدينة في خرائط Google</a>
            </section>
        `;
    }

    const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.015}%2C${coords.lat - 0.015}%2C${coords.lng + 0.015}%2C${coords.lat + 0.015}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;

    return `
        <section class="details-section location-section">
            <div class="details-section-title">
                <span>📍</span>
                <div><strong>موقع الإعلان</strong><small>${escapeHTML(ad.city || "ليبيا")} • موقع تقريبي</small></div>
                <span class="location-private-badge">🔒</span>
            </div>
            <div class="location-map-wrap">
                <iframe title="موقع الإعلان" src="${mapSrc}" loading="lazy"></iframe>
            </div>
            <div class="location-coords">📍 ${escapeHTML(ad.city || "ليبيا")} — الموقع الذي حدده البائع</div>
            <a class="location-open-btn" target="_blank" rel="noopener" href="${googleUrl}">🗺️ فتح الموقع في خرائط Google</a>
        </section>
    `;
}

async function publishAd(event) {

    event.preventDefault();

    if (!requireLogin()) {
        return;
    }

    const button =
        $("publishAdButton");

    if (button) {

        button.classList.add(
            "processing"
        );

        button.textContent =
            "جاري نشر الإعلان...";
    }

    try {

        const user =
            getCurrentUser();

        const title =
            $("adTitle")
                .value
                .trim();

        const category =
            $("adCategory")
                .value;

        const price =
            Number(
                $("adPrice").value
            );

        const city =
            $("adCity").value;

        const description =
            $("adDescription")
                .value
                .trim();

        ensureCarFields("add");
        ensureElectronicsFields("add");
        const car = readCarFields("add");
        const electronics = readElectronicsFields("add");

        if (!title) {
            throw new Error(
                "اكتب عنوان الإعلان"
            );
        }

        if (!category) {
            throw new Error(
                "اختر القسم"
            );
        }

        if (
            Number.isNaN(price) ||
            price < 0
        ) {

            throw new Error(
                "أدخل سعرًا صحيحًا"
            );
        }

        if (!city) {
            throw new Error(
                "اختر المدينة"
            );
        }

        const images =
            await prepareImagesForSaving(
                selectedAdImages
            );

        const draftAd = {
            title,
            category,
            price,
            city,
            description,
            sellerId: user.id,
            images
        };

        validateAdSecurity(draftAd);

        const ad = {

            id:
                generateId("ad"),

            title:
                title,

            category:
                category,

            price:
                price,

            city:
                city,

            latitude: Number($("adLatitude")?.value) || null,

            longitude: Number($("adLongitude")?.value) || null,

            description:
                description,

            car:
                car,

            electronics:
                electronics,

            images:
                images,

            image:
                images[0] || "",

            sellerId:
                user.id,

            sellerName:
                user.name ||
                "مستخدم دوّر",

            sellerPhone:
                user.phone,

            sellerPhoto:
                user.photo || "",

            status:
                "active",

            sold:
                false,

            featured:
                false,

            views:
                0,

            createdAt:
                Date.now(),

            updatedAt:
                Date.now()
        };

        const ads =
            getAds();

        ads.unshift(ad);

        if (firebaseReady && images.length) {
            ad.images = await uploadAdImagesToFirebase(ad.images, ad.id);
            ad.image = ad.images[0] || "";
        }

        saveAds(ads);

        await notifyFollowersOfNewAd(ad);

        addNotification(
            "تم نشر إعلانك",
            "إعلانك أصبح ظاهرًا في دوّر.",
            "📢"
        );

        closeAddAd();

        renderAllAds();
        renderMyAds();
        renderSearchPage();

        showToast(
            "تم نشر الإعلان بنجاح",
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "حدث خطأ",
            "!"
        );

    } finally {

        if (button) {

            button.classList.remove(
                "processing"
            );

            button.textContent =
                "نشر الإعلان";
        }
    }
}


/* =========================================================
   FILTERED ADS
========================================================= */

function getFilteredAds() {

    let ads =
        getAds();

    ads =
        ads.filter(
            ad =>
                matchesLocation(ad)
        );

    if (
        selectedCategory !==
        "الكل"
    ) {

        ads =
            ads.filter(
                ad =>
                    String(
                        ad.category
                    ) ===
                    String(
                        selectedCategory
                    )
            );
    }

    if (searchText) {

        ads =
            ads.filter(
                ad =>
                    adMatchesSearch(
                        ad,
                        searchText
                    )
            );
    }

    ads = ads.filter(ad => matchesCarFilters(ad));
    ads = ads.filter(ad => matchesElectronicsFilters(ad));

    return sortAds(ads);
}


/* =========================================================
   AD IMAGE
========================================================= */

function getAdImage(ad) {

    if (
        ad.images &&
        Array.isArray(ad.images) &&
        ad.images.length
    ) {

        return ad.images[0];
    }

    return ad.image || "";
}


/* =========================================================
   AD CARD
========================================================= */

function createAdCard(ad) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "ad-card" +
        (
            ad.sold
                ? " is-sold"
                : ""
        );

    const image =
        getAdImage(ad);

    const favorite =
        isFavorite(ad.id);

    card.innerHTML = `

        <div class="ad-card-image">

            ${
                image
                    ? `
                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(ad.title)}"
                            loading="lazy"
                        >
                    `
                    : `
                        <div class="ad-placeholder">
                            ${getCategoryEmoji(ad.category)}
                        </div>
                    `
            }

            ${
                ad.sold
                    ? `
                        <div class="ad-sold">
                            مباع
                        </div>
                    `
                    : ""
            }

            ${
                ad.featured && !ad.sold
                    ? `
                        <div class="ad-featured">
                            مميز
                        </div>
                    `
                    : ""
            }

            <button
                type="button"
                class="ad-favorite ${
                    favorite
                        ? "active"
                        : ""
                }"
                onclick="toggleFavorite('${ad.id}', event)"
            >
                ${
                    favorite
                        ? "❤️"
                        : "♡"
                }
            </button>

        </div>

        <div class="ad-card-info">

            <div class="ad-category">
                ${escapeHTML(ad.category)}
            </div>

            <div class="ad-title">
                ${escapeHTML(ad.title)}
            </div>

            <div class="ad-price">
                ${formatPrice(ad.price)}
            </div>

            <div class="ad-city">
                📍 ${escapeHTML(ad.city)}
            </div>

            <div class="ad-views">
                👁 ${Number(ad.views || 0)}
                مشاهدة
            </div>

        </div>
    `;

    card.addEventListener(
        "click",
        function(event) {

            if (
                event.target.closest(
                    ".ad-favorite"
                )
            ) {
                return;
            }

            openAdDetails(
                ad.id
            );
        }
    );

    return card;
}


/* =========================================================
   HOME
========================================================= */

function renderAllAds() {

    const featuredContainer =
        $("featuredAds");

    const latestContainer =
        $("latestAds");

    const noResults =
        $("noResults");

    if (
        !featuredContainer ||
        !latestContainer
    ) {
        return;
    }

    const ads =
        getFilteredAds();

    featuredContainer.innerHTML =
        "";

    latestContainer.innerHTML =
        "";

    if (!ads.length) {

        if (noResults) {

            noResults.style.display =
                "block";
        }

        return;
    }

    if (noResults) {

        noResults.style.display =
            "none";
    }

    const featured =
        ads
            .filter(
                ad =>
                    ad.featured &&
                    !ad.sold
            )
            .slice(0, 6);

    const featuredAds =
        featured.length
            ? featured
            : ads
                .filter(
                    ad =>
                        !ad.sold
                )
                .slice(0, 6);

    featuredAds.forEach(
        ad => {

            featuredContainer.appendChild(
                createAdCard(ad)
            );
        }
    );

    ads
        .slice(0, 20)
        .forEach(
            ad => {

                latestContainer.appendChild(
                    createAdCard(ad)
                );
            }
        );
}


function showAllAds() {

    selectedCategory =
        "الكل";

    searchText = "";

    if ($("searchInput")) {
        $("searchInput").value = "";
    }

    showPage(
        "homePage"
    );

    renderAllAds();

    setTimeout(
        () => {

            const section =
                $("latestAds");

            if (section) {

                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

        },
        100
    );
}


/* =========================================================
   SEARCH PAGE
========================================================= */

function openSearchPage() {

    showPage(
        "searchPage"
    );

    const input =
        $("pageSearchInput");

    if (input) {

        input.value =
            searchText || "";

        setTimeout(
            () => input.focus(),
            100
        );
    }

    renderSearchPage();
}


function renderSearchPage() {

    const container =
        $("searchResults");

    if (!container) {
        return;
    }

    let ads =
        getAds();

    ads =
        ads.filter(
            ad =>
                matchesLocation(ad)
        );

    if (
        selectedCategory !==
        "الكل"
    ) {

        ads =
            ads.filter(
                ad =>
                    String(
                        ad.category
                    ) ===
                    String(
                        selectedCategory
                    )
            );
    }

    if (searchText) {

        ads =
            ads.filter(
                ad =>
                    adMatchesSearch(
                        ad,
                        searchText
                    )
            );
    }

    ads = ads.filter(ad => matchesCarFilters(ad));
    ads = ads.filter(ad => matchesElectronicsFilters(ad));

    ads =
        sortAds(ads);

    container.innerHTML =
        "";

    if (!ads.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    🔎
                </div>

                <h3>
                    ما لقيناش نتائج
                </h3>

                <p>
                    جرّب كلمة ثانية أو قسم مختلف
                </p>

            </div>
        `;

        return;
    }

    ads.forEach(
        ad => {

            container.appendChild(
                createAdCard(ad)
            );
        }
    );
}


/* =========================================================
   FAVORITES PAGE
========================================================= */

function openFavoritesPage() {

    showPage(
        "favoritesPage"
    );

    renderFavorites();
}


function renderFavorites() {

    const container =
        $("favoritesContent");

    if (!container) {
        return;
    }

    const favorites =
        getFavorites();

    let ads =
        getAds().filter(
            ad =>
                favorites.some(
                    id =>
                        String(id) ===
                        String(ad.id)
                )
        );

    ads =
        ads.filter(
            ad =>
                matchesLocation(ad)
        );

    ads =
        sortAds(ads);

    container.innerHTML =
        "";

    if (!ads.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ❤️
                </div>

                <h3>
                    المفضلة فارغة
                </h3>

                <p>
                    أضف الإعلانات التي تعجبك للمفضلة.
                </p>

            </div>
        `;

        return;
    }

    ads.forEach(
        ad => {

            container.appendChild(
                createAdCard(ad)
            );
        }
    );
}


/* =========================================================
   AD DETAILS
========================================================= */

function incrementAdViews(adId) {

    const ads =
        getAds();

    const index =
        ads.findIndex(
            item =>
                String(item.id) ===
                String(adId)
        );

    if (index < 0) {
        return 0;
    }

    ads[index].views =
        Number(
            ads[index].views || 0
        ) + 1;

    saveAds(ads);

    return ads[index].views;
}


function openAdDetails(
    adId,
    refreshOnly = false
) {
    let ad = findAd(adId);
    if (!ad) return;

    currentDetailsAdId = adId;

    if (!refreshOnly) {
        incrementAdViews(adId);
        ad = findAd(adId);
        if (!ad) return;
    }

    const container = $("adDetailsContent");
    if (!container) return;

    const favorite = isFavorite(ad.id);
    const currentUser = getCurrentUser();
    const isOwner = currentUser && String(currentUser.id) === String(ad.sellerId);

    const images = Array.isArray(ad.images) && ad.images.length
        ? ad.images
        : (ad.image ? [ad.image] : []);

    const heroImage = images[0] || "";

    const gallery = `
        <div class="details-hero">
            ${heroImage
                ? `<img id="detailsHeroImage" src="${escapeHTML(heroImage)}" alt="${escapeHTML(ad.title)}">`
                : `<div class="details-hero-placeholder">${getCategoryEmoji(ad.category)}</div>`
            }
            <button type="button" class="details-back-btn" onclick="closeAdDetails()">×</button>
            <div class="details-image-count">${images.length ? `📷 ${images.length}` : ""}</div>
        </div>
        ${images.length > 1 ? `
            <div class="details-thumbs">
                ${images.map((src, index) => `
                    <button type="button" class="details-thumb ${index === 0 ? "active" : ""}" onclick="changeDetailsImageByIndex(${index}, this)">
                        <img src="${escapeHTML(src)}" alt="">
                    </button>
                `).join("")}
            </div>
        ` : ""}
    `;

    const car = ad.car || {};
    const isCar = ad.category === "سيارات";
    const electronics = ad.electronics || {};
    const isElectronics = ad.category === "إلكترونيات";

    const carRows = [
        ["الماركة", car.brand, "🏷️"],
        ["الموديل", car.model, "🚘"],
        ["سنة الصنع", car.year, "📅"],
        ["الممشى", car.mileage ? `${Number(car.mileage).toLocaleString("ar-LY")} كم` : "", "🛣️"],
        ["الوقود", car.fuel, "⛽"],
        ["القير", car.transmission, "⚙️"],
        ["النوع", car.body, "🚙"]
    ].filter(x => x[1]);

    const carInfo = isCar ? `
        <section class="details-section car-details-section" id="carDetailsSection">
            <button type="button" class="car-details-toggle" onclick="toggleCarDetails(event)">
                <div class="details-section-title">
                    <span>🚗</span>
                    <div>
                        <strong>معلومات السيارة</strong>
                        <small>${carRows.length ? "اضغط لعرض تفاصيل المركبة" : "لا توجد معلومات مضافة"}</small>
                    </div>
                </div>
                <span class="car-details-arrow" id="carDetailsArrow">⌄</span>
            </button>
            <div class="car-details-content" id="carDetailsContent" style="display:none;">
                ${carRows.length ? `
                    <div class="car-details-grid">
                        ${carRows.map(x => `
                            <div class="car-detail-item">
                                <span class="car-detail-icon">${x[2]}</span>
                                <div>
                                    <small>${x[0]}</small>
                                    <strong>${escapeHTML(x[1])}</strong>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                ` : `
                    <div class="car-details-empty">
                        🚗 لم تتم إضافة معلومات السيارة لهذا الإعلان بعد.
                    </div>
                `}
            </div>
        </section>
    ` : "";

    const electronicsRows = [
        ["نوع الجهاز", electronics.type, "📱"], ["الماركة", electronics.brand, "🏷️"],
        ["الموديل", electronics.model, "🔢"], ["سنة الصنع", electronics.year, "📅"],
        ["الحالة", electronics.condition, "✨"], ["RAM", electronics.ram, "🧠"],
        ["التخزين", electronics.storage, "💾"], ["حجم الشاشة", electronics.screenSize, "🖥️"],
        ["المعالج", electronics.processor, "⚙️"], ["الدقة", electronics.resolution, "🎞️"],
        ["تقنية الشاشة", electronics.displayTech, "🖼️"], ["معدل التحديث", electronics.refreshRate, "🔄"],
        ["الشبكة", electronics.network, "📶"], ["Smart", electronics.smart, "📺"],
        ["الدقة / ميجابكسل", electronics.megapixels, "📷"], ["العدسة", electronics.lens, "🔭"],
        ["الجيل / الإصدار", electronics.generation, "🎮"], ["نظام التشغيل", electronics.os, "💻"],
        ["الاتصال", electronics.connectivity, "🔗"], ["البطارية", electronics.battery, "🔋"],
        ["المقاس", electronics.size, "📏"], ["القدرة", electronics.power, "⚡"],
        ["نوع الطابعة", electronics.printerType, "🖨️"], ["طباعة ملونة", electronics.colorPrint, "🌈"],
        ["اللون", electronics.color, "🎨"], ["الضمان", electronics.warranty, "🛡️"]
    ].filter(x => x[1]);

    const electronicsInfo = isElectronics ? `
        <section class="details-section car-details-section electronics-details-section" id="electronicsDetailsSection">
            <button type="button" class="car-details-toggle" onclick="toggleElectronicsDetails(event)">
                <div class="details-section-title"><span>📱</span><div><strong>معلومات الجهاز</strong><small>${electronicsRows.length ? "اضغط لعرض المواصفات" : "لا توجد مواصفات مضافة"}</small></div></div>
                <span class="car-details-arrow" id="electronicsDetailsArrow">⌄</span>
            </button>
            <div class="car-details-content" id="electronicsDetailsContent" style="display:none;">
                ${electronicsRows.length ? `<div class="car-details-grid">${electronicsRows.map(x=>`<div class="car-detail-item"><span class="car-detail-icon">${x[2]}</span><div><small>${x[0]}</small><strong>${escapeHTML(x[1])}</strong></div></div>`).join("")}</div>` : `<div class="car-details-empty">📱 لم تتم إضافة مواصفات الجهاز لهذا الإعلان بعد.</div>`}
            </div>
        </section>
    ` : "";

    const contactButtons = (!ad.sold && !isOwner) ? `
        <div class="details-contact-grid">
            <button type="button" class="details-contact message" onclick="contactSellerWithMessage('${ad.id}')">
                <span>💬</span><div><strong>مراسلة البائع</strong><small>تواصل داخل دوّر</small></div>
            </button>
            <button type="button" class="details-contact call" onclick="callSeller('${ad.id}')">
                <span>📞</span><div><strong>اتصال</strong><small>اتصل بالبائع</small></div>
            </button>
            <button type="button" class="details-contact whatsapp" onclick="contactSeller('${ad.id}')">
                <span>🟢</span><div><strong>واتساب</strong><small>تواصل عبر واتساب</small></div>
            </button>
        </div>
    ` : isOwner ? `
        <div class="details-owner-note">✓ هذا إعلانك</div>
    ` : `
        <div class="details-owner-note sold-note">الإعلان مباع</div>
    `;

    container.innerHTML = `
        ${gallery}

        <div class="details-main">
            <div class="details-category-pill">${escapeHTML(ad.category)}</div>
            <h2 class="details-title-new">${escapeHTML(ad.title)}</h2>

            <div class="details-price-row">
                <div class="details-price-new">${formatPrice(ad.price)}</div>
                <div class="details-availability ${ad.sold ? "sold" : "available"}">
                    ${ad.sold ? "مباع" : "متاح الآن"}
                </div>
            </div>

            <div class="details-meta-row">
                <span>📍 ${escapeHTML(ad.city || "كل ليبيا")}</span>
                <span>👁 ${Number(ad.views || 0)} مشاهدة</span>
            </div>

            ${adMapHTML(ad)}

            ${carInfo}

            ${electronicsInfo}

            ${ad.description ? `
                <section class="details-section">
                    <div class="details-section-title">
                        <span>📝</span>
                        <div><strong>وصف الإعلان</strong><small>تفاصيل البائع</small></div>
                    </div>
                    <div class="details-description-new">${escapeHTML(ad.description)}</div>
                </section>
            ` : ""}

            <section class="details-section seller-section">
                <div class="details-section-title">
                    <span>👤</span>
                    <div><strong>صاحب الإعلان</strong><small>البائع على دوّر</small></div>
                </div>
                <button type="button" class="seller-card-new seller-card-clickable" onclick="openSellerProfile('${escapeQuotes(ad.sellerId)}')">
                    <div class="seller-avatar-new">👤</div>
                    <div class="seller-info-new">
                        <strong>${escapeHTML(ad.sellerName || "مستخدم دوّر")}</strong>
                        <span>عرض ملف البائع والإعلانات</span>
                    </div>
                    <span class="seller-card-arrow">‹</span>
                </button>
            </section>

            ${contactButtons}

            ${!isOwner ? `
                <button type="button" class="details-report-btn" onclick="openReportAd('${escapeQuotes(ad.id)}')">
                    <span>🚨</span><span>إبلاغ عن الإعلان</span>
                </button>
            ` : ""}

            <button type="button" class="details-favorite-btn ${favorite ? "active" : ""}" onclick="toggleFavorite('${ad.id}')">
                ${favorite ? "❤️ إزالة من المفضلة" : "♡ إضافة للمفضلة"}
            </button>
        </div>
    `;

    const modal = $("adDetailsModal");
    if (!modal) return;
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

function toggleElectronicsDetails(event) {
    if (event) event.stopPropagation();
    const content=$("electronicsDetailsContent");
    const arrow=$("electronicsDetailsArrow");
    if(!content) return;
    const open=content.style.display!=="none";
    content.style.display=open?"none":"block";
    if(arrow) arrow.textContent=open?"⌄":"⌃";
}

function toggleCarDetails(event) {
    if (event) event.stopPropagation();

    const content = $("carDetailsContent");
    const arrow = $("carDetailsArrow");

    if (!content) return;

    const isOpen = content.style.display !== "none";
    content.style.display = isOpen ? "none" : "block";

    if (arrow) {
        arrow.textContent = isOpen ? "⌄" : "⌃";
    }
}


function changeDetailsImageByIndex(index, button) {
    const ad = findAd(currentDetailsAdId);
    const images = ad && Array.isArray(ad.images) && ad.images.length
        ? ad.images
        : (ad && ad.image ? [ad.image] : []);
    const src = images[Number(index)];
    const hero = $("detailsHeroImage");
    if (hero && src) hero.src = src;
    document.querySelectorAll(".details-thumb").forEach(btn => btn.classList.remove("active"));
    if (button) button.classList.add("active");
}


function closeAdDetails() {

    const modal =
        $("adDetailsModal");

    if (modal) {

        modal.style.display =
            "none";
    }

    document.body.style.overflow =
        "";

    currentDetailsAdId =
        null;
}




/* =========================================================
   الإبلاغ عن الإعلان
========================================================= */

const REPORTS_KEY = "doorrReports";

function getReports() {
    try {
        const data = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
        return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
}

function saveReports(reports) {
    const safeReports = Array.isArray(reports) ? reports : [];
    localStorage.setItem(REPORTS_KEY, JSON.stringify(safeReports));
    if (firebaseReady) {
        safeReports.forEach(report => {
            if (report && report.id) firebaseSetDoc("reports", report.id, report);
        });
    }
}

function getReporterId() {
    const user = getCurrentUser();
    if (user && user.id) return "user_" + String(user.id);
    let guestId = localStorage.getItem("doorrGuestReporterId");
    if (!guestId) {
        guestId = "guest_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("doorrGuestReporterId", guestId);
    }
    return guestId;
}

function hasReportedAd(adId) {
    const reporterId = getReporterId();
    return getReports().some(report => String(report.adId) === String(adId) && String(report.reporterId) === String(reporterId));
}

function openReportAd(adId) {
    const ad = findAd(adId);
    if (!ad) { showToast("الإعلان غير موجود", "!"); return; }
    if (hasReportedAd(adId)) { showToast("سبق وأبلغت عن هذا الإعلان", "ℹ️"); return; }
    const oldModal = $("reportAdModal");
    if (oldModal) oldModal.remove();
    const modal = document.createElement("div");
    modal.id = "reportAdModal";
    modal.className = "modal";
    modal.style.display = "block";
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeReportAd()"></div>
        <div class="modal-box report-ad-box">
            <button type="button" class="modal-close" onclick="closeReportAd()">×</button>
            <div class="report-header">
                <div class="report-icon">🚨</div>
                <div><h2>الإبلاغ عن الإعلان</h2><p>ساعدنا نحافظوا على دوّر آمن للجميع</p></div>
            </div>
            <div class="report-ad-preview"><strong>${escapeHTML(ad.title || "هذا الإعلان")}</strong><span>${escapeHTML(ad.city || "كل ليبيا")}</span></div>
            <div class="report-label">اختر سبب البلاغ</div>
            <div class="report-reasons">
                <label class="report-reason"><input type="radio" name="reportReason" value="احتيال أو نصب"><span>⚠️</span><div><strong>احتيال أو نصب</strong><small>الإعلان يبدو وهميًا أو محاولة نصب</small></div></label>
                <label class="report-reason"><input type="radio" name="reportReason" value="إعلان مخالف"><span>🚫</span><div><strong>إعلان مخالف</strong><small>يخالف قواعد استخدام دوّر</small></div></label>
                <label class="report-reason"><input type="radio" name="reportReason" value="سلعة ممنوعة"><span>⛔</span><div><strong>سلعة ممنوعة</strong><small>المنتج أو الخدمة غير مسموح بها</small></div></label>
                <label class="report-reason"><input type="radio" name="reportReason" value="معلومات مضللة"><span>📝</span><div><strong>معلومات أو سعر مضلل</strong><small>المعلومات لا تطابق الإعلان</small></div></label>
                <label class="report-reason"><input type="radio" name="reportReason" value="إعلان مكرر"><span>🔁</span><div><strong>إعلان مكرر</strong><small>نفس الإعلان منشور أكثر من مرة</small></div></label>
                <label class="report-reason"><input type="radio" name="reportReason" value="محتوى غير لائق"><span>🔞</span><div><strong>محتوى غير لائق</strong><small>صور أو وصف غير مناسب</small></div></label>
                <label class="report-reason"><input type="radio" name="reportReason" value="سبب آخر"><span>💬</span><div><strong>سبب آخر</strong><small>أخبرنا بالمشكلة بالتفصيل</small></div></label>
            </div>
            <div class="report-label">تفاصيل إضافية <span>(اختياري)</span></div>
            <textarea id="reportDetails" class="report-details-input" maxlength="500" placeholder="اكتب لنا أي تفاصيل تساعدنا في مراجعة البلاغ..."></textarea>
            <div class="report-actions"><button type="button" class="report-cancel-btn" onclick="closeReportAd()">إلغاء</button><button type="button" class="report-submit-btn" onclick="submitAdReport('${escapeQuotes(ad.id)}')">🚨 إرسال البلاغ</button></div>
            <p class="report-note">سيتم مراجعة البلاغ من إدارة دوّر واتخاذ الإجراء المناسب.</p>
        </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
    modal.querySelectorAll(".report-reason").forEach(label => label.addEventListener("click", () => {
        modal.querySelectorAll(".report-reason").forEach(item => item.classList.remove("selected"));
        label.classList.add("selected");
    }));
}

function closeReportAd() {
    const modal = $("reportAdModal");
    if (modal) modal.remove();
    if (!$('adDetailsModal') || $('adDetailsModal').style.display !== 'block') document.body.style.overflow = "";
}

function submitAdReport(adId) {
    const ad = findAd(adId);
    if (!ad) { closeReportAd(); showToast("الإعلان غير موجود", "!"); return; }
    if (hasReportedAd(adId)) { closeReportAd(); showToast("سبق وأبلغت عن هذا الإعلان", "ℹ️"); return; }
    const selected = document.querySelector('input[name="reportReason"]:checked');
    const details = $("reportDetails");
    if (!selected) { showToast("اختر سبب البلاغ أولاً", "!"); return; }
    const reports = getReports();
    reports.push({
        id: "report_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        adId: String(ad.id), adTitle: ad.title || "", sellerId: ad.sellerId || "", sellerName: ad.sellerName || "",
        reporterId: getReporterId(), reason: selected.value, details: details ? details.value.trim() : "", status: "جديد", createdAt: Date.now()
    });
    saveReports(reports);
    closeReportAd();
    showToast("تم إرسال البلاغ بنجاح، شكرًا لمساعدتنا ✓", "✓");
}

/* =========================================================
   WHATSAPP / CALL
========================================================= */

function contactSeller(adId) {

    const ad =
        findAd(adId);

    if (!ad) {
        return;
    }

    const currentUser =
        getCurrentUser();

    if (
        currentUser &&
        String(currentUser.id) ===
        String(ad.sellerId)
    ) {

        showToast(
            "هذا إعلانك",
            "ℹ️"
        );

        return;
    }

    const phone =
        normalizePhone(
            ad.sellerPhone
        );

    if (!phone) {

        showToast(
            "رقم البائع غير متوفر",
            "!"
        );

        return;
    }

    const message =
        "السلام عليكم، شفت إعلانك في تطبيق دوّر: " +
        ad.title +
        " - السعر " +
        formatPrice(ad.price);

    const url =
        "https://wa.me/218" +
        phone.replace(
            /^0/,
            ""
        ) +
        "?text=" +
        encodeURIComponent(
            message
        );

    window.open(
        url,
        "_blank"
    );
}


function callSeller(adId) {

    const ad =
        findAd(adId);

    if (!ad) {
        return;
    }

    const phone =
        normalizePhone(
            ad.sellerPhone
        );

    if (!phone) {

        showToast(
            "رقم البائع غير متوفر",
            "!"
        );

        return;
    }

    window.location.href =
        "tel:" + phone;
}


/* =========================================================
   MY ADS
========================================================= */

function openMyAds() {

    if (!requireLogin()) {
        return;
    }

    showPage(
        "myAdsPage"
    );

    renderMyAds();
}


function renderMyAds() {

    const container =
        $("myAdsContent");

    const count =
        $("myAdsCount");

    if (!container) {
        return;
    }

    const ads =
        getUserAds().sort(
            (a, b) =>
                Number(b.createdAt || 0) -
                Number(a.createdAt || 0)
        );

    if (count) {

        count.textContent =
            ads.length +
            " إعلان";
    }

    container.innerHTML =
        "";

    if (!ads.length) {

        container.innerHTML = `

            <div class="my-ads-empty">

                <div class="my-ads-empty-icon">
                    📋
                </div>

                <h3>
                    ما عندكش إعلانات
                </h3>

                <p>
                    أضف أول إعلان ليك وابدأ البيع.
                </p>

                <button
                    type="button"
                    onclick="openAddAd()"
                >
                    + أضف إعلان
                </button>

            </div>
        `;

        return;
    }

    const list =
        document.createElement(
            "div"
        );

    list.className =
        "my-ads-list";

    ads.forEach(
        ad => {

            list.appendChild(
                createMyAdCard(ad)
            );
        }
    );

    container.appendChild(
        list
    );
}


function createMyAdCard(ad) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "my-ad-card";

    const image =
        getAdImage(ad);

    const sold =
        !!ad.sold;

    card.innerHTML = `

        <div class="my-ad-top">

            <div class="my-ad-image">

                ${
                    image
                        ? `
                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(ad.title)}"
                            >
                        `
                        : `
                            <div class="my-ad-placeholder">
                                ${getCategoryEmoji(ad.category)}
                            </div>
                        `
                }

                ${
                    sold
                        ? `
                            <div class="sold-overlay">
                                مباع
                            </div>
                        `
                        : ""
                }

            </div>

            <div class="my-ad-info">

                <span class="my-ad-category">
                    ${escapeHTML(ad.category)}
                </span>

                <h3>
                    ${escapeHTML(ad.title)}
                </h3>

                <div class="my-ad-price">
                    ${formatPrice(ad.price)}
                </div>

                <div class="my-ad-city">
                    📍 ${escapeHTML(ad.city)}
                </div>

                ${(() => {
                    const securityStatus = getAdSecurityStatus(ad);
                    return `
                        <span class="my-ad-status ${securityStatus.className}">
                            ● ${securityStatus.label}
                        </span>
                    `;
                })()}

            </div>

        </div>

        <div class="my-ad-actions">

            <button
                type="button"
                class="my-ad-edit"
                onclick="openEditAd('${ad.id}')"
            >
                ✏️ تعديل
            </button>

            <button
                type="button"
                class="my-ad-sold ${
                    sold
                        ? "restore"
                        : ""
                }"
                onclick="toggleSold('${ad.id}')"
            >
                ${
                    sold
                        ? "🟢 إعادة تفعيل"
                        : "🔴 وضع كمباع"
                }
            </button>

            <button
                type="button"
                class="my-ad-delete"
                onclick="deleteAd('${ad.id}')"
            >
                🗑 حذف
            </button>

        </div>
    `;

    return card;
}


/* =========================================================
   EDIT AD
========================================================= */

function openEditAd(adId) {

    if (!requireLogin()) {
        return;
    }

    const ad =
        findAd(adId);

    if (!ad) {

        showToast(
            "الإعلان غير موجود",
            "!"
        );

        return;
    }

    if (!userOwnsAd(ad)) {

        showToast(
            "لا يمكنك تعديل هذا الإعلان",
            "!"
        );

        return;
    }

    currentEditingAdId =
        adId;

    if ($("editAdTitle")) {
        $("editAdTitle").value =
            ad.title || "";
    }

    if ($("editAdCategory")) {
        $("editAdCategory").value =
            ad.category || "";
    }

    if ($("editAdPrice")) {
        $("editAdPrice").value =
            ad.price || "";
    }

    if ($("editAdCity")) {
        $("editAdCity").value =
            ad.city || "";
    }

    if (ad.latitude != null && ad.longitude != null) {
        setLocationFields("edit", ad.latitude, ad.longitude);
    } else {
        const editLat = $("editAdLatitude");
        const editLng = $("editAdLongitude");
        const editStatus = $("editAdLocationStatus");
        if (editLat) editLat.value = "";
        if (editLng) editLng.value = "";
        if (editStatus) { editStatus.textContent = "الموقع اختياري"; editStatus.classList.remove("saved"); }
    }

    if ($("editAdDescription")) {
        $("editAdDescription").value =
            ad.description || "";
    }

    ensureCarFields("edit", true);
    ensureElectronicsFields("edit", true);

    editAdImages = [];

    if (
        ad.images &&
        Array.isArray(ad.images)
    ) {

        editAdImages =
            ad.images.map(
                src => ({
                    previewUrl: src,
                    dataUrl: src
                })
            );

    } else if (ad.image) {

        editAdImages = [
            {
                previewUrl:
                    ad.image,

                dataUrl:
                    ad.image
            }
        ];
    }

    renderEditImagePreview();

    const modal =
        $("editAdModal");

    if (!modal) {
        return;
    }

    modal.style.display =
        "block";

    document.body.style.overflow =
        "hidden";
}


function closeEditAd() {

    const modal =
        $("editAdModal");

    if (modal) {

        modal.style.display =
            "none";
    }

    document.body.style.overflow =
        "";

    editAdImages.forEach(
        item => {

            if (
                item &&
                item.previewUrl &&
                item.previewUrl.startsWith(
                    "blob:"
                )
            ) {

                URL.revokeObjectURL(
                    item.previewUrl
                );
            }
        }
    );

    editAdImages = [];

    currentEditingAdId =
        null;
}


async function saveEditedAd(event) {

    event.preventDefault();

    if (!requireLogin()) {
        return;
    }

    const user = getCurrentUser();

    if (!user) {
        showToast("يجب تسجيل الدخول أولاً", "!");
        return;
    }

    if (!currentEditingAdId) {
        return;
    }

    const button =
        $("saveEditButton");

    if (button) {

        button.classList.add(
            "processing"
        );

        button.textContent =
            "جاري الحفظ...";
    }

    try {

        const ads =
            getAds();

        const index =
            ads.findIndex(
                ad =>
                    String(ad.id) ===
                    String(
                        currentEditingAdId
                    )
            );

        if (index < 0) {

            throw new Error(
                "الإعلان غير موجود"
            );
        }

        const ad =
            ads[index];

        if (!userOwnsAd(ad)) {

            throw new Error(
                "لا يمكنك تعديل هذا الإعلان"
            );
        }

        const title =
            $("editAdTitle")
                .value
                .trim();

        const category =
            $("editAdCategory")
                .value;

        const price =
            Number(
                $("editAdPrice")
                    .value
            );

        const city =
            $("editAdCity")
                .value;

        const description =
            $("editAdDescription")
                .value
                .trim();

        ensureCarFields("edit");
        ensureElectronicsFields("edit");
        const car = readCarFields("edit");
        const electronics = readElectronicsFields("edit");

        if (!title) {

            throw new Error(
                "اكتب عنوان الإعلان"
            );
        }

        if (!category) {

            throw new Error(
                "اختر القسم"
            );
        }

        if (
            Number.isNaN(price) ||
            price < 0
        ) {

            throw new Error(
                "أدخل سعرًا صحيحًا"
            );
        }

        if (!city) {

            throw new Error(
                "اختر المدينة"
            );
        }

        const images =
            await prepareImagesForSaving(
                editAdImages
            );

        validateAdSecurity({
            title,
            category,
            price,
            city,
            description,
            sellerId: ad.sellerId,
            images
        }, ad.id);

        ad.title =
            title;

        ad.category =
            category;

        ad.price =
            price;

        ad.city =
            city;

        ad.latitude = Number($("editAdLatitude")?.value) || null;

        ad.longitude = Number($("editAdLongitude")?.value) || null;

        ad.description =
            description;

        ad.car =
            car;

        ad.electronics =
            electronics;

        ad.images =
            images;

        ad.image =
            images[0] || "";

        ad.sellerName = user.name || ad.sellerName || "مستخدم دوّر";
        ad.sellerPhone = user.phone || ad.sellerPhone || "";
        ad.sellerPhoto = user.photo || "";
        ad.updatedAt =
            Date.now();

        ads[index] =
            ad;

        if (firebaseReady && ad.images.length) {
            ad.images = await uploadAdImagesToFirebase(ad.images, ad.id);
            ad.image = ad.images[0] || "";
        }

        saveAds(ads);

        addNotification(
            "تم تحديث إعلانك",
            "تم حفظ تعديلات إعلانك بنجاح.",
            "✏️",
            user.id,
            {
                type: "ad_updated",
                adId: ad.id
            }
        );

        closeEditAd();

        renderAllAds();
        renderMyAds();
        renderSearchPage();
        renderFavorites();

        showToast(
            "تم حفظ التعديلات",
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "حدث خطأ أثناء الحفظ",
            "!"
        );

    } finally {

        if (button) {

            button.classList.remove(
                "processing"
            );

            button.textContent =
                "حفظ التعديلات";
        }
    }
}


/* =========================================================
   DELETE AD
========================================================= */

function deleteAd(adId) {

    if (!requireLogin()) {
        return;
    }

    const ad =
        findAd(adId);

    if (!ad) {
        return;
    }

    if (!userOwnsAd(ad)) {

        showToast(
            "لا يمكنك حذف هذا الإعلان",
            "!"
        );

        return;
    }

    const confirmed =
        window.confirm(
            "هل أنت متأكد من حذف الإعلان؟"
        );

    if (!confirmed) {
        return;
    }

    let ads =
        getAds();

    ads =
        ads.filter(
            item =>
                String(item.id) !==
                String(adId)
        );

    saveAds(ads);

    let favorites =
        getFavorites();

    favorites =
        favorites.filter(
            id =>
                String(id) !==
                String(adId)
        );

    saveFavorites(
        favorites
    );

    renderMyAds();
    renderAllAds();
    renderFavorites();
    renderSearchPage();

    if (
        String(currentDetailsAdId) ===
        String(adId)
    ) {

        closeAdDetails();
    }

    showToast(
        "تم حذف الإعلان",
        "🗑"
    );
}


/* =========================================================
   SOLD
========================================================= */

function toggleSold(adId) {

    const user =
        getCurrentUser();

    if (!requireLogin() || !user) {
        return;
    }

    const ads =
        getAds();

    const ad =
        ads.find(
            item =>
                String(item.id) ===
                String(adId)
        );

    if (!ad) {
        return;
    }

    if (!userOwnsAd(ad)) {

        showToast(
            "لا يمكنك تغيير حالة هذا الإعلان",
            "!"
        );

        return;
    }

    ad.sold =
        !ad.sold;

    ad.status =
        ad.sold
            ? "sold"
            : "active";

    ad.updatedAt =
        Date.now();

    saveAds(ads);

    addNotification(
        ad.sold ? "تم تحديث حالة إعلانك" : "تم إعادة تفعيل إعلانك",
        ad.sold
            ? "تم وضع إعلانك كمباع."
            : "تم إعادة إعلانك إلى حالة متاح.",
        ad.sold ? "✓" : "↩️",
        user.id,
        {
            type: "ad_status",
            adId: ad.id
        }
    );

    renderMyAds();
    renderAllAds();
    renderSearchPage();
    renderFavorites();

    showToast(
        ad.sold
            ? "تم وضع الإعلان كمباع"
            : "تم إعادة الإعلان كمتاح",
        ad.sold
            ? "✓"
            : "↩️"
    );
}


/* =========================================================
   NAVIGATION
========================================================= */

function removeDynamicMessagingPages() {

    const messagesPage =
        $("messagesDynamicPage");

    if (messagesPage) {
        messagesPage.remove();
    }

    const chatPage =
        $("chatDynamicModal");

    if (chatPage) {
        chatPage.remove();
    }
}


function showPage(pageId) {

    removeDynamicMessagingPages();

    const pages =
        document.querySelectorAll(
            ".page"
        );

    pages.forEach(
        page => {

            page.style.display =
                "none";
        }
    );

    const page =
        $(pageId);

    if (page) {

        page.style.display =
            "block";

        page.style.visibility =
            "visible";

        page.style.opacity =
            "1";
    }

    updateBottomNavigation(
        pageId
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function goHome() {

    currentChatId =
        null;

    currentChatMeta =
        null;

    lastChatSignature =
        "";

    localStorage.removeItem(
        ACTIVE_CHAT_KEY
    );

    document.body.style.overflow =
        "";

    showPage(
        "homePage"
    );

    renderAllAds();
}


function goSearch() {

    openSearchPage();
}


function goFavorites() {

    openFavoritesPage();
}


function goProfile() {

    openProfilePage();
}


function updateBottomNavigation(
    pageId
) {

    const buttons = [

        $("navHome"),
        $("navSearch"),
        $("navFavorites"),
        $("navProfile")

    ];

    buttons.forEach(
        button => {

            if (button) {

                button.classList.remove(
                    "active"
                );
            }
        }
    );

    if (
        pageId ===
        "homePage"
    ) {

        $("navHome")?.classList.add(
            "active"
        );

    } else if (
        pageId ===
        "searchPage"
    ) {

        $("navSearch")?.classList.add(
            "active"
        );

    } else if (
        pageId ===
        "favoritesPage"
    ) {

        $("navFavorites")?.classList.add(
            "active"
        );

    } else if (
        pageId ===
            "profilePage" ||
        pageId ===
            "myAdsPage" ||
        pageId ===
            "sellerProfilePage"
    ) {

        $("navProfile")?.classList.add(
            "active"
        );
    }
}


/* =========================================================
   SELLER PROFILE
========================================================= */

const FOLLOWED_SELLERS_KEY = "doorrFollowedSellers";

function getFollowedSellersStorageKey(userId = null) {
    const user = getCurrentUser();
    const id = userId || user?.id || "guest";
    return `${FOLLOWED_SELLERS_KEY}_${String(id)}`;
}

function getFollowedSellers() {
    try {
        const data = localStorage.getItem(getFollowedSellersStorageKey());
        if (!data) return [];
        const list = JSON.parse(data);
        return Array.isArray(list) ? list.map(String) : [];
    } catch (error) {
        return [];
    }
}

function saveFollowedSellers(list) {
    localStorage.setItem(
        getFollowedSellersStorageKey(),
        JSON.stringify(Array.from(new Set(list.map(String))))
    );
}

function isFollowingSeller(sellerId) {
    return getFollowedSellers().includes(String(sellerId));
}

function getSellerAds(sellerId) {
    return getAds()
        .filter(ad => String(ad.sellerId || "") === String(sellerId || ""))
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function getSellerProfileData(sellerId) {
    const ads = getSellerAds(sellerId);
    if (!ads.length) return null;

    const firstAd = [...ads].sort(
        (a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)
    )[0];

    const latestAd = ads[0];
    const totalViews = ads.reduce(
        (sum, ad) => sum + Number(ad.views || 0),
        0
    );

    const activeAds = ads.filter(ad => !ad.sold).length;
    const sellerName =
        ads.find(ad => ad.sellerName)?.sellerName || "مستخدم دوّر";
    const sellerPhone =
        ads.find(ad => ad.sellerPhone)?.sellerPhone || "";
    const city =
        ads.find(ad => ad.city)?.city || "كل ليبيا";

    const registeredUser = getRegisteredUsers().find(
        user => String(user.id) === String(sellerId || "")
    );

    const currentUser = getCurrentUser();

    const sellerPhoto =
        registeredUser?.photo ||
        ads.find(ad => ad.sellerPhoto)?.sellerPhoto ||
        (currentUser && String(currentUser.id) === String(sellerId) ? currentUser.photo : "") ||
        "";

    const profileName = registeredUser?.name || sellerName;
    const profilePhone = registeredUser?.phone || sellerPhone;
    const profileCity = registeredUser?.city || city || "كل ليبيا";
    const profileBio = registeredUser?.bio || "";
    const memberSince = registeredUser?.createdAt || firstAd?.createdAt || Date.now();

    return {
        sellerId: String(sellerId),
        sellerName: profileName,
        sellerPhone: profilePhone,
        sellerPhoto,
        bio: profileBio,
        city: profileCity,
        memberSince,
        ads,
        activeAds,
        totalViews,
        firstAdDate: firstAd?.createdAt || Date.now(),
        lastActivity: latestAd?.updatedAt || latestAd?.createdAt || Date.now()
    };
}

function formatSellerDate(timestamp) {
    if (!timestamp) return "غير محدد";

    try {
        return new Date(Number(timestamp)).toLocaleDateString(
            "ar-LY",
            {
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );
    } catch (error) {
        return "غير محدد";
    }
}

function getSellerInitial(name) {
    const value = String(name || "مستخدم دوّر").trim();
    return value.charAt(0) || "د";
}

function openSellerProfile(sellerId) {
    const profile = getSellerProfileData(sellerId);

    if (!profile) {
        showToast("لا توجد معلومات عن هذا البائع", "!");
        return;
    }

    currentDetailsAdId = null;
    const detailsModal = $("adDetailsModal");
    if (detailsModal) detailsModal.style.display = "none";

    // صفحة ملف البائع صفحة عادية قابلة للتمرير،
    // لذلك نعيد تفعيل تمرير الصفحة بعد إغلاق تفاصيل الإعلان.
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";

    showPage("sellerProfilePage");
    renderSellerProfile(profile);
}

function renderSellerProfile(profile) {
    const container = $("sellerProfileContent");
    if (!container || !profile) return;

    const currentUser = getCurrentUser();
    const isOwnProfile =
        currentUser && String(currentUser.id) === String(profile.sellerId);
    const following = isFollowingSeller(profile.sellerId);

    const avatar = getSellerInitial(profile.sellerName);
    const sellerPhoto = String(profile.sellerPhoto || "").trim();
    const sellerAvatarHTML = sellerPhoto
        ? `<img src="${escapeHTML(sellerPhoto)}" alt="صورة ${escapeHTML(profile.sellerName)}">`
        : escapeHTML(avatar);

    const contactAd = profile.ads.find(ad =>
        !ad.sold && ad.sellerPhone
    ) || profile.ads.find(ad => ad.sellerPhone) || profile.ads[0];

    const adsHTML = profile.ads.length
        ? profile.ads.map(ad => {
            const image = Array.isArray(ad.images) && ad.images.length
                ? ad.images[0]
                : (ad.image || "");

            return `
                <article class="seller-ad-card" onclick="openAdDetails('${escapeQuotes(ad.id)}')">
                    <div class="seller-ad-image">
                        ${image
                            ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(ad.title)}">`
                            : `<div>${getCategoryEmoji(ad.category)}</div>`
                        }
                        ${ad.sold ? `<span class="seller-ad-sold">مباع</span>` : ""}
                    </div>
                    <div class="seller-ad-body">
                        <span class="seller-ad-category">${escapeHTML(ad.category || "أخرى")}</span>
                        <h3>${escapeHTML(ad.title || "إعلان بدون عنوان")}</h3>
                        <strong>${formatPrice(ad.price)}</strong>
                        <div class="seller-ad-meta">
                            <span>📍 ${escapeHTML(ad.city || "كل ليبيا")}</span>
                            <span>👁 ${Number(ad.views || 0)}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join("")
        : `
            <div class="seller-profile-empty">
                <div>📦</div>
                <strong>لا توجد إعلانات</strong>
                <span>هذا البائع لا يملك إعلانات منشورة حاليًا.</span>
            </div>
        `;

    container.innerHTML = `
        <section class="seller-profile-hero-card">
            <div class="seller-profile-avatar ${sellerPhoto ? "has-photo" : ""}">${sellerAvatarHTML}</div>

            <div class="seller-profile-main-info">
                <div class="seller-profile-name-row">
                    <h1>${escapeHTML(profile.sellerName)}</h1>
                    <span class="seller-profile-badge">✓</span>
                </div>
                <p>عضو في دوّر</p>
                <div class="seller-profile-location">📍 ${escapeHTML(profile.city)}</div>
            </div>

            ${!isOwnProfile ? `
                <button
                    type="button"
                    class="seller-follow-btn ${following ? "following" : ""}"
                    onclick="toggleFollowSeller('${escapeQuotes(profile.sellerId)}')"
                >
                    <span>${following ? "✓" : "+"}</span>
                    ${following ? "تتابعه" : "متابعة"}
                </button>
            ` : `
                <button
                    type="button"
                    class="seller-edit-profile-btn"
                    onclick="openProfileEditor()"
                >
                    ✏️ تعديل الملف
                </button>
            `}
        </section>

        <section class="seller-stats-card">
            <div class="seller-stat">
                <strong>${profile.ads.length}</strong>
                <span>إعلان</span>
            </div>
            <div class="seller-stat">
                <strong>${profile.activeAds}</strong>
                <span>متاح</span>
            </div>
            <div class="seller-stat">
                <strong>${profile.totalViews.toLocaleString("ar-LY")}</strong>
                <span>مشاهدة</span>
            </div>
        </section>

        ${profile.bio ? `
            <section class="seller-profile-bio-card">
                <div class="seller-bio-title">نبذة عن البائع</div>
                <p>${escapeHTML(profile.bio)}</p>
            </section>
        ` : ""}

        <section class="seller-profile-info-card">
            <div class="seller-info-line">
                <span>📍</span>
                <div>
                    <small>المدينة</small>
                    <strong>${escapeHTML(profile.city || "كل ليبيا")}</strong>
                </div>
            </div>
            <div class="seller-info-line">
                <span>📅</span>
                <div>
                    <small>عضو في دوّر منذ</small>
                    <strong>${formatSellerDate(profile.memberSince)}</strong>
                </div>
            </div>
            <div class="seller-info-line">
                <span>🛍️</span>
                <div>
                    <small>أول إعلان على دوّر</small>
                    <strong>${formatSellerDate(profile.firstAdDate)}</strong>
                </div>
            </div>
            <div class="seller-info-line">
                <span>🕒</span>
                <div>
                    <small>آخر نشاط إعلاني</small>
                    <strong>${formatSellerDate(profile.lastActivity)}</strong>
                </div>
            </div>
        </section>

        ${!isOwnProfile && contactAd ? `
            <section class="seller-profile-actions">
                <button
                    type="button"
                    class="seller-action message"
                    onclick="startChatWithSeller('${escapeQuotes(contactAd.id)}')"
                >
                    <span>💬</span>
                    <div><strong>مراسلة البائع</strong><small>داخل دوّر</small></div>
                </button>
                <button
                    type="button"
                    class="seller-action call"
                    onclick="callSeller('${escapeQuotes(contactAd.id)}')"
                >
                    <span>📞</span>
                    <div><strong>اتصال</strong><small>بالبائع</small></div>
                </button>
                <button
                    type="button"
                    class="seller-action whatsapp"
                    onclick="contactSeller('${escapeQuotes(contactAd.id)}')"
                >
                    <span>🟢</span>
                    <div><strong>واتساب</strong><small>تواصل سريع</small></div>
                </button>
            </section>
        ` : ""}

        <section class="seller-ads-section">
            <div class="seller-ads-heading">
                <div>
                    <span>من هذا البائع</span>
                    <h2>إعلانات ${escapeHTML(profile.sellerName)}</h2>
                </div>
                <strong>${profile.ads.length}</strong>
            </div>

            <div class="seller-ads-grid">
                ${adsHTML}
            </div>
        </section>
    `;
}

function toggleFollowSeller(sellerId) {
    const id = String(sellerId || "");
    if (!id) return;

    const currentUser = getCurrentUser();
    if (!currentUser) {
        openLogin();
        return;
    }

    if (String(currentUser.id) === id) {
        showToast("هذا ملفك", "ℹ️");
        return;
    }

    let followed = getFollowedSellers();
    const index = followed.indexOf(id);

    if (index >= 0) {
        followed.splice(index, 1);
        showToast("تم إلغاء متابعة البائع", "−");
    } else {
        followed.push(id);
        showToast("تمت متابعة البائع", "✓");
    }

    saveFollowedSellers(followed);

    if (firebaseReady && firebaseDb && currentUser.id) {
        const followId = `${String(currentUser.id)}_${id}`;
        if (index >= 0) {
            firebaseDeleteDoc("follows", followId);
        } else {
            firebaseSetDoc("follows", followId, {
                followerId: String(currentUser.id),
                sellerId: id,
                createdAt: Date.now()
            });
        }
    }

    const profile = getSellerProfileData(id);
    if (profile) renderSellerProfile(profile);
}


async function notifyFollowersOfNewAd(ad) {
    if (!ad || !ad.id || !ad.sellerId) return;

    try {
        const followers = new Set();

        // الحسابات الموجودة على نفس الجهاز.
        getRegisteredUsers().forEach(user => {
            if (!user || String(user.id) === String(ad.sellerId)) return;
            const key = `${FOLLOWED_SELLERS_KEY}_${String(user.id)}`;
            try {
                const list = JSON.parse(localStorage.getItem(key) || "[]");
                if (Array.isArray(list) && list.map(String).includes(String(ad.sellerId))) {
                    followers.add(String(user.id));
                }
            } catch (_) {}
        });

        // المتابعون المحفوظون على Firebase، حتى لو كانوا على أجهزة أخرى.
        if (firebaseReady && firebaseDb) {
            const cloudFollows = await firebaseGetCollection("follows");
            cloudFollows.forEach(item => {
                if (String(item.sellerId || "") === String(ad.sellerId) && item.followerId) {
                    followers.add(String(item.followerId));
                }
            });
        }

        followers.forEach(followerId => {
            if (String(followerId) === String(ad.sellerId)) return;
            addNotification(
                "بائع تتابعه نشر إعلانًا جديدًا",
                `نشر ${ad.sellerName || "بائع تتابعه"} إعلانًا جديدًا: «${ad.title || "إعلان جديد"}».`,
                "🔔",
                followerId,
                { type: "followed_seller_new_ad", adId: ad.id, senderId: String(ad.sellerId) }
            );
        });
    } catch (error) {
        console.error("Notify followers error:", error);
    }
}


/* =========================================================
   PROFILE
========================================================= */

function openProfilePage() {

    showPage(
        "profilePage"
    );

    updateProfileUI();
}


function getProfileFavoritesCount() {
    const user = getCurrentUser();
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        const data = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(data)) return 0;
        return data.length;
    } catch (e) { return 0; }
}

function getProfilePhoto(user) {
    return user && user.photo ? String(user.photo) : '';
}

function renderProfileAvatar(element, user) {
    if (!element) return;
    const photo = getProfilePhoto(user);
    if (photo) {
        element.innerHTML = `<img src="${escapeHTML(photo)}" alt="صورة الحساب">`;
    } else {
        element.innerHTML = '<span class="ui-icon ui-icon-user" aria-hidden="true"></span>';
    }
}

function updateProfileStats(user) {
    const stats = $('profileStats');
    if (!stats) return;
    if (!user) { stats.style.display = 'none'; return; }
    const ads = getUserAds();
    const views = ads.reduce((sum, ad) => sum + Number(ad.views || 0), 0);
    $('profileAdsCount').textContent = ads.length.toLocaleString('ar-LY');
    $('profileFavoritesCount').textContent = getProfileFavoritesCount().toLocaleString('ar-LY');
    $('profileViewsCount').textContent = views.toLocaleString('ar-LY');
    stats.style.display = 'grid';
}

function updateProfileUI() {
    const user = getCurrentUser();
    const name = $('profileName');
    const phone = $('profilePhone');
    const loginButton = $('profileLoginButton');
    const editButton = $('profileEditButton');
    const logoutButton = $('logoutButton');
    const avatar = $('profileAvatar');

    if (!user) {
        if (name) name.textContent = 'مرحبًا بك في دوّر';
        if (phone) phone.textContent = 'سجّل الدخول لإدارة إعلاناتك';
        if (loginButton) loginButton.style.display = 'block';
        if (editButton) editButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';
        renderProfileAvatar(avatar, null);
        updateProfileStats(null);
        return;
    }

    if (name) name.textContent = user.name || 'مستخدم دوّر';
    if (phone) phone.textContent = user.phone || '';
    if (loginButton) loginButton.style.display = 'none';
    if (editButton) editButton.style.display = 'block';
    if (logoutButton) logoutButton.style.display = 'flex';
    renderProfileAvatar(avatar, user);
    updateProfileStats(user);
}

let profilePhotoDraft = '';

function openProfileEditor() {
    const user = getCurrentUser();
    if (!user) { openLogin(); return; }
    const modal = $('profileEditorModal');
    if (!modal) return;
    $('profileEditName').value = user.name || '';
    $('profileEditPhone').value = user.phone || '';
    $('profileEditBio').value = user.bio || '';
    $('profileEditCity').value = user.city || '';
    profilePhotoDraft = user.photo || '';
    renderProfileAvatar($('profileEditorAvatar'), user);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('profileEditName')?.focus(), 100);
}

function closeProfileEditor() {
    const modal = $('profileEditorModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
    profilePhotoDraft = '';
}

function previewProfilePhoto(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('اختر صورة صحيحة', '!'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('الصورة كبيرة جدًا — الحد 2MB', '!'); return; }
    const reader = new FileReader();
    reader.onload = () => {
        profilePhotoDraft = String(reader.result || '');
        const fakeUser = { photo: profilePhotoDraft };
        renderProfileAvatar($('profileEditorAvatar'), fakeUser);
    };
    reader.readAsDataURL(file);
}

function removeProfilePhoto() {
    profilePhotoDraft = '';
    renderProfileAvatar($('profileEditorAvatar'), null);
    const input = $('profilePhotoInput');
    if (input) input.value = '';
}

function saveProfileEditor() {
    const user = getCurrentUser();
    if (!user) { closeProfileEditor(); openLogin(); return; }
    const nameInput = $('profileEditName');
    const cleanName = String(nameInput?.value || '').trim();
    if (cleanName.length < 2) { showToast('اكتب اسمًا صحيحًا', '!'); return; }
    const bioInput = $('profileEditBio');
    const cityInput = $('profileEditCity');
    user.name = cleanName;
    user.photo = profilePhotoDraft || '';
    user.bio = String(bioInput?.value || '').trim().slice(0, 160);
    user.city = String(cityInput?.value || '').trim().slice(0, 40);
    saveCurrentUser(user);
    registerUser(user);
    updateSellerNamesForUser(user);
    updateProfileUI();
    closeProfileEditor();
    showToast('تم تحديث الحساب ✓', '✓');
}

function openPasswordChange() {
    const user = getCurrentUser();
    if (!user) { openLogin(); return; }
    const modal = $('passwordChangeModal');
    if (!modal) return;
    ['currentPassword','newPassword','confirmNewPassword'].forEach(id => {
        const el = $(id);
        if (el) el.value = '';
    });
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('currentPassword')?.focus(), 100);
}

function closePasswordChange() {
    const modal = $('passwordChangeModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

async function changeAccountPassword() {
    const user = getCurrentUser();
    if (!user) { closePasswordChange(); openLogin(); return; }
    const currentPassword = String($('currentPassword')?.value || '');
    const newPassword = String($('newPassword')?.value || '');
    const confirmPassword = String($('confirmNewPassword')?.value || '');
    if (currentPassword.length < 1) { showToast('اكتب كلمة المرور الحالية', '!'); return; }
    if (newPassword.length < 6) { showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أكثر', '!'); return; }
    if (newPassword !== confirmPassword) { showToast('تأكيد كلمة المرور غير مطابق', '!'); return; }
    if (newPassword === currentPassword) { showToast('استخدم كلمة مرور جديدة مختلفة', '!'); return; }
    if (!firebaseReady || typeof firebase === 'undefined' || !firebase.auth) {
        showToast('خدمة تغيير كلمة المرور غير متاحة الآن', '!');
        return;
    }
    const authUser = firebase.auth().currentUser;
    if (!authUser || !authUser.email) {
        showToast('سجّل الدخول من جديد ثم حاول مرة أخرى', '🔐');
        return;
    }
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(authUser.email, currentPassword);
        await authUser.reauthenticateWithCredential(credential);
        await authUser.updatePassword(newPassword);
        closePasswordChange();
        showToast('تم تغيير كلمة المرور بنجاح ✓', '✓');
    } catch (error) {
        console.error('Password change error:', error);
        const code = String(error?.code || '');
        if (code.includes('wrong-password') || code.includes('invalid-credential')) {
            showToast('كلمة المرور الحالية غير صحيحة', '!');
        } else if (code.includes('weak-password')) {
            showToast('كلمة المرور الجديدة ضعيفة', '!');
        } else if (code.includes('requires-recent-login')) {
            showToast('سجّل الخروج ثم الدخول من جديد وبعدها غيّر كلمة المرور', '🔐');
        } else {
            showToast('تعذر تغيير كلمة المرور، حاول مرة أخرى', '!');
        }
    }
}


/* =========================================================
   LOGIN - FIREBASE PHONE AUTH
========================================================= */

function toFirebasePhone(phone) {
    let value = String(phone || "").trim();
    value = value.replace(/[^\d+]/g, "");

    if (value.startsWith("+218")) {
        return value;
    }

    if (value.startsWith("218")) {
        return "+" + value;
    }

    if (value.startsWith("0")) {
        return "+218" + value.substring(1);
    }

    return "+218" + value;
}

function firebaseAuthErrorMessage(error) {
    const code = String(error?.code || "");

    const messages = {
        "auth/invalid-phone-number": "رقم الهاتف غير صحيح",
        "auth/missing-phone-number": "أدخل رقم الهاتف أولاً",
        "auth/quota-exceeded": "تم تجاوز حد إرسال رسائل التحقق مؤقتًا، حاول لاحقًا",
        "auth/too-many-requests": "محاولات كثيرة جدًا، حاول بعد قليل",
        "auth/captcha-check-failed": "فشل التحقق الأمني، أعد المحاولة",
        "auth/invalid-verification-code": "كود التحقق غير صحيح",
        "auth/code-expired": "انتهت صلاحية الكود، اطلب كودًا جديدًا",
        "auth/provider-already-linked": "هذا الرقم مرتبط بحساب بالفعل",
        "auth/operation-not-allowed": "تسجيل الدخول برقم الهاتف غير مفعّل في Firebase",
        "auth/app-not-authorized": "هذا النطاق غير مصرح به في Firebase Authentication",
        "auth/unauthorized-domain": "هذا النطاق غير مضاف إلى Authorized domains في Firebase",
        "auth/network-request-failed": "تعذر الاتصال بـ Firebase، تحقق من الإنترنت",
        "auth/billing-not-enabled": "خدمة التحقق عبر الهاتف تحتاج إعدادات الفوترة المناسبة في Firebase"
    };

    return messages[code] || "تعذر إكمال تسجيل الدخول، حاول مرة أخرى";
}

function firebaseEmailFromPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return "";
    return "u" + normalized.replace(/^0+/, "") + "@doorr.app";
}

function phoneFromFirebaseEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    const match = value.match(/^u(\d+)@doorr\.app$/);
    if (!match) return "";
    return normalizePhone("0" + match[1]);
}

let authMode = "login";

function firebasePasswordAuthErrorMessage(error) {
    const code = error && error.code ? error.code : "";
    const messages = {
        "auth/invalid-email": "رقم الهاتف غير صحيح",
        "auth/invalid-credential": "رقم الهاتف أو كلمة المرور غير صحيحة",
        "auth/user-not-found": "لا يوجد حساب بهذا الرقم",
        "auth/wrong-password": "كلمة المرور غير صحيحة",
        "auth/email-already-in-use": "هذا الرقم لديه حساب بالفعل، جرّب تسجيل الدخول",
        "auth/weak-password": "كلمة المرور ضعيفة، استخدم 6 أحرف أو أكثر",
        "auth/operation-not-allowed": "فعّل Email/Password من Firebase Authentication",
        "auth/network-request-failed": "تعذر الاتصال بـ Firebase، تحقق من الإنترنت",
        "auth/too-many-requests": "محاولات كثيرة، حاول لاحقًا"
    };
    return messages[code] || "تعذر إكمال العملية، حاول مرة أخرى";
}

function togglePasswordVisibility(inputId, button) {
    const input = $(inputId);
    if (!input) return;

    const showing = input.type === "text";
    input.type = showing ? "password" : "text";

    if (button) {
        button.textContent = showing ? "👁️" : "🙈";
        button.setAttribute("aria-label", showing ? "إظهار كلمة المرور" : "إخفاء كلمة المرور");
        button.setAttribute("title", showing ? "إظهار كلمة المرور" : "إخفاء كلمة المرور");
    }
}

function updatePasswordVisibilityButtons() {
    ["loginPassword", "loginPasswordConfirm"].forEach(id => {
        const input = $(id);
        if (!input) return;
        const button = document.querySelector('[data-password-toggle="' + id + '"]');
        if (!button) return;
        input.type = "password";
        button.textContent = "👁️";
        button.setAttribute("aria-label", "إظهار كلمة المرور");
        button.setAttribute("title", "إظهار كلمة المرور");
    });
}

function setAuthMode(mode) {
    authMode = mode === "register" ? "register" : "login";

    const title = $("loginModalTitle");
    const subtitle = $("loginModalSubtitle");
    const nameGroup = $("authNameGroup");
    const confirmGroup = $("authConfirmPasswordGroup");
    const submit = $("authSubmitBtn");
    const loginBtn = $("authLoginModeBtn");
    const registerBtn = $("authRegisterModeBtn");
    const password = $("loginPassword");
    const confirm = $("loginPasswordConfirm");

    if (authMode === "register") {
        if (title) title.textContent = "إنشاء حساب";
        if (subtitle) subtitle.textContent = "أنشئ حسابك في دوّر برقم الهاتف وكلمة المرور";
        if (nameGroup) nameGroup.style.display = "block";
        if (confirmGroup) confirmGroup.style.display = "block";
        if (submit) submit.textContent = "إنشاء الحساب 🚀";
        if (password) password.autocomplete = "new-password";
        if (confirm) confirm.required = true;
        loginBtn?.classList.remove("active");
        registerBtn?.classList.add("active");
    } else {
        if (title) title.textContent = "تسجيل الدخول";
        if (subtitle) subtitle.textContent = "ادخل برقم هاتفك وكلمة المرور";
        if (nameGroup) nameGroup.style.display = "none";
        if (confirmGroup) confirmGroup.style.display = "none";
        if (submit) submit.textContent = "تسجيل الدخول 🔐";
        if (password) password.autocomplete = "current-password";
        if (confirm) {
            confirm.required = false;
            confirm.value = "";
        }
        loginBtn?.classList.add("active");
        registerBtn?.classList.remove("active");
    }
}

function finishFirebasePasswordLogin(authUser, phone, name = "") {
    if (!authUser) return;

    const normalized = normalizePhone(phone || phoneFromFirebaseEmail(authUser.email));
    let user = getCurrentUser();

    if (!user || normalizePhone(user.phone || "") !== normalized) {
        user = {
            id: makeUserIdFromPhone(normalized),
            name: name || authUser.displayName || "مستخدم دوّر",
            phone: normalized,
            createdAt: Date.now()
        };
    }

    user.phone = normalized;
    user.firebaseUid = authUser.uid;
    user.authProvider = "password";
    user.lastLogin = Date.now();
    if (name) user.name = name;
    if (!user.name) user.name = authUser.displayName || "مستخدم دوّر";

    saveCurrentUser(user);
    registerUser(user);

    closeLogin();
    updateProfileUI();
    updateMessagesBadge();
    renderMyAds();
    renderAllAds();
    renderSearchPage();

    showToast(authMode === "register" ? "تم إنشاء حسابك بنجاح ✓" : "تم تسجيل الدخول ✓", "✓");
}

async function loginUser(event) {
    event.preventDefault();

    const phoneInput = $("loginPhone");
    const passwordInput = $("loginPassword");
    const nameInput = $("loginName");
    const confirmInput = $("loginPasswordConfirm");
    const button = $("authSubmitBtn");

    const phone = normalizePhone(phoneInput?.value || "");
    const password = String(passwordInput?.value || "");
    const name = String(nameInput?.value || "").trim();
    const confirm = String(confirmInput?.value || "");

    if (phone.length < 9 || phone.length > 15) {
        showToast("أدخل رقم هاتف ليبي صحيح", "!");
        phoneInput?.focus();
        return;
    }

    if (password.length < 6) {
        showToast("كلمة المرور يجب أن تكون 6 أحرف أو أكثر", "!");
        passwordInput?.focus();
        return;
    }

    if (authMode === "register") {
        if (name.length < 2) {
            showToast("اكتب اسمك", "!");
            nameInput?.focus();
            return;
        }
        if (password !== confirm) {
            showToast("كلمتا المرور غير متطابقتين", "!");
            confirmInput?.focus();
            return;
        }
    }

    if (!firebaseReady || !firebaseAuth) {
        showToast("Firebase غير متصل حاليًا", "!");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = authMode === "register" ? "جاري إنشاء الحساب..." : "جاري تسجيل الدخول...";
    }

    try {
        const email = firebaseEmailFromPhone(phone);
        let result;

        if (authMode === "register") {
            result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            if (result.user && name) {
                await result.user.updateProfile({ displayName: name });
            }
        } else {
            result = await firebaseAuth.signInWithEmailAndPassword(email, password);
        }

        finishFirebasePasswordLogin(result.user, phone, name || result.user.displayName || "");
    } catch (error) {
        console.error("Firebase password auth error:", error);
        showToast(firebasePasswordAuthErrorMessage(error), "!");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = authMode === "register" ? "إنشاء الحساب 🚀" : "تسجيل الدخول 🔐";
        }
    }
}

function openLogin() {
    const modal = $("loginModal");
    if (!modal) return;

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
    setAuthMode("login");
    updatePasswordVisibilityButtons();

    $("loginPhone")?.focus();
}

function closeLogin() {
    const modal = $("loginModal");
    if (!modal) return;

    modal.style.display = "none";
    document.body.style.overflow = "";

    ["loginPhone", "loginPassword", "loginPasswordConfirm", "loginName"].forEach(id => {
        const el = $(id);
        if (el) el.value = "";
    });

    setAuthMode("login");
}

/* =========================================================
   USER NAME
========================================================= */

function changeUserName() {

    const user =
        getCurrentUser();

    if (!user) {

        openLogin();

        return;
    }

    const newName =
        window.prompt(
            "اكتب اسمك",
            user.name || ""
        );

    if (
        newName ===
        null
    ) {
        return;
    }

    const cleanName =
        newName.trim();

    if (!cleanName) {

        showToast(
            "اكتب اسمًا صحيحًا",
            "!"
        );

        return;
    }

    user.name =
        cleanName;

    saveCurrentUser(
        user
    );
    registerUser(user);

    updateProfileUI();

    updateSellerNamesForUser(
        user
    );

    showToast(
        "تم تغيير الاسم",
        "✓"
    );
}


function updateSellerNamesForUser(
    user
) {

    const ads =
        getAds();

    let changed =
        false;

    ads.forEach(
        ad => {

            if (
                String(ad.sellerId) ===
                String(user.id)
            ) {

                ad.sellerName =
                    user.name;
                ad.sellerPhoto =
                    user.photo || "";

                changed =
                    true;
            }
        }
    );

    if (changed) {
        saveAds(ads);
    }
}


/* =========================================================
   LOGOUT
========================================================= */

function logoutUser() {

    const confirmed =
        window.confirm(
            "هل تريد تسجيل الخروج؟"
        );

    if (!confirmed) {
        return;
    }

    if (firebaseReady && firebaseAuth) {
        firebaseAuth.signOut().catch(error => console.warn("Firebase signOut:", error));
    }

    localStorage.removeItem(
        CURRENT_USER_KEY
    );

    currentChatId =
        null;

    currentChatMeta =
        null;

    lastChatSignature =
        "";

    localStorage.removeItem(
        ACTIVE_CHAT_KEY
    );

    removeDynamicMessagingPages();

    document.body.style.overflow =
        "";

    updateProfileUI();
    updateMessagesBadge();

    goHome();

    showToast(
        "تم تسجيل الخروج",
        "✓"
    );
}


/* =========================================================
   NOTIFICATIONS - نظام إشعارات فعلي
========================================================= */

function getNotificationsStorageKey(userId = null) {

    const user =
        getCurrentUser();

    const id =
        userId !== null &&
        userId !== undefined &&
        String(userId).trim()
            ? String(userId).trim()
            : user && user.id
                ? String(user.id)
                : "guest";

    return NOTIFICATIONS_KEY + "_" + id;
}


function getNotifications(userId = null) {

    try {

        const key =
            getNotificationsStorageKey(userId);

        let data =
            localStorage.getItem(key);

        /*
           ترحيل الإشعارات القديمة مرة واحدة إلى حساب المستخدم الحالي.
           هذا يحافظ على الإشعارات التي كانت محفوظة قبل تطوير النظام.
        */
        const user = getCurrentUser();
        const effectiveUserId =
            userId !== null &&
            userId !== undefined &&
            String(userId).trim()
                ? String(userId).trim()
                : user && user.id
                    ? String(user.id)
                    : "guest";

        if (
            !data &&
            effectiveUserId !== "guest"
        ) {

            const legacy =
                localStorage.getItem(
                    NOTIFICATIONS_KEY
                );

            if (legacy) {
                try {
                    const legacyItems =
                        JSON.parse(legacy);

                    if (Array.isArray(legacyItems) && legacyItems.length) {
                        const migrated = legacyItems.map(item => ({
                            ...item,
                            targetUserId: effectiveUserId
                        }));

                        localStorage.setItem(
                            key,
                            JSON.stringify(migrated.slice(0, 50))
                        );

                        data =
                            JSON.stringify(migrated);
                    }
                } catch (_) {}
            }
        }

        if (!data) {
            return [];
        }

        const notifications =
            JSON.parse(data);

        return Array.isArray(notifications)
            ? notifications
            : [];

    } catch (error) {

        console.error(
            "Notifications error:",
            error
        );

        return [];
    }
}


function saveNotifications(
    notifications,
    userId = null
) {

    const key =
        getNotificationsStorageKey(userId);

    const safeNotifications = Array.isArray(notifications)
        ? notifications.slice(0, 50)
        : [];

    localStorage.setItem(
        key,
        JSON.stringify(safeNotifications)
    );

    if (firebaseReady) {
        safeNotifications.forEach(notification => {
            if (notification && notification.id) {
                firebaseSetDoc("notifications", notification.id, notification);
            }
        });
    }
}


function showDeviceNotification(
    title,
    message,
    icon = "🔔"
) {

    try {

        if (
            typeof Notification === "undefined" ||
            Notification.permission !== "granted"
        ) {
            return;
        }

        const notification =
            new Notification(
                "دوّر - " + title,
                {
                    body: message,
                    icon: icon
                }
            );

        notification.onclick =
            function () {
                try {
                    window.focus();
                } catch (_) {}

                openNotifications();
                notification.close();
            };

    } catch (error) {
        console.warn(
            "Device notification error:",
            error
        );
    }
}


function requestDeviceNotifications() {

    if (typeof Notification === "undefined") {

        showToast(
            "متصفحك لا يدعم إشعارات الجهاز",
            "!"
        );

        return;
    }

    if (Notification.permission === "granted") {

        showToast(
            "إشعارات الجهاز مفعّلة بالفعل",
            "✓"
        );

        return;
    }

    if (Notification.permission === "denied") {

        showToast(
            "إشعارات الجهاز محظورة من إعدادات المتصفح",
            "!"
        );

        return;
    }

    Notification.requestPermission()
        .then(permission => {

            if (permission === "granted") {

                showToast(
                    "تم تفعيل إشعارات الجهاز",
                    "✓"
                );

                showDeviceNotification(
                    "الإشعارات مفعّلة",
                    "ستصلك تنبيهات دوّر عند وجود إشعارات جديدة.",
                    "🔔"
                );

            } else {

                showToast(
                    "لم يتم تفعيل إشعارات الجهاز",
                    "!"
                );
            }
        })
        .catch(() => {

            showToast(
                "تعذر تفعيل إشعارات الجهاز",
                "!"
            );
        });
}


function addNotification(
    title,
    message,
    icon = "🔔",
    targetUserId = null,
    extra = {}
) {

    const user =
        getCurrentUser();

    const receiverId =
        targetUserId !== null &&
        targetUserId !== undefined &&
        String(targetUserId).trim()
            ? String(targetUserId).trim()
            : user && user.id
                ? String(user.id)
                : null;

    if (!receiverId) {
        return null;
    }

    const notifications =
        getNotifications(receiverId);

    const notification = {

        id:
            generateId(
                "notification"
            ),

        title:
            String(title || "إشعار جديد"),

        message:
            String(message || "لديك إشعار جديد في دوّر."),

        icon:
            icon || "🔔",

        createdAt:
            Date.now(),

        read:
            false,

        targetUserId:
            receiverId,

        type:
            extra.type || "general",

        adId:
            extra.adId || null,

        chatId:
            extra.chatId || null,

        senderId:
            extra.senderId || null
    };

    notifications.unshift(
        notification
    );

    saveNotifications(
        notifications,
        receiverId
    );

    if (
        user &&
        String(user.id) === receiverId
    ) {

        updateNotificationDot();

        showDeviceNotification(
            notification.title,
            notification.message,
            notification.icon
        );
    }

    return notification;
}


function formatNotificationTime(timestamp) {

    const time =
        Number(timestamp);

    if (!time) {
        return "";
    }

    const diff =
        Math.max(
            0,
            Date.now() - time
        );

    const minute =
        60 * 1000;

    const hour =
        60 * minute;

    const day =
        24 * hour;

    if (diff < minute) {
        return "الآن";
    }

    if (diff < hour) {
        return "منذ " +
            Math.floor(diff / minute) +
            " د";
    }

    if (diff < day) {
        return "منذ " +
            Math.floor(diff / hour) +
            " س";
    }

    if (diff < 7 * day) {
        return "منذ " +
            Math.floor(diff / day) +
            " يوم";
    }

    return new Date(time)
        .toLocaleDateString(
            "ar-LY",
            {
                day: "numeric",
                month: "short"
            }
        );
}


function renderNotifications() {

    const modal =
        $("notificationsModal");

    if (!modal) {
        return;
    }

    const notifications =
        getNotifications();

    let list =
        $("dynamicNotificationsList");

    if (!list) {

        list =
            document.createElement("div");

        list.id =
            "dynamicNotificationsList";

        list.style.cssText =
            "padding:10px 16px 24px;display:flex;flex-direction:column;gap:10px;";

        const oldItems =
            modal.querySelectorAll(
                ".notification-item"
            );

        oldItems.forEach(
            item => item.remove()
        );

        const body =
            modal.querySelector(
                ".modal-box"
            ) ||
            modal.querySelector(
                ".modal-body"
            ) ||
            modal.querySelector(
                ".notifications-list"
            ) ||
            modal.querySelector(
                ".modal-content"
            );

        if (body) {
            body.appendChild(list);
        } else {
            modal.appendChild(list);
        }
    }

    list.innerHTML = "";

    if (
        typeof Notification !== "undefined" &&
        Notification.permission !== "granted"
    ) {

        const enable =
            document.createElement("button");

        enable.type = "button";
        enable.textContent =
            "🔔 تفعيل إشعارات الجهاز";

        enable.style.cssText =
            "width:100%;border:0;border-radius:14px;padding:13px 16px;background:#171a1f;color:#fff;font-size:14px;font-weight:700;cursor:pointer;";

        enable.onclick =
            requestDeviceNotifications;

        list.appendChild(enable);
    }

    if (!notifications.length) {

        const empty =
            document.createElement("div");

        empty.style.cssText =
            "text-align:center;padding:36px 15px;color:#68707a;";

        empty.innerHTML =
            "<div style='font-size:42px;margin-bottom:10px;'>🔔</div>" +
            "<strong style='display:block;color:#20242a;font-size:17px;margin-bottom:6px;'>لا توجد إشعارات</strong>" +
            "<span style='font-size:14px;'>سنضع هنا أي إشعار جديد يخص حسابك.</span>";

        list.appendChild(empty);

        return;
    }

    notifications.forEach(
        item => {

            const card =
                document.createElement("button");

            card.type = "button";
            card.style.cssText =
                "width:100%;text-align:right;border:1px solid #e3e6ea;border-radius:16px;padding:13px;background:" +
                (item.read ? "#ffffff" : "#f0f3f7") +
                ";cursor:pointer;display:flex;gap:12px;align-items:flex-start;";

            const icon =
                document.createElement("div");

            icon.textContent =
                item.icon || "🔔";

            icon.style.cssText =
                "width:42px;height:42px;min-width:42px;border-radius:12px;background:#171a1f;color:#fff;display:flex;align-items:center;justify-content:center;font-size:21px;";

            const text =
                document.createElement("div");

            text.style.cssText =
                "min-width:0;flex:1;";

            const title =
                document.createElement("strong");

            title.textContent =
                item.title || "إشعار";

            title.style.cssText =
                "display:block;color:#171a1f;font-size:15px;margin-bottom:4px;";

            const message =
                document.createElement("div");

            message.textContent =
                item.message || "";

            message.style.cssText =
                "color:#5f6770;font-size:13px;line-height:1.6;";

            const time =
                document.createElement("small");

            time.textContent =
                formatNotificationTime(
                    item.createdAt
                );

            time.style.cssText =
                "display:block;color:#9299a1;font-size:11px;margin-top:6px;";

            text.appendChild(title);
            text.appendChild(message);
            text.appendChild(time);

            card.appendChild(icon);
            card.appendChild(text);

            card.onclick =
                function () {

                    const current =
                        getNotifications();

                    const found =
                        current.find(
                            n =>
                                String(n.id) ===
                                String(item.id)
                        );

                    if (found) {
                        found.read = true;
                        saveNotifications(current);
                    }

                    updateNotificationDot();

                    if (item.chatId) {
                        closeNotifications();
                        openChat(
                            item.chatId
                        );
                    } else if (item.adId) {
                        closeNotifications();
                        openAdDetails(
                            item.adId
                        );
                    }
                };

            list.appendChild(card);
        }
    );
}


function updateNotificationDot() {

    const dot =
        $("notificationDot");

    if (!dot) {
        return;
    }

    const notifications =
        getNotifications();

    const unread =
        notifications.some(
            item => !item.read
        );

    dot.style.display =
        unread
            ? "block"
            : "none";
}


function openNotifications() {

    const modal =
        $("notificationsModal");

    if (!modal) {
        return;
    }

    // افتح النافذة أولاً ثم ابنِ القائمة داخل صندوق النافذة نفسه.
    // هذا يمنع اختفاء الإشعارات خلف الـ overlay.
    modal.style.display =
        "block";

    document.body.style.overflow =
        "hidden";

    renderNotifications();

    const notifications =
        getNotifications();

    notifications.forEach(
        item => {
            item.read = true;
        }
    );

    saveNotifications(
        notifications
    );

    updateNotificationDot();

    // إعادة الرسم حتى يظهر اللون الصحيح بعد اعتبارها مقروءة.
    renderNotifications();
}


function closeNotifications() {

    const modal =
        $("notificationsModal");

    if (!modal) {
        return;
    }

    modal.style.display =
        "none";

    document.body.style.overflow =
        "";
}


/* =========================================================
   MESSAGES STORAGE
========================================================= */

function getMessagesData() {

    try {

        const data =
            localStorage.getItem(
                MESSAGES_KEY
            );

        if (!data) {
            return [];
        }

        const messages =
            JSON.parse(data);

        return Array.isArray(messages)
            ? messages
            : [];

    } catch (error) {

        console.error(
            "Messages error:",
            error
        );

        return [];
    }
}


function saveMessagesData(
    messages
) {

    const safeMessages = Array.isArray(messages) ? messages : [];
    localStorage.setItem(
        MESSAGES_KEY,
        JSON.stringify(safeMessages)
    );

    if (firebaseReady) {
        const recent = safeMessages.slice(-30);
        recent.forEach(message => {
            if (message && message.id) firebaseSetDoc("messages", message.id, message);
        });
    }
}


function getChatMeta() {

    try {

        const data =
            localStorage.getItem(
                CHAT_META_KEY
            );

        if (!data) {
            return {};
        }

        const meta =
            JSON.parse(data);

        return meta &&
            typeof meta === "object"
            ? meta
            : {};

    } catch (error) {

        return {};
    }
}


function saveChatMeta(meta) {

    localStorage.setItem(
        CHAT_META_KEY,
        JSON.stringify(meta)
    );
}


/* =========================================================
   CHAT ID
========================================================= */

function createConversationId(
    userA,
    userB,
    adId
) {

    const users = [
        String(userA || ""),
        String(userB || "")
    ].sort();

    return (
        "chat_" +
        users[0] +
        "__" +
        users[1] +
        "__" +
        String(adId || "")
    );
}


function createMessageId() {

    return generateId(
        "message"
    );
}


/* =========================================================
   CHAT INFO
========================================================= */

function getChatInfo(chatId) {

    const user = getCurrentUser();
    const userId = String(user?.id || "");
    const meta = getChatMeta();
    const saved = meta && meta[chatId] ? meta[chatId] : null;

    const messages = getMessagesData().filter(
        message => String(message.chatId) === String(chatId)
    );

    // مهم: بيانات المحادثة المحفوظة قد تكون من الحساب الآخر
    // (خصوصًا عند تجربة حساب الزبون والبائع على نفس الجهاز).
    // لا نسمح أبدًا باعتبار المستخدم الحالي هو الطرف الآخر.
    if (messages.length) {
        const sorted = [...messages].sort(
            (a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)
        );
        const first = sorted[0];

        const other = sorted.find(message =>
            String(message.senderId) === userId
                ? String(message.receiverId || "") !== userId
                : String(message.senderId || "") !== userId
        );

        if (other) {
            const otherUserId =
                String(other.senderId) === userId
                    ? String(other.receiverId || "")
                    : String(other.senderId || "");

            if (otherUserId && otherUserId !== userId) {
                const otherUserName =
                    String(other.senderId) === userId
                        ? (other.receiverName || "مستخدم دوّر")
                        : (other.senderName || "مستخدم دوّر");

                return {
                    chatId: String(chatId),
                    adId: first.adId || saved?.adId || null,
                    otherUserId,
                    otherUserName
                };
            }
        }
    }

    if (saved && String(saved.otherUserId || "") !== userId) {
        return saved;
    }

    if (currentChatMeta &&
        String(currentChatMeta.chatId) === String(chatId) &&
        String(currentChatMeta.otherUserId || "") !== userId) {
        return currentChatMeta;
    }

    return null;
}


/* =========================================================
   CONVERSATIONS
========================================================= */

function getConversationList() {

    const user =
        getCurrentUser();

    if (!user) {
        return [];
    }

    const messages =
        getMessagesData();

    const grouped = {};

    messages.forEach(
        message => {

            const participant =
                String(
                    message.senderId
                ) ===
                    String(user.id) ||
                String(
                    message.receiverId
                ) ===
                    String(user.id);

            if (!participant) {
                return;
            }

            const chatId =
                message.chatId;

            if (!chatId) {
                return;
            }

            if (
                !grouped[chatId]
            ) {

                grouped[chatId] = {
                    chatId:
                        chatId,

                    messages:
                        []
                };
            }

            grouped[chatId]
                .messages
                .push(message);
        }
    );

    const meta =
        getChatMeta();

    return Object.values(
        grouped
    )
        .map(
            conversation => {

                const sorted =
                    [
                        ...conversation.messages
                    ].sort(
                        (a, b) =>
                            Number(
                                a.createdAt || 0
                            ) -
                            Number(
                                b.createdAt || 0
                            )
                    );

                const last =
                    sorted[
                        sorted.length - 1
                    ];

                conversation.lastMessage =
                    last;

                const other =
                    sorted.find(
                        message =>
                            String(
                                message.senderId
                            ) !==
                            String(
                                user.id
                            )
                    );

                const savedMeta = meta[conversation.chatId];
                const savedOtherId = String(savedMeta?.otherUserId || "");

                // نحدد الطرف الآخر بالنسبة للحساب الحالي أولًا،
                // ولا نعتمد على meta إذا كان يشير للحساب الحالي.
                const derivedOtherId = other
                    ? String(other.senderId || "")
                    : (String(last?.senderId || "") === String(user.id)
                        ? String(last?.receiverId || "")
                        : String(last?.senderId || ""));

                const useSaved = savedOtherId && savedOtherId !== String(user.id);
                conversation.otherUserId = useSaved ? savedOtherId : derivedOtherId;

                conversation.otherUserName = useSaved
                    ? (savedMeta?.otherUserName || "مستخدم دوّر")
                    : (other
                        ? (other.senderName || "مستخدم دوّر")
                        : (String(last?.senderId || "") === String(user.id)
                            ? (last?.receiverName || "مستخدم دوّر")
                            : (last?.senderName || "مستخدم دوّر")));

                conversation.adId =
                    (useSaved ? savedMeta?.adId : null) ||
                    last?.adId ||
                    null;

                conversation.unread =
                    sorted.filter(
                        message =>
                            String(
                                message.receiverId
                            ) ===
                                String(user.id) &&
                            !message.read
                    ).length;

                return conversation;
            }
        )
        .sort(
            (a, b) =>
                Number(
                    b.lastMessage?.createdAt ||
                    0
                ) -
                Number(
                    a.lastMessage?.createdAt ||
                    0
                )
        );
}


/* =========================================================
   MESSAGE BADGE
========================================================= */

function getUnreadMessagesCount() {

    const user =
        getCurrentUser();

    if (!user) {
        return 0;
    }

    return getMessagesData()
        .filter(
            message =>
                String(
                    message.receiverId
                ) ===
                    String(user.id) &&
                !message.read
        )
        .length;
}


function ensureMessagesBadge() {

    const buttons =
        document.querySelectorAll(
            '[onclick="openMessages()"]'
        );

    buttons.forEach(
        button => {

            if (
                button.querySelector(
                    ".messages-badge"
                )
            ) {
                return;
            }

            const badge =
                document.createElement(
                    "span"
                );

            badge.className =
                "messages-badge";

            badge.style.cssText = `
                display:none;
                min-width:20px;
                height:20px;
                padding:0 6px;
                align-items:center;
                justify-content:center;
                border-radius:20px;
                background:#171a1f;
                color:#fff;
                font-size:11px;
                font-weight:700;
                margin-right:auto;
            `;

            button.appendChild(
                badge
            );
        }
    );
}


function updateMessagesBadge() {

    ensureMessagesBadge();

    const count =
        getUnreadMessagesCount();

    const elements =
        document.querySelectorAll(
            ".messages-badge"
        );

    elements.forEach(
        element => {

            if (count > 0) {

                element.style.display =
                    "flex";

                element.textContent =
                    count > 99
                        ? "99+"
                        : String(count);

            } else {

                element.style.display =
                    "none";
            }
        }
    );
}


/* =========================================================
   MESSAGE PAGE STYLES
   نضيفها من JS حتى لا تحتاج تعديل CSS الآن
========================================================= */

function ensureMessagingStyles() {

    if (
        $("doorrMessagingStyles")
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "doorrMessagingStyles";

    style.textContent = `

        .messages-page {
            width:100%;
            height:100vh;
            min-height:100vh;
            background:#f5f7fa;
            padding:14px 16px 18px;
            box-sizing:border-box;
            position:relative;
            z-index:5;
            display:flex;
            flex-direction:column;
            overflow:hidden;
        }

        .messages-header {
            display:flex;
            align-items:center;
            gap:12px;
            margin-bottom:10px;
            flex:0 0 auto;
        }

        .messages-back {
            width:44px;
            height:44px;
            border:0;
            border-radius:14px;
            background:#fff;
            box-shadow:0 4px 18px rgba(0,0,0,.07);
            font-size:24px;
            cursor:pointer;
        }

        .messages-header h2 {
            margin:0;
            color:#171a1f;
            font-size:22px;
        }

        .messages-header p {
            margin:2px 0 0;
            color:#777;
            font-size:13px;
        }

        .messages-list {
            display:flex;
            flex-direction:column;
            gap:10px;
            flex:1 1 auto;
            min-height:0;
            overflow-y:auto;
            overflow-x:hidden;
            padding:2px 2px 10px;
            -webkit-overflow-scrolling:touch;
        }

        .message-conversation {
            width:100%;
            border:0;
            background:#fff;
            border-radius:18px;
            padding:14px;
            display:flex;
            align-items:center;
            gap:12px;
            text-align:right;
            cursor:pointer;
            box-shadow:0 5px 18px rgba(0,0,0,.05);
        }

        .message-conversation.has-unread {
            box-shadow:
                0 0 0 1px rgba(23,26,31,.08),
                0 6px 20px rgba(0,0,0,.07);
        }

        .conversation-avatar {
            width:52px;
            height:52px;
            flex:0 0 52px;
            border-radius:50%;
            background:#eef0f3;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:25px;
        }

        .conversation-info {
            flex:1;
            min-width:0;
        }

        .conversation-top {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
        }

        .conversation-name {
            color:#171a1f;
            font-size:15px;
        }

        .conversation-time {
            color:#999;
            font-size:11px;
            white-space:nowrap;
        }

        .conversation-ad {
            margin-top:3px;
            color:#777;
            font-size:12px;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
        }

        .conversation-bottom {
            display:flex;
            align-items:center;
            gap:8px;
            margin-top:6px;
        }

        .conversation-last {
            color:#555;
            font-size:13px;
            flex:1;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
        }

        .conversation-unread {
            min-width:20px;
            height:20px;
            padding:0 5px;
            border-radius:20px;
            background:#171a1f;
            color:#fff;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:10px;
            font-weight:700;
        }


        .messages-search-box {
            margin: 4px 0 10px;
            flex:0 0 auto;
            background: #fff;
            border: 1px solid #e8eaed;
            border-radius: 16px;
            min-height: 46px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0 13px;
            box-shadow: 0 3px 12px rgba(0,0,0,.03);
        }

        .messages-search-box span {
            color: #8a8f96;
            font-size: 22px;
            line-height: 1;
        }

        .messages-search-box input {
            flex: 1;
            min-width: 0;
            border: 0;
            outline: 0;
            background: transparent;
            font-family: inherit;
            font-size: 13px;
            direction: rtl;
        }

        .conversation-avatar {
            width: 52px !important;
            height: 52px !important;
            min-width: 52px !important;
            border-radius: 50% !important;
            overflow: hidden;
            background: #eef0f3;
        }

        .chat-avatar-photo {
            object-fit: cover;
            display: block;
        }

        .chat-avatar-initial {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #171a1f;
            font-size: 18px;
            font-weight: 800;
        }

        .chat-header .chat-avatar {
            overflow: hidden;
        }

        .chat-header .chat-avatar.chat-avatar-photo {
            display: block;
            object-fit: cover;
        }

        .chat-message-status {
            letter-spacing: -2px;
            margin-right: 2px;
        }

        .messages-empty {
            background:#fff;
            border-radius:22px;
            padding:45px 22px;
            text-align:center;
            box-shadow:0 5px 18px rgba(0,0,0,.05);
            margin-top:25px;
        }

        .messages-empty-icon {
            font-size:50px;
            margin-bottom:10px;
        }

        .messages-empty h3 {
            margin:0 0 7px;
            color:#171a1f;
        }

        .messages-empty p {
            margin:0;
            color:#777;
            line-height:1.7;
            font-size:13px;
        }

        .chat-modal {
            position:fixed !important;
            inset:0 !important;
            z-index:99999 !important;
            display:block !important;
            background:#f5f7fa !important;
            width:100% !important;
            height:100% !important;
            overflow:hidden !important;
        }

        .chat-modal-content {
            width:100% !important;
            max-width:760px !important;
            height:100% !important;
            margin:0 auto !important;
            padding:0 !important;
            background:#f5f7fa !important;
            display:flex !important;
            flex-direction:column !important;
            border-radius:0 !important;
            overflow:hidden !important;
        }

        .chat-header {
            flex:0 0 auto;
            min-height:68px;
            background:#fff;
            display:flex;
            align-items:center;
            gap:10px;
            padding:10px 14px;
            border-bottom:1px solid #e9ebee;
        }

        .chat-back,
        .chat-delete {
            width:42px;
            height:42px;
            border:0;
            border-radius:13px;
            background:#f1f2f4;
            cursor:pointer;
            font-size:21px;
        }

        .chat-delete {
            margin-right:auto;
            font-size:18px;
        }

        .chat-avatar {
            width:44px;
            height:44px;
            border-radius:50%;
            background:#eef0f3;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:22px;
            flex:0 0 44px;
        }

        .chat-user-info {
            min-width:0;
            display:flex;
            flex-direction:column;
        }

        .chat-user-info strong {
            color:#171a1f;
            font-size:15px;
        }

        .chat-user-info span {
            color:#888;
            font-size:11px;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
            max-width:190px;
        }

        .chat-ad-card {
            flex:0 0 auto;
            margin:10px 12px 0;
            padding:9px;
            border-radius:15px;
            background:#fff;
            display:flex;
            align-items:center;
            gap:10px;
            box-shadow:0 3px 12px rgba(0,0,0,.04);
        }

        .chat-ad-image {
            width:52px;
            height:52px;
            border-radius:11px;
            object-fit:cover;
            background:#eef0f3;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:25px;
        }

        .chat-ad-info {
            min-width:0;
            display:flex;
            flex-direction:column;
            gap:3px;
        }

        .chat-ad-info strong {
            font-size:13px;
            color:#171a1f;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
        }

        .chat-ad-info span {
            color:#666;
            font-size:12px;
        }

        .chat-messages {
            flex:1 1 auto;
            overflow-y:auto;
            padding:16px 13px 18px;
            display:flex;
            flex-direction:column;
            gap:8px;
            min-height:0;
        }

        .chat-date {
            align-self:center;
            background:#e9ebee;
            color:#777;
            border-radius:20px;
            padding:4px 10px;
            font-size:10px;
            margin:8px 0;
        }

        .chat-message {
            max-width:82%;
            padding:9px 12px;
            border-radius:16px;
            display:flex;
            flex-direction:column;
            gap:3px;
            word-break:break-word;
        }

        .chat-message.mine {
            align-self:flex-start;
            background:#171a1f;
            color:#fff;
            border-bottom-left-radius:5px;
        }

        .chat-message.theirs {
            align-self:flex-end;
            background:#fff;
            color:#171a1f;
            border-bottom-right-radius:5px;
            box-shadow:0 3px 12px rgba(0,0,0,.05);
        }

        .chat-message-text {
            font-size:14px;
            line-height:1.55;
        }

        .chat-message-time {
            font-size:9px;
            opacity:.6;
            align-self:flex-end;
        }

        .chat-empty {
            margin:auto;
            text-align:center;
            color:#777;
        }

        .chat-empty div {
            font-size:55px;
            margin-bottom:10px;
        }

        .chat-empty p {
            margin:0;
            font-size:13px;
        }

        .chat-input-area {
            flex:0 0 auto;
            background:#fff;
            border-top:1px solid #e7e8ea;
            padding:9px;
            display:flex;
            gap:8px;
            padding-bottom:calc(9px + env(safe-area-inset-bottom));
        }

        .chat-input {
            flex:1;
            min-width:0;
            height:46px;
            border:1px solid #e0e2e5;
            border-radius:15px;
            padding:0 14px;
            outline:none;
            background:#f7f8f9;
            font-family:inherit;
            font-size:14px;
            direction:rtl;
        }

        .chat-input:focus {
            border-color:#b9bdc3;
            background:#fff;
        }

        .chat-send {
            width:48px;
            height:46px;
            border:0;
            border-radius:15px;
            background:#171a1f;
            color:#fff;
            font-size:21px;
            cursor:pointer;
        }


        .chat-tool-btn {
            width:44px;
            height:46px;
            border:1px solid #e0e2e5;
            border-radius:15px;
            background:#fff;
            font-size:18px;
            cursor:pointer;
            flex:0 0 auto;
        }
        .chat-tool-btn:active { transform:scale(.96); }
        .chat-message-image {
            display:block;
            width:min(230px, 100%);
            max-height:300px;
            object-fit:cover;
            border-radius:12px;
            cursor:pointer;
        }
        .chat-location-card {
            display:flex;
            align-items:center;
            gap:10px;
            min-width:190px;
            color:inherit;
            text-decoration:none;
            background:rgba(0,0,0,.045);
            border-radius:12px;
            padding:10px;
        }
        .chat-location-icon { font-size:27px; }
        .chat-location-card span:last-child { display:flex; flex-direction:column; gap:2px; }
        .chat-location-card small { font-size:10px; opacity:.65; }
        .chat-image-preview-modal {
            position:fixed;
            inset:0;
            z-index:1000001;
            background:rgba(0,0,0,.9);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:25px;
        }
        .chat-image-preview-modal img {
            max-width:100%;
            max-height:90vh;
            object-fit:contain;
            border-radius:12px;
        }
        .chat-image-preview-close {
            position:absolute;
            top:15px;
            right:15px;
            width:42px;
            height:42px;
            border:0;
            border-radius:50%;
            background:#fff;
            color:#111;
            font-size:28px;
            cursor:pointer;
        }

        @media (min-width:700px) {

            .chat-modal-content {
                box-shadow:
                    0 0 40px rgba(0,0,0,.12);
            }

        }

    
        .chat-message-actions{display:flex;gap:5px;margin-top:5px;opacity:.85;align-items:center}
        .chat-message-actions button{border:0;background:rgba(255,255,255,.72);border-radius:10px;padding:3px 7px;font-size:13px;cursor:pointer}
        .chat-message.mine .chat-message-actions button{background:rgba(255,255,255,.18);color:#fff}
        .chat-reaction-picker{display:flex;gap:4px;background:#fff;border-radius:14px;padding:5px;box-shadow:0 6px 20px rgba(0,0,0,.14);width:max-content;margin-top:4px}
        .chat-reaction-picker button{border:0;background:transparent;font-size:18px;padding:3px;cursor:pointer}
        .chat-reactions{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
        .chat-reaction{border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:999px;padding:2px 7px;font-size:12px;cursor:pointer}
        .chat-message.mine .chat-reaction{background:#fff;color:#222}
        .chat-message-deleted{font-style:italic;opacity:.7}
        .chat-reply-preview{align-items:center;justify-content:space-between;gap:10px;background:#fff;border-top:1px solid #e7e9ed;padding:8px 12px}
        .chat-reply-preview span{display:flex;flex-direction:column;min-width:0}
        .chat-reply-preview strong{font-size:12px;color:#333}
        .chat-reply-preview small{font-size:12px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70vw}
        .chat-reply-preview button{border:0;background:transparent;font-size:22px;color:#777;cursor:pointer}
        .chat-reply-quote{border-right:3px solid #777;background:rgba(0,0,0,.05);padding:5px 8px;border-radius:8px;margin-bottom:6px;display:flex;flex-direction:column;gap:1px}
        .chat-message.mine .chat-reply-quote{background:rgba(255,255,255,.12);border-right-color:#fff}
        .chat-reply-quote strong{font-size:11px}.chat-reply-quote span{font-size:11px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .chat-audio{width:220px;max-width:100%;height:38px}
        .chat-voice-btn.recording{animation:chatRecordPulse 1s infinite}
        @keyframes chatRecordPulse{50%{transform:scale(1.08)}}
`;

    document.head.appendChild(
        style
    );
}


/* =========================================================
   OPEN MESSAGES
========================================================= */

function openMessages() {

    if (!requireLogin()) {
        return;
    }

    showMessagesPage();
}



function getChatAvatarHTML(userId, fallbackName = "مستخدم دوّر", className = "conversation-avatar") {
    let photo = "";
    try {
        const registered = getRegisteredUsers().find(u => String(u.id) === String(userId));
        photo = getProfilePhoto(registered) || "";
    } catch (_) {}

    if (!photo) {
        try {
            const current = getCurrentUser();
            if (current && String(current.id) === String(userId)) {
                photo = getProfilePhoto(current) || "";
            }
        } catch (_) {}
    }

    if (photo) {
        return `<img class="${className} chat-avatar-photo" src="${escapeHTML(photo)}" alt="${escapeHTML(fallbackName)}">`;
    }

    const initial = getSellerInitial(fallbackName);
    return `<div class="${className} chat-avatar-initial">${escapeHTML(initial)}</div>`;
}

function filterConversationList() {
    const input = $("messagesSearchInput");
    const query = String(input?.value || "").trim().toLowerCase();
    document.querySelectorAll("#messagesList .message-conversation").forEach(item => {
        const haystack = String(item.dataset.search || "").toLowerCase();
        item.style.display = !query || haystack.includes(query) ? "flex" : "none";
    });
}

function showMessagesPage() {

    if (!requireLogin()) {
        return;
    }

    ensureMessagingStyles();

    const oldChat = $("chatDynamicModal");
    if (oldChat) oldChat.remove();

    const oldPage = $("messagesDynamicPage");
    if (oldPage) oldPage.remove();

    currentChatId = null;
    currentChatMeta = null;
    lastChatSignature = "";
    localStorage.removeItem(ACTIVE_CHAT_KEY);

    const page = document.createElement("section");
    page.id = "messagesDynamicPage";
    page.className = "page messages-page";
    page.style.cssText = `
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        position:relative !important;
        z-index:20 !important;
        width:100% !important;
        min-height:100vh !important;
        background:#f5f7fa !important;
        box-sizing:border-box !important;
        padding:14px 16px 18px !important;
    `;

    page.innerHTML = `
        <div class="messages-header">
            <button type="button" class="messages-back" id="messagesBackButton">←</button>
            <div>
                <h2>الرسائل</h2>
                <p>محادثاتك على دوّر</p>
            </div>
        </div>
        <div class="messages-search-box">
            <span>⌕</span>
            <input type="search" id="messagesSearchInput" placeholder="ابحث في المحادثات..." autocomplete="off">
        </div>
        <div class="messages-list" id="messagesList"></div>
    `;

    document.querySelectorAll(".page").forEach(other => {
        if (other !== page) {
            other.style.display = "none";
        }
    });

    document.body.appendChild(page);
    document.body.style.overflow = "";

    const messagesSearch = $("messagesSearchInput");
    if (messagesSearch) messagesSearch.addEventListener("input", filterConversationList);

    const back = $("messagesBackButton");
    if (back) {
        back.onclick = () => {
            page.remove();
            goHome();
        };
    }

    renderMessagesList();
    updateMessagesBadge();
    window.scrollTo({ top:0, behavior:"smooth" });
}

function renderMessagesList() {

    const container = $("messagesList");
    if (!container) return;

    const conversations = getConversationList();
    container.innerHTML = "";

    if (!conversations.length) {
        container.innerHTML = `
            <div class="messages-empty">
                <div class="messages-empty-icon">💬</div>
                <h3>ما عندكش رسائل</h3>
                <p>لما تتواصل مع بائع أو حد يتواصل معاك، المحادثة بتظهر هنا.</p>
            </div>
        `;
        return;
    }

    conversations.forEach(conversation => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "message-conversation";
        if (conversation.unread > 0) item.classList.add("has-unread");

        const last = conversation.lastMessage;
        const ad = conversation.adId ? findAd(conversation.adId) : null;
        item.dataset.search = `${conversation.otherUserName || ""} ${ad?.title || ""} ${last?.text || ""}`;

        item.innerHTML = `
            ${getChatAvatarHTML(conversation.otherUserId, conversation.otherUserName || "مستخدم دوّر")}
            <div class="conversation-info">
                <div class="conversation-top">
                    <strong class="conversation-name">${escapeHTML(conversation.otherUserName || "مستخدم دوّر")}</strong>
                    <span class="conversation-time">${formatConversationTime(last?.createdAt)}</span>
                </div>
                ${ad ? `<div class="conversation-ad">${escapeHTML(ad.title)}</div>` : ""}
                <div class="conversation-bottom">
                    <span class="conversation-last">${escapeHTML(last?.text || "")}</span>
                    ${conversation.unread > 0 ? `<span class="conversation-unread">${conversation.unread > 99 ? "99+" : conversation.unread}</span>` : ""}
                </div>
            </div>
        `;

        item.addEventListener("click", () => openChat(conversation.chatId, conversation));
        container.appendChild(item);
    });
}

function startChatWithSeller(adId) {

    if (!requireLogin()) return;

    const user = getCurrentUser();
    const ad = findAd(adId);

    if (!user || !ad) {
        showToast("الإعلان غير موجود", "!");
        return;
    }

    if (!ad.sellerId) {
        showToast("لا يمكن تحديد البائع", "!");
        return;
    }

    if (String(user.id) === String(ad.sellerId)) {
        showToast("لا يمكنك مراسلة نفسك", "ℹ️");
        return;
    }

    const chatId = createConversationId(user.id, ad.sellerId, ad.id);
    const meta = getChatMeta();

    currentChatId = chatId;
    currentChatMeta = {
        chatId,
        adId: ad.id,
        otherUserId: String(ad.sellerId),
        otherUserName: ad.sellerName || "بائع دوّر"
    };

    meta[chatId] = currentChatMeta;
    saveChatMeta(meta);
    localStorage.setItem(ACTIVE_CHAT_KEY, JSON.stringify(currentChatMeta));

    closeAdDetails();
    openChat(chatId, currentChatMeta);
}

function openChat(chatId, options = {}) {

    if (!requireLogin()) return;
    if (!chatId) {
        showToast("تعذر فتح المحادثة", "!");
        return;
    }

    ensureMessagingStyles();

    const user = getCurrentUser();
    currentChatId = String(chatId);

    let info = getChatInfo(currentChatId);

    if (options && (options.adId || options.otherUserId || options.otherUserName)) {
        info = {
            chatId: currentChatId,
            adId: options.adId || null,
            otherUserId: options.otherUserId || null,
            otherUserName: options.otherUserName || "مستخدم دوّر"
        };
    }

    if (!info) {
        const storedMeta = getChatMeta()[currentChatId];
        if (storedMeta) info = storedMeta;
    }

    if (!info) {
        try {
            const stored = JSON.parse(localStorage.getItem(ACTIVE_CHAT_KEY) || "null");
            if (stored && String(stored.chatId) === currentChatId) info = stored;
        } catch (_) {}
    }

    if (!info) {
        showToast("تعذر تحديد المحادثة", "!");
        return;
    }

    if (!info.otherUserId) {
        showToast("تعذر تحديد الطرف الآخر", "!");
        return;
    }

    currentChatMeta = {
        chatId: currentChatId,
        adId: info.adId || null,
        otherUserId: String(info.otherUserId),
        otherUserName: info.otherUserName || "مستخدم دوّر"
    };

    const meta = getChatMeta();
    meta[currentChatId] = currentChatMeta;
    saveChatMeta(meta);
    localStorage.setItem(ACTIVE_CHAT_KEY, JSON.stringify(currentChatMeta));

    const oldChat = $("chatDynamicModal");
    if (oldChat) oldChat.remove();

    const modal = document.createElement("div");
    modal.id = "chatDynamicModal";
    modal.className = "modal chat-modal";
    modal.style.cssText = `
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        position:fixed !important;
        inset:0 !important;
        z-index:999999 !important;
        width:100% !important;
        height:100% !important;
        background:#f5f7fa !important;
        overflow:hidden !important;
        margin:0 !important;
        padding:0 !important;
    `;

    const otherName = currentChatMeta.otherUserName;
    const ad = currentChatMeta.adId ? findAd(currentChatMeta.adId) : null;
    const adImage = ad ? getAdImage(ad) : "";
    const chatAvatar = getChatAvatarHTML(currentChatMeta.otherUserId, otherName || "مستخدم دوّر", "chat-avatar");

    modal.innerHTML = `
        <div class="modal-content chat-modal-content">
            <div class="chat-header">
                <button type="button" class="chat-back" id="chatBackButton">←</button>
                ${chatAvatar}
                <div class="chat-user-info">
                    <strong>${escapeHTML(otherName)}</strong>
                    ${ad ? `<span>${escapeHTML(ad.title)}</span>` : "<span>محادثة على دوّر</span>"}
                </div>
                <button type="button" class="chat-delete" id="chatDeleteButton" title="حذف المحادثة">🗑</button>
            </div>

            ${ad ? `
                <div class="chat-ad-card">
                    ${adImage
                        ? `<img class="chat-ad-image" src="${escapeHTML(adImage)}" alt="">`
                        : `<div class="chat-ad-image">${getCategoryEmoji(ad.category)}</div>`}
                    <div class="chat-ad-info">
                        <strong>${escapeHTML(ad.title)}</strong>
                        <span>${formatPrice(ad.price)}</span>
                    </div>
                </div>
            ` : ""}

            <div class="chat-messages" id="chatMessages"></div>
            <div class="chat-reply-preview" id="chatReplyPreview" style="display:none"></div>
            <form class="chat-input-area" id="chatForm">
                <button type="button" class="chat-tool-btn" id="chatImageButton" title="إرسال صورة">📷</button>
                <button type="button" class="chat-tool-btn" id="chatLocationButton" title="إرسال موقعي">📍</button>
                <button type="button" class="chat-tool-btn chat-voice-btn" id="chatVoiceButton" title="رسالة صوتية">🎤</button>
                <input type="file" id="chatImageInput" accept="image/*" hidden>
                <input type="text" class="chat-input" id="chatInput" placeholder="اكتب رسالتك..." autocomplete="off" maxlength="1000">
                <button type="button" class="chat-send" id="chatSendButton" title="إرسال">➤</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    markConversationAsRead(currentChatId);
    lastChatSignature = "";
    renderChat(currentChatId, true);

    const back = $("chatBackButton");
    if (back) {
        back.onclick = () => {
            modal.remove();
            document.body.style.overflow = "";
            currentChatId = null;
            currentChatMeta = null;
            localStorage.removeItem(ACTIVE_CHAT_KEY);
            showMessagesPage();
        };
    }

    const deleteButton = $("chatDeleteButton");
    if (deleteButton) {
        deleteButton.onclick = () => deleteCurrentChat(currentChatId);
    }

    const form = $("chatForm");
    if (form) form.addEventListener("submit", sendChatMessage);

    const sendButton = $("chatSendButton");
    if (sendButton) {
        sendButton.onclick = () => sendChatMessage({
            preventDefault() {}
        });
    }

    const inputForEnter = $("chatInput");
    if (inputForEnter) {
        inputForEnter.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendChatMessage(event);
            }
        });
    }

    const imageButton = $("chatImageButton");
    const imageInput = $("chatImageInput");
    if (imageButton && imageInput) {
        imageButton.onclick = () => imageInput.click();
        imageInput.addEventListener("change", handleChatImageSelection);
    }

    const locationButton = $("chatLocationButton");
    if (locationButton) locationButton.onclick = sendChatLocation;

    const voiceButton = $("chatVoiceButton");
    if (voiceButton) voiceButton.onclick = toggleChatVoiceRecording;

    const input = $("chatInput");
    if (input) setTimeout(() => input.focus(), 150);
}

function getChatSignature(chatId) {
    return getMessagesData()
        .filter(m => String(m.chatId) === String(chatId))
        .sort((a,b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
        .map(m => [m.id, m.createdAt, m.read, m.edited, m.deleted, JSON.stringify(m.reactions || {})].join(":"))
        .join("|");
}

function renderChat(chatId, force = false) {

    const container = $("chatMessages");
    const user = getCurrentUser();
    if (!container || !user) return;

    const signature = getChatSignature(chatId);
    if (!force && signature === lastChatSignature) return;
    lastChatSignature = signature;

    const messages = getMessagesData()
        .filter(m => String(m.chatId) === String(chatId))
        .sort((a,b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

    const oldScroll = container.scrollTop;
    const nearBottom = container.scrollHeight - oldScroll - container.clientHeight < 120;

    container.innerHTML = "";

    if (!messages.length) {
        container.innerHTML = `
            <div class="chat-empty">
                <div>💬</div>
                <p>ابدأ المحادثة برسالة 👋</p>
            </div>
        `;
        return;
    }

    let previousDate = "";

    messages.forEach(message => {
        const date = formatDate(message.createdAt);
        if (date && date !== previousDate) {
            const dateElement = document.createElement("div");
            dateElement.className = "chat-date";
            dateElement.textContent = date;
            container.appendChild(dateElement);
            previousDate = date;
        }

        const mine = String(message.senderId) === String(user.id);
        const bubble = document.createElement("div");
        bubble.className = `chat-message ${mine ? "mine" : "theirs"}`;
        let contentHTML = "";
        if (message.deleted) {
            contentHTML = `<div class="chat-message-deleted">تم حذف هذه الرسالة</div>`;
        } else if (message.type === "image" && message.media) {
            contentHTML = `
                <img class="chat-message-image" src="${escapeHTML(message.media)}" alt="صورة مرسلة" loading="lazy" onclick="openChatImage('${escapeQuotes(message.media)}')">
                ${message.text ? `<div class="chat-message-text">${escapeMessageHTML(message.text)}</div>` : ""}
            `;
        } else if (message.type === "location" && message.latitude && message.longitude) {
            const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(message.latitude + "," + message.longitude)}`;
            contentHTML = `
                <a class="chat-location-card" href="${escapeHTML(mapUrl)}" target="_blank" rel="noopener">
                    <span class="chat-location-icon">📍</span>
                    <span><strong>موقع جغرافي</strong><small>اضغط لفتح الموقع على الخريطة</small></span>
                </a>
                ${message.text ? `<div class="chat-message-text">${escapeMessageHTML(message.text)}</div>` : ""}
            `;
        } else if (message.type === "audio" && message.media) {
            contentHTML = `
                <audio class="chat-audio" controls preload="metadata" src="${escapeHTML(message.media)}"></audio>
                ${message.text ? `<div class="chat-message-text">${escapeMessageHTML(message.text)}</div>` : ""}
            `;
        } else {
            contentHTML = `<div class="chat-message-text">${escapeMessageHTML(message.text || "")}</div>`;
        }

        const reactions = message.reactions || {};
        const reactionHTML = Object.entries(reactions)
            .filter(([emoji, ids]) => Array.isArray(ids) && ids.length)
            .map(([emoji, ids]) => `<button type="button" class="chat-reaction" onclick="toggleMessageReaction('${escapeQuotes(message.id)}','${escapeQuotes(emoji)}')">${escapeHTML(emoji)} <span>${ids.length}</span></button>`)
            .join("");
        const actionsHTML = !message.deleted ? `
            <div class="chat-message-actions">
                <button type="button" onclick="setChatReply('${escapeQuotes(message.id)}')">↩️</button>
                <button type="button" onclick="toggleReactionPicker('${escapeQuotes(message.id)}')">😀</button>
                ${mine ? `<button type="button" onclick="deleteChatMessage('${escapeQuotes(message.id)}')">🗑️</button>` : ""}
            </div>
            <div class="chat-reaction-picker" id="reaction-picker-${escapeHTML(message.id)}" style="display:none">
                ${["👍","❤️","😂","😮","😢","👏"].map(e => `<button type="button" onclick="toggleMessageReaction('${escapeQuotes(message.id)}','${escapeQuotes(e)}')">${e}</button>`).join("")}
            </div>
            ${reactionHTML ? `<div class="chat-reactions">${reactionHTML}</div>` : ""}
        ` : "";
        const replyHTML = message.replyTo && !message.deleted ? `<div class="chat-reply-quote"><strong>${escapeHTML(message.replyTo.senderName || "مستخدم")}</strong><span>${escapeMessageHTML(message.replyTo.text || (message.replyTo.type === "image" ? "📷 صورة" : message.replyTo.type === "audio" ? "🎤 رسالة صوتية" : "📍 موقع"))}</span></div>` : "";

        bubble.innerHTML = `
            ${replyHTML}
            ${contentHTML}
            <span class="chat-message-time">${formatMessageTime(message.createdAt)}${message.edited ? " · معدلة" : ""}${mine ? ` <span class="chat-message-status">${message.read ? "✓✓" : "✓"}</span>` : ""}</span>
            ${actionsHTML}
        `;
        container.appendChild(bubble);
    });

    setTimeout(() => {
        if (nearBottom || messages.length <= 1) {
            container.scrollTop = container.scrollHeight;
        } else {
            container.scrollTop = oldScroll;
        }
    }, 0);
}

function sendChatMessage(event) {

    event.preventDefault();

    if (!currentChatId) {
        showToast("لم يتم تحديد المحادثة", "!");
        return;
    }

    const input = $("chatInput");
    const user = getCurrentUser();
    if (!input || !user) return;

    const text = input.value.trim();
    if (!text) return;

    let info = getChatInfo(currentChatId) || currentChatMeta;

    if (!info) {
        try {
            info = JSON.parse(localStorage.getItem(ACTIVE_CHAT_KEY) || "null");
        } catch (_) {}
    }

    if (!info || !info.otherUserId) {
        showToast("تعذر تحديد الطرف الآخر", "!");
        return;
    }

    if (String(info.otherUserId) === String(user.id)) {
        showToast("لا يمكنك مراسلة نفسك", "!");
        return;
    }

    const now = Date.now();
    const message = {
        id: createMessageId(),
        chatId: currentChatId,
        adId: info.adId || null,
        senderId: user.id,
        senderName: user.name || "مستخدم دوّر",
        receiverId: String(info.otherUserId),
        receiverName: info.otherUserName || "مستخدم دوّر",
        text,
        type: "text",
        media: null,
        latitude: null,
        longitude: null,
        createdAt: now,
        read: false,
        edited: false,
        deleted: false,
        reactions: {},
        replyTo: chatReplyTarget ? {
            id: chatReplyTarget.id,
            senderName: chatReplyTarget.senderName || "مستخدم",
            text: chatReplyTarget.text || "",
            type: chatReplyTarget.type || "text"
        } : null
    };

    const messages = getMessagesData();
    messages.push(message);
    saveMessagesData(messages);

    const meta = getChatMeta();
    meta[currentChatId] = {
        chatId: currentChatId,
        adId: info.adId || null,
        otherUserId: String(info.otherUserId),
        otherUserName: info.otherUserName || "مستخدم دوّر"
    };
    saveChatMeta(meta);
    currentChatMeta = meta[currentChatId];
    localStorage.setItem(ACTIVE_CHAT_KEY, JSON.stringify(currentChatMeta));

    addNotification(
        "رسالة جديدة",
        (user.name || "مستخدم دوّر") + " أرسل لك رسالة جديدة.",
        "💬",
        info.otherUserId,
        {
            type: "message",
            chatId: currentChatId,
            adId: info.adId || null,
            senderId: user.id
        }
    );

    input.value = "";
    clearChatReply();
    lastChatSignature = "";
    renderChat(currentChatId, true);
    updateMessagesBadge();

    showToast("تم إرسال الرسالة", "✓");
}


async function compressChatImage(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith("image/")) {
            reject(new Error("invalid-image"));
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            reject(new Error("large-image"));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read-image"));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxSide = 1280;
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext("2d");
                if (!ctx) { reject(new Error("canvas")); return; }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                let quality = 0.78;
                const make = () => {
                    canvas.toBlob(blob => {
                        if (!blob) { reject(new Error("blob")); return; }
                        const r = new FileReader();
                        r.onload = () => {
                            const data = String(r.result || "");
                            if (data.length <= 190000 || quality <= 0.45) resolve(data);
                            else { quality -= 0.08; make(); }
                        };
                        r.onerror = () => reject(new Error("blob-read"));
                        r.readAsDataURL(blob);
                    }, "image/jpeg", quality);
                };
                make();
            };
            img.onerror = () => reject(new Error("decode-image"));
            img.src = String(reader.result || "");
        };
        reader.readAsDataURL(file);
    });
}

function appendChatMessage(message) {
    const messages = getMessagesData();
    messages.push(message);
    saveMessagesData(messages);
    const meta = getChatMeta();
    meta[currentChatId] = {
        ...(meta[currentChatId] || {}),
        chatId: currentChatId,
        adId: currentChatMeta?.adId || null,
        otherUserId: String(currentChatMeta?.otherUserId || message.receiverId || ""),
        otherUserName: currentChatMeta?.otherUserName || message.receiverName || "مستخدم دوّر"
    };
    saveChatMeta(meta);
    currentChatMeta = meta[currentChatId];
    localStorage.setItem(ACTIVE_CHAT_KEY, JSON.stringify(currentChatMeta));
    addNotification(
        "رسالة جديدة",
        (getCurrentUser()?.name || "مستخدم دوّر") + " أرسل لك رسالة جديدة.",
        message.type === "image" ? "📷" : message.type === "location" ? "📍" : "💬",
        message.receiverId,
        { type: "message", chatId: currentChatId, adId: message.adId || null, senderId: message.senderId }
    );
    lastChatSignature = "";
    renderChat(currentChatId, true);
    updateMessagesBadge();
}

async function handleChatImageSelection(event) {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) return;
    const user = getCurrentUser();
    if (!user || !currentChatId || !currentChatMeta?.otherUserId) return;
    try {
        showToast("جاري تجهيز الصورة...", "📷");
        const media = await compressChatImage(file);
        const message = {
            id: createMessageId(), chatId: currentChatId, adId: currentChatMeta.adId || null,
            senderId: user.id, senderName: user.name || "مستخدم دوّر",
            receiverId: String(currentChatMeta.otherUserId), receiverName: currentChatMeta.otherUserName || "مستخدم دوّر",
            text: "", type: "image", media, latitude: null, longitude: null,
            createdAt: Date.now(), read: false, edited: false, deleted: false, reactions: {}, replyTo: chatReplyTarget ? { id: chatReplyTarget.id, senderName: chatReplyTarget.senderName || "مستخدم", text: chatReplyTarget.text || "", type: chatReplyTarget.type || "text" } : null
        };
        clearChatReply();
        appendChatMessage(message);
        showToast("تم إرسال الصورة", "✓");
    } catch (error) {
        showToast(error?.message === "large-image" ? "حجم الصورة كبير جدًا" : "تعذر إرسال الصورة", "!");
    } finally {
        input.value = "";
    }
}

function sendChatLocation() {
    const user = getCurrentUser();
    if (!user || !currentChatId || !currentChatMeta?.otherUserId) return;
    if (!navigator.geolocation) {
        showToast("الموقع غير مدعوم في جهازك", "!");
        return;
    }
    showToast("جاري تحديد موقعك...", "📍");
    navigator.geolocation.getCurrentPosition(position => {
        const message = {
            id: createMessageId(), chatId: currentChatId, adId: currentChatMeta.adId || null,
            senderId: user.id, senderName: user.name || "مستخدم دوّر",
            receiverId: String(currentChatMeta.otherUserId), receiverName: currentChatMeta.otherUserName || "مستخدم دوّر",
            text: "", type: "location", media: null,
            latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)),
            createdAt: Date.now(), read: false, edited: false, deleted: false, reactions: {}, replyTo: chatReplyTarget ? { id: chatReplyTarget.id, senderName: chatReplyTarget.senderName || "مستخدم", text: chatReplyTarget.text || "", type: chatReplyTarget.type || "text" } : null
        };
        clearChatReply();
        appendChatMessage(message);
        showToast("تم إرسال موقعك", "✓");
    }, () => showToast("تعذر الحصول على موقعك", "!"), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
}

function openChatImage(src) {
    if (!src) return;
    const old = $("chatImagePreviewModal");
    if (old) old.remove();
    const modal = document.createElement("div");
    modal.id = "chatImagePreviewModal";
    modal.className = "chat-image-preview-modal";
    modal.innerHTML = `<button type="button" class="chat-image-preview-close">×</button><img src="${escapeHTML(src)}" alt="صورة المحادثة">`;
    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal || e.target.classList.contains("chat-image-preview-close")) modal.remove(); };
}



let chatReplyTarget = null;
let chatMediaRecorder = null;
let chatAudioChunks = [];
let chatVoiceStartedAt = 0;

function setChatReply(messageId) {
    const message = getMessagesData().find(m => String(m.id) === String(messageId));
    if (!message || message.deleted) return;
    chatReplyTarget = message;
    const box = $("chatReplyPreview");
    if (box) {
        const preview = message.text || (message.type === "image" ? "📷 صورة" : message.type === "audio" ? "🎤 رسالة صوتية" : "📍 موقع");
        box.innerHTML = `<span><strong>الرد على ${escapeHTML(message.senderName || "مستخدم")}</strong><small>${escapeMessageHTML(preview)}</small></span><button type="button" onclick="clearChatReply()">×</button>`;
        box.style.display = "flex";
    }
    const input = $("chatInput");
    if (input) input.focus();
}

function clearChatReply() {
    chatReplyTarget = null;
    const box = $("chatReplyPreview");
    if (box) { box.style.display = "none"; box.innerHTML = ""; }
}

function toggleReactionPicker(messageId) {
    const picker = $("reaction-picker-" + messageId);
    if (picker) picker.style.display = picker.style.display === "none" ? "flex" : "none";
}

function toggleMessageReaction(messageId, emoji) {
    const user = getCurrentUser();
    if (!user) return;
    const messages = getMessagesData();
    const message = messages.find(m => String(m.id) === String(messageId));
    if (!message || message.deleted) return;
    if (!message.reactions || typeof message.reactions !== "object") message.reactions = {};
    if (!Array.isArray(message.reactions[emoji])) message.reactions[emoji] = [];
    const ids = message.reactions[emoji];
    const idx = ids.map(String).indexOf(String(user.id));
    if (idx >= 0) ids.splice(idx, 1); else ids.push(String(user.id));
    if (!ids.length) delete message.reactions[emoji];
    saveMessagesData(messages);
    lastChatSignature = "";
    renderChat(currentChatId, true);
}

function deleteChatMessage(messageId) {
    const user = getCurrentUser();
    if (!user) return;
    const messages = getMessagesData();
    const message = messages.find(m => String(m.id) === String(messageId));
    if (!message || String(message.senderId) !== String(user.id) || message.deleted) return;
    if (!window.confirm("حذف هذه الرسالة؟")) return;
    message.deleted = true;
    message.text = "";
    message.media = null;
    message.latitude = null;
    message.longitude = null;
    message.reactions = {};
    saveMessagesData(messages);
    lastChatSignature = "";
    renderChat(currentChatId, true);
    showToast("تم حذف الرسالة", "🗑️");
}

async function toggleChatVoiceRecording() {
    const button = $("chatVoiceButton");
    const user = getCurrentUser();
    if (!user || !currentChatId || !currentChatMeta?.otherUserId) return;
    if (chatMediaRecorder && chatMediaRecorder.state === "recording") {
        chatMediaRecorder.stop();
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
        showToast("التسجيل الصوتي غير مدعوم في هذا المتصفح", "!");
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported(t)) || "";
        chatAudioChunks = [];
        chatMediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        chatVoiceStartedAt = Date.now();
        chatMediaRecorder.ondataavailable = e => { if (e.data && e.data.size) chatAudioChunks.push(e.data); };
        chatMediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const recorder = chatMediaRecorder;
            chatMediaRecorder = null;
            if (button) { button.textContent = "🎤"; button.classList.remove("recording"); }
            const blob = new Blob(chatAudioChunks, { type: recorder.mimeType || "audio/webm" });
            chatAudioChunks = [];
            if (blob.size > 650 * 1024) { showToast("التسجيل طويل جدًا، خليه أقصر", "!"); return; }
            const reader = new FileReader();
            reader.onload = () => {
                const message = {
                    id: createMessageId(), chatId: currentChatId, adId: currentChatMeta.adId || null,
                    senderId: user.id, senderName: user.name || "مستخدم دوّر",
                    receiverId: String(currentChatMeta.otherUserId), receiverName: currentChatMeta.otherUserName || "مستخدم دوّر",
                    text: "", type: "audio", media: String(reader.result || ""), latitude: null, longitude: null,
                    createdAt: Date.now(), read: false, edited: false, deleted: false, reactions: {},
                    replyTo: chatReplyTarget ? { id: chatReplyTarget.id, senderName: chatReplyTarget.senderName || "مستخدم", text: chatReplyTarget.text || "", type: chatReplyTarget.type || "text" } : null,
                    duration: Math.max(1, Math.round((Date.now() - chatVoiceStartedAt) / 1000))
                };
                clearChatReply();
                appendChatMessage(message);
                showToast("تم إرسال الرسالة الصوتية", "✓");
            };
            reader.readAsDataURL(blob);
        };
        chatMediaRecorder.start();
        if (button) { button.textContent = "⏹️"; button.classList.add("recording"); }
        showToast("جاري التسجيل... اضغط مرة أخرى للإيقاف", "🎤");
    } catch (e) {
        showToast("لم يتم السماح باستخدام الميكروفون", "!");
    }
}

function markConversationAsRead(chatId) {

    const user = getCurrentUser();
    if (!user) return;

    const messages = getMessagesData();
    let changed = false;

    messages.forEach(message => {
        if (
            String(message.chatId) === String(chatId) &&
            String(message.receiverId) === String(user.id) &&
            !message.read
        ) {
            message.read = true;
            changed = true;
        }
    });

    if (changed) saveMessagesData(messages);
    updateMessagesBadge();
}

function deleteCurrentChat(chatId) {

    if (!chatId) return;

    if (!window.confirm("هل تريد حذف هذه المحادثة؟")) return;

    saveMessagesData(
        getMessagesData().filter(m => String(m.chatId) !== String(chatId))
    );

    const meta = getChatMeta();
    delete meta[chatId];
    saveChatMeta(meta);

    const modal = $("chatDynamicModal");
    if (modal) modal.remove();

    currentChatId = null;
    currentChatMeta = null;
    lastChatSignature = "";
    localStorage.removeItem(ACTIVE_CHAT_KEY);
    document.body.style.overflow = "";

    showMessagesPage();
    showToast("تم حذف المحادثة", "🗑");
}

function contactSellerWithMessage(adId) {
    startChatWithSeller(adId);
}


function formatMessageTime(
    timestamp
) {

    if (!timestamp) {
        return "";
    }

    try {

        return new Intl.DateTimeFormat(
            "ar-LY",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(
            new Date(timestamp)
        );

    } catch (error) {

        return "";
    }
}


function formatConversationTime(
    timestamp
) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    const today =
        new Date();

    if (
        date.toDateString() ===
        today.toDateString()
    ) {

        return formatMessageTime(
            timestamp
        );
    }

    return formatDate(
        timestamp
    );
}


/* =========================================================
   SETTINGS / HELP
========================================================= */

function openSettings() {

    const user = getCurrentUser();

    if (!user) {
        openLogin();
        return;
    }

    const modal = $("accountSettingsModal");
    if (!modal) return;

    const name = $("settingsAccountName");
    const phone = $("settingsAccountPhone");
    const avatar = $("settingsAvatar");

    if (name) name.textContent = user.name || "مستخدم دوّر";
    if (phone) phone.textContent = user.phone || "—";
    renderProfileAvatar(avatar, user);

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

function closeAccountSettings() {
    const modal = $("accountSettingsModal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "";
}

function makeUserIdFromPhone(phone) {
    try {
        return "user_" + btoa(phone).replace(/[^a-zA-Z0-9]/g, "");
    } catch (error) {
        return generateId("user");
    }
}

function changePhoneFromSettings() {
    const user = getCurrentUser();
    if (!user) { closeAccountSettings(); openLogin(); return; }

    const newPhone = normalizePhone(window.prompt("اكتب رقم الهاتف الجديد", user.phone || "") || "");

    if (newPhone.length < 9 || newPhone.length > 15) {
        showToast("أدخل رقم هاتف صحيح", "!");
        return;
    }

    if (newPhone === normalizePhone(user.phone || "")) {
        showToast("هذا هو رقمك الحالي", "ℹ️");
        return;
    }

    const confirmed = window.confirm("سيتم ربط حسابك بالرقم الجديد ونقل إعلاناتك ورسائلك المحلية إلى الحساب الجديد. هل تريد المتابعة؟");
    if (!confirmed) return;

    const oldId = String(user.id || "");
    const newId = makeUserIdFromPhone(newPhone);

    const ads = getAds();
    ads.forEach(ad => {
        if (String(ad.sellerId) === oldId) {
            ad.sellerId = newId;
            ad.sellerName = user.name || "مستخدم دوّر";
        }
    });
    saveAds(ads);

    const messages = getMessagesData();
    messages.forEach(message => {
        if (String(message.senderId) === oldId) message.senderId = newId;
        if (String(message.receiverId) === oldId) message.receiverId = newId;
        if (String(message.chatId || "").includes(oldId)) {
            message.chatId = createConversationId(message.senderId, message.receiverId, message.adId);
        }
    });
    saveMessagesData(messages);

    const oldMeta = getChatMeta();
    const newMeta = {};
    Object.values(oldMeta).forEach(meta => {
        if (!meta) return;
        const changed = { ...meta };
        if (String(changed.otherUserId) === oldId) changed.otherUserId = newId;
        const chatId = createConversationId(newId, changed.otherUserId, changed.adId);
        newMeta[chatId] = changed;
    });
    saveChatMeta(newMeta);

    const oldNotificationsKey = getNotificationsStorageKey(oldId);
    const newNotificationsKey = getNotificationsStorageKey(newId);
    try {
        const oldNotifications = localStorage.getItem(oldNotificationsKey);
        if (oldNotifications) localStorage.setItem(newNotificationsKey, oldNotifications);
        if (oldNotificationsKey !== newNotificationsKey) localStorage.removeItem(oldNotificationsKey);
    } catch (e) {}

    user.id = newId;
    user.phone = newPhone;
    user.lastLogin = Date.now();
    saveCurrentUser(user);

    currentChatId = null;
    currentChatMeta = null;
    localStorage.removeItem(ACTIVE_CHAT_KEY);

    updateProfileUI();
    updateMessagesBadge();
    renderMyAds();
    renderAllAds();
    renderSearchPage();
    renderFavorites();

    closeAccountSettings();
    showToast("تم تغيير رقم الهاتف ونقل بيانات حسابك", "✓");
}

function openDeleteAccount() {
    const user = getCurrentUser();
    if (!user) { closeAccountSettings(); openLogin(); return; }
    const modal = $("deleteAccountModal");
    if (!modal) return;
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

function closeDeleteAccount() {
    const modal = $("deleteAccountModal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "";
}

function deleteAccountPermanently() {
    const user = getCurrentUser();
    if (!user) return;

    const userId = String(user.id || "");

    const ads = getAds().filter(ad => String(ad.sellerId || "") !== userId);
    saveAds(ads);

    const messages = getMessagesData().filter(message =>
        String(message.senderId || "") !== userId &&
        String(message.receiverId || "") !== userId
    );
    saveMessagesData(messages);

    const meta = getChatMeta();
    Object.keys(meta).forEach(chatId => {
        const item = meta[chatId];
        if (String(item?.otherUserId || "") === userId || chatId.includes(userId)) {
            delete meta[chatId];
        }
    });
    saveChatMeta(meta);

    localStorage.removeItem(getNotificationsStorageKey(userId));
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(ACTIVE_CHAT_KEY);
    localStorage.removeItem(CHAT_META_KEY);

    currentChatId = null;
    currentChatMeta = null;
    lastChatSignature = "";

    closeDeleteAccount();
    closeAccountSettings();
    removeDynamicMessagingPages();
    updateProfileUI();
    updateMessagesBadge();
    renderMyAds();
    renderAllAds();
    renderSearchPage();
    renderFavorites();
    goHome();

    showToast("تم حذف الحساب وبياناته المحلية", "✓");
}


function openHelp() {

    showToast(
        "للمساعدة تواصل معنا لاحقًا",
        "❓"
    );
}


/* =========================================================
   GENERIC MODAL
========================================================= */

function openModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }

    modal.style.display =
        "block";

    document.body.style.overflow =
        "hidden";
}


function closeModal(id) {

    const modal =
        $(id);

    if (!modal) {
        return;
    }

    modal.style.display =
        "none";

    document.body.style.overflow =
        "";
}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    icon = "✓"
) {

    const toast =
        $("toast");

    const messageElement =
        $("toastMessage");

    const iconElement =
        $("toastIcon");

    if (!toast) {
        return;
    }

    if (messageElement) {

        messageElement.textContent =
            message;
    }

    if (iconElement) {

        iconElement.textContent =
            icon;
    }

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2600
        );
}


/* =========================================================
   MODAL EVENTS
========================================================= */

function setupModalEvents() {

    document
        .querySelectorAll(
            ".modal-overlay"
        )
        .forEach(
            overlay => {

                overlay.addEventListener(
                    "click",
                    function () {

                        const modal =
                            overlay.closest(
                                ".modal"
                            );

                        if (!modal) {
                            return;
                        }

                        modal.style.display =
                            "none";

                        document.body.style.overflow =
                            "";
                    }
                );
            }
        );
}


/* =========================================================
   UPLOAD EVENTS
========================================================= */

function setupUploadEvents() {

    const uploadBox =
        $("uploadBox");

    const adImages =
        $("adImages");

    if (
        uploadBox &&
        adImages
    ) {

        uploadBox.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    adImages
                ) {
                    return;
                }

                adImages.click();
            }
        );

        adImages.addEventListener(
            "change",
            handleAdImages
        );
    }

    const editUploadBox =
        $("editUploadBox");

    const editImages =
        $("editAdImages");

    if (
        editUploadBox &&
        editImages
    ) {

        editUploadBox.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    editImages
                ) {
                    return;
                }

                editImages.click();
            }
        );

        editImages.addEventListener(
            "change",
            handleEditImages
        );
    }
}


/* =========================================================
   KEYBOARD
========================================================= */

function setupKeyboardEvents() {

    document.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            const chat =
                $("chatDynamicModal");

            if (chat) {

                chat.remove();

                currentChatId =
                    null;

                currentChatMeta =
                    null;

                localStorage.removeItem(
                    ACTIVE_CHAT_KEY
                );
            }

            document
                .querySelectorAll(
                    ".modal"
                )
                .forEach(
                    modal => {

                        modal.style.display =
                            "none";
                    }
                );

            document.body.style.overflow =
                "";
        }
    );
}


/* =========================================================
   SAMPLE ADS
========================================================= */

function createSampleAds() {

    const existing =
        getAds();

    if (existing.length > 0) {
        return;
    }

    const now =
        Date.now();

    const samples = [

        {

            id:
                generateId("ad"),

            title:
                "آيفون 15 برو ماكس",

            category:
                "إلكترونيات",

            price:
                5200,

            city:
                "طرابلس",

            description:
                "آيفون بحالة ممتازة، استعمال شخصي.",

            images:
                [],

            image:
                "",

            sellerId:
                "sample_user_1",

            sellerName:
                "بائع دوّر",

            sellerPhone:
                "0910000000",

            status:
                "active",

            sold:
                false,

            featured:
                true,

            views:
                24,

            createdAt:
                now -
                1000 *
                60 *
                30,

            updatedAt:
                now -
                1000 *
                60 *
                30
        },

        {

            id:
                generateId("ad"),

            title:
                "سيارة للبيع بحالة ممتازة",

            category:
                "سيارات",

            price:
                68000,

            city:
                "طرابلس",

            description:
                "سيارة نظيفة وجاهزة للاستعمال.",

            images:
                [],

            image:
                "",

            sellerId:
                "sample_user_2",

            sellerName:
                "معرض سيارات",

            sellerPhone:
                "0920000000",

            status:
                "active",

            sold:
                false,

            featured:
                true,

            views:
                51,

            createdAt:
                now -
                1000 *
                60 *
                60 *
                2,

            updatedAt:
                now -
                1000 *
                60 *
                60 *
                2
        },

        {

            id:
                generateId("ad"),

            title:
                "شقة للبيع",

            category:
                "عقارات",

            price:
                350000,

            city:
                "مصراتة",

            description:
                "شقة مناسبة للعائلة وفي موقع ممتاز.",

            images:
                [],

            image:
                "",

            sellerId:
                "sample_user_3",

            sellerName:
                "معلن دوّر",

            sellerPhone:
                "0930000000",

            status:
                "active",

            sold:
                false,

            featured:
                false,

            views:
                17,

            createdAt:
                now -
                1000 *
                60 *
                60 *
                5,

            updatedAt:
                now -
                1000 *
                60 *
                60 *
                5
        },

        {

            id:
                generateId("ad"),

            title:
                "كنبة منزلية جديدة",

            category:
                "أثاث",

            price:
                1800,

            city:
                "بنغازي",

            description:
                "كنبة نظيفة ومناسبة للصالون.",

            images:
                [],

            image:
                "",

            sellerId:
                "sample_user_4",

            sellerName:
                "متجر أثاث",

            sellerPhone:
                "0940000000",

            status:
                "active",

            sold:
                false,

            featured:
                false,

            views:
                12,

            createdAt:
                now -
                1000 *
                60 *
                60 *
                8,

            updatedAt:
                now -
                1000 *
                60 *
                60 *
                8
        }

    ];

    saveAds(
        samples
    );
}


/* =========================================================
   STORAGE EVENT
   للتحديث بين التبويبات
========================================================= */

window.addEventListener(
    "storage",
    function(event) {

        if (
            event.key ===
            MESSAGES_KEY
        ) {

            updateMessagesBadge();

            if (
                currentChatId &&
                $("chatDynamicModal")
            ) {

                renderChat(
                    currentChatId,
                    false
                );
            }

            if (
                $("messagesDynamicPage")
            ) {

                renderMessagesList();
            }
        }

        if (
            event.key ===
            ADS_KEY
        ) {

            renderAllAds();
            renderFavorites();
            renderSearchPage();
            renderMyAds();
        }

        if (
            event.key &&
            event.key.startsWith(
                NOTIFICATIONS_KEY + "_"
            )
        ) {

            const user =
                getCurrentUser();

            if (user) {

                const expectedKey =
                    getNotificationsStorageKey(
                        user.id
                    );

                if (event.key === expectedKey) {

                    updateNotificationDot();

                    if (
                        $("notificationsModal") &&
                        $("notificationsModal").style.display === "block"
                    ) {
                        renderNotifications();
                    }

                    /*
                       إذا جاء إشعار من تبويب آخر، نظهر تنبيه الجهاز أيضًا.
                    */
                    if (event.newValue) {
                        try {
                            const incoming =
                                JSON.parse(event.newValue);

                            if (
                                Array.isArray(incoming) &&
                                incoming.length &&
                                incoming[0] &&
                                incoming[0].read === false
                            ) {
                                showDeviceNotification(
                                    incoming[0].title || "إشعار جديد",
                                    incoming[0].message || "لديك إشعار جديد في دوّر.",
                                    incoming[0].icon || "🔔"
                                );
                            }
                        } catch (_) {}
                    }
                }
            }
        }
    }
);


/* =========================================================
   AUTO REFRESH CHAT
   بدون إعادة رسم إذا لم تتغير الرسائل
========================================================= */

setInterval(
    function() {

        updateMessagesBadge();

        if (
            currentChatId &&
            $("chatDynamicModal")
        ) {

            renderChat(
                currentChatId,
                false
            );
        }

    },
    1500
);


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function() {

        selectedAdImages.forEach(
            item => {

                if (
                    item &&
                    item.previewUrl &&
                    item.previewUrl.startsWith(
                        "blob:"
                    )
                ) {

                    URL.revokeObjectURL(
                        item.previewUrl
                    );
                }
            }
        );

        editAdImages.forEach(
            item => {

                if (
                    item &&
                    item.previewUrl &&
                    item.previewUrl.startsWith(
                        "blob:"
                    )
                ) {

                    URL.revokeObjectURL(
                        item.previewUrl
                    );
                }
            }
        );
    }
);


/* =========================================================
   INITIALIZE APP
========================================================= */

async function initializeApp() {

    initializeFirebase();
    if (firebaseReady) {
        await hydrateCloudData();
    }

    createSampleAds();

    ensureMessagingStyles();

    const location =
        getLocation();

    if ($("currentLocation")) {

        $("currentLocation")
            .textContent =
            location;
    }

    updateProfileUI();

    updateNotificationDot();

    if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
    ) {
        console.log("إشعارات الجهاز مفعّلة");
    }

    ensureMessagesBadge();

    updateMessagesBadge();

    setupModalEvents();

    setupUploadEvents();

    setupCarFeatures();
    setupElectronicsFeatures();
    ensureCarFields("add");
    ensureElectronicsFields("add");

    setupKeyboardEvents();

    renderAllAds();

    renderFavorites();

    renderSearchPage();

    renderMyAds();

    showPage(
        "homePage"
    );
}


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.openNotifications =
    openNotifications;

window.requestDeviceNotifications =
    requestDeviceNotifications;

window.closeNotifications =
    closeNotifications;

window.loginUser =
    loginUser;

window.togglePasswordVisibility =
    togglePasswordVisibility;

window.verifyPhoneCode =
    verifyPhoneCode;

window.resendPhoneCode =
    resendPhoneCode;

window.openLogin =
    openLogin;

window.closeLogin =
    closeLogin;

window.openFilters =
    openFilters;

window.closeFilters =
    closeFilters;

window.openLocation =
    openLocation;

window.closeLocation =
    closeLocation;

window.setLocation =
    setLocation;

window.selectCategory =
    selectCategory;

window.filterByCategory =
    filterByCategory;

window.filterProducts =
    filterProducts;

window.showAllCategories =
    showAllCategories;

window.showAllAds =
    showAllAds;

window.searchItems =
    searchItems;

window.pageSearch =
    pageSearch;

window.clearSearch =
    clearSearch;

window.openAddAd =
    openAddAd;

window.refreshCategorySpecificFields =
    refreshCategorySpecificFields;

window.closeAddAd =
    closeAddAd;

window.publishAd =
    publishAd;

window.openSearchPage =
    openSearchPage;

window.openFavoritesPage =
    openFavoritesPage;

window.openProfilePage =
    openProfilePage;

window.openMyAds =
    openMyAds;

window.openMessages =
    openMessages;

window.openSettings =
    openSettings;

window.openHelp =
    openHelp;

window.openAdminPanel = openAdminPanel;
window.openAdminLogin = openAdminLogin;
window.closeAdminLogin = closeAdminLogin;
window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.renderAdminDashboard = renderAdminDashboard;
window.renderAdminAds = renderAdminAds;
window.renderAdminReports = renderAdminReports;
window.renderAdminUsers = renderAdminUsers;
window.adminSetAdStatus = adminSetAdStatus;
window.adminDeleteAd = adminDeleteAd;
window.adminOpenAd = adminOpenAd;
window.adminReviewReport = adminReviewReport;
window.adminToggleUser = adminToggleUser;
window.adminRefresh = adminRefresh;

window.openLogin =
    openLogin;

window.closeLogin =
    closeLogin;

window.loginUser =
    loginUser;

window.logoutUser =
    logoutUser;

window.toggleFavorite =
    toggleFavorite;

window.openAdDetails =
    openAdDetails;

window.closeAdDetails =
    closeAdDetails;

window.validateAdSecurity =
    validateAdSecurity;

window.findDuplicateAd =
    findDuplicateAd;

window.getAdSecurityStatus =
    getAdSecurityStatus;

window.contactSeller =
    contactSeller;

window.callSeller =
    callSeller;

window.contactSellerWithMessage =
    contactSellerWithMessage;

window.startChatWithSeller =
    startChatWithSeller;

window.openChat =
    openChat;

window.sendChatMessage =
    sendChatMessage;

window.deleteCurrentChat =
    deleteCurrentChat;

window.updateMessagesBadge =
    updateMessagesBadge;

window.openEditAd =
    openEditAd;

window.closeEditAd =
    closeEditAd;

window.saveEditedAd =
    saveEditedAd;

window.deleteAd =
    deleteAd;

window.toggleSold =
    toggleSold;

window.removeSelectedImage =
    removeSelectedImage;

window.removeEditImage =
    removeEditImage;

window.applyFilter =
    applyFilter;

window.openFilters =
    openFilters;

window.applyCarFilters =
    applyCarFilters;

window.applyElectronicsFilters =
    applyElectronicsFilters;

window.clearElectronicsFilters =
    clearElectronicsFilters;

window.toggleElectronicsDetails =
    toggleElectronicsDetails;

window.clearCarFilters =
    clearCarFilters;

window.applyCategoryFilter =
    applyCategoryFilter;

window.goHome =
    goHome;

window.goSearch =
    goSearch;

window.goFavorites =
    goFavorites;

window.goProfile =
    goProfile;

window.changeUserName =
    changeUserName;

window.openProfileEditor =
    openProfileEditor;

window.closeProfileEditor =
    closeProfileEditor;

window.previewProfilePhoto =
    previewProfilePhoto;

window.removeProfilePhoto =
    removeProfilePhoto;

window.saveProfileEditor =
    saveProfileEditor;

window.openPasswordChange =
    openPasswordChange;

window.closePasswordChange =
    closePasswordChange;

window.changeAccountPassword =
    changeAccountPassword;

window.showToast =
    showToast;

window.pickAdLocation =
    pickAdLocation;

window.adMapHTML =
    adMapHTML;

window.openReportAd =
    openReportAd;

window.closeReportAd =
    closeReportAd;

window.submitAdReport =
    submitAdReport;


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();
}
