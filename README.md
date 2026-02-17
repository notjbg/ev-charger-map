# ⚡ ChargeFleet — Commercial EV Charger Map

Interactive map of public DC fast charging stations for medium and heavy-duty electric vehicles across the United States.

**[→ Live Demo](https://notjbg.github.io/ev-charger-map/)**

## Why This Exists

The medium and heavy-duty EV market is accelerating, but fleet operators still can't easily find chargers that can actually serve their vehicles. Existing tools (AFDC locator, PlugShare, ChargeHub) mix passenger and commercial infrastructure, making it hard to plan routes for Class 3-8 vehicles.

ChargeFleet surfaces only the stations that matter for commercial fleets: high-power DCFC, truck-accessible facilities, NEVI corridor chargers, and stations explicitly tagged for MD/HD vehicles.

## Features

- **2,700+ commercial-relevant stations** aggregated from AFDC data
- **Station detail panel** — slide-out panel with connector badges, hours indicator, truck access, directions, and save functionality
- **Fleet Mode** 🚛 — one-click filter for truck-accessible 150kW+ stations with estimated charge times for Tesla Semi, eCascadia, and Volvo VNR Electric
- **Route corridor search** — find stations along any US highway with gap analysis and spacing metrics
- **Popular corridors** — quick-search pills for I-5, I-10, I-15, I-40, I-70, I-80, I-90, I-95
- **Smart filtering** by vehicle class (MD/HD), connector type (NACS, CCS, CHAdeMO, MCS), power level, network, facility type, and federal funding source
- **Data freshness badge** — shows when AFDC data was last updated
- **Heatmap view** — toggle between markers and heat overlay for density analysis
- **Marker clustering** with color-coded power levels and vehicle class indicators
- **Station details** with pricing, hours, directions, port counts
- **Location search** with geocoding and "Near Me" geolocation
- **GeoJSON & CSV export** of filtered results for fleet planning
- **Shareable URLs** with map position and filter state preserved in the hash
- **Statistics dashboard** — HD/MD/NEVI/MCS/planned station counts
- **Favorites** — save stations locally for quick access
- **Dark mode** with glassmorphism UI
- **Mobile responsive** — works on phone, tablet, desktop
- **PWA support** — installable as a standalone app
- **Zero dependencies** — single HTML file, no build tools, no frameworks

## Data Sources

| Source | What It Captures |
|--------|-----------------|
| AFDC MD/HD tagged | Stations explicitly marked for medium/heavy-duty vehicles |
| Truck stops & travel centers | DCFC at truck-accessible facilities |
| NEVI/CFI funded | Federal highway corridor charging infrastructure |
| 350kW+ stations | Ultra-fast chargers capable of serving commercial vehicles |

All data from the [AFDC Alternative Fuel Station Locator API](https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/) (U.S. Department of Energy).

## Connector Types

| Code | Standard | Use Case |
|------|----------|----------|
| NACS | J3400 (formerly Tesla) | Increasingly adopted by truck OEMs |
| CCS | SAE J1772 Combo | Current standard for most MD/HD EVs |
| CHAdeMO | CHAdeMO | Legacy, declining for new deployments |
| MCS | J3271 Megawatt Charging | Emerging standard for HD trucks (1MW+) |

## Tech Stack

- Vanilla HTML/CSS/JavaScript (single file, ~3,100 lines)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles
- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for heatmap view
- AFDC API with localStorage caching (6h TTL)

## Usage

Open `index.html` in a browser. That's it.

To self-host or deploy:
```bash
# GitHub Pages (this repo)
git push origin main

# Any static host
cp index.html /your/web/root/
```

## API Key

The app uses a real NREL API key (1,000 requests/hour). For your own deployment, get a free key at [developer.nrel.gov/signup](https://developer.nrel.gov/signup/) and replace the key in the source.

## License

MIT

## Author

Built by [Jonah Berg](https://github.com/notjbg) — Senior Manager, Strategic Communications at TRC Companies, Clean Transportation Solutions.
