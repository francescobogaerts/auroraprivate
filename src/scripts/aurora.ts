// AURORA Private — shared behaviour (bundled & hashed by Astro).
// @ts-nocheck
(function(){
  'use strict';

  /* Quick exit: a neutral search page covers everything at once, then the tab leaves. Shortcut: Esc. */
  function leave(){
    try{
      document.title = 'weersverwachting dit weekend - Zoeken';
      var d = document.createElement('div'); d.className = 'decoy';
      d.innerHTML = '<div class="q">weersverwachting dit weekend</div><div class="tabs"><span>Alles</span><span>Afbeeldingen</span><span>Maps</span><span>Nieuws</span></div>' +
        '<div class="r"><small>weer.example · voorspelling</small><b>Weekend: mild, lichte wind uit het westen</b><p>Overwegend droog met zon en wolken, middagtemperatuur rond de seizoensnorm.</p></div>' +
        '<div class="r"><small>leeslijst.example · boeken</small><b>Lichte reisboeken voor een korte vlucht</b><p>Tien titels die je in één middag uitleest.</p></div>' +
        '<div class="r"><small>tuin.example · gidsen</small><b>Zo houd je basilicum binnen in leven deze winter</b><p>Licht, water en de juiste pot: drie eenvoudige regels.</p></div>';
      document.body.appendChild(d);
      Array.prototype.forEach.call(document.body.children, function(el){ if(el !== d) el.setAttribute('aria-hidden','true'); });
      window.scrollTo(0,0);
    }catch(e){}
    try{ setTimeout(function(){ location.replace('https://www.google.com/search?q=weersverwachting+dit+weekend'); }, 60); }catch(e){}
  }
  document.querySelectorAll('[data-quick-exit]').forEach(function(b){ b.addEventListener('click', leave); });
  if(document.querySelector('[data-quick-exit]')) document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !document.querySelector('dialog[open]')) leave();
  });

  var root = document.documentElement;
  root.classList.add('js');

  /* Full-screen menu */
  var mb = document.querySelector('.menu-btn'), nav = document.querySelector('.nav');
  function setMenu(open){
    nav.classList.toggle('open', open); root.classList.toggle('menu-open', open);
    mb.setAttribute('aria-expanded', String(open));
    var t = mb.querySelector('.t'); if(t) t.textContent = open ? 'Sluit' : 'Menu';
  }
  if(mb && nav){
    mb.addEventListener('click', function(){ setMenu(!nav.classList.contains('open')); });
    nav.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ setMenu(false); }); });
  }

  /* Header turns solid once you leave the hero */
  var sh = document.querySelector('.site-head');
  if(sh){
    var solid = function(){ sh.classList.toggle('is-solid', window.scrollY > Math.min(innerHeight * .6, 420)); };
    window.addEventListener('scroll', solid, {passive:true}); solid();
  }

  /* Header glass follows what is underneath it: dark glass over photography and ink bands */
  var hdr2 = document.querySelector('.site-head');
  var darks = document.querySelectorAll('.opening,.interlude,.manifesto,.intake--glass,.story,.band,.next,.site-foot,.sky,.tone-night,.tone-dusk');
  if(hdr2 && darks.length){
    var probe = function(){
      var y = 44, on = false;
      for(var i = 0; i < darks.length; i++){ var r = darks[i].getBoundingClientRect(); if(r.top <= y && r.bottom > y){ on = true; break; } }
      hdr2.classList.toggle('over-dark', on && window.scrollY > 10);
    };
    window.addEventListener('scroll', probe, {passive:true}); window.addEventListener('resize', probe); probe();
  }

  /* Sunrise hero: driven by src/scripts/sunrise.ts (GSAP + WebGL) */

  /* Drag to scroll the destination strip (mouse only; touch scrolls natively) */
  document.querySelectorAll('.strip').forEach(function(st){
    var down = false, x0 = 0, s0 = 0, moved = false;
    st.addEventListener('pointerdown', function(e){ if(e.pointerType !== 'mouse') return; down = true; moved = false; x0 = e.clientX; s0 = st.scrollLeft; st.style.scrollSnapType = 'none'; });
    window.addEventListener('pointermove', function(e){ if(!down) return; var dx = e.clientX - x0; if(Math.abs(dx) > 4) moved = true; st.scrollLeft = s0 - dx; });
    window.addEventListener('pointerup', function(){ if(!down) return; down = false; st.style.scrollSnapType = ''; });
    st.addEventListener('click', function(e){ if(moved){ e.preventDefault(); moved = false; } }, true);
  });

  /* Vergelijk: tabs with arrow-key support */
  document.querySelectorAll('.cmp').forEach(function(sec){
    var tabs = Array.prototype.slice.call(sec.querySelectorAll('[role="tab"]'));
    function pick(i, focus){
      tabs.forEach(function(t, j){
        var on = i === j; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls')); if(p){ p.classList.toggle('on', on); if(on) p.classList.add('in'); }
      });
      if(focus) tabs[i].focus();
    }
    tabs.forEach(function(t, i){
      t.addEventListener('click', function(){ pick(i); });
      t.addEventListener('keydown', function(e){
        if(e.key === 'ArrowRight'){ e.preventDefault(); pick((i + 1) % tabs.length, true); }
        if(e.key === 'ArrowLeft'){ e.preventDefault(); pick((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
  });

  /* Quiet reveal: sections rise in once */
  var rv = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && rv.length){
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); }, {rootMargin:'0px 0px -8% 0px'});
    rv.forEach(function(el){ var r = el.getBoundingClientRect(); if(r.top < innerHeight) el.classList.add('in'); else io.observe(el); });
  } else rv.forEach(function(el){ el.classList.add('in'); });

  /* Herken je dit? — native <details>, one open; picking a line preselects who the enquiry is for */
  document.querySelectorAll('details.rc').forEach(function(d){
    d.addEventListener('toggle', function(){
      if(!d.open) return;
      document.querySelectorAll('details.rc').forEach(function(x){ if(x !== d) x.open = false; });
      var who = {n:'wie-naaste', o:'wie-org'}[d.getAttribute('data-k')] || 'wie-zelf';
      var r = document.getElementById(who); if(r) r.checked = true;
    });
  });

  /* Fourteen days (Programma 2.0 canon; first design, content to be filled by the guides) */
  var daysEl = document.getElementById('days');
  if(daysEl){
    var D = JSON.parse(document.getElementById('days-data').textContent);
    var dayEl = document.getElementById('day');
    D.forEach(function(d, i){
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<b class="num">' + String(i + 1).padStart(2,'0') + '</b><span>' + d[0] + '</span>';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', 'Dag ' + (i + 1) + ', ' + d[0]);
      if(d[0] === 'Stilte') b.className = 'quiet';
      b.addEventListener('click', function(){ show(i); });
      daysEl.appendChild(b);
    });
    function show(i){
      Array.prototype.forEach.call(daysEl.children, function(x, j){ x.setAttribute('aria-pressed', String(j === i)); });
      var d = D[i];
      dayEl.innerHTML = '<h3>Dag ' + (i + 1) + ' · ' + d[0] + '</h3>' +
        '<div><dt>Ochtend</dt><dd>' + d[1] + '</dd></div><div><dt>Privé sessie</dt><dd>' + d[2] + '</dd></div>' +
        '<div><dt>Middag &amp; eiland</dt><dd>' + d[3] + '</dd></div><div><dt>Avond</dt><dd>' + d[4] + '</dd></div>';
    }
    show(0);
  }

  /* Business-contact buttons preselect "voor mijn organisatie" */
  document.querySelectorAll('[data-org]').forEach(function(b){ b.addEventListener('click', function(){ var r = document.getElementById('wie-org'); if(r) r.checked = true; }); });

  /* Waiting-list buttons preselect the destination in the enquiry. */
  document.querySelectorAll('[data-wait]').forEach(function(b){
    b.addEventListener('click', function(){
      var s = document.getElementById('intake-loc');
      if(s){ Array.prototype.forEach.call(s.options, function(o){ if(o.text.indexOf(b.dataset.wait) === 0) s.value = o.value; }); }
    });
  });

  /* Enquiry. Preview mode: nothing leaves the screen. Live mode (data-live): one POST to /api/intake. */
  var form = document.getElementById('intake-form');
  if(form){
    var live = form.getAttribute('data-live') === 'true';
    var status = form.querySelector('.form-status');
    var contactL = document.getElementById('intake-contact-l');
    var contactI = document.getElementById('intake-contact');
    var viaLabels = {'Signal':['Je Signal-nummer','tel'], 'telefoon':['Je telefoonnummer','tel'], 'e-mail':['Je e-mailadres','email']};
    form.querySelectorAll('input[name="via"]').forEach(function(r){
      r.addEventListener('change', function(){
        if(!contactL || !contactI) return;
        var v = viaLabels[r.value] || viaLabels.Signal; contactL.textContent = v[0]; contactI.setAttribute('inputmode', v[1]);
        contactI.setAttribute('autocomplete', v[1] === 'email' ? 'email' : 'tel');
      });
    });
    function say(msg, err){ if(!status) return; status.hidden = !msg; status.textContent = msg || ''; status.classList.toggle('err', !!err); }
    function summary(){
      var g = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var who = (form.querySelector('input[name="wie"]:checked') || {}).value || '';
      var via = (form.querySelector('input[name="via"]:checked') || {}).value || '';
      var loc = document.getElementById('intake-loc');
      return 'Eerste gesprek AURORA Private\n' +
        'Voor: ' + who + '\nLocatie: ' + (loc ? loc.selectedOptions[0].text : '') +
        '\nVoorkeur contact: ' + via + (g('intake-q') ? '\nMijn vragen:\n' + g('intake-q') : '');
    }
    function showPrepared(txt){
      var out = document.getElementById('prepared');
      out.querySelector('pre').textContent = txt;
      out.hidden = false;
      out.scrollIntoView({block:'nearest'});
    }
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!live){ showPrepared(summary()); return; }
      if(contactI && !contactI.value.trim()){ say('Vul in hoe we je kunnen bereiken.', true); contactI.focus(); return; }
      var btn = form.querySelector('button[type="submit"]'); btn.disabled = true; say('Versturen…');
      fetch('/api/intake', { method:'POST', body:new FormData(form), headers:{'Accept':'application/json'}, credentials:'omit', referrerPolicy:'no-referrer' })
        .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return {ok:r.ok, j:j}; }); })
        .then(function(res){
          btn.disabled = false;
          if(res.ok){ form.reset(); say(''); showPrepared('Dank je. Je bericht is ontvangen en niet op deze site bewaard.\nJe hoort van ons via het kanaal dat je koos.'); }
          else say((res.j && res.j.error) || 'Versturen lukte niet. Probeer het later opnieuw.', true);
        })
        .catch(function(){ btn.disabled = false; say('Geen verbinding. Je vragen staan nog in het formulier.', true); });
    });
    var copy = document.getElementById('prepared-copy');
    if(live && copy) copy.hidden = true;
    if(copy) copy.addEventListener('click', function(){
      var pre = document.querySelector('#prepared pre');
      var done = function(){ copy.textContent = 'Gekopieerd'; setTimeout(function(){ copy.textContent = 'Kopieer je vragen'; }, 1800); };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(pre.textContent).then(done, function(){ selectPre(pre); });
      } else selectPre(pre);
    });
    function selectPre(pre){ var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  }

  /* ===== v1.2 cinematic mechanics ===== */
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = window.requestAnimationFrame || function(f){ return setTimeout(f, 16); };
  var onScroll = [];
  function tick(){ onScroll.forEach(function(f){ f(); }); }
  var queued = false;
  window.addEventListener('scroll', function(){ if(queued) return; queued = true; raf(function(){ queued = false; tick(); }); }, {passive:true});
  window.addEventListener('resize', tick);

  /* Expose the real header height to CSS (pinned sections sit below it) */
  var hd = document.querySelector('.site-head');
  function headH(){ if(hd) document.documentElement.style.setProperty('--head-h', hd.offsetHeight + 'px'); }
  headH(); window.addEventListener('resize', headH);

  /* Scroll hairline in the header */
  var head = document.querySelector('.site-head');
  if(head){
    var bar = document.createElement('span'); bar.className = 'progress'; bar.setAttribute('aria-hidden','true'); head.appendChild(bar);
    onScroll.push(function(){
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h).toFixed(4) : 0);
    });
  }

  /* Ambient hero video where one is supplied; the photo or pending frame stays underneath */
  document.querySelectorAll('[data-video]').forEach(function(fig){
    if(still) return;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline',''); v.setAttribute('aria-hidden','true');
    v.preload = 'metadata';
    var srcs = fig.getAttribute('data-video').split(',');
    v.addEventListener('error', function(){ if(srcs.length){ v.src = srcs.shift(); v.play && v.play().catch(function(){}); } }, true);
    v.src = srcs.shift();
    v.addEventListener('playing', function(){ fig.classList.add('has-video'); fig.classList.remove('is-pending'); });
    fig.insertBefore(v, fig.firstChild);
    var p = v.play(); if(p && p.catch) p.catch(function(){});
  });

  /* Pinned manifesto: one line at a time */
  document.querySelectorAll('.manifesto').forEach(function(sec){
    var lines = sec.querySelectorAll('.m-line'); if(!lines.length || still) return;
    sec.style.setProperty('--n', lines.length);
    sec.classList.add('is-pinned');
    var count = sec.querySelector('.count'), bar = sec.querySelector('.m-bar');
    onScroll.push(function(){
      var r = sec.getBoundingClientRect();
      var span = sec.offsetHeight - innerHeight;
      var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
      var k = Math.min(lines.length - 1, Math.floor(p * lines.length));
      Array.prototype.forEach.call(lines, function(l, i){ l.classList.toggle('lit', i === k); l.classList.toggle('past', i < k); });
      if(count) count.textContent = String(k + 1).padStart(2,'0') + ' / ' + String(lines.length).padStart(2,'0');
      if(bar) bar.style.setProperty('--mp', p.toFixed(3));
    });
  });

  /* Movements become a sticky stack on wide screens */
  var deckMQ = window.matchMedia ? matchMedia('(min-width: 861px)') : {matches:true};
  document.querySelectorAll('.moves').forEach(function(m){
    if(still || !deckMQ.matches) return;
    var items = m.querySelectorAll('.move');
    m.classList.add('deck');
    Array.prototype.forEach.call(items, function(d, i){
      d.open = true; d.style.setProperty('--i', i);
      var sum = d.querySelector('summary');
      sum.addEventListener('click', function(e){ if(m.classList.contains('deck')) e.preventDefault(); });
      var t = d.querySelector('.t');
      if(t && !t.querySelector('.idx')){ var s = document.createElement('span'); s.className = 'idx'; s.textContent = 'Beweging ' + (i + 1) + ' van ' + items.length; t.insertBefore(s, t.firstChild); }
      if(i > 0 && i < 4) d.classList.add('core');
    });
  });

  /* Excursion quick preview (real links stay; the dialog is a convenience) */
  var peek = null;
  function openPeek(a){
    if(!peek){
      peek = document.createElement('dialog'); peek.className = 'peek';
      peek.innerHTML = '<button class="x" type="button" aria-label="Sluiten"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
        '<figure class="photo"><img alt=""></figure><div class="in"><span class="eyebrow"></span><h3></h3><p class="soft"></p><div class="row"><a class="link" href="#">Bekijk de excursie</a><span class="credit">Ingepland in de veertien dagen, niet los te boeken</span></div></div>';
      document.body.appendChild(peek);
      peek.querySelector('.x').addEventListener('click', function(){ peek.close(); });
      peek.addEventListener('click', function(e){ if(e.target === peek) peek.close(); });
    }
    var img = peek.querySelector('img'), fig = peek.querySelector('.photo');
    var src = a.querySelector('.thumb img');
    fig.classList.toggle('is-pending', !src || !src.complete || !src.naturalWidth);
    img.src = src && src.currentSrc ? src.currentSrc : ''; img.alt = src ? src.alt : '';
    peek.querySelector('.eyebrow').textContent = a.querySelector('.when') ? a.querySelector('.when').textContent : '';
    peek.querySelector('h3').textContent = a.querySelector('h3').textContent;
    peek.querySelector('p').textContent = a.getAttribute('data-teaser') || (a.querySelector('p') ? a.querySelector('p').textContent : '');
    peek.querySelector('.link').setAttribute('href', a.getAttribute('href'));
    if(peek.showModal) peek.showModal(); else location.href = a.getAttribute('href');
  }
  document.querySelectorAll('a.exc[data-peek]').forEach(function(a){
    a.addEventListener('click', function(e){
      if(e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); openPeek(a);
    });
  });

  /* Excursion story: pinned image crossfade, three beats */
  document.querySelectorAll('.story').forEach(function(st){
    var beats = st.querySelectorAll('.beat'); if(beats.length < 2 || still) return;
    // pin without a fade: the first beat is on before the pin applies, so the beats never show stacked
    st.classList.add('no-anim');
    beats[0].classList.add('on');
    st.classList.add('is-pinned');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ st.classList.remove('no-anim'); }); });
    var ticks = document.createElement('div'); ticks.className = 'ticks'; ticks.setAttribute('aria-hidden','true');
    Array.prototype.forEach.call(beats, function(){ ticks.appendChild(document.createElement('i')); });
    st.querySelector('.frames').appendChild(ticks);
    onScroll.push(function(){
      var r = st.getBoundingClientRect();
      var span = st.offsetHeight - innerHeight;
      var p = span > 0 ? Math.min(.999, Math.max(0, -r.top / span)) : 0;
      var k = Math.floor(p * beats.length);
      Array.prototype.forEach.call(beats, function(b, i){ b.classList.toggle('on', i === k); });
      Array.prototype.forEach.call(ticks.children, function(t, i){ t.classList.toggle('on', i === k); });
    });
  });

  tick();
})();
