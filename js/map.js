/**
 * Map initialization and layer management.
 */
const OTECMap = (() => {
    let map;
    let routeLayer;

    function init() {
        map = L.map('map', {
            center: [0, -30],
            zoom: 3,
            minZoom: 2,
            maxZoom: 18,
            worldCopyJump: true,
        });

        // OSM as base layer (always present, full zoom range)
        L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                attribution: '&copy; OpenStreetMap contributors | Ocean: Esri, GEBCO, NOAA',
                maxZoom: 19,
            }
        ).addTo(map);

        // ESRI Ocean overlay on top (limited zoom range)
        const ocean = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
            {
                maxNativeZoom: 9,
                maxZoom: 9,
            }
        ).addTo(map);

        // Layer for pipe route polylines
        routeLayer = L.layerGroup().addTo(map);

        return map;
    }

    function getMap() {
        return map;
    }

    function showRoute(points) {
        routeLayer.clearLayers();
        if (!points || points.length === 0) return;

        const latlngs = points.map(p => [p.lat, p.lon]);

        L.polyline(latlngs, {
            color: '#0074d9',
            weight: 3,
            opacity: 0.8,
        }).addTo(routeLayer);

        // Mark reversals
        points.forEach(p => {
            if (p.flag === 'reversal') {
                L.circleMarker([p.lat, p.lon], {
                    radius: 4,
                    color: '#ff4136',
                    fillColor: '#ff4136',
                    fillOpacity: 1,
                }).addTo(routeLayer);
            }
        });
    }

    function clearRoute() {
        routeLayer.clearLayers();
    }

    return { init, getMap, showRoute, clearRoute };
})();
