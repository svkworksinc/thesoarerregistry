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
      <span class="nav-brand-text">The Soarer Registry</span>
    </a>

    <div class="nav-links" id="navLinks">
      <a href="#" onclick="showPage('home'); return false;">Home</a>
      <a href="#" onclick="scrollToRegistry(); return false;">Registry</a>
      <a href="#" onclick="showPage('submit'); return false;">Register</a>
      <a href="#" onclick="showPage('library'); return false;">Library</a>
      <a href="#" onclick="showPage('about'); return false;">About</a>
      <a href="#" id="navAdminLink" class="nav-admin-link hidden" onclick="showPage('admin'); return false;">Admin</a>
    </div>

    <div class="nav-right">
      <div class="nav-social">
        <a class="nav-social-link" href="https://www.facebook.com/groups/862316964169732" target="_blank" rel="noopener" aria-label="Facebook Group" title="Facebook Group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
        </a>
        <a class="nav-social-link" href="https://discord.gg/k3METkt4" target="_blank" rel="noopener" aria-label="Discord Server" title="Discord Server">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
        </a>
      </div>
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
      <span class="footer-tag">Global Chassis Database</span>
      <div class="footer-social">
        <a class="footer-social-link" href="https://www.facebook.com/groups/862316964169732" target="_blank" rel="noopener" aria-label="Facebook Group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
          Facebook
        </a>
        <a class="footer-social-link" href="https://discord.gg/k3METkt4" target="_blank" rel="noopener" aria-label="Discord Server">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          Discord
        </a>
      </div>
    </div>
    <div class="footer-right">
      <button class="footer-feedback-btn" onclick="showModal('feedbackModal')">Send Feedback</button>
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
