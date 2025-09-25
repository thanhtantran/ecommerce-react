// Local storage backed service that mirrors the Firebase API used by the app

const LS_KEYS = {
  users: 'localdb_users',
  products: 'localdb_products',
  baskets: 'localdb_baskets',
  auth: 'localdb_auth'
};

const PAGE_SIZE = 12;

function readFromLocalStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeToLocalStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeedData() {
  const existingProducts = readFromLocalStorage(LS_KEYS.products, null);
  if (!existingProducts) {
    const seed = Array.from({ length: 24 }).map((_, i) => {
      const id = `p-${i + 1}`;
      const idx = ((i % 9) + 1);
      return {
        id,
        name: `Sample Product ${i + 1}`,
        name_lower: `sample product ${i + 1}`,
        brand: 'Sample Brand',
        price: 10 + i,
        maxQuantity: 10,
        description: 'Local demo product',
        isFeatured: i % 5 === 0,
        quantity: 50,
        image: `/static/salt-image-${idx}.png`,
        imageCollection: [],
        dateAdded: Date.now() - i * 1000 * 60 * 60
      };
    });
    writeToLocalStorage(LS_KEYS.products, seed);
  }
  const existingUsers = readFromLocalStorage(LS_KEYS.users, null);
  if (!existingUsers) {
    writeToLocalStorage(LS_KEYS.users, {});
  }
  const existingBaskets = readFromLocalStorage(LS_KEYS.baskets, null);
  if (!existingBaskets) {
    writeToLocalStorage(LS_KEYS.baskets, {});
  }
}

ensureSeedData();

function generateId() {
  return (`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
}

class LocalAuth {
  constructor() {
    this.currentUser = readFromLocalStorage(LS_KEYS.auth, null);
    this.listeners = new Set();
    // Defer initial callback to emulate async auth init
    setTimeout(() => {
      this._emit();
    }, 0);
  }

  onAuthStateChanged(callback) {
    this.listeners.add(callback);
    // Immediately notify with current state
    callback(this.currentUser);
    return () => this.listeners.delete(callback);
  }

  _emit() {
    for (const cb of this.listeners) cb(this.currentUser);
  }

  signOut() {
    this.currentUser = null;
    writeToLocalStorage(LS_KEYS.auth, null);
    this._emit();
  }
}

class LocalService {
  constructor() {
    this.auth = new LocalAuth();
  }

  // AUTH ACTIONS
  async createAccount(email, password) {
    const users = readFromLocalStorage(LS_KEYS.users, {});
    const existing = Object.values(users).find((u) => u.email === email);
    if (existing) throw new Error('Email already in use');
    const uid = generateId();
    users[uid] = { uid, email, password };
    writeToLocalStorage(LS_KEYS.users, users);
    const user = { uid, email, providerData: [{ providerId: 'password' }], metadata: { creationTime: Date.now() } };
    this.auth.currentUser = user;
    writeToLocalStorage(LS_KEYS.auth, user);
    this.auth._emit();
    return { user };
  }

  async signIn(email, password) {
    const users = readFromLocalStorage(LS_KEYS.users, {});
    const userRec = Object.values(users).find((u) => u.email === email && u.password === password);
    if (!userRec) throw new Error('Invalid email or password');
    const user = { uid: userRec.uid, email: userRec.email, providerData: [{ providerId: 'password' }], metadata: { creationTime: Date.now() } };
    this.auth.currentUser = user;
    writeToLocalStorage(LS_KEYS.auth, user);
    this.auth._emit();
  }

  // Social logins become simple demo sign-ins
  async signInWithGoogle() { return this._socialSignin('google.com'); }
  async signInWithFacebook() { return this._socialSignin('facebook.com'); }
  async signInWithGithub() { return this._socialSignin('github.com'); }

  async _socialSignin(providerId) {
    const uid = `social-${providerId}`;
    const users = readFromLocalStorage(LS_KEYS.users, {});
    if (!users[uid]) {
      users[uid] = { uid, email: `${providerId}@local.test`, password: null };
      writeToLocalStorage(LS_KEYS.users, users);
    }
    const user = { uid, email: users[uid].email, displayName: 'Local User', photoURL: '', providerData: [{ providerId }], metadata: { creationTime: Date.now() } };
    this.auth.currentUser = user;
    writeToLocalStorage(LS_KEYS.auth, user);
    this.auth._emit();
    return { user };
  }

  async signOut() { this.auth.signOut(); }
  async passwordReset() { /* no-op locally */ }
  async passwordUpdate() { /* no-op locally */ }
  async setAuthPersistence() { /* no-op locally */ }

  // USER ACTIONS
  async addUser(id, user) {
    const baskets = readFromLocalStorage(LS_KEYS.baskets, {});
    const users = readFromLocalStorage(LS_KEYS.users, {});
    users[id] = { ...(users[id] || {}), uid: id, email: user.email, password: users[id]?.password || null };
    writeToLocalStorage(LS_KEYS.users, users);
    baskets[id] = { basket: user.basket || [] };
    writeToLocalStorage(LS_KEYS.baskets, baskets);
  }

  async getUser(id) {
    const users = readFromLocalStorage(LS_KEYS.users, {});
    const baskets = readFromLocalStorage(LS_KEYS.baskets, {});
    const profile = readFromLocalStorage(`profile_${id}`, null);
    const data = profile || {
      fullname: 'User',
      avatar: '/static/profile.jpg',
      banner: '/static/profile.jpg',
      email: users[id]?.email || '',
      address: '',
      basket: baskets[id]?.basket || [],
      mobile: { data: {} },
      role: 'USER',
      dateJoined: Date.now()
    };
    return { data: () => data };
  }

  async updateProfile(id, updates) {
    const key = `profile_${id}`;
    const existing = readFromLocalStorage(key, {});
    writeToLocalStorage(key, { ...existing, ...updates });
  }

  onAuthStateChanged(callback) { return this.auth.onAuthStateChanged(callback); }

  async saveBasketItems(items, userId) {
    const baskets = readFromLocalStorage(LS_KEYS.baskets, {});
    baskets[userId] = { basket: items };
    writeToLocalStorage(LS_KEYS.baskets, baskets);
  }

  // PRODUCT ACTIONS
  async getSingleProduct(id) {
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const product = products.find((p) => p.id === id) || null;
    return {
      exists: !!product,
      data: () => product,
      ref: { id }
    };
  }

  async getProducts(lastRefKey) {
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const sorted = [...products].sort((a, b) => (a.id > b.id ? 1 : -1));
    const start = Number.isInteger(lastRefKey) ? lastRefKey : 0;
    const page = sorted.slice(start, start + PAGE_SIZE);
    const lastKey = (start + PAGE_SIZE) < sorted.length ? (start + PAGE_SIZE) : null;
    return { products: page, lastKey, total: sorted.length };
  }

  async searchProducts(searchKey) {
    const key = (searchKey || '').toLowerCase();
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const matched = products.filter((p) => (p.name_lower || p.name?.toLowerCase() || '').includes(key)).slice(0, PAGE_SIZE);
    return { products: matched, lastKey: null, total: matched.length };
  }

  async getFeaturedProducts(itemsCount = PAGE_SIZE) {
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const items = products.filter((p) => p.isFeatured).slice(0, itemsCount);
    return {
      empty: items.length === 0,
      forEach: (cb) => items.forEach((p) => cb({ data: () => p, ref: { id: p.id } }))
    };
  }

  async getRecommendedProducts(itemsCount = PAGE_SIZE) {
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const sorted = [...products].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
    const items = sorted.slice(0, itemsCount);
    return {
      empty: items.length === 0,
      forEach: (cb) => items.forEach((p) => cb({ data: () => p, ref: { id: p.id } }))
    };
  }

  async addProduct(id, product) {
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const next = [...products, { ...product, id }];
    writeToLocalStorage(LS_KEYS.products, next);
  }

  async editProduct(id, updates) {
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const next = products.map((p) => (p.id === id ? { ...p, ...updates } : p));
    writeToLocalStorage(LS_KEYS.products, next);
  }

  async removeProduct(id) {
    const products = readFromLocalStorage(LS_KEYS.products, []);
    const next = products.filter((p) => p.id !== id);
    writeToLocalStorage(LS_KEYS.products, next);
  }

  generateKey() { return generateId(); }

  async storeImage(id, folder, imageFile) {
    // Convert file/blob to base64 data URL and store inline
    if (!imageFile) return '';
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
    return dataUrl;
  }

  async deleteImage() { /* no-op for local */ }
}

const localInstance = new LocalService();
export default localInstance;
