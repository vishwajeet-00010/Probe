"use client";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

/** Public web configuration (safe to ship). Security comes from firestore.rules. */
export function firebaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

function app(): FirebaseApp {
  if (!firebaseConfigured())
    throw new Error(
      "Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local.",
    );
  return (
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    })
  );
}

let db: Firestore | null = null;
export const clientAuth = () => getAuth(app());
export function clientDb() {
  if (db) return db;
  try {
    db = initializeFirestore(app(), { ignoreUndefinedProperties: true });
  } catch {
    db = getFirestore(app());
  }
  return db;
}
