const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("africabiz-cart") || "[]")
};

const $ = (selector) => document.querySelector(selector);
const formatPrice = (value) => {
  const text = String(value || "").trim();
  const numeric = Number(text.replace(/[^0-9.]/g, ""));
  if (/^-|to|varies|above|market/i.test(text) || !numeric) return text || "Ask for price";
  return `₹${numeric.toLocaleString("en-IN")}`;
};

function saveCart() {
  localStorage.setItem("africabiz-cart", JSON.stringify(state.cart));
  renderCart();
}

function addToCart(product) {
  const existing = state.cart.find((item) => item.id === product.id);
  if (existing) existing.quantity += 1;
  else state.cart.push({ ...product, quantity: 1 });
  saveCart();
  showToast(`${product.name} added to cart`);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  $(".cart-count").textContent = count;
  const host = $("#cartItems");
  if (!state.cart.length) {
    host.innerHTML = '<div class="empty">Your cart is empty.</div>';
    $("#cartTotal").textContent = "₹0";
    return;
  }
  let total = 0;
  host.innerHTML = state.cart.map((item, index) => {
    const numeric = Number(String(item.price).replace(/[^0-9.]/g, "")) || 0;
    total += numeric * item.quantity;
    return `<div class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div><strong>${item.name}</strong><small>${formatPrice(item.price)}</small></div>
      <div class="qty"><button data-action="minus" data-index="${index}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-action="plus" data-index="${index}" aria-label="Increase quantity">+</button></div>
    </div>`;
  }).join("");
  $("#cartTotal").textContent = `₹${total.toLocaleString("en-IN")}`;
}

function openCart(open) {
  $("#cartDrawer").classList.toggle("open", open);
  $("#cartOverlay").classList.toggle("open", open);
  document.body.style.overflow = open ? "hidden" : "";
}

function renderProducts(products) {
  $("#marketGrid").innerHTML = products.map((product) => `
    <article class="product-card">
      <img src="${product.image}" alt="${product.name}" loading="lazy">
      <div class="product-body">
        <h3>${product.name}</h3>
        <div class="product-meta">${product.category || "Marketplace"} · ${formatPrice(product.price)}</div>
        <div class="product-actions">
          <a class="button light" href="Seller profile.html?id=${encodeURIComponent(product.id)}">View services</a>
          <button class="button" data-add-id="${product.id}">Add to cart</button>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-add-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = state.products.find((item) => item.id === Number(button.dataset.addId));
      if (product) addToCart({ id: product.id, name: product.name, image: product.image, price: product.price });
    });
  });
}

async function loadProducts() {
  try {
    const response = await fetch("product.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load marketplace");
    state.products = await response.json();
    renderProducts(state.products);
  } catch (error) {
    $("#marketGrid").innerHTML = '<div class="empty">The marketplace could not load. Please refresh and try again.</div>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  renderCart();

  $("#cartButton").addEventListener("click", () => openCart(true));
  $("#closeCart").addEventListener("click", () => openCart(false));
  $("#cartOverlay").addEventListener("click", () => openCart(false));
  $("#menuButton").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
  $("#navLinks").addEventListener("click", (event) => {
    if (event.target.tagName === "A") $("#navLinks").classList.remove("open");
  });

  $("#searchInput").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const filtered = state.products.filter((product) => {
      const haystack = [product.name, product.category, ...(product.items || []).map((item) => item.name)]
        .join(" ").toLowerCase();
      return haystack.includes(query);
    });
    renderProducts(filtered);
  });

  $("#cartItems").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "plus") state.cart[index].quantity += 1;
    if (button.dataset.action === "minus") {
      state.cart[index].quantity -= 1;
      if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
    }
    saveCart();
  });

  $("#checkoutButton").addEventListener("click", () => {
    if (!state.cart.length) return showToast("Your cart is empty");
    const lines = ["Hello, Africabiz order:", ...state.cart.map((item) =>
      `${item.name} x${item.quantity} — ${formatPrice(item.price)}`
    )];
    window.open(`https://wa.me/917682059932?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
  });
});
