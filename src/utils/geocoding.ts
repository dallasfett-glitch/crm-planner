export interface GeocodingMatch {
  display_name: string;
  lat: string;
  lon: string;
  importance: number;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    province?: string;
    postcode?: string;
    country_code?: string;
    country?: string;
    [key: string]: unknown;
  };
}

/**
 * Fetch suggestions for street autocomplete based on current address fields
 */
export async function fetchGeocodingSuggestions(
  streetQuery: string,
  suburb: string,
  state: string,
  country: string,
  postcode: string
): Promise<GeocodingMatch[]> {
  if (!streetQuery.trim()) return [];

  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: '5',
    street: streetQuery,
  });

  if (suburb) params.append('city', suburb);
  if (state) params.append('state', state);
  if (country) params.append('country', country);
  if (postcode) params.append('postalcode', postcode);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'CRM-Planner/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) return [];
    const data = await response.json();
    return (data || []) as GeocodingMatch[];
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Error fetching autocomplete suggestions:', error);
    return [];
  }
}

/**
 * Geocode a structured address for pre-save validation
 */
export async function geocodeStructuredAddress(address: {
  street: string;
  suburb: string;
  state: string;
  country: string;
  postcode: string;
}): Promise<GeocodingMatch[]> {
  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: '5',
    city: address.suburb || '',
    state: address.state || '',
    country: address.country || '',
    postalcode: address.postcode || '',
  });

  if (address.street) {
    params.append('street', address.street);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'CRM-Planner/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Geocoding service returned an API error status.');
    }

    const data = await response.json();
    return (data || []) as GeocodingMatch[];
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Geocoding request timed out after 5 seconds.', { cause: err });
    }
    throw err;
  }
}

/**
 * Calculate great-circle distance between two geographic coordinates in kilometers.
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface SpatialEntity {
  id: string;
  name?: string;
  suburb?: string;
  state?: string;
  country?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  companyName?: string;
}

/**
 * Returns a normalized cluster key for grouping contacts geographically.
 */
export function getSpatialClusterKey(entity: SpatialEntity): string {
  if (entity.suburb && entity.suburb.trim()) {
    const normSuburb = entity.suburb.trim().toLowerCase();
    const normState = entity.state ? entity.state.trim().toLowerCase() : '';
    return normState ? `${normSuburb}-${normState}` : normSuburb;
  }
  if (entity.postcode && entity.postcode.trim()) {
    return `postcode-${entity.postcode.trim().toLowerCase()}`;
  }
  if (entity.latitude !== undefined && entity.longitude !== undefined) {
    // Round to ~0.05 degrees (approx 5 km grid)
    const latGrid = Math.round(entity.latitude * 20) / 20;
    const lonGrid = Math.round(entity.longitude * 20) / 20;
    return `geo-${latGrid}-${lonGrid}`;
  }
  if (entity.companyName && entity.companyName.trim()) {
    return `comp-${entity.companyName.trim().toLowerCase()}`;
  }
  return 'general-territory';
}

/**
 * Returns a human-friendly label for the geographic cluster.
 */
export function getSpatialClusterName(entity: SpatialEntity): string {
  if (entity.suburb && entity.suburb.trim()) {
    const sub = entity.suburb.trim();
    const st = entity.state ? ` (${entity.state.trim()})` : '';
    return `${sub}${st} Territory`;
  }
  if (entity.companyName && entity.companyName.trim()) {
    return `${entity.companyName.trim()} Hub`;
  }
  if (entity.postcode && entity.postcode.trim()) {
    return `Postal Area ${entity.postcode.trim()}`;
  }
  return 'General Territory';
}
