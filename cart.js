/* ===========================================================
   LFG CART — add to bag + bag/checkout page logic
   Checkout sends the order straight to WhatsApp (+233 24 412 6931)
   No payment gateway — WhatsApp is used to confirm the order.
=========================================================== */

var LFG_WHATSAPP_NUMBER = "233244126931"; // +233 24 412 6931, international format, no +/spaces

function lfgAddToCart(name, price, btn) {
  var img = btn.closest('.prod-card').querySelector('img').src;
  var cart = JSON.parse(localStorage.getItem("lfg-cart") || "[]");
  var existingIndex = -1;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].name === name) { existingIndex = i; break; }
  }
  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({ name: name, price: price, qty: 1, image: img });
  }
  localStorage.setItem("lfg-cart", JSON.stringify(cart));
  updateCartCount();
  showAddedToast();
  renderCart(); // no-op if not on the bag page
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

/* ---------- helpers ---------- */

function lfgGetCart() {
  return JSON.parse(localStorage.getItem("lfg-cart") || "[]");
}

function lfgSaveCart(cart) {
  localStorage.setItem("lfg-cart", JSON.stringify(cart));
}

function lfgMoney(n) {
  return "GH₵ " + n.toFixed(2).replace(/\.00$/, "");
}

function lfgCartTotal(cart) {
  var total = 0;
  for (var i = 0; i < cart.length; i++) total += cart[i].price * cart[i].qty;
  return total;
}

/* ---------- bag / checkout page ---------- */

function lfgChangeQty(index, delta) {
  var cart = lfgGetCart();
  if (!cart[index]) return;
  cart[index].qty += delta;
  if (cart[index].qty < 1) {
    cart.splice(index, 1);
  }
  lfgSaveCart(cart);
  updateCartCount();
  renderCart();
}

function lfgRemoveItem(index) {
  var cart = lfgGetCart();
  cart.splice(index, 1);
  lfgSaveCart(cart);
  updateCartCount();
  renderCart();
}

function renderCart() {
  var itemsEl = document.getElementById("cart-items");
  if (!itemsEl) return; // not on the bag page, nothing to do

  var cart = lfgGetCart();
  var emptyEl = document.getElementById("cart-empty");
  var summaryEl = document.getElementById("cart-summary");
  var checkoutBtn = document.getElementById("checkoutBtn");

  itemsEl.innerHTML = "";

  if (cart.length === 0) {
    if (emptyEl) emptyEl.style.display = "block";
    if (summaryEl) summaryEl.style.display = "none";
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  if (summaryEl) summaryEl.style.display = "block";
  if (checkoutBtn) checkoutBtn.disabled = false;

  cart.forEach(function(item, index) {
    var row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML =
      '<div class="cart-row-img"><img src="' + item.image + '" alt="' + item.name + '"/></div>' +
      '<div class="cart-row-info">' +
        '<p class="cart-row-name">' + item.name + '</p>' +
        '<p class="cart-row-price">' + lfgMoney(item.price) + ' each</p>' +
        '<div class="cart-qty">' +
          '<button type="button" class="qty-btn" onclick="lfgChangeQty(' + index + ',-1)">\u2212</button>' +
          '<span class="qty-val">' + item.qty + '</span>' +
          '<button type="button" class="qty-btn" onclick="lfgChangeQty(' + index + ',1)">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="cart-row-right">' +
        '<p class="cart-row-total">' + lfgMoney(item.price * item.qty) + '</p>' +
        '<button type="button" class="cart-remove" onclick="lfgRemoveItem(' + index + ')">Remove</button>' +
      '</div>';
    itemsEl.appendChild(row);
  });

  var total = lfgCartTotal(cart);
  var totalEl = document.getElementById("cart-total");
  if (totalEl) totalEl.textContent = lfgMoney(total);
}

function lfgBuildOrderMessage(cart, details) {
  var lines = [];
  lines.push("Hi LFG! I'd like to place an order:");
  lines.push("");
  cart.forEach(function(item) {
    lines.push("- " + item.name + "  x" + item.qty + "  -  " + lfgMoney(item.price * item.qty));
  });
  lines.push("");
  lines.push("TOTAL: " + lfgMoney(lfgCartTotal(cart)));
  lines.push("");
  lines.push("Name: " + details.name);
  lines.push("Phone: " + details.phone);
  lines.push("Delivery Address: " + details.address);
  if (details.notes) {
    lines.push("Notes: " + details.notes);
  }
  return lines.join("\n");
}

function lfgCheckoutViaWhatsApp() {
  var cart = lfgGetCart();
  if (cart.length === 0) {
    alert("Your bag is empty.");
    return;
  }

  var nameEl = document.getElementById("checkout-name");
  var phoneEl = document.getElementById("checkout-phone");
  var addressEl = document.getElementById("checkout-address");
  var notesEl = document.getElementById("checkout-notes");

  var details = {
    name: nameEl ? nameEl.value.trim() : "",
    phone: phoneEl ? phoneEl.value.trim() : "",
    address: addressEl ? addressEl.value.trim() : "",
    notes: notesEl ? notesEl.value.trim() : ""
  };

  if (!details.name || !details.phone || !details.address) {
    alert("Please fill in your name, phone number, and delivery address so we can confirm your order.");
    return;
  }

  var message = lfgBuildOrderMessage(cart, details);
  var url = "https://wa.me/" + LFG_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);

  // Open WhatsApp in a new tab, then clear the bag since the order
  // has been sent through for confirmation.
  window.open(url, "_blank");
  localStorage.removeItem("lfg-cart");
  updateCartCount();
  renderCart();
}

/* ---------- init ---------- */

updateCartCount();

document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
  renderCart();
});
