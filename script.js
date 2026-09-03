const PRODUCTS_KEY = "myStoreProducts";
const CURRENT_USER_KEY = "myStoreCurrentUser";
const GUEST_CART_KEY = "myStoreCart";
const ORDERS_KEY = "myStoreOrders";
const WHATSAPP_NUMBER = "218910251861";

let products = [];
let cart = [];
let currentCategory = "الكل";


/* =========================
   تشغيل الصفحة
========================= */

document.addEventListener("DOMContentLoaded", function () {

    loadProducts();
    loadCart();

    renderProducts();
    updateCartCount();

    setupSearch();
    setupCheckoutForm();
    setupAdminButton();

});


/* =========================
   المنتجات
========================= */

function loadProducts() {

    try {

        const saved = localStorage.getItem(PRODUCTS_KEY);

        products = saved ? JSON.parse(saved) : [];

        if (!Array.isArray(products)) {
            products = [];
        }

    } catch (error) {

        console.error("خطأ في تحميل المنتجات:", error);

        products = [];
    }
}


function renderProducts() {

    const container = document.getElementById("products-container");

    if (!container) {
        return;
    }

    const filteredProducts = products.filter(function (product) {

        if (currentCategory === "الكل") {
            return true;
        }

        return product.category === currentCategory;

    });


    if (filteredProducts.length === 0) {

        container.innerHTML = `
            <div class="empty-products">
                لا توجد منتجات حالياً
            </div>
        `;

        return;
    }


    container.innerHTML = filteredProducts.map(function (product) {

        const quantity = Number(product.quantity || 0);
        const outOfStock = quantity <= 0;

        const sizes = normalizeOptions(
            product.sizes,
            ["S", "M", "L", "XL"]
        );

        const colors = normalizeOptions(
            product.colors,
            ["أسود", "أبيض"]
        );


        return `
            <div
                class="product-card"
                data-name="${escapeHtml(product.name || "")}"
                data-category="${escapeHtml(product.category || "")}"
            >

                <div class="product-image-box">

                    ${
                        product.image
                            ? `
                                <img
                                    src="${escapeHtml(product.image)}"
                                    alt="${escapeHtml(product.name || "")}"
                                >
                              `
                            : `
                                <div class="no-image">
                                    لا توجد صورة
                                </div>
                              `
                    }

                    ${
                        outOfStock
                            ? `
                                <span class="stock-tag">
                                    غير متوفر
                                </span>
                              `
                            : ""
                    }

                </div>


                <div class="product-info">

                    <div class="product-category">
                        ${escapeHtml(product.category || "")}
                    </div>

                    <h3>
                        ${escapeHtml(product.name || "منتج")}
                    </h3>

                    <p>
                        ${escapeHtml(product.description || "")}
                    </p>


                    <div class="stock-info">
                        ${
                            outOfStock
                                ? "غير متوفر"
                                : "متوفر: " + quantity
                        }
                    </div>


                    ${
                        !outOfStock
                            ? `

                                <div class="product-options">

                                    <div class="option-title">
                                        المقاس
                                    </div>

                                    <div class="size-options">

                                        ${createOptionButtons(
                                            sizes,
                                            "size"
                                        )}

                                    </div>


                                    <div class="option-title">
                                        اللون
                                    </div>

                                    <div class="color-options">

                                        ${createOptionButtons(
                                            colors,
                                            "color"
                                        )}

                                    </div>

                                </div>

                              `
                            : ""
                    }


                    <div class="product-bottom">

                        <div class="price-box">
                            ${formatPrice(product.price)}
                        </div>


                        ${
                            outOfStock
                                ? `
                                    <button
                                        type="button"
                                        class="add-cart-button disabled"
                                        disabled
                                    >
                                        غير متوفر
                                    </button>
                                  `
                                : `
                                    <button
                                        type="button"
                                        class="add-cart-button"
                                        data-product-id="${escapeHtml(product.id)}"
                                    >
                                        🛒 أضف للسلة
                                    </button>
                                  `
                        }

                    </div>

                </div>

            </div>
        `;

    }).join("");


    setupProductOptions();
    setupAddToCartButtons();
}


/* =========================
   أزرار إضافة للسلة
========================= */

function setupAddToCartButtons() {

    const buttons = document.querySelectorAll(
        ".add-cart-button[data-product-id]"
    );


    buttons.forEach(function (button) {

        button.addEventListener("click", function () {

            const productId = button.dataset.productId;

            addProductFromCard(productId);

        });

    });
}


/* =========================
   خيارات المنتج
========================= */

function normalizeOptions(options, fallback) {

    if (
        Array.isArray(options) &&
        options.length
    ) {
        return options;
    }

    return fallback;
}


function createOptionButtons(options, type) {

    return options.map(function (option, index) {

        return `
            <button
                type="button"
                class="product-option-button ${index === 0 ? "active" : ""}"
                data-option-type="${type}"
                data-value="${escapeHtml(option)}"
            >
                ${escapeHtml(option)}
            </button>
        `;

    }).join("");
}


function setupProductOptions() {

    const buttons = document.querySelectorAll(
        ".product-option-button"
    );


    buttons.forEach(function (button) {

        button.addEventListener("click", function () {

            const parent = button.parentElement;

            parent
                .querySelectorAll(".product-option-button")
                .forEach(function (item) {

                    item.classList.remove("active");

                });


            button.classList.add("active");

        });

    });
}


/* =========================
   البحث
========================= */

function setupSearch() {

    const searchInput = document.getElementById(
        "search-input"
    );


    if (!searchInput) {
        return;
    }


    searchInput.addEventListener("input", function () {

        const value = searchInput.value
            .trim()
            .toLowerCase();


        const cards = document.querySelectorAll(
            ".product-card"
        );


        cards.forEach(function (card) {

            const name = (
                card.dataset.name ||
                card.querySelector("h3")?.textContent ||
                ""
            ).toLowerCase();


            const description = (
                card.querySelector("p")?.textContent ||
                ""
            ).toLowerCase();


            const category = (
                card.dataset.category ||
                ""
            ).toLowerCase();


            if (
                name.includes(value) ||
                description.includes(value) ||
                category.includes(value)
            ) {

                card.style.display = "";

            } else {

                card.style.display = "none";

            }

        });

    });
}


/* =========================
   التصنيفات
========================= */

function filterProducts(category) {

    currentCategory = category;

    renderProducts();


    const searchInput = document.getElementById(
        "search-input"
    );


    if (searchInput) {
        searchInput.value = "";
    }

}


function filterByCategory(category, button) {

    filterProducts(category);


    const buttons = document.querySelectorAll(
        ".filter-btn"
    );


    buttons.forEach(function (item) {

        item.classList.remove("active");

    });


    if (button) {

        button.classList.add("active");

    } else {

        buttons.forEach(function (item) {

            if (
                item.dataset.category === category
            ) {

                item.classList.add("active");

            }

        });

    }


    const productsSection = document.getElementById(
        "products"
    );


    if (productsSection) {

        productsSection.scrollIntoView({
            behavior: "smooth"
        });

    }

}


/* =========================
   السلة
========================= */

function loadCart() {

    try {

        const user = getCurrentUser();

        const key = user
            ? getUserCartKey(user)
            : GUEST_CART_KEY;


        const saved = localStorage.getItem(key);

        cart = saved ? JSON.parse(saved) : [];


        if (!Array.isArray(cart)) {
            cart = [];
        }

    } catch (error) {

        console.error("خطأ في تحميل السلة:", error);

        cart = [];
    }
}


function saveCart() {

    try {

        const user = getCurrentUser();

        const key = user
            ? getUserCartKey(user)
            : GUEST_CART_KEY;


        localStorage.setItem(
            key,
            JSON.stringify(cart)
        );


        return true;

    } catch (error) {

        console.error("خطأ في حفظ السلة:", error);

        return false;
    }
}


function getUserCartKey(user) {

    const identifier =
        user.uid ||
        user.id ||
        user.email ||
        user.phone ||
        "guest";


    return "myStoreCart_" + String(identifier);
}


function updateCartCount() {

    const count = document.getElementById(
        "cart-count"
    );


    if (!count) {
        return;
    }


    const total = cart.reduce(function (sum, item) {

        return (
            sum +
            Number(item.quantity || 0)
        );

    }, 0);


    count.textContent = total;
}


/* =========================
   إضافة المنتج من الكرت
========================= */

function addProductFromCard(productId) {

    const product = products.find(function (item) {

        return String(item.id) === String(productId);

    });


    if (!product) {

        alert("المنتج غير موجود.");

        return;
    }


    const quantity = Number(product.quantity || 0);


    if (quantity <= 0) {

        alert("هذا المنتج غير متوفر حالياً.");

        return;
    }


    const cards = document.querySelectorAll(
        ".product-card"
    );


    let card = null;


    cards.forEach(function (item) {

        const button = item.querySelector(
            ".add-cart-button[data-product-id]"
        );


        if (
            button &&
            String(button.dataset.productId) ===
            String(productId)
        ) {

            card = item;

        }

    });


    let size = "";
    let color = "";


    if (card) {

        const activeSize = card.querySelector(
            '[data-option-type="size"].active'
        );


        const activeColor = card.querySelector(
            '[data-option-type="color"].active'
        );


        if (activeSize) {
            size = activeSize.dataset.value || "";
        }


        if (activeColor) {
            color = activeColor.dataset.value || "";
        }

    }


    addToCart(
        product.id,
        product.name,
        product.price,
        product.image,
        size,
        color
    );
}


/* =========================
   إضافة للسلة
   يدعم الطريقة الجديدة
   والطريقة القديمة الموجودة
   في بعض كروت index.html
========================= */

function addToCart(
    productId,
    name,
    price,
    image,
    size,
    color
) {

    /*
       إذا كانت الدالة مستعملة بالطريقة القديمة:

       addToCart("اسم المنتج", 120, "الصورة")

       نحولها تلقائياً للطريقة الجديدة.
    */

    if (
        typeof price === "number" &&
        typeof productId === "string"
    ) {

        const oldName = productId;
        const oldPrice = price;
        const oldImage = image || "";


        const realProduct = products.find(function (item) {

            return String(item.name || "") ===
                String(oldName);

        });


        if (realProduct) {

            productId = realProduct.id;
            name = realProduct.name;
            price = realProduct.price;
            image = realProduct.image || oldImage;

        } else {

            productId = oldName;
            name = oldName;
            price = oldPrice;
            image = extractImageSrc(oldImage);

        }

    }


    /*
       البحث عن المنتج
    */

    let product = products.find(function (item) {

        return String(item.id) === String(productId);

    });


    /*
       إذا لم نجده بالـ ID
       نحاول البحث بالاسم
    */

    if (!product) {

        product = products.find(function (item) {

            return String(item.name || "") ===
                String(name || "");

        });

    }


    /*
       إذا كان المنتج موجوداً
       نستخدم بياناته.
    */

    if (product) {

        productId = product.id;

        name = product.name || name;

        price = product.price ?? price;

        image = product.image || image || "";

        const stock = Number(
            product.quantity || 0
        );


        if (stock <= 0) {

            alert("المنتج غير متوفر.");

            return;
        }


        /*
           التحقق من المخزون
        */

        const existing = cart.find(function (item) {

            return (
                String(item.id) ===
                String(productId)

                &&

                String(item.size || "") ===
                String(size || "")

                &&

                String(item.color || "") ===
                String(color || "")
            );

        });


        if (existing) {

            if (
                Number(existing.quantity || 0) >=
                stock
            ) {

                alert(
                    "لا يمكن إضافة كمية أكبر من المتوفر."
                );

                return;
            }


            existing.quantity =
                Number(existing.quantity || 0) + 1;

        } else {

            cart.push({

                id: productId,

                name: name,

                price: Number(price || 0),

                image: extractImageSrc(image),

                size: size || "",

                color: color || "",

                quantity: 1

            });

        }

    } else {

        /*
           دعم المنتج القديم حتى لو
           غير موجود في myStoreProducts
        */

        cart.push({

            id: productId,

            name: name || productId,

            price: Number(price || 0),

            image: extractImageSrc(image),

            size: size || "",

            color: color || "",

            quantity: 1

        });

    }


    if (!saveCart()) {

        alert("تعذر حفظ السلة.");

        return;
    }


    updateCartCount();


    alert("تمت إضافة المنتج للسلة ✅");
}


/* =========================
   استخراج رابط الصورة
========================= */

function extractImageSrc(value) {

    const str = String(value || "");

    const match = str.match(
        /<img[^>]+src=["']([^"']+)["']/i
    );


    if (match) {
        return match[1];
    }


    return str;
}


/* =========================
   فتح السلة
========================= */

function openCart() {

    const modal = document.getElementById(
        "cart-modal"
    );


    if (!modal) {

        console.error(
            "❌ لم يتم العثور على cart-modal"
        );

        return;
    }


    loadCart();

    renderCart();

    modal.classList.add("active");
}


function closeCart() {

    const modal = document.getElementById(
        "cart-modal"
    );


    if (!modal) {
        return;
    }


    modal.classList.remove("active");
}


/* =========================
   عرض السلة
========================= */

function renderCart() {

    const container = document.getElementById(
        "cart-items"
    );


    const totalElement = document.getElementById(
        "cart-total"
    );


    if (!container) {

        console.error(
            "❌ لم يتم العثور على cart-items"
        );

        return;
    }


    if (cart.length === 0) {

        container.innerHTML = `
            <div class="empty-cart">
                🛒 السلة فارغة
            </div>
        `;


        if (totalElement) {
            totalElement.textContent =
                formatPrice(0);
        }


        return;
    }


    let total = 0;


    container.innerHTML = cart.map(function (item, index) {

        const itemTotal =
            Number(item.price || 0) *
            Number(item.quantity || 0);


        total += itemTotal;


        return `
            <div class="cart-item">

                <div class="cart-item-image">

                    ${
                        item.image
                            ? `
                                <img
                                    src="${escapeHtml(item.image)}"
                                    alt="${escapeHtml(item.name || "")}"
                                >
                              `
                            : `
                                🛍️
                              `
                    }

                </div>


                <div class="cart-item-info">

                    <h4>
                        ${escapeHtml(item.name || "منتج")}
                    </h4>


                    ${
                        item.size
                            ? `
                                <div>
                                    المقاس:
                                    ${escapeHtml(item.size)}
                                </div>
                              `
                            : ""
                    }


                    ${
                        item.color
                            ? `
                                <div>
                                    اللون:
                                    ${escapeHtml(item.color)}
                                </div>
                              `
                            : ""
                    }


                    <div class="cart-item-price">
                        ${formatPrice(item.price)}
                    </div>


                    <div class="cart-controls">

                        <button
                            type="button"
                            onclick="changeCartQuantity(${index}, -1)"
                        >
                            −
                        </button>

                        <span>
                            ${Number(item.quantity || 0)}
                        </span>

                        <button
                            type="button"
                            onclick="changeCartQuantity(${index}, 1)"
                        >
                            +
                        </button>

                        <button
                            type="button"
                            onclick="removeFromCart(${index})"
                        >
                            🗑️
                        </button>

                    </div>

                </div>

            </div>
        `;

    }).join("");


    if (totalElement) {

        totalElement.textContent =
            formatPrice(total);

    }
}


/* =========================
   تغيير كمية السلة
========================= */

function changeCartQuantity(index, amount) {

    if (!cart[index]) {
        return;
    }


    const product = products.find(function (item) {

        return String(item.id) ===
            String(cart[index].id);

    });


    const stock = product
        ? Number(product.quantity || 0)
        : 999999;


    const newQuantity =
        Number(cart[index].quantity || 0) +
        amount;


    if (newQuantity <= 0) {

        cart.splice(index, 1);

    } else if (newQuantity > stock) {

        alert(
            "الكمية المطلوبة أكبر من المخزون."
        );

        return;

    } else {

        cart[index].quantity =
            newQuantity;

    }


    saveCart();

    updateCartCount();

    renderCart();
}


function removeFromCart(index) {

    if (!cart[index]) {
        return;
    }


    cart.splice(index, 1);


    saveCart();

    updateCartCount();

    renderCart();
}


/* =========================
   إتمام الطلب
========================= */

function checkout() {

    loadCart();


    if (cart.length === 0) {

        alert("السلة فارغة.");

        return;
    }


    const modal = document.getElementById(
        "checkout-modal"
    );


    if (!modal) {

        alert(
            "تعذر فتح صفحة إتمام الطلب."
        );

        return;
    }


    closeCart();

    loadUserData();

    renderCheckoutItems();

    updateCheckoutSummary();

    modal.classList.add("active");
}


function closeCheckout() {

    const modal = document.getElementById(
        "checkout-modal"
    );


    if (!modal) {
        return;
    }


    modal.classList.remove("active");
}


/* =========================
   بيانات المستخدم
========================= */

function loadUserData() {

    const user = getCurrentUser();


    if (!user) {
        return;
    }


    const nameInput = document.getElementById(
        "customer-name"
    );


    const phoneInput = document.getElementById(
        "customer-phone"
    );


    if (
        nameInput &&
        !nameInput.value
    ) {

        nameInput.value =
            user.name ||
            user.displayName ||
            "";

    }


    if (
        phoneInput &&
        !phoneInput.value
    ) {

        phoneInput.value =
            user.phone ||
            user.phoneNumber ||
            "";

    }
}


/* =========================
   منتجات الطلب
========================= */

function renderCheckoutItems() {

    const container = document.getElementById(
        "checkout-items"
    );


    if (!container) {
        return;
    }


    container.innerHTML = cart.map(function (item) {

        return `
            <div class="checkout-item">

                <span>

                    ${escapeHtml(
                        item.name || "منتج"
                    )}

                    ${
                        item.size
                            ? `
                                <small class="checkout-item-options">
                                    المقاس:
                                    ${escapeHtml(item.size)}
                                </small>
                              `
                            : ""
                    }

                    ${
                        item.color
                            ? `
                                <small class="checkout-item-options">
                                    اللون:
                                    ${escapeHtml(item.color)}
                                </small>
                              `
                            : ""
                    }

                </span>


                <span>
                    × ${Number(item.quantity || 0)}
                </span>


                <strong>
                    ${formatPrice(
                        Number(item.price || 0) *
                        Number(item.quantity || 0)
                    )}
                </strong>

            </div>
        `;

    }).join("");
}


function updateCheckoutSummary() {

    const total = cart.reduce(function (sum, item) {

        return (
            sum +
            Number(item.price || 0) *
            Number(item.quantity || 0)
        );

    }, 0);


    const totalElement = document.getElementById(
        "checkout-total"
    );


    if (totalElement) {

        totalElement.textContent =
            formatPrice(total);

    }
}


/* =========================
   رقم الطلب
========================= */

function generateOrderNumber() {

    const now = new Date();


    const year = now.getFullYear();


    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");


    const day = String(
        now.getDate()
    ).padStart(2, "0");


    const random = Math.floor(
        1000 + Math.random() * 9000
    );


    return (
        "ORD-" +
        year +
        month +
        day +
        "-" +
        random
    );
}


/* =========================
   المستخدم الحالي
========================= */

function getCurrentUser() {

    try {

        const saved = localStorage.getItem(
            CURRENT_USER_KEY
        );


        if (!saved) {
            return null;
        }


        const user = JSON.parse(saved);


        return user || null;

    } catch (error) {

        console.error(
            "خطأ في قراءة المستخدم:",
            error
        );

        return null;
    }
}


/* =========================
   نموذج الطلب
========================= */

function setupCheckoutForm() {

    const form = document.getElementById(
        "checkout-form"
    );


    if (!form) {
        return;
    }


    /*
       منع تسجيل الحدث أكثر من مرة
    */

    if (form.dataset.checkoutReady === "true") {
        return;
    }


    form.dataset.checkoutReady = "true";


    form.addEventListener("submit", function (event) {

        event.preventDefault();


        loadCart();


        if (cart.length === 0) {

            alert("السلة فارغة.");

            return;
        }


        const name =
            document.getElementById(
                "customer-name"
            )?.value.trim() || "";


        const phone =
            document.getElementById(
                "customer-phone"
            )?.value.trim() || "";


        const city =
            document.getElementById(
                "customer-city"
            )?.value.trim() || "";


        const address =
            document.getElementById(
                "customer-address"
            )?.value.trim() || "";


        const notes =
            document.getElementById(
                "customer-notes"
            )?.value.trim() || "";


        if (
            !name ||
            !phone ||
            !city ||
            !address
        ) {

            alert(
                "يرجى تعبئة جميع البيانات المطلوبة."
            );

            return;
        }


        const total = cart.reduce(
            function (sum, item) {

                return (
                    sum +
                    Number(item.price || 0) *
                    Number(item.quantity || 0)
                );

            },
            0
        );


        const orderNumber =
            generateOrderNumber();


        /*
           رسالة واتساب
        */

        let message =
            "🛍️ *طلب جديد من متجر الرياضة*";


        message +=
            "%0A%0A👤 *الاسم:* " +
            encodeURIComponent(name);


        message +=
            "%0A📱 *الهاتف:* " +
            encodeURIComponent(phone);


        message +=
            "%0A🏙️ *المدينة:* " +
            encodeURIComponent(city);


        message +=
            "%0A📍 *العنوان:* " +
            encodeURIComponent(address);


        if (notes) {

            message +=
                "%0A📝 *ملاحظات:* " +
                encodeURIComponent(notes);

        }


        message +=
            "%0A%0A📦 *المنتجات:*";


        cart.forEach(function (item) {

            message +=
                "%0A• " +
                encodeURIComponent(item.name) +
                " × " +
                encodeURIComponent(item.quantity);


            if (item.size) {

                message +=
                    " | مقاس: " +
                    encodeURIComponent(item.size);

            }


            if (item.color) {

                message +=
                    " | لون: " +
                    encodeURIComponent(item.color);

            }

        });


        message +=
            "%0A🔢 *رقم الطلب:* " +
            encodeURIComponent(orderNumber);


        message +=
            "%0A💰 *الإجمالي:* " +
            encodeURIComponent(
                formatPrice(total)
            );


        /*
           حفظ الطلب
        */

        const savedOrder = saveOrder(
            name,
            phone,
            city,
            address,
            notes,
            total,
            orderNumber
        );


        if (!savedOrder) {

            return;
        }


        /*
           تفريغ السلة بعد نجاح الحفظ
        */

        cart = [];

        saveCart();

        updateCartCount();


        closeCheckout();


        alert(
            "تم إنشاء الطلب رقم " +
            orderNumber +
            " ✅"
        );


        /*
           واتساب
        */

        const whatsappUrl =
            "https://api.whatsapp.com/send?phone=" +
            WHATSAPP_NUMBER +
            "&text=" +
            message;


        window.open(
            whatsappUrl,
            "_blank"
        );

    });
}


/* =========================
   حفظ الطلب
========================= */

function saveOrder(
    name,
    phone,
    city,
    address,
    notes,
    total,
    orderNumber
) {

    try {

        /*
           التأكد من وجود السلة
        */

        if (
            !Array.isArray(cart) ||
            cart.length === 0
        ) {

            alert("السلة فارغة.");

            return null;
        }


        /*
           الطلبات الحالية
        */

        const savedOrders =
            localStorage.getItem(
                ORDERS_KEY
            );


        let orders =
            savedOrders
                ? JSON.parse(savedOrders)
                : [];


        if (!Array.isArray(orders)) {
            orders = [];
        }


        /*
           المستخدم الحالي
        */

        const user = getCurrentUser();


        const userId = user
            ? String(
                user.uid ||
                user.id ||
                ""
            )
            : "";


        const customerEmail = user
            ? String(
                user.email ||
                ""
            )
            .trim()
            .toLowerCase()
            : "";


        const accountPhone = user
            ? String(
                user.phone ||
                user.phoneNumber ||
                ""
            )
            .trim()
            : "";


        /*
           رقم الطلب
        */

        const finalOrderNumber =
            orderNumber ||
            generateOrderNumber();


        /*
           الوقت
        */

        const now = new Date();


        const createdAt =
            now.toISOString();


        /*
           نسخ المنتجات
        */

        const orderItems =
            cart.map(function (item) {

                return {

                    id: item.id,

                    name: item.name,

                    price: Number(
                        item.price || 0
                    ),

                    quantity: Number(
                        item.quantity || 0
                    ),

                    size: item.size || "",

                    color: item.color || "",

                    image: item.image || ""

                };

            });


        /*
           إنشاء الطلب
        */

        const order = {

            id: finalOrderNumber,

            orderNumber: finalOrderNumber,

            orderId:
                "ORD-" +
                Date.now(),

            userId: userId,

            customerName: name,

            customerPhone: phone,

            customerEmail: customerEmail,

            accountPhone: accountPhone,

            city: city,

            address: address,

            notes: notes,

            items: orderItems,

            total: Number(total || 0),

            status: "pending",

            createdAt: createdAt,

            date: createdAt,

            dateText:
                now.toLocaleString("ar-LY")

        };


        /*
           إضافة الطلب
        */

        orders.unshift(order);


        /*
           حفظ جميع الطلبات
        */

        localStorage.setItem(
            ORDERS_KEY,
            JSON.stringify(orders)
        );


        /*
           التأكد فعلياً أن الحفظ تم
        */

        const checkSaved =
            localStorage.getItem(
                ORDERS_KEY
            );


        if (!checkSaved) {

            throw new Error(
                "لم يتم حفظ الطلب في localStorage"
            );
        }


        /*
           حفظ نسخة للمستخدم
        */

        if (user) {

            const userKey =
                getUserOrdersKey(user);


            let userOrders = [];


            try {

                const savedUserOrders =
                    localStorage.getItem(
                        userKey
                    );


                userOrders =
                    savedUserOrders
                        ? JSON.parse(
                            savedUserOrders
                        )
                        : [];


                if (
                    !Array.isArray(
                        userOrders
                    )
                ) {

                    userOrders = [];

                }

            } catch (error) {

                userOrders = [];

            }


            /*
               منع التكرار
            */

            const alreadyExists =
                userOrders.some(function (item) {

                    return (
                        String(item.orderNumber) ===
                        String(finalOrderNumber)
                    );

                });


            if (!alreadyExists) {

                userOrders.unshift(order);

            }


            localStorage.setItem(
                userKey,
                JSON.stringify(userOrders)
            );

        }


        console.log(
            "================================"
        );

        console.log(
            "✅ تم حفظ الطلب بنجاح"
        );

        console.log(
            "رقم الطلب:",
            finalOrderNumber
        );

        console.log(
            "UID:",
            userId
        );

        console.log(
            "Email:",
            customerEmail
        );

        console.log(
            "Phone:",
            phone
        );

        console.log(
            "الطلب:",
            order
        );

        console.log(
            "================================"
        );


        return order;


    } catch (error) {

        console.error(
            "❌ خطأ في حفظ الطلب:",
            error
        );


        alert(
            "حدث خطأ أثناء حفظ الطلب. لم يتم تفريغ السلة."
        );


        return null;
    }
}


/* =========================
   مفتاح طلبات المستخدم
========================= */

function getUserOrdersKey(user) {

    const identifier =
        user.uid ||
        user.id ||
        user.email ||
        user.phone ||
        "guest";


    return (
        "myStoreOrders_" +
        String(identifier)
    );
}


/* =========================
   جلب طلبات المستخدم
========================= */

function getUserOrders() {

    try {

        const user =
            getCurrentUser();


        if (!user) {
            return [];
        }


        const userId =
            String(
                user.uid ||
                user.id ||
                ""
            );


        const userEmail =
            String(
                user.email ||
                ""
            )
            .trim()
            .toLowerCase();


        const userPhone =
            normalizePhone(
                user.phone ||
                user.phoneNumber ||
                ""
            );


        const savedOrders =
            localStorage.getItem(
                ORDERS_KEY
            );


        const orders =
            savedOrders
                ? JSON.parse(
                    savedOrders
                )
                : [];


        if (!Array.isArray(orders)) {
            return [];
        }


        const matchedOrders =
            orders.filter(function (order) {

                const orderUserId =
                    String(
                        order.userId ||
                        ""
                    );


                const orderEmail =
                    String(
                        order.customerEmail ||
                        order.email ||
                        ""
                    )
                    .trim()
                    .toLowerCase();


                const orderPhone =
                    normalizePhone(
                        order.customerPhone ||
                        order.phone ||
                        order.accountPhone ||
                        ""
                    );


                /*
                   UID
                */

                if (
                    userId &&
                    orderUserId &&
                    userId === orderUserId
                ) {

                    return true;
                }


                /*
                   Email
                */

                if (
                    userEmail &&
                    orderEmail &&
                    userEmail === orderEmail
                ) {

                    return true;
                }


                /*
                   الهاتف
                */

                if (
                    userPhone &&
                    orderPhone &&
                    userPhone === orderPhone
                ) {

                    return true;
                }


                return false;

            });


        matchedOrders.sort(function (a, b) {

            const dateA =
                new Date(
                    a.createdAt ||
                    a.date ||
                    0
                ).getTime();


            const dateB =
                new Date(
                    b.createdAt ||
                    b.date ||
                    0
                ).getTime();


            return dateB - dateA;

        });


        return matchedOrders;


    } catch (error) {

        console.error(
            "❌ خطأ في جلب الطلبات:",
            error
        );


        return [];
    }
}


/* =========================
   تطبيع رقم الهاتف
========================= */

function normalizePhone(phone) {

    let value =
        String(phone || "")
            .replace(/[^0-9]/g, "");


    if (value.startsWith("00218")) {

        value =
            value.substring(2);

    }


    if (value.startsWith("218")) {

        return value;

    }


    if (value.startsWith("0")) {

        return (
            "218" +
            value.substring(1)
        );

    }


    return value;
}


/* =========================
   حالة الطلب
========================= */

function getOrderStatusText(status) {

    const value =
        String(status || "")
            .trim()
            .toLowerCase();


    const statuses = {

        pending:
            "⏳ قيد المراجعة",

        confirmed:
            "✅ تم التأكيد",

        preparing:
            "📦 جاري التجهيز",

        ready:
            "📦 جاهز",

        shipping:
            "🚚 في التوصيل",

        delivered:
            "🎉 تم التسليم",

        cancelled:
            "❌ ملغي",

        جديد:
            "⏳ قيد المراجعة"

    };


    return (
        statuses[value] ||
        "⏳ قيد المراجعة"
    );
}


/* =========================
   زر إدارة المتجر
========================= */

function setupAdminButton() {

    const adminButton =
        document.getElementById(
            "admin-button"
        );


    if (adminButton) {

        adminButton.style.display =
            "flex";

    }
}


/* =========================
   السعر
========================= */

function formatPrice(price) {

    const number =
        Number(price || 0);


    return (
        number.toLocaleString("ar-LY") +
        " د.ل"
    );
}


/* =========================
   حماية HTML
========================= */

function escapeHtml(value) {

    return String(value ?? "")

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


/* =========================
   حماية JavaScript
========================= */

function escapeJs(value) {

    return String(value ?? "")

        .replace(/\\/g, "\\\\")

        .replace(/'/g, "\\'")

        .replace(/"/g, '\\"');
}


/* =========================
   حماية CSS
========================= */

function cssEscape(value) {

    if (
        window.CSS &&
        typeof window.CSS.escape === "function"
    ) {

        return window.CSS.escape(
            String(value)
        );

    }


    return String(value ?? "")

        .replace(/\\/g, "\\\\")

        .replace(/"/g, '\\"')

        .replace(
            /([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
            "\\$1"
        );
}


/* =========================
   إغلاق النوافذ
========================= */

document.addEventListener(
    "click",
    function (event) {

        const cartModal =
            document.getElementById(
                "cart-modal"
            );


        const checkoutModal =
            document.getElementById(
                "checkout-modal"
            );


        const optionsModal =
            document.getElementById(
                "product-options-modal"
            );


        if (
            cartModal &&
            event.target === cartModal
        ) {

            closeCart();

        }


        if (
            checkoutModal &&
            event.target === checkoutModal
        ) {

            closeCheckout();

        }


        if (
            optionsModal &&
            event.target === optionsModal
        ) {

            if (
                typeof closeProductOptions ===
                "function"
            ) {

                closeProductOptions();

            }

        }

    }
);
