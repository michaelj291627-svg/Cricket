const WPL = (() => {
  const MAX_PLAYERS = 6;

  function normalize(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function key(value) {
    return normalize(value).toLowerCase();
  }

  async function list() {
    const snapshot = await fb.getDocs(
      fb.collection(db, "teams")
    );

    const teams = [];

    snapshot.forEach(docSnap => {
      teams.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    return teams;
  }

  async function add(team) {
    await fb.addDoc(
      fb.collection(db, "teams"),
      {
        ...team,
        registeredOn: new Date().toISOString()
      }
    );
  }

  async function update(id, changes) {
    await fb.updateDoc(
      fb.doc(db, "teams", id),
      changes
    );
  }

  async function remove(id) {
    await fb.deleteDoc(
      fb.doc(db, "teams", id)
    );
  }

  async function removeAll() {
    const teams = await list();

    for (const t of teams) {
      await remove(t.id);
    }
  }

  function isTeamNameTaken(teams, name, exceptId) {
    return teams.some(
      t =>
        t.id !== exceptId &&
        key(t.teamName) === key(name)
    );
  }

  function playersUsedElsewhere(teams, players, exceptId) {
    const used = new Map();

    teams
      .filter(t => t.id !== exceptId)
      .forEach(t =>
        (t.players || []).forEach(
          p => used.set(key(p), t.teamName)
        )
      );

    return players
      .map(name => ({
        name,
        otherTeam: used.get(key(name))
      }))
      .filter(x => x.otherTeam);
  }

  return {
    MAX_PLAYERS,
    list,
    add,
    update,
    remove,
    removeAll,
    normalize,
    key,
    isTeamNameTaken,
    playersUsedElsewhere
  };
})();
``
