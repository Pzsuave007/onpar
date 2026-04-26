// Weather card fetched via the shared lib/conditions helper (Open-Meteo).
// Shows: temperature, wind speed + direction, condition icon.
// Wind speed highlighted red if > 12 mph (material impact on club choice).
import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSun, Snowflake, Wind } from 'lucide-react';
import { fetchConditions } from '@/lib/conditions';

// Open-Meteo WMO weather codes → icon + label
function iconFor(code) {
  if (code === 0)               return { Icon: Sun,       label: 'Clear' };
  if (code >= 1 && code <= 2)   return { Icon: CloudSun,  label: 'Partly cloudy' };
  if (code === 3)               return { Icon: Cloud,     label: 'Overcast' };
  if (code >= 51 && code <= 67) return { Icon: CloudRain, label: 'Rain' };
  if (code >= 71 && code <= 77) return { Icon: Snowflake, label: 'Snow' };
  if (code >= 80 && code <= 99) return { Icon: CloudRain, label: 'Storms' };
  return { Icon: Cloud, label: 'Clouds' };
}

function degToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round((deg % 360) / 45) % 8];
}

export default function WeatherCard({ lat, lng }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchConditions(lat, lng).then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (!data) return null;
  const { Icon, label } = iconFor(data.weather_code);
  const windyAlert = data.wind_mph > 12;

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#1B3C35]/5 border border-[#E2E3DD]"
      data-testid="weather-card">
      <Icon className="h-5 w-5 text-[#1B3C35] shrink-0" />
      <span className="text-sm font-bold text-[#1B3C35] tabular-nums">{data.temp_f}°F</span>
      <span className="text-xs text-[#6B6E66]">·</span>
      <Wind className={`h-3.5 w-3.5 shrink-0 ${windyAlert ? 'text-[#C96A52]' : 'text-[#6B6E66]'}`} />
      <span className={`text-xs tabular-nums ${windyAlert ? 'text-[#C96A52] font-bold' : 'text-[#6B6E66]'}`}>
        {data.wind_mph} mph {degToCompass(data.wind_dir)}
      </span>
      <span className="text-[10px] text-[#6B6E66] ml-auto hidden sm:inline">{label}</span>
    </div>
  );
}
