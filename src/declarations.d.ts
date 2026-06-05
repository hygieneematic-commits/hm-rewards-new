declare module "./firebase" {
  import { Firestore } from "firebase/firestore";
  const db: Firestore;
  export { db };
}
