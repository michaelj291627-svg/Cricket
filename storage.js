/* Shared data layer for WPL-2026 registrations, backed by the server API. */
const WPL = (() => {
  const API = '/api/teams';
  const MAX_PLAYERS = 6;

  async function request(url, options) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ').');
    return data;
  }

  function normalize(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  }

  function key(value) {
    return normalize(value).toLowerCase();
  }

  const list = () => request(API);
  const add = team => request(API, { method: 'POST', body: JSON.stringify(team) });
  const update = (id, changes) => request(API + '/' + id, { method: 'PUT', body: JSON.stringify(changes) });
  const remove = id => request(API + '/' + id, { method: 'DELETE' });
  const removeAll = () => request(API, { method: 'DELETE' });

  function isTeamNameTaken(teams, name, exceptId) {
    return teams.some(t => t.id !== exceptId && key(t.teamName) === key(name));
  }

  /* Players already registered with another team, per tournament rule 3. */
  function playersUsedElsewhere(teams, players, exceptId) {
    const used = new Map();
    teams
      .filter(t => t.id !== exceptId)
      .forEach(t => (t.players || []).forEach(p => used.set(key(p), t.teamName)));
    return players
      .map(name => ({ name, otherTeam: used.get(key(name)) }))
      .filter(x => x.otherTeam);
  }

  return { MAX_PLAYERS, list, add, update, remove, removeAll, normalize, key, isTeamNameTaken, playersUsedElsewhere };
})();
