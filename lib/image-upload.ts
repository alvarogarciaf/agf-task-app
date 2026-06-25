import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/config";
import { auth } from "@/lib/firebase/config";
import { v4 as uuidv4 } from "uuid";

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  await auth.authStateReady();
  
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Must be logged in to upload images");
  }

  const extension = file.name.split(".").pop() || "png";
  const filename = `${uuidv4()}.${extension}`;
  const path = `users/${user.uid}/images/${filename}`;
  const storageRef = ref(storage, path);

  const snapshot = await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return downloadUrl;
}
