import React, { useState, useEffect, useRef } from 'react';
import { fetchGeocodingSuggestions, type GeocodingMatch } from '../utils/geocoding';
import { MapPin, Loader2 } from 'lucide-react';
import { COUNTRIES, COUNTRY_STATES } from '../utils/addressConstants';

export interface AddressValue {
  street: string;
  suburb: string;
  state: string;
  country: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
}

interface AddressFormProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  required?: boolean;
}


export const AddressForm: React.FC<AddressFormProps> = ({ value, onChange, required = false }) => {
  const [streetQuery, setStreetQuery] = useState(value.street);
  const [prevStreet, setPrevStreet] = useState(value.street);
  const [prevStreetQuery, setPrevStreetQuery] = useState(streetQuery);
  const [suggestions, setSuggestions] = useState<GeocodingMatch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync street input when parent value changes and clean suggestions during render
  if (value.street !== prevStreet) {
    setStreetQuery(value.street);
    setPrevStreet(value.street);
    setSuggestions([]);
  } else if (streetQuery !== prevStreetQuery) {
    setPrevStreetQuery(streetQuery);
    if (!streetQuery.trim() || streetQuery === value.street) {
      setSuggestions([]);
    }
  }

  // Debounced search for suggestions
  useEffect(() => {
    if (!streetQuery.trim() || streetQuery === value.street) {
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const matches = await fetchGeocodingSuggestions(
          streetQuery,
          value.suburb,
          value.state,
          value.country,
          value.postcode
        );
        setSuggestions(matches);
        setShowSuggestions(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [streetQuery, value.street, value.suburb, value.state, value.country, value.postcode]);

  // Click outside listener to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (match: GeocodingMatch) => {
    const addr = match.address;
    const houseNumber = addr.house_number ? `${addr.house_number} ` : '';
    const road = addr.road || '';
    const updatedStreet = `${houseNumber}${road}`.trim() || match.display_name.split(',')[0];

    const updatedSuburb = addr.suburb || addr.city || addr.town || addr.village || value.suburb;
    
    // Resolve ISO Country code
    const rawCountryCode = (addr.country_code || '').toUpperCase();
    const matchedCountry = COUNTRIES.find(c => c.value === rawCountryCode);
    const updatedCountry = matchedCountry ? matchedCountry.value : value.country;

    // Resolve state ISO code if mapped
    const rawState = addr.state || addr.province || '';
    let updatedState: string;
    if (updatedCountry && COUNTRY_STATES[updatedCountry]) {
      const stateList = COUNTRY_STATES[updatedCountry];
      const normalizedState = rawState.toLowerCase().trim();
      const foundState = stateList.find(
        s => s.value.toLowerCase() === normalizedState || s.label.toLowerCase().includes(normalizedState)
      );
      updatedState = foundState ? foundState.value : rawState;
    } else {
      updatedState = rawState;
    }

    const updatedPostcode = addr.postcode || value.postcode;

    const lat = parseFloat(match.lat);
    const lon = parseFloat(match.lon);

    setStreetQuery(updatedStreet);
    setShowSuggestions(false);

    onChange({
      street: updatedStreet,
      suburb: updatedSuburb,
      state: updatedState,
      country: updatedCountry,
      postcode: updatedPostcode,
      latitude: isNaN(lat) ? undefined : lat,
      longitude: isNaN(lon) ? undefined : lon,
    });
  };

  const handleFieldChange = (field: keyof AddressValue, fieldValue: string) => {
    // If the country changes, reset state/province to prevent invalid pairings
    const updatedFields: Partial<AddressValue> = { [field]: fieldValue };
    if (field === 'country') {
      updatedFields.state = '';
    }

    onChange({
      ...value,
      ...updatedFields,
      // If we manually change address fields (other than selecting suggestion), coordinates should clear so we re-geocode on submit
      latitude: undefined,
      longitude: undefined,
    });
  };

  const statesList = value.country ? COUNTRY_STATES[value.country] : undefined;

  return (
    <div className="space-y-4">
      {/* Street Address Input with Autocomplete */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
          Street Address
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="e.g. 1 Tesla Road (with autocomplete suggestions)"
            value={streetQuery}
            onChange={(e) => {
              setStreetQuery(e.target.value);
              onChange({
                ...value,
                street: e.target.value,
                latitude: undefined,
                longitude: undefined,
              });
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-4 pr-10 py-2.5 text-sm text-crm-text placeholder-crm-muted/50 outline-none transition"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-crm-muted">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
          </div>
        </div>

        {/* Suggestions Autocomplete Dropdown list */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-crm-card border border-crm-border rounded-xl shadow-2xl divide-y divide-crm-border/60 scrollbar-thin">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-4 py-3 hover:bg-crm-bg text-xs text-crm-text font-medium leading-normal transition flex items-start space-x-2"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <span>{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suburb/City & Postcode */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
            Suburb / City {required && '*'}
          </label>
          <input
            type="text"
            placeholder="e.g. Austin"
            value={value.suburb}
            onChange={(e) => handleFieldChange('suburb', e.target.value)}
            className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/50 outline-none transition"
            required={required}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
            Postcode / Zip
          </label>
          <input
            type="text"
            placeholder="e.g. 78725"
            value={value.postcode}
            onChange={(e) => handleFieldChange('postcode', e.target.value)}
            className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/50 outline-none transition"
          />
        </div>
      </div>

      {/* Country & State/Province dropdowns */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
            Country
          </label>
          <select
            value={value.country}
            onChange={(e) => handleFieldChange('country', e.target.value)}
            className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
          >
            <option value="">Select Country</option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
            State / Province
          </label>
          {statesList ? (
            <select
              value={value.state}
              onChange={(e) => handleFieldChange('state', e.target.value)}
              className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
            >
              <option value="">Select State</option>
              {statesList.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="e.g. Texas"
              value={value.state}
              onChange={(e) => handleFieldChange('state', e.target.value)}
              className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/50 outline-none transition"
            />
          )}
        </div>
      </div>
    </div>
  );
};
