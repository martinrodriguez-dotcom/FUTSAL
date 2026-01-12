/**
 * APP.JS - SISTEMA INTEGRAL "PANZA VERDE" - VERSIÓN FINAL 5.0
 * ----------------------------------------------------------------
 * Gestión de Reservas (C1/C2), Eventos, Recurrencia, Stock y Buffet.
 * Lógica de Reposición: Actualización directa de costo total al precio nuevo.
 */

// 1. IMPORTACIONES DE FIREBASE SDK (v11.6.1)
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
    updateDoc,
    deleteDoc, 
    collection, 
    query, 
    where, 
    onSnapshot,
    getDocs,
    documentId,
    Timestamp, 
    orderBy, 
    getDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -----------------------------------------------------------------
// 2. CONFIGURACIÓN E INICIALIZACIÓN
// -----------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyC2dY3i0LqcfmUx4Qx91Cgs66-a-dXSLbk",
    authDomain: "reserva-futsal.firebaseapp.com",
    projectId: "reserva-futsal",
    storageBucket: "reserva-futsal.firebasestorage.app",
    messagingSenderId: "285845706235",
    appId: "1:285845706235:web:9355804aea8181b030275e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Rutas de Colecciones
const COLLECTIONS = {
    BOOKINGS: "bookings",
    CUSTOMERS: "customers",
    LOGS: "booking_log",
    SETTINGS: "app_settings",
    PRODUCTS: "products",
    SALES: "sales",
    TRANSACTIONS: "product_transactions"
};

const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Estado Global
let userId = null;
let userEmail = null;
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = [];
let currentSelectedProduct = null;

let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

let recurringSettings = { dayOfWeek: null, months: [] };

// -----------------------------------------------------------------
// 3. CICLO DE VIDA (DOM CONTENT LOADED)
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    console.log("PV Sistema v5.0 - Iniciando...");
    setupSafeEventListeners();
    
    // Configurar persistencia
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (e) {
        console.error("Error persistencia:", e);
    }
    
    // Observador de Autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            userEmail = user.email;
            document.getElementById('user-email-display').textContent = userEmail;
            
            await loadAppSettings();
            toggleAppVisibility(true);
            
            // Iniciar sincronización de datos
            loadBookingsForMonth();
            syncProducts(); 
            
            hideMessage(); // Cerramos el "Validando acceso"
        } else {
            toggleAppVisibility(false);
            hideMessage();
        }
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => reg.update());
    }
});

/**
 * Agregamos listeners de forma segura para evitar errores de null
 */
function setupSafeEventListeners() {
    const addL = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    // Navegación
    addL('menu-btn', 'click', toggleMenu);
    addL('menu-overlay', 'click', toggleMenu);
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            const target = e.currentTarget.dataset.view;
            showView(target);
            toggleMenu();
        };
    });

    // Auth
    addL('login-form', 'submit', handleLogin);
    addL('register-form', 'submit', handleRegister);
    addL('logout-btn', 'click', () => signOut(auth));
    addL('show-register', 'click', (e) => {
        e.preventDefault();
        document.getElementById('login-view').classList.add('is-hidden');
        document.getElementById('register-view').classList.remove('is-hidden');
    });
    addL('show-login', 'click', (e) => {
        e.preventDefault();
        document.getElementById('register-view').classList.add('is-hidden');
        document.getElementById('login-view').classList.remove('is-hidden');
    });

    // Calendario
    addL('prev-month-btn', 'click', () => { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); });
    addL('next-month-btn', 'click', () => { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); });

    // Reservas Cancha
    addL('booking-form', 'submit', handleSaveBooking);
    addL('cancel-booking-btn', 'click', closeModals);
    document.querySelectorAll('input[name="courtSelection"]').forEach(r => {
        r.onchange = updateCourtAvailability;
    });
    addL('rentGrill', 'change', (e) => {
        const section = document.getElementById('grill-hours-section');
        if (section) section.classList.toggle('is-hidden', !e.target.checked);
        updateTotalPrice();
    });
    addL('teamName', 'input', handleTeamNameInput);

    // Eventos Especiales
    addL('event-form', 'submit', handleSaveEvent);
    addL('cancel-event-btn', 'click', closeModals);

    // Recurrencia
    addL('recurring-toggle', 'change', openRecurringModal);
    addL('confirm-recurring-btn', 'click', saveRecurringSettings);
    addL('cancel-recurring-btn', 'click', () => {
        const t = document.getElementById('recurring-toggle');
        if (t) t.checked = false;
        closeModals();
    });

    // Buffet e Inventario
    addL('add-product-btn', 'click', () => document.getElementById('product-form-container').classList.toggle('is-hidden'));
    addL('cancel-product-btn', 'click', () => document.getElementById('product-form-container').classList.add('is-hidden'));
    addL('product-form', 'submit', handleSaveProduct);
    addL('inventory-search-input', 'input', (e) => renderProducts(e.target.value));
    
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        addL(id, 'input', calculateProductPrices);
    });

    // Modales Buffet
    addL('restock-form', 'submit', handleConfirmRestock);
    addL('edit-product-form', 'submit', handleConfirmEditProduct);

    // Venta Buffet
    addL('header-sale-btn', 'click', openSaleModal);
    addL('sale-search-input', 'input', handleSaleSearch);
    addL('sale-qty-minus', 'click', () => updateSaleQty(-1));
    addL('sale-qty-plus', 'click', () => updateSaleQty(1));
    addL('confirm-sale-btn', 'click', handleConfirmSale);
    addL('close-sale-modal-btn', 'click', closeModals);

    // Otros
    addL('caja-filter-btn', 'click', loadCajaData);
    addL('config-form', 'submit', handleSaveConfig);
    addL('delete-reason-form', 'submit', handleConfirmDelete);
}

// -----------------------------------------------------------------
// 4. FUNCIONES DE VISTA Y NAVEGACIÓN
// -----------------------------------------------------------------

function toggleAppVisibility(s) {
    const c = document.getElementById('app-container'), l = document.getElementById('login-view'), r = document.getElementById('register-view');
    if(s) { c?.classList.remove('is-hidden'); l?.classList.add('is-hidden'); r?.classList.add('is-hidden'); }
    else { c?.classList.add('is-hidden'); l?.classList.remove('is-hidden'); }
}

function toggleMenu() {
    document.getElementById('main-menu').classList.toggle('is-open');
    document.getElementById('menu-overlay').classList.toggle('hidden');
}

function showView(v) {
    ['calendar-view', 'caja-view', 'stats-view', 'historial-view', 'productos-view', 'config-view'].forEach(x => {
        const el = document.getElementById(x);
        if (el) el.classList.add('is-hidden');
    });
    const target = document.getElementById(v + '-view');
    if (target) target.classList.remove('is-hidden');
    
    if (v === 'configuracion') loadConfigDataIntoForm();
    if (v === 'caja') loadCajaData();
}

// -----------------------------------------------------------------
// 5. LÓGICA DE RESERVAS Y CALENDARIO
// -----------------------------------------------------------------

function loadBookingsForMonth() {
    const y = currentMonthDate.getFullYear(), m = currentMonthDate.getMonth() + 1, my = `${y}-${String(m).padStart(2, '0')}`;
    const title = document.getElementById('current-month-year');
    if (title) title.textContent = `${monthNames[currentMonthDate.getMonth()]} ${y}`;
    
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe();
    
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("monthYear", "==", my));
    currentBookingsUnsubscribe = onSnapshot(q, (snap) => {
        allMonthBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCalendar();
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid'); if(!grid) return; grid.innerHTML = '';
    const y = currentMonthDate.getFullYear(), m = currentMonthDate.getMonth(), fd = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    
    // Relleno mes anterior
    for(let i=0; i<fd; i++) grid.appendChild(document.createElement('div'));
    
    // Días actuales
    for(let i=1; i<=dim; i++) {
        const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`, dbk = allMonthBookings.filter(b => b.day === ds);
        const cell = document.createElement('div');
        cell.className = 'day-cell p-2 bg-white cursor-pointer relative flex items-center justify-center border border-gray-100 rounded-2xl transition-all hover:bg-emerald-50';
        cell.innerHTML = `<span class="font-black text-gray-700">${i}</span>`;
        if (dbk.length > 0) {
            const hasEvent = dbk.some(b => b.type === 'event');
            cell.innerHTML += `<span class="booking-count ${hasEvent ? '!bg-amber-500' : ''}">${dbk.length}</span>`;
        }
        cell.onclick = () => handleDayClick(ds, dbk);
        grid.appendChild(cell);
    }
}

function handleDayClick(ds, dbk) {
    if (dbk.length === 0) {
        const modal = document.getElementById('type-modal');
        if (modal) { modal.dataset.date = ds; modal.classList.add('is-open'); }
    } else {
        showOptionsModal(ds, dbk);
    }
}

// -----------------------------------------------------------------
// 6. GESTIÓN DE BUFFET (PRODUCTOS Y STOCK)
// -----------------------------------------------------------------

/**
 * LOGICA DE REPOSICION DIRECTA:
 * Todo el stock anterior pasa a valer lo que vale el stock nuevo.
 */
function calculateProductPrices() {
    const c = parseFloat(document.getElementById('prod-batch-cost')?.value) || 0;
    const q = parseInt(document.getElementById('prod-batch-qty')?.value) || 1;
    const p = parseFloat(document.getElementById('prod-profit-pct')?.value) || 0;
    const u = c / q, s = Math.ceil(u * (1 + (p / 100)));
    
    const disp = document.getElementById('prod-suggested-price');
    if (disp) disp.textContent = `$${s}`;
    const hid = document.getElementById('prod-unit-cost');
    if (hid) hid.value = u;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const n = document.getElementById('prod-name').value.trim();
    const s = parseInt(document.getElementById('prod-stock').value);
    const u = parseFloat(document.getElementById('prod-unit-cost').value);
    const sp = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));

    try {
        const ref = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
            name: n, stock: s, unitCost: u, salePrice: sp, createdAt: Timestamp.now()
        });
        await logTransaction(ref.id, 'Alta Inicial', s, u, 'in');
        e.target.reset();
        document.getElementById('product-form-container').classList.add('is-hidden');
        showMessage("Producto creado.");
    } catch (err) { alert(err.message); }
}

function syncProducts() {
    onSnapshot(collection(db, COLLECTIONS.PRODUCTS), (snap) => {
        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderProducts(document.getElementById('inventory-search-input')?.value || "");
    });
}

function renderProducts(filter = "") {
    const list = document.getElementById('product-list'); if (!list) return; list.innerHTML = '';
    allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())).forEach(p => {
        const d = document.createElement('div');
        d.className = 'product-card bg-white p-5 rounded-3xl border border-gray-50 shadow-sm flex flex-col gap-4';
        d.innerHTML = `
            <div class="flex justify-between items-start">
                <div><h4 class="font-black text-lg">${p.name}</h4><span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'}">S: ${p.stock}</span></div>
                <div class="text-right"><p class="text-[9px] font-bold text-gray-400 uppercase">Venta</p><p class="text-xl font-black text-emerald-600">$${p.salePrice}</p></div>
            </div>
            <div class="card-actions-grid grid grid-cols-2 gap-2">
                <button class="card-action-btn" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="card-action-btn" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="card-action-btn" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                <button class="card-action-btn text-red-500" onclick="window.deleteProduct('${p.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(d);
    });
}

// -----------------------------------------------------------------
// 7. LÓGICA DE COSTO DE REPOSICIÓN DIRECTO (NUEVO)
// -----------------------------------------------------------------

async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    const newUnitCost = batchCost / addQty;
    const p = allProducts.find(x => x.id === id);
    const margin = p.salePrice / p.unitCost; // Mantenemos margen previo
    const newSalePrice = Math.ceil(newUnitCost * margin);

    try {
        showMessage("Actualizando valores de todo el inventario...");
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
            stock: p.stock + addQty,
            unitCost: newUnitCost, // SE ACTUALIZA TODO AL ÚLTIMO PRECIO
            salePrice: newSalePrice
        });
        await logTransaction(id, `Reposición Directa (+${addQty})`, addQty, newUnitCost, 'in');
        closeModals();
        showMessage(`Actualizado. Nuevo costo unidad: $${newUnitCost.toFixed(2)}`);
        setTimeout(hideMessage, 2000);
    } catch (err) { alert(err.message); }
}

// -----------------------------------------------------------------
// 8. VENTA RÁPIDA (MODAL)
// -----------------------------------------------------------------

function openSaleModal() {
    document.getElementById('sale-search-input').value = '';
    document.getElementById('sale-search-results').innerHTML = '';
    document.getElementById('selected-product-info').classList.add('is-hidden');
    document.getElementById('sale-modal').classList.add('is-open');
}

function handleSaleSearch() {
    const val = document.getElementById('sale-search-input').value.toLowerCase();
    const container = document.getElementById('sale-search-results'); container.innerHTML = '';
    if (val.length < 2) return;
    
    allProducts.filter(p => p.name.toLowerCase().includes(val)).forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer mb-2';
        item.innerHTML = `<span>${p.name} (S: ${p.stock})</span> <strong>$${p.salePrice}</strong>`;
        item.onclick = () => {
            currentSelectedProduct = p;
            document.getElementById('sel-prod-name').textContent = p.name;
            document.getElementById('sel-prod-stock').textContent = p.stock;
            document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
            document.getElementById('sale-qty-input').value = 1;
            document.getElementById('selected-product-info').classList.remove('is-hidden');
            document.getElementById('confirm-sale-btn').disabled = (p.stock <= 0);
            updateSaleTotal();
        };
        container.appendChild(item);
    });
}

function updateSaleQty(d) {
    const i = document.getElementById('sale-qty-input');
    let v = parseInt(i.value) + d;
    if (v < 1) v = 1;
    if (v > currentSelectedProduct.stock) v = currentSelectedProduct.stock;
    i.value = v;
    updateSaleTotal();
}

function updateSaleTotal() {
    const q = parseInt(document.getElementById('sale-qty-input').value);
    document.getElementById('sale-total-display').textContent = `$${(q * currentSelectedProduct.salePrice).toLocaleString()}`;
}

async function handleConfirmSale() {
    const q = parseInt(document.getElementById('sale-qty-input').value);
    const t = q * currentSelectedProduct.salePrice;
    try {
        showMessage("Registrando cobro...");
        await addDoc(collection(db, COLLECTIONS.SALES), {
            name: currentSelectedProduct.name, qty: q, total: t, day: new Date().toISOString().split('T')[0], timestamp: Timestamp.now()
        });
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, currentSelectedProduct.id), { stock: currentSelectedProduct.stock - q });
        await logTransaction(currentSelectedProduct.id, 'Venta Buffet', q, currentSelectedProduct.unitCost, 'out');
        closeModals();
        showMessage("¡Venta registrada!");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

// -----------------------------------------------------------------
// 9. CAJA UNIFICADA
// -----------------------------------------------------------------

async function loadCajaData() {
    const f = document.getElementById('caja-date-from')?.value, t = document.getElementById('caja-date-to')?.value;
    if (!f || !t) return;
    showMessage("Calculando balance...");
    try {
        const qB = query(collection(db, COLLECTIONS.BOOKINGS), where("day", ">=", f), where("day", "<=", t));
        const qS = query(collection(db, COLLECTIONS.SALES), where("day", ">=", f), where("day", "<=", t));
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        
        let totalB = 0; snapB.forEach(d => totalB += (d.data().totalPrice || 0));
        let totalS = 0; snapS.forEach(d => totalS += (d.data().total || 0));

        document.getElementById('caja-total-bookings').textContent = `$${totalB.toLocaleString()}`;
        document.getElementById('caja-total-sales').textContent = `$${totalS.toLocaleString()}`;
        document.getElementById('caja-total-combined').textContent = `$${(totalB + totalS).toLocaleString()}`;
    } catch (e) { console.error(e); }
    finally { hideMessage(); }
}

// -----------------------------------------------------------------
// 10. UTILIDADES Y LOGS (MODULARES)
// -----------------------------------------------------------------

async function logTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), { productId, desc, qty, cost, type, timestamp: Timestamp.now() });
}

async function handleLogin(e) { e.preventDefault(); showMessage("Validando..."); try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch(err) { alert("Acceso denegado"); hideMessage(); } }
async function handleRegister(e) { e.preventDefault(); try { await createUserWithEmailAndPassword(auth, document.getElementById('register-email').value, document.getElementById('register-password').value); } catch(err) { alert(err.message); } }

async function loadAppSettings() { const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, "prices")); if (snap.exists()) appSettings = snap.data(); }
function loadConfigDataIntoForm() { document.getElementById('config-court1-price').value = appSettings.court1Price; document.getElementById('config-court2-price').value = appSettings.court2Price; document.getElementById('config-grill-price').value = appSettings.grillPrice; }
async function handleSaveConfig(e) { e.preventDefault(); const d = { court1Price: parseFloat(document.getElementById('config-court1-price').value), court2Price: parseFloat(document.getElementById('config-court2-price').value), grillPrice: parseFloat(document.getElementById('config-grill-price').value) }; await setDoc(doc(db, COLLECTIONS.SETTINGS, "prices"), d); appSettings = d; showMessage("Actualizado"); setTimeout(hideMessage, 1500); }

function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }
function showMessage(m) { const t=document.getElementById('message-text'); if(t) t.textContent=m; document.getElementById('message-overlay').classList.add('is-open'); }
function hideMessage() { document.getElementById('message-overlay')?.classList.remove('is-open'); }
window.hideMessage = hideMessage; window.closeModals = closeModals;

// Funciones globales dinámicas
window.deleteProduct = async (id) => { if (confirm("¿Eliminar?")) await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id)); };
window.openRestock = (id) => { const p = allProducts.find(x => x.id === id); document.getElementById('restock-prod-id').value = id; document.getElementById('restock-name').textContent = p.name; document.getElementById('restock-current-stock').textContent = p.stock; document.getElementById('restock-modal').classList.add('is-open'); };
window.openEditProduct = (id) => { const p = allProducts.find(x => x.id === id); document.getElementById('edit-prod-id').value = id; document.getElementById('edit-prod-name').value = p.name; document.getElementById('edit-prod-cost').value = p.unitCost; document.getElementById('edit-prod-price').value = p.salePrice; document.getElementById('edit-prod-stock').value = p.stock; document.getElementById('edit-product-modal').classList.add('is-open'); };
window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id); document.getElementById('history-product-name').textContent = p.name; const list = document.getElementById('product-history-list'); list.innerHTML = '...';
    const snap = await getDocs(query(collection(db, COLLECTIONS.TRANSACTIONS), where("productId", "==", id), orderBy("timestamp", "desc")));
    list.innerHTML = snap.empty ? 'Sin logs' : '';
    snap.forEach(d => { const t = d.data(); const i = document.createElement('div'); i.className = `p-3 bg-gray-50 rounded-xl mb-2 flex justify-between`; i.innerHTML = `<div><p class="font-bold">${t.desc}</p></div><p class="font-black ${t.type==='in'?'text-emerald-600':'text-red-500'}">${t.type==='in'?'+':'-'}${t.qty}</p>`; list.appendChild(i); });
    document.getElementById('product-history-modal').classList.add('is-open');
};

// ... (Resto de funciones de reservas iguales a tu versión funcional)
async function handleSaveBooking(e) {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
    const sh = Array.from(document.getElementById('court-hours-list').querySelectorAll('.selected')).map(x => parseInt(x.textContent));
    if(!sh.length) { btn.disabled=false; return alert("Elegí hora"); }
    const ds = document.getElementById('booking-date').value;
    const data = { teamName: document.getElementById('teamName').value.trim(), courtId: document.querySelector('input[name="courtSelection"]:checked').value, day: ds, monthYear: ds.substring(0, 7), courtHours: sh, totalPrice: updateTotalPrice(), paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value, rentGrill: document.getElementById('rentGrill').checked, timestamp: Timestamp.now(), type: 'court' };
    const id = document.getElementById('booking-id').value;
    if (id) await updateDoc(doc(db, COLLECTIONS.BOOKINGS, id), data); else await addDoc(collection(db, COLLECTIONS.BOOKINGS), data);
    await logBookingEvent(id ? 'updated' : 'created', data);
    closeModals(); showMessage("Guardado"); setTimeout(hideMessage, 1500);
}

async function handleSaveEvent(e) {
    e.preventDefault(); showMessage("Guardando Evento...");
    const ds = document.getElementById('event-date')?.value || document.getElementById('booking-date').value;
    const sh = Array.from(document.getElementById('event-hours-list')?.querySelectorAll('.selected') || []).map(x => parseInt(x.textContent));
    const data = { type: 'event', teamName: document.getElementById('eventName')?.value || document.getElementById('teamName').value, day: ds, monthYear: ds.substring(0, 7), courtHours: sh, totalPrice: updateEventTotalPrice(), paymentMethod: 'efectivo', timestamp: Timestamp.now() };
    await addDoc(collection(db, COLLECTIONS.BOOKINGS), data);
    await logBookingEvent('created', data);
    closeModals(); hideMessage();
}

async function logBookingEvent(action, bookingData) {
    await addDoc(collection(db, COLLECTIONS.LOGS), { ...bookingData, action, timestamp: Timestamp.now(), loggedByEmail: userEmail });
}

function showOptionsModal(ds, bk) { 
    const modal = document.getElementById('options-modal'); modal.dataset.date = ds; const list = document.getElementById('daily-bookings-list'); list.innerHTML = '';
    bk.forEach(b => { const d = document.createElement('div'); d.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between items-center border mb-2 shadow-sm'; d.innerHTML = `<div><p class="font-black">${b.teamName}</p><p class="text-[10px] uppercase">${b.courtId || 'Evento'}</p></div><div class="flex gap-2"><button class="text-blue-600 font-black text-xs" onclick="window.viewBooking('${b.id}')">VER</button><button class="text-red-500 font-black text-xs" onclick="window.deleteBooking('${b.id}')">X</button></div>`; list.appendChild(d); });
    modal.classList.add('is-open');
}

window.viewBooking = async (id) => {
    const s = await getDoc(doc(db, COLLECTIONS.BOOKINGS, id));
    if (s.exists()) {
        const b = s.data();
        document.getElementById('view-booking-details').innerHTML = `<h4 class="text-2xl font-black text-emerald-700">${b.teamName}</h4><p class="font-bold text-gray-500 uppercase text-[10px]">${b.courtId || 'Evento'}</p><div class="mt-4 border-t pt-4 space-y-2"><p class="flex justify-between font-bold"><span>PAGO:</span> <span>${b.paymentMethod?.toUpperCase()}</span></p><p class="flex justify-between text-xl font-black text-emerald-600 pt-2"><span>TOTAL:</span> <span>$${b.totalPrice?.toLocaleString()}</span></p></div>`;
        document.getElementById('view-modal').classList.add('is-open');
    }
};

window.deleteBooking = async (id) => { handleDeleteBooking(id); };

// Auditoría de Eliminación
function handleDeleteBooking(id) {
    closeModals();
    document.getElementById('delete-booking-id').value = id;
    document.getElementById('delete-reason-text').value = '';
    document.getElementById('delete-reason-modal').classList.add('is-open');
}

async function handleConfirmDelete(e) {
    e.preventDefault();
    const id = document.getElementById('delete-booking-id').value;
    const reason = document.getElementById('delete-reason-text').value;
    const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, id));
    await logBookingEvent('deleted', { ...snap.data(), reason });
    await deleteDoc(doc(db, COLLECTIONS.BOOKINGS, id));
    closeModals(); showMessage("Eliminado"); setTimeout(hideMessage, 1500);
}

// Recurrencia e Iniciales
function openRecurringModal() {
    const l = document.getElementById('recurring-month-list'); l.innerHTML = '';
    for(let i=0; i<12; i++) {
        const d = new Date(); d.setMonth(d.getMonth()+i);
        const b = document.createElement('button'); b.type='button'; b.className='month-toggle-btn'; b.dataset.month=d.getMonth(); b.dataset.year=d.getFullYear(); b.textContent=d.toLocaleString('es-AR',{month:'short'});
        b.onclick=(e)=>e.target.classList.toggle('selected'); l.appendChild(b);
    }
    document.getElementById('recurring-modal').classList.add('is-open');
}

function saveRecurringSettings() {
    const d = document.querySelector('.day-toggle-btn.selected'), m = document.querySelectorAll('.month-toggle-btn.selected');
    if(!d || !m.length) return alert("Falta info");
    recurringSettings = { dayOfWeek: parseInt(d.dataset.day), months: Array.from(m).map(x=>({month:parseInt(x.dataset.month), year:parseInt(x.dataset.year)})) };
    document.getElementById('recurring-summary').textContent = `Repite los ${WEEKDAYS[recurringSettings.dayOfWeek]}`;
    document.getElementById('recurring-summary').classList.remove('is-hidden');
    document.getElementById('recurring-modal').classList.remove('is-open');
}

async function handleSaveRecurringBooking(btn) {
    // Implementación resumida pero funcional para batch
    const tn = document.getElementById('teamName').value.trim(), ci = document.querySelector('input[name="courtSelection"]:checked').value, sh = Array.from(document.getElementById('court-hours-list').querySelectorAll('.selected')).map(x=>parseInt(x.textContent));
    const batch = writeBatch(db);
    recurringSettings.months.forEach(m => {
        const dim = new Date(m.year, m.month+1, 0).getDate();
        for(let i=1; i<=dim; i++) {
            const d = new Date(m.year, m.month, i);
            if(d.getDay() === recurringSettings.dayOfWeek) {
                const ds = `${m.year}-${String(m.month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                batch.set(doc(collection(db, COLLECTIONS.BOOKINGS)), { teamName:tn, courtId:ci, day:ds, monthYear:ds.substring(0,7), courtHours:sh, totalPrice: updateTotalPrice(), paymentMethod: 'efectivo', timestamp: Timestamp.now(), type: 'court' });
            }
        }
    });
    await batch.commit(); closeModals(); showMessage("Recurrencia creada"); setTimeout(hideMessage, 2000);
}

// Sugerencias
async function handleTeamNameInput() {
    const v = document.getElementById('teamName').value.trim().toLowerCase(), c = document.getElementById('teamName-suggestions'); if(!c) return; if(v.length<2) { c.style.display='none'; return; }
    const s = await getDocs(query(collection(db, COLLECTIONS.CUSTOMERS), where(documentId(), ">=", v), where(documentId(), "<=", v + '\uf8ff')));
    c.innerHTML = ''; s.forEach(d => { const i = document.createElement('div'); i.className = 'p-3 hover:bg-emerald-50 cursor-pointer border-b font-bold text-sm'; i.textContent = d.data().name; i.onmousedown = () => { document.getElementById('teamName').value = d.data().name; c.style.display = 'none'; }; c.appendChild(i); });
    c.style.display = s.empty ? 'none' : 'block';
}

// Auxiliares Precios
function updateCourtAvailability() {
    const ds = document.getElementById('booking-date').value, ci = document.querySelector('input[name="courtSelection"]:checked')?.value || 'cancha1', bi = document.getElementById('booking-id').value;
    document.getElementById('costPerHour').value = (ci === 'cancha1') ? appSettings.court1Price : appSettings.court2Price;
    const occ = new Set(); allMonthBookings.filter(b => b.day === ds && b.courtId === ci && b.id !== bi).forEach(b => b.courtHours?.forEach(h => occ.add(h)));
    renderTimeSlots(document.getElementById('court-hours-list'), occ, []);
    updateTotalPrice();
}

function updateTotalPrice() {
    const ch = document.getElementById('court-hours-list')?.querySelectorAll('.time-slot.selected').length || 0, cp = parseFloat(document.getElementById('costPerHour').value) || 0;
    const ig = document.getElementById('rentGrill')?.checked, gh = document.getElementById('grill-hours-list')?.querySelectorAll('.time-slot.selected').length || 0, gp = parseFloat(document.getElementById('grillCost')?.value) || 0;
    const t = (ch * cp) + (ig ? gh * gp : 0);
    document.getElementById('booking-total').textContent = `$${t.toLocaleString('es-AR')}`;
    return t;
}

function updateEventTotalPrice() {
    const cost = parseFloat(document.getElementById('eventCostPerHour')?.value) || 0;
    const hours = document.getElementById('event-hours-list')?.querySelectorAll('.time-slot.selected').length || 0;
    const t = cost * hours;
    const disp = document.getElementById('event-total'); if(disp) disp.textContent = `$${t.toLocaleString()}`;
    return t;
}

console.log("Sistema Panza Verde cargado al 100%.");
