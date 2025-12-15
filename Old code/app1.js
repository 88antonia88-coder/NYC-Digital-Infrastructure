mapboxgl.accessToken = 'pk.eyJ1IjoiYW50b25pYXNpbW9uODg4OCIsImEiOiJjbWlnOWpuZmYwNTFlM2dwZmkydGNzenBvIn0.2dTGBudoCFSm2W4JAEbOeg';

// Create the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-73.985, 40.75],
  zoom: 11,
});

map.on('load', () => {
  // Add the GeoJSON source
  map.addSource('digitalInfra', {
    type: 'geojson',
    data: 'data/all_digInf.geojson'
  });

  // Add a layer (all points)
  map.addLayer({
    id: 'infra-points',
    type: 'circle',
    source: 'digitalInfra',
    paint: {
      'circle-radius': 5,
      "circle-color": [
        "match",
        ["get", "System"],
        "Wifi Hotspots", "#434db9",
        "LinkNYC", "#3e9cfe",
        "Citi Bike", "#48f882",
        "OMNY", "#e2dc38",
        "TAPP", "#ef5911",
        "#0f0f0f"
      ],
      "circle-opacity": 0
    }
  });

  // Start with no points visible
  map.setFilter('infra-points', ['<=', ['get', 'year'], 0]);
});

// --- SCROLL MAGIC ---
const yearSections = document.querySelectorAll('.year-section');
const scrollTrack = document.getElementById('scroll-track');

scrollTrack.addEventListener('scroll', () => {
  let activeYearDiv = null;

  yearSections.forEach(section => {
    const rect = section.getBoundingClientRect();
    // section is active in the middle of the viewport
    if (rect.top < window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5) {
      activeYearDiv = section;
    }
  });

  if (activeYearDiv) {
    yearSections.forEach(s => s.classList.remove('active'));
    activeYearDiv.classList.add('active');

    const year = parseInt(activeYearDiv.dataset.year);
    
    // Show all points with year <= current scroll year
    map.setFilter("infra-points", ["<=", ["get", "year"], year]);
    
    // Fade points in as they appear
    map.setPaintProperty('infra-points', 'circle-opacity', 0.8);
  }
});