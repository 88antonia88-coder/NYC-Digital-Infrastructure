mapboxgl.accessToken = 'pk.eyJ1IjoiYW50b25pYXNpbW9uODg4OCIsImEiOiJjbWlnOWpuZmYwNTFlM2dwZmkydGNzenBvIn0.2dTGBudoCFSm2W4JAEbOeg';

// Create the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-73.985, 40.75],
  zoom: 11,
  scrollZoom: false,
  dragRotate: false,
  touchZoomRotate: false
});

// Create a popup for tooltips
const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 15
});

// View State Management
const VIEW_MODES = {
  TIMELINE: 'timeline',
  EXPLORATION: 'exploration'
};

let currentView = VIEW_MODES.TIMELINE;
let navigationControl = null;

map.on('load', () => {
  // Add the GeoJSON source
  map.addSource('digitalInfra', {
    type: 'geojson',
    data: 'all_diginf.geojson'
  });

  // Add a layer (all points)
  map.addLayer({
    id: 'infra-points',
    type: 'circle',
    source: 'digitalInfra',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 2,
        14, 4,
        18, 7
      ],
      "circle-color": [
        "match",
        ["get", "System"],
        "Wifi Hotspots", "#434db9",
        "WiFi Hotspot", "#434db9",
        "LinkNYC", "#3e9cfe",
        "Citi Bike", "#48f882",
        "OMNY", "#e2dc38",
        "TAPP", "#ef5911",
        "#360505ff"
      ],
      "circle-opacity": 0,
      "circle-stroke-width": [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 0.5,
        14, 1,
        18, 2
      ],
      "circle-stroke-color": [
        "match",
        ["get", "System"],
        "Wifi Hotspots", "#5a62d9",
        "WiFi Hotspot", "#5a62d9",
        "LinkNYC", "#5eb5ff",
        "Citi Bike", "#6affaa",
        "OMNY", "#f0ec68",
        "TAPP", "#ff7a41",
        "#2f2f2f"
      ],
      "circle-stroke-opacity": 0.9
    }
  });

  // Add buffer zones layer (initially hidden)
  map.addLayer({
    id: 'buffer-zones',
    type: 'circle',
    source: 'digitalInfra',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, ['/', ['get', 'Average Radius of Connection (ft)'], 30],
        14, ['/', ['get', 'Average Radius of Connection (ft)'], 8],
        18, ['/', ['get', 'Average Radius of Connection (ft)'], 2]
      ],
      'circle-color': [
        "match",
        ["get", "System"],
        "Wifi Hotspots", "#434db9",
        "WiFi Hotspot", "#434db9",
        "LinkNYC", "#3e9cfe",
        "Citi Bike", "#48f882",
        "OMNY", "#e2dc38",
        "TAPP", "#ef5911",
        "CCTV Camera", "#310202ff"
      ],
      'circle-opacity': 0.08,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': [
        "match",
        ["get", "System"],
        "Wifi Hotspots", "#5a62d9",
        "WiFi Hotspot", "#5a62d9",
        "LinkNYC", "#5eb5ff",
        "Citi Bike", "#6affaa",
        "OMNY", "#f0ec68",
        "TAPP", "#ff7a41",
        "#3d0505ff"
      ],
      'circle-stroke-opacity': 0.35
    },
    layout: {
      visibility: 'none'
    }
  }, 'infra-points'); // Add below points layer

  // Start with no points visible
  map.setFilter('infra-points', ['<=', ['to-number', ['get', 'year']], 0]);

  // Change cursor to pointer when hovering over points
  map.on('mouseenter', 'infra-points', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    
    const feature = e.features[0];
    const coordinates = feature.geometry.coordinates.slice();
    const properties = feature.properties;
    
    let tooltipHTML = `
      <div style="font-family: 'Urbanist', sans-serif; font-weight: 700; font-size: 0.95rem; margin-bottom: 5px; color: white;">
        ${properties.System || 'Unknown System'}
      </div>
    `;
    
    if (properties['Station Name']) {
      tooltipHTML += `
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 3px;">
          ${properties['Station Name']}
        </div>
      `;
    }
    
    if (properties.Type) {
      tooltipHTML += `
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 3px;">
          Type: ${properties.Type}
        </div>
      `;
    }
    
    if (properties.year) {
      tooltipHTML += `
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: rgba(255, 255, 255, 0.6);">
          Year: ${properties.year}
        </div>
      `;
    }
    
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    
    popup.setLngLat(coordinates).setHTML(tooltipHTML).addTo(map);
  });

  map.on('mouseleave', 'infra-points', () => {
    map.getCanvas().style.cursor = '';
    popup.remove();
  });

  updateYearDisplay(2000);
});

// --- TIMELINE EVENTS ---
const scrollTrack = document.getElementById('scroll-track');
let timelineEvents = [];
let eventsByYear = {};

// Better CSV parser
function parseCSVLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(field => field.trim());
}

async function loadTimelineData() {
  try {
    const response = await fetch('timeline.csv');
    const csvText = await response.text();
    
    const lines = [];
    let currentLine = '';
    let inQuotes = false;
    
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      }
      
      if (char === '\n' && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine);
    }
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      // Only require Year and Event columns (first 2 columns)
      if (values.length >= 2) {
        const event = {
          year: parseInt(values[0]),
          name: values[1],
          tag: values[2] || '',
          dep: values[3] || '',
          contractor: values[4] || '',
          details: values[5] || ''
        };

        if (event.year && event.name) {
          timelineEvents.push(event);

          if (!eventsByYear[event.year]) {
            eventsByYear[event.year] = [];
          }
          eventsByYear[event.year].push(event);
        }
      }
    }

    timelineEvents.sort((a, b) => a.year - b.year);

    console.log(`Loaded ${timelineEvents.length} timeline events`);
    console.log('Events by year:', eventsByYear);

    createYearSections();
    
  } catch (error) {
    console.error('Error loading timeline data:', error);
  }
}

function createYearSections() {
  console.log('createYearSections called');
  console.log('scrollTrack element:', scrollTrack);
  console.log('Number of timeline events:', timelineEvents.length);
  console.log('First 3 events:', timelineEvents.slice(0, 3));

  scrollTrack.innerHTML = '';

  // Create sections for each year from 2000 to 2025
  for (let year = 2000; year <= 2025; year++) {
    const section = document.createElement('div');
    section.className = 'year-section';
    section.dataset.year = year;

    // Add the large year display
    const yearDisplay = document.createElement('div');
    yearDisplay.className = 'year-display';
    yearDisplay.textContent = year;
    section.appendChild(yearDisplay);

    // Add event cards if they exist for this year
    const eventsForYear = eventsByYear[year] || [];

    if (eventsForYear.length > 0) {
      console.log(`Year ${year} has ${eventsForYear.length} events`);
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'event-cards-container';

      eventsForYear.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.tag = event.tag;
        card.dataset.eventName = event.name;

        let html = `
          <div class="event-header">
            <h3 class="event-name">${event.name}</h3>
            <span class="event-tag">${event.tag}</span>
          </div>
        `;

        if (event.dep || event.contractor) {
          html += `<div class="event-meta">`;
          if (event.dep) {
            html += `<p class="event-meta-line"><em>Department:</em> ${event.dep}</p>`;
          }
          if (event.contractor) {
            html += `<p class="event-meta-line"><em>Contractor:</em> ${event.contractor}</p>`;
          }
          html += `</div>`;
        }

        if (event.details) {
          html += `<p class="event-description">${event.details}</p>`;
        }

        card.innerHTML = html;
        cardsContainer.appendChild(card);
      });

      section.appendChild(cardsContainer);
    }

    scrollTrack.appendChild(section);
  }

  console.log('Total sections created:', scrollTrack.children.length);
}

function updateYearDisplay(currentYear) {
  // Only update if the map layer exists (map has finished loading)
  if (map.getLayer('infra-points')) {
    map.setFilter("infra-points", ["<=", ['to-number', ["get", "year"]], currentYear]);
    map.setPaintProperty('infra-points', 'circle-opacity', 0.8);
  }
}

// Load timeline data
loadTimelineData();

// --- SCROLL HANDLING ---
const handleTimelineScroll = () => {
  const sections = document.querySelectorAll('.year-section');

  sections.forEach(section => {
    const rect = section.getBoundingClientRect();

    // A section is active when it's in the center of the viewport
    if (rect.top < window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5) {
      section.classList.add('active');
      const year = parseInt(section.dataset.year);
      updateYearDisplay(year);
    } else {
      section.classList.remove('active');
    }
  });
};

scrollTrack.addEventListener('scroll', handleTimelineScroll);

// --- VIEW SWITCHING FUNCTIONS ---
function switchToExplorationView() {
  currentView = VIEW_MODES.EXPLORATION;

  // Hide timeline
  scrollTrack.style.display = 'none';

  // Remove year filter - show all points
  map.setFilter('infra-points', null);
  map.setPaintProperty('infra-points', 'circle-opacity', 0.8);

  // Show buffer zones
  map.setLayoutProperty('buffer-zones', 'visibility', 'visible');

  // Enable zoom
  map.scrollZoom.enable();
  map.touchZoomRotate.enable();
  map.dragRotate.enable();

  // Add navigation controls
  if (!navigationControl) {
    navigationControl = new mapboxgl.NavigationControl();
    map.addControl(navigationControl, 'top-right');
  }

  // Remove timeline scroll listeners
  scrollTrack.removeEventListener('scroll', handleTimelineScroll);

  // Add exploration hover listeners
  map.on('mousemove', handleExplorationHover);
  map.on('mouseleave', 'buffer-zones', handleBufferLeave);

  // Update toggle UI
  document.getElementById('toggle-btn').classList.add('toggle-active');
  document.getElementById('toggle-btn').classList.remove('toggle-inactive');
}

function switchToTimelineView() {
  currentView = VIEW_MODES.TIMELINE;

  // Show timeline
  scrollTrack.style.display = 'block';

  // Restore year filter
  const sections = document.querySelectorAll('.year-section');
  let activeYear = 2000;
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5) {
      activeYear = parseInt(section.dataset.year);
    }
  });
  map.setFilter('infra-points', ['<=', ['to-number', ['get', 'year']], activeYear]);

  // Hide buffer zones
  map.setLayoutProperty('buffer-zones', 'visibility', 'none');

  // Disable zoom
  map.scrollZoom.disable();
  map.touchZoomRotate.disable();
  map.dragRotate.disable();

  // Remove navigation controls
  if (navigationControl) {
    map.removeControl(navigationControl);
    navigationControl = null;
  }

  // Remove exploration hover listeners
  map.off('mousemove', handleExplorationHover);
  map.off('mouseleave', 'buffer-zones', handleBufferLeave);

  // Restore timeline scroll listeners
  scrollTrack.addEventListener('scroll', handleTimelineScroll);

  // Update toggle UI
  document.getElementById('toggle-btn').classList.remove('toggle-active');
  document.getElementById('toggle-btn').classList.add('toggle-inactive');
}

// --- EXPLORATION VIEW HOVER SYSTEM ---
function handleExplorationHover(e) {
  // Priority 1: Check if hovering over point center
  const pointFeatures = map.queryRenderedFeatures(e.point, {
    layers: ['infra-points']
  });

  if (pointFeatures.length > 0) {
    showPointTooltip(pointFeatures[0]);
    map.getCanvas().style.cursor = 'pointer';
    return;
  }

  // Priority 2: Check if hovering over buffer zone
  const bufferFeatures = map.queryRenderedFeatures(e.point, {
    layers: ['buffer-zones']
  });

  if (bufferFeatures.length > 0) {
    showBufferTooltip(bufferFeatures[0]);
    map.getCanvas().style.cursor = 'help';
    return;
  }

  // No hover
  popup.remove();
  map.getCanvas().style.cursor = '';
}

function showPointTooltip(feature) {
  const props = feature.properties;

  let html = `
    <div style="font-family: 'Urbanist', sans-serif; font-weight: 700; font-size: 0.95rem; margin-bottom: 5px; color: white;">
      ${props.System || 'Unknown System'}
    </div>
  `;

  if (props['Station Name']) {
    html += `
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 3px;">
        ${props['Station Name']}
      </div>
    `;
  }

  if (props.Type) {
    html += `
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 3px;">
        Type: ${props.Type}
      </div>
    `;
  }

  if (props.year) {
    html += `
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: rgba(255, 255, 255, 0.6);">
        Year: ${props.year}
      </div>
    `;
  }

  popup.setLngLat(feature.geometry.coordinates).setHTML(html).addTo(map);
}

function showBufferTooltip(feature) {
  const props = feature.properties;

  const radius = props['Average Radius of Connection (ft)'] || 'Unknown';
  const dataCollected = props['Data Collected'] || 'No data collection info available';

  let html = `
    <div class="buffer-tooltip">
      <div class="tooltip-header" style="font-family: 'Urbanist', sans-serif; font-weight: 700; font-size: 0.85rem; margin-bottom: 8px; color: rgba(255, 255, 255, 0.9);">
         Data Collection Zone
      </div>
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px;">
        Coverage Radius: ${radius} ft
      </div>
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: rgba(255, 255, 255, 0.6); line-height: 1.4; border-top: 1px solid rgba(255, 255, 255, 0.2); padding-top: 8px;">
        <strong style="color: rgba(255, 255, 255, 0.8);">Data Collected:</strong><br/>
        ${dataCollected}
      </div>
    </div>
  `;

  popup.setLngLat(feature.geometry.coordinates).setHTML(html).addTo(map);
}

function handleBufferLeave() {
  if (currentView === VIEW_MODES.EXPLORATION) {
    popup.remove();
    map.getCanvas().style.cursor = '';
  }
}

// --- TOGGLE EVENT LISTENER ---
document.getElementById('toggle-btn').addEventListener('click', () => {
  if (currentView === VIEW_MODES.TIMELINE) {
    switchToExplorationView();
  } else {
    switchToTimelineView();
  }
});

