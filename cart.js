function lfgAddToCart(name, price, btn) {
  var img = btn.closest('.prod-card').querySelector('img').src;
  var cart = JSON.parse(localStorage.getItem("lfg-cart") || "[]");
  var existing = null;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].name === name) { existing = cart[i]; }
  }
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name: name, price: price, qty: 1, image: img });
  }
  localStorage.setItem("lfg-cart", JSON.stringify(cart));
  updateCartCount();
  showAddedToast();
}

function updateCartCount() {
  var cart = JSON.parse(localStorage.getItem("lfg-cart") || "[]");
  var total = 0;
  for (var i = 0; i < cart.length; i++) { total += cart[i].qty; }
  var el = document.getElementById("cart-count");
  if (el) el.textContent = total;
}

function showAddedToast() {
  var toast = document.getElementById("added-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "added-toast";
    toast.textContent = "ADDED TO BAG ✓";
    toast.style.cssText = "position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#f5c518;color:#0a0a0a;padding:11px 22px;font-size:11px;font-weight:700;letter-spacing:2px;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:9999;";
    document.body.appendChild(toast);
  }
  toast.style.opacity = "1";
  setTimeout(function() { toast.style.opacity = "0"; }, 2000);
}

updateCartCount();

document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
});