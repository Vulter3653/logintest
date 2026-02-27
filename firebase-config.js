// Firebase SDK 초기화 및 구성
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 사용자 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCLbLTGH1U_uArBdVqKXdu_A4miz_B5dAQ",
  authDomain: "logintest-63dc6.firebaseapp.com",
  projectId: "logintest-63dc6",
  storageBucket: "logintest-63dc6.firebasestorage.app",
  messagingSenderId: "305024585039",
  appId: "1:305024585039:web:a95fcdf831b1077a46893a",
  measurementId: "G-0P41FYSXSB"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase가 성공적으로 연결되었습니다.");

export { app, analytics, auth, db };
