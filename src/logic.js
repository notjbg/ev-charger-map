/**
 * ChargeFleet — Extracted pure logic functions for testing.
 *
 * These are the core functions from index.html that can be tested
 * in isolation without a DOM or network.
 */

// ── Config ──────────────────────────────────────────────────────────
export const CONFIG = {
  API_BASE: 'https://developer.nrel.gov/api/alt-fuel-stations/v1',
  CACHE_KEY: 'chargefleet_cache',
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
  US_CENTER: [39.8283, -98.5795],
  US_ZOOM: 5,
};

// ── Haversine Distance ──────────────────────────────────────────────
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── HTML Escaping ───────────────────────────────────────────────────
export function escHtml(str) {
  if (!str) return '';
  // In Node/test environment, use string replacement
  if (typeof document === 'undefined') {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Max Power Calculation ───────────────────────────────────────────
export function getMaxPower(station) {
  let maxPower = 0;
  if (station.ev_charging_units) {
    for (const unit of station.ev_charging_units) {
      if (unit.connectors) {
        for (const [, info] of Object.entries(unit.connectors)) {
          if (info.power_kw && info.power_kw > maxPower) {
            maxPower = info.power_kw;
          }
        }
      }
    }
  }
  return maxPower;
}

// ── Station Filtering ───────────────────────────────────────────────
export function filterStations(allStations, filters, favorites = [], fleetMode = false) {
  return allStations.filter(s => {
    // Status
    if (filters.status !== 'all') {
      if (s.status_code !== filters.status) return false;
    }

    // State
    if (filters.state !== 'all') {
      if (s.state !== filters.state) return false;
    }

    // Vehicle class
    if (filters.vehicleClass !== 'all') {
      if (filters.vehicleClass === 'HD' && s.maximum_vehicle_class !== 'HD') return false;
      if (filters.vehicleClass === 'MD' && s.maximum_vehicle_class !== 'MD' && s.maximum_vehicle_class !== 'HD') return false;
    }

    // Connector
    if (filters.connector !== 'all') {
      if (!s.ev_connector_types || !s.ev_connector_types.includes(filters.connector)) return false;
    }

    // Min power (exclude unknown-power stations when a minimum is set)
    if (filters.minPower > 150 && s._maxPower === 0) return false;
    if (filters.minPower > 0 && s._maxPower > 0 && s._maxPower < filters.minPower) return false;

    // Network
    if (filters.network !== 'all') {
      if (s.ev_network !== filters.network) return false;
    }

    // Facility
    if (filters.facility !== 'all') {
      if (s.facility_type !== filters.facility) return false;
    }

    // Funding
    if (filters.funding !== 'all') {
      if (!s.funding_sources || !s.funding_sources.includes(filters.funding)) return false;
    }

    // Fleet mode: 150kW+ AND truck-accessible
    if (fleetMode) {
      if (s._maxPower > 0 && s._maxPower < 150) return false;
      const truckAccessible = s.facility_type === 'TRUCK_STOP' || s.facility_type === 'TRAVEL_CENTER' ||
        s.facility_type === 'REST_STOP' || s.facility_type === 'FLEET_GARAGE' ||
        s.maximum_vehicle_class === 'HD' || s.maximum_vehicle_class === 'MD';
      if (!truckAccessible) return false;
    }

    // Favorites
    if (filters.favoritesOnly && !favorites.includes(String(s.id))) return false;

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const searchFields = [
        s.station_name, s.city, s.state, s.zip,
        s.street_address, s.ev_network
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchFields.includes(q)) return false;
    }

    return true;
  });
}

// ── Station Deduplication ───────────────────────────────────────────
export function deduplicateStations(stationArrays) {
  const stationMap = new Map();

  for (const { stations, source } of stationArrays) {
    for (const s of stations) {
      if (!stationMap.has(s.id)) {
        s._sources = [source];
        s._maxPower = getMaxPower(s);
        stationMap.set(s.id, s);
      } else {
        stationMap.get(s.id)._sources.push(source);
      }
    }
  }

  return Array.from(stationMap.values());
}

// ── GeoJSON Export Builder ──────────────────────────────────────────
export function buildGeoJSON(stations) {
  return {
    type: 'FeatureCollection',
    features: stations.map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
      properties: {
        name: s.station_name,
        address: `${s.street_address}, ${s.city}, ${s.state} ${s.zip}`,
        network: s.ev_network,
        maxPowerKW: s._maxPower || null,
        dcFastPorts: s.ev_dc_fast_num || 0,
        connectors: (s.ev_connector_types || []).join(', '),
        vehicleClass: s.maximum_vehicle_class || null,
        facilityType: s.facility_type || null,
        status: s.status_code === 'E' ? 'Available' : s.status_code === 'P' ? 'Planned' : s.status_code,
        hours: s.access_days_time || null,
        pricing: s.ev_pricing || null,
        funding: (s.funding_sources || []).join(', ') || null,
        phone: s.station_phone || null,
        lastConfirmed: s.date_last_confirmed || null,
        afdcId: s.id
      }
    }))
  };
}

// ── Route Station Finder ────────────────────────────────────────────
export function findStationsNearRoute(allStations, routeLatLngs, radiusMiles) {
  const sampleRate = Math.max(1, Math.floor(routeLatLngs.length / 200));
  const samples = routeLatLngs.filter((_, i) => i % sampleRate === 0);

  return allStations.filter(s => {
    for (const pt of samples) {
      const dist = haversineDistance(s.latitude, s.longitude, pt[0], pt[1]);
      if (dist <= radiusMiles) return true;
    }
    return false;
  });
}

// ── URL Hash State ──────────────────────────────────────────────────
export function parseHashState(hash) {
  if (!hash) return null;
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const state = {};

  if (params.has('lat') && params.has('lng') && params.has('z')) {
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const z = parseInt(params.get('z'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && z >= 1 && z <= 18) {
      state.lat = lat;
      state.lng = lng;
      state.zoom = z;
    }
  }

  if (params.has('vc')) state.vehicleClass = params.get('vc');
  if (params.has('ct')) state.connector = params.get('ct');
  if (params.has('pw')) state.minPower = parseInt(params.get('pw'));
  if (params.has('net')) state.network = params.get('net');
  if (params.has('fac')) state.facility = params.get('fac');
  if (params.has('fund')) state.funding = params.get('fund');
  if (params.has('st')) state.status = params.get('st');
  if (params.has('state')) state.state = params.get('state');
  if (params.has('q')) state.search = params.get('q');
  if (params.has('fav')) state.favoritesOnly = params.get('fav') === '1';
  if (params.has('fleet')) state.fleetMode = params.get('fleet') === '1';
  if (params.has('sid')) state.selectedStationId = params.get('sid');

  return state;
}

// ── API Response Validation ─────────────────────────────────────────
export function validateStationData(station) {
  if (!station) return false;
  return (
    typeof station.id === 'number' &&
    typeof station.latitude === 'number' &&
    typeof station.longitude === 'number' &&
    typeof station.station_name === 'string' &&
    station.latitude >= -90 && station.latitude <= 90 &&
    station.longitude >= -180 && station.longitude <= 180
  );
}

export function validateAPIResponse(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Response is not an object' };
  if (!Array.isArray(data.fuel_stations)) return { valid: false, error: 'Missing fuel_stations array' };

  const validStations = data.fuel_stations.filter(validateStationData);
  const invalidCount = data.fuel_stations.length - validStations.length;

  return {
    valid: true,
    stations: validStations,
    totalReturned: data.fuel_stations.length,
    validCount: validStations.length,
    invalidCount,
  };
}
