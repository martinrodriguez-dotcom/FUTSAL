// Importaciones de Firebase SDK (v11.x.x)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
    getDocs // ¡NUEVO! Necesario para consultas de un solo uso (Caja y Clientes)
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -----------------------------------------------------------------
// 1. CONFIGURACIÓN DE FIREBASE (¡TU CONFIGURACIÓN!)
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
const customersCollectionPath = "customers"; // Nueva colección para estadísticas

// --- VARIABLES GLOBALES DE LA APP ---
let db, auth, userId;
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = [];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- REFERENCIAS AL DOM ---
const calendarView = document.getElementById('calendar-view'); // Contenedor del calendario
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const bookingModal = document.getElementById('booking-modal');
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const bookingForm = document.getElementById('booking-form');
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');

// Nuevas referencias (Caja)
const menuBtn = document.getElementById('menu-btn');
const cajaView = document.getElementById('caja-view');
const cajaDailyList = document.getElementById('caja-daily-list');
const cajaTotal = document.getElementById('caja-total');
const dateFrom = document.getElementById('date-from');
const dateTo = document.getElementById('date-to');
const filterBtn = document.getElementById('filter-btn');
const cajaDetailModal = document.getElementById('caja-detail-modal');
const cajaDetailTitle = document.getElementById('caja-detail-title');
const cajaDetailContent = document.getElementById('caja-detail-content');
const closeCajaDetailBtn = document.getElementById('close-caja-detail-btn');

// Nuevas referencias (Sugerencias de Cliente)
const teamNameInput = document.getElementById('teamName');
const teamNameSuggestions = document.getElementById('teamName-suggestions');

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando App...");
    showMessage("Iniciando conexión...");
    setupEventListeners();
    registerServiceWorker();
    firebaseInit();
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.error('Error al registrar el Service Worker:', error);
        });
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
                console.log("Usuario autenticado:", userId);
                await loadBookingsForMonth(); // Carga el calendario
                hideMessage();
            } else {
                console.log("Sin usuario, intentando anónimo...");
                await signInAnonymously(auth);
            }
        });
    } catch (error) {
        console.error("Error crítico en Firebase Init:", error);
        showMessage(`Error de Conexión: ${error.message}`, true);
    }
}

function setupEventListeners() {
    // Calendario
    document.getElementById('prev-month-btn').onclick = prevMonth;
    document.getElementById('next-month-btn').onclick = nextMonth;
    
    // Formularios y Modales
    bookingForm.onsubmit = handleSaveBooking;
    document.getElementById('cancel-booking-btn').onclick = closeModals;
    document.getElementById('close-options-btn').onclick = closeModals;
    document.getElementById('close-view-btn').onclick = closeModals;
    document.getElementById('add-new-booking-btn').onclick = () => {
        const dateStr = optionsModal.dataset.date;
        closeModals();
        showBookingModal(dateStr);
    };

    // Nuevos Listeners (Caja)
    menuBtn.onclick = toggleCajaView;
    filterBtn.onclick = loadCajaData;
    closeCajaDetailBtn.onclick = closeModals;

    // Nuevos Listeners (Sugerencias de Cliente)
    teamNameInput.oninput = handleTeamNameInput; // Busca mientras se tipea
    teamNameInput.onblur = () => {
        // Pequeño delay para permitir que el clic en la sugerencia se registre
        setTimeout(() => {
            teamNameSuggestions.style.display = 'none';
        }, 200);
    };
    teamNameInput.onfocus = handleTeamNameInput; // Opcional: mostrar al enfocar

    // Cierre de modales
    [bookingModal, optionsModal, viewModal, cajaDetailModal].forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) closeModals();
        };
    });
}


// --- LÓGICA DE FIREBASE (RESERVAS) ---

async function loadBookingsForMonth() {
    // ... (sin cambios) ...
    if (!db || !userId) return;
    showMessage("Cargando reservas...");
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe();

    const monthYear = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    console.log(`Cargando datos para: ${monthYear}`);

    const bookingsCollection = collection(db, bookingsCollectionPath);
    const q = query(bookingsCollection, where("monthYear", "==", monthYear));

    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
        hideMessage();
    }, (error) => {
        console.error("Error al obtener reservas (onSnapshot):", error);
        showMessage(`Error al cargar datos: ${error.message}`, true);
    });
}

async function handleSaveBooking(event) {
    event.preventDefault();
    showMessage("Guardando...");

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value; // Cliente

    const bookingData = {
        teamName: teamName,
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        hoursCount: parseInt(document.getElementById('hoursCount').value, 10),
        costPerHour: parseFloat(document.getElementById('costPerHour').value),
        rentGrill: document.getElementById('rentGrill').checked,
        grillCost: parseFloat(document.getElementById('grillCost').value),
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        userId: userId,
        // ¡NUEVO! Guardar método de pago
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value
    };

    try {
        if (bookingId) {
            const docRef = doc(db, bookingsCollectionPath, bookingId);
            await setDoc(docRef, bookingData, { merge: true });
            console.log("Reserva actualizada:", bookingId);
        } else {
            const bookingsCollection = collection(db, bookingsCollectionPath);
            const docRef = await addDoc(bookingsCollection, bookingData);
            console.log("Reserva creada:", docRef.id);
        }
        
        // ¡NUEVO! Guardar/actualizar cliente para estadísticas
        await saveCustomer(teamName);
        
        closeModals();
        hideMessage();
    } catch (error) {
        console.error("Error al guardar reserva:", error);
        showMessage(`Error al guardar: ${error.message}`, true);
    }
}

async function handleDeleteBooking(bookingId) {
    // ... (sin cambios) ...
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta reserva?")) return;
    
    showMessage("Eliminando...");
    try {
        const docRef = doc(db, bookingsCollectionPath, bookingId);
        await deleteDoc(docRef);
        console.log("Reserva eliminada:", bookingId);
        closeModals();
        hideMessage();
    } catch (error) {
        console.error("Error al eliminar reserva:", error);
        showMessage(`Error al eliminar: ${error.message}`, true);
    }
}

// --- LÓGICA DE FIREBASE (CLIENTES) ---

/**
 * Guarda o actualiza un cliente en la colección 'customers'
 * Usa el nombre del cliente como ID del documento para evitar duplicados.
 */
async function saveCustomer(name) {
    if (!name || name.trim() === '') return;
    
    try {
        // Usamos el nombre (en minúsculas) como ID único
        const customerId = name.trim().toLowerCase();
        const docRef = doc(db, customersCollectionPath, customerId);
        
        // setDoc con merge:true actualiza si existe, o crea si no.
        await setDoc(docRef, { 
            name: name.trim(), // Guardamos el nombre con mayúsculas/minúsculas original
            lastBooked: new Date().toISOString()
        }, { merge: true });
        
        console.log("Cliente guardado/actualizado:", customerId);
    } catch (error) {
        console.error("Error al guardar cliente:", error);
        // No mostramos error al usuario, es una tarea de fondo
    }
}

/**
 * Busca clientes mientras el usuario tipea
 */
async function handleTeamNameInput() {
    const queryText = teamNameInput.value.trim().toLowerCase();
    
    if (queryText.length < 2) { // No buscar hasta tener al menos 2 caracteres
        teamNameSuggestions.style.display = 'none';
        return;
    }

    try {
        // Busca clientes cuyo ID (nombre en minúsculas) comience con el texto
        const customersRef = collection(db, customersCollectionPath);
        const q = query(customersRef, 
            where(doc(db, customersCollectionPath, queryText).id, ">=", queryText),
            where(doc(db, customersCollectionPath, queryText).id, "<=", queryText + '\uf8ff')
        );

        const snapshot = await getDocs(q);
        const suggestions = snapshot.docs.map(doc => doc.data().name); // Obtenemos el nombre original
        renderSuggestions(suggestions);
    } catch (error) {
        console.error("Error al buscar clientes:", error);
    }
}

/**
 * Muestra la lista de sugerencias de clientes
 */
function renderSuggestions(suggestions) {
    teamNameSuggestions.innerHTML = '';
    if (suggestions.length === 0) {
        teamNameSuggestions.style.display = 'none';
        return;
    }

    suggestions.forEach(name => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = name;
        // Evento 'onmousedown' se dispara antes que 'onblur'
        item.onmousedown = () => selectSuggestion(name);
        teamNameSuggestions.appendChild(item);
    });

    teamNameSuggestions.style.display = 'block';
}

/**
 * Rellena el input al seleccionar una sugerencia
 */
function selectSuggestion(name) {
    teamNameInput.value = name;
    teamNameSuggestions.style.display = 'none';
}


// --- LÓGICA DEL CALENDARIO ---
// ... (sin cambios en renderCalendar, createDayCell, handleDayClick) ...
function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const bookingsCountByDay = {};
    allMonthBookings.forEach(booking => {
        const day = parseInt(booking.day.split('-')[2], 10);
        bookingsCountByDay[day] = (bookingsCountByDay[day] || 0) + 1;
    });
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarGrid.appendChild(createDayCell(daysInPrevMonth - firstDayOfMonth + 1 + i, false));
    }
    for (let i = 1; i <= daysInMonth; i++) {
        calendarGrid.appendChild(createDayCell(i, true, bookingsCountByDay[i] || 0));
    }
    const totalCells = firstDayOfMonth + daysInMonth;
    const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
        calendarGrid.appendChild(createDayCell(i, false));
    }
}
function createDayCell(dayNum, isCurrentMonth, bookingCount = 0) {
    const dayCell = document.createElement('div');
    dayCell.className = `relative h-20 md:h-28 border border-gray-200 rounded-lg p-2 shadow-sm transition-all duration-200`;
    if (isCurrentMonth) {
        const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        dayCell.classList.add('bg-white', 'cursor-pointer', 'hover:bg-emerald-50');
        dayCell.dataset.date = dateStr;
        dayCell.onclick = () => handleDayClick(dateStr);
        dayCell.innerHTML = `<span class="text-sm font-medium text-gray-700">${dayNum}</span>`;
        if (bookingCount > 0) {
            const countBadge = document.createElement('span');
            countBadge.textContent = bookingCount > 9 ? '9+' : bookingCount;
            countBadge.className = 'booking-count';
            dayCell.appendChild(countBadge);
        }
    } else {
        dayCell.classList.add('other-month-day');
        dayCell.innerHTML = `<span class="text-sm">${dayNum}</span>`;
    }
    return dayCell;
}
function handleDayClick(dateStr) {
    const bookingsOnDay = allMonthBookings.filter(b => b.day === dateStr);
    if (bookingsOnDay.length === 0) {
        showBookingModal(dateStr);
    } else {
        showOptionsModal(dateStr, bookingsOnDay);
    }
}


// --- LÓGICA DE MODALES (RESERVAS) ---
// ... (actualizado para resetear el método de pago) ...
function showBookingModal(dateStr, bookingToEdit = null) {
    closeModals();
    bookingForm.reset();
    document.getElementById('booking-date').value = dateStr;
    // Asegurar que 'efectivo' esté marcado por defecto al crear
    document.querySelector('input[name="paymentMethod"][value="efectivo"]').checked = true;

    if (bookingToEdit) {
        document.getElementById('booking-modal-title').textContent = "Editar Reserva";
        document.getElementById('booking-id').value = bookingToEdit.id;
        document.getElementById('teamName').value = bookingToEdit.teamName;
        document.getElementById('peopleCount').value = bookingToEdit.peopleCount;
        document.getElementById('hoursCount').value = bookingToEdit.hoursCount;
        document.getElementById('costPerHour').value = bookingToEdit.costPerHour;
        document.getElementById('rentGrill').checked = bookingToEdit.rentGrill;
        document.getElementById('grillCost').value = bookingToEdit.grillCost;
        // Marcar el método de pago guardado
        const paymentMethod = bookingToEdit.paymentMethod || 'efectivo';
        document.querySelector(`input[name="paymentMethod"][value="${paymentMethod}"]`).checked = true;
    } else {
        document.getElementById('booking-modal-title').textContent = `Reservar Turno (${dateStr})`;
        document.getElementById('booking-id').value = '';
    }
    bookingModal.classList.add('is-open');
}
// ... (showOptionsModal y showViewModal sin cambios significativos) ...
function showOptionsModal(dateStr, bookingsOnDay) {
    closeModals();
    optionsModal.dataset.date = dateStr;
    const listEl = document.getElementById('daily-bookings-list');
    listEl.innerHTML = '';
    if (bookingsOnDay.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500">No hay reservas para este día.</p>';
    }
    bookingsOnDay.forEach(booking => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center';
        itemEl.innerHTML = `<span class="font-medium text-gray-800">${booking.teamName}</span>`;
        const buttonsEl = document.createElement('div');
        buttonsEl.className = 'flex gap-2';
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'Ver';
        viewBtn.className = 'px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200';
        viewBtn.onclick = () => showViewModal(booking);
        buttonsEl.appendChild(viewBtn);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.className = 'px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200';
        editBtn.onclick = () => showBookingModal(dateStr, booking);
        buttonsEl.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.className = 'px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-md hover:bg-red-200';
        deleteBtn.onclick = () => handleDeleteBooking(booking.id);
        buttonsEl.appendChild(deleteBtn);
        itemEl.appendChild(buttonsEl);
        listEl.appendChild(itemEl);
    });
    optionsModal.classList.add('is-open');
}
function showViewModal(booking) {
    closeModals();
    const detailsEl = document.getElementById('view-booking-details');
    const totalCancha = (booking.costPerHour || 0) * (booking.hoursCount || 0);
    const totalParrilla = booking.rentGrill ? (booking.grillCost || 0) : 0;
    const totalFinal = totalCancha + totalParrilla;

    detailsEl.innerHTML = `
        <p><strong>Equipo:</strong> ${booking.teamName}</p>
        <p><strong>Personas:</strong> ${booking.peopleCount}</p>
        <p><strong>Horas:</strong> ${booking.hoursCount}</p>
        <p><strong>Método Pago:</strong> <span style="text-transform: capitalize;">${booking.paymentMethod || 'N/A'}</span></p>
        <hr class="my-2">
        <p><strong>Subtotal Cancha:</strong> $${totalCancha.toLocaleString('es-AR')}</p>
        <p><strong>Subtotal Parrilla:</strong> $${totalParrilla.toLocaleString('es-AR')}</p>
        <p class="text-lg font-bold mt-2"><strong>Total Pagado:</strong> $${totalFinal.toLocaleString('es-AR')}</p>
    `;
    viewModal.classList.add('is-open');
}

/**
 * Cierra TODOS los modales
 */
function closeModals() {
    bookingModal.classList.remove('is-open');
    optionsModal.classList.remove('is-open');
    viewModal.classList.remove('is-open');
    cajaDetailModal.classList.remove('is-open'); // ¡NUEVO!
}


// --- LÓGICA DE NAVEGACIÓN (CALENDARIO) ---
// ... (sin cambios en prevMonth, nextMonth) ...
function prevMonth() {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    loadBookingsForMonth();
}
function nextMonth() {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    loadBookingsForMonth();
}

// --- LÓGICA DE NAVEGACIÓN (VISTA DE CAJA) ---

/**
 * Muestra u oculta la vista de Gestión de Caja
 */
function toggleCajaView() {
    const isHidden = cajaView.style.display === 'none';
    if (isHidden) {
        // Mostrar vista de Caja
        cajaView.style.display = 'block';
        calendarView.classList.add('is-hidden'); // Ocultar calendario
        // Cargar datos de caja al abrir
        loadCajaData(); 
    } else {
        // Ocultar vista de Caja
        cajaView.style.display = 'none';
        calendarView.classList.remove('is-hidden'); // Mostrar calendario
    }
}

/**
 * Carga y procesa los datos para la vista de Caja
 */
async function loadCajaData() {
    if (!db) return;
    showMessage("Cargando datos de caja...");
    
    try {
        let q = query(collection(db, bookingsCollectionPath));
        
        // Aplicar filtros de fecha si existen
        const from = dateFrom.value;
        const to = dateTo.value;
        
        if (from) {
            q = query(q, where("day", ">=", from));
        }
        if (to) {
            q = query(q, where("day", "<=", to));
        }
        
        // ¡¡¡IMPORTANTE!!! Esta consulta PUEDE REQUERIR UN ÍNDICE en Firestore
        // Si falla, la consola mostrará un error con un enlace para crear el índice.

        const snapshot = await getDocs(q);
        
        let grandTotal = 0;
        const dailyTotals = {};

        snapshot.docs.forEach(doc => {
            const booking = doc.data();
            const total = (booking.costPerHour || 0) * (booking.hoursCount || 0) + 
                          (booking.rentGrill ? (booking.grillCost || 0) : 0);
            
            grandTotal += total;
            const day = booking.day;
            const paymentMethod = booking.paymentMethod || 'efectivo';

            if (!dailyTotals[day]) {
                dailyTotals[day] = { total: 0, efectivo: 0, transferencia: 0, mercadopago: 0 };
            }
            
            dailyTotals[day].total += total;
            if (dailyTotals[day][paymentMethod] !== undefined) {
                dailyTotals[day][paymentMethod] += total;
            }
        });

        cajaTotal.textContent = `$${grandTotal.toLocaleString('es-AR')}`;
        renderCajaList(dailyTotals);
        hideMessage();

    } catch (error) {
        console.error("Error al cargar datos de caja:", error);
        showMessage(`Error: ${error.message}. Es posible que necesites crear un índice en Firestore.`, true);
    }
}

/**
 * Renderiza la lista de días en la vista de Caja
 */
function renderCajaList(dailyTotals) {
    cajaDailyList.innerHTML = '';
    
    // Ordenar días por fecha, del más reciente al más antiguo
    const sortedDays = Object.keys(dailyTotals).sort((a, b) => b.localeCompare(a));
    
    if (sortedDays.length === 0) {
        cajaDailyList.innerHTML = '<p class="text-gray-500 text-center">No hay reservas en el rango seleccionado.</p>';
        return;
    }

    sortedDays.forEach(day => {
        const data = dailyTotals[day];
        const item = document.createElement('div');
        item.className = 'caja-day-item';
        
        // Formatear fecha (opcional, pero queda mejor)
        const [year, month, dayNum] = day.split('-');
        const displayDate = `${dayNum}/${month}/${year}`;

        item.innerHTML = `
            <span class="font-medium text-gray-800">${displayDate}</span>
            <strong class="text-lg text-emerald-600">$${data.total.toLocaleString('es-AR')}</strong>
        `;
        
        item.onclick = () => showCajaDetail(displayDate, data);
        cajaDailyList.appendChild(item);
    });
}

/**
 * Muestra el modal de detalle de caja para un día
 */
function showCajaDetail(displayDate, data) {
    cajaDetailTitle.textContent = `Detalle: ${displayDate}`;
    
    cajaDetailContent.innerHTML = `
        <p class="flex justify-between"><span>Efectivo:</span> <strong>$${data.efectivo.toLocaleString('es-AR')}</strong></p>
        <p class="flex justify-between"><span>Transferencia:</span> <strong>$${data.transferencia.toLocaleString('es-AR')}</strong></p>
        <p class="flex justify-between"><span>Mercado Pago:</span> <strong>$${data.mercadopago.toLocaleString('es-AR')}</strong></p>
        <hr class="my-3">
        <p class="flex justify-between text-lg font-bold"><span>Total Día:</span> <strong>$${data.total.toLocaleString('es-AR')}</strong></p>
    `;
    
    cajaDetailModal.classList.add('is-open');
}


// --- UTILIDADES (MENSAJES) ---
// ... (sin cambios en showMessage, hideMessage) ...
function showMessage(msg, isError = false) {
    messageText.textContent = msg;
    messageText.className = isError ? 'text-xl font-semibold text-red-600' : 'text-xl font-semibold text-gray-700';
    messageOverlay.classList.add('is-open');
}
function hideMessage() {
    messageOverlay.classList.remove('is-open');
}
