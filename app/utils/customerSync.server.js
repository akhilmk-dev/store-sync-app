import { shopifyApi } from "@shopify/shopify-api";

export async function syncCustomersBetweenShops(
  sourceShop,
  sourceToken,
  destShop,
  destToken
) {
  const sourceClient = new shopifyApi.clients.Graphql({
    domain: sourceShop,
    accessToken: sourceToken,
    apiVersion: "2024-01",
  });

  const destClient = new shopifyApi.clients.Graphql({
    domain: destShop,
    accessToken: destToken,
    apiVersion: "2024-01",
  });

  const result = await sourceClient.query({
    data: {
      query: `#graphql
        {
          customers(first: 10) {
            edges {
              node {
                email
                firstName
                lastName
                phone
              }
            }
          }
        }`,
    },
  });

  const customers = result.body.data.customers.edges;

  for (const edge of customers) {
    const customer = edge.node;
    await destClient.query({
      data: {
        query: `#graphql
          mutation customerCreate($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
        variables: {
          input: {
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
          },
        },
      },
    });
  }

  return { success: true, imported: customers.length };
}
