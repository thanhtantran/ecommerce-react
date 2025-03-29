import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider, GithubAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updatePassword } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, limit, startAfter } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import firebaseConfig from "./config";

class Firebase {
  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
  }

  // AUTH ACTIONS
  createAccount = (email, password) => createUserWithEmailAndPassword(this.auth, email, password);
  signIn = (email, password) => signInWithEmailAndPassword(this.auth, email, password);
  signInWithGoogle = () => signInWithPopup(this.auth, new GoogleAuthProvider());
  signInWithFacebook = () => signInWithPopup(this.auth, new FacebookAuthProvider());
  signInWithGithub = () => signInWithPopup(this.auth, new GithubAuthProvider());
  signOut = () => this.auth.signOut();
  passwordReset = (email) => sendPasswordResetEmail(this.auth, email);
  passwordUpdate = (password) => updatePassword(this.auth.currentUser, password);

  // USER ACTIONS
  addUser = (id, user) => setDoc(doc(this.db, "users", id), user);
  getUser = (id) => getDoc(doc(this.db, "users", id));
  updateProfile = (id, updates) => updateDoc(doc(this.db, "users", id), updates);
  onAuthStateChanged = (callback) => this.auth.onAuthStateChanged(callback);
  saveBasketItems = (items, userId) => updateDoc(doc(this.db, "baskets", userId), { basket: items });

  // PRODUCT ACTIONS
  getSingleProduct = (id) => getDoc(doc(this.db, "products", id));

  getProducts = async (lastRefKey) => {
    let productsRef = collection(this.db, "products");
    let q = query(productsRef, orderBy("id"), limit(12));

    if (lastRefKey) {
      q = query(productsRef, orderBy("id"), startAfter(lastRefKey), limit(12));
    }

    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const lastKey = querySnapshot.docs[querySnapshot.docs.length - 1];

    return { products, lastKey };
  };

  searchProducts = async (searchKey) => {
    let productsRef = collection(this.db, "products");
    let q = query(productsRef, where("name_lower", ">=", searchKey), where("name_lower", "<=", `${searchKey}\uf8ff`), limit(12));

    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return { products };
  };

  addProduct = (id, product) => setDoc(doc(this.db, "products", id), product);
  editProduct = (id, updates) => updateDoc(doc(this.db, "products", id), updates);
  removeProduct = (id) => deleteDoc(doc(this.db, "products", id));
  generateKey = () => doc(collection(this.db, "products")).id;

  storeImage = async (id, folder, imageFile) => {
    const storageRef = ref(this.storage, `${folder}/${id}`);
    await uploadBytes(storageRef, imageFile);
    return getDownloadURL(storageRef);
  };

  deleteImage = (id) => {
    const storageRef = ref(this.storage, `products/${id}`);
    return deleteObject(storageRef);
  };
}

const firebaseInstance = new Firebase();
export default firebaseInstance;
