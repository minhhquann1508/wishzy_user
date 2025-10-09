import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  _id: string;
  courseName: string;
  instructor: string;
  price: number;
  originalPrice?: number;
  thumbnail: string;
  slug: string;
  level: string;
  numberOfStudents: number;
  totalDuration: number;
  quantity: number;
  createdBy: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
  };
  subject: {
    _id: string;
    subjectName: string;
    slug: string;
  };
  grade: {
    _id: string;
    gradeName: string;
  };
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

interface CartActions {
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (_id: string) => void;
  updateQuantity: (_id: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  calculateTotals: () => void;
  replaceCart: (items: CartItem[]) => void;
  hasItem: (_id: string) => boolean;
  hasOwned: (_id: string) => boolean;
}

type CartStore = CartState & CartActions;

const calculateTotals = (items: CartItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = items.reduce((sum, item) => {
    const originalPrice = item.originalPrice || item.price;
    return sum + ((originalPrice - item.price) * item.quantity);
  }, 0);
  return {
    subtotal,
    discount,
    total: subtotal
  };
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,

      // Actions
      addItem: (item) => {
        const { items } = get();
        // Guard: do not add if already owned (persisted by return page)
        try {
          const ownedRaw = typeof window !== 'undefined' ? localStorage.getItem('owned_courses') : null;
          const owned: string[] = ownedRaw ? JSON.parse(ownedRaw) : [];
          if (Array.isArray(owned) && owned.includes(item._id)) {
            // Already owned, skip adding to cart
            return;
          }
        } catch {
          // ignore localStorage parsing errors
        }
        const existingItem = items.find(cartItem => cartItem._id === item._id);
        
        let newItems: CartItem[];
        if (existingItem) {
          // Do not increase beyond 1; keep exactly 1 per user as business rule
          newItems = items.map(cartItem =>
            cartItem._id === item._id
              ? { ...cartItem, quantity: 1 }
              : cartItem
          );
        } else {
          newItems = [...items, { ...item, quantity: 1 }];
        }
        
        const totals = calculateTotals(newItems);
        set({
          items: newItems,
          ...totals
        });
      },

      // Replace entire cart (used to hydrate from checkout_items)
      replaceCart: (newItems) => {
        const totals = calculateTotals(newItems);
        set({
          items: newItems,
          ...totals,
        });
      },

      removeItem: (_id) => {
        const { items } = get();
        const newItems = items.filter(item => item._id !== _id);
        const totals = calculateTotals(newItems);
        set({
          items: newItems,
          ...totals
        });
      },

      updateQuantity: (_id, quantity) => {
        const { items } = get();
        let newItems: CartItem[];
        
        if (quantity <= 0) {
          newItems = items.filter(item => item._id !== _id);
        } else {
          newItems = items.map(item =>
            item._id === _id
              ? { ...item, quantity }
              : item
          );
        }
        
        const totals = calculateTotals(newItems);
        set({
          items: newItems,
          ...totals
        });
      },

      clearCart: () => {
        set({
          items: [],
          subtotal: 0,
          discount: 0,
          total: 0
        });
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },

      hasItem: (_id) => {
        const { items } = get();
        return items.some(item => item._id === _id);
      },

      hasOwned: (_id) => {
        try {
          const ownedRaw = typeof window !== 'undefined' ? localStorage.getItem('owned_courses') : null;
          const owned: string[] = ownedRaw ? JSON.parse(ownedRaw) : [];
          return Array.isArray(owned) && owned.includes(_id);
        } catch {
          return false;
        }
      },

      calculateTotals: () => {
        const { items } = get();
        const totals = calculateTotals(items);
        set(totals);
      }
    }),
    {
      name: 'wishzy-cart-storage',
      partialize: (state) => ({ 
        items: state.items,
        subtotal: state.subtotal,
        discount: state.discount,
        total: state.total
      }),
    }
  )
);
