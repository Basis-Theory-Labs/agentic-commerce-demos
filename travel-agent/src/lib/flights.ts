export interface Airport {
  code: string;
  city: string;
  country: string;
}

const AIRPORTS: Airport[] = [
  { code: "GRU", city: "São Paulo", country: "Brazil" },
  { code: "GIG", city: "Rio de Janeiro", country: "Brazil" },
  { code: "JFK", city: "New York", country: "USA" },
  { code: "LAX", city: "Los Angeles", country: "USA" },
  { code: "MIA", city: "Miami", country: "USA" },
  { code: "LHR", city: "London", country: "UK" },
  { code: "CDG", city: "Paris", country: "France" },
  { code: "LIS", city: "Lisbon", country: "Portugal" },
  { code: "MAD", city: "Madrid", country: "Spain" },
  { code: "FCO", city: "Rome", country: "Italy" },
  { code: "NRT", city: "Tokyo", country: "Japan" },
  { code: "SYD", city: "Sydney", country: "Australia" },
];

const DEFAULT_ORIGIN = AIRPORTS[0];
const DEFAULT_DESTINATION = AIRPORTS[7];
const DEFAULT_DAYS_OUT = 30;

export interface FlightSearch {
  origin: Airport;
  destination: Airport;
  date: string;
  passengers: number;
}

export interface FlightOption {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
  stops: number;
  price: number;
  bookingUrl: string;
}

const AIRLINES: Array<{ name: string; code: string; bookingHost: string }> = [
  { name: "LATAM", code: "LA", bookingHost: "latam.com" },
  { name: "TAP Air Portugal", code: "TP", bookingHost: "flytap.com" },
  { name: "Delta", code: "DL", bookingHost: "delta.com" },
  { name: "Iberia", code: "IB", bookingHost: "iberia.com" },
  { name: "British Airways", code: "BA", bookingHost: "britishairways.com" },
  { name: "Air France", code: "AF", bookingHost: "airfrance.com" },
];

function findAirport(text: string): Airport | null {
  const lower = text.toLowerCase();
  const codeMatch = text.match(/\b([A-Z]{3})\b/);
  if (codeMatch) {
    const ap = AIRPORTS.find((a) => a.code === codeMatch[1]);
    if (ap) return ap;
  }
  return (
    AIRPORTS.find((a) => lower.includes(a.city.toLowerCase())) ||
    AIRPORTS.find((a) => lower.includes(a.country.toLowerCase())) ||
    null
  );
}

export function parseFlightQuery(message: string): FlightSearch {
  const fromTo = message.match(/from\s+([^,]+?)\s+to\s+(.+?)(?:\s+on\s+|\s+next\s+|\s+in\s+|$)/i);
  const justTo = message.match(/\bto\s+([A-Za-z]{3,})/i);
  const orig = fromTo ? findAirport(fromTo[1]) : null;
  const dest = fromTo ? findAirport(fromTo[2]) : justTo ? findAirport(justTo[1]) : null;

  const origin = orig ?? DEFAULT_ORIGIN;
  const destination = dest && dest.code !== origin.code ? dest : DEFAULT_DESTINATION;

  const date = parseDate(message);

  const paxMatch = message.match(/(\d+)\s+(passenger|person|people|adult)s?/i);
  const passengers = paxMatch ? Math.min(parseInt(paxMatch[1], 10), 9) : 1;

  return { origin, destination, date, passengers };
}

function parseDate(message: string): string {
  const now = new Date();
  const lower = message.toLowerCase();

  if (lower.includes("tomorrow")) {
    return shiftDays(now, 1);
  }
  if (lower.includes("next week")) {
    return shiftDays(now, 7);
  }
  if (lower.includes("next month")) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  for (let i = 0; i < months.length; i++) {
    const re = new RegExp(`(?:${months[i]}|${months[i].slice(0, 3)})\\s+(\\d{1,2})`, "i");
    const m = lower.match(re);
    if (m) {
      const day = parseInt(m[1], 10);
      const d = new Date(now.getFullYear(), i, day);
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    }
  }

  return shiftDays(now, DEFAULT_DAYS_OUT);
}

function shiftDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function generateFlightOptions(search: FlightSearch): FlightOption[] {
  const baseDate = new Date(`${search.date}T00:00:00Z`);
  const routeKey = `${search.origin.code}-${search.destination.code}`;
  const basePrice = 350 + (hash(routeKey) % 600);

  return AIRLINES.slice(0, 5).map((airline, i) => {
    const seed = hash(`${routeKey}-${airline.code}`);
    const departHour = 6 + (seed % 16);
    const durationMinutes = 240 + ((seed >> 3) % 600);
    const stops = (seed >> 6) % 3 === 0 ? 1 : 0;
    const priceJitter = (seed >> 9) % 250;
    const price = basePrice + priceJitter - (i === 0 ? 40 : 0);

    const depart = new Date(baseDate);
    depart.setUTCHours(departHour, 0, 0, 0);
    const arrive = new Date(depart);
    arrive.setUTCMinutes(arrive.getUTCMinutes() + durationMinutes);

    return {
      id: `flt_${airline.code}_${seed.toString(36).slice(0, 6)}`,
      airline: airline.name,
      airlineCode: airline.code,
      flightNumber: `${airline.code}${100 + (seed % 900)}`,
      departAt: depart.toISOString(),
      arriveAt: arrive.toISOString(),
      durationMinutes,
      stops,
      price,
      bookingUrl: `https://${airline.bookingHost}/checkout`,
    };
  });
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
