import { db } from "../firebase.server";
import { v4 as uuidv4 } from "uuid";

export async function saveShopCredentials(shop, accessToken) {
  const docRef = db.collection("shopify_stores").doc(shop);
  const doc = await docRef.get();

  let id = uuidv4();
  if (doc.exists) {
    id = doc.data()?.id || id;
  }

  await docRef.set({
    id,
    shop,
    accessToken,
    updatedAt: new Date().toISOString(),
  });

  return id;
}

export async function getCurrentShopId(shop) {
  const doc = await db.collection("shopify_stores").doc(shop).get();
  return doc.exists ? doc.data()?.id : null;
}

export async function getShopCredentialsById(id) {
  const snapshot = await db
    .collection("shopify_stores")
    .where("id", "==", id)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}
