// HTTP client backed service that mirrors the previous Firebase API

class LocalAuth {
  constructor() {
    this.currentUser = null;
    this.listeners = new Set();
    const self = this;
    this.auth = {
      get currentUser() { return self.currentUser; },
      onAuthStateChanged(callback) { return self.onAuthStateChanged(callback); }
    };
  }

  // AUTH ACTIONS
  async createAccount(email, password) {
    const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error((await res.json()).message || 'Sign up failed');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    this.currentUser = data.user;
    this._emit();
    return { user: data.user };
  }

  async signIn(email, password) {
    const res = await fetch('/api/auth/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error((await res.json()).message || 'Sign in failed');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    this.currentUser = data.user;
    this._emit();
  }

  // Social logins become simple demo sign-ins
  async signInWithGoogle() { return this._socialSignin('google.com'); }
  async signInWithFacebook() { return this._socialSignin('facebook.com'); }
  async signInWithGithub() { return this._socialSignin('github.com'); }

  async _socialSignin() {
    throw new Error('Social sign-in not available in local backend');
  }

  async signOut() { this.currentUser = null; localStorage.removeItem('token'); this._emit(); }
  async passwordReset() { /* no-op locally */ }
  async passwordUpdate() { /* no-op locally */ }
  async setAuthPersistence() { /* no-op locally */ }

  onAuthStateChanged(callback) { this.listeners.add(callback); callback(this.currentUser); return () => this.listeners.delete(callback); }
  _emit() { for (const cb of this.listeners) cb(this.currentUser); }

  // USER ACTIONS
  async addUser() { /* handled server-side during signup */ }

  async getUser(id) {
    const res = await fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
    if (!res.ok) throw new Error('Failed to load user');
    const data = await res.json();
    return { data: () => data.profile };
  }

  async updateProfile(id, updates) {
    const res = await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify(updates) });
    if (!res.ok) throw new Error('Failed to update profile');
  }

  async saveBasketItems(items, userId) {
    const res = await fetch(`/api/users/${userId}/basket`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify({ basket: items }) });
    if (!res.ok) throw new Error('Failed to save basket');
  }

  // PRODUCT ACTIONS
  async getSingleProduct(id) {
    const res = await fetch(`/api/products/${id}`);
    if (res.status === 404) return { exists: false, data: () => null, ref: { id } };
    if (!res.ok) throw new Error('Failed to load product');
    const data = await res.json();
    const product = data.product;
    return { exists: !!product, data: () => product, ref: { id } };
  }

  async getProducts(lastRefKey) {
    const offset = Number.isInteger(lastRefKey) ? lastRefKey : 0;
    const res = await fetch(`/api/products?offset=${offset}&limit=12`);
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
  }

  async searchProducts(searchKey) {
    const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchKey || '')}&limit=12`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  }

  async getFeaturedProducts(itemsCount = 12) {
    const res = await fetch(`/api/products/featured?limit=${itemsCount}`);
    if (!res.ok) throw new Error('Failed to load featured products');
    const data = await res.json();
    const items = data.products || [];
    return { empty: items.length === 0, forEach: (cb) => items.forEach((p) => cb({ data: () => p, ref: { id: p.id } })) };
  }

  async getRecommendedProducts(itemsCount = 12) {
    const res = await fetch(`/api/products/recommended?limit=${itemsCount}`);
    if (!res.ok) throw new Error('Failed to load recommended products');
    const data = await res.json();
    const items = data.products || [];
    return { empty: items.length === 0, forEach: (cb) => items.forEach((p) => cb({ data: () => p, ref: { id: p.id } })) };
  }

  async addProduct(id, product) {
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify(product) });
    if (!res.ok) throw new Error('Failed to add product');
  }

  async editProduct(id, updates) {
    const res = await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify(updates) });
    if (!res.ok) throw new Error('Failed to edit product');
  }

  async removeProduct(id) {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
    if (!res.ok) throw new Error('Failed to remove product');
  }

  generateKey() { return `${Date.now()}`; }

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

const httpService = new LocalAuth();
export default httpService;
