/* ═══════════════════════════════════════════════════════════════════════
   New Mexico Track Club — shared client-side logic.
   Loaded by every page (index.html, workouts.html, membership.html).

   Modules run in independent IIFEs and each check for the DOM they need
   before doing anything, so pages that don't have (say) the results grid
   or the contact form silently skip those modules.
   ═══════════════════════════════════════════════════════════════════════ */

/* ─── NAV: highlight current page + hamburger + form ─────────────────── */
(function () {
  'use strict';

  // Highlight the nav link that matches the current page.
  // Uses the last path segment (index.html, workouts.html, membership.html).
  function highlightNav() {
    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    var page = file.replace(/\.html$/i, '');
    if (page === '' || page === 'index') page = 'home';
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.classList.remove('active');
    });
    var current = document.getElementById('nav-' + page);
    if (current) current.classList.add('active');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', highlightNav);
  } else {
    highlightNav();
  }

  // ─── HAMBURGER MENU ──────────────────────────────────────────────────
  var navEl = document.querySelector('nav');
  var toggle = document.querySelector('.nav-toggle');
  function closeMobileMenu() {
    if (!navEl) return;
    navEl.classList.remove('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  if (toggle && navEl) {
    toggle.addEventListener('click', function () {
      var open = navEl.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  // Close menu when any nav link is clicked (mobile)
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', closeMobileMenu);
  });
  // Close menu on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMobileMenu();
  });

  // ─── CONTACT FORM (Formspree) ────────────────────────────────────────
  // Only present on membership.html. On other pages this module no-ops.
  var CONTACT_EMAIL = 'nmtrackclub@gmail.com';

  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');

  // kind: 'info' (default), 'success', 'error'
  function setStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg;
    status.className = 'form-status visible';
    if (kind === 'error')   status.classList.add('error');
    if (kind === 'success') status.classList.add('success');
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name    = (form.elements['name'].value    || '').trim();
      var email   = (form.elements['email'].value   || '').trim();
      var interest= (form.elements['interest'].value|| '').trim();
      var message = (form.elements['message'].value || '').trim();

      if (!name || !email || !message) {
        setStatus('Please fill in your name, email, and message.', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus('That email address doesn’t look right — please double-check.', 'error');
        return;
      }

      var subjectField = form.querySelector('input[name="_subject"]');
      if (subjectField && interest) {
        subjectField.value = 'NMTC website: ' + interest;
      }

      var button = form.querySelector('button[type="submit"]');
      var originalLabel = button ? button.textContent : '';
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
      setStatus('Sending your message…', 'info');

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
      .then(function (resp) {
        if (resp.ok) {
          form.reset();
          setStatus("Thanks — your message is on its way. We'll reply as soon as we can.", 'success');
          return;
        }
        return resp.json().then(function (data) {
          var msg = (data && data.errors && data.errors[0] && data.errors[0].message) ||
                    'Sorry, something went wrong.';
          throw new Error(msg);
        }, function () {
          throw new Error('Sorry, something went wrong.');
        });
      })
      .catch(function () {
        setStatus("Sorry — your message couldn't be sent right now. Please email us directly at " +
                  CONTACT_EMAIL + '.', 'error');
      })
      .then(function () {
        if (button) { button.disabled = false; button.textContent = originalLabel; }
      });
    });
  }
})();

/* ═══════════════════════════════════════════════════════════════════════
   Shared utilities used by the CSV-backed feature modules (upcoming
   events, recent results). Exposed via window.NMTC.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var NMTC = window.NMTC = window.NMTC || {};

  // Minimal CSV parser — handles quoted fields containing commas or newlines.
  NMTC.parseCSV = function (text) {
    var rows = [], row = [], field = '', inQuotes = false, i = 0;
    while (i < text.length) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i+1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQuotes = false; i++; continue; }
        field += c; i++;
      } else {
        if (c === '"' && field === '') { inQuotes = true; i++; continue; }
        if (c === ',') { row.push(field); field = ''; i++; continue; }
        if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i+1] === '\n') i++;
          row.push(field); rows.push(row);
          row = []; field = ''; i++; continue;
        }
        field += c; i++;
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  };

  NMTC.csvToObjects = function (text) {
    var rows = NMTC.parseCSV(text).filter(function (r) {
      return r.some(function (c) { return c.trim(); });
    });
    if (rows.length < 2) return [];
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var obj = {};
      header.forEach(function (h, i) { obj[h] = (r[i] || '').trim(); });
      return obj;
    });
  };

  NMTC.escapeHTML = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Parse YYYY-MM-DD as a local date (avoids the UTC-shift trap).
  NMTC.parseISO = function (iso) {
    if (!iso) return null;
    var parts = iso.split('-');
    if (parts.length !== 3) return null;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return isNaN(d.getTime()) ? null : d;
  };

  NMTC.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  };

  // Fetch + parse a CSV. Returns rows as [{col: value, …}, …] via onSuccess.
  NMTC.fetchCSV = function (url, onSuccess, onError) {
    fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) { onSuccess(NMTC.csvToObjects(text)); })
      .catch(function (err) { if (onError) onError(err); });
  };
})();
/* ═══════════════════════════════════════════════════════════════════════
   UPCOMING EVENTS — data-driven from a CSV file.

   HOW TO UPDATE THE EVENTS LIST
   -----------------------------
   (1) Simple option — edit events.csv in this folder directly.
       Columns:   date, end_date, name, location, description, link
       date:      YYYY-MM-DD (e.g. 2026-09-15) — required
       end_date:  YYYY-MM-DD — optional, for multi-day events (leave
                  blank for single-day). Rows are hidden automatically
                  once end_date (or date if none) is in the past.
       location:  wrap in double quotes if it contains a comma,
                  e.g. "St. George, Utah"
       link:      full URL or leave blank

   (2) Recommended — publish a Google Sheet as CSV and swap the URL below.
       In Google Sheets:  File → Share → Publish to web → CSV → Publish.
       Copy the URL Google gives you and replace the value of
       EVENTS_CSV_URL below with it. That's the only change needed —
       the site will re-fetch it on every page load.

       Optional: attach a Google Form to that sheet (Insert → Form) so
       whoever maintains events can add entries via a friendly form
       instead of editing the sheet directly.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var EVENTS_CSV_URL = 'events.csv';   // ← replace with published Sheets URL when ready
  var TEASER_COUNT = 3;                // number of events on the home page teaser

  function formatDateParts(iso) {
    var d = NMTC.parseISO(iso);
    if (!d) return { month: '', day: '' };
    return {
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: d.getDate()
    };
  }

  var MONTH_LONG = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

  // Returns a human-readable date range, or "" for single-day / invalid ranges.
  //   Same month:   "October 5–17"
  //   Cross month:  "October 30 – November 2"
  //   Cross year:   "December 30, 2026 – January 3, 2027"
  function formatDateRange(startISO, endISO) {
    if (!endISO || endISO <= startISO) return '';   // treat as single-day
    var s = NMTC.parseISO(startISO), e = NMTC.parseISO(endISO);
    if (!s || !e) return '';
    var sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    var sameYear = s.getFullYear() === e.getFullYear();
    if (sameMonth) {
      return MONTH_LONG[s.getMonth()] + ' ' + s.getDate() + '–' + e.getDate();
    }
    if (sameYear) {
      return MONTH_LONG[s.getMonth()] + ' ' + s.getDate() +
             ' – ' +
             MONTH_LONG[e.getMonth()] + ' ' + e.getDate();
    }
    return MONTH_LONG[s.getMonth()] + ' ' + s.getDate() + ', ' + s.getFullYear() +
           ' – ' +
           MONTH_LONG[e.getMonth()] + ' ' + e.getDate() + ', ' + e.getFullYear();
  }

  function renderCard(ev) {
    var esc = NMTC.escapeHTML;
    var d = formatDateParts(ev.date);
    var range = formatDateRange(ev.date, ev.end_date);   // "" if single-day
    var link = ev.link ? '<a class="event-link" href="' + esc(ev.link) +
                         '" target="_blank" rel="noopener">Details →</a>' : '';

    // Meta line: date range (if multi-day) · location
    var metaParts = [];
    if (range) metaParts.push(range);
    if (ev.location) metaParts.push(ev.location);
    var meta = metaParts.length
      ? '<p class="event-meta">' + esc(metaParts.join(' · ')) + '</p>'
      : '';
    var desc = ev.description ? '<p class="event-desc">' + esc(ev.description) + '</p>' : '';

    return '<article class="event-card">' +
             '<div class="event-date">' +
               '<span class="event-date-month">' + esc(d.month) + '</span>' +
               '<span class="event-date-day">' + esc(String(d.day)) + '</span>' +
             '</div>' +
             '<div class="event-body">' +
               '<h3 class="event-name">' + esc(ev.name || '') + '</h3>' +
               meta +
               desc +
             '</div>' +
             link +
           '</article>';
  }

  function renderFull(events) {
    var container = document.getElementById('events-full');
    if (!container) return;
    if (events.length === 0) {
      container.innerHTML = '<p class="events-empty">No upcoming events scheduled right now. Check back soon, or contact us for what\'s next.</p>';
      return;
    }
    container.innerHTML = events.map(renderCard).join('');
  }

  function renderTeaser(events) {
    var section = document.getElementById('events-teaser-section');
    var container = document.getElementById('events-teaser');
    if (!section || !container) return;
    if (events.length === 0) {
      section.hidden = true;   // no teaser on Home if nothing upcoming
      return;
    }
    container.innerHTML = events.slice(0, TEASER_COUNT).map(renderCard).join('');
    section.hidden = false;
  }

  function loadEvents() {
    NMTC.fetchCSV(EVENTS_CSV_URL, function (rows) {
      var today = NMTC.todayISO();
      var events = rows
        .filter(function (e) {
          if (!e.date) return false;
          // Multi-day events stay visible until end_date passes.
          var effectiveEnd = e.end_date || e.date;
          return effectiveEnd >= today;
        })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      renderFull(events);
      renderTeaser(events);
    }, function (err) {
      // Silent fail: hide teaser, leave a soft message on the full section.
      var section = document.getElementById('events-teaser-section');
      if (section) section.hidden = true;
      var container = document.getElementById('events-full');
      if (container) {
        container.innerHTML = '<p class="events-empty">Event listings unavailable right now. Please check back shortly.</p>';
      }
      // Uncomment for debugging: console.warn('Events fetch failed:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEvents);
  } else {
    loadEvents();
  }
})();
/* ═══════════════════════════════════════════════════════════════════════
   RECENT RESULTS — event-grouped view with auto-selected sub-grouping.

   Rows in results.csv are grouped by (date + event) into one card per
   event, then subgrouped inside each card. The sub-grouping is chosen
   per event by GROUP_BY_KEY:

     "auto"       (default) — road races (single discipline) are grouped
                              by discipline (one clean sub-heading); multi-
                              discipline meets are grouped by member so
                              each athlete's results appear together.
     "discipline" — force every event to group by discipline.
     "member"     — force every event to group by member.

   Columns in results.csv:
     date, event, location, discipline, member, place, time, note, link
   (event + date is the grouping key; discipline is required; place and
   time are both optional so field events can list place-only.)

   Every event in the CSV is shown, most-recently-finished first.
   Current-year events list as individual cards; previous years are
   grouped under a collapsed "YYYY Results" dropdown per year.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var RESULTS_CSV_URL = 'results.csv';    // ← replace with published Sheets URL when ready
  var GROUP_BY_KEY = 'discipline';              // "auto" | "discipline" | "member"

  var MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec'];
  var MONTH_LONG  = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

  function formatShortDate(iso) {
    var d = NMTC.parseISO(iso);
    if (!d) return '';
    return MONTH_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  // "Jun 17-20, 2026"  /  "Jun 30 - Jul 3, 2026"  /  "Dec 30, 2026 - Jan 3, 2027"
  function formatShortDateRange(startISO, endISO) {
    if (!endISO || startISO === endISO) return formatShortDate(startISO);
    var s = NMTC.parseISO(startISO), e = NMTC.parseISO(endISO);
    if (!s || !e) return formatShortDate(startISO);
    var sameYear  = s.getFullYear() === e.getFullYear();
    var sameMonth = sameYear && s.getMonth() === e.getMonth();
    if (sameMonth) {
      return MONTH_SHORT[s.getMonth()] + ' ' + s.getDate() + '-' + e.getDate() +
             ', ' + s.getFullYear();
    }
    if (sameYear) {
      return MONTH_SHORT[s.getMonth()] + ' ' + s.getDate() + ' - ' +
             MONTH_SHORT[e.getMonth()] + ' ' + e.getDate() + ', ' + s.getFullYear();
    }
    return MONTH_SHORT[s.getMonth()] + ' ' + s.getDate() + ', ' + s.getFullYear() +
           ' - ' +
           MONTH_SHORT[e.getMonth()] + ' ' + e.getDate() + ', ' + e.getFullYear();
  }

  // "JUNE 17" — year omitted because the event header already carries it.
  function formatDayHeader(iso) {
    var d = NMTC.parseISO(iso);
    if (!d) return '';
    return (MONTH_LONG[d.getMonth()] + ' ' + d.getDate()).toUpperCase();
  }

  // Group flat rows by (event + year). Multi-day rows collapse into one
  // card; annual recurrences of the same event (2026 vs 2027) stay
  // separate. Each event tracks its startDate/endDate for the header
  // range. Sorted by endDate descending (most-recently-finished first).
  function groupIntoEvents(rows) {
    var seen = {};
    var events = [];
    rows.forEach(function (r) {
      if (!r.date || !r.event || !r.member) return;
      var year = r.date.substring(0, 4);
      var key = r.event.toLowerCase().trim() + '|' + year;
      if (!(key in seen)) {
        seen[key] = {
          name: r.event,
          location: r.location || '',
          link: r.link || '',
          startDate: r.date,
          endDate: r.date,
          results: []
        };
        events.push(seen[key]);
      }
      seen[key].results.push(r);
      if (!seen[key].link && r.link) seen[key].link = r.link;
      if (r.date < seen[key].startDate) seen[key].startDate = r.date;
      if (r.date > seen[key].endDate)   seen[key].endDate   = r.date;
    });
    events.sort(function (a, b) {
      return a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0;
    });
    return events;
  }

  // Pick which key to sub-group by for a given event.
  // "auto" heuristic: one discipline → by discipline (road-race shape);
  //                   two+ disciplines → by member (track-meet shape).
  function chooseGrouping(event, setting) {
    if (setting === 'discipline' || setting === 'member') return setting;
    var disciplines = {};
    event.results.forEach(function (r) { disciplines[r.discipline || ''] = true; });
    return Object.keys(disciplines).length <= 1 ? 'discipline' : 'member';
  }

  // Sub-group an event's rows by a key (preserving first-appearance order).
  function subgroupBy(rows, key) {
    var seen = {};
    var groups = [];
    rows.forEach(function (r) {
      var k = r[key] || '(unspecified)';
      if (!(k in seen)) {
        seen[k] = { name: k, rows: [] };
        groups.push(seen[k]);
      }
      seen[k].rows.push(r);
    });
    return groups;
  }

  function renderResultRow(r, groupBy) {
    var esc = NMTC.escapeHTML;
    // In "by discipline" layout, the primary column is member name.
    // In "by member"     layout, the primary column is discipline.
    var primary = groupBy === 'discipline' ? (r.member || '') : (r.discipline || '');
    var place = r.place ? '<span class="result-place">' + esc(r.place) + '</span>' : '<span class="result-place"></span>';
    var time  = r.time  ? '<span class="result-time">'  + esc(r.time)  + '</span>' : '<span class="result-time"></span>';
    var note  = r.note  ? '<div class="result-note">'   + esc(r.note)  + '</div>' : '';
    return '<div class="result-row">' +
             '<span class="result-primary">' + esc(primary) + '</span>' +
             place + time + note +
           '</div>';
  }

  // Render one discipline (or member) sub-group as HTML.
  function renderSubgroup(group, groupBy) {
    var esc = NMTC.escapeHTML;
    var rowsHTML = group.rows.map(function (r) {
      return renderResultRow(r, groupBy);
    }).join('');
    return '<div class="result-subgroup">' +
             '<div class="result-subgroup-name">' + esc(group.name) + '</div>' +
             rowsHTML +
           '</div>';
  }

  function pluralize(n, singular, plural) {
    return n + ' ' + (n === 1 ? singular : (plural || singular + 's'));
  }

  function renderEventCard(event, groupBy) {
    var esc = NMTC.escapeHTML;

    // Header: title on the left; location · date range (link if any) plus a
    // small "X disciplines · Y results" line on the right. The whole header
    // sits inside <summary> so clicking anywhere toggles the card open/closed.
    // The link inside meta stops propagation so clicking it navigates
    // rather than toggling.
    var metaBits = [];
    if (event.location) metaBits.push(esc(event.location));
    metaBits.push(esc(formatShortDateRange(event.startDate, event.endDate)));
    var metaText = metaBits.join(' · ');
    var metaHTML = event.link
      ? '<a href="' + esc(event.link) + '" target="_blank" rel="noopener" ' +
        'onclick="event.stopPropagation()">' + metaText + '</a>'
      : metaText;

    // Counts: distinct disciplines · total result rows
    var disciplines = {};
    event.results.forEach(function (r) { disciplines[r.discipline || ''] = true; });
    var countsText = pluralize(Object.keys(disciplines).length, 'discipline') +
                     ' · ' +
                     pluralize(event.results.length, 'result');

    var header = '<summary class="event-result-header">' +
                   '<div class="event-result-header-text">' +
                     '<div class="event-result-title">' + esc(event.name) + '</div>' +
                     '<div class="event-result-meta-block">' +
                       '<div class="event-result-meta">' + metaHTML + '</div>' +
                       '<div class="event-result-counts">' + esc(countsText) + '</div>' +
                     '</div>' +
                   '</div>' +
                   '<span class="event-result-toggle" aria-hidden="true"></span>' +
                 '</summary>';

    // Multi-day → group rows by date first, then by discipline within each day.
    // Single-day → keep the flat discipline sub-groups (existing shape).
    var body;
    if (event.startDate !== event.endDate) {
      // Collect distinct dates in ascending order.
      var seenDates = {};
      var dates = [];
      event.results.forEach(function (r) {
        if (!(r.date in seenDates)) { seenDates[r.date] = true; dates.push(r.date); }
      });
      dates.sort();
      body = dates.map(function (date) {
        var dayRows = event.results.filter(function (r) { return r.date === date; });
        var innerGroups = subgroupBy(dayRows, groupBy);
        var innerHTML = innerGroups.map(function (g) {
          return renderSubgroup(g, groupBy);
        }).join('');
        return '<div class="result-day-block">' +
                 '<div class="result-day-header">' + esc(formatDayHeader(date)) + '</div>' +
                 innerHTML +
               '</div>';
      }).join('');
    } else {
      var groups = subgroupBy(event.results, groupBy);
      body = groups.map(function (g) { return renderSubgroup(g, groupBy); }).join('');
    }

    return '<article class="event-result-card">' +
             '<details class="event-result-details">' +
               header + body +
             '</details>' +
           '</article>';
  }

  function eventYear(event) {
    return (event.endDate || event.startDate || '').substring(0, 4);
  }

  function renderEventList(events) {
    return events.map(function (e) {
      return renderEventCard(e, chooseGrouping(e, GROUP_BY_KEY));
    }).join('');
  }

  function renderYearArchive(year, events) {
    var esc = NMTC.escapeHTML;
    return '<div class="results-year-archive">' +
             '<details class="results-year-details">' +
               '<summary class="results-year-header">' +
                 '<span class="results-year-title">' + esc(year) + ' Results</span>' +
                 '<span class="event-result-toggle" aria-hidden="true"></span>' +
               '</summary>' +
               '<div class="results-year-events">' +
                 renderEventList(events) +
               '</div>' +
             '</details>' +
           '</div>';
  }

  function render(events) {
    var section = document.getElementById('results-section');
    var container = document.getElementById('results-grid');
    if (!section || !container) return;
    if (events.length === 0) {
      container.innerHTML = '<p class="results-empty">No results yet. Check back after our next event.</p>';
      section.hidden = false;
      return;
    }

    var currentYear = String(new Date().getFullYear());
    var current = [];
    var byYear = {};
    var pastYears = [];
    events.forEach(function (e) {
      var y = eventYear(e);
      if (!y || y >= currentYear) {
        current.push(e);
      } else if (!(y in byYear)) {
        byYear[y] = [e];
        pastYears.push(y);
      } else {
        byYear[y].push(e);
      }
    });
    pastYears.sort(function (a, b) { return a < b ? 1 : a > b ? -1 : 0; });

    var html = renderEventList(current);
    pastYears.forEach(function (y) {
      html += renderYearArchive(y, byYear[y]);
    });
    container.innerHTML = html;
    section.hidden = false;
  }

  function loadResults() {
    NMTC.fetchCSV(RESULTS_CSV_URL, function (rows) {
      var events = groupIntoEvents(rows);
      render(events);
    }, function () {
      var section = document.getElementById('results-section');
      var container = document.getElementById('results-grid');
      if (container) {
        container.innerHTML = '<p class="results-empty">Results unavailable right now. Please check back shortly.</p>';
      }
      if (section) section.hidden = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadResults);
  } else {
    loadResults();
  }
})();

/* ═══════════════════════════════════════════════════════════════════════
   PHOTO GALLERY — event-grouped view.

   Rows in gallery.csv are grouped by (event + date) into event cards.
   Each card shows a header (event, location, date) and a thumbnail grid.
   Thumbnails link to the full image.

   Columns in gallery.csv:
     event, date, location, filename, caption, credit
   (event + date is the grouping key; filename is required; caption and
   credit are optional per-photo metadata.)
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var GALLERY_CSV_URL = 'gallery.csv';

  var MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec'];

  function formatShortDate(iso) {
    var d = NMTC.parseISO(iso);
    if (!d) return '';
    return MONTH_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  // Group flat rows by (event + date). Returns array newest first.
  // Each event has { name, date, location, photos: [row,…] }.
  function groupIntoEvents(rows) {
    var seen = {};
    var events = [];
    rows.forEach(function (r) {
      if (!r.filename) return;
      var key = (r.event || '').toLowerCase().trim() + '|' + (r.date || '');
      if (!(key in seen)) {
        seen[key] = {
          name: r.event || '',
          date: r.date || '',
          location: r.location || '',
          photos: []
        };
        events.push(seen[key]);
      }
      seen[key].photos.push(r);
    });
    events.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return events;
  }

  function pluralize(n, singular, plural) {
    return n + ' ' + (n === 1 ? singular : (plural || singular + 's'));
  }

  function renderEventCard(event) {
    var esc = NMTC.escapeHTML;

    var metaBits = [];
    if (event.location) metaBits.push(esc(event.location));
    if (event.date)     metaBits.push(esc(formatShortDate(event.date)));
    var meta = metaBits.join(' · ');

    var thumbs = event.photos.map(function (p) {
      var alt = p.caption || event.name || 'Photo';
      var caption = p.caption
        ? '<p class="gallery-caption">' + esc(p.caption) +
          (p.credit ? ' <span style="opacity:0.7">(photo: ' + esc(p.credit) + ')</span>' : '') +
          '</p>'
        : (p.credit ? '<p class="gallery-caption" style="opacity:0.7">Photo: ' + esc(p.credit) + '</p>' : '');
      // href stays so the link works with JS disabled — but no target="_blank",
      // so the fallback opens same-tab (back button returns to the gallery).
      // With JS enabled, initLightbox() intercepts the click and shows an overlay instead.
      return '<figure class="gallery-item">' +
               '<a class="gallery-thumb" href="' + esc(p.filename) + '">' +
                 '<img src="' + esc(p.filename) + '" alt="' + esc(alt) + '" loading="lazy">' +
               '</a>' +
               caption +
             '</figure>';
    }).join('');

    var countsText = pluralize(event.photos.length, 'photo');

    return '<article class="gallery-event-card">' +
             '<details class="gallery-event-details">' +
               '<summary class="gallery-event-header">' +
                 '<div class="gallery-event-header-text">' +
                   '<div class="gallery-event-title">' + esc(event.name) + '</div>' +
                   '<div class="gallery-event-meta-block">' +
                     '<div class="gallery-event-meta">' + meta + '</div>' +
                     '<div class="gallery-event-counts">' + esc(countsText) + '</div>' +
                   '</div>' +
                 '</div>' +
                 '<span class="gallery-event-toggle" aria-hidden="true"></span>' +
               '</summary>' +
               '<div class="gallery-grid">' + thumbs + '</div>' +
             '</details>' +
           '</article>';
  }

  function render(events) {
    var container = document.getElementById('gallery-events');
    if (!container) return;
    if (events.length === 0) {
      container.innerHTML = '<p class="gallery-empty">No photos yet. Check back soon.</p>';
      return;
    }
    container.innerHTML = events.map(renderEventCard).join('');
    initLightbox();
  }

  function loadGallery() {
    NMTC.fetchCSV(GALLERY_CSV_URL, function (rows) {
      render(groupIntoEvents(rows));
    }, function () {
      var container = document.getElementById('gallery-events');
      if (container) {
        container.innerHTML = '<p class="gallery-empty">Gallery unavailable right now. Please check back shortly.</p>';
      }
    });
  }

  // ─── LIGHTBOX ────────────────────────────────────────────────────────
  // Overlays a full-size photo on top of the gallery page instead of opening
  // a new tab. Prev/next steps through the photos of the event the visitor
  // clicked into. Escape and arrow keys work; tap outside the image closes.
  var lb = { el: null, img: null, cap: null, cnt: null,
             prev: null, next: null, photos: [], index: 0, inited: false };

  function initLightbox() {
    if (lb.inited) return;   // create the overlay once, reuse for every click
    lb.inited = true;

    lb.el = document.createElement('div');
    lb.el.className = 'lightbox';
    lb.el.hidden = true;
    lb.el.setAttribute('role', 'dialog');
    lb.el.setAttribute('aria-modal', 'true');
    lb.el.setAttribute('aria-label', 'Photo viewer');
    lb.el.innerHTML =
      '<button class="lightbox-close" type="button" aria-label="Close (Esc)">×</button>' +
      '<button class="lightbox-prev"  type="button" aria-label="Previous photo (←)">‹</button>' +
      '<button class="lightbox-next"  type="button" aria-label="Next photo (→)">›</button>' +
      '<div class="lightbox-stage">' +
        '<img class="lightbox-img" src="" alt="">' +
        '<div class="lightbox-caption"></div>' +
        '<div class="lightbox-counter"></div>' +
      '</div>';
    document.body.appendChild(lb.el);

    lb.img  = lb.el.querySelector('.lightbox-img');
    lb.cap  = lb.el.querySelector('.lightbox-caption');
    lb.cnt  = lb.el.querySelector('.lightbox-counter');
    lb.prev = lb.el.querySelector('.lightbox-prev');
    lb.next = lb.el.querySelector('.lightbox-next');

    lb.el.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lb.prev.addEventListener('click', function (e) { e.stopPropagation(); showRelative(-1); });
    lb.next.addEventListener('click', function (e) { e.stopPropagation(); showRelative(1); });
    // Clicking the backdrop (not a child element) closes.
    lb.el.addEventListener('click', function (e) {
      if (e.target === lb.el) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (lb.el.hidden) return;
      if (e.key === 'Escape')     { e.preventDefault(); closeLightbox(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); showRelative(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); showRelative(1); }
    });

    // Delegated click on any .gallery-thumb — captures dynamically-rendered thumbs too.
    document.addEventListener('click', function (e) {
      var thumb = e.target.closest && e.target.closest('.gallery-thumb');
      if (!thumb) return;
      // Let modifier-clicks (⌘/Ctrl/middle) still open a new tab like normal links.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var card = thumb.closest('.gallery-event-card');
      if (!card) return;
      var thumbs = Array.prototype.slice.call(card.querySelectorAll('.gallery-thumb'));
      lb.photos = thumbs.map(function (t) {
        var figcap = t.parentElement && t.parentElement.querySelector('.gallery-caption');
        return { src: t.href, caption: figcap ? figcap.textContent.trim() : '' };
      });
      lb.index = thumbs.indexOf(thumb);
      showCurrent();
    });
  }

  function showCurrent() {
    var p = lb.photos[lb.index];
    if (!p) return;
    lb.img.src = p.src;
    lb.img.alt = p.caption || '';
    lb.cap.textContent = p.caption || '';
    lb.cap.style.display = p.caption ? '' : 'none';
    lb.cnt.textContent = (lb.index + 1) + ' / ' + lb.photos.length;
    var many = lb.photos.length > 1;
    lb.prev.hidden = !many;
    lb.next.hidden = !many;
    lb.el.hidden = false;
    // Prevent the page beneath from scrolling while the lightbox is open.
    document.body.style.overflow = 'hidden';
  }

  function showRelative(delta) {
    if (lb.photos.length === 0) return;
    lb.index = (lb.index + delta + lb.photos.length) % lb.photos.length;
    showCurrent();
  }

  function closeLightbox() {
    lb.el.hidden = true;
    lb.img.src = '';                             // free memory on close
    document.body.style.overflow = '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGallery);
  } else {
    loadGallery();
  }
})();
