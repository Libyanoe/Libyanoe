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
                    src="${product.image}"
                    alt="${escapeHtml(product.name || "منتج")}"
                    class="product-image"
                  >`

                : `<div class="product-image">
                    🏃
                  </div>`;


        const stock =
            Number(
                product.stock ||
                product.quantity ||
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
                            ${optionsNote}
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


    document
        .querySelectorAll(".filter-btn")
        .forEach(function (btn) {

            if (
                btn.dataset.category === category
            ) {

                btn.classList.add("active");

            }

        });


    if (button) {
        button.classList.add("active");
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
   تجهيز المقاسات والألوان
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
            product.stock ||
            product.quantity ||
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


    /*
       إذا كان المنتج عنده مقاسات أو ألوان
       نفتح نافذة الاختيار.
    */

    if (
        sizes.length > 0 ||
        colors.length > 0
    ) {

        openProductOptions(product);

        return;

    }


    /*
       إذا ما عندهش خيارات
       نضيفه مباشرة.
    */

    addProductVariantToCart(
        product,
        "",
        ""
    );

}


/* =========================
   فتح خيارات المنتج
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


    /* المقاسات */

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


    /* الألوان */

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


    /*
       التأكد من اختيار المقاس
    */

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


    /*
       التأكد من اختيار اللون
    */

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
   إضافة نسخة المنتج للسلة
========================= */

function addProductVariantToCart(
    product,
    size,
    color
) {

    const stock =
        Number(
            product.stock ||
            product.quantity ||
            0
        );


    if (stock <= 0) {

        alert(
            "هذا المنتج غير متوفر حاليًا."
        );

        return;

    }


    /*
       نفس المنتج + نفس المقاس + نفس اللون
       = نفس العنصر في السلة
    */

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

            id: product.id,

            name: product.name,

            price:
                Number(product.price || 0),

            image:
                product.image || "",

            quantity: 1,

            size: size || "",

            color: color || ""

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
        modal.classList.remove("show");
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


        /*
           إصلاح السلة القديمة
           التي لم يكن فيها size/color
        */

        cart = cart.map(function (item) {

            return {

                ...item,

                size: item.size || "",

                color: item.color || ""

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
                    src="${item.image}"
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
                product.stock ||
                product.quantity ||
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


            const name =
                document
                    .getElementById(
                        "customer-name"
                    )
                    .value
                    .trim();


            const phone =
                document
                    .getElementById(
                        "customer-phone"
                    )
                    .value
                    .trim();


            const city =
                document
                    .getElementById(
                        "customer-city"
                    )
                    .value
                    .trim();


            const address =
                document
                    .getElementById(
                        "customer-address"
                    )
                    .value
                    .trim();


            const notes =
                document
                    .getElementById(
                        "customer-notes"
                    )
                    .value
                    .trim();


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


            message +=
                "%0A💰 *الإجمالي: " +
                encodeURIComponent(
                    formatPrice(total)
                ) +
                "*";


            /*
               حفظ الطلب قبل فتح واتساب
            */

            saveOrder(
                name,
                phone,
                city,
                address,
                notes,
                total
            );


            const whatsappUrl =
                "https://api.whatsapp.com/send?phone=" +
                WHATSAPP_NUMBER +
                "&text=" +
                message;


            /*
               تفريغ السلة
            */

            cart = [];

            saveCart();

            updateCartCount();


            closeCheckout();


            window.open(
                whatsappUrl,
                "_blank"
            );

        }
    );

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
    total
) {

    try {

        const savedOrders =
            localStorage.getItem(
                ORDERS_KEY
            );


        const orders =
            savedOrders
                ? JSON.parse(savedOrders)
                : [];


        const order = {

            id:
                "ORD-" +
                Date.now(),

            customerName:
                name,

            customerPhone:
                phone,

            city:
                city,

            address:
                address,

            notes:
                notes,

            items:
                cart.map(function (item) {

                    return {

                        id:
                            item.id,

                        name:
                            item.name,

                        price:
                            item.price,

                        quantity:
                            item.quantity,

                        size:
                            item.size || "",

                        color:
                            item.color || ""

                    };

                }),

            total:
                total,

            status:
                "جديد",

            date:
                new Date().toISOString(),

            dateText:
                new Date().toLocaleString(
                    "ar-LY"
                )

        };


        orders.unshift(order);


        localStorage.setItem(
            ORDERS_KEY,
            JSON.stringify(orders)
        );


    } catch (error) {

        console.error(
            "خطأ في حفظ الطلب:",
            error
        );

    }

}


/* =========================
   أزرار الإدارة
========================= */

function setupAdminButton() {

    const adminButton =
        document.getElementById(
            "admin-button"
        );


    const addProductButton =
        document.getElementById(
            "add-product-button"
        );


    if (adminButton) {

        adminButton.style.display =
            "flex";

    }


    if (addProductButton) {

        addProductButton.style.display =
            "flex";

    }

}


/* =========================
   تنسيق السعر
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
   حماية النصوص
========================= */

function escapeHtml(value) {

    return String(value || "")

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

    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");

}


/* =========================
   إغلاق المودال بالضغط خارجه
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