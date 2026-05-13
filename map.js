mapboxgl.accessToken = 'pk.eyJ1IjoiYW50b25pYXNpbW9uODg4OCIsImEiOiJjbWh1djZlZWkwM3dxMndwcTQ4dGpqbjRmIn0.aUES1POmpQBERuoTs62phg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-73.95, 40.73],
  zoom: 11
});

const changeLayers = ['layer-change-none', 'layer-change-decrease',
                      'layer-change-moderate', 'layer-change-high'];

let largeChartInstance = null;

map.on('load', () => {

  map.addSource('kiosks', {
    type: 'geojson',
    data: 'kiosk_summary.geojson'
  });

  // LAYER 1a: Follows citywide trend (bottom)
  map.addLayer({
    id: 'layer-change-none',
    type: 'circle',
    source: 'kiosks',
    filter: ['==', ['get', 'change_category'], 'Follows citywide trend'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'total_arrests'], 0, 3, 1000, 10],
      'circle-color': '#444444',
      'circle-opacity': 0.8,
      'circle-stroke-width': 0
    }
  });

  // LAYER 1b: Decrease vs citywide (blue)
  map.addLayer({
    id: 'layer-change-decrease',
    type: 'circle',
    source: 'kiosks',
    filter: ['==', ['get', 'change_category'], 'Decrease vs citywide'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'total_arrests'], 0, 3, 1000, 12],
      'circle-color': '#2166ac',
      'circle-opacity': 0.85,
      'circle-stroke-width': 0
    }
  });

  // LAYER 1c: Moderate increase (salmon)
  map.addLayer({
    id: 'layer-change-moderate',
    type: 'circle',
    source: 'kiosks',
    filter: ['==', ['get', 'change_category'], 'Moderate increase vs citywide'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'total_arrests'], 0, 3, 1000, 12],
      'circle-color': '#d6604d',
      'circle-opacity': 0.85,
      'circle-stroke-width': 0
    }
  });

  // LAYER 1d: High increase (dark red — on top)
  map.addLayer({
    id: 'layer-change-high',
    type: 'circle',
    source: 'kiosks',
    filter: ['==', ['get', 'change_category'], 'High increase vs citywide'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'total_arrests'], 0, 4, 1000, 14],
      'circle-color': '#67001f',
      'circle-opacity': 0.9,
      'circle-stroke-width': 0
    }
  });

  // LAYER 2: Before activation
  map.addLayer({
    id: 'layer-before',
    type: 'circle',
    source: 'kiosks',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'Before'], 0, 2, 500, 14],
      'circle-color': '#4FABD4',
      'circle-opacity': 0.85,
      'circle-stroke-width': 0
    }
  });

  // LAYER 3: After activation
  map.addLayer({
    id: 'layer-after',
    type: 'circle',
    source: 'kiosks',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'After'], 0, 2, 500, 14],
      'circle-color': '#E87722',
      'circle-opacity': 0.85,
      'circle-stroke-width': 0
    }
  });

  // Popups
  const allLayers = ['layer-change-none', 'layer-change-decrease',
                     'layer-change-moderate', 'layer-change-high',
                     'layer-before', 'layer-after'];

  allLayers.forEach(layerId => {
    map.on('click', layerId, (e) => {
      const p = e.features[0].properties;
      new mapboxgl.Popup({ offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(`
          <span class="popup-title">${p.borough || 'Unknown Borough'}</span>
          <span class="popup-label">Activated</span>
          <span class="popup-value">${p.activation_date || '—'}</span>
          <span class="popup-label">Arrests Before</span>
          <span class="popup-value">${p.Before ?? '—'}</span>
          <span class="popup-label">Arrests After</span>
          <span class="popup-value">${p.After ?? '—'}</span>
          <span class="popup-label">vs Citywide Trend</span>
          <span class="popup-value">${p.change_category || '—'}</span>
        `)
        .addTo(map);
    });

    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });

  // ✅ Chart panel click listener — inside load block
  document.getElementById('chart-panel').addEventListener('click', openChart);

  // ✅ Modal background click — inside load block
  document.getElementById('chart-modal').addEventListener('click', function(e) {
    if (e.target === this) closeChart();
  });

  updateLegend('change');
  loadChart();
});

// ---- LAYER TOGGLE ----
function showLayer(layer, btn) {
  [...changeLayers, 'layer-before', 'layer-after'].forEach(l => {
    map.setLayoutProperty(l, 'visibility', 'none');
  });

  if (layer === 'change') {
    changeLayers.forEach(l => map.setLayoutProperty(l, 'visibility', 'visible'));
  } else {
    map.setLayoutProperty(`layer-${layer}`, 'visibility', 'visible');
  }

  document.querySelectorAll('#toggle-buttons button').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  updateLegend(layer);
}

// ---- LEGEND ----
function updateLegend(layer) {
  const legend = document.getElementById('legend');

  if (layer === 'change') {
    legend.innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#67001f"></div>High increase vs citywide</div>
      <div class="legend-item"><div class="legend-dot" style="background:#d6604d"></div>Moderate increase vs citywide</div>
      <div class="legend-item"><div class="legend-dot" style="background:#444"></div>Follows citywide trend</div>
      <div class="legend-item"><div class="legend-dot" style="background:#2166ac"></div>Decrease vs citywide</div>
      <div class="legend-note">Circle size = total arrests</div>
    `;
  } else if (layer === 'before') {
    legend.innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#4FABD4"></div>Arrests before activation</div>
      <div class="legend-note">Circle size = arrest count</div>
    `;
  } else {
    legend.innerHTML = `
      <div class="legend-item"><div class="legend-dot" style="background:#E87722"></div>Arrests after activation</div>
      <div class="legend-note">Circle size = arrest count</div>
    `;
  }
}

// ---- CHART MODAL ----
function openChart() {
  document.getElementById('chart-modal').classList.add('open');
  if (!largeChartInstance) {
    renderLargeChart();
  }
}

function closeChart() {
  document.getElementById('chart-modal').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeChart();
});

// ---- LOAD CHART DATA ----
function loadChart() {
  Promise.all([
    fetch('trend_data.json').then(r => r.json()),
    fetch('before_after_data.json').then(r => r.json())
  ]).then(([trendData, beforeAfterData]) => {
    window._trendData = trendData;
    window._beforeAfterData = beforeAfterData;

    const years = trendData.map(d => d.arrest_year);
    const citywide = trendData.map(d => d.total_citywide_arrests);
    const buffer = trendData.map(d => d.arrests_in_buffer);
    const before = beforeAfterData.map(d => d.before);
    const after = beforeAfterData.map(d => d.after);

    const ctx = document.getElementById('trendChart').getContext('2d');
    new Chart(ctx, buildChartConfig(years, citywide, buffer, before, after, 9));
  }).catch(err => console.error('Chart data error:', err));
}

function renderLargeChart() {
  const trendData = window._trendData;
  const beforeAfterData = window._beforeAfterData;

  const years = trendData.map(d => d.arrest_year);
  const citywide = trendData.map(d => d.total_citywide_arrests);
  const buffer = trendData.map(d => d.arrests_in_buffer);
  const before = beforeAfterData.map(d => d.before);
  const after = beforeAfterData.map(d => d.after);

  const ctx = document.getElementById('trendChartLarge').getContext('2d');
  largeChartInstance = new Chart(ctx, buildChartConfig(years, citywide, buffer, before, after, 11));
}

// ---- SHARED CHART CONFIG ----
function buildChartConfig(years, citywide, buffer, before, after, fontSize) {
  return {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Citywide Arrests',
          data: citywide,
          borderColor: '#4FABD4',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: 'Near LinkNYC (After Activation)',
          data: buffer,
          borderColor: '#E87722',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: 'Per Kiosk — After',
          data: after,
          borderColor: '#E87722',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'y2',
          spanGaps: true
        },
        {
          label: 'Per Kiosk — Before',
          data: before,
          borderColor: '#4FABD4',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'y2',
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#888',
            font: { size: fontSize },
            boxWidth: 12
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#555', font: { size: fontSize - 1 } },
          grid: { color: '#1a1a1a' }
        },
        y1: {
          type: 'linear',
          position: 'left',
          ticks: {
            color: '#555',
            font: { size: fontSize - 1 },
            callback: val => val >= 1000 ? (val/1000).toFixed(0) + 'k' : val
          },
          grid: { color: '#1a1a1a' }
        },
        y2: {
          type: 'linear',
          position: 'right',
          ticks: {
            color: '#555',
            font: { size: fontSize - 1 }
          },
          grid: { drawOnChartArea: false }
        }
      }
    }
  };
}