/**
 * Map popup with site details, pipe profile chart, and temperature gradient.
 */
const OTECPopup = (() => {
    let profileChart = null;
    let activePopup = null;
    let currentMonthlyTemps = null;
    let currentPipeDepth = null;

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Temperature to color: 4C or less = deep blue, 30C or more = red
    function tempToColor(temp) {
        const t = Math.max(4, Math.min(30, temp));
        const ratio = (t - 4) / (30 - 4); // 0 = cold, 1 = hot

        // Blue (cold) -> Cyan -> Green -> Yellow -> Red (hot)
        let r, g, b;
        if (ratio < 0.25) {
            const f = ratio / 0.25;
            r = 0; g = Math.round(80 * f); b = Math.round(180 + 75 * f);
        } else if (ratio < 0.5) {
            const f = (ratio - 0.25) / 0.25;
            r = 0; g = Math.round(80 + 175 * f); b = Math.round(255 - 155 * f);
        } else if (ratio < 0.75) {
            const f = (ratio - 0.5) / 0.25;
            r = Math.round(255 * f); g = 255; b = Math.round(100 - 100 * f);
        } else {
            const f = (ratio - 0.75) / 0.25;
            r = 255; g = Math.round(255 - 200 * f); b = 0;
        }
        return `rgb(${r},${g},${b})`;
    }

    // Interpolate temperature at depth using a thermocline model
    // Tropical thermocline: surface mixed layer (~0-50m), steep drop (50-300m), gradual below
    function tempAtDepth(surfaceTemp, deepTemp, depth, maxDepth) {
        if (depth <= 0) return surfaceTemp;
        if (depth >= maxDepth) return deepTemp;

        const ratio = depth / maxDepth;
        // Sigmoid-like thermocline: most temperature drop between 5-30% of depth
        const thermocline = 1 / (1 + Math.exp(-12 * (ratio - 0.15)));
        return surfaceTemp + (deepTemp - surfaceTemp) * thermocline;
    }

    function buildMetricsHTML(props) {
        const coords = [props.deep_lon || 0, props.deep_lat || 0];
        const rows = [
            ['Distance to 1000m', `${props.dist_1000m_km.toFixed(1)} km`],
        ];

        if (props.pipe_length_km !== undefined) {
            rows.push(['Pipe length', `${props.pipe_length_km.toFixed(1)} km`]);
        }
        if (props.route_reversals !== undefined) {
            rows.push(['Reversals', props.route_reversals]);
        }
        if (props.route_max_gradient_deg !== undefined) {
            rows.push(['Max gradient', `${props.route_max_gradient_deg.toFixed(1)}\u00B0`]);
        }
        if (props.delta_t_min !== undefined) {
            rows.push(['\u0394T worst', `${props.delta_t_min.toFixed(1)} \u00B0C`]);
        }
        if (props.delta_t_max !== undefined) {
            rows.push(['\u0394T best', `${props.delta_t_max.toFixed(1)} \u00B0C`]);
        }
        if (props.max_current_ms !== undefined) {
            rows.push(['Max current', `${props.max_current_ms.toFixed(2)} m/s`]);
        }

        return rows.map(([label, value]) =>
            `<div class="popup-metric">
                <span class="popup-metric-label">${label}</span>
                <span class="popup-metric-value">${value}</span>
            </div>`
        ).join('');
    }

    function buildPopupHTML(props) {
        const title = props.country || props.country_code || `Site ${props.id}`;
        const subtitle = props.name || '';
        const metricsHTML = buildMetricsHTML(props);
        const hasTempData = props.monthly_temps !== undefined;

        let tabs = `<div class="popup-tab active" data-tab="profile">Pipe Profile</div>`;
        if (hasTempData) {
            tabs += `<div class="popup-tab" data-tab="temperature">Temperature</div>`;
        }

        let tempTabContent = '';
        if (hasTempData) {
            const nMonths = props.monthly_temps.length;
            const sliderMax = nMonths - 1;
            const tickLabels = nMonths === 12 ? MONTHS : props.monthly_temps.map((_, i) => `M${i + 1}`);
            tempTabContent = `
                <div class="popup-chart-tab" id="popup-tab-temperature" style="display:none">
                    <div class="temp-panel">
                        <div class="temp-gradient-col">
                            <div class="temp-gradient-label">0m</div>
                            <canvas id="popup-temp-gradient" width="50" height="160"></canvas>
                            <div class="temp-gradient-label" id="temp-depth-label">-1000m</div>
                        </div>
                        <div class="temp-info-col">
                            <div class="temp-month-name" id="temp-month-name">January</div>
                            <div class="temp-reading">
                                <span class="temp-dot" style="background:#ff4136"></span>
                                Surface: <strong id="temp-surface">--</strong> \u00B0C
                            </div>
                            <div class="temp-reading">
                                <span class="temp-dot" style="background:#0074d9"></span>
                                Deep: <strong id="temp-deep">--</strong> \u00B0C
                            </div>
                            <div class="temp-delta">
                                \u0394T = <strong id="temp-delta">--</strong> \u00B0C
                            </div>
                            <div class="temp-delta-bar-container">
                                <div class="temp-delta-bar" id="temp-delta-bar"></div>
                            </div>
                            <div class="temp-viability" id="temp-viability"></div>
                        </div>
                    </div>
                    <div class="temp-slider-row">
                        <input type="range" id="temp-month-slider" min="0" max="${sliderMax}" value="0" step="1">
                        <div class="temp-month-ticks">
                            ${tickLabels.map(m => `<span>${m}</span>`).join('')}
                        </div>
                    </div>
                </div>`;
        }

        return `
            <div class="popup-container">
                <div class="popup-header">
                    <div class="popup-title">${title}</div>
                    ${subtitle ? `<div class="popup-location">${subtitle}</div>` : ''}
                    <div class="popup-coords">${props._coords ? `${props._coords[1].toFixed(4)}, ${props._coords[0].toFixed(4)}` : ''} &middot; ${props.id}</div>
                </div>
                <div class="popup-metrics">${metricsHTML}</div>
                <div class="popup-tabs">${tabs}</div>
                <div class="popup-chart-area">
                    <div class="popup-chart-tab" id="popup-tab-profile">
                        <canvas id="popup-profile-chart" width="460" height="180"></canvas>
                        <div class="popup-chart-empty" id="popup-profile-empty" style="display:none">
                            No pipe route data available
                        </div>
                    </div>
                    ${tempTabContent}
                </div>
            </div>
        `;
    }

    function renderProfileChart(profileData) {
        const canvas = document.getElementById('popup-profile-chart');
        const emptyMsg = document.getElementById('popup-profile-empty');
        if (!canvas) return;

        if (!profileData || !profileData.points || profileData.points.length === 0) {
            canvas.style.display = 'none';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }

        canvas.style.display = 'block';
        if (emptyMsg) emptyMsg.style.display = 'none';

        const points = profileData.points;
        const distances = points.map(p => p.d);
        const depths = points.map(p => p.z);

        if (profileChart) profileChart.destroy();

        // Build {x, y} data for scatter/line (numeric x-axis)
        const profileXY = points.map(p => ({ x: p.d, y: p.z }));
        const reversalXY = points
            .filter(p => p.flag === 'reversal')
            .map(p => ({ x: p.d, y: p.z }));

        profileChart = new Chart(canvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Seafloor depth',
                    data: profileXY,
                    borderColor: '#0074d9',
                    backgroundColor: 'rgba(0, 116, 217, 0.15)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2,
                    showLine: true,
                }, {
                    label: 'Reversals',
                    data: reversalXY,
                    pointBackgroundColor: '#ff4136',
                    pointBorderColor: '#ff4136',
                    pointRadius: 5,
                    showLine: false,
                }],
            },
            options: {
                responsive: false,
                animation: { duration: 300 },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Distance from shore (km)', font: { size: 11 } },
                        ticks: { font: { size: 10 }, maxTicksLimit: 6 },
                        min: 0,
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: 'Depth (m)', font: { size: 11 } },
                        ticks: { font: { size: 10 } },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => `${Number(items[0].label).toFixed(1)} km from shore`,
                            label: (item) => `Depth: ${item.parsed.y} m`,
                        },
                    },
                },
            },
        });
    }

    function drawTempGradient(monthIdx) {
        const canvas = document.getElementById('popup-temp-gradient');
        if (!canvas || !currentMonthlyTemps) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const data = currentMonthlyTemps[monthIdx];
        const pipeDepth = Math.abs(currentPipeDepth || 1000);

        ctx.clearRect(0, 0, w, h);

        // Draw vertical gradient bar
        const barX = 8;
        const barW = 34;
        const barY = 0;
        const barH = h;

        for (let y = 0; y < barH; y++) {
            const depthAtY = (y / barH) * pipeDepth;
            const temp = tempAtDepth(data.surface, data.deep, depthAtY, pipeDepth);
            ctx.fillStyle = tempToColor(temp);
            ctx.fillRect(barX, barY + y, barW, 1);
        }

        // Border
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Thermocline indicator (where the steepest drop is, ~15% of depth)
        const thermoclineY = barY + barH * 0.15;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(barX, thermoclineY);
        ctx.lineTo(barX + barW, thermoclineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Update depth label
        const depthLabel = document.getElementById('temp-depth-label');
        if (depthLabel) depthLabel.textContent = `${pipeDepth}m`;

        // Update info panel
        const monthName = currentMonthlyTemps.length === 12 ? MONTHS[monthIdx] : `Month ${monthIdx + 1}`;
        document.getElementById('temp-month-name').textContent = monthName;
        document.getElementById('temp-surface').textContent = data.surface.toFixed(1);
        document.getElementById('temp-deep').textContent = data.deep.toFixed(1);
        document.getElementById('temp-delta').textContent = data.delta_t.toFixed(1);

        // Delta-T bar (visual indicator, 0-30C range)
        const deltaBar = document.getElementById('temp-delta-bar');
        const barPct = Math.min(100, (data.delta_t / 30) * 100);
        deltaBar.style.width = `${barPct}%`;
        deltaBar.style.background = data.delta_t >= 24 ? '#2ecc40' :
            data.delta_t >= 22 ? '#ccbb00' :
            data.delta_t >= 20 ? '#ff851b' : '#ff4136';

        // Viability text
        const viability = document.getElementById('temp-viability');
        if (data.delta_t >= 24) {
            viability.textContent = 'Excellent for OTEC';
            viability.style.color = '#2ecc40';
        } else if (data.delta_t >= 22) {
            viability.textContent = 'Good for OTEC';
            viability.style.color = '#b8a000';
        } else if (data.delta_t >= 20) {
            viability.textContent = 'Marginal for OTEC';
            viability.style.color = '#ff851b';
        } else {
            viability.textContent = 'Poor for OTEC';
            viability.style.color = '#ff4136';
        }
    }

    function wireTabEvents() {
        const tabs = document.querySelectorAll('.popup-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.getAttribute('data-tab');
                document.querySelectorAll('.popup-chart-tab').forEach(ct => {
                    ct.style.display = 'none';
                });
                const el = document.getElementById(`popup-tab-${target}`);
                if (el) el.style.display = 'block';

                // Draw gradient when switching to temperature tab
                if (target === 'temperature' && currentMonthlyTemps) {
                    const slider = document.getElementById('temp-month-slider');
                    drawTempGradient(slider ? parseInt(slider.value) : 0);
                }
            });
        });
    }

    function wireTempSlider() {
        const slider = document.getElementById('temp-month-slider');
        if (!slider) return;
        slider.addEventListener('input', () => {
            drawTempGradient(parseInt(slider.value));
        });
    }

    function createFloatingPanel() {
        let panel = document.getElementById('otec-floating-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'otec-floating-panel';
            panel.className = 'floating-panel hidden';
            document.body.appendChild(panel);
        }
        return panel;
    }

    function makeDraggable(panel) {
        const header = panel.querySelector('.floating-panel-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            // Don't drag when clicking the close button
            if (e.target.classList.contains('floating-panel-close')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = `${startLeft + dx}px`;
            panel.style.top = `${startTop + dy}px`;
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            panel.style.transition = '';
        });
    }

    async function open(map, feature, latlng) {
        cleanup();

        const props = feature.properties;
        props._coords = feature.geometry.coordinates;
        const contentHTML = buildPopupHTML(props);

        currentMonthlyTemps = props.monthly_temps || null;
        currentPipeDepth = null;

        const panel = createFloatingPanel();
        panel.innerHTML = `
            <div class="floating-panel-header">
                <button class="floating-panel-close">&times;</button>
            </div>
            <div class="floating-panel-body">${contentHTML}</div>
        `;
        panel.classList.remove('hidden');
        activePopup = panel;

        // Position at top-right of map
        panel.style.right = '20px';
        panel.style.top = '60px';
        panel.style.left = 'auto';

        makeDraggable(panel);

        // Close button
        panel.querySelector('.floating-panel-close').addEventListener('click', () => {
            cleanup();
        });

        // Wire interactions
        wireTabEvents();
        wireTempSlider();

        // Load and render pipe profile from bundle
        try {
            const siteNum = parseInt(props.id.split('_')[1]);
            const bundleIdx = Math.floor(siteNum / 500);
            const bundleFile = `data/profile_bundles/bundle_${String(bundleIdx).padStart(4, '0')}.json`;
            const resp = await fetch(bundleFile);
            if (resp.ok) {
                const bundle = await resp.json();
                const profile = bundle[props.id];
                if (!profile) { renderProfileChart(null); return; }
                renderProfileChart(profile);
                OTECMap.showRoute(profile.points);

                // Get the actual pipe endpoint depth for the temperature gradient
                if (profile.points && profile.points.length > 0) {
                    currentPipeDepth = profile.points[profile.points.length - 1].z;
                }
            } else {
                renderProfileChart(null);
            }
        } catch (e) {
            renderProfileChart(null);
        }
    }

    function cleanup() {
        if (profileChart) { profileChart.destroy(); profileChart = null; }
        currentMonthlyTemps = null;
        currentPipeDepth = null;
        if (activePopup) {
            activePopup.classList.add('hidden');
            activePopup = null;
        }
        OTECMap.clearRoute();
    }

    return { open, cleanup };
})();
