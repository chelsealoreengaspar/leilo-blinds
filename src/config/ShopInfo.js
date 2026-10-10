// Edit this file to change what is printed on the acknowledgement.
// Lines you leave empty ("") are skipped, so nothing blank is printed.

export const SHOP = {
  name: "Lei-Lo Mktg. Korean Blinds",        // leave empty if your logo already shows the shop name
  address: "Borol 2nd, Balagtas, Bulacan",     // example: "123 Main Street, City"
  phone: "+63 905-377-8875",       // example: "0917 000 0000"
  email: "leilomarketing@gmail.com",       // example: "hello@example.com"
};

export const ACK = {
  title: "Acknowledgement Receipt",

  // {customer}, {total}, {order} and {date} are filled in automatically.
  statement: "Received from {customer} the amount of {total} for the completed order listed above.",

  // Extra lines printed under the statement, one per line. Example:
  //   terms: ["Thank you for your business.", "Please keep this receipt for your records."],
  terms: [],

  preparedByLabel: "Prepared by",
  receivedByLabel: "Received by",

  showNotes: false,   // true prints the order notes on the receipt
};