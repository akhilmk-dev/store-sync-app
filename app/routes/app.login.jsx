import { Form, useActionData } from "@remix-run/react";
import {
  getExternalSession,
  commitExternalSession,
} from "../shopify.server";
import { redirect, json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { useState } from "react";
import { authQuery } from "../querys/loginPageQuery";

// --- Action: Connect and validate external store using GraphQL ---
export const action = async ({ request }) => {
  const formData = await request.formData();
  const shop = formData.get("shop");
  const token = formData.get("token");

  if (!shop || !token) {
    return json({ error: "Shop and token are required." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: authQuery }),
    });

    const result = await response.json();

    if (result.errors || !result.data?.shop) {
      console.error("Shopify validation failed:", result.errors || result);
      return json({ error: "Invalid shop or token." }, { status: 401 });
    }

    const session = await getExternalSession(request);
    session.set("shop", shop);
    session.set("token", token);
    const cookie = await commitExternalSession(session);

    return redirect("/app/customers", {
      headers: {
        "Set-Cookie": cookie,
      },
    });
  } catch (err) {
    return json({ status: 500,message: "Failed to connect to the store.", error: err });
  }
};

// --- Component: External Store Connect Page ---
export default function ExternalConnect() {
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const [token, setToken] = useState("");
  
  return (
    <Page title="Connect External Store">
      <Layout>
        <Layout.Section>
          <Card title="Enter Store Credentials" sectioned>
            <Form method="post">
              <BlockStack gap="400">
                <TextField
                  label="Shop Domain (e.g. mystore.myshopify.com)"
                  value={shop}
                  onChange={setShop}
                  name="shop"
                  autoComplete="off"
                />
                <TextField
                  label="Admin API Access Token"
                  value={token}
                  onChange={setToken}
                  name="token"
                  type="password"
                  autoComplete="off"
                />
                <Button submit primary>
                  Connect 
                </Button>
                {actionData?.error && (
                  <Text color="critical">{actionData.error}</Text>
                )}
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
