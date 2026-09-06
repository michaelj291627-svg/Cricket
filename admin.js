(function () {
  const tbody = document.getElementById('teamsBody');
  const emptyState = document.getElementById('emptyState');
  const searchBox = document.getElementById('searchBox');
  const message = document.getElementById('adminMessage');
  const backdrop = document.getElementById('editBackdrop');
  const editForm = document.getElementById('editForm');
  const editPlayers = document.getElementById('editPlayers');
  const editMessage = document.getElementById('editMessage');

  const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,39}$/;

  for (let i = 1; i <= WPL.MAX_PLAYERS; i++) {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.htmlFor = 'edit-player' + i;
    label.textContent = 'Player ' + i + ' ';
    const star = document.createElement('span');
    star.className = 'req';
    star.textContent = '*';
    label.appendChild(star);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'edit-player' + i;
    input.maxLength = 40;

    const error = document.createElement('div');
    error.className = 'error';
    error.id = 'err-edit-player' + i;

    field.append(label, input, error);
    editPlayers.appendChild(field);
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = 'banner-msg show ' + type;
    setTimeout(() => (message.className = 'banner-msg'), 4000);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '-' : d.toLocaleString();
  }

  let cache = [];

  async function refresh() {
    try {
      cache = await WPL.list();
    } catch (err) {
      showMessage('Could not load registrations: ' + err.message, 'error');
      cache = [];
    }
    render();
  }

  function render() {
    const query = WPL.key(searchBox.value);
    const teams = cache;
    const filtered = query
      ? teams.filter(t =>
          WPL.key(t.teamName).includes(query) ||
          WPL.key(t.captainName).includes(query) ||
          (t.players || []).some(p => WPL.key(p).includes(query)))
      : teams;

    tbody.textContent = '';
    filtered.forEach((team, index) => {
      const tr = document.createElement('tr');

      const cells = [
        String(index + 1),
        team.teamName,
        team.captainName,
        null,
        formatDate(team.registeredOn)
      ];

      cells.forEach((value, i) => {
        const td = document.createElement('td');
        if (i === 3) {
          const ol = document.createElement('ol');
          ol.className = 'player-list';
          (team.players || []).forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            ol.appendChild(li);
          });
          td.appendChild(ol);
        } else {
          td.textContent = value;
        }
        tr.appendChild(td);
      });

      const actions = document.createElement('td');
      const editBtn = document.createElement('button');
      editBtn.className = 'secondary small';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openEdit(team.id));

      const delBtn = document.createElement('button');
      delBtn.className = 'danger small';
      delBtn.textContent = 'Delete';
      delBtn.style.marginLeft = '6px';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete registration for team "' + team.teamName + '"?')) return;
        try {
          await WPL.remove(team.id);
          await refresh();
          showMessage('Team "' + team.teamName + '" was deleted.', 'success');
        } catch (err) {
          showMessage('Delete failed: ' + err.message, 'error');
        }
      });

      actions.append(editBtn, delBtn);
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });

    emptyState.style.display = filtered.length ? 'none' : 'block';
    emptyState.textContent = teams.length ? 'No teams match your search.' : 'No teams registered yet.';
    document.getElementById('teamCount').textContent = teams.length + (teams.length === 1 ? ' team' : ' teams');
    const players = teams.reduce((sum, t) => sum + (t.players || []).length, 0);
    document.getElementById('playerCount').textContent = players + (players === 1 ? ' player' : ' players');
  }

  function clearEditErrors() {
    editForm.querySelectorAll('input').forEach(i => i.classList.remove('invalid'));
    editForm.querySelectorAll('.error').forEach(e => {
      e.textContent = '';
      e.classList.remove('show');
    });
    editMessage.className = 'banner-msg';
  }

  function openEdit(id) {
    const team = cache.find(t => t.id === id);
    if (!team) return;
    clearEditErrors();
    document.getElementById('editId').value = team.id;
    document.getElementById('edit-teamName').value = team.teamName || '';
    document.getElementById('edit-captainName').value = team.captainName || '';
    for (let i = 1; i <= WPL.MAX_PLAYERS; i++) {
      document.getElementById('edit-player' + i).value = (team.players || [])[i - 1] || '';
    }
    backdrop.classList.add('show');
    document.getElementById('edit-teamName').focus();
  }

  function closeEdit() {
    backdrop.classList.remove('show');
  }

  function setError(id, text) {
    document.getElementById(id).classList.add('invalid');
    const box = document.getElementById('err-' + id);
    box.textContent = text;
    box.classList.add('show');
  }

  function validateEdit() {
    clearEditErrors();
    const id = document.getElementById('editId').value;
    let firstInvalid = null;
    const fail = (field, text) => {
      setError(field, text);
      if (!firstInvalid) firstInvalid = field;
    };

    const teamName = WPL.normalize(document.getElementById('edit-teamName').value);
    const captainName = WPL.normalize(document.getElementById('edit-captainName').value);

    if (!teamName) fail('edit-teamName', 'Team name is required.');
    else if (teamName.length < 3) fail('edit-teamName', 'Team name must be at least 3 characters.');
    else if (WPL.isTeamNameTaken(cache, teamName, id)) fail('edit-teamName', 'Another team already uses this name.');

    if (!captainName) fail('edit-captainName', 'Captain name is required.');
    else if (!NAME_PATTERN.test(captainName)) fail('edit-captainName', 'Enter a valid name.');

    const players = [];
    const seen = new Map();
    for (let i = 1; i <= WPL.MAX_PLAYERS; i++) {
      const field = 'edit-player' + i;
      const value = WPL.normalize(document.getElementById(field).value);
      players.push(value);
      if (!value) {
        fail(field, 'Player ' + i + ' name is required.');
        continue;
      }
      if (!NAME_PATTERN.test(value)) {
        fail(field, 'Enter a valid name.');
        continue;
      }
      const k = WPL.key(value);
      if (seen.has(k)) fail(field, 'Duplicate of Player ' + seen.get(k) + '.');
      else seen.set(k, i);
    }

    WPL.playersUsedElsewhere(cache, players.filter(Boolean), id).forEach(dup => {
      const idx = players.findIndex(p => WPL.key(p) === WPL.key(dup.name));
      if (idx > -1) fail('edit-player' + (idx + 1), '"' + dup.name + '" is already in team ' + dup.otherTeam + '.');
    });

    if (firstInvalid) {
      document.getElementById(firstInvalid).focus();
      return null;
    }
    return { id, teamName, captainName, players };
  }

  editForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const data = validateEdit();
    if (!data) {
      editMessage.textContent = 'Please correct the highlighted fields.';
      editMessage.className = 'banner-msg show error';
      return;
    }
    const { id, ...changes } = data;
    try {
      await WPL.update(id, changes);
      closeEdit();
      await refresh();
      showMessage('Team "' + changes.teamName + '" was updated.', 'success');
    } catch (err) {
      editMessage.textContent = err.message;
      editMessage.className = 'banner-msg show error';
    }
  });

  document.getElementById('cancelEdit').addEventListener('click', closeEdit);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeEdit();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEdit();
  });

  searchBox.addEventListener('input', render);

  document.getElementById('clearAllBtn').addEventListener('click', async function () {
    if (!cache.length) return;
    if (!confirm('Delete ALL registered teams? This cannot be undone.')) return;
    try {
      await WPL.removeAll();
      await refresh();
      showMessage('All registrations were deleted.', 'success');
    } catch (err) {
      showMessage('Delete failed: ' + err.message, 'error');
    }
  });

  document.getElementById('exportBtn').addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wpl-2026-registrations.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  refresh();
  setInterval(refresh, 15000);
})();
