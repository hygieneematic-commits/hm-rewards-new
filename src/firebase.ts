import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBuXSY2IbqxHec6VySX_MkSo08GpsOp97g",
  authDomain: "hm-rewards.firebaseapp.com",
  projectId: "hm-rewards",
  storageBucket: "hm-rewards.firebasestorage.app",
  messagingSenderId: "153855126051",
  appId: "1:153855126051:web:466b7cb58fe22603eadf96",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
