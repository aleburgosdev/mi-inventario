/* =========================================================
   LÓGICA DEL ASISTENTE VIRTUAL Y ALERTAS (js/bot.js)
   Depende del objeto global 'state' definido en app.js
   ========================================================= */

let isChatbotVisible = false;
let initialAlertShown = false;

// --- UTILERÍA DE CHAT Y UI ---

function toggleChatbot() {
  isChatbotVisible = !isChatbotVisible;
  const widget = document.getElementById('chatbot-widget');
  widget.style.display = isChatbotVisible ? 'flex' : 'none';
  
  if(isChatbotVisible) {
    setTimeout(() => document.getElementById('chatbot-input').focus(), 100);
  }
}

function closeCriticalModal() {
  const modal = document.getElementById('critical-alert-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Asegurar que el chatbot mantenga su estado después de cerrar el modal
  const trigger = document.getElementById('chatbot-trigger');
  const widget = document.getElementById('chatbot-widget');
  
  // Si el usuario está logueado y el chatbot debería estar visible, lo mostramos
  const isUserLoggedIn = (typeof isLoggedIn !== 'undefined' && isLoggedIn === true);
  if (isUserLoggedIn) {
    if (trigger) {
      trigger.style.display = 'flex';
    }
    if (widget && isChatbotVisible) {
      widget.style.display = 'flex';
    }
  }
}

function addMessage(text, sender) {
  const container = document.getElementById('chatbot-messages');
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  // CONVIERTE \n A <br> Y **texto** A NEGRITAS (Crucial para el Reporte Completo)
  div.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function handleChat() {
  const inputEl = document.getElementById('chatbot-input');
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  inputEl.value = '';

  setTimeout(() => {
    const response = generateBotResponse(text.toLowerCase());
    addMessage(response, 'bot');
  }, 400);
}


// --- FUNCIONES DE ALERTA ---

function showCriticalModal(stockCount, enviosCount) {
  const modal = document.getElementById('critical-alert-modal');
  const body = document.getElementById('critical-body');
  
  if (!modal || !body) return;
  
  let html = '<p>Se han detectado situaciones que requieren atención:</p><ul style="margin-top:10px; padding-left:20px;">';
  if (stockCount > 0) html += `<li style="margin-bottom:8px; color:#d32f2f;"><strong>📉 Stock Crítico:</strong> ${stockCount} productos.</li>`;
  if (enviosCount > 0) html += `<li style="margin-bottom:8px; color:#f57c00;"><strong>🚚 Envíos Pendientes:</strong> ${enviosCount} paquetes.</li>`;
  html += '</ul><p style="margin-top:10px; font-size:13px; color:#666;">El asistente virtual te puede dar más detalles.</p>';
  
  body.innerHTML = html;
  
  // Mostrar el modal SIN afectar la visibilidad del chatbot
  modal.style.display = 'flex';
  
  // Asegurar que el chatbot mantenga su estado actual
  const trigger = document.getElementById('chatbot-trigger');
  const widget = document.getElementById('chatbot-widget');
  
  if (trigger && isChatbotVisible) {
    trigger.style.display = 'flex';
  }
  if (widget && isChatbotVisible) {
    widget.style.display = 'flex';
  }
}


// En js/bot.js, modifica checkCriticalAlerts()

function checkCriticalAlerts() {
// ESTA ES LA VERIFICACIÓN DE SEGURIDAD MÁXIMA
    const isUserLoggedIn = (typeof isLoggedIn !== 'undefined' && isLoggedIn === true);
    
    if (!isUserLoggedIn) {
        // Si la sesión no está confirmada, solo ocultamos el badge, NO el chatbot completo
        const badge = document.getElementById('chatbot-badge');
        if (badge) badge.style.display = 'none';
        return; 
    }
  
  // Si llegamos aquí, el usuario está logueado (isUserLoggedIn === true)
  if (typeof state === 'undefined') return;

  const STOCK_MINIMO = 3;
  const lowStockItems = Object.values(state.productos || {}).filter(p => (p.stock || 0) <= STOCK_MINIMO);
  const pendingEnvios = (state.envios || []).filter(e => e.estado === 'Pendiente');
  const totalAlerts = lowStockItems.length + pendingEnvios.length;
  
  const badge = document.getElementById('chatbot-badge');
  if (badge) {
    if (totalAlerts > 0) {
      badge.style.display = 'flex';
      badge.innerText = totalAlerts > 9 ? '9+' : totalAlerts;
    } else {
      badge.style.display = 'none';
    }
  }

  // Mostrar POPUP Crítico solo si hay alertas Y NO se ha mostrado antes.
  // La condición de estar logueado se cumple al inicio de la función.
  if (totalAlerts > 0 && !initialAlertShown) {
    showCriticalModal(lowStockItems.length, pendingEnvios.length);
    initialAlertShown = true;
  }
}
// --- FUNCIONES DE ANÁLISIS DE DATOS ---

// 1. Stock Bajo
function analyzeLowStock() {
  const lowStockThreshold = 3; 
  const lowStockProducts = Object.values(state.productos || {}).filter(p => (p.stock || 0) <= lowStockThreshold);
  
  if (lowStockProducts.length > 0) {
    const list = lowStockProducts.map(p => `• ${p.name} (SKU: ${p.sku}) - Stock: ${p.stock}`).join('\n');
    return `⚠️ **${lowStockProducts.length} productos** con stock bajo (≤ ${lowStockThreshold}):\n${list}\nRevisa la sección "Productos" o "Pedidos".`;
  }
  return "✅ No se detectaron productos con stock bajo. ¡Inventario OK!";
}

// 2. Envíos Pendientes
function analyzePendingShipments() {
  const pendingEnvios = (state.envios || []).filter(e => e.estado === 'Pendiente');
  
  if (pendingEnvios.length > 0) {
    const list = pendingEnvios.map(e => `• Cliente: ${e.cliente || 'N/A'} - Producto: ${e.producto || 'N/A'}`).join('\n');
    return `🚚 Tienes **${pendingEnvios.length} envíos pendientes** de procesar:\n${list}\nRevisa la sección "Envíos".`;
  }
  return "✅ No hay envíos pendientes. ¡Todo entregado!";
}

// 3. Resumen de Ventas
function getSalesSummary() {
  const totalSalesCount = (state.sales || []).length;
  const totalIngresos = (state.sales || []).reduce((acc, s) => acc + ((s.price * s.qty) || 0), 0);
  const totalGanancia = (state.sales || []).reduce((acc, s) => acc + (s.profit || 0), 0);
  
  return `📈 **Resumen de Ventas**:\n• Total de transacciones: ${totalSalesCount}\n• Ingresos Brutos: ARS ${totalIngresos.toFixed(2)}\n• Ganancia Neta Estimada: ARS ${totalGanancia.toFixed(2)}`;
}


function updateStock() {
  syncAllProductsWithWooImproved()
  return `Stock actualizado con woocommerce`;
}
function ayudaP() {

  return `Los productos creados con imagenes  desde el inventario  se suben a woocommerce
  sin imagenes. Woocommerce crea los productos con imagenes en una URl, como la app no utiliza 
  un sevidor para alojar imagenes,archivos, etc se suben sin imagenes. La razón que no  no funcionan con servidor
  de alojamiento es por el costo y hacer mas accesible la app para los usuarios. Deberán  agregar las imagenes
  manualmente desde Productos de woocommerce. ---El producto se crea sin imagenes en el inventario---`;
}
// 4. Resumen de Tickets
function getTicketsSummary() {
  const totalTickets = (state.tickets || []).length;
  return `🧾 Tienes **${totalTickets} tickets** guardados en el sistema.`;
}

// 5. Reporte Ejecutivo Completo (Inventario Completo)
function renderFullReport() {
    // Asegurarse de que 'state' esté disponible, si no, retornar error
    if (typeof state === 'undefined') {
        return "❌ Error: La aplicación no ha terminado de cargar los datos (state). Intenta en unos segundos.";
    }

    // 1. Datos de Stock
    const totalProducts = Object.values(state.productos || {}).length;
    const totalStockUnits = Object.values(state.productos || {}).reduce((sum, p) => sum + (p.stock || 0), 0);
    const lowStockCount = Object.values(state.productos || {}).filter(p => (p.stock || 0) <= 3).length;

    // 2. Datos de Ventas y Ganancias
    const totalSalesCount = (state.sales || []).length;
    const totalProfit = (state.sales || []).reduce((acc, s) => acc + (s.profit || 0), 0);
    const totalRevenue = (state.sales || []).reduce((acc, s) => acc + ((s.price * s.qty) || 0), 0);

    // 3. Datos de Envíos
    const pendingEnviosCount = (state.envios || []).filter(e => e.estado === 'Pendiente').length;
    const totalEnviosCount = (state.envios || []).length;

    // 4. Construir el Reporte (Usa \n para que addMessage lo convierta a <br>)
    let report = `
📈 **REPORTE EJECUTIVO COMPLETO** 📊
---

### 📦 Inventario & Stock
• **Total de Productos Únicos:** ${totalProducts}
• **Unidades Totales en Stock:** ${totalStockUnits} unidades.
• **Stock Bajo/Crítico:** ⚠️ ${lowStockCount} productos necesitan reposición.

### 💰 Ventas & Finanzas
• **Ganancia Neta Estimada (Profit):** **ARS ${totalProfit.toFixed(2)}**
• **Ingreso Bruto Total:** ARS ${totalRevenue.toFixed(2)}
• **Transacciones Realizadas:** ${totalSalesCount}

### 🚚 Logística & Envíos
• **Total de Envíos Registrados:** ${totalEnviosCount}
• **Envíos Pendientes:** 🚨 ${pendingEnviosCount} envíos esperan ser despachados.

---
*Para ver gráficos interactivos, utiliza la pestaña **Dashboard**.*
`;
    return report.trim();
}


// ----------------------------------------------------------------------
// 🧠 CEREBRO DEL CHATBOT: Centraliza las acciones
function generateBotResponse(input) {
  
  const actionMap = {
    'stock bajo': analyzeLowStock,
    'stock': analyzeLowStock,
    
    'envio': analyzePendingShipments,
    'envios': analyzePendingShipments,
    'pendiente': analyzePendingShipments,
    
    'venta': getSalesSummary,
    'ventas': getSalesSummary,
    'ganancia': getSalesSummary,
    
    'ticket': getTicketsSummary,
    'tickets': getTicketsSummary,
    'recibo': getTicketsSummary,
    
    'inventario completo': renderFullReport,
    'inventario': renderFullReport,
    'reporte': renderFullReport,
    // --- NUEVA OPCIÓN DE ALERTA ---
    'alertas': checkAndShowAlerts,
    'alertas criticas': checkAndShowAlerts,
    'mostrar alertas': checkAndShowAlerts,

    'reordenar': analyzeReorderSuggestions,
    'pedidos': analyzeReorderSuggestions,
    'sugerencias': analyzeReorderSuggestions,
    'predecir stock': analyzeReorderSuggestions,

    'actualizar': updateStock,
    'actualizar stock': updateStock,

    'ayuda con productos': ayudaP,
    'imagenes de productos': ayudaP,
    'imagenes': ayudaP,
    'productos con imagenes': ayudaP,
    
  };

  let responseFunction = null;

  // Busca el keyword más específico que coincida
  for (const keyword in actionMap) {
    if (input.includes(keyword)) {
      responseFunction = actionMap[keyword];
      if (input.trim() === keyword) break; // Si coincide exactamente, usa esa
    }
  }
  
  if (responseFunction) {
    return responseFunction();
  }
  
  // Mensajes de ayuda/bienvenida
 if (input.includes('hola') || input.includes('ayuda') || input.includes('que haces')) {
    return "¡Hola! Soy tu Asistente. Puedes preguntar sobre:\n" +
           "• **Alertas Críticas**\n" +
           "• **Stock bajo**\n" +
           "• **Envíos**\n" +
           "• **predecir stock**\n" +
           "• **sugerencias**\n" +
           "• **reordenar**\n" +
           "• **Imagenes - productos**\n" +
           "• **actualizar stock con woocommerce**\n" +
           "• **Inventario completo**"
           
  }
// En js/bot.js, dentro de generateBotResponse:

 
// ...
  // Respuesta por defecto
  return "🤔 Lo siento, no entendí tu solicitud. Por favor, sé específico: **Stock bajo**, **Envíos pendientes**, **Alertas**, **actualizar stock con woocommerce**, **Imagenes - productos**, **Envíos**, **Ventas** o **Inventario completo**.";
}

// En js/bot.js, después de checkCriticalAlerts()

/**
 * Función que chequea el estado y muestra el modal de alerta si hay pendientes.
 * Se usa cuando el usuario lo solicita explícitamente.
 */
function checkAndShowAlerts() {
    if (typeof state === 'undefined') {
        return "❌ Error: La aplicación no ha cargado los datos (state).";
    }

    const STOCK_MINIMO = 3;
    const lowStockItems = Object.values(state.productos || {}).filter(p => (p.stock || 0) <= STOCK_MINIMO);
    const pendingEnvios = (state.envios || []).filter(e => e.estado === 'Pendiente');
    const totalAlerts = lowStockItems.length + pendingEnvios.length;

    if (totalAlerts > 0) {
        // Llama a la función que dibuja el modal (lo muestra aunque ya se haya mostrado antes)
        showCriticalModal(lowStockItems.length, pendingEnvios.length); 
        
        // Además de mostrar el modal, el bot da un resumen en el chat:
        return `⚠️ **ALERTA REQUERIDA:** Se han detectado ${totalAlerts} tareas críticas.
               \nSe ha abierto la ventana de Alerta Crítica en el centro de la pantalla.`;
    } else {
        return "✅ No hay alertas críticas de stock o envíos pendientes en este momento. ¡Todo bajo control!";
    }
}

// En js/bot.js, agrega estas dos nuevas funciones de control:

function hideChatbot() {
    const trigger = document.getElementById('chatbot-trigger');
    const widget = document.getElementById('chatbot-widget');
    
    // Ocultar el botón del chatbot
    if (trigger) {
        trigger.style.display = 'none';
    }
    
    // Ocultar el widget del chatbot y resetear estado
    if (widget) {
        widget.style.display = 'none';
    }
    
    // Resetear el estado de visibilidad
    isChatbotVisible = false;
    
    console.log('🤖 Chatbot: Ocultado completamente');
}

function showChatbot() {
    const trigger = document.getElementById('chatbot-trigger');
    const widget = document.getElementById('chatbot-widget');
    
    // ✅ FUNCIÓN MEJORADA: Mostrar chatbot SOLO si el usuario está logueado
    const isUserLoggedIn = (typeof isLoggedIn !== 'undefined' && isLoggedIn === true);
    
    if (!isUserLoggedIn) {
        console.log('🤖 Chatbot: Usuario no logueado, no se muestra');
        return;
    }
    
    // Mostrar el botón del chatbot
    if (trigger) {
        trigger.style.display = 'flex';
        console.log('🤖 Chatbot: Botón mostrado');
    }
    
    // Si el chatbot estaba visible anteriormente, mantenerlo visible
    // Si nunca se ha mostrado, mantener el estado actual
    if (widget) {
        if (isChatbotVisible) {
            widget.style.display = 'flex';
            console.log('🤖 Chatbot: Widget mostrado (estado anterior)');
        }
        // Si nunca se ha mostrado, no cambiar el estado (permanece oculto hasta que el usuario lo abra)
    }
    
    console.log('🤖 Chatbot: Función showChatbot() ejecutada, usuario logueado:', isUserLoggedIn);
}

// En js/bot.js, agrega esta función de análisis de sugerencias

function analyzeReorderSuggestions() {
    // Asumimos que state.reorderSuggestions ya fue llenado por app.js
    const suggestions = state.reorderSuggestions || {};
    const count = Object.keys(suggestions).length;

    if (count === 0) {
        return "✨ No hay productos con riesgo de agotamiento inminente (menos de 30 días de stock proyectado). ¡Buen control!";
    }

    let msg = `🚨 **${count} productos** necesitan ser reordenados pronto según la proyección de ventas:\n`;
    
    // Mostrar hasta 5 sugerencias principales
    Object.values(suggestions).slice(0, 5).forEach(s => {
        msg += `\n• ${s.name}: 
                  Stock: ${s.stock} un. | Restan: **${s.daysRemaining} días**
                  Sugerencia de Pedido: **${s.reorderQty} un.**`;
    });
    
    if (count > 5) msg += `\n...y ${count - 5} sugerencias más.`;
    msg += `\n\nRevisa la pestaña "Pedidos" para iniciar el proceso de compra.`;
    
    return msg;
}