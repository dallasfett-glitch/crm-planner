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
