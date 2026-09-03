const PRODUCTS_KEY = "myStoreProducts";
const CURRENT_USER_KEY = "myStoreCurrentUser";
const GUEST_CART_KEY = "myStoreCart";
const ORDERS_KEY = "myStoreOrders";
const WHATSAPP_NUMBER = "218910251861";

let products = [];
let cart = [];
let currentCategory = "الكل";

/* المنتج الذي نختار له المقاس واللون */
let selectedProduct = null;
let selectedSize = "";
let selectedColor = "";


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

        const saved =
            localStorage.getItem(PRODUCTS_KEY);

        products =
            saved
                ? JSON.parse(saved)
                : [];

        if (!Array.isArray(products)) {
            products = [];
        }

    } catch (error) {

        console.error(
            "خطأ في تحميل المنتجات:",
            error
        );

        products = [];
    }
}


function renderProducts() {

    const container =
        document.getElementById("products-container");

    if (!container) {
        return;
    }

    let filteredProducts =
        products.filter(function (product) {

            if (currentCategory === "الكل") {
                return true;
            }

            return (
                product.category ===
                currentCategory
            );

        });


    if (filteredProducts.length === 0) {

        container.innerHTML = `
            <div class="empty-products">
                لا توجد منتجات حالياً
            </div>
        `;

        return;
    }


    container.innerHTML =
        filteredProducts.map(function (product) {

            const quantity =
                Number(product.quantity || 0);

            const outOfStock =
                quantity <= 0;

            const sizes =
                normalizeOptions(
                    product.sizes,
                    ["S", "M", "L", "XL"]
                );

            const colors =
                normalizeOptions(
                    product.colors,
                    ["أسود", "أبيض"]
                );


            return `
                <div class="product-card">

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
                                            onclick="addProductFromCard('${escapeJs(product.id)}')"
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
}


/* =========================
   خيارات المنتج
========================= */

function normalizeOptions(
    options,
    fallback
) {

    if (
        Array.isArray(options) &&
        options.length
    ) {
        return options;
    }

    return fallback;
}


function createOptionButtons(
    options,
    type
) {

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

    const buttons =
        document.querySelectorAll(
            ".product-option-button"
        );


    buttons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const parent =
                    button.parentElement;

                parent
                    .querySelectorAll(
                        ".product-option-button"
                    )
                    .forEach(function (item) {

                        item.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );

            }
        );

    });
}


/* =========================
   البحث
========================= */

function setupSearch() {

    const searchInput =
        document.getElementById("search-input");

    if (!searchInput) {
        return;
    }


    searchInput.addEventListener(
        "input",
        function () {

            const value =
                searchInput.value
                    .trim()
                    .toLowerCase();


            const cards =
                document.querySelectorAll(
                    ".product-card"
                );


            cards.forEach(function (card) {

                const name =
                    (
                        card.dataset.name ||
                        card.querySelector("h3")?.textContent ||
                        ""
                    )
                    .toLowerCase();


                const description =
                    (
                        card.querySelector("p")?.textContent ||
                        ""
                    )
                    .toLowerCase();


                if (
                    name.includes(value) ||
                    description.includes(value)
                ) {

                    card.style.display =
                        "";

                } else {

                    card.style.display =
                        "none";

                }

            });

        }
    );
}


/* =========================
   التصنيفات
========================= */

function filterProducts(category) {

    currentCategory =
        category;

    renderProducts();

}


function filterByCategory(category) {

    filterProducts(category);

}


/* =========================
   السلة
========================= */

function loadCart() {

    try {

        const user =
            getCurrentUser();

        const key =
            user
                ? getUserCartKey(user)
                : GUEST_CART_KEY;


        const saved =
            localStorage.getItem(key);


        cart =
            saved
                ? JSON.parse(saved)
                : [];


        if (!Array.isArray(cart)) {
            cart = [];
        }

    } catch (error) {

        console.error(
            "خطأ في تحميل السلة:",
            error
        );

        cart = [];
    }
}


function saveCart() {

    try {

        const user =
            getCurrentUser();

        const key =
            user
                ? getUserCartKey(user)
                : GUEST_CART_KEY;


        localStorage.setItem(
            key,
            JSON.stringify(cart)
        );

    } catch (error) {

        console.error(
            "خطأ في حفظ السلة:",
            error
        );

    }
}


function getUserCartKey(user) {

    const identifier =
        user.uid ||
        user.id ||
        user.email ||
        user.phone ||
        "guest";


    return (
        "myStoreCart_" +
        String(identifier)
    );
}


function updateCartCount() {

    const count =
        document.getElementById(
            "cart-count"
        );

    if (!count) {
        return;
    }


    const total =
        cart.reduce(
            function (sum, item) {

                return (
                    sum +
                    Number(
                        item.quantity || 0
                    )
                );

            },
            0
        );


    count.textContent =
        total;
}


/* =========================
   إضافة المنتج
========================= */

function addProductFromCard(
    productId
) {

    const card =
        document.querySelector(
            `.product-card button[onclick*="${escapeCss(productId)}"]`
        )?.closest(".product-card");


    const product =
        products.find(function (item) {

            return String(item.id) ===
                String(productId);

        });


    if (!product) {

        alert(
            "المنتج غير موجود."
        );

        return;
    }


    const quantity =
        Number(product.quantity || 0);


    if (quantity <= 0) {

        alert(
            "هذا المنتج غير متوفر حالياً."
        );

        return;
    }


    let size = "";
    let color = "";


    if (card) {

        const activeSize =
            card.querySelector(
                '[data-option-type="size"].active'
            );

        const activeColor =
            card.querySelector(
                '[data-option-type="color"].active'
            );


        if (activeSize) {
            size =
                activeSize.dataset.value || "";
        }


        if (activeColor) {
            color =
                activeColor.dataset.value || "";
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


function addToCart(
    productId,
    name,
    price,
    image,
    size,
    color
) {

    const product =
        products.find(function (item) {

            return String(item.id) ===
                String(productId);

        });


    if (!product) {

        alert(
            "المنتج غير موجود."
        );

        return;
    }


    const stock =
        Number(product.quantity || 0);


    if (stock <= 0) {

        alert(
            "المنتج غير متوفر."
        );

        return;
    }


    const existing =
        cart.find(function (item) {

            return (
                String(item.id) ===
                String(productId) &&
                String(item.size || "") ===
                String(size || "") &&
                String(item.color || "") ===
                String(color || "")
            );

        });


    if (existing) {

        if (
            Number(existing.quantity || 0)
            >= stock
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

            price:
                Number(price || 0),

            image:
                image || "",

            size:
                size || "",

            color:
                color || "",

            quantity:
                1

        });

    }


    saveCart();
    updateCartCount();

    alert(
        "تمت إضافة المنتج للسلة ✅"
    );
}


/* =========================
   فتح السلة
========================= */

function openCart() {

    const modal =
        document.getElementById(
            "cart-modal"
        );


    if (!modal) {
        return;
    }


    renderCart();

    modal.classList.add(
        "active"
    );
}


function closeCart() {

    const modal =
        document.getElementById(
            "cart-modal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );
}


function renderCart() {

    const container =
        document.getElementById(
            "cart-items"
        );

    const totalElement =
        document.getElementById(
            "cart-total"
        );


    if (!container) {
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


    container.innerHTML =
        cart.map(function (item, index) {

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
                                : ""
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
                                ${item.quantity}
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


function changeCartQuantity(
    index,
    amount
) {

    if (!cart[index]) {
        return;
    }


    const product =
        products.find(function (item) {

            return String(item.id) ===
                String(cart[index].id);

        });


    const stock =
        product
            ? Number(product.quantity || 0)
            : 999999;


    const newQuantity =
        Number(
            cart[index].quantity || 0
        ) + amount;


    if (newQuantity <= 0) {

        cart.splice(
            index,
            1
        );

    } else if (
        newQuantity > stock
    ) {

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


    cart.splice(
        index,
        1
    );


    saveCart();
    updateCartCount();
    renderCart();
}


/* =========================
   إتمام الطلب
========================= */

function checkout() {

    if (cart.length === 0) {

        alert(
            "السلة فارغة."
        );

        return;
    }


    const modal =
        document.getElementById(
            "checkout-modal"
        );


    if (!modal) {
        return;
    }


    closeCart();

    loadUserData();

    renderCheckoutItems();

    updateCheckoutSummary();


    modal.classList.add(
        "active"
    );
}


function closeCheckout() {

    const modal =
        document.getElementById(
            "checkout-modal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );
}


function loadUserData() {

    const user =
        getCurrentUser();


    if (!user) {
        return;
    }


    const nameInput =
        document.getElementById(
            "checkout-name"
        );


    const phoneInput =
        document.getElementById(
            "checkout-phone"
        );


    if (
        nameInput &&
        !nameInput.value
    ) {

        nameInput.value =
            user.name || "";

    }


    if (
        phoneInput &&
        !phoneInput.value
    ) {

        phoneInput.value =
            user.phone || "";

    }
}


function renderCheckoutItems() {

    const container =
        document.getElementById(
            "checkout-items"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        cart.map(function (item) {

            return `
                <div class="checkout-item">

                    <span>
                        ${escapeHtml(item.name || "منتج")}
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

    const total =
        cart.reduce(
            function (sum, item) {

                return (
                    sum +
                    Number(item.price || 0) *
                    Number(item.quantity || 0)
                );

            },
            0
        );


    const totalElement =
        document.getElementById(
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

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            now.getDate()
        ).padStart(2, "0");


    const random =
        Math.floor(
            1000 +
            Math.random() * 9000
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

        const saved =
            localStorage.getItem(
                CURRENT_USER_KEY
            );


        if (!saved) {
            return null;
        }


        const user =
            JSON.parse(saved);


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

    const form =
        document.getElementById(
            "checkout-form"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            if (cart.length === 0) {

                alert(
                    "السلة فارغة."
                );

                return;
            }


            const name =
                document.getElementById(
                    "checkout-name"
                )?.value.trim() || "";


            const phone =
                document.getElementById(
                    "checkout-phone"
                )?.value.trim() || "";


            const city =
                document.getElementById(
                    "checkout-city"
                )?.value.trim() || "";


            const address =
                document.getElementById(
                    "checkout-address"
                )?.value.trim() || "";


            const notes =
                document.getElementById(
                    "checkout-notes"
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


            const total =
                cart.reduce(
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


            cart.forEach(
                function (item) {

                    message +=
                        "%0A• " +
                        encodeURIComponent(
                            item.name
                        ) +
                        " × " +
                        encodeURIComponent(
                            item.quantity
                        );


                    if (item.size) {

                        message +=
                            " | مقاس: " +
                            encodeURIComponent(
                                item.size
                            );

                    }


                    if (item.color) {

                        message +=
                            " | لون: " +
                            encodeURIComponent(
                                item.color
                            );

                    }

                }
            );


            message +=
                "%0A🔢 *رقم الطلب:* " +
                encodeURIComponent(
                    orderNumber
                );


            message +=
                "%0A💰 *الإجمالي:* " +
                encodeURIComponent(
                    formatPrice(total)
                );


            /*
               حفظ الطلب قبل فتح واتساب
            */

            const savedOrder =
                saveOrder(
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
               تفريغ السلة
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
               فتح واتساب
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

        }
    );
}


/* =========================
   حفظ الطلب
   الإصلاح الأساسي هنا
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


        const user =
            getCurrentUser();


        const now =
            new Date();


        /*
           معرف المستخدم
        */

        const userId =
            user
                ? String(
                    user.uid ||
                    user.id ||
                    ""
                )
                : "";


        /*
           إيميل الحساب
        */

        const customerEmail =
            user
                ? String(
                    user.email ||
                    ""
                )
                .trim()
                .toLowerCase()
                : "";


        /*
           رقم الهاتف الموجود في الحساب
        */

        const accountPhone =
            user
                ? String(
                    user.phone ||
                    user.phoneNumber ||
                    ""
                ).trim()
                : "";


        /*
           رقم الطلب
        */

        const finalOrderNumber =
            orderNumber ||
            generateOrderNumber();


        /*
           نسخ المنتجات الموجودة في السلة
        */

        const orderItems =
            cart.map(function (item) {

                return {

                    id:
                        item.id,

                    name:
                        item.name,

                    price:
                        Number(
                            item.price || 0
                        ),

                    quantity:
                        Number(
                            item.quantity || 0
                        ),

                    size:
                        item.size || "",

                    color:
                        item.color || "",

                    image:
                        item.image || ""

                };

            });


        /*
           بيانات الطلب
        */

        const order = {

            id:
                finalOrderNumber,

            orderNumber:
                finalOrderNumber,

            orderId:
                "ORD-" +
                Date.now(),

            userId:
                userId,

            customerEmail:
                customerEmail,

            customerPhone:
                phone,

            accountPhone:
                accountPhone,

            customerName:
                name,

            city:
                city,

            address:
                address,

            notes:
                notes,

            items:
                orderItems,

            total:
                Number(
                    total || 0
                ),

            /*
               الحالة الجديدة
               حتى تتعرف عليها صفحة الحساب
            */

            status:
                "pending",

            /*
               التاريخ
            */

            createdAt:
                now.toISOString(),

            date:
                now.toISOString(),

            dateText:
                now.toLocaleString(
                    "ar-LY"
                )

        };


        /*
           حفظ الطلب في جميع الطلبات
        */

        orders.unshift(
            order
        );


        localStorage.setItem(
            ORDERS_KEY,
            JSON.stringify(orders)
        );


        /*
           حفظ نسخة خاصة بالمستخدم
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


            userOrders.unshift(
                order
            );


            localStorage.setItem(
                userKey,
                JSON.stringify(
                    userOrders
                )
            );

        }


        console.log(
            "✅ تم حفظ الطلب:",
            order
        );


        return order;


    } catch (error) {

        console.error(
            "❌ خطأ في حفظ الطلب:",
            error
        );


        alert(
            "حدث خطأ أثناء حفظ الطلب."
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
   الإصلاح الأساسي هنا
========================= */

function getUserOrders() {

    try {

        const user =
            getCurrentUser();


        if (!user) {
            return [];
        }


        /*
           بيانات الحساب
        */

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
            String(
                user.phone ||
                user.phoneNumber ||
                ""
            )
            .replace(
                /[^0-9]/g,
                ""
            );


        /*
           جميع الطلبات
        */

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


        if (
            !Array.isArray(
                orders
            )
        ) {

            return [];

        }


        /*
           البحث عن طلبات هذا الحساب
           بالـ UID أو الإيميل أو الهاتف
        */

        const matchedOrders =
            orders.filter(
                function (order) {

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
                        String(
                            order.customerPhone ||
                            order.phone ||
                            order.accountPhone ||
                            ""
                        )
                        .replace(
                            /[^0-9]/g,
                            ""
                        );


                    /*
                       UID
                    */

                    if (
                        userId &&
                        orderUserId &&
                        userId ===
                        orderUserId
                    ) {

                        return true;

                    }


                    /*
                       Email
                    */

                    if (
                        userEmail &&
                        orderEmail &&
                        userEmail ===
                        orderEmail
                    ) {

                        return true;

                    }


                    /*
                       الهاتف
                    */

                    if (
                        userPhone &&
                        orderPhone &&
                        userPhone ===
                        orderPhone
                    ) {

                        return true;

                    }


                    return false;

                }
            );


        /*
           ترتيب الأحدث أولاً
        */

        matchedOrders.sort(
            function (a, b) {

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

            }
        );


        return matchedOrders;


    } catch (error) {

        console.error(
            "❌ خطأ في جلب طلبات المستخدم:",
            error
        );


        return [];
    }
}


/* =========================
   حالة الطلب
========================= */

function getOrderStatusText(
    status
) {

    const value =
        String(
            status || ""
        )
        .trim()
        .toLowerCase();


    const statuses = {

        pending:
            "⏳ قيد المراجعة",

        confirmed:
            "✅ تم التأكيد",

        preparing:
            "📦 جاري التجهيز",

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
        status ||
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

function formatPrice(
    price
) {

    const number =
        Number(price || 0);


    return (
        number.toLocaleString(
            "ar-LY"
        ) +
        " د.ل"
    );
}


/* =========================
   حماية HTML
========================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );
}


/* =========================
   حماية JavaScript
========================= */

function escapeJs(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /\\/g,
        "\\\\"
    )
    .replace(
        /'/g,
        "\\'"
    )
    .replace(
        /"/g,
        '\\"'
    );
}


/* =========================
   حماية CSS selector
========================= */

function escapeCss(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /\\/g,
        "\\\\"
    )
    .replace(
        /"/g,
        '\\"'
    );
}


/* =========================
   إغلاق النوافذ عند الضغط
   خارجها
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

    }
);
