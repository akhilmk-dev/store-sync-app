export const customerQuery = `
{
  customers(first: 50) {
    edges {
      node {
        id
        firstName
        lastName
        email
        phone
        createdAt
        addresses {
          address1
          city
          country
          zip
        }
      }
    }
  }
}
`;