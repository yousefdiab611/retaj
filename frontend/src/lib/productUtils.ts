import type { Product } from "@/types/product";

export function uniqueCategories(products: Product[]): string[] {
  return [...new Set(products.map((p) => p.category))].sort();
}
