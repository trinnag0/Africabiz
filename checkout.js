// ========================================
// CHECKOUT PAGE - CART MANAGEMENT
// ========================================

// Global in-memory snapshot of the cart (synced from the cookie on page load)
let listCart = [];

// ========================================
// REVIEW SYSTEM - LOCAL STORAGE HELPERS
// ========================================
/**
 * Read the entire productId -> reviews[] map from localStorage.
 * Returns an empty object if missing or invalid JSON.
 */
function getReviewsMap() {
    try {
        return JSON.parse(localStorage.getItem('reviews')) || {};
    } catch (e) { return {}; }
}
/**
 * Persist the productId -> reviews[] map to localStorage.
 */
function saveReviewsMap(map) {
    try { localStorage.setItem('reviews', JSON.stringify(map)); } catch (e) {}
}
/**
 * Get all reviews for a specific product.
 */
function getReviewsFor(productId) {
    const map = getReviewsMap();
    return map[productId] || [];
}
/**
 * Append a new review for a product with a numeric rating and optional comment.
 */
function addReview(productId, rating, comment) {
    const map = getReviewsMap();
    if (!map[productId]) map[productId] = [];
    map[productId].push({ rating: Number(rating), comment: (comment || '').toString(), ts: Date.now() });
    saveReviewsMap(map);
}
/**
 * Compute average rating and total count for a product.
 */
function getRatingSummary(productId) {
    const list = getReviewsFor(productId);
    if (!list.length) return { average: 0, count: 0 };
    const sum = list.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    const avg = sum / list.length;
    return { average: avg, count: list.length };
}

// ========================================
// CART DATA LOADING
// ========================================
/**
 * Parse the `listCart` cookie (JSON) and populate the in-memory `listCart`.
 * Then render the cart into the DOM.
 */
function checkCart() {
    try {
        listCart = JSON.parse(localStorage.getItem('africabiz-cart') || '[]');
    } catch (e) {
        listCart = [];
    }
    if (!Array.isArray(listCart) || !listCart.length) {
        var cookieValue = document.cookie
            .split(';')
            .find(row => row.trim().startsWith('listCart='));
        if (cookieValue) {
            try { listCart = JSON.parse(decodeURIComponent(cookieValue.split('=')[1])) || []; } catch (e) { listCart = []; }
        }
    }
    addCartToHTML();
}
checkCart(); // initialize cart from cookie and render

/**
 * Render the current `listCart` into the checkout summary panel.
 * Calculates totals and shows rating stars per product.
 */
function addCartToHTML() {
    // Clear data from HTML
    let listCartHTML = document.querySelector('.returnCart .list');
    listCartHTML.innerHTML = '';
    let totalQuantityHTML = document.querySelector('.totalQuantity');
    let totalPriceHTML = document.querySelector('.totalPrice');
    let totalQuantity = 0;
    let totalPrice = 0;

    // If there are products in the cart
    if (listCart) {
        listCart.forEach(product => {
            if (product) {
                // Determine if price is fixed numeric or descriptive/range text
                let priceText = (product.price ?? '').toString();
                const isDescriptive = /[a-zA-Z%]/.test(priceText);
                const hasRange = /-|to/i.test(priceText);
                let priceNumeric = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                const isFixed = !isNaN(priceNumeric) && !isDescriptive && !hasRange && priceNumeric >= 0;
                let newP = document.createElement('div');
                newP.classList.add('item');
                // Use itemName and itemImage if present (from seller profile mini shop)
                const displayName = product.itemName || product.name;
                const displayImage = product.itemImage || product.image;
                // Compute rating visuals for this product
                const rating = getRatingSummary(product.id);
                const stars = '\u2605\u2605\u2605\u2605\u2605';
                const filled = Math.round(rating.average);
                const starHTML = `<span class="stars" aria-label="${rating.average.toFixed(1)} out of 5">` +
                    `<span style="color:#f5a623">${stars.slice(0, filled)}</span><span style="color:#ccc">${stars.slice(filled)}</span>` +
                    `</span>`;
                const unitPriceDisplay = isFixed
                    ? `₹ ${priceNumeric.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}/1 product`
                    : `${priceText}/1 product`;
                const lineTotalDisplay = isFixed
                    ? `₹ ${(priceNumeric * product.quantity).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`
                    : '-';
                newP.innerHTML = `
                    <img src="${displayImage}" alt="Product Image">
                    <div class="info">
                        <div class="name">${displayName}</div>
                        <div class="price">${unitPriceDisplay}</div>
                        <div class="ratingRow">${starHTML} <span class="ratingText">${rating.count} reviews</span></div>
                        <div class="actions"><button class="reviewBtn" data-product-id="${product.id}">Review</button></div>
                        <div class="quantity"><span class="value">${product.quantity}</span></div>
                        <div class="returnPrice">${lineTotalDisplay}</div>
                    </div>`;
                listCartHTML.appendChild(newP);
                totalQuantity += product.quantity;
                if (isFixed) {
                    totalPrice += priceNumeric * product.quantity;
                }
            }
        });
    }
    totalQuantityHTML.innerText = totalQuantity;
    totalPriceHTML.innerText = '₹ ' + totalPrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});

    
};

// ========================================
// WHATSAPP CHECKOUT CONFIGURATION
// ========================================

// Default handler number (international format digits only, without leading +)
const WHATSAPP_DEFAULT_NUMBER = '91 76820 59932'; // TODO: replace with your default handler number (international format without +)
/**
 * Keyword -> WhatsApp number map. If a cart item name contains a keyword,
 * it will be routed to the corresponding provider number.
 */
const PROVIDER_NUMBER_BY_KEYWORD = {
    barber: '91 76820 60310',
    burger: '263 78 612 0838',
    smoek: '263 78 489 2072',
    repair: '91 76820 60013',
    makeup: '91 76820 60650',
    media: '263 78 472 3231',
    saloon: '91 76820 62701',
    shoe: '263 780805084',
    event: '91 76820 60013'
};

/**
 * (Legacy helper) Pick a single provider number based on keyword matches in the cart.
 * If multiple providers match, fall back to the default number.
 */
function selectProviderNumberFromCart(cartItems) {
    const matchedNumbers = new Set();
    const lowerKeywords = Object.keys(PROVIDER_NUMBER_BY_KEYWORD);
    cartItems.forEach((p) => {
        const name = (p.name || '').toLowerCase();
        lowerKeywords.forEach((kw) => {
            if (name.includes(kw)) {
                const num = PROVIDER_NUMBER_BY_KEYWORD[kw];
                if (num) matchedNumbers.add(num);
            }
        });
    });
    if (matchedNumbers.size === 1) {
        return Array.from(matchedNumbers)[0];
    }
    return WHATSAPP_DEFAULT_NUMBER;
}

/**
 * Build a human-readable WhatsApp message summarizing the order and items.
 * Handles descriptive prices (e.g., "market price") by excluding them from totals.
 */
function buildWhatsappMessage(name, phone, country, address, message, cartItems) {
    let lines = [];
    lines.push('Hello, I\'d like to place an order.');
    lines.push(`Name: ${name || ''}`);
    lines.push(`Phone: ${phone || ''}`);
    lines.push(`Country: ${country || ''}`);
    lines.push(`Address: ${address || ''}`);
    if (message) {
        lines.push('');
        lines.push('Message/Request:');
        lines.push(message);
    }
    lines.push('');
    lines.push('Items:');
    let total = 0;
    cartItems.forEach((product) => {
        const priceText = (product.price ?? '').toString();
        const isDescriptive = /[a-zA-Z%]/.test(priceText);
        const hasRange = /-|to/i.test(priceText);
        const priceNumeric = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        const display = (isDescriptive || hasRange) ? priceText : `₹ ${priceNumeric.toFixed(2)}`;
        const lineTotal = isDescriptive ? '-' : `₹ ${(priceNumeric * (product.quantity || 1)).toFixed(2)}`;
        if (!isDescriptive) total += priceNumeric * (product.quantity || 1);
        // Use itemName and itemImage if present (from seller profile mini shop)
        const displayName = product.itemName || product.name;
        const displayImage = product.itemImage || product.image;
        let details = `- ${displayName} x${product.quantity || 1} (${display}) => ${lineTotal}`;
        if (product.itemName) {
            details += `\n  Seller: ${product.name}`;
        }
        if (product.itemImage) {
            details += `\n  Image: ${product.itemImage}`;
        }
        lines.push(details);
    });
    lines.push('');
    lines.push(`Total (numeric items): ₹ ${total.toFixed(2)}`);
    return lines.join('\n');
}

/**
 * Validate form fields before proceeding to checkout
 */
function validateForm() {
    const name = document.getElementById('name')?.value?.trim() || '';
    const phone = document.getElementById('phone')?.value?.trim() || '';
    const country = document.getElementById('country')?.value || '';
    const address = document.getElementById('address')?.value || '';
    
    let isValid = true;
    let errorMessages = [];
    
    // Clear previous error styles
    clearValidationErrors();
    
    // Validate name (required, minimum 2 characters)
    if (!name || name.length < 2) {
        showFieldError('name', 'Please enter a valid full name (minimum 2 characters)');
        isValid = false;
        errorMessages.push('Name is required and must be at least 2 characters long');
    }
    
    // Validate phone number (required, valid format)
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
    if (!phone || !phoneRegex.test(phone)) {
        showFieldError('phone', 'Please enter a valid phone number (10-15 digits)');
        isValid = false;
        errorMessages.push('Phone number is required and must be 10-15 digits');
    }
    
    // Validate address selection (required)
    if (!address) {
        showFieldError('address', 'Please select an address');
        isValid = false;
        errorMessages.push('Address selection is required');
    }
    
    // Validate country selection (required)
    if (!country) {
        showFieldError('country', 'Please select a country');
        isValid = false;
        errorMessages.push('Country selection is required');
    }
    
    if (!isValid) {
        // Just return false - errors are already shown inline
        return false;
    }
    
    return true;
}

/**
 * Show validation error for a specific field
 */
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.style.borderColor = '#ff4444';
        field.style.backgroundColor = '#ffe6e6';
        
        // Remove existing error message
        const existingError = field.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.color = '#ff4444';
        errorDiv.style.fontSize = '0.9rem';
        errorDiv.style.marginTop = '4px';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }
}

/**
 * Clear all validation errors
 */
function clearValidationErrors() {
    const fields = ['name', 'phone', 'address', 'country'];
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '';
            field.style.backgroundColor = '';
            
            const errorMessage = field.parentNode.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        }
    });
}

/**
 * Main checkout click handler.
 * Validates form first, then splits cart items by provider number (via keyword match) and opens a
 * WhatsApp chat per provider. Shows a fallback overlay if popups are blocked.
 */
function handleCheckoutClick() {
    // Validate form first
    if (!validateForm()) {
        return;
    }
    
    const name = document.getElementById('name')?.value?.trim() || '';
    const phone = document.getElementById('phone')?.value?.trim() || '';
    const country = document.getElementById('country')?.value || '';
    const address = document.getElementById('address')?.value || '';
    const message = document.getElementById('message')?.value?.trim() || '';

    if (!listCart || listCart.length === 0) {
        alert('Your cart is empty.');
        return;
    }

    // Helper: sanitize numbers (remove spaces, symbols)
    const sanitizeNumber = (num) => (num || '').toString().replace(/[^0-9]/g, '');

    // Invert keyword->number into number->keywords[]
    const invertProviderMap = () => {
        const out = {};
        Object.keys(PROVIDER_NUMBER_BY_KEYWORD).forEach((kw) => {
            const numSan = sanitizeNumber(PROVIDER_NUMBER_BY_KEYWORD[kw]);
            if (!numSan) return;
            if (!out[numSan]) out[numSan] = [];
            out[numSan].push(kw.toLowerCase());
        });
        return out;
    };

    // Group cart items by provider number (based on keyword match)
    const groupItemsByProvider = (cartItems) => {
        const numberToKeywords = invertProviderMap();
        const numberToItems = {};
        const unmatched = [];
        cartItems.forEach((p) => {
            const nameL = (p.name || '').toLowerCase();
            let matchedAny = false;
            Object.keys(numberToKeywords).forEach((num) => {
                const kws = numberToKeywords[num];
                if (kws.some((kw) => nameL.includes(kw))) {
                    if (!numberToItems[num]) numberToItems[num] = [];
                    numberToItems[num].push(p);
                    matchedAny = true;
                }
            });
            if (!matchedAny) unmatched.push(p);
        });
        return { numberToItems, unmatched };
    };

    const defaultNumSan = sanitizeNumber(WHATSAPP_DEFAULT_NUMBER);
    const { numberToItems, unmatched } = groupItemsByProvider(listCart);
    let numbers = Object.keys(numberToItems);

    // Route unmatched items to default, if configured
    if (unmatched.length > 0 && defaultNumSan) {
        if (!numberToItems[defaultNumSan]) numberToItems[defaultNumSan] = [];
        numberToItems[defaultNumSan].push(...unmatched);
        if (!numbers.includes(defaultNumSan)) numbers.push(defaultNumSan);
    }

    // If still no provider matched, send entire cart to default
    if (numbers.length === 0 && defaultNumSan) {
        numberToItems[defaultNumSan] = listCart.slice();
        numbers = [defaultNumSan];
    }

    if (numbers.length === 0 || numbers.every((n) => /^0+$/.test(n))) {
        alert('WhatsApp numbers are not configured yet. Please provide provider numbers.');
        return;
    }

    // After confirming order, optionally we could prompt to leave reviews later

    // Open a WhatsApp tab per provider simultaneously; collect any blocked ones
    const blocked = [];
    numbers.forEach((num) => {
        const itemsForProvider = numberToItems[num] || [];
        const text = buildWhatsappMessage(name, phone, country, address, message, itemsForProvider);
        const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
        const win = window.open(url, '_blank');
        if (!win) {
            blocked.push({ num, url });
        }
    });

    // If some tabs were blocked by the browser, show a quick overlay with clickable links
    if (blocked.length > 0) {
        showWhatsappLinksOverlay(blocked);
    }
}

/**
 * Render a lightweight overlay with explicit links to open WhatsApp chats
 * if the browser blocks popup tabs.
 */
function showWhatsappLinksOverlay(links) {
    // Basic overlay styles inline to avoid external CSS dependency
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const card = document.createElement('div');
    card.style.background = '#fff';
    card.style.color = '#111';
    card.style.width = 'min(600px, 90vw)';
    card.style.maxHeight = '80vh';
    card.style.overflow = 'auto';
    card.style.borderRadius = '12px';
    card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    card.style.padding = '20px';
    card.innerHTML = '<h3 style="margin-top:0">Open WhatsApp chats</h3>' +
        '<p>Pop-ups were blocked. Click the links below to open chats for each provider:</p>';

    // Get number-to-keywords map for display
    const sanitizeNumber = (num) => (num || '').toString().replace(/[^0-9]/g, '');
    const invertProviderMap = () => {
        const out = {};
        Object.keys(PROVIDER_NUMBER_BY_KEYWORD).forEach((kw) => {
            const numSan = sanitizeNumber(PROVIDER_NUMBER_BY_KEYWORD[kw]);
            if (!numSan) return;
            if (!out[numSan]) out[numSan] = [];
            out[numSan].push(kw.toLowerCase());
        });
        return out;
    };
    const numberToKeywords = invertProviderMap();

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.style.margin = '10px 0 0 0';
    links.forEach(({ num, url }) => {
        const li = document.createElement('li');
        li.style.margin = '8px 0';
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = `Open chat: ${num}`;
        a.style.display = 'inline-block';
        a.style.padding = '10px 12px';
        a.style.border = '1px solid #ccc';
        a.style.borderRadius = '8px';
        a.style.textDecoration = 'none';
        a.style.color = '#0B6';
        a.style.fontWeight = 'bold';
        li.appendChild(a);
        // Show service names (keywords) for this number
        const numSan = sanitizeNumber(num);
        if (numberToKeywords[numSan] && numberToKeywords[numSan].length > 0) {
            const kwSpan = document.createElement('span');
            kwSpan.style.display = 'block';
            kwSpan.style.fontSize = '0.95em';
            kwSpan.style.color = '#4b2ce6';
            kwSpan.style.marginTop = '2px';
            kwSpan.textContent = 'Services: ' + numberToKeywords[numSan].map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
            li.appendChild(kwSpan);
        }
        list.appendChild(li);
    });
    card.appendChild(list);

    const close = document.createElement('button');
    close.textContent = 'Close';
    close.style.marginTop = '16px';
    close.style.padding = '8px 12px';
    close.style.border = 'none';
    close.style.borderRadius = '8px';
    close.style.background = '#444';
    close.style.color = '#fff';
    close.style.cursor = 'pointer';
    close.addEventListener('click', () => document.body.removeChild(overlay));
    card.appendChild(close);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

const checkoutButton = document.querySelector('.buttonCheckout');
if (checkoutButton) {
    checkoutButton.addEventListener('click', handleCheckoutClick);
}

// ========================================
// FORM VALIDATION - REAL-TIME
// ========================================

// Add real-time validation as users type
document.addEventListener('DOMContentLoaded', function() {
    const nameField = document.getElementById('name');
    const phoneField = document.getElementById('phone');
    const addressField = document.getElementById('address');
    const countryField = document.getElementById('country');
    
    // Real-time validation for name field
    if (nameField) {
        nameField.addEventListener('input', function() {
            const value = this.value.trim();
            if (value.length >= 2) {
                clearFieldError('name');
            }
        });
    }
    
    // Real-time validation for phone field
    if (phoneField) {
        phoneField.addEventListener('input', function() {
            const value = this.value.trim();
            const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
            if (phoneRegex.test(value)) {
                clearFieldError('phone');
            }
        });
    }
    
    // Real-time validation for address field
    if (addressField) {
        addressField.addEventListener('change', function() {
            if (this.value) {
                clearFieldError('address');
            }
        });
    }
    
    // Real-time validation for country field
    if (countryField) {
        countryField.addEventListener('change', function() {
            if (this.value) {
                clearFieldError('country');
            }
        });
    }
});

/**
 * Clear validation error for a specific field
 */
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.style.borderColor = '';
        field.style.backgroundColor = '';
        
        const errorMessage = field.parentNode.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }
}

// ========================================
// REVIEW MODAL SYSTEM
// ========================================

// Delegate click handling for dynamically rendered Review buttons
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.reviewBtn');
    if (!btn) return;
    const productId = Number(btn.getAttribute('data-product-id'));
    openReviewModal(productId);
});

/**
 * Display a simple modal to submit a rating and comment for a product,
 * and list the most recent reviews.
 */
function openReviewModal(productId) {
    const item = (listCart || []).find(x => x && x.id === productId) || {};
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const card = document.createElement('div');
    card.style.background = '#fff';
    card.style.color = '#111';
    card.style.width = 'min(500px, 90vw)';
    card.style.borderRadius = '12px';
    card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    card.style.padding = '20px';
    card.innerHTML = `
        <h3 style="margin-top:0">Review: ${(item && item.name) ? item.name : ('Item ' + productId)}</h3>
        <div style="margin:10px 0">
            <label>Rating:</label>
            <select id="reviewRating" style="margin-left:8px">
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Average</option>
                <option value="2">2 - Poor</option>
                <option value="1">1 - Bad</option>
            </select>
        </div>
        <div>
            <textarea id="reviewComment" rows="3" style="width:100%" placeholder="Share your experience..."></textarea>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end">
            <button id="cancelReview">Cancel</button>
            <button id="submitReview">Submit</button>
        </div>
        <div style="margin-top:12px">
            <strong>Recent reviews</strong>
            <div id="reviewList" style="max-height:160px; overflow:auto; border:1px solid #eee; padding:8px; border-radius:8px; margin-top:6px"></div>
        </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const list = document.getElementById('reviewList');
    const existing = getReviewsFor(productId);
    if (existing.length === 0) {
        list.textContent = 'No reviews yet.';
    } else {
        existing.slice().reverse().forEach(r => {
            const div = document.createElement('div');
            const date = new Date(r.ts || Date.now());
            div.style.borderBottom = '1px solid #f0f0f0';
            div.style.padding = '6px 0';
            div.innerHTML = `<strong>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</strong> - ${date.toLocaleDateString()}<br>${(r.comment || '').replace(/</g,'&lt;')}`;
            list.appendChild(div);
        });
    }

    card.querySelector('#cancelReview').addEventListener('click', () => document.body.removeChild(overlay));
    card.querySelector('#submitReview').addEventListener('click', () => {
        const ratingVal = Number(card.querySelector('#reviewRating').value);
        const commentVal = (card.querySelector('#reviewComment').value || '').trim();
        if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
            alert('Please select a rating between 1 and 5');
            return;
        }
        addReview(productId, ratingVal, commentVal);
        document.body.removeChild(overlay);
        addCartToHTML();
    });
}