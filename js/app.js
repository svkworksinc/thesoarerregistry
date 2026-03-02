/* =========================================
   SOARER REGISTRY — FRONTEND APP
   Powered by Supabase (static / GitHub Pages)
   ========================================= */

// ── SUPABASE INIT ─────────────────────────────────────────────────────────────
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ENGINES = {
  Z10: ['1G-EU (2.0L I6)', '1G-GEU (2.0L DOHC I6)', '5M-GEU (2.8L I6)', '6M-GEU (3.0L I6)', 'Other'],
  Z20: ['1G-GEU (2.0L DOHC)', '1G-GTEU (2.0L Twin Turbo)', '7M-GEU (3.0L DOHC)', '7M-GTEU (3.0L Twin Turbo)', 'Other'],
  Z30: ['2JZ-GE (3.0L NA)', '1UZ-FE (4.0L V8)', '1JZ-GTE (2.5L Twin Turbo)', '1JZ-GTE (2.5L TT AWD)', 'Other'],
  Z40: ['3UZ-FE (4.3L V8)', 'Other']
};

const MODELS = {
  Z10: ['Soarer 2000GT', 'Soarer 2000GT-Extra', 'Soarer 2800GT', 'Soarer 2800GT Extra', 'Soarer 3000GT', 'Other'],
  Z20: ['Soarer 2.0GT', 'Soarer 2.0GT-Twin Turbo', 'Soarer 2.0GT-Twin Turbo L', 'Soarer 3.0GT', 'Soarer 3.0GT-Limited', 'Soarer 3.0GT-Twin Turbo', 'Other'],
  Z30: ['SC300', 'SC400', 'Soarer 3.0GT (2JZ-GE)', 'Soarer 4.0GT (1UZ-FE)', 'Soarer 2.5GT-T (1JZ-GTE)', 'Soarer 2.5GT-T Four (AWD)', 'Other'],
  Z40: ['SC430', 'Other']
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser = null;        // null | { id, email, profile: {...} }
let lightboxImages = [];
let lightboxIndex = 0;
let pendingFiles = [];
let homeChassisFilter = null;
let homeSearchQuery = '';
let registryView = 'grid';
let registryCurrentPage = 1;

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  checkSetup();

  // Listen for auth changes (login, logout, token refresh)
  db.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      const { data: profile } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      currentUser.profile = profile || {};
    } else {
      currentUser = null;
    }
    updateNavForUser();
  });

  // Restore existing session
  await db.auth.getSession();

  loadStats();
  loadHomeCars();
  loadRecentCars();
  setupDragDrop();
  handleHashNav();
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

// ── AUTH ──────────────────────────────────────────────────────────────────────
function updateNavForUser() {
  const navAuth = document.getElementById('navAuth');
  const navUser = document.getElementById('navUser');
  if (currentUser) {
    navAuth.classList.add('hidden');
    navUser.classList.remove('hidden');
    const name = currentUser.profile?.display_name || currentUser.profile?.username || currentUser.email;
    document.getElementById('navUsername').textContent = name;
  } else {
    navAuth.classList.remove('hidden');
    navUser.classList.add('hidden');
  }
}

async function doRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUser').value.trim().toLowerCase();
  const email    = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPass').value;
  const display  = document.getElementById('regDisplay').value.trim();
  const errEl    = document.getElementById('regError');
  errEl.classList.add('hidden');

  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    errEl.textContent = 'Username: 3-30 chars, letters/numbers/_ only';
    errEl.classList.remove('hidden'); return;
  }

  // Check username availability before hitting auth
  const { data: taken } = await db.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) {
    errEl.textContent = 'Username already taken';
    errEl.classList.remove('hidden'); return;
  }

  const { data, error } = await db.auth.signUp({
    email, password,
    options: { data: { username, display_name: display || username } }
  });

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('hidden'); return;
  }

  closeModal('registerModal');
  document.getElementById('regUser').value = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPass').value = '';
  document.getElementById('regDisplay').value = '';

  if (!data.session) {
    // Email confirmation required — show a notice
    alert('Account created! Please check your email to confirm your address, then log in.');
  }
}

async function doLogin(e) {
  e.preventDefault();
  const loginVal = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl    = document.getElementById('loginError');
  errEl.classList.add('hidden');

  let email = loginVal;

  // Username login: look up the email from profiles
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
  await db.auth.signOut();
  showPage('home');
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (!page) return;
  page.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'registry') loadRegistry(1);
  if (name === 'profile')  loadProfile();
  if (name === 'submit')   { resetForm(); updateSubmitNotice(); }
  if (name !== 'car')      window.location.hash = '';
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ── STATS ─────────────────────────────────────────────────────────────────────
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

// ── DATA FETCHING ─────────────────────────────────────────────────────────────
async function fetchCars({ q, chassis, model, engine, transmission, drive_side,
  body_type, color, country, mfg_year, page = 1, limit = 20 } = {}) {

  const offset = (page - 1) * limit;

  let query = db.from('cars')
    .select('*, profiles:user_id(username, display_name)', { count: 'exact' })
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

// ── HOME ──────────────────────────────────────────────────────────────────────
async function loadHomeCars() {
  const grid = document.getElementById('homeCarGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-spinner">Loading...</div>';
  const res = await fetchCars({ q: homeSearchQuery, chassis: homeChassisFilter, limit: 6 });
  renderCarGrid(grid, res.cars);
  const va = document.getElementById('homeViewAll');
  if (va) va.style.display = res.total > 6 ? 'block' : 'none';
}

async function loadRecentCars() {
  const grid = document.getElementById('recentCars');
  if (!grid) return;
  const res = await fetchCars({ limit: 3 });
  renderCarGrid(grid, res.cars);
}

function doHeroSearch() {
  homeSearchQuery = document.getElementById('heroSearch').value.trim();
  loadHomeCars();
}

function filterChassis(chassis, btn) {
  homeChassisFilter = chassis;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  loadHomeCars();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement.id === 'heroSearch') doHeroSearch();
  if (e.key === 'Escape') {
    closeLightbox();
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    document.body.style.overflow = '';
  }
});

// ── RENDER HELPERS ────────────────────────────────────────────────────────────
function renderCarGrid(container, cars) {
  if (!cars || !cars.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128663;</div>
        <h3>No cars found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>`;
    return;
  }
  container.innerHTML = cars.map(carCardHTML).join('');
}

function carCardHTML(car) {
  const img = car.primary_image_url
    ? `<img src="${escAttr(car.primary_image_url)}" alt="${escAttr(car.model)}" loading="lazy" />`
    : `<div class="car-card-no-image">&#128663;</div>`;

  const year = car.mfg_year
    ? (car.mfg_month ? `${MONTHS[car.mfg_month - 1]} ${car.mfg_year}` : `${car.mfg_year}`)
    : '';

  const tags = [car.transmission, car.drive_side, car.body_type,
                car.engine ? car.engine.split(' ')[0] : null].filter(Boolean);

  const ident = car.vin ? `VIN: ${car.vin}` : car.frame_number ? `Frame: ${car.frame_number}` : '';
  const loc = [car.location, car.country].filter(Boolean).join(', ');

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
          <span class="car-card-location">${escHtml(loc)}</span>
        </div>
      </div>
    </div>`;
}

function carListRowHTML(car) {
  const img = car.primary_image_url
    ? `<img class="car-list-thumb" src="${escAttr(car.primary_image_url)}" alt="${escAttr(car.model)}" loading="lazy" />`
    : `<div class="car-list-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px;color:#444;">&#128663;</div>`;

  const tags = [car.chassis, car.transmission, car.drive_side,
                car.engine ? car.engine.split(' ')[0] : null].filter(Boolean);
  const ident = car.vin || car.frame_number || '';
  const loc = [car.location, car.country].filter(Boolean).join(', ');

  return `
    <div class="car-list-row" onclick="showCarDetail(${car.id})">
      ${img}
      <div class="car-list-info">
        <div class="car-list-model">${escHtml(car.model)} ${car.mfg_year ? `<span style="color:var(--red)">${car.mfg_year}</span>` : ''}</div>
        <div class="car-list-sub">${escHtml(ident)}${loc ? ` · ${escHtml(loc)}` : ''}</div>
        <div class="car-list-tags">${tags.map(t => `<span class="meta-tag">${escHtml(t)}</span>`).join('')}</div>
      </div>
      <div class="car-list-right"><span class="meta-tag">${escHtml(car.chassis)}</span></div>
    </div>`;
}

// ── REGISTRY PAGE ─────────────────────────────────────────────────────────────
async function loadRegistry(page = 1) {
  registryCurrentPage = page;
  const grid      = document.getElementById('registryGrid');
  const listEl    = document.getElementById('registryList');
  const countEl   = document.getElementById('registryCount');
  const resultEl  = document.getElementById('resultCount');

  grid.innerHTML = '<div class="loading-spinner">Loading registry...</div>';
  listEl.innerHTML = '';

  const res = await fetchCars({ ...gatherFilters(), page, limit: 20 });

  countEl.textContent = `${res.total.toLocaleString()} car${res.total !== 1 ? 's' : ''} registered`;
  resultEl.textContent = `${res.total.toLocaleString()} result${res.total !== 1 ? 's' : ''}`;

  if (registryView === 'grid') {
    renderCarGrid(grid, res.cars);
  } else {
    grid.innerHTML = '';
    listEl.innerHTML = res.cars.length
      ? res.cars.map(carListRowHTML).join('')
      : '<div class="empty-state"><div class="empty-state-icon">&#128663;</div><h3>No cars found</h3><p>Try adjusting your filters.</p></div>';
  }

  renderPagination(res.page, res.pages);
}

function gatherFilters() {
  const val = id => document.getElementById(id)?.value || '';
  const f = {};
  const q = val('filterQ').trim();
  if (q)                  f.q            = q;
  if (val('filterChassis'))f.chassis       = val('filterChassis');
  if (val('filterModel'))  f.model         = val('filterModel');
  if (val('filterTrans'))  f.transmission  = val('filterTrans');
  if (val('filterDrive'))  f.drive_side    = val('filterDrive');
  if (val('filterBody'))   f.body_type     = val('filterBody');
  if (val('filterYear'))   f.mfg_year      = val('filterYear');
  if (val('filterCountry'))f.country       = val('filterCountry');
  return f;
}

function applyFilters() { loadRegistry(1); }
function clearFilters() {
  ['filterQ','filterChassis','filterModel','filterTrans','filterDrive','filterBody','filterYear','filterCountry']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  loadRegistry(1);
}

function setView(view, btn) {
  registryView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('registryGrid').classList.toggle('hidden', view !== 'grid');
  document.getElementById('registryList').classList.toggle('hidden', view !== 'list');
  loadRegistry(registryCurrentPage);
}

function renderPagination(current, total) {
  const el = document.getElementById('registryPagination');
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
  const range = pagRange(current, total);
  let html = current > 1 ? `<button class="page-btn" onclick="loadRegistry(${current - 1})">&#8249;</button>` : '';
  range.forEach(p => {
    html += p === '...'
      ? `<button class="page-btn" disabled>…</button>`
      : `<button class="page-btn${p === current ? ' active' : ''}" onclick="loadRegistry(${p})">${p}</button>`;
  });
  if (current < total) html += `<button class="page-btn" onclick="loadRegistry(${current + 1})">&#8250;</button>`;
  el.innerHTML = html;
}

function pagRange(cur, tot) {
  if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, '...', tot];
  if (cur >= tot - 3) return [1, '...', tot-4, tot-3, tot-2, tot-1, tot];
  return [1, '...', cur-1, cur, cur+1, '...', tot];
}

// ── CAR DETAIL ────────────────────────────────────────────────────────────────
async function showCarDetail(id) {
  showPageRaw('car');
  window.location.hash = `car/${id}`;
  const content = document.getElementById('carDetailContent');
  content.innerHTML = '<div class="loading-spinner" style="padding:80px;">Loading...</div>';

  try {
    let query = db.from('cars')
      .select('*, profiles:user_id(username, display_name), car_images(*)');

    if (isNaN(id)) {
      // VIN or frame number lookup
      const { data: byVin } = await db.from('cars')
        .select('*, profiles:user_id(username, display_name), car_images(*)')
        .eq('vin', String(id).toUpperCase())
        .maybeSingle();
      const { data: byFrame } = !byVin ? await db.from('cars')
        .select('*, profiles:user_id(username, display_name), car_images(*)')
        .eq('frame_number', String(id).toUpperCase())
        .maybeSingle() : { data: null };
      const car = byVin || byFrame;
      if (!car) throw new Error('Not found');
      renderCarDetail(car);
    } else {
      const { data: car, error } = await query.eq('id', parseInt(id)).single();
      if (error || !car) throw new Error('Not found');
      renderCarDetail(car);
    }
  } catch {
    content.innerHTML = `
      <div class="page-header"><div class="container"><h1>Car Not Found</h1></div></div>
      <div class="container" style="padding:40px;">
        <p style="color:var(--text-muted);">This car could not be found in the registry.</p>
        <button class="btn btn-outline mt-2" onclick="showPage('registry')">Back to Registry</button>
      </div>`;
  }
}

function renderCarDetail(car) {
  // Sort images: primary first
  const images = (car.car_images || []).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  lightboxImages = images.map(i => ({ src: i.public_url, caption: i.caption || '' }));
  lightboxIndex = 0;

  const isOwner = currentUser && car.user_id === currentUser.id;
  const year = car.mfg_year
    ? (car.mfg_month ? `${MONTHS[car.mfg_month - 1]} ${car.mfg_year}` : `${car.mfg_year}`)
    : '';

  const mainImg = images.length
    ? `<img id="galleryMain" src="${escAttr(images[0].public_url)}" alt="${escAttr(car.model)}" onclick="openLightbox(0)" />`
    : `<div class="no-photo">&#128247;<br/><span style="font-size:16px;margin-top:12px;">No photos yet</span></div>`;

  const thumbs = images.length > 1
    ? images.map((img, i) => `
        <div class="gallery-thumb${i === 0 ? ' active' : ''}" id="thumb-${i}" onclick="selectImage(${i})">
          <img src="${escAttr(img.public_url)}" alt="Photo ${i+1}" />
        </div>`).join('')
    : '';

  const row = (label, value, mono = false) => {
    const cls = !value ? 'na' : mono ? 'mono' : '';
    return `<div class="info-row">
      <span class="info-key">${label}</span>
      <span class="info-value ${cls}">${value ? escHtml(value) : 'Not recorded'}</span>
    </div>`;
  };

  const profiles = car.profiles || {};

  document.getElementById('carDetailContent').innerHTML = `
    <div class="car-detail-header">
      <div class="container">
        <div class="car-detail-breadcrumb">
          <a href="#" onclick="showPage('registry')">Registry</a> &rsaquo;
          ${escHtml(car.chassis)} &rsaquo; ${escHtml(car.model)}
        </div>
        <div class="car-detail-chassis-badge">${escHtml(car.chassis)}</div>
        <h1 class="car-detail-title">${escHtml(car.model)}
          ${car.mfg_year ? `<span style="color:var(--red);">${car.mfg_year}</span>` : ''}</h1>
        ${car.color ? `<p style="color:var(--text-muted);margin-top:8px;">${escHtml(car.color)}${car.color_code ? ` (${escHtml(car.color_code)})` : ''}</p>` : ''}
      </div>
    </div>
    <div class="container">
      <div class="car-detail-layout">
        <div class="car-detail-gallery">
          <div class="gallery-main">${mainImg}</div>
          ${thumbs ? `<div class="gallery-thumbs">${thumbs}</div>` : ''}
          ${car.notes ? `<div class="notes-box" style="margin-top:20px;"><h4>Notes</h4><p>${escHtml(car.notes)}</p></div>` : ''}
        </div>
        <div class="car-detail-info">
          ${isOwner ? `<div class="detail-actions">
            <button class="btn btn-outline btn-sm" onclick="editCar(${car.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteCar(${car.id})">Delete</button>
          </div>` : ''}

          <div class="info-panel">
            <div class="info-panel-title">Vehicle Details</div>
            ${row('Chassis', car.chassis)}
            ${row('Model', car.model)}
            ${car.trim ? row('Trim', car.trim) : ''}
            ${row('Engine', car.engine)}
            ${row('Transmission', car.transmission)}
            ${row('Drive Side', car.drive_side)}
            ${row('Body Type', car.body_type)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Production</div>
            ${row('Year', car.mfg_year ? String(car.mfg_year) : null)}
            ${row('Month', car.mfg_month ? MONTHS[car.mfg_month - 1] : null)}
            ${row('Color', car.color ? `${car.color}${car.color_code ? ` (${car.color_code})` : ''}` : null)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Identity</div>
            ${row('VIN', car.vin, true)}
            ${row('Frame #', car.frame_number, true)}
          </div>

          <div class="info-panel">
            <div class="info-panel-title">Location</div>
            ${row('Country', car.country)}
            ${row('Location', car.location)}
            ${car.current_owner_name ? row('Owner', car.current_owner_name) : ''}
          </div>

          ${profiles.username ? `
          <div class="info-panel">
            <div class="info-panel-title">Registry</div>
            <div class="info-row">
              <span class="info-key">Registered by</span>
              <span class="info-value">${escHtml(profiles.display_name || profiles.username)}</span>
            </div>
            <div class="info-row">
              <span class="info-key">Added</span>
              <span class="info-value">${formatDate(car.created_at)}</span>
            </div>
          </div>` : ''}

          <button class="btn btn-outline btn-block" onclick="showPage('registry')">&#8592; Back to Registry</button>
        </div>
      </div>
    </div>`;
}

function selectImage(index) {
  if (!lightboxImages.length) return;
  lightboxIndex = index;
  const mainImg = document.getElementById('galleryMain');
  if (mainImg) mainImg.src = lightboxImages[index].src;
  document.querySelectorAll('.gallery-thumb').forEach((t, i) => t.classList.toggle('active', i === index));
}

// ── LIGHTBOX ──────────────────────────────────────────────────────────────────
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

// ── FORM: SUBMIT / EDIT CAR ───────────────────────────────────────────────────
function updateModelOptions() {
  const chassis   = document.getElementById('f-chassis').value;
  const modelSel  = document.getElementById('f-model');
  const engineSel = document.getElementById('f-engine');
  const models    = MODELS[chassis]  || [];
  const engines   = ENGINES[chassis] || [];

  modelSel.innerHTML  = '<option value="">Select model...</option>' +
    models.map(m => `<option value="${escAttr(m)}">${escHtml(m)}</option>`).join('');
  engineSel.innerHTML = '<option value="">Unknown / Other</option>' +
    engines.map(e => `<option value="${escAttr(e)}">${escHtml(e)}</option>`).join('');
}

function updateSubmitNotice() {
  document.getElementById('submitNotice').classList.toggle('hidden', !!currentUser);
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
    trim:               get('f-trim')   || null,
    vin:                rawVin,
    frame_number:       rawFrame,
    mfg_year:           parseInt(get('f-year'))  || null,
    mfg_month:          parseInt(get('f-month')) || null,
    engine:             get('f-engine')       || null,
    transmission:       get('f-transmission') || null,
    drive_side:         get('f-drive')        || null,
    body_type:          get('f-body')         || null,
    color:              get('f-color')        || null,
    color_code:         get('f-color-code')   || null,
    country:            get('f-country')      || null,
    location:           get('f-location')     || null,
    current_owner_name: get('f-owner')        || null,
    notes:              get('f-notes')        || null,
  };

  if (!carData.chassis || !carData.model) {
    errEl.textContent = 'Chassis and Model are required.';
    errEl.classList.remove('hidden'); return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Saving...' : 'Registering...';

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

    // Upload new images
    if (pendingFiles.length) {
      // Check if car already has images (edit case)
      const { count: existingCount } = await db.from('car_images')
        .select('*', { count: 'exact', head: true }).eq('car_id', carId);
      let makePrimary = (existingCount || 0) === 0;

      for (const file of pendingFiles) {
        try {
          const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
          const path = `${currentUser.id}/${carId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await db.storage.from('car-images').upload(path, file);
          if (upErr) continue;
          const { data: { publicUrl } } = db.storage.from('car-images').getPublicUrl(path);
          await db.from('car_images').insert({
            car_id: carId, storage_path: path, public_url: publicUrl, is_primary: makePrimary
          });
          if (makePrimary) {
            await db.from('cars').update({ primary_image_url: publicUrl }).eq('id', carId);
            makePrimary = false;
          }
        } catch {}
      }
    }

    successEl.textContent = isEdit ? 'Car updated successfully!' : 'Car registered successfully!';
    successEl.classList.remove('hidden');
    resetForm();
    loadStats();
    setTimeout(() => showCarDetail(carId), 1500);

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = document.getElementById('editCarId').value ? 'Save Changes' : 'Register Car';
  }
}

function handleCarError(error, errEl) {
  if (error.code === '23505') {
    if (error.message.includes('vin'))   errEl.textContent = 'A car with this VIN is already registered.';
    else if (error.message.includes('frame')) errEl.textContent = 'A car with this Frame Number is already registered.';
    else errEl.textContent = 'Duplicate entry detected.';
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

    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    set('f-model', car.model);          set('f-trim', car.trim);
    set('f-vin', car.vin);              set('f-frame', car.frame_number);
    set('f-year', car.mfg_year);        set('f-month', car.mfg_month);
    set('f-engine', car.engine);        set('f-transmission', car.transmission);
    set('f-drive', car.drive_side);     set('f-body', car.body_type);
    set('f-color', car.color);          set('f-color-code', car.color_code);
    set('f-country', car.country);      set('f-location', car.location);
    set('f-owner', car.current_owner_name);
    set('f-notes', car.notes);

    document.getElementById('submitBtn').textContent = 'Save Changes';
    const ph = document.querySelector('#page-submit .page-header h1');
    if (ph) ph.textContent = `Edit: ${car.model}`;

    // Show existing images
    const images = (car.car_images || []).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    if (images.length) {
      const grid = document.getElementById('imagePreviewGrid');
      document.querySelector('.upload-placeholder').style.display = 'none';
      grid.innerHTML = images.map(img => `
        <div class="preview-thumb">
          <img src="${escAttr(img.public_url)}" alt="Photo" />
          <button class="preview-remove" type="button"
            onclick="deleteExistingImage(${img.id}, ${id}, ${img.is_primary}, '${escAttr(img.storage_path)}')">&times;</button>
          ${img.is_primary ? '<span style="position:absolute;bottom:2px;left:3px;font-size:10px;color:gold;">&#9733;</span>' : ''}
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

  // Reload edit form
  editCar(carId);
}

async function deleteCar(id) {
  if (!confirm('Remove this car from the registry? This cannot be undone.')) return;
  // Delete images from storage first
  const { data: imgs } = await db.from('car_images').select('storage_path').eq('car_id', id);
  if (imgs?.length) {
    await db.storage.from('car-images').remove(imgs.map(i => i.storage_path));
  }
  const { error } = await db.from('cars').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  loadStats();
  showPage('registry');
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
  const ph = document.querySelector('#page-submit .page-header h1');
  if (ph) ph.textContent = 'Register a Car';
  const modelSel  = document.getElementById('f-model');
  const engineSel = document.getElementById('f-engine');
  if (modelSel)  modelSel.innerHTML  = '<option value="">Select chassis first...</option>';
  if (engineSel) engineSel.innerHTML = '<option value="">Unknown / Other</option>';
}

function cancelEdit() {
  resetForm();
  showPage('registry');
}

// ── IMAGE HANDLING ────────────────────────────────────────────────────────────
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
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    Array.from(e.dataTransfer.files)
      .filter(f => f.type.startsWith('image/'))
      .forEach(f => { if (pendingFiles.length < 10) pendingFiles.push(f); });
    renderPreviews();
  });
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
async function loadProfile() {
  if (!currentUser) { showModal('loginModal'); showPage('home'); return; }

  const profile = currentUser.profile || {};
  const name = profile.display_name || profile.username || currentUser.email;

  document.getElementById('profileName').textContent   = name;
  document.getElementById('profileSub').textContent    = `@${profile.username || ''} · Member since ${formatDate(currentUser.created_at)}`;
  document.getElementById('profileAvatar').textContent = (name).slice(0, 2).toUpperCase();
  document.getElementById('profileInfo').innerHTML = `
    <p style="font-weight:600;color:var(--white);">${escHtml(name)}</p>
    ${profile.username ? `<p style="color:var(--text-muted);font-size:13px;">@${escHtml(profile.username)}</p>` : ''}
    ${profile.location ? `<p style="color:var(--text-muted);font-size:13px;margin-top:4px;">&#128205; ${escHtml(profile.location)}</p>` : ''}`;

  const grid = document.getElementById('profileCarGrid');
  grid.innerHTML = '<div class="loading-spinner">Loading...</div>';

  const { data: cars } = await db.from('cars')
    .select('*').eq('user_id', currentUser.id).eq('status', 'active').order('created_at', { ascending: false });

  renderCarGrid(grid, cars || []);
}

// ── MODALS ────────────────────────────────────────────────────────────────────
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

// ── HELPERS ───────────────────────────────────────────────────────────────────
// showPage activates a page AND clears hash; showPageRaw doesn't clear it
function showPageRaw(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (page) { page.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}

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
