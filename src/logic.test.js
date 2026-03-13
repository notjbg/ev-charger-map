import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  escHtml,
  getMaxPower,
  filterStations,
  deduplicateStations,
  buildGeoJSON,
  findStationsNearRoute,
  parseHashState,
  validateStationData,
  validateAPIResponse,
  CONFIG,
} from './logic.js';

// ── Test Data ───────────────────────────────────────────────────────
function makeStation(overrides = {}) {
  return {
    id: 1,
    station_name: 'Test Station',
    street_address: '123 Main St',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
    latitude: 39.7392,
    longitude: -104.9903,
    ev_network: 'Tesla',
    ev_connector_types: ['TESLA', 'J1772COMBO'],
    ev_dc_fast_num: 8,
    ev_charging_units: [],
    maximum_vehicle_class: 'HD',
    facility_type: 'TRUCK_STOP',
    status_code: 'E',
    access_days_time: '24 hours daily',
    funding_sources: ['NEVI'],
    _maxPower: 350,
    _sources: ['mdhd'],
    ...overrides,
  };
}

const defaultFilters = {
  vehicleClass: 'all',
  connector: 'all',
  minPower: 150,
  network: 'all',
  facility: 'all',
  funding: 'all',
  status: 'E',
  state: 'all',
  search: '',
  favoritesOnly: false,
};

// ── Config Tests ────────────────────────────────────────────────────
describe('CONFIG', () => {
  it('has expected constants', () => {
    expect(CONFIG.CACHE_TTL).toBe(86400000);
    expect(CONFIG.US_CENTER).toEqual([39.8283, -98.5795]);
    expect(CONFIG.US_ZOOM).toBe(5);
  });
});

// ── Haversine Distance Tests ────────────────────────────────────────
describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(39.7392, -104.9903, 39.7392, -104.9903)).toBe(0);
  });

  it('calculates distance between Denver and LA (~831 miles)', () => {
    const dist = haversineDistance(39.7392, -104.9903, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(825);
    expect(dist).toBeLessThan(840);
  });

  it('calculates distance between NY and LA (~2446 miles)', () => {
    const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(2440);
    expect(dist).toBeLessThan(2460);
  });

  it('handles equator crossing', () => {
    const dist = haversineDistance(1, 0, -1, 0);
    expect(dist).toBeGreaterThan(130);
    expect(dist).toBeLessThan(140);
  });
});

// ── escHtml Tests ───────────────────────────────────────────────────
describe('escHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(escHtml(null)).toBe('');
    expect(escHtml(undefined)).toBe('');
    expect(escHtml('')).toBe('');
  });

  it('escapes HTML special characters', () => {
    expect(escHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('passes through safe strings', () => {
    expect(escHtml('Hello World')).toBe('Hello World');
  });

  it('escapes single quotes', () => {
    expect(escHtml("it's")).toBe("it&#039;s");
  });
});

// ── getMaxPower Tests ───────────────────────────────────────────────
describe('getMaxPower', () => {
  it('returns 0 for station without charging units', () => {
    expect(getMaxPower({ ev_charging_units: [] })).toBe(0);
    expect(getMaxPower({})).toBe(0);
  });

  it('finds max power across multiple connectors', () => {
    const station = {
      ev_charging_units: [
        {
          connectors: {
            CCS: { power_kw: 150 },
            NACS: { power_kw: 350 },
          },
        },
      ],
    };
    expect(getMaxPower(station)).toBe(350);
  });

  it('finds max power across multiple units', () => {
    const station = {
      ev_charging_units: [
        { connectors: { CCS: { power_kw: 150 } } },
        { connectors: { NACS: { power_kw: 250 } } },
      ],
    };
    expect(getMaxPower(station)).toBe(250);
  });

  it('handles connectors without power_kw', () => {
    const station = {
      ev_charging_units: [
        { connectors: { CCS: {} } },
      ],
    };
    expect(getMaxPower(station)).toBe(0);
  });
});

// ── filterStations Tests ────────────────────────────────────────────
describe('filterStations', () => {
  const stations = [
    makeStation({ id: 1, status_code: 'E', state: 'CO', maximum_vehicle_class: 'HD', _maxPower: 350, ev_network: 'Tesla', facility_type: 'TRUCK_STOP', funding_sources: ['NEVI'] }),
    makeStation({ id: 2, status_code: 'P', state: 'CA', maximum_vehicle_class: 'MD', _maxPower: 150, ev_network: 'ChargePoint', facility_type: 'GAS_STATION', ev_connector_types: ['J1772COMBO'] }),
    makeStation({ id: 3, status_code: 'E', state: 'TX', maximum_vehicle_class: null, _maxPower: 50, ev_network: 'EVgo', facility_type: 'TRAVEL_CENTER' }),
    makeStation({ id: 4, status_code: 'E', state: 'CO', maximum_vehicle_class: 'HD', _maxPower: 0, ev_network: 'Tesla', facility_type: 'TRUCK_STOP', station_name: 'Pilot Travel Center' }),
  ];

  it('returns all stations with permissive filters', () => {
    const allPass = { ...defaultFilters, status: 'all', minPower: 0 };
    const result = filterStations(stations, allPass);
    expect(result.length).toBe(4);
  });

  it('default filters exclude planned and low-power stations', () => {
    // default: status=E (excludes station 2=Planned), minPower=150 (excludes station 3=50kW)
    const result = filterStations(stations, defaultFilters);
    expect(result.length).toBe(2);
  });

  it('filters by status', () => {
    const result = filterStations(stations, { ...defaultFilters, status: 'P' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by state', () => {
    const result = filterStations(stations, { ...defaultFilters, state: 'CO' });
    expect(result.length).toBe(2);
  });

  it('filters by vehicle class HD', () => {
    const result = filterStations(stations, { ...defaultFilters, vehicleClass: 'HD' });
    expect(result.length).toBe(2);
    expect(result.every(s => s.maximum_vehicle_class === 'HD')).toBe(true);
  });

  it('filters by vehicle class MD (includes HD)', () => {
    // With status=E default, station 2 (MD, Planned) is excluded
    const result = filterStations(stations, { ...defaultFilters, status: 'all', vehicleClass: 'MD' });
    expect(result.length).toBe(3); // HD + MD stations (1, 2, 4)
  });

  it('filters by connector type', () => {
    const result = filterStations(stations, { ...defaultFilters, connector: 'J1772COMBO' });
    // stations 1, 2, 4 have J1772COMBO (station 1 and 4 from default makeStation, station 2 explicitly)
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(s => s.ev_connector_types?.includes('J1772COMBO'))).toBe(true);
  });

  it('filters by min power and excludes unknown power at >150', () => {
    // minPower=200 > 150: station 4 (0kW=unknown) is excluded; station 3 (50kW) excluded; station 2 (planned) excluded by status
    const result = filterStations(stations, { ...defaultFilters, minPower: 200 });
    expect(result.length).toBe(1); // only station 1 (350kW)
    expect(result[0].id).toBe(1);
  });

  it('filters by network', () => {
    const result = filterStations(stations, { ...defaultFilters, network: 'Tesla' });
    expect(result.length).toBe(2);
  });

  it('filters by facility type', () => {
    const result = filterStations(stations, { ...defaultFilters, facility: 'TRUCK_STOP' });
    expect(result.length).toBe(2);
  });

  it('filters by funding source', () => {
    // makeStation defaults include funding_sources: ['NEVI'], so stations 1 and 4 have NEVI
    // but station 3 (50kW) gets filtered by minPower, station 2 (planned) by status
    const result = filterStations(stations, { ...defaultFilters, funding: 'NEVI' });
    expect(result.length).toBe(2); // stations 1 and 4
  });

  it('filters by search term', () => {
    const result = filterStations(stations, { ...defaultFilters, search: 'Pilot' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(4);
  });

  it('search is case insensitive', () => {
    const result = filterStations(stations, { ...defaultFilters, search: 'pilot' });
    expect(result.length).toBe(1);
  });

  it('filters favorites only', () => {
    // Use permissive base so status/power don't interfere
    const result = filterStations(stations, { ...defaultFilters, status: 'all', minPower: 0, favoritesOnly: true }, ['2', '3']);
    expect(result.length).toBe(2);
    expect(result.map(s => s.id).sort()).toEqual([2, 3]);
  });

  it('fleet mode filters for truck-accessible 150kW+', () => {
    const result = filterStations(stations, defaultFilters, [], true);
    // Station 1: HD, TRUCK_STOP, 350kW ✓
    // Station 2: MD, GAS_STATION, 150kW — not truck accessible (GAS_STATION + MD is truck accessible via vehicle class)
    // Station 3: no class, TRAVEL_CENTER, 50kW — filtered out by power
    // Station 4: HD, TRUCK_STOP, 0kW (unknown) — allowed (unknown power isn't < 150)
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(s => {
      const truckOk = ['TRUCK_STOP', 'TRAVEL_CENTER', 'REST_STOP', 'FLEET_GARAGE'].includes(s.facility_type) ||
        s.maximum_vehicle_class === 'HD' || s.maximum_vehicle_class === 'MD';
      return truckOk;
    })).toBe(true);
  });

  it('handles multiple filters combined', () => {
    const result = filterStations(stations, { ...defaultFilters, state: 'CO', vehicleClass: 'HD' });
    expect(result.length).toBe(2);
    expect(result.every(s => s.state === 'CO' && s.maximum_vehicle_class === 'HD')).toBe(true);
  });
});

// ── deduplicateStations Tests ───────────────────────────────────────
describe('deduplicateStations', () => {
  it('merges stations from multiple sources', () => {
    const s1 = { id: 1, station_name: 'A', ev_charging_units: [] };
    const s2 = { id: 1, station_name: 'A', ev_charging_units: [] };
    const s3 = { id: 2, station_name: 'B', ev_charging_units: [] };

    const result = deduplicateStations([
      { stations: [s1], source: 'mdhd' },
      { stations: [s2, s3], source: 'truck' },
    ]);

    expect(result.length).toBe(2);
    expect(result.find(s => s.id === 1)._sources).toEqual(['mdhd', 'truck']);
    expect(result.find(s => s.id === 2)._sources).toEqual(['truck']);
  });

  it('handles empty arrays', () => {
    const result = deduplicateStations([{ stations: [], source: 'mdhd' }]);
    expect(result.length).toBe(0);
  });
});

// ── buildGeoJSON Tests ──────────────────────────────────────────────
describe('buildGeoJSON', () => {
  it('builds valid GeoJSON FeatureCollection', () => {
    const stations = [makeStation()];
    const geojson = buildGeoJSON(stations);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(1);

    const feature = geojson.features[0];
    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Point');
    expect(feature.geometry.coordinates).toEqual([-104.9903, 39.7392]);
    expect(feature.properties.name).toBe('Test Station');
    expect(feature.properties.afdcId).toBe(1);
  });

  it('handles empty station array', () => {
    const geojson = buildGeoJSON([]);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(0);
  });

  it('maps status codes to readable labels', () => {
    const available = buildGeoJSON([makeStation({ status_code: 'E' })]);
    expect(available.features[0].properties.status).toBe('Available');

    const planned = buildGeoJSON([makeStation({ status_code: 'P' })]);
    expect(planned.features[0].properties.status).toBe('Planned');
  });
});

// ── findStationsNearRoute Tests ─────────────────────────────────────
describe('findStationsNearRoute', () => {
  it('finds stations near a route', () => {
    const stations = [
      makeStation({ id: 1, latitude: 39.7392, longitude: -104.9903 }), // Denver
      makeStation({ id: 2, latitude: 34.0522, longitude: -118.2437 }), // LA — far away
    ];

    // Route along I-70 near Denver
    const route = [
      [39.7, -105.0],
      [39.7, -104.5],
      [39.7, -104.0],
    ];

    const result = findStationsNearRoute(stations, route, 10);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it('returns empty for no nearby stations', () => {
    const stations = [makeStation({ latitude: 34.0522, longitude: -118.2437 })];
    const route = [[39.7, -105.0], [39.7, -104.0]];
    const result = findStationsNearRoute(stations, route, 5);
    expect(result.length).toBe(0);
  });
});

// ── parseHashState Tests ────────────────────────────────────────────
describe('parseHashState', () => {
  it('returns null for empty hash', () => {
    expect(parseHashState('')).toBeNull();
    expect(parseHashState(null)).toBeNull();
  });

  it('parses map position', () => {
    const state = parseHashState('#lat=39.7392&lng=-104.9903&z=10');
    expect(state.lat).toBeCloseTo(39.7392);
    expect(state.lng).toBeCloseTo(-104.9903);
    expect(state.zoom).toBe(10);
  });

  it('rejects invalid coordinates', () => {
    const state = parseHashState('#lat=999&lng=-104&z=10');
    expect(state.lat).toBeUndefined();
  });

  it('rejects invalid zoom', () => {
    const state = parseHashState('#lat=39&lng=-104&z=25');
    expect(state.lat).toBeUndefined();
  });

  it('parses filter parameters', () => {
    const state = parseHashState('#vc=HD&ct=TESLA&pw=350&net=Tesla&fac=TRUCK_STOP&fund=NEVI&st=P&state=CO&q=denver&fav=1&fleet=1&sid=12345');
    expect(state.vehicleClass).toBe('HD');
    expect(state.connector).toBe('TESLA');
    expect(state.minPower).toBe(350);
    expect(state.network).toBe('Tesla');
    expect(state.facility).toBe('TRUCK_STOP');
    expect(state.funding).toBe('NEVI');
    expect(state.status).toBe('P');
    expect(state.state).toBe('CO');
    expect(state.search).toBe('denver');
    expect(state.favoritesOnly).toBe(true);
    expect(state.fleetMode).toBe(true);
    expect(state.selectedStationId).toBe('12345');
  });

  it('handles hash with leading #', () => {
    const state = parseHashState('#lat=39&lng=-104&z=5');
    expect(state.lat).toBe(39);
  });
});

// ── validateStationData Tests ───────────────────────────────────────
describe('validateStationData', () => {
  it('validates a proper station', () => {
    expect(validateStationData(makeStation())).toBe(true);
  });

  it('rejects null', () => {
    expect(validateStationData(null)).toBe(false);
  });

  it('rejects station without id', () => {
    expect(validateStationData({ latitude: 39, longitude: -104, station_name: 'A' })).toBe(false);
  });

  it('rejects station with out-of-range coordinates', () => {
    expect(validateStationData({ id: 1, latitude: 999, longitude: -104, station_name: 'A' })).toBe(false);
  });

  it('rejects station without name', () => {
    expect(validateStationData({ id: 1, latitude: 39, longitude: -104 })).toBe(false);
  });
});

// ── validateAPIResponse Tests ───────────────────────────────────────
describe('validateAPIResponse', () => {
  it('validates a proper response', () => {
    const result = validateAPIResponse({
      fuel_stations: [makeStation()],
    });
    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
  });

  it('rejects null response', () => {
    expect(validateAPIResponse(null).valid).toBe(false);
  });

  it('rejects response without fuel_stations', () => {
    expect(validateAPIResponse({}).valid).toBe(false);
  });

  it('filters out invalid stations', () => {
    const result = validateAPIResponse({
      fuel_stations: [makeStation(), { bad: true }],
    });
    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
  });
});
