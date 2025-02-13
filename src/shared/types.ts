export type UserType = {
    _id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
};
  
export type HotelType = {
    _id: number; // Opcional porque es autoincremental
    idEmpresa: number;
    name: string;
    city: string;
    country: string;
    description: string;
    type: string;
    price_per_day: number;
    starRating: number;
    facilities: string[];
    asistentes: number;
    visitantes: number;
    image_urls: string[];
};


export type BookingType = {
    _id: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    adultCount: number;
    childCount: number;
    checkIn: Date;
    checkOut: Date;
    totalCost: number;
};

export type HotelSearchResponse = {
    data: HotelType[];
    pagination: {
      total: number;
      page: number;
      pages: number;
    };
};
  
export type PaymentIntentResponse = {
    paymentIntentId: string;
    clientSecret: string;
    totalCost: number;
};