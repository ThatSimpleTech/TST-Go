(function () {
  if (window.__tstGoGeoPatched) return;
  window.__tstGoGeoPatched = true;
  window.__tstGoGeo = {
    enabled: false,
    lat: 40.758,
    lng: -73.9855,
    heading: null,
    speed: null,
    accuracy: 5,
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "tst-go-extension" || data.type !== "FIX") return;
    if (data.fix) window.__tstGoGeo = data.fix;
  });

  const geo = navigator.geolocation;
  if (!geo) return;

  const origGet = geo.getCurrentPosition.bind(geo);
  const origWatch = geo.watchPosition.bind(geo);
  const origClear = geo.clearWatch.bind(geo);
  const watches = new Map();

  function reading() {
    const g = window.__tstGoGeo;
    return {
      coords: {
        latitude: g.lat,
        longitude: g.lng,
        accuracy: g.accuracy || 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: g.heading == null ? null : g.heading,
        speed: g.speed == null ? null : g.speed,
        toJSON() {
          return this;
        },
      },
      timestamp: Date.now(),
      toJSON() {
        return this;
      },
    };
  }

  geo.getCurrentPosition = function (success, error, options) {
    const g = window.__tstGoGeo;
    if (g && g.enabled && typeof success === "function") {
      success(reading());
      return;
    }
    return origGet(success, error, options);
  };

  geo.watchPosition = function (success, error, options) {
    const g = window.__tstGoGeo;
    if (!(g && g.enabled) || typeof success !== "function") {
      return origWatch(success, error, options);
    }
    const id = Math.floor(Math.random() * 1e9) + 1;
    success(reading());
    const timer = setInterval(() => {
      if (!window.__tstGoGeo || !window.__tstGoGeo.enabled) return;
      success(reading());
    }, 1000);
    watches.set(id, timer);
    return id;
  };

  geo.clearWatch = function (id) {
    const timer = watches.get(id);
    if (timer) {
      clearInterval(timer);
      watches.delete(id);
      return;
    }
    return origClear(id);
  };
})();
