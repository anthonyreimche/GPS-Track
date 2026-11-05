export interface LonLat {
  lon: number;
  lat: number;
}

/** A photo's position: what the catalogue's exif gps fields hold. */
export interface GpsFix {
  lat: number;
  lon: number;
  alt?: number;
}

interface Located {
  exif: { gpsLatitude?: number; gpsLongitude?: number };
}

export function locationOf(p: Located): LonLat | null {
  const { gpsLatitude: lat, gpsLongitude: lon } = p.exif;
  if (lat === undefined || lon === undefined) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lon, lat };
}

export function hasLocation(p: Located): boolean {
  return locationOf(p) !== null;
}
