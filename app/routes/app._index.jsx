import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Frame,
  Toast,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { json, useFetcher, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const { saveShopCredentials, getCurrentShopId } = await import("../utils/firebaseShopStorage.server");
  let id = await getCurrentShopId(session.shop);

  if (!id) {
    try {
      await saveShopCredentials(session.shop, session.accessToken);
      id = await getCurrentShopId(session.shop);
    } catch (e) {
      console.error("Error saving shop credentials in loader:", e);
    }
  }

  return json({ id });
}

export async function action({ request }) {
  const { authenticate } = await import("../shopify.server");
  const { getShopCredentialsById } = await import("../utils/firebaseShopStorage.server");
  const { syncCustomersBetweenShops } = await import("../utils/customerSync.server");

  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const targetShopId = formData.get("targetShopId");

  const { session } = await authenticate.admin(request);
  const currentShop = session.shop;
  const currentAccessToken = session.accessToken;

  if (actionType === "import" && targetShopId) {
    const target = await getShopCredentialsById(targetShopId);
    if (!target) return { error: "Invalid shop ID" };

    const result = await syncCustomersBetweenShops(
      target.shop,
      target.accessToken,
      currentShop,
      currentAccessToken
    );

    return result;
  }

  return { error: "No action taken" };
}

export default function Index({ data }) {
  const fetcher = useFetcher();
  const [inputId, setInputId] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [importToast, setImportToast] = useState({ show: false, content: "", error: false });
  const { id } = useLoaderData();
  const uniqueId = id;

  // Show import result toast
  useEffect(() => {
    if (fetcher.data && (fetcher.data.success || fetcher.data.error)) {
      setImportToast({
        show: true,
        content: fetcher.data.success ? "Customers imported successfully!" : fetcher.data.error,
        error: Boolean(fetcher.data.error),
      });
    }
  }, [fetcher.data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(uniqueId);
    setShowToast(true);
  };

  const toastMarkup = showToast ? (
    <Toast content="Copied ID" onDismiss={() => setShowToast(false)} />
  ) : null;

  const importToastMarkup = importToast.show ? (
    <Toast
      content={importToast.content}
      onDismiss={() => setImportToast({ ...importToast, show: false })}
      error={importToast.error}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      {importToastMarkup}
      <Page title="Customer Sync Tool">
        <TitleBar title="Sync Customers" />
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="600">
                <Text variant="heading2xl" as="h1">
                  Welcome to the Customer Sync Tool
                </Text>
                <Text color="subdued">
                  Seamlessly sync your customer data between Shopify stores. Use your unique Shop ID to import customers from another store you own.
                </Text>
                <Card sectioned subdued>
                  <BlockStack gap="300">
                    <Text variant="headingMd">Your Shop Unique ID</Text>
                    <InlineStack gap="200" align="center">
                      <TextField
                        label="Unique ID"
                        value={uniqueId || "Not available"}
                        disabled
                        labelHidden
                        helpText="Share this ID with your other store to import customers."
                        style={{ minWidth: 250 }}
                      />
                      <Button onClick={handleCopy} primary>
                        Copy ID
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
                <Card sectioned subdued>
                  <BlockStack gap="300">
                    <Text variant="headingMd">Import Customers from Another Store</Text>
                    <Text color="subdued" as="span">
                      Enter the Unique ID of your other store to import its customers into this store.
                    </Text>
                    <InlineStack gap="200" align="center">
                      <TextField
                        label="Enter Store Unique ID"
                        value={inputId}
                        onChange={setInputId}
                        autoComplete="off"
                        placeholder="Paste the Unique ID here"
                        labelHidden
                        style={{ minWidth: 250 }}
                      />
                      <fetcher.Form method="post">
                        <input type="hidden" name="targetShopId" value={inputId} />
                        <input type="hidden" name="actionType" value="import" />
                        <Button submit primary disabled={!inputId}>
                          Import Customers
                        </Button>
                      </fetcher.Form>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
