import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom violet marker icon (SVG data URI — no external assets needed)
const markerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#7c3aed"/>
      <circle cx="14" cy="14" r="6" fill="white"/>
    </svg>
  `),
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
});

// Hardcoded coordinates for known Indian destinations
const KNOWN_COORDS: Record<string, [number, number]> = {
  goa: [15.2993, 74.124],
  manali: [32.2396, 77.1887],
  kerala: [10.8505, 76.2711],
  rishikesh: [30.0869, 78.2676],
  jaipur: [26.9124, 75.7873],
  ladakh: [34.1526, 77.5771],
  coorg: [12.3375, 75.8069],
  andaman: [11.7401, 92.6586],
  pondicherry: [11.9416, 79.8083],
  delhi: [28.6139, 77.209],
  mumbai: [19.076, 72.8777],
  kolkata: [22.5726, 88.3639],
  chennai: [13.0827, 80.2707],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  hyderabad: [17.385, 78.4867],
  agra: [27.1767, 78.0081],
  varanasi: [25.3176, 83.0064],
  udaipur: [24.5854, 73.7125],
  shimla: [31.1048, 77.1734],
  darjeeling: [27.0360, 88.2627],
  mysore: [12.2958, 76.6394],
  mysuru: [12.2958, 76.6394],
  ooty: [11.4102, 76.6950],
  munnar: [10.0889, 77.0595],
  hampi: [15.335, 76.46],
  amritsar: [31.634, 74.8723],
  jodhpur: [26.2389, 73.0243],
  pushkar: [26.4899, 74.5542],
  leh: [34.1526, 77.5771],
};

// Default center (India)
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const DESTINATION_ZOOM = 11;

/** Fly the map to new coordinates when they change */
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

interface DestinationMapProps {
  destination: string;
  className?: string;
}

export default function DestinationMap({ destination, className = 'h-48 w-full' }: DestinationMapProps) {
  const [geocoded, setGeocoded] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const trimmed = destination.trim().toLowerCase();

  // Check hardcoded coords first
  const knownCoord = useMemo(() => KNOWN_COORDS[trimmed] ?? null, [trimmed]);

  // Geocode unknown destinations via Nominatim (debounced)
  useEffect(() => {
    if (knownCoord || !trimmed) {
      setGeocoded(null);
      return;
    }

    setGeocoding(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination.trim())}&limit=1`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = await res.json();
        if (data.length > 0) {
          setGeocoded([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
          setGeocoded(null);
        }
      } catch {
        setGeocoded(null);
      } finally {
        setGeocoding(false);
      }
    }, 600);

    return () => { clearTimeout(timeout); setGeocoding(false); };
  }, [trimmed, knownCoord, destination]);

  const center = knownCoord ?? geocoded ?? DEFAULT_CENTER;
  const zoom = (knownCoord || geocoded) ? DESTINATION_ZOOM : DEFAULT_ZOOM;
  const hasPin = !!(knownCoord || geocoded);

  return (
    <div className={`rounded-xl overflow-hidden border border-gray-200 relative ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FlyTo center={center} zoom={zoom} />
        {hasPin && (
          <Marker position={center} icon={markerIcon}>
            <Popup>
              <span className="font-medium text-sm">{destination.trim()}</span>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      {geocoding && (
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-xs text-gray-500 px-2 py-1 rounded-lg shadow-sm z-[400]">
          Locating…
        </div>
      )}
    </div>
  );
}
