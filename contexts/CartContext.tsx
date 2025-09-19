import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { API_BASE_URL } from '../config/apiConfig';

interface CartContextType {
  cartItemCount: number;
  loadCartItemCount: (userEmail: string) => Promise<void>;
  updateCartItemCount: (count: number) => void;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [cartItemCount, setCartItemCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadCartItemCount = useCallback(async (userEmail: string) => {
    if (!userEmail) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/${userEmail}`);
      const data = await response.json();
      
      if (data.success && data.cart && data.cart.items) {
        const itemCount = data.cart.items.length;
        setCartItemCount(itemCount);
      } else {
        setCartItemCount(0);
      }
    } catch (error) {
      console.error('Error loading cart count:', error);
      setCartItemCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to manually update cart count
  const updateCartItemCount = useCallback((count: number) => {
    setCartItemCount(count);
  }, []);

  const value = {
    cartItemCount,
    loadCartItemCount,
    updateCartItemCount,
    isLoading,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}