/* Google Apps Script backend для каталога/остатков/заказов/отзывов.
 *
 * Развертывание: Apps Script → Deploy → Web app → Anyone.
 * Данные хранятся в привязанной Google Sheet (SpreadsheetApp.getActive()).
 *
 * GET (JSONP):
 *   ?action=catalog&callback=cb
 *
 * POST (form-url-encoded):
 *   action=order&payload={...}
 *   action=review&payload={...}
 */

const OWNER_EMAIL = "lesnikovmn@gmail.com";

const SHEETS = {
  PRODUCTS: "Products",
  STOCK: "Stock",
  ORDERS: "Orders",
  ORDER_ITEMS: "OrderItems",
  REVIEWS: "Reviews",
};

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, SHEETS.PRODUCTS, [
    "id",
    "slug",
    "name",
    "category",
    "description",
    "price_rub",
    "currency",
    "color",
    "height_cm",
    "bloom_type",
    "is_active",
    "is_new",
    "popularity",
    "image_url",
    "updated_at",
  ]);
  ensureSheet_(ss, SHEETS.STOCK, ["product_id", "quantity", "low_stock_threshold", "updated_at"]);
  ensureSheet_(ss, SHEETS.ORDERS, [
    "order_id",
    "created_at",
    "status",
    "customer_name",
    "email",
    "phone",
    "address",
    "comment",
    "subtotal_rub",
    "discount_rub",
    "total_rub",
    "items_json",
  ]);
  ensureSheet_(ss, SHEETS.ORDER_ITEMS, [
    "order_id",
    "product_id",
    "product_name",
    "price_rub",
    "qty",
    "line_total_rub",
  ]);
  ensureSheet_(ss, SHEETS.REVIEWS, [
    "review_id",
    "created_at",
    "status",
    "product_id",
    "author_name",
    "author_email",
    "rating",
    "text",
  ]);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "catalog";
  const callback = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : "";

  if (action !== "catalog") {
    return jsonp_(callback, { ok: false, error: "Unknown action" });
  }

  const ss = SpreadsheetApp.getActive();
  const products = readSheetObjects_(ss.getSheetByName(SHEETS.PRODUCTS));
  const stockRows = readSheetObjects_(ss.getSheetByName(SHEETS.STOCK));

  const stockById = {};
  for (var i = 0; i < stockRows.length; i++) {
    var r = stockRows[i];
    if (!r.product_id) continue;
    stockById[String(r.product_id)] = {
      quantity: toNumber_(r.quantity),
      low_stock_threshold: toNumber_(r.low_stock_threshold),
      updated_at: r.updated_at || "",
    };
  }

  return jsonp_(callback, {
    ok: true,
    products: products.map(normalizeProduct_),
    stockById: stockById,
  });
}

function doPost(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "";
  const payloadRaw = (e && e.parameter && e.parameter.payload) ? String(e.parameter.payload) : "";

  if (!action || !payloadRaw) {
    return html_("Bad request");
  }

  var payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (err) {
    return html_("Invalid JSON");
  }

  if (action === "order") return handleOrder_(payload);
  if (action === "review") return handleReview_(payload);

  return html_("Unknown action");
}

function handleOrder_(payload) {
  const ss = SpreadsheetApp.getActive();
  const ordersSheet = ss.getSheetByName(SHEETS.ORDERS);
  const itemsSheet = ss.getSheetByName(SHEETS.ORDER_ITEMS);
  const stockSheet = ss.getSheetByName(SHEETS.STOCK);

  const now = new Date();
  const orderId = "ORD-" + Utilities.getUuid();

  const items = Array.isArray(payload.items) ? payload.items : [];
  const subtotal = toNumber_(payload.subtotal_rub);
  const discount = toNumber_(payload.discount_rub);
  const total = toNumber_(payload.total_rub);

  // Пишем заказ
  appendRowByHeaders_(ordersSheet, {
    order_id: orderId,
    created_at: now.toISOString(),
    status: "new",
    customer_name: safe_(payload.customer_name),
    email: safe_(payload.email),
    phone: safe_(payload.phone),
    address: safe_(payload.address),
    comment: safe_(payload.comment),
    subtotal_rub: subtotal,
    discount_rub: discount,
    total_rub: total,
    items_json: JSON.stringify(items),
  });

  // Пишем позиции + уменьшаем остатки
  const stockById = indexStock_(stockSheet);

  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var productId = String(it.product_id || "");
    if (!productId) continue;

    appendRowByHeaders_(itemsSheet, {
      order_id: orderId,
      product_id: productId,
      product_name: safe_(it.product_name),
      price_rub: toNumber_(it.price_rub),
      qty: toNumber_(it.qty),
      line_total_rub: toNumber_(it.line_total_rub),
    });

    // Обновление остатков (если есть строка)
    if (stockById[productId]) {
      var rowIndex = stockById[productId].rowIndex; // 1-based
      var currentQty = stockById[productId].quantity;
      var nextQty = Math.max(0, currentQty - toNumber_(it.qty));
      setCellByHeader_(stockSheet, rowIndex, "quantity", nextQty);
      setCellByHeader_(stockSheet, rowIndex, "updated_at", now.toISOString());
    }
  }

  // Письмо владельцу
  const subject = "Новый заказ: " + orderId;
  const body =
    "Заказ: " + orderId + "\n" +
    "Имя: " + safe_(payload.customer_name) + "\n" +
    "Email: " + safe_(payload.email) + "\n" +
    "Телефон: " + safe_(payload.phone) + "\n" +
    "Адрес: " + safe_(payload.address) + "\n" +
    "Комментарий: " + safe_(payload.comment) + "\n\n" +
    "Сумма: " + total + " RUB\n" +
    "Позиции:\n" + items.map(function (x) {
      return "- " + safe_(x.product_name) + " × " + toNumber_(x.qty) + " = " + toNumber_(x.line_total_rub) + " RUB";
    }).join("\n");

  MailApp.sendEmail(OWNER_EMAIL, subject, body);

  // Письмо клиенту (если email указан)
  if (payload.email) {
    MailApp.sendEmail(String(payload.email), "Ваш заказ принят: " + orderId, "Спасибо! Мы свяжемся с вами для подтверждения.\n\nНомер заказа: " + orderId);
  }

  return html_("OK");
}

function handleReview_(payload) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEETS.REVIEWS);
  const now = new Date();

  const reviewId = "REV-" + Utilities.getUuid();
  appendRowByHeaders_(sheet, {
    review_id: reviewId,
    created_at: now.toISOString(),
    status: "pending",
    product_id: safe_(payload.product_id),
    author_name: safe_(payload.author_name),
    author_email: safe_(payload.author_email),
    rating: toNumber_(payload.rating),
    text: safe_(payload.text),
  });

  MailApp.sendEmail(
    OWNER_EMAIL,
    "Новый отзыв (модерация): " + reviewId,
    "Товар ID: " + safe_(payload.product_id) + "\n" +
      "Автор: " + safe_(payload.author_name) + " <" + safe_(payload.author_email) + ">\n" +
      "Оценка: " + toNumber_(payload.rating) + "\n\n" +
      safe_(payload.text)
  );

  return html_("OK");
}

function normalizeProduct_(row) {
  return {
    id: safe_(row.id),
    slug: safe_(row.slug),
    name: safe_(row.name),
    category: safe_(row.category),
    description: safe_(row.description),
    price_rub: toNumber_(row.price_rub),
    currency: safe_(row.currency || "RUB"),
    color: safe_(row.color),
    height_cm: toNumber_(row.height_cm),
    bloom_type: safe_(row.bloom_type),
    is_active: toNumber_(row.is_active) ? 1 : 0,
    is_new: toNumber_(row.is_new) ? 1 : 0,
    popularity: toNumber_(row.popularity),
    image_url: safe_(row.image_url),
    updated_at: safe_(row.updated_at),
  };
}

function readSheetObjects_(sheet) {
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values || values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });

  const out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var obj = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (!key) continue;
      obj[key] = row[c];
      if (row[c] !== "" && row[c] !== null) empty = false;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

function appendRowByHeaders_(sheet, obj) {
  if (!sheet) throw new Error("Missing sheet");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  const row = headers.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ""; });
  sheet.appendRow(row);
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  var lastCol = sheet.getLastColumn();
  var current = [];
  if (sheet.getLastRow() >= 1 && lastCol > 0) {
    current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  }
  if (current.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  var missing = [];
  for (var i = 0; i < headers.length; i++) {
    if (current.indexOf(headers[i]) === -1) missing.push(headers[i]);
  }

  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
}

function indexStock_(stockSheet) {
  const rows = readSheetObjects_(stockSheet);
  const byId = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = String(r.product_id || "");
    if (!id) continue;
    byId[id] = {
      rowIndex: i + 2, // + header row
      quantity: toNumber_(r.quantity),
    };
  }
  return byId;
}

function setCellByHeader_(sheet, rowIndex, headerName, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  for (var c = 0; c < headers.length; c++) {
    if (headers[c] === headerName) {
      sheet.getRange(rowIndex, c + 1).setValue(value);
      return;
    }
  }
}

function jsonp_(callback, data) {
  const cb = callback ? callback : "callback";
  const payload = cb + "(" + JSON.stringify(data) + ");";
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function html_(text) {
  return HtmlService.createHtmlOutput(String(text));
}

function safe_(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toNumber_(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
