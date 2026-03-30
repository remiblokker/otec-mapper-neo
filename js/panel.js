/**
 * Side panel for site details.
 */
const OTECPanel = (() => {
    const panel = () => document.getElementById('panel');
    const title = () => document.getElementById('panel-title');
    const metrics = () => document.getElementById('panel-metrics');

    function show(feature) {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        title().textContent = props.name || `Site ${props.id}`;

        const rows = [
            ['Location', `${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}`],
            ['Distance to 1000m', `${props.dist_1000m_km.toFixed(1)} km`],
        ];

        if (props.pipe_length_km !== undefined) {
            rows.push(['Pipe route length', `${props.pipe_length_km.toFixed(1)} km`]);
        }
        if (props.delta_t_min !== undefined) {
            rows.push(['Min \u0394T (worst month)', `${props.delta_t_min.toFixed(1)} \u00B0C`]);
            rows.push(['Worst month', props.delta_t_worst_month || '-']);
        }
        if (props.route_reversals !== undefined) {
            rows.push(['Route reversals', props.route_reversals]);
        }
        if (props.route_max_gradient_deg !== undefined) {
            rows.push(['Max gradient', `${props.route_max_gradient_deg.toFixed(1)}\u00B0`]);
        }
        if (props.max_current_ms !== undefined) {
            rows.push(['Max cross-current', `${props.max_current_ms.toFixed(2)} m/s`]);
        }
        if (props.score !== undefined) {
            rows.push(['Overall score', `${props.score}/100`]);
        }

        metrics().innerHTML = rows.map(([label, value]) =>
            `<div class="metric">
                <span class="metric-label">${label}</span>
                <span class="metric-value">${value}</span>
            </div>`
        ).join('');

        panel().classList.remove('hidden');
    }

    function hide() {
        panel().classList.add('hidden');
        OTECProfile.clear();
        OTECMap.clearRoute();
    }

    function init() {
        document.getElementById('panel-close').addEventListener('click', hide);
    }

    return { init, show, hide };
})();
