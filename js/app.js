/* =========================================
   SOARER REGISTRY — FRONTEND APP
   Powered by Supabase (static / GitHub Pages)
   ========================================= */

// ── SUPABASE INIT ─────────────────────────────────────────
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CONSTANTS ─────────────────────────────────────────────
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

// ── STATE ─────────────────────────────────────────────────
let currentUser   = null;
let lightboxImages = [];
let lightboxIndex  = 0;
let pendingFiles   = [];
let registryPage   = 1;

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

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      const { data: profile } = await db.from('profiles')
        .select('*').eq('id', session.user.id).maybeSingle();
      currentUser.profile = profile || {};
    } else {
      currentUser = null;
    }
    updateNavForUser();
  });

  await db.auth.getSession();

  // Run independent fetches in parallel
  Promise.all([loadStats(), loadRegistryTable(1)]);
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

  if (currentUser) {
    navAuth.classList.add('hidden');
    navUser.classList.remove('hidden');
    const name = currentUser.profile?.display_name
      || currentUser.profile?.username
      || currentUser.email;
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
    errEl.textContent = 'Username: 3–30 chars, letters/numbers/_ only';
    errEl.classList.remove('hidden'); return;
  }

  const { data: taken } = await db.from('profiles')
    .select('id').eq('username', username).maybeSingle();
  if (taken) {
    errEl.textContent = 'Username already taken';
    errEl.classList.remove('hidden'); return;
  }

  const { data, error } = await db.auth.signUp({
    email, password,
    options: {
      data: { username, display_name: display || username },
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('hidden'); return;
  }

  closeModal('registerModal');
  ['regUser','regEmail','regPass','regDisplay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  if (!data.session) {
    alert('Account created! Check your email to confirm, then log in.');
  }
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
            ${row('VIN', car.vin, true)}
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
            ${row('Transmission', car.transmission)}
            ${row('Gear Shift', car.gear_shift)}
            ${row('Fuel System', car.fuel_system)}
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

// ── FORM: SUBMIT / EDIT CAR ───────────────────────────────
function updateModelOptions() {
  const chassis   = document.getElementById('f-chassis').value;
  const modelSel  = document.getElementById('f-model');
  const engineSel = document.getElementById('f-engine');
  const models    = MODELS[chassis]  || [];
  const engines   = ENGINES[chassis] || [];

  modelSel.innerHTML  = '<option value="">Select model&hellip;</option>' +
    models.map(m => `<option value="${escAttr(m)}">${escHtml(m)}</option>`).join('');
  engineSel.innerHTML = '<option value="">Unknown / Other</option>' +
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
  if (engineSel) engineSel.innerHTML = '<option value="">Unknown / Other</option>';
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
