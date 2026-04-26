// Shared on-course conditions helper.
// Hits Open-Meteo once per course location, caches in sessionStorage for 30 min.
// Provides: temperature (°F), wind (mph + bearing), elevation (ft), weather code.
// Used by:
//   - <WeatherCard /> for display
//   - <DistanceToGreen /> Caddie suggestion (altitude + temp adjust club distances)

const CACHE_TTL_MS = 30 * 60 * 1000;

export async function fetchConditions(lat, lng) {
  if (lat == null || lng == null) return null;
  const key = `wx2:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.fetched_at < CACHE_TTL_MS) return parsed.data;
    }
  } catch { /* ignore */ }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m` +
    `&wind_speed_unit=mph&temperature_unit=fahrenheit`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    const cur = j?.current || {};
    const elevation_m = j?.elevation;
    const data = {
      temp_f: Math.round(cur.temperature_2m),
      wind_mph: Math.round(cur.wind_speed_10m),
      wind_dir: cur.wind_direction_10m,
      weather_code: cur.weather_code,
      // Open-Meteo elevation comes in meters; convert to feet (1 m ≈ 3.281 ft)
      altitude_ft: elevation_m != null ? Math.round(elevation_m * 3.281) : null,
    };
    try { sessionStorage.setItem(key, JSON.stringify({ data, fetched_at: Date.now() })); } catch { /* ignore */ }
    return data;
  } catch {
    return null;
  }
}
