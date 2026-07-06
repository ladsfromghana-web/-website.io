// EmailJS initialization
emailjs.init("hbrFQ7DoQDBt9-R_T");

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

  let cartCount = 0;
  function addToCart(btn) {
    cartCount++;
    document.getElementById('cartBtn').textContent = 'Bag (' + cartCount + ')';
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