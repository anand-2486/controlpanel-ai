import { initializeApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
} from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyC2fX5uJ-ACKBk8rKdVseW48W4Cr7Vi8SY",
  authDomain: "controlpanel-44efc.firebaseapp.com",
  projectId: "controlpanel-44efc",
  storageBucket: "controlpanel-44efc.firebasestorage.app",
  messagingSenderId: "146469707830",
  appId: "1:146469707830:web:514b70a9baf2989f3ab897",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

export const googleProvider =
  new GoogleAuthProvider()

googleProvider.setCustomParameters({
  prompt: "select_account",
})

export default app