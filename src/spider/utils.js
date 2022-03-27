export function get(key) {
  return JSON.parse(window.localStorage.getItem(key));
}

export function set(key, data) {
  return window.localStorage.setItem(key, JSON.stringify(data));
}

export function clearSpiderStorage() {
  window.localStorage.removeItem('rootedHosts');
  window.localStorage.removeItem('discoveredHosts');
}