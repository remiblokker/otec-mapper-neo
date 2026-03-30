/**
 * Site marker loading, rendering, and filtering.
 */
const OTECSites = (() => {
    let sitesData = null;
    let map = null;
    let allMarkers = [];  // [{marker, feature}]
    let visibleGroup;
    let onSiteClick = null;

    const COLORS = {
        green:  { fill: '#2ecc40', border: '#1a9c2f' },
        yellow: { fill: '#ffdc00', border: '#c4a900' },
        orange: { fill: '#ff851b', border: '#c46010' },
        red:    { fill: '#ff4136', border: '#c42f28' },
        grey:   { fill: '#cccccc', border: '#999999' },
    };

    function getColor(props) {
        if (props.pipe_length_km === undefined) return 'grey';
        const d = props.pipe_length_km;
        if (d < 4) return 'green';
        if (d < 8) return 'yellow';
        if (d < 15) return 'orange';
        return 'red';
    }

    function getRadius(zoom) {
        if (zoom <= 4) return 3;
        if (zoom <= 6) return 4;
        if (zoom <= 8) return 5;
        return 6;
    }

    async function load(leafletMap) {
        map = leafletMap;
        try {
            const resp = await fetch('data/sites.geojson');
            sitesData = await resp.json();
        } catch (e) {
            console.warn('No sites.geojson found yet. Run the pipeline first.');
            return;
        }

        visibleGroup = L.layerGroup().addTo(map);

        sitesData.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const latlng = L.latLng(coords[1], coords[0]);
            const color = getColor(feature.properties);
            const c = COLORS[color];

            const marker = L.circleMarker(latlng, {
                radius: getRadius(map.getZoom()),
                fillColor: c.fill,
                color: c.border,
                weight: 1,
                fillOpacity: color === 'grey' ? 0.4 : 0.85,
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (onSiteClick) onSiteClick(feature, e.latlng);
            });

            allMarkers.push({ marker, feature });
            visibleGroup.addLayer(marker);
        });

        // Adjust marker size on zoom
        map.on('zoomend', () => {
            const r = getRadius(map.getZoom());
            allMarkers.forEach(({ marker }) => {
                marker.setRadius(r);
            });
        });
    }

    function filter(maxDistance, minDeltaT) {
        if (!visibleGroup) return;

        allMarkers.forEach(({ marker, feature }) => {
            const props = feature.properties;
            // Use pipe route length (actual path) when available, otherwise straight-line distance
            const dist = props.pipe_length_km !== undefined ? props.pipe_length_km : props.dist_1000m_km;
            const visible = dist <= maxDistance
                && (props.delta_t_min === undefined || props.delta_t_min >= minDeltaT);

            if (visible && !visibleGroup.hasLayer(marker)) {
                visibleGroup.addLayer(marker);
            } else if (!visible && visibleGroup.hasLayer(marker)) {
                visibleGroup.removeLayer(marker);
            }
        });
    }

    function setClickHandler(fn) {
        onSiteClick = fn;
    }

    function getData() {
        return sitesData;
    }

    return { load, filter, setClickHandler, getData };
})();
