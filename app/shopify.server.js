// app/shopify.server.ts

import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server"; // Your existing Prisma client instance

import { saveShopCredentials } from "./utils/firebaseShopStorage.server"; // <-- helper for Firestore

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  // Change distribution to allow installation on any store
  distribution: AppDistribution.Custom,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  
  //Hook to store shop + accessToken in Firestore
  hooks: {
    async afterAuth({ session }) {
      console.log("afterAuth hook called for shop:", session.shop);
      try {
        await saveShopCredentials(session.shop, session.accessToken);
        console.log("Shop credentials saved for:", session.shop);
      } catch (e) {
        console.error("Error saving shop credentials for", session.shop, e);
      }
    },
  },
});

// Re-export everything you need elsewhere in the app
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

export default shopify;
