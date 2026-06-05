declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module "./firebase" {
  import { Firestore } from "firebase/firestore";
  export const db: Firestore;
}
