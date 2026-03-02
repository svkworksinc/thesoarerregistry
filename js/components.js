/* =============================================================================
   THE SOARER REGISTRY — Shared Components
   Edit this file to update the navbar and footer across the entire site.
   ============================================================================= */

const NAVBAR_HTML = `
<nav class="navbar" id="navbar">
  <div class="nav-inner">
    <a class="nav-brand" href="#" onclick="showPage('home')">
      <div class="nav-logo-badge">TSR</div>
      <div class="nav-brand-text">
        <span class="nav-brand-name">THE SOARER REGISTRY</span>
        <span class="nav-brand-sub">Global Chassis Database</span>
      </div>
    </a>

    <div class="nav-links" id="navLinks">
      <a href="#" onclick="showPage('home')">Home</a>
      <a href="#" onclick="showPage('registry')">Registry</a>
      <a href="#" onclick="showPage('submit')">Register a Car</a>
      <a href="#" onclick="showPage('about')">About</a>
    </div>

    <div class="nav-auth" id="navAuth">
      <button class="btn btn-ghost btn-sm" onclick="showModal('loginModal')">Member Login</button>
      <button class="btn btn-primary btn-sm" onclick="showModal('registerModal')">Join Registry</button>
    </div>

    <div class="nav-user hidden" id="navUser">
      <span class="nav-member-tag">MEMBER</span>
      <span id="navUsername" class="nav-username"></span>
      <button class="btn btn-outline btn-sm" onclick="showPage('profile')">My Garage</button>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Sign Out</button>
    </div>

    <button class="nav-toggle" id="navToggle" onclick="toggleNav()" aria-label="Toggle navigation">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </div>
</nav>
`;

const FOOTER_HTML = `
<footer class="footer">
  <div class="container">
    <div class="footer-inner">
      <div class="footer-brand-block">
        <div class="footer-badge">TSR</div>
        <div class="footer-brand-info">
          <div class="footer-brand-name">THE SOARER REGISTRY</div>
          <p class="footer-tagline">Documenting the Legend &bull; Est. 1981</p>
        </div>
      </div>
      <nav class="footer-nav">
        <a href="#" onclick="showPage('home')">Home</a>
        <a href="#" onclick="showPage('registry')">Registry</a>
        <a href="#" onclick="showPage('submit')">Register a Car</a>
        <a href="#" onclick="showPage('about')">About</a>
      </nav>
    </div>
    <div class="footer-bottom">
      <span>&copy; 2025 The Soarer Registry &mdash; A community project. Not affiliated with Toyota Motor Corporation or Lexus.</span>
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

// Inject immediately when the script loads (DOM is ready — scripts are at end of body)
initComponents();
