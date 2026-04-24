// Weather card fetched from Open-Meteo (free, no API key).
// Shows: temperature, wind speed + direction, condition icon.
// Wind speed highlighted red if > 20 km/h (material impact on club choice).
import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSun, Snowflake, Wind, Thermometer } from 'lucide-react';

// Open-Meteo WMO weather codes → icon + label
function iconFor(code) {
  if (code === 0)              return { Icon: Sun,       label: 'Clear' };
  if (code >= 1 && code <= 2)  return { Icon: CloudSun,  label: 'Partly cloudy' };
  if (code === 3)              return { Icon: Cloud,     label: 'Overcast' };
  if (code >= 51 && code <= 67) return { Icon: CloudRain, label: 'Rain' };
  if (code >= 71 && code <= 77) return { Icon: Snowflake, label: 'Snow' };
  if (code >= 80 && code <= 99) return { Icon: CloudRain, label: 'Storms' };
  return { Icon: Cloud, label: 'Clouds' };
}

function degToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round((deg % 360) / 45) % 8];
}

/**
 * Fetches weather for {lat, lng}. Renders null while loading or on error.
 * Caches in sessionStorage for 30 min (no point refetching the same course).
 */
export default function WeatherCard({ lat, lng }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!lat || !lng) return;
    const key = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.fetched_at < 30 * 60 * 1000) {
          setData(parsed.data);
          return;
        }
      }
    } catch { /* ignore */ }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m` +
      `&wind_speed_unit=kmh&temperature_unit=celsius`;
    fetch(url).then(r => r.json()).then(j => {
      const cur = j?.current;
      if (!cur) return;
      const wx = {
        temp: Math.round(cur.temperature_2m),
        wind_kmh: Math.round(cur.wind_speed_10m),
        wind_dir: cur.wind_direction_10m,
        code: cur.weather_code,
      };
      setData(wx);
      try { sessionStorage.setItem(key, JSON.stringify({ data: wx, fetched_at: Date.now() })); } catch { /* ignore */ }
    }).catch(() => {});
  }, [lat, lng]);

  if (!data) return null;
  const { Icon, label } = iconFor(data.code);
  const windyAlert = data.wind_kmh > 20;

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#1B3C35]/5 border border-[#E2E3DD]"
      data-testid="weather-card">
      <Icon className="h-5 w-5 text-[#1B3C35] shrink-0" />
      <span className="text-sm font-bold text-[#1B3C35] tabular-nums">{data.temp}°C</span>
      <span className="text-xs text-[#6B6E66]">·</span>
      <Wind className={`h-3.5 w-3.5 shrink-0 ${windyAlert ? 'text-[#C96A52]' : 'text-[#6B6E66]'}`} />
      <span className={`text-xs tabular-nums ${windyAlert ? 'text-[#C96A52] font-bold' : 'text-[#6B6E66]'}`}>
        {data.wind_kmh} km/h {degToCompass(data.wind_dir)}
      </span>
      <span className="text-[10px] text-[#6B6E66] ml-auto hidden sm:inline">{label}</span>
    </div>
  );
}
