/* =========================================
   SOARER REGISTRY — COMPONENTS
   Navbar + Footer injected into every page
   ========================================= */

const NAVBAR_HTML = `
<nav class="navbar" id="navbar">
  <div class="nav-inner">
    <a class="nav-brand" href="#" onclick="showPage('home'); return false;">
      <img
        src="img/logo.jpg"
        alt="TSR"
        class="nav-logo"
        onerror="this.style.display='none';document.getElementById('nav-logo-fb').style.display='flex';"
      />
      <span class="nav-logo-fallback" id="nav-logo-fb">TSR</span>
      <span class="nav-brand-text">THE SOARER REGISTRY</span>
    </a>

    <div class="nav-links" id="navLinks">
      <a href="#" onclick="showPage('home'); return false;">Home</a>
      <a href="#" onclick="scrollToRegistry(); return false;">Registry</a>
      <a href="#" onclick="showPage('submit'); return false;">Register</a>
      <a href="#" onclick="showPage('about'); return false;">About</a>
    </div>

    <div class="nav-right">
      <div class="nav-auth" id="navAuth">
        <button class="btn btn-ghost btn-sm" onclick="showModal('loginModal')">Login</button>
        <button class="btn btn-accent btn-sm" onclick="showModal('registerModal')">Join</button>
      </div>
      <div class="nav-user hidden" id="navUser">
        <span id="navUsername" class="nav-username"></span>
        <button class="btn btn-outline btn-sm" onclick="showPage('profile')">My Garage</button>
        <button class="btn btn-ghost btn-sm" onclick="logout()">Sign Out</button>
      </div>
      <button class="nav-toggle" id="navToggle" onclick="toggleNav()" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>
`;

const FOOTER_HTML = `
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-left">
      <span class="footer-brand">THE SOARER REGISTRY</span>
      <span class="footer-tag">Global Chassis Database &bull; Est. 1981</span>
    </div>
    <nav class="footer-nav">
      <a href="#" onclick="showPage('home'); return false;">Home</a>
      <a href="#" onclick="scrollToRegistry(); return false;">Registry</a>
      <a href="#" onclick="showPage('submit'); return false;">Register</a>
      <a href="#" onclick="showPage('about'); return false;">About</a>
    </nav>
    <div class="footer-right">
      <span class="footer-copy">&copy; 2025 The Soarer Registry</span>
      <span class="footer-disc">Not affiliated with Toyota Motor Corporation or Lexus.</span>
    </div>
  </div>
</footer>
`;

function initComponents() {
  const navRoot    = document.getElementById('navbar-root');
  const footerRoot = document.getElementById('footer-root');
  if (navRoot)    navRoot.innerHTML    = NAVBAR_HTML;
  if (footerRoot) footerRoot.innerHTML = FOOTER_HTML;
}

initComponents();
