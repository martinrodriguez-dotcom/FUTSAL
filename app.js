// Importaciones de Firebase SDK (v11.6.1)
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

// --- CONSTANTES DE LA APP ---
const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]; 

// --- VARIABLES GLOBALES DE LA APP ---
let db, auth;
let userId = null; 
let userEmail = null; 
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let currentProductsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = [];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

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

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const menuBtn = document.getElementById('menu-btn');
const mainMenu = document.getElementById('main-menu');
const menuOverlay = document.getElementById('menu-overlay');
const userEmailDisplay = document.getElementById('user-email-display'); 
const logoutBtn = document.getElementById('logout-btn'); 
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const cajaDailyList = document.getElementById('caja-daily-list');
const cajaTotal = document.getElementById('caja-total');
const cajaDateFrom = document.getElementById('caja-date-from');
const cajaDateTo = document.getElementById('caja-date-to');
const cajaFilterBtn = document.getElementById('caja-filter-btn');
const statsList = document.getElementById('stats-list');
const statsDateFrom = document.getElementById('stats-date-from');
const statsDateTo = document.getElementById('stats-date-to');
const statsFilterBtn = document.getElementById('stats-filter-btn');
const historialList = document.getElementById('historial-list');
const historialDateFrom = document.getElementById('historial-date-from');
const historialDateTo = document.getElementById('historial-date-to');
const historialFilterBtn = document.getElementById('historial-filter-btn');

const typeModal = document.getElementById('type-modal'); 
const bookingModal = document.getElementById('booking-modal');
const eventModal = document.getElementById('event-modal'); 
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const cajaDetailModal = document.getElementById('caja-detail-modal');
const deleteReasonModal = document.getElementById('delete-reason-modal'); 
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');

const bookingForm = document.getElementById('booking-form');
const teamNameInput = document.getElementById('teamName');
const teamNameSuggestions = document.getElementById('teamName-suggestions');
const costPerHourInput = document.getElementById('costPerHour');
const grillCostInput = document.getElementById('grillCost');
const rentGrillCheckbox = document.getElementById('rentGrill');
const grillHoursSection = document.getElementById('grill-hours-section');
const courtHoursList = document.getElementById('court-hours-list');
const grillHoursList = document.getElementById('grill-hours-list');
const bookingTotal = document.getElementById('booking-total');

const eventForm = document.getElementById('event-form');
const eventBookingIdInput = document.getElementById('event-booking-id'); 
const eventDateInput = document.getElementById('event-date'); 
const eventNameInput = document.getElementById('eventName');
const contactPersonInput = document.getElementById('contactPerson');
const contactPhoneInput = document.getElementById('contactPhone');
const eventCostPerHourInput = document.getElementById('eventCostPerHour');
const eventHoursList = document.getElementById('event-hours-list');
const eventTotal = document.getElementById('event-total');

const deleteReasonForm = document.getElementById('delete-reason-form');
const deleteReasonText = document.getElementById('delete-reason-text');
const deleteBookingIdInput = document.getElementById('delete-booking-id');

const configForm = document.getElementById('config-form');
const configCourt1Price = document.getElementById('config-court1-price');
const configCourt2Price = document.getElementById('config-court2-price');
const configGrillPrice = document.getElementById('config-grill-price');
const configEventPrice = document.getElementById('config-event-price');

const quickSaleBtn = document.getElementById('quick-sale-btn');
const inventoryList = document.getElementById('inventory-list');
const refillProductsList = document.getElementById('refill-products-list');
const productForm = document.getElementById('product-form');
const refillForm = document.getElementById('refill-form');
const saleModal = document.getElementById('sale-modal');
const saleProductsList = document.getElementById('sale-products-list');
const saleTotalEl = document.getElementById('sale-total');

// -----------------------------------------------------------------
// 2. INICIALIZACIÓN Y FIREBASE
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    registerServiceWorker();
    firebaseInit();
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(error => console.error(error));
    }
}

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
                userEmailDisplay.textContent = userEmail;
                await loadAppSettings(); 
                appContainer.classList.remove('is-hidden');
                loginView.classList.add('is-hidden');
                registerView.classList.add('is-hidden');
                await loadBookingsForMonth(); 
                await loadProductsRealtime();
            } else {
                userId = null;
                appContainer.classList.add('is-hidden');
                loginView.classList.remove('is-hidden');
            }
        });
    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 3. GESTIÓN DE PRODUCTOS (LÓGICA NUEVA)
// -----------------------------------------------------------------

async function loadProductsRealtime() {
    const q = query(collection(db, productsCollectionPath), orderBy("name"));
    currentProductsUnsubscribe = onSnapshot(q, (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderInventory();
        renderRefillList();
    });
}

async function handleSaveProduct(e) {
    e.preventDefault();
    showMessage("Guardando producto...");
    const id = document.getElementById('product-id').value;
    const batchPrice = parseFloat(document.getElementById('prod-batch-price').value);
    const batchQty = parseInt(document.getElementById('prod-batch-qty').value);
    const margin = parseFloat(document.getElementById('prod-margin').value);
    const individualCost = batchPrice / batchQty;
    const salesPrice = individualCost * (1 + (margin / 100));

    const productData = {
        name: document.getElementById('prod-name').value.trim(),
        batchPrice: batchPrice,
        batchQuantity: batchQty,
        stock: parseInt(document.getElementById('prod-stock').value),
        margin: margin,
        individualCost: individualCost,
        salesPrice: salesPrice,
        lastUpdated: Timestamp.now()
    };

    try {
        if (id) await updateDoc(doc(db, productsCollectionPath, id), productData);
        else await addDoc(collection(db, productsCollectionPath), productData);
        closeModals();
        showMessage("Producto Guardado");
        setTimeout(hideMessage, 1500);
    } catch (error) {
        showMessage("Error: " + error.message, true);
    }
}

async function handleSaveRefill(e) {
    e.preventDefault();
    showMessage("Actualizando...");
    const id = document.getElementById('refill-id').value;
    const newBatchPrice = parseFloat(document.getElementById('refill-batch-price').value);
    const qtyBought = parseInt(document.getElementById('refill-qty-bought').value);
    const product = allProducts.find(p => p.id === id);

    const newIndividualCost = newBatchPrice / product.batchQuantity;
    const newSalesPrice = newIndividualCost * (1 + (product.margin / 100));

    try {
        await updateDoc(doc(db, productsCollectionPath, id), {
            batchPrice: newBatchPrice,
            individualCost: newIndividualCost,
            salesPrice: newSalesPrice,
            stock: product.stock + qtyBought,
            lastUpdated: Timestamp.now()
        });
        closeModals();
        showMessage("Stock y Precios Actualizados");
        setTimeout(hideMessage, 1500);
    } catch (error) {
        showMessage("Error: " + error.message, true);
    }
}

// -----------------------------------------------------------------
// 4. LÓGICA DE VENTAS RÁPIDAS
// -----------------------------------------------------------------
let saleCart = [];
function openSaleModal() {
    saleCart = [];
    renderSaleList();
    saleTotalEl.textContent = "$0";
    saleModal.classList.add('is-open');
}

function renderSaleList() {
    saleProductsList.innerHTML = '';
    allProducts.forEach(p => {
        if (p.stock <= 0) return;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-50 p-3 rounded-lg border mb-2";
        div.innerHTML = `<div><p class="font-bold">${p.name}</p><p class="text-xs">$${p.salesPrice.toFixed(2)}</p></div>
                         <button class="bg-emerald-600 text-white px-3 py-1 rounded" onclick="addToCart('${p.id}')">+</button>`;
        saleProductsList.appendChild(div);
    });
}

window.addToCart = (id) => {
    const p = allProducts.find(prod => prod.id === id);
    saleCart.push(p);
    const total = saleCart.reduce((acc, curr) => acc + curr.salesPrice, 0);
    saleTotalEl.textContent = `$${total.toLocaleString()}`;
};

async function confirmSale() {
    if (saleCart.length === 0) return;
    try {
        for (const item of saleCart) {
            await updateDoc(doc(db, productsCollectionPath, item.id), { stock: item.stock - 1 });
        }
        const total = saleCart.reduce((acc, curr) => acc + curr.salesPrice, 0);
        await addDoc(collection(db, bookingsCollectionPath), {
            type: 'sale', teamName: 'Venta', totalPrice: total, day: new Date().toISOString().split('T')[0], monthYear: new Date().toISOString().substring(0, 7), paymentMethod: 'efectivo'
        });
        closeModals();
        showMessage("Venta Finalizada");
    } catch (e) { showMessage(e.message, true); }
}

// -----------------------------------------------------------------
// 5. RENDERIZADO INVENTARIO
// -----------------------------------------------------------------
function renderInventory() {
    if (!inventoryList) return;
    inventoryList.innerHTML = '';
    allProducts.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `<td class="p-4">${p.name}</td><td class="p-4">${p.stock}</td><td class="p-4">$${p.individualCost.toFixed(2)}</td>
                        <td class="p-4 font-bold">$${p.salesPrice.toFixed(2)}</td>
                        <td class="p-4"><button onclick="editProduct('${p.id}')" class="text-blue-600 mr-2">Editar</button>
                        <button onclick="deleteProduct('${p.id}')" class="text-red-600">Borrar</button></td>`;
        inventoryList.appendChild(tr);
    });
}

function renderRefillList() {
    if (!refillProductsList) return;
    refillProductsList.innerHTML = '';
    allProducts.forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl shadow border flex justify-between items-center";
        div.innerHTML = `<div><p class="font-bold">${p.name}</p><p class="text-sm">Stock: ${p.stock}</p></div>
                         <button onclick="openRefillModal('${p.id}')" class="bg-emerald-600 text-white px-4 py-2 rounded-lg">Reponer</button>`;
        refillProductsList.appendChild(div);
    });
}

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

window.openRefillModal = (id) => {
    const p = allProducts.find(prod => prod.id === id);
    document.getElementById('refill-id').value = p.id;
    document.getElementById('refill-prod-name').textContent = p.name;
    document.getElementById('refill-current-stock').textContent = p.stock;
    document.getElementById('refill-modal').classList.add('is-open');
};

window.deleteProduct = async (id) => { if (confirm("¿Borrar?")) await deleteDoc(doc(db, productsCollectionPath, id)); };

// -----------------------------------------------------------------
// 6. LÓGICA DE RESERVAS (ESTO ES LO QUE FALTABA)
// -----------------------------------------------------------------

async function handleSaveBooking(event) {
    event.preventDefault();
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando Cancha...");
    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const selectedCourtHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    
    const data = {
        type: 'court', teamName: teamNameInput.value.trim(), courtId: document.querySelector('input[name="courtSelection"]:checked').value,
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10), costPerHour: parseFloat(costPerHourInput.value),
        rentGrill: rentGrillCheckbox.checked, grillCost: parseFloat(grillCostInput.value), day: dateStr, monthYear: dateStr.substring(0, 7),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value, courtHours: selectedCourtHours,
        grillHours: rentGrillCheckbox.checked ? Array.from(grillHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10)) : [],
        totalPrice: updateTotalPrice()
    };

    try {
        if (bookingId) await setDoc(doc(db, bookingsCollectionPath, bookingId), data, { merge: true });
        else await addDoc(collection(db, bookingsCollectionPath), data);
        await logBookingEvent(bookingId ? 'updated' : 'created', data);
        closeModals();
        showMessage("Reserva Guardada");
    } catch (e) { showMessage(e.message, true); }
    finally { saveButton.disabled = false; }
}

async function handleSaveEvent(event) {
    event.preventDefault();
    const saveButton = eventForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando Evento...");
    const id = eventBookingIdInput.value;
    const dateStr = eventDateInput.value;
    const selectedHours = Array.from(eventHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    const data = {
        type: 'event', teamName: eventNameInput.value.trim(), contactPerson: contactPersonInput.value.trim(),
        contactPhone: contactPhoneInput.value.trim(), costPerHour: parseFloat(eventCostPerHourInput.value),
        day: dateStr, monthYear: dateStr.substring(0, 7), paymentMethod: document.querySelector('input[name="eventPaymentMethod"]:checked').value,
        courtHours: selectedHours, totalPrice: updateEventTotalPrice(), stock: 0 
    };

    try {
        if (id) await setDoc(doc(db, bookingsCollectionPath, id), data, { merge: true });
        else await addDoc(collection(db, bookingsCollectionPath), data);
        await logBookingEvent(id ? 'updated' : 'created', data);
        closeModals();
        showMessage("Evento Guardado");
    } catch (e) { showMessage(e.message, true); }
    finally { saveButton.disabled = false; }
}

// --- LÓGICA DE NAVEGACIÓN Y CALENDARIO (INTEGRA) ---
function toggleMenu() {
    mainMenu.classList.toggle('is-open');
    mainMenu.classList.toggle('main-menu-hidden');
    menuOverlay.classList.toggle('hidden');
}

function showView(viewName) {
    Object.values(views).forEach(v => v?.classList.add('is-hidden'));
    if (views[viewName]) {
        views[viewName].classList.remove('is-hidden');
        if (viewName === 'caja') loadCajaData();
        if (viewName === 'stats') loadStatsData();
        if (viewName === 'historial') loadHistorialData();
    }
}

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
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();

    const statsByDay = {};
    allMonthBookings.forEach(b => {
        const d = parseInt(b.day.split('-')[2]);
        if (!statsByDay[d]) statsByDay[d] = { court: 0, event: 0 };
        if (b.type === 'event') statsByDay[d].event++;
        else if (b.type === 'court') statsByDay[d].court++;
    });

    for (let i = 0; i < firstDay; i++) calendarGrid.appendChild(createDayCell('', false));
    for (let i = 1; i <= days; i++) {
        const d = statsByDay[i] || { court: 0, event: 0 };
        calendarGrid.appendChild(createDayCell(i, true, d.court, d.event));
    }
}

function createDayCell(num, isCurrent, court = 0, event = 0) {
    const cell = document.createElement('div');
    cell.className = `relative h-20 md:h-28 border border-gray-200 p-2 ${isCurrent ? 'bg-white cursor-pointer hover:bg-gray-50' : 'bg-gray-100'}`;
    if (isCurrent) {
        cell.innerHTML = `<span class="text-sm font-medium">${num}</span>`;
        if (event > 0) {
            const b = document.createElement('span'); b.className = 'booking-count event'; b.textContent = event; cell.appendChild(b);
        } else if (court > 0) {
            const b = document.createElement('span'); b.className = 'booking-count'; b.textContent = court; cell.appendChild(b);
        }
        const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(num).padStart(2, '0')}`;
        cell.onclick = () => handleDayClick(dateStr);
    }
    return cell;
}

function handleDayClick(dateStr) {
    const bookings = allMonthBookings.filter(b => b.day === dateStr);
    const event = bookings.find(b => b.type === 'event');
    if (event) showEventOptionsModal(event);
    else if (bookings.length > 0) showOptionsModal(dateStr, bookings.filter(b => b.type === 'court'));
    else { typeModal.dataset.date = dateStr; typeModal.classList.add('is-open'); }
}

// -----------------------------------------------------------------
// 7. REPORTES Y UTILIDADES (TODO EL RESTO)
// -----------------------------------------------------------------

async function loadCajaData() {
    const snapshot = await getDocs(collection(db, bookingsCollectionPath));
    let grandTotal = 0;
    const daily = {};
    snapshot.docs.forEach(doc => {
        const b = doc.data();
        grandTotal += (b.totalPrice || 0);
        if (!daily[b.day]) daily[b.day] = { total: 0, bookings: [] };
        daily[b.day].total += (b.totalPrice || 0);
        daily[b.day].bookings.push(b);
    });
    cajaTotal.textContent = `$${grandTotal.toLocaleString()}`;
    renderCajaList(daily);
}

function renderCajaList(daily) {
    cajaDailyList.innerHTML = '';
    Object.keys(daily).sort().reverse().forEach(day => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl shadow flex justify-between mb-2";
        div.innerHTML = `<span>${day}</span><strong>$${daily[day].total.toLocaleString()}</strong>`;
        cajaDailyList.appendChild(div);
    });
}

function updateTotalPrice() {
    const c = parseFloat(costPerHourInput.value) || 0;
    const g = parseFloat(grillCostInput.value) || 0;
    const ch = courtHoursList.querySelectorAll('.time-slot.selected').length;
    const gh = grillHoursList.querySelectorAll('.time-slot.selected').length;
    const total = (c * ch) + (rentGrillCheckbox.checked ? (g * gh) : 0);
    bookingTotal.textContent = `$${total.toLocaleString()}`;
    return total;
}

function updateEventTotalPrice() {
    const c = parseFloat(eventCostPerHourInput.value) || 0;
    const h = eventHoursList.querySelectorAll('.time-slot.selected').length;
    const total = c * h;
    eventTotal.textContent = `$${total.toLocaleString()}`;
    return total;
}

async function logBookingEvent(action, data) {
    await addDoc(collection(db, logCollectionPath), { ...data, action, timestamp: Timestamp.now(), loggedByEmail: userEmail });
}

function setupEventListeners() {
    menuBtn.onclick = toggleMenu;
    menuOverlay.onclick = toggleMenu;
    logoutBtn.onclick = () => auth.signOut();
    quickSaleBtn.onclick = openSaleModal;
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => { showView(e.target.dataset.view); toggleMenu(); };
    });

    bookingForm.onsubmit = handleSaveBooking;
    eventForm.onsubmit = handleSaveEvent;
    if (configForm) configForm.onsubmit = async (e) => {
        e.preventDefault();
        const settings = { court1Price: parseFloat(configCourt1Price.value), court2Price: parseFloat(configCourt2Price.value), grillPrice: parseFloat(configGrillPrice.value), eventPrice: parseFloat(configEventPrice.value) };
        await setDoc(doc(db, settingsDocPath), settings);
        appSettings = settings; showMessage("Configuración Guardada");
    };

    if (productForm) productForm.onsubmit = handleSaveProduct;
    if (refillForm) refillForm.onsubmit = handleSaveRefill;
    document.getElementById('confirm-sale-btn').onclick = confirmSale;
    document.getElementById('add-product-btn').onclick = () => { productForm.reset(); document.getElementById('product-id').value = ''; document.getElementById('product-modal').classList.add('is-open'); };

    document.getElementById('type-btn-court').onclick = () => { const d = typeModal.dataset.date; closeModals(); openBookingModal(d); };
    document.getElementById('type-btn-event').onclick = () => { const d = typeModal.dataset.date; closeModals(); showEventModal(d); };
    
    document.getElementById('prev-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); };
    document.getElementById('next-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); };

    // Lógica para horarios de modales (Original integrada)
    [courtHoursList, grillHoursList, eventHoursList].forEach(list => {
        OPERATING_HOURS.forEach(h => {
            const b = document.createElement('button'); b.type = "button"; b.className = 'time-slot'; b.textContent = `${h}:00`; b.dataset.hour = h;
            b.onclick = () => { b.classList.toggle('selected'); updateTotalPrice(); updateEventTotalPrice(); };
            list.appendChild(b);
        });
    });

    rentGrillCheckbox.onchange = () => { grillHoursSection.classList.toggle('is-hidden', !rentGrillCheckbox.checked); updateTotalPrice(); };
    loginForm.onsubmit = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch(e) { showMessage(e.message, true); } };
    registerForm.onsubmit = async (e) => { e.preventDefault(); try { await createUserWithEmailAndPassword(auth, document.getElementById('register-email').value, document.getElementById('register-password').value); } catch(e) { showMessage(e.message, true); } };
}

function openBookingModal(date) {
    bookingForm.reset();
    document.getElementById('booking-date').value = date;
    document.getElementById('booking-modal-title').textContent = `Reservar ${date}`;
    costPerHourInput.value = appSettings.court1Price;
    grillCostInput.value = appSettings.grillPrice;
    bookingModal.classList.add('is-open');
}

function showEventModal(date) {
    eventForm.reset();
    eventDateInput.value = date;
    eventCostPerHourInput.value = appSettings.eventPrice;
    eventModal.classList.add('is-open');
}

async function loadAppSettings() {
    const snap = await getDoc(doc(db, settingsDocPath));
    if (snap.exists()) {
        appSettings = snap.data();
        configCourt1Price.value = appSettings.court1Price; configCourt2Price.value = appSettings.court2Price;
        configGrillPrice.value = appSettings.grillPrice; configEventPrice.value = appSettings.eventPrice;
    }
}

function showMessage(msg, isError = false) {
    messageText.textContent = msg;
    messageText.className = isError ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold';
    messageOverlay.classList.add('is-open');
    setTimeout(hideMessage, 2000);
}
function hideMessage() { messageOverlay.classList.remove('is-open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }

// Exportar funciones a window para botones dinámicos
window.closeModals = closeModals;
window.handleDayClick = handleDayClick;

// Fin del código integrado.
