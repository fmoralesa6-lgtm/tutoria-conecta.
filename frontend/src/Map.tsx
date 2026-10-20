import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
function Click({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30] });
    else if (points.length) map.setView(points[0], 13);
  }, [JSON.stringify(points)]);
  return null;
}
export default function Map({
  lat = 14.6349,
  lng = -90.5069,
  onChange,
  route,
}: {
  lat?: number;
  lng?: number;
  onChange?: (lat: number, lng: number) => void;
  route?: number[][] | null;
}) {
  const points: [number, number][] = route
    ? route.map((p) => [p[1], p[0]])
    : [[lat, lng]];
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      scrollWheelZoom={false}
      className="map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onChange && <Click onChange={onChange} />}
      <Fit points={points} />
      <CircleMarker center={points[0]} radius={8} />
      {route && (
        <>
          <CircleMarker center={points[points.length - 1]} radius={8} />
          <Polyline positions={points} />
        </>
      )}
    </MapContainer>
  );
}
