import type { PaymentMethod } from "@/lib/api";

const CART_KEY = "retaj_pos_cart_state";

export type SavedCartState = {
  cart: Array<{ productId: string; name: string; unitPrice: number; quantity: number }>;
  discountInput: string;
  selectedWarehouseId: string | null;
  paymentMethod: PaymentMethod;
  selectedCustomerId?: string;
  selectedCustomerName?: string;
  lastUpdated: number;
};

export function loadCartState(): SavedCartState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedCartState;
  } catch {
    return null;
  }
}

export function saveCartState(state: SavedCartState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(state));
  } catch {
    // ignore write error
  }
}

export function clearCartState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_KEY);
}
