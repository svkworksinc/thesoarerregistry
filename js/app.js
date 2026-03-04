/* =========================================
   SOARER REGISTRY — FRONTEND APP
   Powered by Supabase (static / GitHub Pages)
   ========================================= */

// ── SUPABASE INIT ─────────────────────────────────────────
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CONSTANTS ─────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ENGINES = {
  Z10: ['1G-EU (2.0L I6)', '1G-GEU (2.0L  I6)',  'M-TEU (2.0L I6)','5M-GEU (2.8L I6)', '6M-GEU (3.0L I6)'],
  Z20: ['1G-GEU (2.0L)', '1G-FE (2.0L)', '1G-GTE (2.0L Twin Turbo)', '7M-GTEU (3.0L Twin Turbo)'],
  Z30: ['2JZ-GE (3.0L NA)', '1UZ-FE (4.0L V8)', '1JZ-GTE (2.5L Twin Turbo)'],
  Z40: ['3UZ-FE (4.3L V8)']
};

const MODELS = {
  Z10: ['Soarer 2000GT', 'Soarer 2000GT-Extra', 'Soarer 2800GT', 'Soarer 2800GT Extra', 'Soarer 3000GT', 'Other'],
  Z20: ['Soarer 2.0GT', 'Soarer 2.0GT-Twin Turbo', 'Soarer 2.0GT-Twin Turbo L', 'Soarer 3.0GT', 'Soarer 3.0GT-Limited', 'Soarer 3.0GT-Twin Turbo'],
  Z30: ['SC300', 'SC400', 'Soarer 3.0GT (2JZ-GE)', 'Soarer 4.0GT (1UZ-FE)', 'Soarer 2.5GT-T (1JZ-GTE)'],
  Z40: ['SC430', 'Soarer UZZ40']
};

// ── STATE ─────────────────────────────────────────────────
let currentUser   = null;
let lightboxImages = [];
let lightboxIndex  = 0;
let pendingFiles   = [];
let registryPage   = 1;
let vinSearchTimeout = null;
let selectedVinEntry = null;

// ── SHARED HELPERS ────────────────────────────────────────
/** Returns "Jan 1994" or "1994" or "" */
function formatYear(mfg_year, mfg_month) {
  if (!mfg_year) return '';
  return mfg_month ? `${MONTHS[mfg_month - 1]} ${mfg_year}` : `${mfg_year}`;
}

/** Returns CSS class for chassis badge, e.g. "tag-z30" */
function chassisTagClass(chassis) {
  return `tag-${(chassis || '').toLowerCase()}`;
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  checkSetup();
  setupDragDrop();

  // ── Step 1: Public data — start immediately, no auth needed ─────
  // Never block these on auth.  If getSession() is slow (e.g. waiting
  // for the multi-tab refresh lock held by another tab), the registry
  // would look broken without an early kick-off here.
  loadStats();
  loadRegistryTable(1);
  handleHashNav();

  // ── Step 2: Resolve auth state in parallel ───────────────────────
  // getSession() blocks until any pending token refresh is done, giving
  // us a guaranteed-fresh JWT.  Wrap in try/catch so a network error or
  // thrown exception can never crash the rest of init.
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      const { data: profile } = await db.from('profiles')
        .select('*').eq('id', session.user.id).maybeSingle();
      currentUser.profile = profile || {};
    }
  } catch (_) { /* auth resolution failed — proceed as logged-out */ }
  updateNavForUser();

  // ── Step 3: Reload registry with fresh JWT ───────────────────────
  // If the stored session had an expired access token, PostgREST would
  // have rejected the first load even for USING(true) policies.  Now
  // that getSession() has refreshed the token, this call is safe.
  loadRegistryTable(1);

  // Re-render profile page if it was opened before auth settled.
  if (currentUser &&
      document.getElementById('page-profile')?.classList.contains('active')) {
    loadProfile();
  }

  // ── Step 4: React to future auth events ──────────────────────────
  // INITIAL_SESSION is handled above; skip it to avoid double renders.
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (session?.user) {
      currentUser = session.user;
      const { data: profile } = await db.from('profiles')
        .select('*').eq('id', session.user.id).maybeSingle();
      currentUser.profile = profile || {};
    } else {
      currentUser = null;
    }
    updateNavForUser();
    if (currentUser &&
        document.getElementById('page-profile')?.classList.contains('active')) {
      loadProfile();
    }
  });

  // Close VIN search dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.vin-search-wrap')) {
      const el = document.getElementById('vinSearchResults');
      if (el) el.classList.add('hidden');
    }
  });
});

window.addEventListener('hashchange', handleHashNav);

function handleHashNav() {
  const hash = window.location.hash;
  if (hash.startsWith('#car/')) showCarDetail(hash.slice(5));
}

function checkSetup() {
  if (SUPABASE_URL === 'https://YOUR_PROJECT_ID.supabase.co') {
    document.getElementById('setupBanner').classList.remove('hidden');
  }
}

// ── NAVIGATION ────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Registry is embedded in the home page
  const target = (name === 'registry') ? 'home' : name;
  const page = document.getElementById(`page-${target}`);
  if (!page) return;
  page.classList.add('active');

  if (name === 'registry') {
    // Scroll to the table section after a brief delay
    setTimeout(() => scrollToRegistry(), 80);
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (target === 'home') loadRegistryTable(registryPage);
  if (name === 'profile') loadProfile();
  if (name === 'submit')  { resetForm(); updateSubmitNotice(); }
  if (name === 'admin')   loadAdminPanel();
  if (name !== 'car')     window.location.hash = '';
}

function showPageRaw(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (page) { page.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}

function scrollToRegistry() {
  // Ensure home page is active
  if (!document.getElementById('page-home').classList.contains('active')) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-home').classList.add('active');
    loadRegistryTable(registryPage);
  }
  const section = document.getElementById('registrySection');
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ── AUTH ──────────────────────────────────────────────────
function updateNavForUser() {
  const navAuth = document.getElementById('navAuth');
  const navUser = document.getElementById('navUser');
  if (!navAuth || !navUser) return;

  const adminLink = document.getElementById('navAdminLink');
  if (currentUser) {
    navAuth.classList.add('hidden');
    navUser.classList.remove('hidden');
    const name = currentUser.profile?.display_name
      || currentUser.profile?.username
      || currentUser.email;
    document.getElementById('navUsername').textContent = name;
    if (adminLink) adminLink.classList.toggle('hidden', !currentUser.profile?.is_admin);
  } else {
    navAuth.classList.remove('hidden');
    navUser.classList.add('hidden');
    if (adminLink) adminLink.classList.add('hidden');
  }
}

async function doRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUser').value.trim().toLowerCase();
  const email    = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPass').value;
  const display  = document.getElementById('regDisplay').value.trim();
  const errEl    = document.getElementById('regError');
  const btn      = document.getElementById('regSubmitBtn');
  errEl.classList.add('hidden');

  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    errEl.textContent = 'Username: 3–30 chars, letters/numbers/_ only';
    errEl.classList.remove('hidden'); return;
  }

  const { data: taken } = await db.from('profiles')
    .select('id').eq('username', username).maybeSingle();
  if (taken) {
    errEl.textContent = 'Username already taken';
    errEl.classList.remove('hidden'); return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating Account…';

  const { data, error } = await db.auth.signUp({
    email, password,
    options: {
      data: { username, display_name: display || username },
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    errEl.textContent = error.message;
    errEl.classList.remove('hidden'); return;
  }

  btn.textContent = 'Account Created!';

  ['regUser','regEmail','regPass','regDisplay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    closeModal('registerModal');
  }, 1800);
}

async function doLogin(e) {
  e.preventDefault();
  const loginVal = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl    = document.getElementById('loginError');
  errEl.classList.add('hidden');

  let email = loginVal;
  if (!loginVal.includes('@')) {
    const { data: profile } = await db.from('profiles')
      .select('email').eq('username', loginVal.toLowerCase()).maybeSingle();
    if (!profile) {
      errEl.textContent = 'Username not found';
      errEl.classList.remove('hidden'); return;
    }
    email = profile.email;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = 'Invalid credentials';
    errEl.classList.remove('hidden'); return;
  }

  closeModal('loginModal');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

async function logout() {
  try { await db.auth.signOut(); } catch (_) {}
  currentUser = null;
  updateNavForUser();
  registryPage = 1;
  showPage('home');
}

// ── STATS ─────────────────────────────────────────────────
async function loadStats() {
  try {
    const { data } = await db.from('cars').select('chassis').eq('status', 'active');
    if (!data) return;
    const c = { Z10: 0, Z20: 0, Z30: 0, Z40: 0 };
    data.forEach(({ chassis }) => { if (c[chassis] !== undefined) c[chassis]++; });
    animateCount('statTotal', data.length);
    animateCount('statZ10',   c.Z10);
    animateCount('statZ20',   c.Z20);
    animateCount('statZ30',   c.Z30);
    animateCount('statZ40',   c.Z40);
  } catch {}
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  (function step(now) {
    const p = Math.min((now - start) / 1200, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * e).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

// ── DATA FETCHING ─────────────────────────────────────────
async function fetchCars({
  q, chassis, model, engine, transmission, drive_side,
  body_type, color, country, mfg_year, page = 1, limit = 25
} = {}) {
  const offset = (page - 1) * limit;

  let query = db.from('cars')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (q) {
    query = query.or(
      `vin.ilike.%${q}%,frame_number.ilike.%${q}%,model.ilike.%${q}%,` +
      `color.ilike.%${q}%,notes.ilike.%${q}%,current_owner_name.ilike.%${q}%`
    );
  }
  if (chassis)      query = query.eq('chassis', chassis);
  if (model)        query = query.ilike('model', `%${model}%`);
  if (engine)       query = query.ilike('engine', `%${engine}%`);
  if (transmission) query = query.eq('transmission', transmission);
  if (drive_side)   query = query.eq('drive_side', drive_side);
  if (body_type)    query = query.eq('body_type', body_type);
  if (color)        query = query.ilike('color', `%${color}%`);
  if (country)      query = query.ilike('country', `%${country}%`);
  if (mfg_year)     query = query.eq('mfg_year', parseInt(mfg_year));

  const { data, count } = await query.range(offset, offset + limit - 1);
  return {
    cars:  data  || [],
    total: count || 0,
    page,
    limit,
    pages: Math.ceil((count || 0) / limit)
  };
}

// ── REGISTRY TABLE (HOME) ─────────────────────────────────
async function loadRegistryTable(page = 1) {
  registryPage = page;
  const tbody   = document.getElementById('registryTableBody');
  const countEl = document.getElementById('registryResultCount');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="13" class="table-placeholder">Loading registry&hellip;</td></tr>';

  const filters = gatherHomeFilters();
  const res = await fetchCars({ ...filters, page });

  if (countEl) {
    countEl.textContent = res.total
      ? `${res.total.toLocaleString()} car${res.total !== 1 ? 's' : ''}`
      : '';
  }

  if (!res.cars.length) {
    tbody.innerHTML = '<tr><td colspan="13" class="table-empty">No cars found. Try adjusting your search.</td></tr>';
    document.getElementById('registryPagination').innerHTML = '';
    return;
  }

  const offset = (page - 1) * 25;
  tbody.innerHTML = res.cars.map((car, i) => carRowHTML(car, offset + i + 1)).join('');
  renderPagination(res.page, res.pages);
}

function gatherHomeFilters() {
  const val = id => document.getElementById(id)?.value?.trim() || '';
  const f = {};
  const q       = val('regSearchInput');
  const chassis = val('regFilterChassis');
  const trans   = val('regFilterTrans');
  const country = val('regFilterCountry');
  if (q)       f.q            = q;
  if (chassis) f.chassis      = chassis;
  if (trans)   f.transmission = trans;
  if (country) f.country      = country;
  return f;
}

function applyHomeFilters() { loadRegistryTable(1); }

function clearHomeFilters() {
  ['regSearchInput','regFilterChassis','regFilterTrans','regFilterCountry']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  loadRegistryTable(1);
}

function quickFilterChassis(chassis) {
  const el = document.getElementById('regFilterChassis');
  if (el) el.value = chassis;
  scrollToRegistry();
  setTimeout(() => applyHomeFilters(), 200);
}

// ── TABLE ROW RENDERING ───────────────────────────────────
function carRowHTML(car, index) {
  const thumb = car.primary_image_url
    ? `<img src="${escAttr(car.primary_image_url)}" alt="${escAttr(car.model)}" loading="lazy" />`
    : '<span class="no-thumb">—</span>';

  const engine  = car.engine ? car.engine.split('(')[0].trim() : '—';
  const owner   = car.profiles?.display_name || car.profiles?.username || car.current_owner_name || '—';
  const updated = car.updated_at ? formatDate(car.updated_at) : (car.created_at ? formatDate(car.created_at) : '—');

  return `
    <tr class="registry-row" onclick="showCarDetail(${car.id})">
      <td class="td-num">${index}</td>
      <td class="td-photo"><div class="row-thumb">${thumb}</div></td>
      <td><span class="chassis-tag ${chassisTagClass(car.chassis)}">${escHtml(car.chassis)}</span></td>
      <td class="td-model">${escHtml(car.model)}</td>
      <td class="td-year">${car.mfg_year || '—'}</td>
      <td class="td-engine">${escHtml(engine)}</td>
      <td>${car.color ? escHtml(car.color) : '—'}</td>
      <td>${car.interior_color ? escHtml(car.interior_color) : '—'}</td>
      <td>${car.interior_material ? escHtml(car.interior_material) : '—'}</td>
      <td>${car.transmission ? escHtml(car.transmission) : '—'}</td>
      <td>${car.country ? escHtml(car.country) : '—'}</td>
      <td class="td-owner">${escHtml(owner)}</td>
      <td class="td-updated">${updated}</td>
    </tr>`;
}

// ── PAGINATION ────────────────────────────────────────────
function renderPagination(current, total) {
  const el = document.getElementById('registryPagination');
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
  const range = pagRange(current, total);
  let html = current > 1
    ? `<button class="page-btn" onclick="loadRegistryTable(${current - 1})">&#8249;</button>` : '';
  range.forEach(p => {
    html += p === '...'
      ? `<button class="page-btn" disabled>&hellip;</button>`
      : `<button class="page-btn${p === current ? ' active' : ''}" onclick="loadRegistryTable(${p})">${p}</button>`;
  });
  if (current < total)
    html += `<button class="page-btn" onclick="loadRegistryTable(${current + 1})">&#8250;</button>`;
  el.innerHTML = html;
}

function pagRange(cur, tot) {
  if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, '...', tot];
  if (cur >= tot - 3) return [1, '...', tot-4, tot-3, tot-2, tot-1, tot];
  return [1, '...', cur-1, cur, cur+1, '...', tot];
}

// ── CAR DETAIL ────────────────────────────────────────────
async function showCarDetail(id) {
  showPageRaw('car');
  window.location.hash = `car/${id}`;
  const content = document.getElementById('carDetailContent');
  content.innerHTML = '<div class="loading-spinner" style="padding:80px;">Loading&hellip;</div>';

  try {
    let car;
    if (isNaN(id)) {
      // VIN or frame number lookup
      const { data: byVin } = await db.from('cars')
        .select('*, car_images(*)')
        .eq('vin', String(id).toUpperCase()).maybeSingle();
      const { data: byFrame } = !byVin
        ? await db.from('cars')
            .select('*, car_images(*)')
            .eq('frame_number', String(id).toUpperCase()).maybeSingle()
        : { data: null };
      car = byVin || byFrame;
      if (!car) throw new Error('Not found');
    } else {
      const { data, error } = await db.from('cars')
        .select('*, car_images(*)')
        .eq('id', parseInt(id)).single();
      if (error || !data) throw new Error('Not found');
      car = data;
    }
    renderCarDetail(car);
  } catch {
    content.innerHTML = `
      <div class="car-detail-header">
        <div class="ph-inner">
          <div class="ph-eyebrow">Registry</div>
          <h1>Car Not Found</h1>
        </div>
      </div>
      <div style="max-width:1400px;margin:0 auto;padding:48px 24px;">
        <p style="color:var(--text-muted);">This car could not be found in the registry.</p>
        <button class="btn btn-outline" style="margin-top:16px;" onclick="showPage('home')">
          &larr; Back to Registry
        </button>
      </div>`;
  }
}

function renderCarDetail(car) {
  const images = (car.car_images || [])
    .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  lightboxImages = images.map(i => ({ src: i.public_url, caption: i.caption || '' }));
  lightboxIndex  = 0;

  const isOwner = currentUser && car.user_id === currentUser.id;
  const year    = formatYear(car.mfg_year, car.mfg_month);
  const profiles = car.profiles || {};

  const mainImg = images.length
    ? `<img id="galleryMain" src="${escAttr(images[0].public_url)}" alt="${escAttr(car.model)}" onclick="openLightbox(0)" />`
    : `<div class="no-photo">&#128247;<span style="font-size:15px;margin-top:10px;">No photos yet</span></div>`;

  const thumbsHTML = images.length > 1
    ? `<div class="gallery-thumbs">${images.map((img, i) => `
        <div class="gallery-thumb${i === 0 ? ' active' : ''}" id="thumb-${i}" onclick="selectImage(${i})">
          <img src="${escAttr(img.public_url)}" alt="Photo ${i + 1}" />
        </div>`).join('')}</div>`
    : '';

  const row = (label, value, mono = false) => {
    const cls = !value ? 'na' : mono ? 'mono' : '';
    return `<div class="info-row">
      <span class="info-key">${label}</span>
      <span class="info-value ${cls}">${value ? escHtml(String(value)) : 'Not recorded'}</span>
    </div>`;
  };

  const ownerName = profiles.display_name || profiles.username || car.current_owner_name || null;
  const ownerInitials = ownerName ? ownerName.slice(0, 2).toUpperCase() : '?';

  document.getElementById('carDetailContent').innerHTML = `
    <div class="car-detail-header">
      <div class="ph-inner">
        <div class="car-detail-breadcrumb">
          <a href="#" onclick="showPage('home')">Registry</a>
          &rsaquo; ${escHtml(car.chassis)} &rsaquo; ${escHtml(car.model)}
        </div>
        <span class="chassis-tag ${chassisTagClass(car.chassis)}" style="margin-bottom:10px;display:inline-block;">
          ${escHtml(car.chassis)}
        </span>
        <h1 class="car-detail-title">
          ${escHtml(car.model)}${year ? `<span class="car-detail-year">${year}</span>` : ''}
        </h1>
        ${car.color ? `<div class="car-detail-subtitle">${escHtml(car.color)}${car.color_code ? ` &mdash; ${escHtml(car.color_code)}` : ''}</div>` : ''}
      </div>
    </div>

    <div class="car-detail-body">

      <!-- LEFT: gallery + ownership -->
      <div class="car-detail-left">
        <div class="car-detail-gallery">
          <div class="gallery-main">${mainImg}</div>
          ${thumbsHTML}
        </div>

        ${isOwner ? `<div class="detail-actions" style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="editCar(${car.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCar(${car.id})">Delete</button>
        </div>` : ''}

        <div class="car-ownership-section">
          <div class="ownership-section-title">Ownership &amp; Registry</div>
          <div class="owner-cards">
            <div class="owner-card">
              <div class="owner-avatar">${ownerInitials}</div>
              <div class="owner-info">
                <div class="owner-name">${escHtml(ownerName || 'Anonymous')}</div>
                ${profiles.username ? `<div class="owner-username">@${escHtml(profiles.username)}</div>` : ''}
                <div class="owner-meta">
                  ${car.current_owner_name && car.current_owner_name !== ownerName
                    ? `Listed owner: ${escHtml(car.current_owner_name)}<br>` : ''}
                  Registered ${formatDate(car.created_at)}
                  ${car.updated_at ? `<br>Last updated ${formatDate(car.updated_at)}` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button class="btn btn-outline btn-sm" onclick="showPage('home')" style="margin-top:16px;">&larr; Back to Registry</button>
      </div>

      <!-- RIGHT: specs -->
      <div class="car-detail-right">
        <div class="car-spec-grid">

          <div class="info-panel">
            <div class="info-panel-title">Identification</div>
            ${row('Frame Number', car.frame_number, true)}
            ${car.vin
              ? `<div class="info-row">
                  <span class="info-key">VIN</span>
                  <span class="info-value mono">${escHtml(car.vin)}${car.vin_matched === false
                    ? ' <span class="vin-badge vin-manual" title="Manually entered — not verified from VIN directory">Manual Entry</span>'
                    : ''}</span>
                </div>`
              : row('VIN', null, true)}
            ${row('Model', car.model)}
            ${row('Chassis', car.chassis)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Production</div>
            ${row('Mfg. Year', car.mfg_year ? String(car.mfg_year) : null)}
            ${row('Mfg. Month', car.mfg_month ? MONTHS[car.mfg_month - 1] : null)}
            ${row('Plant', car.plant)}
            ${row('Body', car.body_type)}
            ${row('Body Shape', car.body_shape)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Specification</div>
            ${row('Engine', car.engine)}
            ${row('Transmission Type', car.transmission)}
            ${row('Transmission', car.gear_shift)}
            ${row('Driver Position', car.drive_side)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Grade &amp; Market</div>
            ${row('Grade', car.grade)}
            ${row('Trim', car.trim)}
            ${row('Market', car.market)}
            ${row('Destination', car.destination)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Appearance</div>
            ${row('Exterior Color', car.color)}
            ${row('Color Code', car.color_code, true)}
            ${row('Trim Code', car.trim_code, true)}
            ${row('Interior Color', car.interior_color)}
            ${row('Interior Material', car.interior_material)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Status &amp; Location</div>
            ${row('Title Status', car.title_status)}
            ${row('Current Country', car.country)}
            ${row('State / Region', car.location)}
            ${row('Verification', car.verification)}
          </div>

        </div>

        ${car.notes ? `<div class="notes-box" style="margin-top:16px;"><h4>Notes</h4><p>${escHtml(car.notes)}</p></div>` : ''}
      </div>

    </div>`;
}

function selectImage(index) {
  if (!lightboxImages.length) return;
  lightboxIndex = index;
  const mainImg = document.getElementById('galleryMain');
  if (mainImg) mainImg.src = lightboxImages[index].src;
  document.querySelectorAll('.gallery-thumb')
    .forEach((t, i) => t.classList.toggle('active', i === index));
}

// ── FEEDBACK ──────────────────────────────────────────────
async function submitFeedback(e) {
  e.preventDefault();
  const errEl  = document.getElementById('fbError');
  const okEl   = document.getElementById('fbSuccess');
  const btn    = document.getElementById('fbSubmitBtn');
  const msg    = document.getElementById('fbMessage').value.trim();

  errEl.classList.add('hidden');
  okEl.classList.add('hidden');
  if (!msg) { errEl.textContent = 'Please enter a message.'; errEl.classList.remove('hidden'); return; }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  const { error } = await db.from('feedback').insert({
    category:   document.getElementById('fbCategory').value,
    name:       document.getElementById('fbName').value.trim() || null,
    email:      document.getElementById('fbEmail').value.trim() || null,
    message:    msg,
    user_id:    currentUser?.id || null
  });

  btn.disabled = false;
  btn.textContent = 'Send Feedback';

  if (error) {
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.classList.remove('hidden');
  } else {
    okEl.classList.remove('hidden');
    document.getElementById('fbMessage').value = '';
    document.getElementById('fbName').value    = '';
    document.getElementById('fbEmail').value   = '';
    setTimeout(() => closeModal('feedbackModal'), 2200);
  }
}

// ── MEDIA VIEWER (brochures / articles) ───────────────────
let _mediaImages = [];
let _mediaIndex  = 0;

function openMedia(opts) {
  const modal      = document.getElementById('mediaModal');
  const titleEl    = document.getElementById('mediaModalTitle');
  const contentEl  = document.getElementById('mediaModalContent');
  const dlBtn      = document.getElementById('mediaModalDownload');

  titleEl.textContent = opts.title || '';
  dlBtn.classList.add('hidden');
  dlBtn.href = '#';

  if (opts.type === 'pdf') {
    dlBtn.href = opts.src;
    dlBtn.setAttribute('download', opts.filename || 'document.pdf');
    dlBtn.classList.remove('hidden');
    contentEl.innerHTML =
      `<iframe class="media-pdf-frame" src="${escAttr(opts.src)}" title="${escAttr(opts.title || '')}"></iframe>`;

  } else if (opts.type === 'images') {
    _mediaImages = opts.images || [];
    _mediaIndex  = 0;
    contentEl.innerHTML = _buildMediaGallery();

  } else {
    // coming-soon placeholder
    contentEl.innerHTML = `
      <div class="media-coming-soon">
        <div class="media-coming-icon">&#128197;</div>
        <div class="media-coming-title">Content Coming Soon</div>
        <p>This item hasn't been digitised yet. If you have a copy, please reach out to the community to contribute.</p>
      </div>`;
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMediaModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('media-modal-close')) return;
  const modal = document.getElementById('mediaModal');
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  document.getElementById('mediaModalContent').innerHTML = '';
}

function _buildMediaGallery() {
  if (!_mediaImages.length) return '<div class="media-coming-soon"><p>No images.</p></div>';
  const img = _mediaImages[_mediaIndex];
  const counter = `${_mediaIndex + 1} / ${_mediaImages.length}`;
  return `
    <div class="media-gallery-viewer">
      <div class="media-gallery-img-wrap">
        <img src="${escAttr(img.src || img)}" alt="Page ${_mediaIndex + 1}" class="media-gallery-img" />
      </div>
      ${img.caption ? `<div class="media-gallery-caption">${escHtml(img.caption)}</div>` : ''}
      <div class="media-gallery-nav">
        <button class="btn btn-outline btn-sm" onclick="navigateMedia(-1)" ${_mediaIndex === 0 ? 'disabled' : ''}>&larr; Prev</button>
        <span class="media-gallery-counter">${counter}</span>
        <button class="btn btn-outline btn-sm" onclick="navigateMedia(1)" ${_mediaIndex === _mediaImages.length - 1 ? 'disabled' : ''}>Next &rarr;</button>
      </div>
    </div>`;
}

function navigateMedia(dir) {
  _mediaIndex = Math.max(0, Math.min(_mediaImages.length - 1, _mediaIndex + dir));
  document.getElementById('mediaModalContent').innerHTML = _buildMediaGallery();
}

// ── LIGHTBOX ──────────────────────────────────────────────
function openLightbox(index) {
  if (!lightboxImages.length) return;
  lightboxIndex = index;
  document.getElementById('lightboxImg').src = lightboxImages[index].src;
  document.getElementById('lightboxCaption').textContent = lightboxImages[index].caption || '';
  document.getElementById('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.body.style.overflow = '';
}

function lightboxNav(dir) {
  if (!lightboxImages.length) return;
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  openLightbox(lightboxIndex);
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeLightbox();
    document.querySelectorAll('.modal-backdrop')
      .forEach(m => m.classList.add('hidden'));
    document.body.style.overflow = '';
  }
  if (e.key === 'ArrowLeft')  { if (!document.getElementById('lightbox').classList.contains('hidden')) lightboxNav(-1); }
  if (e.key === 'ArrowRight') { if (!document.getElementById('lightbox').classList.contains('hidden')) lightboxNav(1); }
  if (e.key === 'Enter' && document.activeElement?.id === 'regSearchInput') applyHomeFilters();
});

// ── VIN DIRECTORY SEARCH ──────────────────────────────────

function onVinSearchInput() {
  clearTimeout(vinSearchTimeout);
  const q = document.getElementById('f-vin-search').value.trim().toUpperCase();
  if (q.length < 2) {
    document.getElementById('vinSearchResults').classList.add('hidden');
    return;
  }
  vinSearchTimeout = setTimeout(() => searchVinDirectory(q), 300);
}

async function searchVinDirectory(q) {
  const resultsEl = document.getElementById('vinSearchResults');

  const { data: vins } = await db.from('vin_directory')
    .select('*').ilike('vin', `%${q}%`).order('vin').limit(10);

  if (!vins || !vins.length) {
    resultsEl.innerHTML = '<div class="vin-result-empty">No matching VINs in directory — you can still enter it manually below.</div>';
    resultsEl.classList.remove('hidden');
    return;
  }

  // Check which are already registered
  const vinValues = vins.map(v => v.vin);
  const { data: registered } = await db.from('cars')
    .select('vin, current_owner_name, user_id')
    .in('vin', vinValues).eq('status', 'active');
  const regMap = {};
  (registered || []).forEach(r => { regMap[r.vin] = r; });

  resultsEl.innerHTML = vins.map(v => {
    const reg   = regMap[v.vin];
    const isOwn = reg && currentUser && reg.user_id === currentUser.id;
    const badge = reg
      ? (isOwn
        ? '<span class="vin-badge vin-yours">Your car</span>'
        : '<span class="vin-badge vin-taken">Registered</span>')
      : '<span class="vin-badge vin-available">Available</span>';
    const detail = [v.chassis, v.model, v.mfg_year, v.color].filter(Boolean).join(' · ');
    return `<div class="vin-result-item" onclick="selectVinEntry(${v.id})">
      <div class="vin-result-main">
        <span class="vin-result-vin">${escHtml(v.vin)}</span>${badge}
      </div>
      ${detail ? `<div class="vin-result-detail">${escHtml(detail)}</div>` : ''}
    </div>`;
  }).join('');
  resultsEl.classList.remove('hidden');
}

async function selectVinEntry(vinId) {
  const { data: entry } = await db.from('vin_directory')
    .select('*').eq('id', vinId).single();
  if (!entry) return;

  selectedVinEntry = entry;
  document.getElementById('vinSearchResults').classList.add('hidden');
  document.getElementById('f-vin-search').value = entry.vin;
  document.getElementById('vinClearBtn').classList.remove('hidden');

  // Auto-fill form fields
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  set('f-vin',   entry.vin);
  set('f-frame', entry.frame_number);

  if (entry.chassis) {
    document.getElementById('f-chassis').value = entry.chassis;
    updateModelOptions();
  }
  set('f-model',        entry.model);
  set('f-engine',       entry.engine);
  set('f-year',         entry.mfg_year);
  set('f-month',        entry.mfg_month);
  set('f-transmission', entry.transmission);
  set('f-color',        entry.color);
  set('f-color-code',   entry.color_code);

  // Show verified status
  const statusEl = document.getElementById('vinStatus');
  statusEl.innerHTML = '<span class="vin-verified">Verified VIN — details auto-filled from directory</span>';
  statusEl.classList.remove('hidden');
  markAutoFilled(true);
}

function clearVinSelection() {
  selectedVinEntry = null;
  document.getElementById('f-vin-search').value = '';
  document.getElementById('vinClearBtn').classList.add('hidden');
  document.getElementById('vinStatus').classList.add('hidden');
  document.getElementById('vinSearchResults').classList.add('hidden');
  markAutoFilled(false);
}

function markAutoFilled(filled) {
  const ids = ['f-vin', 'f-frame', 'f-year', 'f-color', 'f-color-code'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('auto-filled', filled && !!el.value);
      if (el.tagName === 'INPUT') el.readOnly = filled && !!el.value;
    }
  });
  // For selects: toggle CSS class only (readOnly not supported)
  ['f-month', 'f-transmission'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('auto-filled', filled && !!el.value);
  });
}

// ── FORM: SUBMIT / EDIT CAR ───────────────────────────────
function updateModelOptions() {
  const chassis   = document.getElementById('f-chassis').value;
  const modelSel  = document.getElementById('f-model');
  const engineSel = document.getElementById('f-engine');
  const models    = MODELS[chassis]  || [];
  const engines   = ENGINES[chassis] || [];

  modelSel.innerHTML  = '<option value="">Select model&hellip;</option>' +
    models.map(m => `<option value="${escAttr(m)}">${escHtml(m)}</option>`).join('');
  engineSel.innerHTML = '<option value="">-</option>' +
    engines.map(e => `<option value="${escAttr(e)}">${escHtml(e)}</option>`).join('');
}

function updateSubmitNotice() {
  const notice = document.getElementById('submitNotice');
  if (notice) notice.classList.toggle('hidden', !!currentUser);
}

async function submitCar(e) {
  e.preventDefault();
  const errEl     = document.getElementById('formError');
  const successEl = document.getElementById('formSuccess');
  const submitBtn = document.getElementById('submitBtn');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!currentUser) {
    errEl.textContent = 'You must be logged in to register a car.';
    errEl.classList.remove('hidden'); return;
  }

  const editId = document.getElementById('editCarId').value;
  const isEdit = !!editId;
  const get = id => document.getElementById(id)?.value || '';

  const rawVin   = get('f-vin').trim().toUpperCase()   || null;
  const rawFrame = get('f-frame').trim().toUpperCase() || null;

  const carData = {
    user_id:            currentUser.id,
    chassis:            get('f-chassis'),
    model:              get('f-model'),
    trim:               get('f-trim')               || null,
    vin:                rawVin,
    frame_number:       rawFrame,
    mfg_year:           parseInt(get('f-year'))      || null,
    mfg_month:          parseInt(get('f-month'))     || null,
    plant:              get('f-plant')               || null,
    body_type:          get('f-body')                || null,
    body_shape:         get('f-body-shape')          || null,
    engine:             get('f-engine')              || null,
    transmission:       get('f-transmission')        || null,
    gear_shift:         get('f-gear-shift')          || null,
    fuel_system:        get('f-fuel-system')         || null,
    drive_side:         get('f-drive')               || null,
    grade:              get('f-grade')               || null,
    market:             get('f-market')              || null,
    destination:        get('f-destination')         || null,
    color:              get('f-color')               || null,
    color_code:         get('f-color-code')          || null,
    trim_code:          get('f-trim-code')           || null,
    interior_color:     get('f-interior')            || null,
    interior_material:  get('f-interior-material')   || null,
    title_status:       get('f-title-status')        || null,
    verification:       get('f-verification')        || null,
    country:            get('f-country')             || null,
    location:           get('f-location')            || null,
    current_owner_name: get('f-owner')               || null,
    notes:              get('f-notes')               || null,
  };

  // Track whether VIN came from the directory or was typed manually.
  // For new registrations always record it; for edits only update if the user
  // actively picked an entry from the directory (to avoid resetting a
  // previously-verified VIN when saving unrelated field changes).
  if (!isEdit) {
    carData.vin_matched = !!selectedVinEntry;
  } else if (selectedVinEntry) {
    carData.vin_matched = true;
  }

  if (!carData.chassis || !carData.model) {
    errEl.textContent = 'Chassis and Model are required.';
    errEl.classList.remove('hidden'); return;
  }
  if (!rawVin && !rawFrame) {
    errEl.textContent = 'A VIN or Frame Number is required to register a car.';
    errEl.classList.remove('hidden'); return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = isEdit ? 'Saving…' : 'Registering…';

  try {
    let carId;

    if (isEdit) {
      const { error } = await db.from('cars')
        .update({ ...carData, updated_at: new Date().toISOString() })
        .eq('id', parseInt(editId));
      if (error) { handleCarError(error, errEl); return; }
      carId = parseInt(editId);
    } else {
      const { data, error } = await db.from('cars').insert(carData).select('id').single();
      if (error) { handleCarError(error, errEl); return; }
      carId = data.id;
    }

    // Upload new images in parallel
    if (pendingFiles.length) {
      const { count: existingCount } = await db.from('car_images')
        .select('*', { count: 'exact', head: true }).eq('car_id', carId);
      const firstIsPrimary = (existingCount || 0) === 0;

      await Promise.all(pendingFiles.map(async (file, i) => {
        try {
          const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
          const path = `${currentUser.id}/${carId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await db.storage.from('car-images').upload(path, file);
          if (upErr) return;
          const { data: { publicUrl } } = db.storage.from('car-images').getPublicUrl(path);
          const isPrimary = firstIsPrimary && i === 0;
          await db.from('car_images').insert({
            car_id: carId, storage_path: path, public_url: publicUrl, is_primary: isPrimary
          });
          if (isPrimary) {
            await db.from('cars').update({ primary_image_url: publicUrl }).eq('id', carId);
          }
        } catch {}
      }));
    }

    successEl.textContent = isEdit ? 'Car updated successfully!' : 'Car registered successfully!';
    successEl.classList.remove('hidden');
    resetForm();
    loadStats();
    setTimeout(() => showCarDetail(carId), 1500);

  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = document.getElementById('editCarId').value ? 'Save Changes' : 'Register Car';
  }
}

function handleCarError(error, errEl) {
  if (error.code === '23505') {
    if (error.message.includes('vin'))        errEl.textContent = 'A car with this VIN is already registered.';
    else if (error.message.includes('frame')) errEl.textContent = 'A car with this Frame Number is already registered.';
    else                                      errEl.textContent = 'Duplicate entry detected.';
  } else {
    errEl.textContent = error.message || 'An error occurred.';
  }
  errEl.classList.remove('hidden');
}

async function editCar(id) {
  try {
    const { data: car } = await db.from('cars')
      .select('*, car_images(*)').eq('id', id).single();
    if (!car) throw new Error('Not found');

    showPage('submit');
    document.getElementById('editCarId').value = id;

    const chassisSel = document.getElementById('f-chassis');
    chassisSel.value = car.chassis || '';
    updateModelOptions();

    const set = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) el.value = val || '';
    };
    set('f-model',              car.model);         set('f-trim',              car.trim);
    set('f-vin',                car.vin);           set('f-frame',             car.frame_number);
    set('f-year',               car.mfg_year);      set('f-month',             car.mfg_month);
    set('f-plant',              car.plant);         set('f-body',              car.body_type);
    set('f-body-shape',         car.body_shape);
    set('f-engine',             car.engine);        set('f-transmission',      car.transmission);
    set('f-gear-shift',         car.gear_shift);    set('f-fuel-system',       car.fuel_system);
    set('f-drive',              car.drive_side);
    set('f-grade',              car.grade);         set('f-market',            car.market);
    set('f-destination',        car.destination);
    set('f-color',              car.color);         set('f-color-code',        car.color_code);
    set('f-trim-code',          car.trim_code);     set('f-interior',          car.interior_color);
    set('f-interior-material',  car.interior_material);
    set('f-title-status',       car.title_status);  set('f-verification',      car.verification);
    set('f-country',            car.country);       set('f-location',          car.location);
    set('f-owner',              car.current_owner_name);
    set('f-notes',              car.notes);

    document.getElementById('submitBtn').textContent = 'Save Changes';
    const ph = document.querySelector('#page-submit h1');
    if (ph) ph.textContent = `Edit: ${car.model}`;

    // Show existing images
    const images = (car.car_images || [])
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    if (images.length) {
      const grid = document.getElementById('imagePreviewGrid');
      const placeholder = document.querySelector('.upload-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      grid.innerHTML = images.map(img => `
        <div class="preview-thumb">
          <img src="${escAttr(img.public_url)}" alt="Photo" />
          <button class="preview-remove" type="button"
            onclick="deleteExistingImage(${img.id}, ${id}, ${img.is_primary}, '${escAttr(img.storage_path)}')">&times;</button>
          ${img.is_primary ? '<span style="position:absolute;bottom:3px;left:4px;font-size:10px;color:gold;">&#9733;</span>' : ''}
        </div>`).join('');
    }
  } catch {
    alert('Could not load car data for editing.');
  }
}

async function deleteExistingImage(imageId, carId, wasPrimary, storagePath) {
  if (!confirm('Delete this photo?')) return;
  await db.storage.from('car-images').remove([storagePath]);
  await db.from('car_images').delete().eq('id', imageId);

  if (wasPrimary) {
    const { data: next } = await db.from('car_images')
      .select('*').eq('car_id', carId).order('created_at').limit(1).maybeSingle();
    if (next) {
      await db.from('car_images').update({ is_primary: true }).eq('id', next.id);
      await db.from('cars').update({ primary_image_url: next.public_url }).eq('id', carId);
    } else {
      await db.from('cars').update({ primary_image_url: null }).eq('id', carId);
    }
  }
  editCar(carId);
}

async function deleteCar(id) {
  if (!confirm('Remove this car from the registry? This cannot be undone.')) return;
  const { data: imgs } = await db.from('car_images')
    .select('storage_path').eq('car_id', id);
  if (imgs?.length) {
    await db.storage.from('car-images').remove(imgs.map(i => i.storage_path));
  }
  const { error } = await db.from('cars').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  loadStats();
  showPage('home');
}

function resetForm() {
  document.getElementById('carForm').reset();
  document.getElementById('editCarId').value = '';
  pendingFiles = [];
  renderPreviews();
  const placeholder = document.querySelector('.upload-placeholder');
  if (placeholder) placeholder.style.display = '';
  document.getElementById('formError')?.classList.add('hidden');
  document.getElementById('formSuccess')?.classList.add('hidden');
  document.getElementById('submitBtn').textContent = 'Register Car';
  const ph = document.querySelector('#page-submit h1');
  if (ph) ph.textContent = 'Register a Car';
  const modelSel  = document.getElementById('f-model');
  const engineSel = document.getElementById('f-engine');
  if (modelSel)  modelSel.innerHTML  = '<option value="">Select chassis first&hellip;</option>';
  if (engineSel) engineSel.innerHTML = '<option value="">-</option>';
  clearVinSelection();
}

function cancelEdit() {
  resetForm();
  showPage('home');
}

// ── IMAGE HANDLING ────────────────────────────────────────
function previewImages(event) {
  Array.from(event.target.files).forEach(f => {
    if (pendingFiles.length < 10) pendingFiles.push(f);
  });
  renderPreviews();
}

function renderPreviews() {
  const grid = document.getElementById('imagePreviewGrid');
  if (!grid) return;
  const placeholder = document.querySelector('.upload-placeholder');
  if (placeholder) placeholder.style.display = pendingFiles.length ? 'none' : '';
  grid.innerHTML = pendingFiles.map((f, i) => `
    <div class="preview-thumb">
      <img src="${URL.createObjectURL(f)}" alt="Preview" />
      <button class="preview-remove" type="button" onclick="removePreview(${i})">&times;</button>
    </div>`).join('');
}

function removePreview(idx) {
  pendingFiles.splice(idx, 1);
  renderPreviews();
}

function setupDragDrop() {
  const area = document.getElementById('uploadArea');
  if (!area) return;
  area.addEventListener('dragover',  e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', ()  => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    Array.from(e.dataTransfer.files)
      .filter(f => f.type.startsWith('image/'))
      .forEach(f => { if (pendingFiles.length < 10) pendingFiles.push(f); });
    renderPreviews();
  });
}

// ── PROFILE ───────────────────────────────────────────────
async function loadProfile() {
  if (!currentUser) { showModal('loginModal'); showPage('home'); return; }

  const profile = currentUser.profile || {};
  const name    = profile.display_name || profile.username || currentUser.email;

  document.getElementById('profileName').textContent   = name;
  document.getElementById('profileSub').textContent    =
    `@${profile.username || ''} · Member since ${formatDate(currentUser.created_at)}`;
  document.getElementById('profileAvatar').textContent = name.slice(0, 2).toUpperCase();
  document.getElementById('profileInfo').innerHTML = `
    <p style="font-weight:600;color:var(--white);margin-top:4px;">${escHtml(name)}</p>
    ${profile.username ? `<p style="color:var(--text-muted);font-size:13px;">@${escHtml(profile.username)}</p>` : ''}
    ${profile.location ? `<p style="color:var(--text-muted);font-size:13px;margin-top:4px;">&#128205; ${escHtml(profile.location)}</p>` : ''}`;

  const grid = document.getElementById('profileCarGrid');
  grid.innerHTML = '<div class="loading-spinner">Loading&hellip;</div>';

  const { data: cars } = await db.from('cars')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  renderCarGrid(grid, cars || []);
}

// ── CAR CARD RENDERING (profile page) ────────────────────
function renderCarGrid(container, cars) {
  if (!cars || !cars.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128663;</div>
        <h3>No cars yet</h3>
        <p>Register your first car to get started.</p>
      </div>`;
    return;
  }
  container.innerHTML = cars.map(carCardHTML).join('');
}

function carCardHTML(car) {
  const img = car.primary_image_url
    ? `<img src="${escAttr(car.primary_image_url)}" alt="${escAttr(car.model)}" loading="lazy" />`
    : `<div class="car-card-no-image">&#128663;</div>`;

  const year = formatYear(car.mfg_year, car.mfg_month);

  const tags = [car.transmission, car.drive_side, car.body_type,
                car.engine ? car.engine.split(' ')[0] : null].filter(Boolean);
  const ident = car.vin ? `VIN: ${car.vin}` : car.frame_number ? `Frame: ${car.frame_number}` : '';
  const loc   = [car.location, car.country].filter(Boolean).join(', ');

  return `
    <div class="car-card" onclick="showCarDetail(${car.id})">
      <div class="car-card-image">
        ${img}
        <span class="car-card-chassis-badge">${escHtml(car.chassis)}</span>
      </div>
      <div class="car-card-body">
        <div class="car-card-model">${escHtml(car.model)}</div>
        ${year ? `<div class="car-card-year">${year}</div>` : ''}
        <div class="car-card-meta">
          ${tags.map(t => `<span class="meta-tag">${escHtml(t)}</span>`).join('')}
        </div>
        <div class="car-card-footer">
          <span class="car-card-vin">${escHtml(ident)}</span>
          <span>${escHtml(loc)}</span>
        </div>
      </div>
    </div>`;
}

// ── MODALS ────────────────────────────────────────────────
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}
function closeModalBackdrop(e, id) {
  if (e.target.classList.contains('modal-backdrop')) closeModal(id);
}
function switchModal(closeId, openId) {
  closeModal(closeId);
  showModal(openId);
}

// ── HELPERS ───────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str ?? '').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

// ── ADMIN ─────────────────────────────────────────────────

let adminCarsPage = 1;
const ADMIN_PAGE_SIZE = 30;

function loadAdminPanel() {
  if (!currentUser?.profile?.is_admin) { showPage('home'); return; }
  switchAdminTab('cars');
}

function switchAdminTab(tab) {
  document.querySelectorAll('#adminTabBar .admin-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
  const el = document.getElementById(`adminTab-${tab}`);
  if (el) el.classList.remove('hidden');
  if (tab === 'cars')     loadAdminCars(1);
  if (tab === 'users')    loadAdminUsers();
  if (tab === 'feedback') loadAdminFeedback();
  if (tab === 'vins')     loadAdminVins();
}

async function loadAdminCars(page = 1) {
  adminCarsPage = page;
  const statusFilter = document.getElementById('adminCarStatusFilter')?.value || '';
  const searchTerm   = document.getElementById('adminCarSearch')?.value.trim() || '';

  let query = db.from('cars').select('*', { count: 'exact' });
  if (statusFilter) query = query.eq('status', statusFilter);
  if (searchTerm)   query = query.or(
    `vin.ilike.%${searchTerm}%,frame_number.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,chassis.ilike.%${searchTerm}%`
  );
  query = query.order('created_at', { ascending: false });
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  query = query.range(from, from + ADMIN_PAGE_SIZE - 1);

  const { data: cars, count, error } = await query;
  if (error) { document.getElementById('adminCarsBody').textContent = error.message; return; }

  const userIds = [...new Set((cars || []).filter(c => c.user_id).map(c => c.user_id))];
  let profileMap = {};
  if (userIds.length) {
    const { data: profs } = await db.from('profiles')
      .select('id, username, display_name').in('id', userIds);
    (profs || []).forEach(p => { profileMap[p.id] = p; });
  }

  renderAdminCarsTable(cars || [], profileMap, count || 0, page);
}

function renderAdminCarsTable(cars, profileMap, total, page) {
  const body  = document.getElementById('adminCarsBody');
  const pager = document.getElementById('adminCarsPager');
  if (!cars.length) {
    body.innerHTML = '<p class="admin-empty">No cars found.</p>';
    pager.innerHTML = '';
    return;
  }

  const statusOptions = ['active', 'pending', 'flagged', 'deleted'];

  body.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>ID</th><th>Chassis</th><th>Model</th><th>VIN / Frame</th>
          <th>Owner</th><th>Status</th><th>Registered</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${cars.map(c => {
            const prof  = profileMap[c.user_id];
            const owner = prof ? escHtml(prof.username) : '<span class="text-muted">—</span>';
            const ident = escHtml(c.vin || c.frame_number || '—');
            const manualVin = c.vin && c.vin_matched === false;
            const opts  = statusOptions.map(s =>
              `<option value="${s}"${c.status === s ? ' selected' : ''}>${s}</option>`
            ).join('');
            return `<tr>
              <td class="admin-id">${c.id}</td>
              <td><span class="tag ${chassisTagClass(c.chassis)}">${escHtml(c.chassis)}</span></td>
              <td class="admin-model">${escHtml(c.model)}</td>
              <td class="admin-mono">${ident}${manualVin ? ' <span class="vin-badge vin-manual" title="Manually entered VIN — not verified from directory">Manual</span>' : ''}</td>
              <td>${owner}</td>
              <td><select class="admin-status-sel" onchange="adminSetCarStatus(${c.id}, this.value)">${opts}</select></td>
              <td class="text-muted admin-nowrap">${formatDate(c.created_at)}</td>
              <td class="admin-actions">
                <button class="btn btn-ghost btn-xs" onclick="showCarDetail(${c.id})">View</button>
                <button class="btn btn-danger btn-xs" onclick="adminDeleteCar(${c.id})">Delete</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  const totalPages = Math.ceil(total / ADMIN_PAGE_SIZE);
  pager.innerHTML = totalPages <= 1 ? '' : `
    <div class="pagination">
      <span class="pager-info">${total} total &mdash; page ${page} of ${totalPages}</span>
      <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="loadAdminCars(${page - 1})">&#8249; Prev</button>
      <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="loadAdminCars(${page + 1})">Next &#8250;</button>
    </div>`;
}

async function adminSetCarStatus(carId, status) {
  const { error } = await db.from('cars').update({ status }).eq('id', carId);
  if (error) alert('Error: ' + error.message);
}

async function adminDeleteCar(carId) {
  if (!confirm(`Permanently delete car #${carId}? This cannot be undone.`)) return;
  const { error } = await db.from('cars').delete().eq('id', carId);
  if (error) { alert('Error: ' + error.message); return; }
  loadAdminCars(adminCarsPage);
}

async function loadAdminUsers() {
  const { data: users, error } = await db.from('profiles')
    .select('*').order('created_at', { ascending: false });
  if (error) { document.getElementById('adminUsersBody').textContent = error.message; return; }
  renderAdminUsersTable(users || []);
}

function renderAdminUsersTable(users) {
  const body = document.getElementById('adminUsersBody');
  if (!users.length) { body.innerHTML = '<p class="admin-empty">No users found.</p>'; return; }

  body.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Username</th><th>Display Name</th><th>Email</th>
          <th>Location</th><th>Joined</th><th>Admin</th>
        </tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td class="admin-mono">${escHtml(u.username)}</td>
            <td>${escHtml(u.display_name || '—')}</td>
            <td class="text-muted">${escHtml(u.email || '—')}</td>
            <td class="text-muted">${escHtml(u.location || '—')}</td>
            <td class="text-muted admin-nowrap">${formatDate(u.created_at)}</td>
            <td>
              <button class="btn btn-xs ${u.is_admin ? 'btn-accent' : 'btn-ghost'}"
                onclick="adminToggleAdmin('${escAttr(u.id)}', ${u.is_admin})">
                ${u.is_admin ? 'Admin ✓' : 'Make Admin'}
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function adminToggleAdmin(userId, currentIsAdmin) {
  if (currentIsAdmin && userId === currentUser?.id) {
    if (!confirm('Remove your own admin access?')) return;
  }
  const { error } = await db.from('profiles')
    .update({ is_admin: !currentIsAdmin }).eq('id', userId);
  if (error) { alert('Error: ' + error.message); return; }
  if (userId === currentUser?.id) {
    currentUser.profile.is_admin = !currentIsAdmin;
    updateNavForUser();
  }
  loadAdminUsers();
}

async function loadAdminFeedback() {
  const { data: items, error } = await db.from('feedback')
    .select('*').order('created_at', { ascending: false });
  if (error) { document.getElementById('adminFeedbackBody').textContent = error.message; return; }
  renderAdminFeedbackTable(items || []);
}

function renderAdminFeedbackTable(items) {
  const body = document.getElementById('adminFeedbackBody');
  if (!items.length) { body.innerHTML = '<p class="admin-empty">No feedback yet.</p>'; return; }

  body.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Date</th><th>Category</th><th>Name</th><th>Email</th><th>Message</th>
        </tr></thead>
        <tbody>
          ${items.map(f => `<tr>
            <td class="text-muted admin-nowrap">${formatDate(f.created_at)}</td>
            <td><span class="admin-cat">${escHtml(f.category)}</span></td>
            <td>${escHtml(f.name || '—')}</td>
            <td class="text-muted">${escHtml(f.email || '—')}</td>
            <td class="admin-msg">${escHtml(f.message)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── ADMIN: VIN DIRECTORY ──────────────────────────────────

async function loadAdminVins() {
  const q = document.getElementById('adminVinSearch')?.value.trim() || '';
  let query = db.from('vin_directory').select('*', { count: 'exact' });
  if (q) query = query.ilike('vin', `%${q}%`);
  query = query.order('vin').limit(200);

  const { data: vins, count, error } = await query;
  if (error) { document.getElementById('adminVinsBody').textContent = error.message; return; }
  renderAdminVinsTable(vins || [], count || 0);
}

function renderAdminVinsTable(vins, total) {
  const body = document.getElementById('adminVinsBody');
  if (!vins.length) {
    body.innerHTML = '<p class="admin-empty">No VINs in directory yet. Use "+ Add VIN" above to start building the list.</p>';
    return;
  }

  body.innerHTML = `
    <p class="admin-count">${total} VIN${total !== 1 ? 's' : ''} in directory</p>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>VIN</th><th>Frame</th><th>Chassis</th><th>Model</th>
          <th>Year</th><th>Engine</th><th>Trans</th><th>Color</th><th></th>
        </tr></thead>
        <tbody>
          ${vins.map(v => `<tr>
            <td class="admin-mono">${escHtml(v.vin)}</td>
            <td class="admin-mono">${escHtml(v.frame_number || '—')}</td>
            <td>${v.chassis ? `<span class="tag ${chassisTagClass(v.chassis)}">${escHtml(v.chassis)}</span>` : '—'}</td>
            <td>${escHtml(v.model || '—')}</td>
            <td class="text-muted">${v.mfg_year || '—'}</td>
            <td class="text-muted">${escHtml(v.engine || '—')}</td>
            <td class="text-muted">${escHtml(v.transmission || '—')}</td>
            <td class="text-muted">${escHtml(v.color || '—')}</td>
            <td><button class="btn btn-danger btn-xs" onclick="adminDeleteVin(${v.id})">Delete</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function showAddVinForm() {
  document.getElementById('adminAddVinForm').classList.remove('hidden');
}

function hideAddVinForm() {
  document.getElementById('adminAddVinForm').classList.add('hidden');
  document.getElementById('adminVinError').classList.add('hidden');
}

async function adminAddVin() {
  const errEl = document.getElementById('adminVinError');
  errEl.classList.add('hidden');

  const get = id => document.getElementById(id)?.value.trim() || '';
  const vin = get('av-vin').toUpperCase();
  if (!vin) {
    errEl.textContent = 'VIN is required.';
    errEl.classList.remove('hidden');
    return;
  }

  const entry = {
    vin,
    frame_number: get('av-frame').toUpperCase() || null,
    chassis:      get('av-chassis') || null,
    model:        get('av-model') || null,
    mfg_year:     parseInt(get('av-year')) || null,
    mfg_month:    parseInt(get('av-month')) || null,
    engine:       get('av-engine') || null,
    transmission: get('av-transmission') || null,
    color:        get('av-color') || null,
    color_code:   get('av-color-code') || null,
  };

  const { error } = await db.from('vin_directory').insert(entry);
  if (error) {
    errEl.textContent = error.message.includes('duplicate')
      ? 'This VIN already exists in the directory.'
      : error.message;
    errEl.classList.remove('hidden');
    return;
  }

  hideAddVinForm();
  ['av-vin','av-frame','av-chassis','av-model','av-year','av-month',
   'av-engine','av-transmission','av-color','av-color-code']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  loadAdminVins();
}

async function adminDeleteVin(vinId) {
  if (!confirm('Remove this VIN from the directory?')) return;
  const { error } = await db.from('vin_directory').delete().eq('id', vinId);
  if (error) { alert('Error: ' + error.message); return; }
  loadAdminVins();
}
