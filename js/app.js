/**
 * OTEC Mapper Neo - main application entry.
 */
(async function () {
    // Initialize map
    const map = OTECMap.init();

    // Load site markers
    OTECSites.setClickHandler(async (feature, latlng) => {
        await OTECPopup.open(map, feature, latlng);
    });

    await OTECSites.load(map);

    // Filter controls
    const distSlider = document.getElementById('filter-distance');
    const distVal = document.getElementById('filter-distance-val');
    const dtSlider = document.getElementById('filter-delta-t');
    const dtVal = document.getElementById('filter-delta-t-val');

    function applyFilters() {
        const maxDist = Number(distSlider.value);
        const minDT = Number(dtSlider.value);
        distVal.textContent = `${maxDist} km`;
        dtVal.textContent = `${minDT} \u00B0C`;
        OTECSites.filter(maxDist, minDT);
    }

    distSlider.addEventListener('input', applyFilters);
    dtSlider.addEventListener('input', applyFilters);

    // About modal
    const aboutModal = document.getElementById('about-modal');
    document.getElementById('about-link').addEventListener('click', (e) => {
        e.preventDefault();
        aboutModal.classList.remove('hidden');
    });
    aboutModal.querySelector('.modal-close').addEventListener('click', () => {
        aboutModal.classList.add('hidden');
    });
    aboutModal.addEventListener('click', (e) => {
        if (e.target === aboutModal) aboutModal.classList.add('hidden');
    });
})();
