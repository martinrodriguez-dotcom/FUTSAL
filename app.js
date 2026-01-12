// Importaciones de Firebase SDK (v11.x.x)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    setPersistence, 
    browserLocalPersistence,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,     
    signOut                                 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    addDoc,
    deleteDoc, 
    collection, 
    query, 
    where, 
    onSnapshot,
    getDocs,
    documentId,
    Timestamp, 
    orderBy, 
    updateDoc,
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -----------------------------------------------------------------
// 1. CONFIGURACIÓN DE FIREBASE
// -----------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyC2dY3i0LqcfmUx4Qx91Cgs66-a-dXSLbk",
  authDomain: "reserva-futsal.firebaseapp.com",
  projectId: "reserva-futsal",
  storageBucket: "reserva-futsal.firebasestorage.app",
  messagingSenderId: "285845706235",
  appId: "1:285845706235:web:9355804aea8181b030275e"
};

// --- RUTAS DE COLECCIONES ---
const bookingsCollectionPath = "bookings"; 
const customersCollectionPath = "customers";
const logCollectionPath = "booking_log"; 
const productsCollectionPath = "products";
const settingsDocPath = "app_settings/prices";

// --- CONSTANTES ---
const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]; 

// --- VARIABLES GLOBALES ---
let db, auth;
let userId = null; 
let userEmail = null; 
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let currentProductsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = [];
let appSettings = { court1Price: 5000, court2Price: 5000, grillPrice: 2000, eventPrice: 10000 };
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- REFERENCIAS AL DOM ---
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const appContainer = document.getElementById('app-container');

const views = {
    calendar: document.getElementById('calendar-view'),
    caja: document.getElementById('caja-view'),
    stats: document.getElementById('stats-view'),
    historial: document.getElementById('historial-view'),
    configuracion: document.getElementById('config-view'),
    inventory: document.getElementById('inventory-view'),
    refill: document.getElementById('refill-view')
};

// Menú y Header
const menuBtn = document.getElementById('menu-btn');
const mainMenu = document.getElementById('main-menu');
const menuOverlay = document.getElementById('menu-overlay');
const quickSaleBtn = document.getElementById('quick-sale-btn');

// Inventario y Ventas
const inventoryList = document.getElementById('inventory-list');
const refillProductsList = document.getElementById('refill-products-list');
const saleProductsList = document.getElementById('sale-products-list');
const productForm = document.getElementById('product-form');
const refillForm = document.getElementById('refill-form');
const saleTotalEl = document.getElementById('sale-total');

// -----------------------------------------------------------------
// 2. INICIALIZACIÓN
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    firebaseInit();
});

async function firebaseInit() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        await setPersistence(auth, browserLocalPersistence); 

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                userEmail = user.email;
                document.getElementById('user-email-display').textContent = userEmail;
                appContainer.classList.remove('is-hidden');
                loginView.classList.add('is-hidden');
                
                await loadAppSettings(); 
                loadBookingsForMonth();
                loadProductsRealtime();
            } else {
                appContainer.classList.add('is-hidden');
                loginView.classList.remove('is-hidden');
            }
        });
    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 3. GESTIÓN DE PRODUCTOS (Lógica de Precios Dinámicos)
// -----------------------------------------------------------------

function loadProductsRealtime() {
    const q = query(collection(db, productsCollectionPath), orderBy("name"));
    currentProductsUnsubscribe = onSnapshot(q, (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderInventory();
        renderRefillList();
    });
}

// Carga Inicial de Producto
async function handleSaveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const batchPrice = parseFloat(document.getElementById('prod-batch-price').value);
    const batchQty = parseInt(document.getElementById('prod-batch-qty').value);
    const margin = parseFloat(document.getElementById('prod-margin').value);
    
    // Cálculo de precios
    const individualCost = batchPrice / batchQty;
    const salesPrice = individualCost * (1 + (margin / 100));

    const productData = {
        name: document.getElementById('prod-name').value,
        batchPrice: batchPrice,
        batchQuantity: batchQty,
        stock: parseInt(document.getElementById('prod-stock').value),
        margin: margin,
        individualCost: individualCost,
        salesPrice: salesPrice,
        lastUpdated: Timestamp.now()
    };

    try {
        if (id) {
            await updateDoc(doc(db, productsCollectionPath, id), productData);
        } else {
            await addDoc(collection(db, productsCollectionPath), productData);
        }
        closeModals();
        showMessage("Producto guardado");
    } catch (error) {
        showMessage("Error: " + error.message, true);
    }
}

// REPOSICIÓN: Aquí está la lógica que pediste
async function handleSaveRefill(e) {
    e.preventDefault();
    const id = document.getElementById('refill-id').value;
    const newBatchPrice = parseFloat(document.getElementById('refill-batch-price').value);
    const qtyBought = parseInt(document.getElementById('refill-qty-bought').value);

    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    // EL SISTEMA ENTIENDE QUE HAY PRECIO NUEVO:
    // 1. Divide el nuevo lote por las unidades que trae el lote (definidas al crear el producto)
    const newIndividualCost = newBatchPrice / product.batchQuantity;
    
    // 2. Aplica el margen de ganancia ya existente al nuevo costo
    const newSalesPrice = newIndividualCost * (1 + (product.margin / 100));

    // 3. Actualiza stock (existente + nuevo) y aplica el PRECIO NUEVO A TODO
    try {
        await updateDoc(doc(db, productsCollectionPath, id), {
            batchPrice: newBatchPrice,
            individualCost: newIndividualCost,
            salesPrice: newSalesPrice,
            stock: product.stock + qtyBought,
            lastUpdated: Timestamp.now()
        });
        
        // Log en historial para auditoría
        await logBookingEvent('refill', { 
            teamName: `Reponer: ${product.name}`, 
            totalPrice: newBatchPrice,
            day: new Date().toISOString().split('T')[0]
        });

        closeModals();
        showMessage("Stock y Precios actualizados");
    } catch (error) {
        showMessage("Error: " + error.message, true);
    }
}

// -----------------------------------------------------------------
// 4. LÓGICA DE VENTAS
// -----------------------------------------------------------------
let currentSaleCart = [];

function openSaleModal() {
    currentSaleCart = [];
    renderSaleList();
    document.getElementById('sale-total').textContent = "$0";
    document.getElementById('sale-modal').classList.add('is-open');
}

function renderSaleList() {
    saleProductsList.innerHTML = '';
    allProducts.forEach(p => {
        if (p.stock <= 0) return;
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-2 border-b';
        item.innerHTML = `
            <div>
                <p class="font-bold">${p.name}</p>
                <p class="text-xs text-gray-500">Stock: ${p.stock} | $${p.salesPrice.toLocaleString()}</p>
            </div>
            <button class="bg-emerald-600 text-white px-3 py-1 rounded" onclick="addToCart('${p.id}')">+</button>
        `;
        saleProductsList.appendChild(item);
    });
}

window.addToCart = (id) => {
    const p = allProducts.find(prod => prod.id === id);
    currentSaleCart.push(p);
    const total = currentSaleCart.reduce((sum, item) => sum + item.salesPrice, 0);
    saleTotalEl.textContent = `$${total.toLocaleString()}`;
};

async function confirmSale() {
    if (currentSaleCart.length === 0) return;
    showMessage("Procesando venta...");
    
    try {
        for (const item of currentSaleCart) {
            const ref = doc(db, productsCollectionPath, item.id);
            await updateDoc(ref, { stock: item.stock - 1 });
        }
        
        const total = currentSaleCart.reduce((sum, item) => sum + item.salesPrice, 0);
        await addDoc(collection(db, bookingsCollectionPath), {
            type: 'sale',
            teamName: 'Venta Mostrador',
            totalPrice: total,
            day: new Date().toISOString().split('T')[0],
            monthYear: new Date().toISOString().substring(0, 7),
            paymentMethod: 'efectivo'
        });

        closeModals();
        showMessage("Venta realizada");
    } catch (error) {
        showMessage("Error: " + error.message, true);
    }
}

// -----------------------------------------------------------------
// 5. RENDERIZADO DE INTERFAZ
// -----------------------------------------------------------------

function renderInventory() {
    inventoryList.innerHTML = '';
    allProducts.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-4 font-medium">${p.name}</td>
            <td class="p-4"><span class="${p.stock < 5 ? 'text-red-600 font-bold' : ''}">${p.stock}</span></td>
            <td class="p-4">$${p.individualCost.toFixed(2)}</td>
            <td class="p-4 font-bold text-emerald-600">$${p.salesPrice.toFixed(2)}</td>
            <td class="p-4 text-center">
                <button onclick="editProduct('${p.id}')" class="text-blue-600 mr-2">Editar</button>
                <button onclick="deleteProduct('${p.id}')" class="text-red-600">Eliminar</button>
            </td>
        `;
        inventoryList.appendChild(row);
    });
}

function renderRefillList() {
    refillProductsList.innerHTML = '';
    allProducts.forEach(p => {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-xl shadow border flex justify-between items-center';
        card.innerHTML = `
            <div>
                <p class="font-bold text-gray-800">${p.name}</p>
                <p class="text-sm text-gray-500">Stock actual: ${p.stock}</p>
            </div>
            <button onclick="openRefillModal('${p.id}')" class="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-bold">Reponer</button>
        `;
        refillProductsList.appendChild(card);
    });
}

window.openRefillModal = (id) => {
    const p = allProducts.find(prod => prod.id === id);
    document.getElementById('refill-id').value = p.id;
    document.getElementById('refill-prod-name').textContent = p.name;
    document.getElementById('refill-current-stock').textContent = p.stock;
    document.getElementById('refill-modal').classList.add('is-open');
};

window.editProduct = (id) => {
    const p = allProducts.find(prod => prod.id === id);
    document.getElementById('product-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-batch-price').value = p.batchPrice;
    document.getElementById('prod-batch-qty').value = p.batchQuantity;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-margin').value = p.margin;
    document.getElementById('product-modal').classList.add('is-open');
};

// -----------------------------------------------------------------
// 6. FUNCIONES ORIGINALES (CALENDARIO, CAJA, ETC)
// -----------------------------------------------------------------

async function loadBookingsForMonth() {
    if (!db || !userId) return; 
    const monthYear = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const q = query(collection(db, bookingsCollectionPath), where("monthYear", "==", monthYear));
    
    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    document.getElementById('current-month-year').textContent = `${monthNames[month]} ${year}`;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    for (let i = 0; i < firstDay; i++) grid.appendChild(createDayCell('', false));
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const bookings = allMonthBookings.filter(b => b.day === dateStr);
        grid.appendChild(createDayCell(i, true, bookings));
    }
}

function createDayCell(num, isCurrent, bookings = []) {
    const cell = document.createElement('div');
    cell.className = `h-20 border p-1 relative ${isCurrent ? 'bg-white cursor-pointer' : 'bg-gray-50'}`;
    if (isCurrent) {
        cell.innerHTML = `<span class="text-sm">${num}</span>`;
        const count = bookings.filter(b => b.type !== 'sale').length;
        if (count > 0) {
            cell.innerHTML += `<span class="absolute bottom-1 right-1 bg-emerald-500 text-white text-xs rounded-full px-2">${count}</span>`;
        }
        const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(num).padStart(2, '0')}`;
        cell.onclick = () => handleDayClick(dateStr);
    }
    return cell;
}

function handleDayClick(dateStr) {
    const bookings = allMonthBookings.filter(b => b.day === dateStr && b.type !== 'sale');
    const optionsModal = document.getElementById('options-modal');
    optionsModal.dataset.date = dateStr;
    
    const list = document.getElementById('daily-bookings-list');
    list.innerHTML = '';
    bookings.forEach(b => {
        const item = document.createElement('div');
        item.className = "flex justify-between p-2 bg-gray-100 rounded";
        item.innerHTML = `<span>${b.teamName}</span><button onclick="deleteBooking('${b.id}')" class="text-red-500 text-xs">Borrar</button>`;
        list.appendChild(item);
    });
    optionsModal.classList.add('is-open');
}

// -----------------------------------------------------------------
// 7. EVENT LISTENERS Y NAVEGACIÓN
// -----------------------------------------------------------------
function setupEventListeners() {
    menuBtn.onclick = toggleMenu;
    menuOverlay.onclick = toggleMenu;
    quickSaleBtn.onclick = openSaleModal;
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            showView(e.target.dataset.view);
            toggleMenu();
        };
    });

    // Formularios
    if (productForm) productForm.onsubmit = handleSaveProduct;
    if (refillForm) refillForm.onsubmit = handleSaveRefill;
    document.getElementById('confirm-sale-btn').onclick = confirmSale;
    document.getElementById('add-product-btn').onclick = () => {
        productForm.reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-modal').classList.add('is-open');
    };

    // Reservas originales
    document.getElementById('booking-form').onsubmit = handleSaveBooking;
    document.getElementById('type-btn-court').onclick = () => {
        const d = document.getElementById('options-modal').dataset.date;
        closeModals();
        openBookingModal(d);
    };
    
    document.getElementById('prev-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); };
    document.getElementById('next-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); };
    document.getElementById('logout-btn').onclick = () => auth.signOut();
}

// Manejo de Vistas
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('is-hidden'));
    if (views[viewName]) {
        views[viewName].classList.remove('is-hidden');
        if (viewName === 'caja') loadCajaData();
        if (viewName === 'stats') loadStatsData();
        if (viewName === 'historial') loadHistorialData();
    }
}

function toggleMenu() {
    mainMenu.classList.toggle('main-menu-hidden');
    mainMenu.classList.toggle('is-open');
    menuOverlay.classList.toggle('hidden');
}

// -----------------------------------------------------------------
// 8. FUNCIONES DE APOYO (RESERVAS Y LOGS)
// -----------------------------------------------------------------

async function handleSaveBooking(e) {
    e.preventDefault();
    const dateStr = document.getElementById('booking-date').value;
    const data = {
        teamName: document.getElementById('teamName').value,
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        type: 'court',
        totalPrice: parseFloat(document.getElementById('booking-total').innerText.replace('$', '')) || 0,
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value
    };
    await addDoc(collection(db, bookingsCollectionPath), data);
    await logBookingEvent('created', data);
    closeModals();
    showMessage("Reserva guardada");
}

async function logBookingEvent(action, data) {
    await addDoc(collection(db, logCollectionPath), {
        ...data,
        action,
        timestamp: Timestamp.now(),
        loggedByEmail: userEmail
    });
}

function showMessage(msg, isError = false) {
    const el = document.getElementById('message-text');
    el.textContent = msg;
    el.className = isError ? 'text-red-600' : 'text-emerald-700';
    document.getElementById('message-overlay').classList.add('is-open');
    setTimeout(() => document.getElementById('message-overlay').classList.remove('is-open'), 2000);
}

window.closeModals = () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
};

async function loadAppSettings() {
    const docSnap = await getDoc(doc(db, settingsDocPath));
    if (docSnap.exists()) appSettings = docSnap.data();
}

window.deleteProduct = async (id) => {
    if (confirm("¿Eliminar producto?")) await deleteDoc(doc(db, productsCollectionPath, id));
};

// --- FIN DEL CÓDIGO ---
