// EmailJS initialization
emailjs.init("hbrFQ7DoQDBt9-R_T");

  // Liquid glass nav — stays hidden at the top, fades/slides in once scrolling starts
  const siteNav = document.querySelector('nav');
  if (siteNav) {
    const revealAt = 40; // px scrolled before the pill appears
    const toggleNav = () => {
      siteNav.classList.toggle('nav-visible', window.scrollY > revealAt);
    };
    toggleNav();
    window.addEventListener('scroll', toggleNav, { passive: true });
  }

  document.querySelectorAll('.reveal').forEach(el => {
    new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); });
    }, {threshold: 0.08}).observe(el);
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tab.closest('.filter-tabs').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Mobile sidebar (collections + bag), opened from the hamburger in the navbar
  const hamburger = document.getElementById('navHamburger');
  const sidebar = document.getElementById('navSidebar');
  const overlay = document.getElementById('navOverlay');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    sidebar.setAttribute('aria-hidden', 'false');
    hamburger.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    sidebar.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
  }

  if (hamburger && sidebar && overlay) {
    hamburger.addEventListener('click', openSidebar);
    overlay.addEventListener('click', closeSidebar);
    document.getElementById('navSidebarClose').addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', closeSidebar));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
  }

  let cartCount = 0;
  function addToCart(btn) {
    cartCount++;
    document.querySelectorAll('.cart-trigger').forEach(el => el.textContent = 'Bag (' + cartCount + ')');
    const orig = btn.textContent;
    btn.textContent = '✓ Added';
    setTimeout(() => btn.textContent = orig, 1500);
  }

  document.getElementById('subBtn').addEventListener('click', () => {
  const input = document.querySelector('.newsletter-input');
  
  if(!input.value.includes('@')) {
    alert('Please enter a valid email.');
    return;
  }

  emailjs.send("service_cg4k57m", "template_79e1pw9", {
    email: input.value,
  })
  .then(() => {
    document.getElementById('subBtn').textContent = '✓ Done';
    input.value = '';
    setTimeout(() => {
      document.getElementById('subBtn').textContent = 'Join';
    }, 2500);
  })
  .catch((error) => {
    console.error('EmailJS error:', error);
    alert('Something went wrong. Try again.');
  });
});
