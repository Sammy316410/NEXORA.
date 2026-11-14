// The demo hotel: Villa Monument, Victoria Island, Lagos, as the team saw it
// on 13 Nov 2026. Room and amenity names come from the hotel's public room
// card. Staff are added by role only (they did not give their names), with
// placeholder @mockmail.com emails. Room rates and menu prices are SAMPLES:
// the hotel's real prices were not collected. Not affiliated with the hotel.

export const HOTEL = {
  slug: "villa-monument",
  name: "Villa Monument (demo)",
  short_name: "Villa Monument",
  accent_color: "#0F766E",
  canvas_color: "#FBF8F3",
  timezone: "Africa/Lagos",
  currency: "NGN",
  check_in_time: "14:00",
  check_out_time: "12:00",
  wifi_name: null,
  wifi_password: null,
  phone: null,
  whatsapp: null,
  address: "Victoria Island, Lagos",
  breakfast_hours: null,
};

/** The hotel Amber Coast demo this replaced; the seed deletes it and its demo logins. */
export const LEGACY_HOTEL_SLUG = "amber-coast";
export const LEGACY_EMAIL_DOMAIN = "@ambercoast.demo";

export const DEPARTMENTS = [
  { id: "housekeeping", name: "Housekeeping", sort: 1 },
  { id: "maintenance", name: "Maintenance", sort: 2 },
  { id: "food", name: "Food and drinks", sort: 3 },
  { id: "front_desk", name: "Front desk", sort: 4 },
];

type Svc = {
  id: string;
  name: string;
  category: "amenities" | "housekeeping" | "maintenance" | "food" | "front_desk";
  department_id: string;
  icon: string;
  action_verb: string;
  default_priority: "low" | "normal" | "high" | "urgent";
  response_target_min: number;
  resolution_target_min: number;
  has_quantity?: boolean;
  max_quantity?: number;
  ask_urgent?: boolean;
  needs_note?: boolean;
  guest_visible?: boolean;
  featured?: boolean;
};

const SERVICE_LIST: Svc[] = [
  { id: "extra-towels", name: "Extra towels", category: "amenities", department_id: "housekeeping", icon: "towels", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 4, featured: true },
  { id: "toiletries", name: "Toiletries", category: "amenities", department_id: "housekeeping", icon: "toiletries", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, featured: true },
  { id: "extra-pillows", name: "Extra pillows", category: "amenities", department_id: "housekeeping", icon: "pillow", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 3 },
  { id: "blanket", name: "Blanket", category: "amenities", department_id: "housekeeping", icon: "blanket", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 2 },
  { id: "drinking-water", name: "Drinking water", category: "amenities", department_id: "housekeeping", icon: "water", action_verb: "Deliver", default_priority: "normal", response_target_min: 10, resolution_target_min: 15, has_quantity: true, max_quantity: 6 },
  { id: "room-cleaning", name: "Room cleaning", category: "housekeeping", department_id: "housekeeping", icon: "cleaning", action_verb: "Clean", default_priority: "normal", response_target_min: 10, resolution_target_min: 30, featured: true },
  { id: "turndown", name: "Turndown service", category: "housekeeping", department_id: "housekeeping", icon: "turndown", action_verb: "Turn down", default_priority: "low", response_target_min: 15, resolution_target_min: 45 },
  { id: "change-linen", name: "Change bed linen", category: "housekeeping", department_id: "housekeeping", icon: "linen", action_verb: "Change", default_priority: "normal", response_target_min: 10, resolution_target_min: 30 },
  { id: "ac-cooling", name: "AC or cooling", category: "maintenance", department_id: "maintenance", icon: "ac", action_verb: "Fix", default_priority: "high", response_target_min: 10, resolution_target_min: 60, ask_urgent: true },
  { id: "leak", name: "Leak or plumbing", category: "maintenance", department_id: "maintenance", icon: "leak", action_verb: "Fix", default_priority: "high", response_target_min: 5, resolution_target_min: 60, ask_urgent: true },
  { id: "power-lights", name: "Power or lights", category: "maintenance", department_id: "maintenance", icon: "power", action_verb: "Fix", default_priority: "high", response_target_min: 10, resolution_target_min: 60, ask_urgent: true },
  { id: "tv-wifi", name: "TV or Wi-Fi", category: "maintenance", department_id: "maintenance", icon: "tv", action_verb: "Fix", default_priority: "normal", response_target_min: 10, resolution_target_min: 60 },
  { id: "door-lock", name: "Door or lock", category: "maintenance", department_id: "maintenance", icon: "door", action_verb: "Fix", default_priority: "high", response_target_min: 5, resolution_target_min: 30, ask_urgent: true },
  { id: "food-order", name: "Food and drinks", category: "food", department_id: "food", icon: "food", action_verb: "Bring", default_priority: "normal", response_target_min: 10, resolution_target_min: 40, needs_note: true, featured: true },
  { id: "late-checkout", name: "Late checkout", category: "front_desk", department_id: "front_desk", icon: "checkout", action_verb: "Arrange", default_priority: "low", response_target_min: 10, resolution_target_min: 30 },
  { id: "luggage-help", name: "Luggage help", category: "front_desk", department_id: "front_desk", icon: "luggage", action_verb: "Help with", default_priority: "normal", response_target_min: 10, resolution_target_min: 20 },
  { id: "taxi", name: "Taxi", category: "front_desk", department_id: "front_desk", icon: "taxi", action_verb: "Book", default_priority: "normal", response_target_min: 10, resolution_target_min: 20 },
  { id: "wake-up-call", name: "Wake-up call", category: "front_desk", department_id: "front_desk", icon: "alarm", action_verb: "Schedule", default_priority: "low", response_target_min: 10, resolution_target_min: 30, needs_note: true },
  { id: "checkout-help", name: "Help with checkout", category: "front_desk", department_id: "front_desk", icon: "checkout", action_verb: "Help with", default_priority: "normal", response_target_min: 10, resolution_target_min: 20 },
  { id: "general-help", name: "Something else", category: "front_desk", department_id: "front_desk", icon: "help", action_verb: "Help with", default_priority: "normal", response_target_min: 10, resolution_target_min: 30, needs_note: true },
  { id: "safety-concern", name: "Safety concern", category: "front_desk", department_id: "front_desk", icon: "safety", action_verb: "Check on", default_priority: "urgent", response_target_min: 5, resolution_target_min: 15, guest_visible: false },
];

export const SERVICES = SERVICE_LIST.map((s, i) => ({
  has_quantity: false,
  max_quantity: 1,
  ask_urgent: false,
  needs_note: false,
  guest_visible: true,
  featured: false,
  active: true,
  sort: i + 1,
  ...s,
}));

/** Demo sign-in uses the part before the @ (e.g. /auth/demo?as=porter). */
export const STAFF_EMAIL_DOMAIN = "@mockmail.com";

export const STAFF = [
  { full_name: "Receptionist", email: "receptionist@mockmail.com", role: "front_desk", job_title: "Front desk receptionist", department_id: "front_desk", on_duty: true },
  { full_name: "Porter", email: "porter@mockmail.com", role: "staff", job_title: "Porter, lounge", department_id: "food", on_duty: true },
  { full_name: "Duty manager", email: "manager@mockmail.com", role: "manager", job_title: "Duty manager (played by the NEXORA team)", department_id: null, on_duty: true },
] as const;

/** Sample nightly rate in naira: the hotel's real rates were not collected. */
export const SAMPLE_RATE = 85000;

/** Floor 0 = guest rooms, -1 = amenities (floors were not collected). */
export const ROOMS: { number: string; floor: number; room_type: string; rate: number }[] = [
  ...["Catalan", "Westminster", "Florence", "Rouge", "Empire", "Orient", "Ile Ife", "Pyramid", "Fantasia", "Safari", "Ocean Jewel", "Burj Khalifa"].map(
    (number) => ({ number, floor: 0, room_type: "Guest room", rate: SAMPLE_RATE }),
  ),
  ...["Villa 24 Lounge", "Fitness Villa", "The Boardroom", "Garden Terrace"].map((number) => ({ number, floor: -1, room_type: "Amenity", rate: 0 })),
];

/** The team's own stay: the guest who can sign in to the guest portal. */
export const TEAM_GUEST = { room: "Westminster", first: "TEAM_FIRST_NAME", last: "TEAM_LAST_NAME", bookingRef: "VM-WESTMINSTER" };

/** Room-service menu: SAMPLE items and prices in naira (stored in kobo), not the hotel's real menu. */
export const MENU = [
  { id: "jollof-chicken", name: "Jollof rice with chicken", description: "Smoky party jollof, grilled chicken, fried plantain", category: "mains", price: 8500 },
  { id: "fried-rice-beef", name: "Fried rice with beef", description: "With coleslaw and peppered beef", category: "mains", price: 8000 },
  { id: "pounded-yam-egusi", name: "Pounded yam and egusi", description: "With assorted meat", category: "mains", price: 9500 },
  { id: "club-sandwich", name: "Club sandwich and fries", description: null, category: "mains", price: 7500 },
  { id: "suya-platter", name: "Suya platter", description: "Spiced beef, onions and tomatoes", category: "light", price: 6500 },
  { id: "pepper-soup", name: "Goat meat pepper soup", description: null, category: "light", price: 6000 },
  { id: "fruit-platter", name: "Fruit platter", description: "Pineapple, watermelon, pawpaw", category: "desserts", price: 3500 },
  { id: "chocolate-cake", name: "Chocolate cake", description: null, category: "desserts", price: 3000 },
  { id: "bottled-water", name: "Bottled water", description: "75 cl", category: "drinks", price: 800 },
  { id: "chapman", name: "Chapman", description: "House mocktail", category: "drinks", price: 2500 },
  { id: "orange-juice", name: "Fresh orange juice", description: null, category: "drinks", price: 3000 },
  { id: "soft-drink", name: "Soft drink", description: "Coke, Fanta or Sprite", category: "drinks", price: 1200 },
  { id: "coffee", name: "Coffee", description: "Americano or cappuccino", category: "drinks", price: 2000 },
] as const;
