(function () {
  // Paste the Apps Script Web App URL here after deploying it (see
  // apps-script/Code.gs for the script and setup steps). While this is
  // blank the form falls back to opening the visitor's mail client, so
  // it is never a dead end.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxAx4tuJd_E2YCq27VHrxiSQgQgER7ljIJZ7q8ZZuCyXb9ItDkuvqex_P6Xl-miCv9Z-A/exec';

  var FALLBACK_EMAIL = 'charlesathompsondesigns@gmail.com';

  function setStatus(form, message, state) {
    var el = form.querySelector('.form__status');
    if (!el) return;
    el.textContent = message;
    el.className = 'form__status' + (state ? ' form__status--' + state : '');
  }

  // Swap the whole form for a confirmation panel. Far harder to miss than a
  // line of text under the button, and it makes double-submitting impossible.
  function showSuccess(form, email) {
    var panel = document.createElement('div');
    panel.className = 'form-success';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML =
      '<svg class="form-success__mark" viewBox="0 0 52 52" aria-hidden="true" focusable="false">' +
        '<circle class="form-success__circle" cx="26" cy="26" r="24" />' +
        '<path class="form-success__check" d="M15 27.5 L22.5 35 L37.5 19" />' +
      '</svg>' +
      '<h3 class="form-success__title">Message sent</h3>' +
      '<p class="form-success__text"></p>' +
      '<button class="form-success__again" type="button">Send another message</button>';

    panel.querySelector('.form-success__text').textContent =
      'Thanks for reaching out. A confirmation is on its way to ' + email +
      ' — I’ll be in touch soon.';

    form.classList.add('is-sent');
    form.setAttribute('hidden', '');
    form.parentNode.insertBefore(panel, form.nextSibling);

    panel.querySelector('.form-success__again').addEventListener('click', function () {
      panel.remove();
      form.removeAttribute('hidden');
      form.classList.remove('is-sent');
      setStatus(form, '', '');
      var firstField = form.elements['first'];
      if (firstField) firstField.focus();
    });
  }

  function values(form) {
    var get = function (name) {
      var field = form.elements[name];
      return field && field.value ? field.value.trim() : '';
    };
    return {
      first: get('first'),
      last: get('last'),
      email: get('email'),
      subject: get('subject'),
      message: get('message'),
      company: get('company') // honeypot — real people leave this empty
    };
  }

  function validate(v) {
    if (!v.first) return 'Please add your first name.';
    if (!v.email) return 'Please add your email so I can reply.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return 'That email address looks incomplete.';
    if (!v.message) return 'Please add a message.';
    return null;
  }

  // Used when no endpoint is configured, or when the request fails — the
  // visitor still gets their message to its destination.
  function mailtoFallback(v) {
    var subject = v.subject || 'Portfolio inquiry';
    var body =
      'From: ' + v.first + ' ' + v.last + '\n' +
      'Email: ' + v.email + '\n\n' +
      v.message;
    window.location.href =
      'mailto:' + FALLBACK_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function handle(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var v = values(form);

      // Honeypot tripped — accept silently so bots get no signal.
      if (v.company) {
        setStatus(form, 'Thanks — your message is on its way.', 'ok');
        form.reset();
        return;
      }

      var problem = validate(v);
      if (problem) {
        setStatus(form, problem, 'error');
        return;
      }

      if (!ENDPOINT) {
        setStatus(form, 'Opening your email app…', '');
        mailtoFallback(v);
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      var label = button ? button.textContent : '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending…';
      }
      setStatus(form, 'Sending…', '');

      var body = new URLSearchParams();
      Object.keys(v).forEach(function (k) { body.append(k, v[k]); });
      body.append('page', window.location.pathname);

      // urlencoded keeps this a "simple" request — no CORS preflight, which
      // Apps Script web apps cannot answer.
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString()
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || data.result !== 'success') throw new Error('rejected');
          var sentTo = v.email;
          form.reset();
          setStatus(form, '', '');
          showSuccess(form, sentTo);
        })
        .catch(function () {
          setStatus(form, 'That didn’t send. Opening your email app instead…', 'error');
          mailtoFallback(v);
        })
        .then(function () {
          if (button) {
            button.disabled = false;
            button.textContent = label;
          }
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form.form');
    Array.prototype.forEach.call(forms, handle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
