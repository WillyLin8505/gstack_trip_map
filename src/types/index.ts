export interface Place {
  id: string;              // Google place_id
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;        // from primaryTypeDisplayName
  price_level: 0 | 1 | 2 | 3 | 4 | null;
  rating: number | null;
  opening_hours: OpeningHours | null;
  photo_url: string | null;
  dwell_minutes: number;   // default 60, user-adjustable
  description?: string;
  weekday_descriptions?: string[] | null;
}

export interface OpeningHours {
  open_now: boolean | null;
  periods: Array<{
    open: { day: number; hour: number; minute: number };
    close: { day: number; hour: number; minute: number } | null;
  }>;
}

export interface Visit {
  place: Place;
  arrival_time: string;    // HH:MM
  departure_time: string;  // HH:MM
  travel_minutes_from_prev: number;
  opening_warning: boolean;
}

export interface Day {
  day_number: number;
  color: string;           // hex from DAY_COLORS
  visits: Visit[];
  total_travel_minutes: number;
  total_dwell_minutes: number;
}

export interface ScheduledItinerary {
  id: string;
  place_list_raw: string;  // original user input
  city: string;
  start_date: string | null;
  start_time: string;      // HH:MM, default "09:00"
  days: Day[];
  created_at: string;
  share_token: string | null;
  user_id: string | null;
  isEstimated?: boolean;
}

export interface ResolveRequest {
  place_list: string;
  city: string;
}

export interface ResolveResponse {
  places: Place[];
  warnings: string[];
}

export interface OptimizeRequest {
  places: Place[];
  city: string;
  start_date?: string;
  start_time?: string;
  num_days?: number;
}

export interface OptimizeResponse {
  itinerary: ScheduledItinerary;
  isEstimated?: boolean;
}
