const PRODUCTS_KEY = "myStoreProducts";
const CURRENT_USER_KEY = "myStoreCurrentUser";
const GUEST_CART_KEY = "myStoreCart";
const ORDERS_KEY = "myStoreOrders";
const WHATSAPP_NUMBER = "218910251861";

let products = [];
let cart = [];
let currentCategory = "الكل";

let selectedProduct = null;
let selectedSize = "";
let selectedColor = "";


/* =========================
   تشغيل الموقع
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

        const savedProducts =
            localStorage.getItem(PRODUCTS_KEY);

        products =
            savedProducts
                ? JSON.parse(savedProducts)
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


function saveProducts() {

    localStorage.setItem(
        PRODUCTS_KEY,
        JSON.stringify(products)
    );

}


/* =========================
   عرض المنتجات
========================= */

function renderProducts() {

    const container =
        document.getElementById("products-container");

    const noProducts =
        document.getElementById("no-products");

    if (!container) return;


    const searchInput =
        document.getElementById("search-input");


    const searchText =
        searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";


    const filteredProducts =
        products.filter(function (product) {

            const name =
                String(product.name || "")
                    .toLowerCase();

            const description =
                String(product.description || "")
                    .toLowerCase();

            const category =
                String(product.category || "");


            const matchesCategory =
                currentCategory === "الكل" ||
                category === currentCategory;


            const matchesSearch =
                !searchText ||
                name.includes(searchText) ||
                description.includes(searchText);


            return (
                matchesCategory &&
                matchesSearch
            );

        });


    container.innerHTML = "";


    if (filteredProducts.length === 0) {

        if (noProducts) {
            noProducts.style.display = "block";
        }

        return;

    }


    if (noProducts) {
        noProducts.style.display = "none";
    }


    filteredProducts.forEach(function (product) {

        const card =
            document.createElement("div");

        card.className = "product-card";


        const image =
            product.image

                ? `<img
                    src="${escapeHtml(product.image)}"
                    alt="${escapeHtml(product.name || "منتج")}"
                    class="product-image"
                  >`

                : `<div class="product-image">
                    🏃
                  </div>`;


        const stock =
            Number(
                product.stock ??
                product.quantity ??
                0
            );


        const stockText =
            stock > 0
                ? `متوفر: ${stock}`
                : "غير متوفر";


        const buttonDisabled =
            stock <= 0
                ? "disabled"
                : "";


        const sizes =
            normalizeOptions(product.sizes);


        const colors =
            normalizeOptions(product.colors);


        let optionsNote = "";


        if (sizes.length > 0) {
            optionsNote += "المقاسات متوفرة";
        }


        if (colors.length > 0) {

            if (optionsNote) {
                optionsNote += " • ";
            }

            optionsNote += "الألوان متوفرة";

        }


        card.innerHTML = `

            ${image}

            <div class="product-info">

                <div class="product-category">
                    ${escapeHtml(
                        product.category || "رياضة"
                    )}
                </div>

                <div class="product-name">
                    ${escapeHtml(
                        product.name || "منتج"
                    )}
                </div>

                <div class="product-description">
                    ${escapeHtml(
                        product.description || ""
                    )}
                </div>

                ${
                    optionsNote
                        ? `<div class="product-option-note">
                            ${escapeHtml(optionsNote)}
                           </div>`
                        : ""
                }

                <div class="product-bottom">

                    <div>

                        <div class="product-price">
                            ${formatPrice(product.price)}
                        </div>

                        <small>
                            ${stockText}
                        </small>

                    </div>

                    <button
                        type="button"
                        class="add-to-cart"
                        onclick="addToCart('${escapeJs(product.id)}')"
                        ${buttonDisabled}
                    >
                        🛒 أضف للسلة
                    </button>

                </div>

            </div>
        `;


        container.appendChild(card);

    });

}


/* =========================
   البحث
========================= */

function setupSearch() {

    const input =
        document.getElementById("search-input");

    if (!input) return;


    input.addEventListener(
        "input",
        function () {

            renderProducts();

        }
    );

}


/* =========================
   الفلترة
========================= */

function filterByCategory(category, button) {

    currentCategory = category;


    document
        .querySelectorAll(".filter-btn")
        .forEach(function (btn) {

            btn.classList.remove("active");

        });


    if (button) {

        button.classList.add("active");

    } else {

        document
            .querySelectorAll(".filter-btn")
            .forEach(function (btn) {

                if (
                    btn.dataset.category === category
                ) {

                    btn.classList.add("active");

                }

            });

    }


    renderProducts();


    const productsSection =
        document.getElementById("products");


    if (productsSection) {

        productsSection.scrollIntoView({
            behavior: "smooth"
        });

    }

}


/* =========================
   المقاسات والألوان
========================= */

function normalizeOptions(value) {

    if (Array.isArray(value)) {

        return value
            .map(function (item) {
                return String(item).trim();
            })
            .filter(Boolean);

    }


    if (typeof value === "string") {

        return value
            .split(",")
            .map(function (item) {
                return item.trim();
            })
            .filter(Boolean);

    }


    return [];

}


/* =========================
   إضافة للسلة
========================= */

function addToCart(productId) {

    const product =
        products.find(function (item) {

            return (
                String(item.id) ===
                String(productId)
            );

        });


    if (!product) {

        alert("المنتج غير موجود.");

        return;

    }


    const stock =
        Number(
            product.stock ??
            product.quantity ??
            0
        );


    if (stock <= 0) {

        alert(
            "هذا المنتج غير متوفر حاليًا."
        );

        return;

    }


    const sizes =
        normalizeOptions(product.sizes);


    const colors =
        normalizeOptions(product.colors);


    if (
        sizes.length > 0 ||
        colors.length > 0
    ) {

        openProductOptions(product);

        return;

    }


    addProductVariantToCart(
        product,
        "",
        ""
    );

}


/* =========================
   خيارات المنتج
========================= */

function openProductOptions(product) {

    selectedProduct = product;

    selectedSize = "";
    selectedColor = "";


    const modal =
        document.getElementById(
            "product-options-modal"
        );


    const productName =
        document.getElementById(
            "options-product-name"
        );


    const optionsContainer =
        document.getElementById(
            "product-options"
        );


    const error =
        document.getElementById(
            "options-error"
        );


    if (!modal || !optionsContainer) {
        return;
    }


    if (productName) {

        productName.textContent =
            product.name || "المنتج";

    }


    if (error) {

        error.style.display = "none";

    }


    optionsContainer.innerHTML = "";


    const sizes =
        normalizeOptions(product.sizes);


    const colors =
        normalizeOptions(product.colors);


    if (sizes.length > 0) {

        const sizeGroup =
            document.createElement("div");

        sizeGroup.className =
            "option-group";


        const label =
            document.createElement("label");

        label.textContent =
            "اختر المقاس:";


        const buttons =
            document.createElement("div");

        buttons.className =
            "option-buttons";


        sizes.forEach(function (size) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "option-button";

            button.textContent =
                size;


            button.onclick =
                function () {

                    selectedSize = size;


                    buttons
                        .querySelectorAll(
                            ".option-button"
                        )
                        .forEach(function (btn) {

                            btn.classList.remove(
                                "selected"
                            );

                        });


                    button.classList.add(
                        "selected"
                    );

                };


            buttons.appendChild(button);

        });


        sizeGroup.appendChild(label);
        sizeGroup.appendChild(buttons);

        optionsContainer.appendChild(
            sizeGroup
        );

    }


    if (colors.length > 0) {

        const colorGroup =
            document.createElement("div");

        colorGroup.className =
            "option-group";


        const label =
            document.createElement("label");

        label.textContent =
            "اختر اللون:";


        const buttons =
            document.createElement("div");

        buttons.className =
            "option-buttons";


        colors.forEach(function (color) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "option-button";

            button.textContent =
                color;


            button.onclick =
                function () {

                    selectedColor = color;


                    buttons
                        .querySelectorAll(
                            ".option-button"
                        )
                        .forEach(function (btn) {

                            btn.classList.remove(
                                "selected"
                            );

                        });


                    button.classList.add(
                        "selected"
                    );

                };


            buttons.appendChild(button);

        });


        colorGroup.appendChild(label);
        colorGroup.appendChild(buttons);

        optionsContainer.appendChild(
            colorGroup
        );

    }


    modal.classList.add("show");

}


/* =========================
   تأكيد الخيارات
========================= */

function confirmProductOptions() {

    if (!selectedProduct) {
        return;
    }


    const sizes =
        normalizeOptions(
            selectedProduct.sizes
        );


    const colors =
        normalizeOptions(
            selectedProduct.colors
        );


    const error =
        document.getElementById(
            "options-error"
        );


    if (
        sizes.length > 0 &&
        !selectedSize
    ) {

        if (error) {

            error.textContent =
                "يرجى اختيار المقاس.";

            error.style.display =
                "block";

        }

        return;

    }


    if (
        colors.length > 0 &&
        !selectedColor
    ) {

        if (error) {

            error.textContent =
                "يرجى اختيار اللون.";

            error.style.display =
                "block";

        }

        return;

    }


    addProductVariantToCart(
        selectedProduct,
        selectedSize,
        selectedColor
    );


    closeProductOptions();

}


/* =========================
   إضافة نسخة للسلة
========================= */

function addProductVariantToCart(
    product,
    size,
    color
) {

    const stock =
        Number(
            product.stock ??
            product.quantity ??
            0
        );


    if (stock <= 0) {

        alert(
            "هذا المنتج غير متوفر حاليًا."
        );

        return;

    }


    const existing =
        cart.find(function (item) {

            return (
                String(item.id) ===
                    String(product.id) &&

                String(item.size || "") ===
                    String(size || "") &&

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
                "لا توجد كمية إضافية متوفرة."
            );

            return;

        }


        existing.quantity += 1;

    } else {

        cart.push({

            id:
                product.id,

            name:
                product.name,

            price:
                Number(product.price || 0),

            image:
                product.image || "",

            quantity:
                1,

            size:
                size || "",

            color:
                color || ""

        });

    }


    saveCart();

    updateCartCount();

    renderCart();


    alert(
        "تمت إضافة المنتج إلى السلة 🛒"
    );

}


/* =========================
   إغلاق خيارات المنتج
========================= */

function closeProductOptions() {

    const modal =
        document.getElementById(
            "product-options-modal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );

    }


    selectedProduct = null;
    selectedSize = "";
    selectedColor = "";

}


/* =========================
   تحميل السلة
========================= */

function loadCart() {

    try {

        const savedCart =
            localStorage.getItem(
                GUEST_CART_KEY
            );


        cart =
            savedCart
                ? JSON.parse(savedCart)
                : [];


        if (!Array.isArray(cart)) {
            cart = [];
        }


        cart =
            cart.map(function (item) {

                return {

                    ...item,

                    size:
                        item.size || "",

                    color:
                        item.color || ""

                };

            });


    } catch (error) {

        cart = [];

    }

}


/* =========================
   حفظ السلة
========================= */

function saveCart() {

    localStorage.setItem(
        GUEST_CART_KEY,
        JSON.stringify(cart)
    );

}


/* =========================
   عدد المنتجات
========================= */

function updateCartCount() {

    const countElement =
        document.getElementById(
            "cart-count"
        );


    if (!countElement) return;


    const count =
        cart.reduce(function (
            total,
            item
        ) {

            return (
                total +
                Number(item.quantity || 0)
            );

        }, 0);


    countElement.textContent =
        count;

}


/* =========================
   فتح السلة
========================= */

function openCart() {

    const modal =
        document.getElementById(
            "cart-modal"
        );


    if (!modal) return;


    renderCart();

    modal.classList.add("show");

}


/* =========================
   إغلاق السلة
========================= */

function closeCart() {

    const modal =
        document.getElementById(
            "cart-modal"
        );


    if (!modal) return;


    modal.classList.remove("show");

}


/* =========================
   عرض السلة
========================= */

function renderCart() {

    const container =
        document.getElementById(
            "cart-items"
        );


    const totalElement =
        document.getElementById(
            "cart-total"
        );


    if (!container) return;


    container.innerHTML = "";


    if (cart.length === 0) {

        container.innerHTML = `
            <div class="no-products">
                السلة فارغة حاليًا.
            </div>
        `;


        if (totalElement) {

            totalElement.textContent =
                "0 د.ل";

        }


        return;

    }


    let total = 0;


    cart.forEach(function (
        item,
        index
    ) {

        const itemTotal =
            Number(item.price || 0) *
            Number(item.quantity || 0);


        total += itemTotal;


        const image =
            item.image

                ? `<img
                    src="${escapeHtml(item.image)}"
                    class="cart-item-image"
                    alt=""
                  >`

                : `<div class="cart-item-image">
                    🏃
                  </div>`;


        let optionsHtml = "";


        if (item.size) {

            optionsHtml += `
                <div>
                    المقاس:
                    <strong>
                        ${escapeHtml(item.size)}
                    </strong>
                </div>
            `;

        }


        if (item.color) {

            optionsHtml += `
                <div>
                    اللون:
                    <strong>
                        ${escapeHtml(item.color)}
                    </strong>
                </div>
            `;

        }


        const div =
            document.createElement("div");


        div.className =
            "cart-item";


        div.innerHTML = `

            ${image}

            <div class="cart-item-right">

                <div class="cart-item-name">
                    ${escapeHtml(
                        item.name || "منتج"
                    )}
                </div>

                ${
                    optionsHtml
                        ? `<div class="cart-item-options">
                            ${optionsHtml}
                           </div>`
                        : ""
                }

                <div class="cart-item-price">
                    ${formatPrice(item.price)}
                </div>

                <div class="cart-quantity">

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

                </div>

                <button
                    type="button"
                    onclick="removeFromCart(${index})"
                >
                    حذف
                </button>

            </div>
        `;


        container.appendChild(div);

    });


    if (totalElement) {

        totalElement.textContent =
            formatPrice(total);

    }

}


/* =========================
   تغيير كمية السلة
========================= */

function changeCartQuantity(
    index,
    amount
) {

    if (!cart[index]) return;


    const product =
        products.find(function (item) {

            return (
                String(item.id) ===
                String(cart[index].id)
            );

        });


    const stock =
        product
            ? Number(
                product.stock ??
                product.quantity ??
                0
            )
            : 999999;


    const newQuantity =
        Number(
            cart[index].quantity || 0
        ) + amount;


    if (newQuantity <= 0) {

        cart.splice(index, 1);

    } else if (
        newQuantity > stock
    ) {

        alert(
            "الكمية المطلوبة غير متوفرة."
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


/* =========================
   حذف من السلة
========================= */

function removeFromCart(index) {

    if (!cart[index]) return;


    cart.splice(index, 1);


    saveCart();

    updateCartCount();

    renderCart();

}


/* =========================
   إتمام الطلب
========================= */

function checkout() {

    if (cart.length === 0) {

        alert("السلة فارغة.");

        return;

    }


    closeCart();


    const modal =
        document.getElementById(
            "checkout-modal"
        );


    if (!modal) return;


    renderCheckoutItems();

    loadUserData();


    modal.classList.add("show");

}


/* =========================
   إغلاق الطلب
========================= */

function closeCheckout() {

    const modal =
        document.getElementById(
            "checkout-modal"
        );


    if (!modal) return;


    modal.classList.remove("show");

}


/* =========================
   بيانات الحساب
========================= */

function loadUserData() {

    try {

        const savedUser =
            localStorage.getItem(
                CURRENT_USER_KEY
            );


        if (!savedUser) return;


        const user =
            JSON.parse(savedUser);


        const name =
            document.getElementById(
                "customer-name"
            );


        const phone =
            document.getElementById(
                "customer-phone"
            );


        const city =
            document.getElementById(
                "customer-city"
            );


        const address =
            document.getElementById(
                "customer-address"
            );


        if (name && user.name) {
            name.value = user.name;
        }


        if (phone && user.phone) {
            phone.value = user.phone;
        }


        if (city && user.city) {
            city.value = user.city;
        }


        if (address && user.address) {
            address.value = user.address;
        }


    } catch (error) {

        console.log(
            "لا توجد بيانات حساب محفوظة."
        );

    }

}


/* =========================
   ملخص الطلب
========================= */

function renderCheckoutItems() {

    const container =
        document.getElementById(
            "checkout-items"
        );


    const totalElement =
        document.getElementById(
            "checkout-total"
        );


    if (!container) return;


    container.innerHTML = "";


    let total = 0;


    cart.forEach(function (item) {

        const itemTotal =
            Number(item.price || 0) *
            Number(item.quantity || 0);


        total += itemTotal;


        let optionsHtml = "";


        if (item.size) {

            optionsHtml +=
                "المقاس: " +
                escapeHtml(item.size);

        }


        if (item.color) {

            if (optionsHtml) {
                optionsHtml += " • ";
            }

            optionsHtml +=
                "اللون: " +
                escapeHtml(item.color);

        }


        const div =
            document.createElement("div");


        div.innerHTML = `

            <span>

                ${escapeHtml(
                    item.name || "منتج"
                )}

                × ${item.quantity}

                ${
                    optionsHtml
                        ? `<small class="checkout-item-options">
                            ${optionsHtml}
                           </small>`
                        : ""
                }

            </span>

            <strong>
                ${formatPrice(itemTotal)}
            </strong>

        `;


        container.appendChild(div);

    });


    if (totalElement) {

        totalElement.textContent =
            formatPrice(total);

    }

}


/* =========================
   إنشاء رقم الطلب
========================= */

function generateOrderNumber() {

    const random =
        Math.floor(
            1000 + Math.random() * 9000
        );

    const time =
        Date.now()
            .toString()
            .slice(-6);

    return "LYB-" +
        time +
        random;

}


/* =========================
   المستخدم الحالي
========================= */

function getCurrentUser() {

    try {

        const savedUser =
            localStorage.getItem(
                CURRENT_USER_KEY
            );


        if (!savedUser) {
            return null;
        }


        const user =
            JSON.parse(savedUser);


        return user || null;


    } catch (error) {

        console.error(
            "خطأ في بيانات المستخدم:",
            error
        );

        return null;

    }

}


/* =========================
   إرسال الطلب
========================= */

function setupCheckoutForm() {

    const form =
        document.getElementById(
            "checkout-form"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            if (cart.length === 0) {

                alert("السلة فارغة.");

                return;

            }


            const nameElement =
                document.getElementById(
                    "customer-name"
                );


            const phoneElement =
                document.getElementById(
                    "customer-phone"
                );


            const cityElement =
                document.getElementById(
                    "customer-city"
                );


            const addressElement =
                document.getElementById(
                    "customer-address"
                );


            const notesElement =
                document.getElementById(
                    "customer-notes"
                );


            const name =
                nameElement
                    ? nameElement.value.trim()
                    : "";


            const phone =
                phoneElement
                    ? phoneElement.value.trim()
                    : "";


            const city =
                cityElement
                    ? cityElement.value.trim()
                    : "";


            const address =
                addressElement
                    ? addressElement.value.trim()
                    : "";


            const notes =
                notesElement
                    ? notesElement.value.trim()
                    : "";


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


            let total = 0;


            let message =
                "🛍️ *طلب جديد من متجر الرياضة*%0A%0A";


            message +=
                "👤 الاسم: " +
                encodeURIComponent(name) +
                "%0A";


            message +=
                "📱 الهاتف: " +
                encodeURIComponent(phone) +
                "%0A";


            message +=
                "📍 المدينة: " +
                encodeURIComponent(city) +
                "%0A";


            message +=
                "🏠 العنوان: " +
                encodeURIComponent(address) +
                "%0A";


            if (notes) {

                message +=
                    "📝 الملاحظات: " +
                    encodeURIComponent(notes) +
                    "%0A";

            }


            message +=
                "%0A🛒 *المنتجات:*%0A";


            cart.forEach(function (item) {

                const itemTotal =
                    Number(item.price || 0) *
                    Number(item.quantity || 0);


                total += itemTotal;


                let itemMessage =
                    "• " +
                    item.name;


                if (item.size) {

                    itemMessage +=
                        " | المقاس: " +
                        item.size;

                }


                if (item.color) {

                    itemMessage +=
                        " | اللون: " +
                        item.color;

                }


                itemMessage +=
                    " × " +
                    item.quantity +
                    " = " +
                    formatPrice(itemTotal);


                message +=
                    encodeURIComponent(
                        itemMessage
                    ) +
                    "%0A";

            });


            /*
               إنشاء رقم الطلب
            */

            const orderNumber =
                generateOrderNumber();


            message +=
                "%0A🔢 *رقم الطلب: " +
                encodeURIComponent(
                    orderNumber
                ) +
                "*";


            message +=
                "%0A💰 *الإجمالي: " +
                encodeURIComponent(
                    formatPrice(total)
                ) +
                "*";


            /*
               حفظ الطلب أولاً
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
               تنظيف السلة بعد نجاح الحفظ
            */

            cart = [];

            saveCart();

            updateCartCount();


            closeCheckout();


            alert(
                "تم تسجيل طلبك بنجاح ✅\n\n" +
                "رقم الطلب: " +
                orderNumber +
                "\n\n" +
                "سيتم تحويلك إلى واتساب لإرسال الطلب."
            );


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
   النسخة المصححة
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
           UID المستخدم
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
           إيميل المستخدم
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
           رقم الهاتف المرتبط بالحساب
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
           نسخ المنتجات قبل تفريغ السلة
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
           الطلب
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
               نستخدم pending
               حتى تتوافق مع لوحة الإدارة
            */

            status:
                "pending",

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
           حفظ في جميع الطلبات
        */

        orders.unshift(
            order
        );


        localStorage.setItem(
            ORDERS_KEY,
            JSON.stringify(
                orders
            )
        );


        /*
           حفظ نسخة خاصة بالمستخدم
        */

        if (user) {

            const userKey =
                getUserOrdersKey(
                    user
                );


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
        user
            ? (
                user.uid ||
                user.id ||
                user.email ||
                user.phone ||
                "guest"
            )
            : "guest";


    return (
        "myStoreUserOrders_" +
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
            String(
                user.phone ||
                user.phoneNumber ||
                ""
            )
            .replace(
                /[^0-9]/g,
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


        return orders.filter(
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
                        ""
                    )
                    .replace(
                        /[^0-9]/g,
                        ""
                    );


                if (
                    userId &&
                    orderUserId &&
                    userId ===
                    orderUserId
                ) {

                    return true;

                }


                if (
                    userEmail &&
                    orderEmail &&
                    userEmail ===
                    orderEmail
                ) {

                    return true;

                }


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


    } catch (error) {

        console.error(
            "خطأ في جلب الطلبات:",
            error
        );

        return [];

    }

}


/* =========================
   حالة الطلب
========================= */

function getOrderStatusText(status) {

    const normalized =
        normalizeOrderStatus(
            status
        );


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
            "❌ ملغي"

    };


    return (
        statuses[normalized] ||
        "⏳ قيد المراجعة"
    );

}


function normalizeOrderStatus(status) {

    const value =
        String(
            status || ""
        )
        .trim()
        .toLowerCase();


    const map = {

        "جديد":
            "pending",

        "قيد المراجعة":
            "pending",

        "pending":
            "pending",

        "تم التأكيد":
            "confirmed",

        "confirmed":
            "confirmed",

        "قيد التجهيز":
            "preparing",

        "جاري التجهيز":
            "preparing",

        "preparing":
            "preparing",

        "جاهز":
            "ready",

        "ready":
            "ready",

        "تم الشحن":
            "shipping",

        "في التوصيل":
            "shipping",

        "shipping":
            "shipping",

        "تم التسليم":
            "delivered",

        "delivered":
            "delivered",

        "ملغي":
            "cancelled",

        "cancelled":
            "cancelled"

    };


    return (
        map[value] ||
        "pending"
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
   تنسيق السعر
========================= */

function formatPrice(price) {

    const number =
        Number(
            price || 0
        );


    return (
        number.toLocaleString(
            "ar-LY"
        ) +
        " د.ل"
    );

}


/* =========================
   حماية النصوص
========================= */

function escapeHtml(value) {

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
   حماية داخل onclick
========================= */

function escapeJs(value) {

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
        )
        .replace(
            /\n/g,
            "\\n"
        )
        .replace(
            /\r/g,
            "\\r"
        );

}


/* =========================
   إغلاق المودالات
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

            closeProductOptions();

        }

    }
);


/* =========================
   جعل الدوال متاحة للأزرار
   الموجودة داخل HTML
========================= */

window.addToCart =
    addToCart;

window.openCart =
    openCart;

window.closeCart =
    closeCart;

window.checkout =
    checkout;

window.closeCheckout =
    closeCheckout;

window.confirmProductOptions =
    confirmProductOptions;

window.closeProductOptions =
    closeProductOptions;

window.changeCartQuantity =
    changeCartQuantity;

window.removeFromCart =
    removeFromCart;

window.filterByCategory =
    filterByCategory;

window.getUserOrders =
    getUserOrders;

window.getOrderStatusText =
    getOrderStatusText;
