// app/routes/external/products.jsx
import { json, redirect } from "@remix-run/node";
import { getExternalSession } from "../shopify.server";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Text,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const session = await getExternalSession(request);
  const shop = session.get("shop");
  const token = session.get("token");
  
  if (!shop || !token) {
    return redirect("/app/login");
  }

  try {
    const res = await fetch(
      `https://${shop}/admin/api/2024-07/products.json?limit=10`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      return json({ error: "Failed to fetch products." }, { status: 500 });
    }

    const data = await res.json();
    return json({ products: data.products });
  } catch (err) {
    return json({ error: "Error connecting to external store." }, { status: 500 });
  }
};

export default function ExternalProducts() {
  const { products, error } = useLoaderData();

  if (error) return <Text color="critical">{error}</Text>;

  const rows = products.map((product) => [
    product.title || "—",
    product.vendor || "—",
    product.status || "—",
    new Date(product.created_at).toLocaleDateString(),
  ]);

  return (
    <Page title="External Store Products">
      <Layout>
        <Layout.Section>
          <Card title="Products from External Store" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={["Title", "Vendor", "Status", "Created"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
