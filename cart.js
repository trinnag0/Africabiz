// ========================================
// CART FUNCTIONALITY - MAIN SHOPPING CART
// ========================================

// DOM element references for cart UI components
let iconCart = document.querySelector('.iconCart');  // Cart icon button
let cart = document.querySelector('.cart');          // Cart sidebar container
let container = document.querySelector('.container'); // Main page container
let close = document.querySelector('.close');        // Close cart button

// ========================================
// REVIEW SYSTEM - LOCAL STORAGE HELPERS
// ========================================

/**
 * Retrieves the reviews map from localStorage
 * @returns {Object} Map of productId -> reviews array, or empty object if none exists
 */
function getReviewsMap() {
    try {
        return JSON.parse(localStorage.getItem('reviews')) || {};
    } catch (e) {
        return {};
    }
}

/**
 * Saves the reviews map to localStorage
 * @param {Object} map - Map of productId -> reviews array
 */
function saveReviewsMap(map) {
    try {
        localStorage.setItem('reviews', JSON.stringify(map));
    } catch (e) {
        // Silently fail if localStorage is not available
    }
}

/**
 * Gets all reviews for a specific product
 * @param {string|number} productId - The product identifier
 * @returns {Array} Array of review objects for the product
 */
function getReviewsFor(productId) {
    const map = getReviewsMap();
    return map[productId] || [];
}

/**
 * Adds a new review for a product
 * @param {string|number} productId - The product identifier
 * @param {number} rating - Rating from 1-5
 * @param {string} comment - Optional review comment
 */
function addReview(productId, rating, comment) {
    const map = getReviewsMap();
    if (!map[productId]) map[productId] = [];
    map[productId].push({ 
        rating: Number(rating), 
        comment: (comment || '').toString(), 
        ts: Date.now() 
    });
    saveReviewsMap(map);
}

/**
 * Calculates average rating and total count for a product
 * @param {string|number} productId - The product identifier
 * @returns {Object} Object with average rating and review count
 */
function getRatingSummary(productId) {
    const list = getReviewsFor(productId);
    if (!list.length) return { average: 0, count: 0 };
    const sum = list.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    const avg = sum / list.length;
    return { average: avg, count: list.length };
}

// ========================================
// CART UI TOGGLE FUNCTIONALITY
// ========================================

/**
 * Toggles cart sidebar visibility when cart icon is clicked
 * Slides cart in from right and shifts main container left
 */
if (iconCart) iconCart.addEventListener('click', () => {
    if (cart.style.right == '0px' || cart.style.right == '0') {
        // Hide cart - slide out to right
        cart.style.right = '-100%';
        container.style.transform = 'translateX(0)';
    } else {
        // Show cart - slide in from right
        cart.style.right = '0';
        container.style.transform = 'translateX(-400px)';
    }
});

/**
 * Closes cart sidebar when close button is clicked
 * Resets container position to normal
 */
if (close) close.addEventListener('click', () => {
    cart.style.right = '-100%';
    container.style.transform = 'translate(0)';
});

// ========================================
// PRODUCT DATA LOADING
// ========================================

// Global variable to store product data
let products = null;

/**
 * Loads product data from JSON file and renders products
 * Fetches product.json and populates the products array
 */
fetch('product.json')
    .then(response => response.json())
    .then(data => {
        products = data;
        renderProducts(products);
    });

// ========================================
// PRODUCT RENDERING
// ========================================

/**
 * Renders products in the product grid
 * @param {Array} filteredList - Array of products to display
 */
function renderProducts(filteredList) {
  const listProductHTML = document.querySelector('.listProduct');
  listProductHTML.innerHTML = '';

  // Show message if no products found
  if (!filteredList || filteredList.length === 0) {
    listProductHTML.innerHTML = '<p>😕 No matching products found.</p>';
    return;
  }

  // Render each product in the grid
  filteredList.forEach(product => {
    let newProduct = document.createElement('div');
    newProduct.classList.add('item');

    // Parse and format price display
    const priceText = (product.price ?? '').toString();
    const isDescriptive = /[a-zA-Z%]/.test(priceText);  // Check if price contains text
    const hasRange = /-|\bto\b/i.test(priceText);       // Check if price is a range
    const priceNumeric = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
    const displayPriceText = (isDescriptive || hasRange) ? priceText : `₹ ${priceNumeric.toFixed(2)}`;

    // Generate star rating display
    const rating = getRatingSummary(product.id);
    const stars = '★★★★★';
    const filled = Math.round(rating.average);
    const starHTML = `<span class="stars" aria-label="${rating.average.toFixed(1)} out of 5">` +
      `<span style="color:#f5a623">${stars.slice(0, filled)}</span><span style="color:#ccc">${stars.slice(filled)}</span>` +
      `</span>`;

    // Create product card HTML
    newProduct.innerHTML = `
      <img src="${product.image}" alt="${product.name}" style="cursor:pointer;">
      <h2>${product.name}</h2>
      <button class="view-profile-btn" onclick="window.location.href='Seller profile.html?id=${product.id}'" style="margin:8px 0 6px 0; padding:6px 18px; background:#f59e0b; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">View</button>
      <div class="ratingRow">${starHTML} <span class="ratingText">${rating.count} reviews</span></div>
      <div class="price">${displayPriceText}</div>
      <div class="actions"><button onclick="addCart(${product.id})">Add To Cart</button></div>
    `;

    listProductHTML.appendChild(newProduct);
  });
}


// ========================================
// CART DATA MANAGEMENT
// ========================================

// Global array to store cart items
let listCart = [];

/**
 * Loads cart data from cookies and renders cart HTML
 * Parses the listCart cookie and populates the cart array
 */
function checkCart() {
    try {
        const localCart = JSON.parse(localStorage.getItem('africabiz-cart') || '[]');
        if (Array.isArray(localCart) && localCart.length) {
            listCart = localCart;
        } else {
            var cookieValue = document.cookie
                .split(';')
                .find(row => row.trim().startsWith('listCart='));
            if (cookieValue) listCart = JSON.parse(decodeURIComponent(cookieValue.split('=')[1]));
        }
    } catch (e) {
        listCart = [];
    }
    if (typeof addCartToHTML === 'function') addCartToHTML();
}

// Initialize cart on page load
checkCart();

// ========================================
// CART NOTIFICATION SYSTEM
// ========================================

/**
 * Shows a floating notification when a product is added to cart
 * @param {string} productName - Name of the product added to cart
 */
function showAddToCartMessage(productName) {
    let msg = document.createElement('div');
    msg.className = 'add-to-cart-message';
    msg.innerText = `${productName} has been added to cart!`;
    document.body.appendChild(msg);
    
    // Auto-remove notification after 1.2 seconds with fade effect
    setTimeout(() => {
        msg.classList.add('fade-out');
        setTimeout(() => document.body.removeChild(msg), 600);
    }, 1200);
}

// ========================================
// CART OPERATIONS
// ========================================

/**
 * Adds a product to the cart or increases its quantity if already present
 * @param {number} idProduct - The product ID to add to cart
 */
function addCart(idProduct) {
    let productCopy = JSON.parse(JSON.stringify(products));
    
    // Check if product is already in cart
    let productInCart = listCart.find(product => product.id === idProduct);
    
    if (!productInCart) {
        // Add new product to cart
        let dataProduct = productCopy.find(product => product.id === idProduct);
        dataProduct.quantity = 1;
        listCart.push(dataProduct);
        showAddToCartMessage(dataProduct.name);
    } else {
        // Increase quantity of existing product
        productInCart.quantity++;
        let dataProduct = productCopy.find(product => product.id === idProduct);
        showAddToCartMessage(dataProduct.name);
    }
    
    // Persist cart for both the old and new marketplace pages
    localStorage.setItem("africabiz-cart", JSON.stringify(listCart));
    document.cookie = "listCart=" + encodeURIComponent(JSON.stringify(listCart)) + ";expires=Thu, 31 Dec 2037 12:00:00 UTC;path=/";
    
    // Update cart display
    addCartToHTML();
}

/**
 * Renders the cart items in the cart sidebar
 * Displays product info, quantity controls, and calculates totals
 */
function addCartToHTML() {
    // Clear existing cart items
    let listCartHTML = document.querySelector('.listCart');
    listCartHTML.innerHTML = '';
    let totalHTML = document.querySelector('.totalQuantity');
    let totalQuantity = 0;

    if (listCart) {
        listCart.forEach(product => {
            if (product) {
                let newCart = document.createElement('div');
                newCart.classList.add('item');
                
                // Parse and format price display
                const priceText = (product.price ?? '').toString();
                const isDescriptive = /[a-zA-Z%]/.test(priceText);
                const hasRange = /-|\bto\b/i.test(priceText);
                let priceNumeric = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                if (isNaN(priceNumeric) || priceNumeric < 1) priceNumeric = 5.00;
                const displayPriceText = (isDescriptive || hasRange) ? priceText : `₹ ${priceNumeric.toFixed(2)}`;
                let totalDisplay = (hasRange) ? 'Varies' : `₹ ${(priceNumeric * product.quantity).toFixed(2)}`;
                
                // Use itemName and itemImage if present (from seller profile mini shop)
                const displayName = product.itemName || product.name;
                const displayImage = product.itemImage || product.image;
                
                // Create cart item HTML
                newCart.innerHTML = `
                    <img src="${displayImage}" alt="${displayName}">
                    <div class="content">
                        <div class="name">${displayName}</div>
                        <div class="price">${displayPriceText}</div>
                    </div>
                    <div class="quantity" style="display:flex;align-items:center;gap:8px;">
                        <button onclick="changeQuantity(${product.id}, '-')">-</button>
                        <span class="value">${product.quantity}</span>
                        <button onclick="changeQuantity(${product.id}, '+')">+</button>
                    </div>
                    <div class="returnPrice">${totalDisplay}</div>
                `;
                listCartHTML.appendChild(newCart);
                totalQuantity += product.quantity;
            }
        });
    }
    
    // Update total quantity display
    totalHTML.innerText = totalQuantity;
}

/**
 * Changes the quantity of a product in the cart
 * @param {number} idProduct - The product ID
 * @param {string} type - Either '+' to increase or '-' to decrease quantity
 */
function changeQuantity(idProduct, type) {
    let productInCart = listCart.find(product => product.id === idProduct);
    if (productInCart) {
        switch (type) {
            case '+':
                // Increase quantity
                productInCart.quantity++;
                break;
            case '-':
                // Decrease quantity
                productInCart.quantity--;
                // Remove item if quantity reaches 0 or below
                if (productInCart.quantity <= 0) {
                    listCart = listCart.filter(product => product.id !== idProduct);
                }
                break;
            default:
                break;
        }
        
        localStorage.setItem("africabiz-cart", JSON.stringify(listCart));
        document.cookie = "listCart=" + encodeURIComponent(JSON.stringify(listCart)) + ";expires=Thu, 31 Dec 2037 12:00:00 UTC;path=/";

        // Update cart display
        addCartToHTML();
    }
}

// ========================================
// USER SIDEBAR FUNCTIONALITY
// ========================================

// Example: Set username after login
var username = "My Account"; // Replace with actual username from login

/**
 * Opens the user sidebar menu
 * Shows sidebar and overlay, updates profile link with username
 */
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('show');
    // Update profile link with username
    document.getElementById('profile-link').innerHTML = '<i class="fas fa-user"></i> ' + username;
}

/**
 * Closes the user sidebar menu
 * Hides sidebar and overlay
 */
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}
        
// ========================================
// SEARCH FUNCTIONALITY
// ========================================

// DOM elements for search functionality
const searchInput = document.querySelector('.search-input');
const productGrid = document.querySelector('.listProduct');

// Load products and render initial display
fetch('product.json')
  .then(response => response.json())
  .then(data => {
    products = data;
    renderProducts(products); // Initial render
  })
  .catch(err => {
    document.querySelector('.listProduct').innerHTML = '<p>⚠️ Failed to load products.</p>';
    console.error("Fetch error:", err);
  });

/**
 * Handles search input and filters products
 * Searches through product names and nested items
 */
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query === ''
    ? products
    : products.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (Array.isArray(item.items) && item.items.some(sub =>
          sub.name && sub.name.toLowerCase().includes(query)
        ))
      );
  renderProducts(filtered);
});

// ========================================
// SCROLL EFFECTS
// ========================================

/**
 * Adds/removes 'scrolled' class to header based on scroll position
 * Provides visual feedback when user scrolls down the page
 */
window.addEventListener('scroll', function() {
  const header = document.querySelector('.header');
  if (window.scrollY > 100) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

