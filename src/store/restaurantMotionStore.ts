/**
 * Pure non-React transient store coordinating local 60 FPS Waiter & Customer NPC
 * delivery animations inside RestaurantRoom (NEVER writes coordinates to Postgres).
 */
type Listener = () => void;

class RestaurantMotionStore {
  /** Order IDs whose dish has been physically placed on the table by the Waiter NPC */
  private placedDishes = new Set<string>();
  /** Order IDs already handed to completeRestaurantOrder() to avoid duplicate RPCs */
  private finalizedIds = new Set<string>();
  private listeners = new Set<Listener>();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  public isDishPlaced(orderId: string): boolean {
    return this.placedDishes.has(orderId);
  }

  public markDishPlaced(orderId: string): void {
    if (this.placedDishes.has(orderId)) return;
    this.placedDishes.add(orderId);
    this.emit();
  }

  public clearOrder(orderId: string): void {
    const changed = this.placedDishes.delete(orderId);
    this.finalizedIds.delete(orderId);
    if (changed) this.emit();
  }

  public markFinalizedOnce(orderId: string): boolean {
    if (this.finalizedIds.has(orderId)) return false;
    this.finalizedIds.add(orderId);
    return true;
  }

  public reset(): void {
    this.placedDishes.clear();
    this.finalizedIds.clear();
    this.emit();
  }
}

export const restaurantMotionStore = new RestaurantMotionStore();
