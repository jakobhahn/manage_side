export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}
export type UserRole = 'admin' | 'manager' | 'staff' | 'customer';
export interface Restaurant {
    id: string;
    name: string;
    address: Address;
    phone: string;
    email: string;
    settings: RestaurantSettings;
    createdAt: Date;
    updatedAt: Date;
}
export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}
export interface RestaurantSettings {
    timezone: string;
    currency: string;
    taxRate: number;
    serviceCharge: number;
    operatingHours: OperatingHours;
}
export interface OperatingHours {
    [key: string]: {
        open: string;
        close: string;
        closed: boolean;
    };
}
export interface Menu {
    id: string;
    restaurantId: string;
    name: string;
    description?: string;
    categories: MenuCategory[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface MenuCategory {
    id: string;
    name: string;
    description?: string;
    items: MenuItem[];
    sortOrder: number;
}
export interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    allergens: string[];
    dietaryInfo: DietaryInfo;
    isAvailable: boolean;
    sortOrder: number;
}
export interface DietaryInfo {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
    dairyFree: boolean;
    nutFree: boolean;
}
export interface Order {
    id: string;
    restaurantId: string;
    customerId: string;
    items: OrderItem[];
    status: OrderStatus;
    total: number;
    tax: number;
    serviceCharge: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface OrderItem {
    id: string;
    menuItemId: string;
    quantity: number;
    price: number;
    notes?: string;
    modifications: OrderItemModification[];
}
export interface OrderItemModification {
    id: string;
    name: string;
    price: number;
}
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, any>;
}
//# sourceMappingURL=index.d.ts.map