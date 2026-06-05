import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBOmMVLWUq0LkdO1zPm2Ox2--uhNwCFldo",
    authDomain: "ai-bdfs.firebaseapp.com",
    projectId: "ai-bdfs",
    storageBucket: "ai-bdfs.firebasestorage.app",
    messagingSenderId: "1041372839037",
    appId: "1:1041372839037:web:21ab3b150160fcd00a0514",
    measurementId: "G-2W1DDZZCNL"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
