export const CustomerCreateMutation = `
mutation customerCreate($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer {
      id
      email
    }
    userErrors {
      field
      message
    }
  }
}
`;