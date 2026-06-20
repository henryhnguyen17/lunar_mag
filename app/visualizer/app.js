const DEFAULT_ORBIT_URL = "data/sample_orbit.json";
const DEFAULT_MAGNETIC_URL = "data/magnetic/lp_kaguya_clusters_demo.json";
const MOON_MEAN_RADIUS_KM = 1737.4;
const MOON_MU_KM3_S2 = 4902.800066;
const MOON_SIDEREAL_PERIOD_S = 27.321661 * 24 * 60 * 60;
const DEFAULT_CENTER_BODY = {
  body_id: "moon",
  display_name: "Moon",
  radius_km: MOON_MEAN_RADIUS_KM,
  color: "#b8bec8",
  map_bounds: {
    longitude_min_deg: -180,
    longitude_max_deg: 180,
    latitude_min_deg: -90,
    latitude_max_deg: 90,
  },
};

let orbitSamples = [];
let centerBody = DEFAULT_CENTER_BODY;
let currentIndex = 0;
let playbackPosition = 0;
let playing = false;
let timerId = null;
let lastFrameTimeMs = null;
let orbitViewYawRad = (-38 * Math.PI) / 180;
let orbitViewPitchRad = (-18 * Math.PI) / 180;
let orbitDragState = null;
let magneticLayer = {
  dataset_id: "none",
  display_name: "No magnetic layer loaded",
  source_note: "",
  reference_altitude_km: 30,
  units: "nT",
  clusters: [],
};

const elements = {
  status: document.getElementById("status"),
  playPause: document.getElementById("play-pause"),
  reset: document.getElementById("reset"),
  speed: document.getElementById("speed"),
  scrubber: document.getElementById("scrubber"),
  fileInput: document.getElementById("file-input"),
  stateTime: document.getElementById("state-time"),
  stateLat: document.getElementById("state-lat"),
  stateLon: document.getElementById("state-lon"),
  stateAlt: document.getElementById("state-alt"),
  stateSpeed: document.getElementById("state-speed"),
  stateSample: document.getElementById("state-sample"),
  stateBody: document.getElementById("state-body"),
  stateMagB: document.getElementById("state-mag-b"),
  stateMagVector: document.getElementById("state-mag-vector"),
  stateMagCluster: document.getElementById("state-mag-cluster"),
  orbit3dSvg: document.getElementById("orbit3d-svg"),
  mapSvg: document.getElementById("map-svg"),
  magneticSvg: document.getElementById("magnetic-svg"),
  plotSvg: document.getElementById("plot-svg"),
  generateOrbit: document.getElementById("generate-orbit"),
  generatorInputs: {
    periluneAltitude: document.getElementById("perilune-altitude"),
    apoluneAltitude: document.getElementById("apolune-altitude"),
    inclination: document.getElementById("inclination"),
    raan: document.getElementById("raan"),
    argumentOfPerilune: document.getElementById("argument-of-perilune"),
    meanAnomaly: document.getElementById("mean-anomaly"),
    duration: document.getElementById("duration"),
    step: document.getElementById("step"),
  },
  generatorOutputs: {
    periluneAltitude: document.getElementById("perilune-altitude-value"),
    apoluneAltitude: document.getElementById("apolune-altitude-value"),
    inclination: document.getElementById("inclination-value"),
    raan: document.getElementById("raan-value"),
    argumentOfPerilune: document.getElementById("argument-of-perilune-value"),
    meanAnomaly: document.getElementById("mean-anomaly-value"),
    duration: document.getElementById("duration-value"),
    step: document.getElementById("step-value"),
  },
};

function setStatus(message) {
  elements.status.textContent = message;
}

function setActiveTab(tabId) {
  document.querySelectorAll(".tab-button").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((item) => {
    item.classList.toggle("active", item.id === tabId);
  });
  renderVisibleViews();
}

function setOrbitPayload(payload, sourceLabel) {
  if (!payload.samples || payload.samples.length === 0) {
    throw new Error("Orbit payload has no samples.");
  }
  orbitSamples = payload.samples;
  centerBody = payload.center_body || centerBody;
  currentIndex = 0;
  playbackPosition = 0;
  elements.scrubber.max = String(orbitSamples.length - 1);
  elements.scrubber.value = "0";
  stopPlayback();
  renderAll();
  setStatus(`Loaded ${orbitSamples.length} samples from ${sourceLabel}.`);
}

async function loadDefaultOrbit() {
  try {
    const response = await fetch(DEFAULT_ORBIT_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    setOrbitPayload(await response.json(), DEFAULT_ORBIT_URL);
  } catch (error) {
    setStatus(
      `Default orbit could not be loaded (${error.message}). Start a local server or load a JSON file.`
    );
  }
}

async function loadDefaultMagneticLayer() {
  try {
    const response = await fetch(DEFAULT_MAGNETIC_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    magneticLayer = await response.json();
    renderAll();
    setStatus(`Loaded ${orbitSamples.length} orbit samples and magnetic layer: ${magneticLayer.display_name}.`);
  } catch (error) {
    setStatus(`Magnetic layer could not be loaded (${error.message}).`);
  }
}

function magneticVectorAt(latitudeDeg, longitudeDeg, altitudeKm) {
  let radialNt = 0;
  let northNt = 0;
  let eastNt = 0;
  let nearestCluster = null;
  let nearestDistanceDeg = Infinity;

  magneticLayer.clusters.forEach((cluster) => {
    const deltaLatDeg = latitudeDeg - cluster.latitude_deg;
    const deltaLonDeg = shortestLongitudeDeltaDeg(longitudeDeg, cluster.longitude_deg);
    const distanceDeg = Math.sqrt(deltaLatDeg ** 2 + deltaLonDeg ** 2);
    const sigmaDeg = cluster.sigma_deg || 10;
    const altitudeFalloff = Math.exp(-Math.max(0, altitudeKm - magneticLayer.reference_altitude_km) / 140);
    const gaussian = Math.exp(-(distanceDeg ** 2) / (2 * sigmaDeg ** 2));
    const signedStrength = cluster.polarity * cluster.strength_nt * gaussian * altitudeFalloff;
    const gradientScale = distanceDeg > 0.001 ? signedStrength / sigmaDeg : 0;

    radialNt += signedStrength;
    northNt += -gradientScale * deltaLatDeg;
    eastNt += -gradientScale * deltaLonDeg * Math.cos(toRadians(latitudeDeg));

    if (distanceDeg < nearestDistanceDeg) {
      nearestCluster = cluster;
      nearestDistanceDeg = distanceDeg;
    }
  });

  const magnitudeNt = Math.sqrt(radialNt ** 2 + northNt ** 2 + eastNt ** 2);
  return {
    b_radial_nt: radialNt,
    b_north_nt: northNt,
    b_east_nt: eastNt,
    magnitude_nt: magnitudeNt,
    nearest_cluster_name: nearestCluster ? nearestCluster.name : "-",
    nearest_cluster_distance_deg: nearestDistanceDeg,
  };
}

function magneticVectorForSample(sample) {
  return magneticVectorAt(sample.latitude_deg, sample.longitude_deg, sample.altitude_km);
}

function shortestLongitudeDeltaDeg(longitudeDeg, referenceLongitudeDeg) {
  let delta = longitudeDeg - referenceLongitudeDeg;
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  return delta;
}

function readOrbitGenerationParams() {
  return {
    periluneAltitudeKm: Number(elements.generatorInputs.periluneAltitude.value),
    apoluneAltitudeKm: Number(elements.generatorInputs.apoluneAltitude.value),
    inclinationDeg: Number(elements.generatorInputs.inclination.value),
    raanDeg: Number(elements.generatorInputs.raan.value),
    argumentOfPeriluneDeg: Number(elements.generatorInputs.argumentOfPerilune.value),
    meanAnomalyDeg: Number(elements.generatorInputs.meanAnomaly.value),
    durationMin: Number(elements.generatorInputs.duration.value),
    stepS: Number(elements.generatorInputs.step.value),
  };
}

function updateGeneratorOutputLabels() {
  const params = readOrbitGenerationParams();
  elements.generatorOutputs.periluneAltitude.textContent = params.periluneAltitudeKm.toFixed(2);
  elements.generatorOutputs.apoluneAltitude.textContent = params.apoluneAltitudeKm.toFixed(2);
  elements.generatorOutputs.inclination.textContent = params.inclinationDeg.toFixed(2);
  elements.generatorOutputs.raan.textContent = params.raanDeg.toFixed(2);
  elements.generatorOutputs.argumentOfPerilune.textContent = params.argumentOfPeriluneDeg.toFixed(2);
  elements.generatorOutputs.meanAnomaly.textContent = params.meanAnomalyDeg.toFixed(2);
  elements.generatorOutputs.duration.textContent = params.durationMin.toFixed(0);
  elements.generatorOutputs.step.textContent = params.stepS.toFixed(0);
}

function generateOrbitFromInputs() {
  const params = readOrbitGenerationParams();
  if (params.apoluneAltitudeKm < params.periluneAltitudeKm) {
    setStatus("Apolune altitude must be greater than or equal to perilune altitude.");
    return;
  }

  const payload = generateKeplerianOrbitPayload(params);
  setOrbitPayload(payload, "orbit generation tab");
  setActiveTab("playback");
}

function generateKeplerianOrbitPayload(params) {
  const periluneRadiusKm = MOON_MEAN_RADIUS_KM + params.periluneAltitudeKm;
  const apoluneRadiusKm = MOON_MEAN_RADIUS_KM + params.apoluneAltitudeKm;
  const semiMajorAxisKm = (periluneRadiusKm + apoluneRadiusKm) / 2;
  const eccentricity = (apoluneRadiusKm - periluneRadiusKm) / (apoluneRadiusKm + periluneRadiusKm);
  const semiLatusRectumKm = semiMajorAxisKm * (1 - eccentricity ** 2);
  const meanMotionRadS = Math.sqrt(MOON_MU_KM3_S2 / semiMajorAxisKm ** 3);
  const inclinationRad = toRadians(params.inclinationDeg);
  const raanRad = toRadians(params.raanDeg);
  const argumentOfPeriluneRad = toRadians(params.argumentOfPeriluneDeg);
  const meanAnomalyStartRad = toRadians(params.meanAnomalyDeg);
  const startTimeMs = Date.parse("2026-01-01T00:00:00Z");
  const durationS = params.durationMin * 60;
  const sampleCount = Math.floor(durationS / params.stepS) + 1;
  const samples = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const elapsedS = index * params.stepS;
    const meanAnomalyRad = meanAnomalyStartRad + meanMotionRadS * elapsedS;
    const eccentricAnomalyRad = solveEccentricAnomaly(meanAnomalyRad, eccentricity);
    const trueAnomalyRad = 2 * Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomalyRad / 2),
      Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomalyRad / 2)
    );
    const radiusKm = semiLatusRectumKm / (1 + eccentricity * Math.cos(trueAnomalyRad));
    const orbitalSpeedFactor = Math.sqrt(MOON_MU_KM3_S2 / semiLatusRectumKm);
    const orbitalPosition = [
      radiusKm * Math.cos(trueAnomalyRad),
      radiusKm * Math.sin(trueAnomalyRad),
      0,
    ];
    const orbitalVelocity = [
      -orbitalSpeedFactor * Math.sin(trueAnomalyRad),
      orbitalSpeedFactor * (eccentricity + Math.cos(trueAnomalyRad)),
      0,
    ];
    const inertialPosition = rotateOrbitalToInertial(
      orbitalPosition,
      raanRad,
      inclinationRad,
      argumentOfPeriluneRad
    );
    const inertialVelocity = rotateOrbitalToInertial(
      orbitalVelocity,
      raanRad,
      inclinationRad,
      argumentOfPeriluneRad
    );
    const fixedPosition = rotateInertialToMoonFixed(inertialPosition, elapsedS);
    const rotatedVelocity = rotateInertialToMoonFixed(inertialVelocity, elapsedS);
    const fixedVelocity = moonFixedVelocity(fixedPosition, rotatedVelocity);
    const sample = cartesianStateToOrbitSample(
      fixedPosition,
      fixedVelocity,
      new Date(startTimeMs + elapsedS * 1000),
      "generated-lunar-orbit"
    );
    samples.push(sample);
  }

  return {
    schema: "lunar_mag.visualizer.orbit.v1",
    sample_count: samples.length,
    orbit_id: "generated-lunar-orbit",
    samples,
    center_body: DEFAULT_CENTER_BODY,
  };
}

function solveEccentricAnomaly(meanAnomalyRad, eccentricity) {
  let eccentricAnomalyRad = meanAnomalyRad;
  for (let index = 0; index < 12; index += 1) {
    const residual = eccentricAnomalyRad - eccentricity * Math.sin(eccentricAnomalyRad) - meanAnomalyRad;
    const derivative = 1 - eccentricity * Math.cos(eccentricAnomalyRad);
    eccentricAnomalyRad -= residual / derivative;
  }
  return eccentricAnomalyRad;
}

function rotateOrbitalToInertial(vector, raanRad, inclinationRad, argumentOfPeriluneRad) {
  const [xKm, yKm, zKm] = vector;
  const cosRaan = Math.cos(raanRad);
  const sinRaan = Math.sin(raanRad);
  const cosInc = Math.cos(inclinationRad);
  const sinInc = Math.sin(inclinationRad);
  const cosArg = Math.cos(argumentOfPeriluneRad);
  const sinArg = Math.sin(argumentOfPeriluneRad);

  return [
    (cosRaan * cosArg - sinRaan * sinArg * cosInc) * xKm
      + (-cosRaan * sinArg - sinRaan * cosArg * cosInc) * yKm
      + (sinRaan * sinInc) * zKm,
    (sinRaan * cosArg + cosRaan * sinArg * cosInc) * xKm
      + (-sinRaan * sinArg + cosRaan * cosArg * cosInc) * yKm
      + (-cosRaan * sinInc) * zKm,
    (sinArg * sinInc) * xKm + (cosArg * sinInc) * yKm + cosInc * zKm,
  ];
}

function rotateInertialToMoonFixed(vector, elapsedS) {
  const [xKm, yKm, zKm] = vector;
  const moonRotationRad = (2 * Math.PI * elapsedS) / MOON_SIDEREAL_PERIOD_S;
  const cosRotation = Math.cos(moonRotationRad);
  const sinRotation = Math.sin(moonRotationRad);
  return [
    cosRotation * xKm + sinRotation * yKm,
    -sinRotation * xKm + cosRotation * yKm,
    zKm,
  ];
}

function moonFixedVelocity(positionFixedKm, velocityRotatedKmS) {
  const moonRotationRateRadS = (2 * Math.PI) / MOON_SIDEREAL_PERIOD_S;
  const [xKm, yKm] = positionFixedKm;
  const [velocityXKmS, velocityYKmS, velocityZKmS] = velocityRotatedKmS;
  return [
    velocityXKmS + moonRotationRateRadS * yKm,
    velocityYKmS - moonRotationRateRadS * xKm,
    velocityZKmS,
  ];
}

function cartesianStateToOrbitSample(positionKm, velocityKmS, timestamp, orbitId) {
  const [xKm, yKm, zKm] = positionKm;
  const [velocityXKmS, velocityYKmS, velocityZKmS] = velocityKmS;
  const radiusFromCenterKm = Math.sqrt(xKm ** 2 + yKm ** 2 + zKm ** 2);
  const latitudeDeg = toDegrees(Math.asin(zKm / radiusFromCenterKm));
  const longitudeDeg = normalizeLongitudeDeg(toDegrees(Math.atan2(yKm, xKm)));
  const altitudeKm = radiusFromCenterKm - MOON_MEAN_RADIUS_KM;
  const speedKmS = Math.sqrt(velocityXKmS ** 2 + velocityYKmS ** 2 + velocityZKmS ** 2);

  return {
    timestamp_utc: timestamp.toISOString().replace(".000Z", ""),
    latitude_deg: latitudeDeg,
    longitude_deg: longitudeDeg,
    altitude_km: altitudeKm,
    velocity_km_s: speedKmS,
    orbit_id: orbitId,
  };
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function normalizeLongitudeDeg(longitudeDeg) {
  const normalized = ((longitudeDeg + 180) % 360) - 180;
  if (normalized === -180 && longitudeDeg > 0) {
    return 180;
  }
  return normalized;
}

function startPlayback() {
  if (playing || orbitSamples.length === 0) {
    return;
  }
  if (playbackPosition >= orbitSamples.length - 1) {
    playbackPosition = 0;
    currentIndex = 0;
    elements.scrubber.value = "0";
  }
  playing = true;
  elements.playPause.textContent = "Pause";
  setStatus(`Playing ${orbitSamples.length} samples.`);
  advancePlayback(250);
  renderVisibleViews();
  lastFrameTimeMs = performance.now();
  const step = (frameTimeMs) => {
    if (!playing) {
      return;
    }
    const elapsedMs = frameTimeMs - lastFrameTimeMs;
    lastFrameTimeMs = frameTimeMs;
    advancePlayback(elapsedMs);
    renderVisibleViews();
    if (!playing) {
      return;
    }
    timerId = window.requestAnimationFrame(step);
  };
  timerId = window.requestAnimationFrame(step);
}

function advancePlayback(elapsedMs) {
  const samplesPerSecond = Number(elements.speed.value) * 4;
  playbackPosition += (elapsedMs / 1000) * samplesPerSecond;
  if (playbackPosition >= orbitSamples.length - 1) {
    playbackPosition = orbitSamples.length - 1;
    currentIndex = orbitSamples.length - 1;
    elements.scrubber.value = String(currentIndex);
    stopPlayback();
    return;
  }
  currentIndex = Math.floor(playbackPosition);
  elements.scrubber.value = String(currentIndex);
}

function stopPlayback() {
  playing = false;
  elements.playPause.textContent = "Play";
  if (timerId !== null) {
    window.cancelAnimationFrame(timerId);
    timerId = null;
  }
  lastFrameTimeMs = null;
}

function resetPlayback() {
  stopPlayback();
  currentIndex = 0;
  playbackPosition = 0;
  elements.scrubber.value = "0";
  renderAll();
}

function renderAll() {
  if (orbitSamples.length === 0) {
    return;
  }
  renderState();
  renderOrbit3D();
  renderMap();
  renderMagneticMap();
  renderPlots();
}

function renderVisibleViews() {
  if (orbitSamples.length === 0) {
    return;
  }
  renderState();
  const activeTabId = document.querySelector(".tab-panel.active")?.id;
  if (activeTabId === "orbit3d") {
    renderOrbit3D();
  } else if (activeTabId === "map") {
    renderMap();
  } else if (activeTabId === "magnetic") {
    renderMagneticMap();
  } else if (activeTabId === "plots") {
    renderPlots();
  }
}

function renderState() {
  const sample = sampleAtPlaybackPosition();
  elements.stateTime.textContent = formatTimestamp(sample.timestamp_utc);
  elements.stateLat.textContent = `${sample.latitude_deg.toFixed(3)} deg`;
  elements.stateLon.textContent = `${sample.longitude_deg.toFixed(3)} deg`;
  elements.stateAlt.textContent = `${sample.altitude_km.toFixed(2)} km`;
  elements.stateSpeed.textContent = `${sample.velocity_km_s.toFixed(4)} km/s`;
  elements.stateSample.textContent = `${playbackPosition.toFixed(1)} / ${orbitSamples.length - 1}`;
  elements.stateBody.textContent = centerBody.display_name;
  const magneticVector = magneticVectorForSample(sample);
  elements.stateMagB.textContent = `${magneticVector.magnitude_nt.toFixed(2)} nT`;
  elements.stateMagVector.textContent = `R ${magneticVector.b_radial_nt.toFixed(1)}, N ${magneticVector.b_north_nt.toFixed(1)}, E ${magneticVector.b_east_nt.toFixed(1)} nT`;
  elements.stateMagCluster.textContent = magneticVector.nearest_cluster_name;
}

function sampleAtPlaybackPosition() {
  if (orbitSamples.length === 1) {
    return orbitSamples[0];
  }
  const lowerIndex = Math.max(0, Math.min(orbitSamples.length - 1, Math.floor(playbackPosition)));
  const upperIndex = Math.max(0, Math.min(orbitSamples.length - 1, lowerIndex + 1));
  const fraction = playbackPosition - lowerIndex;
  const lower = orbitSamples[lowerIndex];
  const upper = orbitSamples[upperIndex];
  const lowerTimeMs = new Date(lower.timestamp_utc).getTime();
  const upperTimeMs = new Date(upper.timestamp_utc).getTime();

  return {
    timestamp_utc: new Date(lerp(lowerTimeMs, upperTimeMs, fraction)).toISOString(),
    latitude_deg: lerp(lower.latitude_deg, upper.latitude_deg, fraction),
    longitude_deg: interpolateLongitude(lower.longitude_deg, upper.longitude_deg, fraction),
    altitude_km: lerp(lower.altitude_km, upper.altitude_km, fraction),
    velocity_km_s: lerp(lower.velocity_km_s, upper.velocity_km_s, fraction),
    orbit_id: lower.orbit_id,
  };
}

function lerp(start, end, fraction) {
  return start + (end - start) * fraction;
}

function interpolateLongitude(startDeg, endDeg, fraction) {
  let delta = endDeg - startDeg;
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  const interpolated = startDeg + delta * fraction;
  return ((interpolated + 180) % 360) - 180;
}

function formatTimestamp(timestampUtc) {
  return timestampUtc.replace(".000Z", "Z");
}

function renderMap() {
  const width = 960;
  const height = 460;
  const margin = 44;
  const plotWidth = width - 2 * margin;
  const plotHeight = height - 2 * margin;
  const bounds = centerBody.map_bounds;
  const lonSpan = bounds.longitude_max_deg - bounds.longitude_min_deg;
  const latSpan = bounds.latitude_max_deg - bounds.latitude_min_deg;
  const x = (lon) => margin + ((lon - bounds.longitude_min_deg) / lonSpan) * plotWidth;
  const y = (lat) => margin + ((bounds.latitude_max_deg - lat) / latSpan) * plotHeight;
  const path = orbitSamples
    .map((sample, index) => `${index === 0 ? "M" : "L"} ${x(sample.longitude_deg)} ${y(sample.latitude_deg)}`)
    .join(" ");
  const current = sampleAtPlaybackPosition();
  const magneticClusters = renderMagneticClusterMapMarkers(x, y, 0.55);

  elements.mapSvg.innerHTML = `
    <rect x="${margin}" y="${margin}" width="${plotWidth}" height="${plotHeight}" fill="#111827" stroke="#45516c" />
    <circle cx="${width - margin - 24}" cy="28" r="8" fill="${centerBody.color}" />
    <text class="label" x="${width - margin - 8}" y="32">${centerBody.display_name}</text>
    ${[-120, -60, 0, 60, 120].map((lon) => `<line class="grid-line" x1="${x(lon)}" y1="${margin}" x2="${x(lon)}" y2="${height - margin}" />`).join("")}
    ${[-60, -30, 0, 30, 60].map((lat) => `<line class="grid-line" x1="${margin}" y1="${y(lat)}" x2="${width - margin}" y2="${y(lat)}" />`).join("")}
    <text class="label" x="${margin}" y="28">Longitude / Latitude Ground Track</text>
    ${magneticClusters}
    <path class="track-line" d="${path}" />
    <circle class="marker" cx="${x(current.longitude_deg)}" cy="${y(current.latitude_deg)}" r="7" />
    <text class="label" x="${margin}" y="${height - 14}">Lon ${bounds.longitude_min_deg} to ${bounds.longitude_max_deg} deg, Lat ${bounds.latitude_min_deg} to ${bounds.latitude_max_deg} deg</text>
  `;
}

function renderMagneticMap() {
  const width = 960;
  const height = 500;
  const margin = 50;
  const plotWidth = width - 2 * margin;
  const plotHeight = height - 2 * margin;
  const bounds = centerBody.map_bounds;
  const lonSpan = bounds.longitude_max_deg - bounds.longitude_min_deg;
  const latSpan = bounds.latitude_max_deg - bounds.latitude_min_deg;
  const x = (lon) => margin + ((lon - bounds.longitude_min_deg) / lonSpan) * plotWidth;
  const y = (lat) => margin + ((bounds.latitude_max_deg - lat) / latSpan) * plotHeight;
  const current = sampleAtPlaybackPosition();
  const currentVector = magneticVectorForSample(current);
  const vectorScale = 4;
  const vectorEndX = x(current.longitude_deg) + currentVector.b_east_nt * vectorScale;
  const vectorEndY = y(current.latitude_deg) - currentVector.b_north_nt * vectorScale;

  elements.magneticSvg.innerHTML = `
    <rect x="${margin}" y="${margin}" width="${plotWidth}" height="${plotHeight}" fill="#10151f" stroke="#45516c" />
    <text class="label" x="${margin}" y="28">${magneticLayer.display_name}</text>
    <text class="label" x="${width - margin - 250}" y="28">Reference altitude ${magneticLayer.reference_altitude_km} km</text>
    ${[-120, -60, 0, 60, 120].map((lon) => `<line class="grid-line" x1="${x(lon)}" y1="${margin}" x2="${x(lon)}" y2="${height - margin}" />`).join("")}
    ${[-60, -30, 0, 30, 60].map((lat) => `<line class="grid-line" x1="${margin}" y1="${y(lat)}" x2="${width - margin}" y2="${y(lat)}" />`).join("")}
    ${renderMagneticClusterMapMarkers(x, y, 1.0)}
    <line class="magnetic-vector-arrow" x1="${x(current.longitude_deg)}" y1="${y(current.latitude_deg)}" x2="${vectorEndX}" y2="${vectorEndY}" />
    <circle class="marker" cx="${x(current.longitude_deg)}" cy="${y(current.latitude_deg)}" r="7" />
    <text class="label" x="${margin}" y="${height - 18}">Current B: R ${currentVector.b_radial_nt.toFixed(1)} nT, N ${currentVector.b_north_nt.toFixed(1)} nT, E ${currentVector.b_east_nt.toFixed(1)} nT, |B| ${currentVector.magnitude_nt.toFixed(1)} nT</text>
  `;
}

function renderMagneticClusterMapMarkers(x, y, opacityScale) {
  return magneticLayer.clusters.map((cluster) => {
    const radius = Math.max(8, cluster.sigma_deg * 2.1);
    const polarityClass = cluster.polarity >= 0 ? "positive" : "negative";
    const labelX = x(cluster.longitude_deg) + radius + 4;
    const labelY = y(cluster.latitude_deg) - 4;
    return `
      <circle class="magnetic-cluster ${polarityClass}" cx="${x(cluster.longitude_deg)}" cy="${y(cluster.latitude_deg)}" r="${radius}" opacity="${Math.min(0.8, opacityScale)}" />
      <circle class="magnetic-cluster-core ${polarityClass}" cx="${x(cluster.longitude_deg)}" cy="${y(cluster.latitude_deg)}" r="4" />
      <text class="magnetic-label" x="${labelX}" y="${labelY}">${cluster.name}</text>
    `;
  }).join("");
}

function renderOrbit3D() {
  const width = 960;
  const height = 560;
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  const bodyRadiusPx = 155;
  const orbitScale = bodyRadiusPx;
  const current = sampleAtPlaybackPosition();
  const projectedSamples = orbitSamples.map((sample) => projectOrbitSample(sample, orbitScale));
  const orbitPath = projectedSamples
    .map((point, index) => `${index === 0 ? "M" : "L"} ${centerX + point.x} ${centerY + point.y}`)
    .join(" ");
  const currentPoint = projectOrbitSample(current, orbitScale);
  const visibleCurrent = currentPoint.depth >= -0.15;
  const grid = renderBodyGrid(centerX, centerY, bodyRadiusPx);
  const referenceFrame = renderReferenceFrame(centerX, centerY, bodyRadiusPx);
  const magneticFieldLines = renderMagneticFieldLines3D(centerX, centerY, bodyRadiusPx);

  elements.orbit3dSvg.innerHTML = `
    <defs>
      <radialGradient id="moon-shade" cx="38%" cy="32%" r="72%">
        <stop offset="0%" stop-color="#d7dce4" />
        <stop offset="48%" stop-color="${centerBody.color}" />
        <stop offset="100%" stop-color="#4e5665" />
      </radialGradient>
      <filter id="soft-glow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#080b12" />
    <text class="label" x="28" y="34">${centerBody.display_name} centered orbit playback</text>
    <path class="orbit-back" d="${orbitPath}" />
    ${referenceFrame.back}
    <circle class="moon-disk" cx="${centerX}" cy="${centerY}" r="${bodyRadiusPx}" fill="url(#moon-shade)" />
    ${grid}
    ${referenceFrame.front}
    ${magneticFieldLines}
    <path class="orbit-front" d="${orbitPath}" />
    <circle class="satellite-marker ${visibleCurrent ? "" : "satellite-hidden"}" cx="${centerX + currentPoint.x}" cy="${centerY + currentPoint.y}" r="7" />
    <line class="satellite-radial" x1="${centerX}" y1="${centerY}" x2="${centerX + currentPoint.x}" y2="${centerY + currentPoint.y}" />
    <text class="label" x="28" y="${height - 54}">Generated sphere/projection. NASA Eyes is the visual reference; no NASA Eyes model asset is bundled.</text>
    <text class="label" x="28" y="${height - 28}">Lat ${current.latitude_deg.toFixed(2)} deg, Lon ${current.longitude_deg.toFixed(2)} deg, Alt ${current.altitude_km.toFixed(2)} km</text>
  `;
}

function projectOrbitSample(sample, scalePx) {
  const bodyRadiusKm = centerBody.radius_km || 1737.4;
  const radiusScale = 1 + sample.altitude_km / bodyRadiusKm;
  return projectSpherical(sample.latitude_deg, sample.longitude_deg, radiusScale, scalePx);
}

function projectSpherical(latitudeDeg, longitudeDeg, radiusScale, scalePx) {
  const lat = (latitudeDeg * Math.PI) / 180;
  const lon = (longitudeDeg * Math.PI) / 180;
  const x = radiusScale * Math.cos(lat) * Math.cos(lon);
  const y = radiusScale * Math.cos(lat) * Math.sin(lon);
  const z = radiusScale * Math.sin(lat);
  const yawX = x * Math.cos(orbitViewYawRad) - y * Math.sin(orbitViewYawRad);
  const yawY = x * Math.sin(orbitViewYawRad) + y * Math.cos(orbitViewYawRad);
  const pitchY = yawY * Math.cos(orbitViewPitchRad) - z * Math.sin(orbitViewPitchRad);
  const pitchZ = yawY * Math.sin(orbitViewPitchRad) + z * Math.cos(orbitViewPitchRad);

  return {
    x: yawX * scalePx,
    y: -pitchZ * scalePx,
    depth: pitchY,
  };
}

function renderReferenceFrame(centerX, centerY, bodyRadiusPx) {
  const axisScale = 1.34;
  const northPole = projectSpherical(90, 0, axisScale, bodyRadiusPx);
  const southPole = projectSpherical(-90, 0, axisScale, bodyRadiusPx);
  const equatorSamples = Array.from({ length: 73 }, (_, index) =>
    projectSpherical(0, index * 5, 1.04, bodyRadiusPx)
  );
  const equatorPath = equatorSamples
    .map((point, index) => `${index === 0 ? "M" : "L"} ${centerX + point.x} ${centerY + point.y}`)
    .join(" ");
  const axisMarkup = `
    <line class="rotation-axis" x1="${centerX + southPole.x}" y1="${centerY + southPole.y}" x2="${centerX + northPole.x}" y2="${centerY + northPole.y}" />
    <circle class="axis-pole" cx="${centerX + northPole.x}" cy="${centerY + northPole.y}" r="4" />
    <text class="axis-callout" x="${centerX + northPole.x + 8}" y="${centerY + northPole.y - 6}">N pole / rotation axis</text>
    <text class="axis-callout" x="${centerX + southPole.x + 8}" y="${centerY + southPole.y + 14}">S pole</text>
  `;
  const equatorMarkup = `<path class="equator-reference" d="${equatorPath}" />`;

  if ((northPole.depth + southPole.depth) / 2 < 0) {
    return { back: `${axisMarkup}${equatorMarkup}`, front: "" };
  }
  return { back: equatorMarkup, front: axisMarkup };
}

function renderMagneticFieldLines3D(centerX, centerY, bodyRadiusPx) {
  return magneticLayer.clusters.map((cluster) => {
    const anchor = projectSpherical(cluster.latitude_deg, cluster.longitude_deg, 1.035, bodyRadiusPx);
    const visibility = anchor.depth < -0.45 ? 0.18 : 0.78;
    const polarityClass = cluster.polarity >= 0 ? "positive" : "negative";
    const loops = [0.7, 1.0, 1.3].map((scale, loopIndex) => {
      const points = [];
      const latRadius = cluster.sigma_deg * 0.24 * scale;
      const lonRadius = cluster.sigma_deg * 0.42 * scale;
      const heightScale = 1.045 + loopIndex * 0.025;
      for (let step = 0; step <= 36; step += 1) {
        const angle = (step / 36) * Math.PI * 2;
        const lat = cluster.latitude_deg + Math.sin(angle) * latRadius;
        const lon = cluster.longitude_deg + Math.cos(angle) * lonRadius;
        const point = projectSpherical(lat, lon, heightScale + Math.sin(angle) ** 2 * 0.08, bodyRadiusPx);
        points.push(`${step === 0 ? "M" : "L"} ${centerX + point.x} ${centerY + point.y}`);
      }
      return `<path class="magnetic-field-line ${polarityClass}" d="${points.join(" ")}" opacity="${visibility}" />`;
    }).join("");

    return `
      ${loops}
      <circle class="magnetic-anchor ${polarityClass}" cx="${centerX + anchor.x}" cy="${centerY + anchor.y}" r="3.5" opacity="${visibility}" />
    `;
  }).join("");
}

function startOrbitDrag(event) {
  orbitDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startYawRad: orbitViewYawRad,
    startPitchRad: orbitViewPitchRad,
  };
  elements.orbit3dSvg.classList.add("dragging");
  elements.orbit3dSvg.setPointerCapture(event.pointerId);
}

function updateOrbitDrag(event) {
  if (!orbitDragState || event.pointerId !== orbitDragState.pointerId) {
    return;
  }
  const radiansPerPixel = 0.008;
  orbitViewYawRad = orbitDragState.startYawRad + (event.clientX - orbitDragState.startX) * radiansPerPixel;
  orbitViewPitchRad = clamp(
    orbitDragState.startPitchRad + (event.clientY - orbitDragState.startY) * radiansPerPixel,
    (-85 * Math.PI) / 180,
    (85 * Math.PI) / 180
  );
  renderOrbit3D();
}

function endOrbitDrag(event) {
  if (!orbitDragState || event.pointerId !== orbitDragState.pointerId) {
    return;
  }
  elements.orbit3dSvg.classList.remove("dragging");
  if (elements.orbit3dSvg.hasPointerCapture(event.pointerId)) {
    elements.orbit3dSvg.releasePointerCapture(event.pointerId);
  }
  orbitDragState = null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function renderBodyGrid(centerX, centerY, radiusPx) {
  const latitudes = [-60, -30, 0, 30, 60]
    .map((lat) => {
      const y = centerY - radiusPx * Math.sin((lat * Math.PI) / 180);
      const rx = radiusPx * Math.cos((lat * Math.PI) / 180);
      return `<ellipse class="body-grid" cx="${centerX}" cy="${y}" rx="${rx}" ry="${rx * 0.22}" />`;
    })
    .join("");
  const longitudes = [-60, -30, 0, 30, 60]
    .map((lon) => {
      const rotation = lon;
      return `<ellipse class="body-grid" cx="${centerX}" cy="${centerY}" rx="${radiusPx * 0.28}" ry="${radiusPx}" transform="rotate(${rotation} ${centerX} ${centerY})" />`;
    })
    .join("");
  return `${latitudes}${longitudes}`;
}

function renderPlots() {
  const width = 960;
  const marginLeft = 82;
  const marginRight = 36;
  const plotWidth = width - marginLeft - marginRight;
  const panelHeight = 150;
  const altitudeY = 52;
  const speedY = 282;
  const magneticY = 512;
  const altitudes = orbitSamples.map((sample) => sample.altitude_km);
  const speeds = orbitSamples.map((sample) => sample.velocity_km_s);
  const magneticVectors = orbitSamples.map((sample) => magneticVectorForSample(sample));
  const magneticMagnitudes = magneticVectors.map((vector) => vector.magnitude_nt);
  const magneticRadial = magneticVectors.map((vector) => vector.b_radial_nt);
  const magneticNorth = magneticVectors.map((vector) => vector.b_north_nt);
  const magneticEast = magneticVectors.map((vector) => vector.b_east_nt);
  const altDomain = domainWithPadding(altitudes);
  const speedDomain = domainWithPadding(speeds);
  const magneticDomain = domainWithPadding([
    ...magneticMagnitudes,
    ...magneticRadial,
    ...magneticNorth,
    ...magneticEast,
  ]);
  const x = (index) => marginLeft + (index / Math.max(1, orbitSamples.length - 1)) * plotWidth;
  const yAlt = (value) => altitudeY + ((altDomain.max - value) / (altDomain.max - altDomain.min)) * panelHeight;
  const ySpeed = (value) => speedY + ((speedDomain.max - value) / (speedDomain.max - speedDomain.min)) * panelHeight;
  const yMag = (value) => magneticY + ((magneticDomain.max - value) / (magneticDomain.max - magneticDomain.min)) * panelHeight;
  const altPath = altitudes.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${yAlt(value)}`).join(" ");
  const speedPath = speeds.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${ySpeed(value)}`).join(" ");
  const magPath = magneticMagnitudes.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${yMag(value)}`).join(" ");
  const radialPath = magneticRadial.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${yMag(value)}`).join(" ");
  const northPath = magneticNorth.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${yMag(value)}`).join(" ");
  const eastPath = magneticEast.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${yMag(value)}`).join(" ");
  const markerX = marginLeft + (playbackPosition / Math.max(1, orbitSamples.length - 1)) * plotWidth;
  const currentElapsedMin = elapsedMinutesAtPosition(playbackPosition);
  const maxElapsedMin = elapsedMinutesAtPosition(orbitSamples.length - 1);
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map((fraction) => ({
    x: marginLeft + fraction * plotWidth,
    value: maxElapsedMin * fraction,
  }));

  elements.plotSvg.innerHTML = `
    <text class="label" x="${marginLeft}" y="28">Altitude vs Time</text>
    <rect x="${marginLeft}" y="${altitudeY}" width="${plotWidth}" height="${panelHeight}" fill="#111827" stroke="#45516c" />
    ${renderPlotAxes({
      left: marginLeft,
      top: altitudeY,
      width: plotWidth,
      height: panelHeight,
      domain: altDomain,
      yLabel: "Altitude (km)",
      xLabel: "Elapsed time (min)",
      xTicks,
    })}
    <path class="plot-line-alt" d="${altPath}" />
    <line class="time-marker" x1="${markerX}" y1="${altitudeY}" x2="${markerX}" y2="${altitudeY + panelHeight}" />
    <text class="label" x="${marginLeft}" y="${speedY - 22}">Speed vs Time</text>
    <rect x="${marginLeft}" y="${speedY}" width="${plotWidth}" height="${panelHeight}" fill="#111827" stroke="#45516c" />
    ${renderPlotAxes({
      left: marginLeft,
      top: speedY,
      width: plotWidth,
      height: panelHeight,
      domain: speedDomain,
      yLabel: "Speed (km/s)",
      xLabel: "Elapsed time (min)",
      xTicks,
    })}
    <path class="plot-line-speed" d="${speedPath}" />
    <line class="time-marker" x1="${markerX}" y1="${speedY}" x2="${markerX}" y2="${speedY + panelHeight}" />
    <text class="label" x="${marginLeft}" y="${magneticY - 22}">Magnetic Field vs Time</text>
    <rect x="${marginLeft}" y="${magneticY}" width="${plotWidth}" height="${panelHeight}" fill="#111827" stroke="#45516c" />
    ${renderPlotAxes({
      left: marginLeft,
      top: magneticY,
      width: plotWidth,
      height: panelHeight,
      domain: magneticDomain,
      yLabel: "B (nT)",
      xLabel: "Elapsed time (min)",
      xTicks,
    })}
    <path class="plot-line-mag" d="${magPath}" />
    <path class="plot-line-radial" d="${radialPath}" />
    <path class="plot-line-north" d="${northPath}" />
    <path class="plot-line-east" d="${eastPath}" />
    <line class="time-marker" x1="${markerX}" y1="${magneticY}" x2="${markerX}" y2="${magneticY + panelHeight}" />
    <text class="plot-legend mag" x="${marginLeft + 12}" y="${magneticY + 20}">|B|</text>
    <text class="plot-legend radial" x="${marginLeft + 58}" y="${magneticY + 20}">R</text>
    <text class="plot-legend north" x="${marginLeft + 88}" y="${magneticY + 20}">N</text>
    <text class="plot-legend east" x="${marginLeft + 118}" y="${magneticY + 20}">E</text>
    <text class="label" x="${width - marginRight - 188}" y="28">Current t+${currentElapsedMin.toFixed(1)} min</text>
  `;
}

function renderPlotAxes({ left, top, width, height, domain, yLabel, xLabel, xTicks }) {
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((fraction) => {
    const value = domain.max - fraction * (domain.max - domain.min);
    const y = top + fraction * height;
    return { value, y };
  });
  const bottom = top + height;
  const right = left + width;

  return `
    <line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" />
    <line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" />
    ${xTicks.map((tick) => `
      <line class="axis-tick" x1="${tick.x}" y1="${bottom}" x2="${tick.x}" y2="${bottom + 6}" />
      <text class="tick-label" x="${tick.x}" y="${bottom + 22}" text-anchor="middle">${tick.value.toFixed(0)}</text>
    `).join("")}
    ${yTicks.map((tick) => `
      <line class="grid-line" x1="${left}" y1="${tick.y}" x2="${right}" y2="${tick.y}" />
      <line class="axis-tick" x1="${left - 6}" y1="${tick.y}" x2="${left}" y2="${tick.y}" />
      <text class="tick-label" x="${left - 10}" y="${tick.y + 4}" text-anchor="end">${formatTick(tick.value)}</text>
    `).join("")}
    <text class="axis-label" x="${left + width / 2}" y="${bottom + 42}" text-anchor="middle">${xLabel}</text>
    <text class="axis-label" x="${left - 58}" y="${top + height / 2}" text-anchor="middle" transform="rotate(-90 ${left - 58} ${top + height / 2})">${yLabel}</text>
  `;
}

function elapsedMinutesAtPosition(position) {
  const startTime = new Date(orbitSamples[0].timestamp_utc).getTime();
  const lowerIndex = Math.max(0, Math.min(orbitSamples.length - 1, Math.floor(position)));
  const upperIndex = Math.max(0, Math.min(orbitSamples.length - 1, lowerIndex + 1));
  const fraction = position - lowerIndex;
  const lowerTime = new Date(orbitSamples[lowerIndex].timestamp_utc).getTime();
  const upperTime = new Date(orbitSamples[upperIndex].timestamp_utc).getTime();
  const sampleTime = lerp(lowerTime, upperTime, fraction);
  return (sampleTime - startTime) / 60000;
}

function formatTick(value) {
  const absValue = Math.abs(value);
  if (absValue >= 100) {
    return value.toFixed(0);
  }
  if (absValue >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(3);
}

function domainWithPadding(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return {
    min: min - span * 0.1,
    max: max + span * 0.1,
  };
}

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
});

elements.playPause.addEventListener("click", () => {
  if (playing) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

elements.reset.addEventListener("click", resetPlayback);

elements.speed.addEventListener("change", () => {
  if (playing) {
    stopPlayback();
    startPlayback();
  }
});

elements.scrubber.addEventListener("input", () => {
  currentIndex = Number(elements.scrubber.value);
  playbackPosition = currentIndex;
  renderAll();
});

elements.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const text = await file.text();
  setOrbitPayload(JSON.parse(text), file.name);
});

Object.values(elements.generatorInputs).forEach((input) => {
  input.addEventListener("input", updateGeneratorOutputLabels);
});

elements.generateOrbit.addEventListener("click", generateOrbitFromInputs);

elements.orbit3dSvg.addEventListener("pointerdown", startOrbitDrag);
elements.orbit3dSvg.addEventListener("pointermove", updateOrbitDrag);
elements.orbit3dSvg.addEventListener("pointerup", endOrbitDrag);
elements.orbit3dSvg.addEventListener("pointercancel", endOrbitDrag);
elements.orbit3dSvg.addEventListener("lostpointercapture", () => {
  orbitDragState = null;
  elements.orbit3dSvg.classList.remove("dragging");
});

updateGeneratorOutputLabels();
loadDefaultOrbit();
loadDefaultMagneticLayer();
