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

export function clearDistributorStorage() {
  window.localStorage.removeItem('weakeningHosts');
  window.localStorage.removeItem('hackingHosts');
}

export function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}