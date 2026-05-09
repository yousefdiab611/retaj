export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  price: number;
  stockQty: number;
};
