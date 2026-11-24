// Mini Environmental Monitoring Web GIS - OpenLayers + Open-Meteo API

// 1. Three districts from my hometown (Azad Kashmir)
const locations = [
  { name: "Muzaffarabad",       lat: 34.37, lon: 73.47 },
  { name: "Poonch (Rawalakot)", lat: 33.86, lon: 73.76 },
  { name: "Mirpur",             lat: 33.15, lon: 73.75 }
];

// 2. Open-Meteo API request (no API key needed)
const apiUrl =
  "https://api.open-meteo.com/v1/forecast?latitude=34.37,33.86,33.15" +
  "&longitude=73.47,73.76,73.75" +
  "&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto";
console.log("API request URL:", apiUrl);

// 3. Map with two base layers (Map / Satellite)
const street = new ol.layer.Tile({ source: new ol.source.OSM() });
const satellite = new ol.layer.Tile({
  visible: false,
  source: new ol.source.XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attributions: "Tiles &copy; Esri"
  })
});

const home = { center: ol.proj.fromLonLat([73.65, 33.8]), zoom: 8 };
const view = new ol.View({ center: home.center, zoom: home.zoom });
const map = new ol.Map({ target: "map", layers: [street, satellite], view: view });

// 4. Helpers: colour and emoji by temperature
function tempColor(t) {
  if (t < 15) return "#60a5fa";   // blue
  if (t < 25) return "#4ade80";   // green
  if (t < 35) return "#fbbf24";   // orange
  return "#f87171";               // red
}
function tempEmoji(t) {
  if (t < 15) return "🥶";
  if (t < 25) return "🌤️";
  if (t < 35) return "☀️";
  return "🔥";
}

// 5. Marker layer (temperature number inside, bigger on hover)
let hovered = null;

function markerStyle(feature) {
  const t = feature.get("temp");
  const isHover = feature === hovered;
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: isHover ? 23 : 18,
      fill: new ol.style.Fill({ color: tempColor(t) }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: isHover ? 4 : 3 })
    }),
    text: new ol.style.Text({
      text: Math.round(t) + "°",
      font: "600 13px Poppins, Arial",
      fill: new ol.style.Fill({ color: "#1a1033" })
    })
  });
}

const source = new ol.source.Vector();
const markerLayer = new ol.layer.Vector({ source: source, style: markerStyle });
map.addLayer(markerLayer);

// 6. Popup overlay
const popupEl = document.getElementById("popup");
const overlay = new ol.Overlay({
  element: popupEl,
  positioning: "bottom-center",
  offset: [0, -26],
  stopEvent: false
});
map.addOverlay(overlay);

function popupHtml(f) {
  return (
    "<h4><span class='pop-emoji'>" + tempEmoji(f.get("temp")) + "</span>" + f.get("name") + "</h4>" +
    "Temperature: <b>" + f.get("temp") + " &deg;C</b><br>" +
    "Relative humidity: <b>" + f.get("hum") + " %</b>" +
    "<div class='bar'><div style='width:" + f.get("hum") + "%'></div></div>" +
    "Wind speed: <b>" + f.get("wind") + " km/h</b><br>" +
    "<small>Time: " + f.get("time").replace("T", " ") + "</small>"
  );
}

function showPopup(feature) {
  popupEl.innerHTML = popupHtml(feature);
  popupEl.style.display = "block";
  overlay.setPosition(feature.getGeometry().getCoordinates());
}
function hidePopup() {
  popupEl.style.display = "none";
  overlay.setPosition(undefined);
}

// 7. Side cards (click = fly to place)
const cardsEl = document.getElementById("cards");

function buildCards() {
  cardsEl.innerHTML = "";
  source.getFeatures().forEach((f, i) => {
    const card = document.createElement("div");
    card.className = "card glass";
    card.style.borderLeftColor = tempColor(f.get("temp"));
    card.style.animationDelay = (i * 0.12) + "s";
    card.innerHTML =
      "<div class='emoji'>" + tempEmoji(f.get("temp")) + "</div>" +
      "<div><b>" + f.get("name") + "</b>" +
      "<span>" + f.get("temp") + "°C · " + f.get("hum") + "% · " + f.get("wind") + " km/h</span></div>";
    card.addEventListener("click", () => {
      view.animate({
        center: f.getGeometry().getCoordinates(),
        zoom: 10,
        duration: 1200
      });
      showPopup(f);
    });
    cardsEl.appendChild(card);
  });
}

// 8. Load weather data
const statusEl = document.getElementById("status");

function loadWeather() {
  statusEl.textContent = "Loading...";
  hidePopup();

  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      source.clear();
      const results = Array.isArray(data) ? data : [data];

      results.forEach((res, i) => {
        const c = res.current;
        const feature = new ol.Feature({
          geometry: new ol.geom.Point(
            ol.proj.fromLonLat([locations[i].lon, locations[i].lat])
          ),
          name: locations[i].name,
          temp: c.temperature_2m,
          hum: c.relative_humidity_2m,
          wind: c.wind_speed_10m,
          time: c.time
        });
        source.addFeature(feature);
      });

      buildCards();
      statusEl.textContent = "Updated at " + new Date().toLocaleTimeString();
    })
    .catch(err => {
      statusEl.textContent = "Error loading data";
      console.error(err);
    });
}

loadWeather();
setInterval(loadWeather, 5 * 60 * 1000);   // auto refresh every 5 minutes

// 9. Buttons
document.getElementById("refreshBtn").addEventListener("click", loadWeather);
document.getElementById("resetBtn").addEventListener("click", () => {
  hidePopup();
  view.animate({ center: home.center, zoom: home.zoom, duration: 1000 });
});

document.querySelectorAll("#basemap button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#basemap button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const sat = btn.dataset.map === "satellite";
    street.setVisible(!sat);
    satellite.setVisible(sat);
  });
});

// 10. Click and hover on markers
map.on("click", function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
  if (feature) showPopup(feature);
  else hidePopup();
});

map.on("pointermove", function (e) {
  const f = map.forEachFeatureAtPixel(e.pixel, f => f) || null;
  if (f !== hovered) {
    hovered = f;
    markerLayer.changed();
  }
  map.getTargetElement().style.cursor = f ? "pointer" : "";
});