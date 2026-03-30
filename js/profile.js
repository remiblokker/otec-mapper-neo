/**
 * Pipe route depth profile chart using Chart.js.
 */
const OTECProfile = (() => {
    let chart = null;

    function render(profileData) {
        const ctx = document.getElementById('profile-chart');
        if (!ctx) return;

        if (chart) {
            chart.destroy();
        }

        if (!profileData || !profileData.points || profileData.points.length === 0) {
            return;
        }

        const points = profileData.points;
        const distances = points.map(p => p.d);
        const depths = points.map(p => p.z);

        // Separate normal vs reversal points for coloring
        const reversalIndices = new Set();
        points.forEach((p, i) => {
            if (p.flag === 'reversal') reversalIndices.add(i);
        });

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: distances,
                datasets: [{
                    label: 'Depth (m)',
                    data: depths,
                    borderColor: '#0074d9',
                    backgroundColor: 'rgba(0, 116, 217, 0.1)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0,
                    borderWidth: 2,
                }, {
                    label: 'Gradient reversals',
                    data: points.map((p, i) => reversalIndices.has(i) ? p.z : null),
                    pointBackgroundColor: '#ff4136',
                    pointRadius: 4,
                    showLine: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Distance from shore (km)' },
                        ticks: {
                            callback: v => typeof v === 'number' ? v.toFixed(1) : v,
                            maxTicksLimit: 8,
                        },
                    },
                    y: {
                        title: { display: true, text: 'Depth (m)' },
                        reverse: false,
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => `${Number(items[0].label).toFixed(1)} km`,
                            label: (item) => `${item.parsed.y} m`,
                        },
                    },
                },
            },
        });
    }

    function clear() {
        if (chart) {
            chart.destroy();
            chart = null;
        }
    }

    return { render, clear };
})();
