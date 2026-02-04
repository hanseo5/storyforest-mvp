import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyBqutsdkKsPR6p28Lf3beVPhcv6Dhyk9xM",
    authDomain: "storyforest-mvp-hsl02.firebaseapp.com",
    projectId: "storyforest-mvp-hsl02",
    storageBucket: "storyforest-mvp-hsl02.firebasestorage.app",
    messagingSenderId: "580984401842",
    appId: "1:580984401842:web:56d9d59008cb2e1b6e3eab"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1'); // Region matching default
