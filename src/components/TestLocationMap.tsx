import React, {useMemo} from 'react';
import {geoGraticule10, geoMercator, geoPath} from 'd3-geo';
import {MapPin} from 'lucide-react';
import {motion} from 'motion/react';
import {feature} from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';
import countriesAtlas from 'world-atlas/countries-110m.json';
import type {EdgeNode, TestLocationSummary} from '../types/speedtest';

interface TestLocationMapProps {
  location: TestLocationSummary;
  edgeNode?: EdgeNode | null;
  isDark?: boolean;
}

function formatCoord(value: number, posHemisphere: string, negHemisphere: string): string {
  const abs = Math.abs(value).toFixed(2);
  return `${abs}° ${value >= 0 ? posHemisphere : negHemisphere}`;
}

export const TestLocationMap: React.FC<TestLocationMapProps> = ({
  location,
  edgeNode = null,
  isDark = false,
}) => {
  const mapGeometry = useMemo(() => {
    const width = 240;
    const height = 112;
    const safeLat = Math.max(-75, Math.min(75, location.lat));
    const safeLon = Math.max(-180, Math.min(180, location.lon));

    const projection = geoMercator()
      .center([safeLon, safeLat])
      .scale(480)
      .translate([width / 2, height / 2]);

    const pathGenerator = geoPath(projection);
    const topology = countriesAtlas as unknown as Topology<{
      countries: GeometryCollection;
    }>;
    const countries = feature(topology, topology.objects.countries);

    const countryPaths = countries.features.map((feat, index) => ({
      id: feat.id ?? index,
      d: pathGenerator(feat) || '',
    }));

    const graticulePath = pathGenerator(geoGraticule10()) || '';
    const projectedMarker = projection([safeLon, safeLat]) ?? [width / 2, height / 2];

    const edgePoint =
      edgeNode &&
      typeof edgeNode.lat === 'number' &&
      typeof edgeNode.lon === 'number'
        ? projection([edgeNode.lon, edgeNode.lat])
        : null;

    let routePath = '';
    if (
      edgePoint &&
      edgeNode &&
      typeof edgeNode.lat === 'number' &&
      typeof edgeNode.lon === 'number'
    ) {
      routePath =
        pathGenerator({
          type: 'LineString',
          coordinates: [
            [safeLon, safeLat],
            [edgeNode.lon, edgeNode.lat],
          ],
        }) || '';
    }

    return {
      width,
      height,
      countryPaths,
      graticulePath,
      markerX: projectedMarker[0],
      markerY: projectedMarker[1],
      edgeX: edgePoint ? edgePoint[0] : null,
      edgeY: edgePoint ? edgePoint[1] : null,
      routePath,
    };
  }, [edgeNode, location.lat, location.lon]);

  const placeLabel = [location.city, location.region, location.country]
    .filter((part, idx, arr) => Boolean(part) && arr.indexOf(part) === idx)
    .join(', ');

  const coordLabel = `${formatCoord(location.lat, 'N', 'S')}, ${formatCoord(location.lon, 'E', 'W')}`;
  const radiusLabel = `~${location.accuracyKm ?? 2} km region`;

  return (
    <motion.div
      initial={{opacity: 0, y: 6}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
      aria-label="Test location approximate region map"
      className="border-b border-[#DFDAD0] dark:border-[#1E2942] bg-white/80 dark:bg-[#0D1322] px-6 py-4 sm:px-8"
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <MapPin
            className="h-4 w-4 text-[#1D4ED8] dark:text-[#38BDF8] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-stone-900 dark:text-slate-100">
                Test Location
              </span>
              <span className="text-stone-300 dark:text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-medium text-stone-600 dark:text-slate-300 truncate">
                {placeLabel || 'Approximate Region'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-stone-500 dark:text-slate-400 tabular-nums">
              <span>{coordLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{radiusLabel}</span>
              {edgeNode &&
                edgeNode.distanceKm !== undefined &&
                edgeNode.distanceKm !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      ~{edgeNode.distanceKm.toLocaleString()} km to {edgeNode.label}
                    </span>
                  </>
                )}
            </div>
          </div>
        </div>

        <div className="relative w-full sm:w-56 h-24 shrink-0 overflow-hidden rounded-lg border border-[#DFDAD0] dark:border-[#1E2942] bg-[#EAE6DD] dark:bg-[#060913]">
          <svg
            viewBox={`0 0 ${mapGeometry.width} ${mapGeometry.height}`}
            className="h-full w-full block"
            role="img"
            aria-label={`Map centered near ${placeLabel || coordLabel}`}
          >
            <rect
              width={mapGeometry.width}
              height={mapGeometry.height}
              fill={isDark ? '#060A17' : '#EAE6DD'}
            />
            {mapGeometry.graticulePath && (
              <path
                d={mapGeometry.graticulePath}
                fill="none"
                stroke={isDark ? '#151E34' : '#DDD7CB'}
                strokeWidth={0.5}
              />
            )}
            <g>
              {mapGeometry.countryPaths.map((c) => (
                <path
                  key={c.id}
                  d={c.d}
                  fill={isDark ? '#18243E' : '#CFC8BA'}
                  stroke={isDark ? '#2B3B5E' : '#F8F7F4'}
                  strokeWidth={0.6}
                />
              ))}
            </g>

            {mapGeometry.routePath && (
              <path
                d={mapGeometry.routePath}
                fill="none"
                stroke={isDark ? '#38BDF8' : '#1D4ED8'}
                strokeOpacity={0.6}
                strokeWidth={1.1}
                strokeDasharray="3 2.5"
              />
            )}

            {mapGeometry.edgeX !== null &&
              mapGeometry.edgeY !== null &&
              mapGeometry.edgeX >= -10 &&
              mapGeometry.edgeX <= mapGeometry.width + 10 &&
              mapGeometry.edgeY >= -10 &&
              mapGeometry.edgeY <= mapGeometry.height + 10 && (
                <circle
                  cx={mapGeometry.edgeX}
                  cy={mapGeometry.edgeY}
                  r={3}
                  fill={isDark ? '#A3E635' : '#65A30D'}
                  stroke={isDark ? '#060913' : '#FFFFFF'}
                  strokeWidth={1}
                />
              )}

            {/* Approximate region privacy halo */}
            <circle
              cx={mapGeometry.markerX}
              cy={mapGeometry.markerY}
              r={18}
              fill={isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(29, 78, 216, 0.14)'}
              stroke={isDark ? 'rgba(56, 189, 248, 0.55)' : 'rgba(29, 78, 216, 0.45)'}
              strokeWidth={1}
              strokeDasharray="2.5 2"
            />

            {/* Pulsing beacon */}
            <motion.circle
              cx={mapGeometry.markerX}
              cy={mapGeometry.markerY}
              r={7}
              fill="none"
              stroke={isDark ? '#38BDF8' : '#1D4ED8'}
              strokeWidth={1.5}
              initial={{scale: 0.7, opacity: 0.85}}
              animate={{scale: 2.1, opacity: 0}}
              transition={{duration: 2.1, repeat: Infinity, ease: 'easeOut'}}
              style={{
                transformOrigin: `${mapGeometry.markerX}px ${mapGeometry.markerY}px`,
              }}
            />

            {/* Primary Test Location marker dot */}
            <circle
              cx={mapGeometry.markerX}
              cy={mapGeometry.markerY}
              r={4.5}
              fill={isDark ? '#38BDF8' : '#1D4ED8'}
              stroke={isDark ? '#060913' : '#FFFFFF'}
              strokeWidth={1.6}
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );
};
