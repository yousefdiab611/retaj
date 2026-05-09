/** Matches GET /api/transactions/:id — `transaction` object shape. */
export type InvoiceTransaction = {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  remaining: number;
  branch: { id: string; name: string; address: string | null; phone: string | null };
  warehouse: { id: string; name: string; location: string | null };
  store: { name: string; currency: string; taxLabel: string; thankYou: string };
  cashier: { id: string; name: string; email: string | null; username: string | null };
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  lines: Array<{
    id: string;
    productId: string;
    sku: string;
    name: string;
    barcode: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};
