import { json, redirect } from "@remix-run/node";
import { getExternalSession, authenticate } from "../shopify.server";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  IndexTable,
  useIndexResourceState,
  TextField,
  Filters,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { customerQuery } from "../querys/CustomerQuerys";

// --- Loader: Fetch customers from external store using GraphQL ---
export const loader = async ({ request }) => {
  const session = await getExternalSession(request);
  const shop = session.get("shop");
  const token = session.get("token");

  if (!shop || !token) return redirect("/app/login");

  try {
    const res = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: customerQuery }),
    });

    const result = await res.json();

    if (result.errors) {
      console.error("GraphQL error:", result.errors);
      return json({ error: "Failed to fetch customers." }, { status: 500 });
    }

    const customers = result.data.customers.edges.map(({ node }) => ({
      id: node.id,
      first_name: node.firstName,
      last_name: node.lastName,
      email: node.email,
      phone: node.phone,
      created_at: node.createdAt,
      addresses: node.addresses,
    }));

    return json({ customers });
  } catch (err) {
    console.error("Connection error:", err);
    return json(
      { error: "Error connecting to external store." },
      { status: 500 }
    );
  }
};

// --- Action: Import customers to current store using GraphQL --- //

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const token = session.accessToken;

  if (!shop || !token) return redirect("/app/login");

  const formData = await request.formData();
  const customersJson = formData.get("customers");

  let customers;
  try {
    customers = JSON.parse(customersJson);
  } catch {
    return json({ error: "Invalid customer data." }, { status: 400 });
  }

  const mutationBody = customers
    .map((_, i) => `
      c${i}: customerCreate(input: $input${i}) {
        customer { id email }
        userErrors { field message }
      }
    `)
    .join("\n");

  const mutation = `
    mutation(${customers.map((_, i) => `$input${i}: CustomerInput!`).join(", ")}) {
      ${mutationBody}
    }
  `;

  const variables = {};
  customers.forEach((c, i) => {
    variables[`input${i}`] = {
      firstName: c.first_name || "",
      lastName: c.last_name || "",
      email: c.email || "",
      phone: c.phone || "",
      addresses: (c.addresses || []).map((a) => ({
        address1: a.address1 || "",
        city: a.city || "",
        country: a.country || "United States",
        zip: a.zip || "",
      })),
    };
  });

  try {
    const response = await fetch(
      `https://${shop}/admin/api/2024-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: mutation, variables }),
      }
    );

    const result = await response.json();

    if (result.errors) {
      console.error("Top-level GraphQL errors:", result.errors);
      return json({ error: "GraphQL validation failed." }, { status: 400 });
    }

    const results = customers.map((c, i) => {
      const mutationKey = `c${i}`;
      const mutationResult = result.data?.[mutationKey];

      if (mutationResult?.userErrors?.length > 0) {
        return {
          email: c.email,
          success: false,
          error: mutationResult.userErrors.map((e) => e.message).join(", "),
        };
      }
      return {
        email: c.email,
        success: true,
      };
    });

    return json({ results });
  } catch (err) {
    console.error("Network or server error:", err);
    return json(
      { error: "Server error while importing customers." },
      { status: 500 }
    );
  }
};


// --- Component: ExternalCustomers page ---
export default function ExternalCustomers() {
  const { customers = [], error } = useLoaderData();
  const fetcher = useFetcher();

  const [query, setQuery] = useState("");

  const handleQueryChange = useCallback((value) => setQuery(value), []);
  const handleQueryClear = useCallback(() => setQuery(""), []);
  const filteredCustomers = customers.filter((customer) =>
    [customer.first_name, customer.last_name, customer.email]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  

  const resourceName = {
    singular: "customer",
    plural: "customers",
  };


  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(filteredCustomers);

  const handleImport = () => {
    const toImport = filteredCustomers.filter((c) =>
      selectedResources.includes(c.id.toString())
    );
    const formData = new FormData();
    formData.append("customers", JSON.stringify(toImport));
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Page title="External Store Customers">
      <Layout>
        <Layout.Section>
          <Card>
            <Filters
              queryValue={query}
              onQueryChange={handleQueryChange}
              onQueryClear={handleQueryClear}
              filters={[]}
              appliedFilters={[]}
              disabled={customers.length === 0}
            />
            <IndexTable
              resourceName={resourceName}
              itemCount={filteredCustomers.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "First" },
                { title: "Last" },
                { title: "Email" },
                { title: "Created" },
              ]}
            >
              {filteredCustomers.map((c, index) => (
                <IndexTable.Row
                  id={c.id.toString()}
                  key={c.id}
                  selected={selectedResources.includes(c.id.toString())}
                  position={index}
                >
                  <IndexTable.Cell>{c.first_name || "—"}</IndexTable.Cell>
                  <IndexTable.Cell>{c.last_name || "—"}</IndexTable.Cell>
                  <IndexTable.Cell>{c.email || "—"}</IndexTable.Cell>
                  <IndexTable.Cell>
                    {new Date(c.created_at).toLocaleDateString()}
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>

            <div style={{ marginTop: "1rem" }}>
              <Button
                onClick={handleImport}
                loading={fetcher.state !== "idle"}
                disabled={selectedResources.length === 0}
              >
                Import Selected to Current Store
              </Button>
            </div>

            {fetcher.data?.results && (
              <div style={{ marginTop: "1rem" }}>
                {fetcher.data.results.map((r) => (
                  <Text key={r.email} color={r.success ? "success" : "critical"}>
                    {r.success
                      ? `Imported: ${r.email}`
                      : `Failed: ${r.email} - ${typeof r.error === "string"
                        ? r.error
                        : JSON.stringify(r.error)}`}
                  </Text>
                ))}
              </div>
            )}

            {error && (
              <div style={{ marginTop: "1rem" }}>
                <Text color="critical">{error}</Text>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
