(function () {
  const form = document.getElementById('registrationForm');
  const playersContainer = document.getElementById('playersContainer');
  const message = document.getElementById('formMessage');

  for (let i = 1; i <= WPL.MAX_PLAYERS; i++) {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.htmlFor = 'player' + i;
    label.textContent = 'Player ' + i + ' ';
    const star = document.createElement('span');
    star.className = 'req';
    star.textContent = '*';
    label.appendChild(star);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'player' + i;
    input.name = 'player' + i;
    input.maxLength = 40;
    input.autocomplete = 'off';

    const error = document.createElement('div');
    error.className = 'error';
    error.id = 'err-player' + i;

    field.append(label, input, error);
    playersContainer.appendChild(field);
  }

  function setError(id, text) {
    const input = document.getElementById(id);
    const box = document.getElementById('err-' + id);
    input.classList.add('invalid');
    box.textContent = text;
    box.classList.add('show');
  }

  function clearErrors() {
    form.querySelectorAll('input').forEach(i => i.classList.remove('invalid'));
    form.querySelectorAll('.error').forEach(e => {
      e.textContent = '';
      e.classList.remove('show');
    });
    message.className = 'banner-msg';
    message.textContent = '';
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = 'banner-msg show ' + type;
    message.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,39}$/;

  function validate(teams) {
    clearErrors();
    let firstInvalid = null;
    const fail = (id, text) => {
      setError(id, text);
      if (!firstInvalid) firstInvalid = id;
    };

    const teamName = WPL.normalize(document.getElementById('teamName').value);
    const captainName = WPL.normalize(document.getElementById('captainName').value);

    if (!teamName) fail('teamName', 'Team name is required.');
    else if (teamName.length < 3) fail('teamName', 'Team name must be at least 3 characters.');
    else if (WPL.isTeamNameTaken(teams, teamName)) fail('teamName', 'This team name is already registered.');

    if (!captainName) fail('captainName', 'Captain name is required.');
    else if (!NAME_PATTERN.test(captainName)) fail('captainName', 'Enter a valid name (letters, spaces, . \' - only).');

    const players = [];
    const seen = new Map();
    for (let i = 1; i <= WPL.MAX_PLAYERS; i++) {
      const id = 'player' + i;
      const value = WPL.normalize(document.getElementById(id).value);
      players.push(value);

      if (!value) {
        fail(id, 'Player ' + i + ' name is required (6 players minimum).');
        continue;
      }
      if (!NAME_PATTERN.test(value)) {
        fail(id, 'Enter a valid name (letters, spaces, . \' - only).');
        continue;
      }
      const k = WPL.key(value);
      if (seen.has(k)) fail(id, 'Duplicate of Player ' + seen.get(k) + ' in this team.');
      else seen.set(k, i);
    }

    WPL.playersUsedElsewhere(teams, players.filter(Boolean)).forEach(dup => {
      const idx = players.findIndex(p => WPL.key(p) === WPL.key(dup.name));
      if (idx > -1) fail('player' + (idx + 1), '"' + dup.name + '" is already registered with team ' + dup.otherTeam + '.');
    });

    if (firstInvalid) {
      document.getElementById(firstInvalid).focus();
      return null;
    }

    return { teamName, captainName, players };
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const teams = await WPL.list();
      const data = validate(teams);
      if (!data) {
        showMessage('Please correct the highlighted fields before submitting.', 'error');
        return;
      }
      await WPL.add(data);
      form.reset();
      clearErrors();
      showMessage('Registration successful! Team "' + data.teamName + '" has been registered.', 'success');
    } catch (err) {
      showMessage('Could not save the registration: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('resetBtn').addEventListener('click', clearErrors);

  form.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function () {
      input.classList.remove('invalid');
      const box = document.getElementById('err-' + input.id);
      if (box) {
        box.textContent = '';
        box.classList.remove('show');
      }
    });
  });
})();
