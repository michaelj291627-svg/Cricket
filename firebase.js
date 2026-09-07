import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALEQvahvUUg0g99MNMVBguP7eQrKhMhvg",
  authDomain: "cricket-33fb3.firebaseapp.com",
  projectId: "cricket-33fb3",
  storageBucket: "cricket-33fb3.firebasestorage.app",
  messagingSenderId: "548674659187",
  appId: "1:548674659187:web:b47fd1d33fe15d8be95b06"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.db = db;
window.fb = {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
};
