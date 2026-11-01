/* ============================================================
   كلمة السر - مكانها الوحيد هنا في الكود (مفيش أي شاشة في البرنامج بتغيرها).
   لتغييرها: افتح make-password.html على جهازك، اكتب كلمة السر الجديدة،
   وانسخ السطرين اللي هيطلعوا واستبدل بيهم PASS_SALT و PASS_HASH تحت، وارفع الملف.
   كلمة السر الحالية (تجريبية): 123456  ← غيرها قبل الاستخدام الفعلي!
   ============================================================ */
const APP_AUTH = {
  PASS_SALT: '8bdd8825c96cac3b',
  PASS_HASH: '8ce4d993616cddb756fe5da69cb2acff58d3eaffcd5d59b70b6123375f317012',
  REMEMBER: true   // true = تدخل كلمة السر مرة واحدة بس على كل جهاز | false = تطلبها كل مرة تقفل المتصفح
};
const APP_VERSION = 'v7';
/* ============================================================ */

/* ===== برنامج الكاشير - كل البيانات بتتحفظ في المتصفح (localStorage) ===== */
/* تخزين آمن: لو المتصفح منع التخزين البرنامج يفضل شغال (بس البيانات مش هتتحفظ) */
var storageWarn = false;
var store = {
  get(k, area) { try { return (area || localStorage).getItem(k); } catch (e) { return null; } },
  set(k, v, area) { try { (area || localStorage).setItem(k, v); return true; } catch (e) { if (!area) storageWarn = true; return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} try { sessionStorage.removeItem(k); } catch (e) {} }
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
const money = n => num(n) + ' ج.م';
const fmtDate = d => { d = new Date(d); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(4, '0');

const KEY = 'cashier_db_v1';
function load() {
  try { const d = JSON.parse(store.get(KEY)); if (d) return d; } catch (e) {}
  return { products: [], customers: [], sales: [], purchases: [], payments: [], settings: { shop: 'اسم المحل', phone: '', lowStock: 2, stamp: '' }, seq: { sale: 1, purchase: 1 } };
}
let db = load();
db.settings = Object.assign({ shop: 'اسم المحل', phone: '', lowStock: 2, stamp: '' }, db.settings);
db.seq = Object.assign({ sale: 1, purchase: 1 }, db.seq);
function save() { if (!store.set(KEY, JSON.stringify(db)) && !save.warned) { save.warned = true; alert('تنبيه: المتصفح بيمنع حفظ البيانات (غالبًا بسبب وضع الخصوصية أو فتح الملف من مكان غير مدعوم). افتح البرنامج من الرابط العادي في Chrome أو Safari عشان البيانات تتحفظ.'); } }

const view = $('#view');
const titles = { products: 'المنتجات', sales: 'المبيعات', purchases: 'المشتريات', reports: 'التقارير', customers: 'العملاء', settings: 'الإعدادات' };
const pages = { products: renderProducts, sales: renderSales, purchases: renderPurchases, reports: renderReports, customers: renderCustomers, settings: renderSettings };
let page = store.get('cashier_page') || 'products';
function go(p) {
  if (!isAuthed()) return;
  if (!pages[p]) p = 'products';
  page = p; store.set('cashier_page', p);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.p === p));
  $('#pageTitle').textContent = titles[p];
  $('#shopTitle').textContent = db.settings.shop || 'برنامج الكاشير';
  pages[p]();
  window.scrollTo(0, 0);
}
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => go(b.dataset.p));

/* ===== نوافذ ===== */
function modal(html) { const m = $('#modal'); m.innerHTML = '<div class="box">' + html + '</div>'; m.hidden = false; }
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; editAvail = {}; }
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal' && !$('#modal .row') && !$('#modal input')) closeModal(); });

/* ===== الطباعة / PDF (من نافذة الطباعة اختار "حفظ كـ PDF") ===== */
const DOC_CSS = `
.doc{font-family:Tahoma,Arial,sans-serif;color:#000;direction:rtl;text-align:right}
.doc .hd{text-align:center;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:8px}
.doc h1{margin:0;font-size:22px}.doc h2{margin:6px 0;font-size:16px}
.doc .sm{font-size:12px;color:#444}
.doc table{width:100%;border-collapse:collapse;margin:10px 0;min-width:0}
.doc th,.doc td{border:1px solid #444;padding:6px 8px;text-align:right;font-size:13px;white-space:normal}
.doc th{background:#eee;color:#000}
.doc .meta{display:flex;justify-content:space-between;font-size:13px;margin:6px 0;gap:10px;flex-wrap:wrap}
.doc .bt{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-top:10px}
.doc .tt{font-size:14px;line-height:2}
.doc .stamp img{max-width:150px;max-height:150px;display:block}
`;
function printDoc(title, bodyHTML) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open();
  d.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{margin:12mm}body{margin:0}${DOC_CSS}</style></head><body><div class="doc">${bodyHTML}</div></body></html>`);
  d.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); }, 350);
  setTimeout(() => f.remove(), 120000);
}
const docHead = t => `<div class="hd"><h1>${esc(db.settings.shop)}</h1>${db.settings.phone ? `<div class="sm">${esc(db.settings.phone)}</div>` : ''}<h2>${esc(t)}</h2><div class="sm">${fmtDate(new Date())}</div></div>`;
function tableHTML(heads, rows) {
  return `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}" style="text-align:center">لا يوجد بيانات</td></tr>`}</tbody></table>`;
}
function printTable(title, heads, rows, extra) { printDoc(title, docHead(title) + tableHTML(heads, rows) + (extra || '')); }

/* ===== المنتجات ===== */
let pq = '';
function renderProducts() {
  view.innerHTML = `<div class="bar"><h2>المنتجات</h2>
    <input type="search" id="pq" placeholder="🔍 بحث باسم المنتج" value="${esc(pq)}">
    <button class="btn" onclick="productForm()">➕ إضافة منتج</button>
    <button class="btn ghost" onclick="printProducts()">🖨 طباعة PDF</button></div>
    <div class="tw" id="tbl"></div>`;
  $('#pq').oninput = e => { pq = e.target.value; $('#tbl').innerHTML = productsTable(); };
  $('#tbl').innerHTML = productsTable();
}
const filteredProducts = () => db.products.filter(p => p.name.toLowerCase().includes(pq.trim().toLowerCase()));
function productsTable() {
  const l = filteredProducts();
  return `<table><thead><tr><th>#</th><th>اسم المنتج</th><th>الكمية</th><th>السعر</th><th>إجراءات</th></tr></thead><tbody>${l.length ? l.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${num(p.qty)} ${stockTag(p)}</td><td>${money(p.price)}</td><td class="act"><button class="btn sm ghost" onclick="productForm('${p.id}')">✏️ تعديل</button><button class="btn sm red" onclick="delProduct('${p.id}')">🗑 حذف</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">مفيش منتجات لسه - دوس "إضافة منتج"</td></tr>'}</tbody></table>`;
}
function stockTag(p) {
  if (p.qty <= 0) return '<span class="tag r">خلص</span>';
  if (p.qty <= db.settings.lowStock) return '<span class="tag o">قرب يخلص</span>';
  return '';
}
function printProducts() { printTable('قائمة المنتجات', ['#', 'اسم المنتج', 'الكمية', 'السعر'], filteredProducts().map((p, i) => [i + 1, p.name, num(p.qty), money(p.price)])); }
function productForm(id) {
  const p = db.products.find(x => x.id === id) || { name: '', qty: '', price: '' };
  modal(`<h3>${id ? 'تعديل منتج' : 'إضافة منتج'}</h3>
    <label>اسم المنتج</label><input id="f_name" value="${esc(p.name)}">
    <label>الكمية</label><input id="f_qty" type="number" min="0" step="any" inputmode="decimal" value="${p.qty}">
    <label>السعر</label><input id="f_price" type="number" min="0" step="any" inputmode="decimal" value="${p.price}">
    <div class="acts"><button class="btn" onclick="saveProduct('${id || ''}')">حفظ</button><button class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  $('#f_name').focus();
}
function saveProduct(id) {
  const name = $('#f_name').value.trim(), qty = +$('#f_qty').value || 0, price = +$('#f_price').value || 0;
  if (!name) return alert('اكتب اسم المنتج');
  if (db.products.some(p => p.name === name && p.id !== id)) return alert('المنتج ده موجود قبل كده');
  if (id) Object.assign(db.products.find(p => p.id === id), { name, qty, price });
  else db.products.push({ id: uid(), name, qty, price });
  save(); closeModal(); renderProducts();
}
function delProduct(id) {
  const p = db.products.find(x => x.id === id);
  if (!confirm(`حذف المنتج "${p.name}"؟`)) return;
  db.products = db.products.filter(x => x.id !== id); save(); renderProducts();
}

/* ===== نموذج الأصناف المشترك (مبيعات / مشتريات) ===== */
let formKind = 'sale', paidTouched = false;
function addRow(kind, it) {
  const d = document.createElement('div');
  if (kind === 'sale') {
    d.className = 'row';
    d.innerHTML = `<div class="ac"><input class="pn" placeholder="🔍 اكتب اسم المنتج للبحث..." autocomplete="off"><div class="sug" hidden></div></div>
      <input class="q" type="number" min="0" step="any" inputmode="decimal" value="1" placeholder="الكمية" oninput="calc()">
      <input class="pr" type="number" min="0" step="any" inputmode="decimal" placeholder="السعر" oninput="calc()">
      <span class="lt">0</span><button class="x" onclick="this.parentNode.remove();calc()">✕</button>`;
    wireSearch(d);
    if (it) { d.dataset.pid = it.pid; d.querySelector('.pn').value = it.name; d.querySelector('.q').value = it.qty; d.querySelector('.pr').value = it.price; }
  } else {
    d.className = 'row pu';
    d.innerHTML = `<input class="n" list="plist" placeholder="اسم المنتج">
      <input class="q" type="number" min="0" step="any" inputmode="decimal" value="1" placeholder="الكمية" oninput="calc()">
      <input class="pr" type="number" min="0" step="any" inputmode="decimal" placeholder="سعر الشراء" oninput="calc()">
      <input class="sp" type="number" min="0" step="any" inputmode="decimal" placeholder="سعر البيع">
      <span class="lt">0</span><button class="x" onclick="this.parentNode.remove();calc()">✕</button>`;
  }
  $('#rows').appendChild(d);
}
/* بحث المنتجات داخل فاتورة البيع: بيظهر المنتجات اللي بتبدأ بالحروف المكتوبة الأول، وبعدها اللي فيها الحروف */
let editAvail = {};
const availQty = p => p.qty + (editAvail[p.id] || 0);
function wireSearch(row) {
  const inp = row.querySelector('.pn'), box = row.querySelector('.sug');
  const show = () => {
    const q = inp.value.trim().toLowerCase();
    let l = db.products.filter(p => availQty(p) > 0);
    if (q) {
      l = l.filter(p => p.name.toLowerCase().includes(q));
      l.sort((a, b) => b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q));
    }
    box.innerHTML = l.length
      ? l.map(p => `<div class="si" data-id="${p.id}"><b>${esc(p.name)}</b><small>متاح ${num(availQty(p))} • ${money(p.price)}</small></div>`).join('')
      : '<div class="si none">مفيش منتج بالاسم ده</div>';
    box.hidden = false;
  };
  inp.addEventListener('focus', show);
  inp.addEventListener('input', () => { delete row.dataset.pid; show(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const f = box.querySelector('.si[data-id]'); if (f) choose(row, f.dataset.id); }
  });
  box.addEventListener('click', e => { const s = e.target.closest('.si[data-id]'); if (s) choose(row, s.dataset.id); });
}
function choose(row, id) {
  const p = db.products.find(x => x.id === id);
  if (!p) return;
  row.dataset.pid = id;
  row.querySelector('.pn').value = p.name;
  row.querySelector('.pr').value = p.price;
  row.querySelector('.sug').hidden = true;
  const q = row.querySelector('.q'); q.focus(); q.select();
  calc();
}
document.addEventListener('click', e => {
  document.querySelectorAll('.sug').forEach(b => { if (!b.parentNode.contains(e.target)) b.hidden = true; });
});
function calc() {
  let t = 0;
  document.querySelectorAll('#rows .row').forEach(r => {
    const v = (+r.querySelector('.q').value || 0) * (+r.querySelector('.pr').value || 0);
    r.querySelector('.lt').textContent = num(v); t += v;
  });
  $('#f_tot').textContent = num(t);
  if (!paidTouched) $('#f_paid').value = t || '';
  $('#f_rem').textContent = num(t - (+$('#f_paid').value || 0));
  $('#f_tot').dataset.v = t;
}
function totalsBlock() {
  return `<div class="tot">الإجمالي: <b id="f_tot">0</b> ج.م</div>
    <label>المدفوع</label><input id="f_paid" type="number" min="0" step="any" inputmode="decimal" oninput="paidTouched=true;calc()">
    <div class="tot">الباقي: <b id="f_rem">0</b> ج.م</div>`;
}

/* ===== فاتورة (عرض / طباعة) ===== */
function invoiceHTML(inv, kind) {
  const isS = kind === 'sale';
  const rows = inv.items.map((it, i) => [i + 1, it.name, num(it.qty), money(isS ? it.price : it.cost), money(it.qty * (isS ? it.price : it.cost))]);
  const who = isS ? (inv.cname ? 'العميل: ' + inv.cname : 'عميل نقدي (بدون اسم)') : 'المورد: ' + (inv.supplier || '—');
  const stamp = isS && db.settings.stamp ? `<div class="stamp"><img src="${db.settings.stamp}"></div>` : '<div></div>';
  return docHead(isS ? 'فاتورة مبيعات' : 'فاتورة مشتريات') +
    `<div class="meta"><span>رقم الفاتورة: <b>${esc(inv.no)}</b></span><span>التاريخ: ${fmtDate(inv.date)}</span></div><div class="meta"><span>${esc(who)}</span>${inv.edited ? `<span class="sm">آخر تعديل: ${fmtDate(inv.edited)}</span>` : ''}</div>` +
    tableHTML(['#', 'الصنف', 'الكمية', 'السعر', 'الإجمالي'], rows) +
    `<div class="bt">${stamp}<div class="tt">الإجمالي: <b>${money(inv.total)}</b><br>المدفوع: ${money(inv.paid)}<br>الباقي: <b>${money(inv.remaining)}</b></div></div>`;
}
function viewInvoice(id, kind) {
  const inv = (kind === 'sale' ? db.sales : db.purchases).find(x => x.id === id);
  modal(`<style>${DOC_CSS}</style><div class="doc">${invoiceHTML(inv, kind)}</div>
    <div class="acts"><button class="btn" onclick="printInvoice('${id}','${kind}')">🖨 طباعة / PDF</button><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
}
function printInvoice(id, kind) {
  const inv = (kind === 'sale' ? db.sales : db.purchases).find(x => x.id === id);
  printDoc((kind === 'sale' ? 'فاتورة مبيعات ' : 'فاتورة مشتريات ') + inv.no, invoiceHTML(inv, kind));
}

/* ===== المبيعات ===== */
let sq = '';
function renderSales() {
  view.innerHTML = `<div class="bar"><h2>فواتير المبيعات</h2>
    <input type="search" id="sq" placeholder="🔍 رقم الفاتورة أو اسم العميل" value="${esc(sq)}">
    <button class="btn" onclick="saleForm()">➕ فاتورة بيع جديدة</button></div>
    <div id="sstat"></div><div class="tw" id="tbl"></div>`;
  $('#sq').oninput = e => { sq = e.target.value; drawSales(); };
  drawSales();
}
function drawSales() {
  const q = sq.trim().toLowerCase();
  const l = db.sales.filter(s => !q || s.no.toLowerCase().includes(q) || (s.cname || 'نقدي').toLowerCase().includes(q)).slice().reverse();
  const tot = l.reduce((a, s) => a + s.total, 0), rem = l.reduce((a, s) => a + s.remaining, 0);
  $('#sstat').innerHTML = `<div class="cards"><div class="card"><small>عدد الفواتير</small><b>${l.length}</b></div><div class="card"><small>إجمالي المبيعات</small><b>${money(tot)}</b></div><div class="card"><small>إجمالي الباقي</small><b>${money(rem)}</b></div></div>`;
  $('#tbl').innerHTML = `<table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>الباقي</th><th>إجراءات</th></tr></thead><tbody>${l.length ? l.map(s => `<tr><td><b>${esc(s.no)}</b></td><td>${fmtDate(s.date)}</td><td>${esc(s.cname || 'بدون عميل')}</td><td>${money(s.total)}</td><td>${money(s.paid)}</td><td class="${s.remaining > 0 ? 'neg' : ''}">${money(s.remaining)}</td><td class="act"><button class="btn sm" onclick="viewInvoice('${s.id}','sale')">👁 عرض</button><button class="btn sm ghost" onclick="printInvoice('${s.id}','sale')">🖨</button><button class="btn sm ghost" onclick="saleForm('${s.id}')">✏️ تعديل</button><button class="btn sm red" onclick="delSale('${s.id}')">🗑</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty">مفيش فواتير</td></tr>'}</tbody></table>`;
}
function saleForm(editId) {
  const inv = editId ? db.sales.find(s => s.id === editId) : null;
  editAvail = {};
  if (inv) inv.items.forEach(i => editAvail[i.pid] = (editAvail[i.pid] || 0) + i.qty);
  else if (!db.products.some(p => p.qty > 0)) return alert('مفيش منتجات في المخزن. ضيف منتجات أو اعمل فاتورة مشتريات الأول.');
  formKind = 'sale'; paidTouched = !!inv;
  modal(`<h3>${inv ? 'تعديل فاتورة ' + esc(inv.no) : 'فاتورة بيع جديدة'}</h3>
    <label>العميل</label><select id="f_cust"><option value="">بدون عميل (نقدي)</option>${db.customers.map(c => `<option value="${c.id}" ${inv && inv.cid === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label>الأصناف</label><div id="rows"></div>
    <button class="btn ghost sm" onclick="addRow('sale')">+ إضافة صنف</button>
    ${totalsBlock()}
    <div class="acts"><button class="btn grn" onclick="saveSale('${editId || ''}')">💾 ${inv ? 'حفظ التعديلات' : 'حفظ الفاتورة'}</button><button class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  if (inv) { inv.items.forEach(i => addRow('sale', i)); $('#f_paid').value = inv.paid; }
  else addRow('sale');
  calc();
}
function saveSale(editId) {
  const items = []; let bad = '';
  document.querySelectorAll('#rows .row').forEach(r => {
    const txt = r.querySelector('.pn').value.trim(), qty = +r.querySelector('.q').value, price = +r.querySelector('.pr').value;
    let pid = r.dataset.pid;
    if (!pid && txt) { const m = db.products.find(p => p.name.toLowerCase() === txt.toLowerCase()); if (m) pid = m.id; }
    const p0 = pid && db.products.find(p => p.id === pid);
    if (txt && !p0) { bad = txt; return; }
    if (p0 && qty > 0) items.push({ pid, name: p0.name, qty, price: price || 0 });
  });
  if (bad) return alert(`اختار "${bad}" من القايمة اللي بتظهر وانت بتكتب`);
  if (!items.length) return alert('ضيف صنف واحد على الأقل');
  const need = {};
  items.forEach(i => need[i.pid] = (need[i.pid] || 0) + i.qty);
  for (const pid in need) { const p = db.products.find(x => x.id === pid); if (need[pid] > availQty(p)) return alert(`الكمية المطلوبة من "${p.name}" أكبر من المتاح (${num(availQty(p))})`); }
  const total = items.reduce((a, i) => a + i.qty * i.price, 0);
  const paid = +$('#f_paid').value || 0;
  const remaining = Math.max(0, total - paid);
  const cid = $('#f_cust').value || null;
  if (remaining > 0 && !cid) return alert('فيه باقي على الفاتورة - لازم تختار عميل عشان الباقي يتسجل عليه');
  const old = editId && db.sales.find(s => s.id === editId);
  if (old) old.items.forEach(i => { const p = db.products.find(x => x.id === i.pid); if (p) p.qty += i.qty; });
  for (const pid in need) db.products.find(x => x.id === pid).qty -= need[pid];
  const cname = cid ? db.customers.find(c => c.id === cid).name : '';
  let inv;
  if (old) inv = Object.assign(old, { cid, cname, items, total, paid: Math.min(paid, total), remaining, edited: new Date().toISOString() });
  else { inv = { id: uid(), no: 'S-' + pad(db.seq.sale++), date: new Date().toISOString(), cid, cname, items, total, paid: Math.min(paid, total), remaining }; db.sales.push(inv); }
  save(); closeModal(); renderSales(); viewInvoice(inv.id, 'sale');
}
function delSale(id) {
  const s = db.sales.find(x => x.id === id);
  if (!confirm(`حذف الفاتورة ${s.no}؟ الكميات هترجع للمخزن.`)) return;
  s.items.forEach(i => { const p = db.products.find(x => x.id === i.pid); if (p) p.qty += i.qty; });
  db.sales = db.sales.filter(x => x.id !== id); save(); renderSales();
}

/* ===== المشتريات ===== */
let puq = '';
function renderPurchases() {
  view.innerHTML = `<div class="bar"><h2>فواتير المشتريات</h2>
    <input type="search" id="puq" placeholder="🔍 رقم الفاتورة أو المورد" value="${esc(puq)}">
    <button class="btn" onclick="purchaseForm()">➕ فاتورة شراء جديدة</button></div>
    <div id="pstat"></div><div class="tw" id="tbl"></div>`;
  $('#puq').oninput = e => { puq = e.target.value; drawPurchases(); };
  drawPurchases();
}
function drawPurchases() {
  const q = puq.trim().toLowerCase();
  const l = db.purchases.filter(s => !q || s.no.toLowerCase().includes(q) || (s.supplier || '').toLowerCase().includes(q)).slice().reverse();
  const tot = l.reduce((a, s) => a + s.total, 0);
  $('#pstat').innerHTML = `<div class="cards"><div class="card"><small>عدد الفواتير</small><b>${l.length}</b></div><div class="card"><small>إجمالي المشتريات</small><b>${money(tot)}</b></div></div>`;
  $('#tbl').innerHTML = `<table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>الباقي</th><th>إجراءات</th></tr></thead><tbody>${l.length ? l.map(s => `<tr><td><b>${esc(s.no)}</b></td><td>${fmtDate(s.date)}</td><td>${esc(s.supplier || '—')}</td><td>${money(s.total)}</td><td>${money(s.paid)}</td><td>${money(s.remaining)}</td><td class="act"><button class="btn sm" onclick="viewInvoice('${s.id}','purchase')">👁 عرض</button><button class="btn sm ghost" onclick="printInvoice('${s.id}','purchase')">🖨</button><button class="btn sm red" onclick="delPurchase('${s.id}')">🗑</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty">مفيش فواتير</td></tr>'}</tbody></table>`;
}
function purchaseForm() {
  formKind = 'purchase'; paidTouched = false;
  modal(`<h3>فاتورة شراء جديدة</h3>
    <label>المورد (اختياري)</label><input id="f_sup" placeholder="اسم المورد">
    <label>الأصناف (اكتب اسم منتج موجود يزود كميته، أو اسم جديد يتضاف تلقائي)</label>
    <datalist id="plist">${db.products.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
    <div id="rows"></div>
    <button class="btn ghost sm" onclick="addRow('purchase')">+ إضافة صنف</button>
    ${totalsBlock()}
    <div class="acts"><button class="btn grn" onclick="savePurchase()">💾 حفظ الفاتورة</button><button class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  addRow('purchase'); calc();
}
function savePurchase() {
  const items = [];
  document.querySelectorAll('#rows .row').forEach(r => {
    const name = r.querySelector('.n').value.trim(), qty = +r.querySelector('.q').value, cost = +r.querySelector('.pr').value || 0, sp = +r.querySelector('.sp').value || 0;
    if (name && qty > 0) items.push({ name, qty, cost, sp });
  });
  if (!items.length) return alert('ضيف صنف واحد على الأقل');
  const total = items.reduce((a, i) => a + i.qty * i.cost, 0);
  const paid = Math.min(+$('#f_paid').value || 0, total);
  const out = items.map(i => {
    let p = db.products.find(x => x.name === i.name);
    if (!p) { p = { id: uid(), name: i.name, qty: 0, price: i.sp || i.cost }; db.products.push(p); }
    p.qty += i.qty; if (i.sp) p.price = i.sp;
    return { pid: p.id, name: p.name, qty: i.qty, cost: i.cost };
  });
  const inv = { id: uid(), no: 'P-' + pad(db.seq.purchase++), date: new Date().toISOString(), supplier: $('#f_sup').value.trim(), items: out, total, paid, remaining: total - paid };
  db.purchases.push(inv); save(); closeModal(); renderPurchases(); viewInvoice(inv.id, 'purchase');
}
function delPurchase(id) {
  const s = db.purchases.find(x => x.id === id);
  for (const i of s.items) { const p = db.products.find(x => x.id === i.pid); if (p && p.qty < i.qty) return alert(`مينفعش تحذف الفاتورة: كمية "${p.name}" الحالية أقل من اللي اتشترى فيها.`); }
  if (!confirm(`حذف الفاتورة ${s.no}؟ الكميات هتتخصم من المخزن.`)) return;
  s.items.forEach(i => { const p = db.products.find(x => x.id === i.pid); if (p) p.qty -= i.qty; });
  db.purchases = db.purchases.filter(x => x.id !== id); save(); renderPurchases();
}

/* ===== التقارير ===== */
function stockLists() {
  const t = db.settings.lowStock;
  return { all: db.products, low: db.products.filter(p => p.qty > 0 && p.qty <= t), out: db.products.filter(p => p.qty <= 0) };
}
const stockRows = l => l.map((p, i) => [i + 1, p.name, num(p.qty), money(p.price), money(p.qty * p.price)]);
const stockHeads = ['#', 'اسم المنتج', 'الكمية', 'السعر', 'قيمة المخزون'];
function reportTable(l) {
  return `<div class="tw"><table><thead><tr>${stockHeads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${l.length ? stockRows(l).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="5" class="empty">لا يوجد</td></tr>`}</tbody></table></div>`;
}
function renderReports() {
  const { all, low, out } = stockLists();
  const stockVal = all.reduce((a, p) => a + Math.max(0, p.qty) * p.price, 0);
  const sales = db.sales.reduce((a, s) => a + s.total, 0), buys = db.purchases.reduce((a, s) => a + s.total, 0);
  const debts = db.customers.reduce((a, c) => a + Math.max(0, custBalance(c.id)), 0);
  view.innerHTML = `<div class="bar"><h2>التقارير</h2></div>
    <div class="cards">
      <div class="card"><small>عدد المنتجات</small><b>${all.length}</b></div>
      <div class="card"><small>قيمة المخزون</small><b>${money(stockVal)}</b></div>
      <div class="card"><small>إجمالي المبيعات</small><b>${money(sales)}</b></div>
      <div class="card"><small>إجمالي المشتريات</small><b>${money(buys)}</b></div>
      <div class="card"><small>مديونيات العملاء</small><b>${money(debts)}</b></div>
    </div>
    <div class="sec"><h3>📦 كل المنتجات في المخزن (${all.length})</h3><button class="btn ghost sm" onclick="printStock('all')">🖨 طباعة PDF</button></div>${reportTable(all)}
    <div class="sec"><h3>⚠️ منتجات قربت تخلص (${low.length})</h3>
      <span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">الحد: <input type="number" min="0" id="lowv" value="${db.settings.lowStock}" style="width:70px" onchange="setLow(this.value)"><button class="btn ghost sm" onclick="printStock('low')">🖨 طباعة PDF</button></span></div>${reportTable(low)}
    <div class="sec"><h3>❌ منتجات خلصت من المخزن (${out.length})</h3><button class="btn ghost sm" onclick="printStock('out')">🖨 طباعة PDF</button></div>${reportTable(out)}`;
}
function setLow(v) { db.settings.lowStock = Math.max(0, +v || 0); save(); renderReports(); }
function printStock(k) {
  const names = { all: 'تقرير المنتجات في المخزن', low: `تقرير المنتجات التي قاربت على الانتهاء (${db.settings.lowStock} فأقل)`, out: 'تقرير المنتجات المنتهية من المخزن' };
  printTable(names[k], stockHeads, stockRows(stockLists()[k]));
}

/* ===== العملاء ===== */
const custBalance = id => db.sales.filter(s => s.cid === id).reduce((a, s) => a + s.remaining, 0) - db.payments.filter(p => p.cid === id).reduce((a, p) => a + p.amount, 0);
const custTotal = id => db.sales.filter(s => s.cid === id).reduce((a, s) => a + s.total, 0);
let cq = '';
function renderCustomers() {
  view.innerHTML = `<div class="bar"><h2>العملاء</h2>
    <input type="search" id="cq" placeholder="🔍 بحث بالاسم أو الموبايل" value="${esc(cq)}">
    <button class="btn" onclick="customerForm()">➕ إضافة عميل</button>
    <button class="btn ghost" onclick="printCustomers()">🖨 طباعة PDF</button></div>
    <div class="tw" id="tbl"></div>`;
  $('#cq').oninput = e => { cq = e.target.value; $('#tbl').innerHTML = customersTable(); };
  $('#tbl').innerHTML = customersTable();
}
const filteredCustomers = () => db.customers.filter(c => (c.name + ' ' + (c.phone || '')).toLowerCase().includes(cq.trim().toLowerCase()));
function customersTable() {
  const l = filteredCustomers();
  return `<table><thead><tr><th>الاسم</th><th>الموبايل</th><th>إجمالي مشترياته</th><th>الباقي عليه</th><th>إجراءات</th></tr></thead><tbody>${l.length ? l.map(c => { const b = custBalance(c.id); return `<tr><td><b>${esc(c.name)}</b></td><td dir="ltr" style="text-align:right">${esc(c.phone || '—')}</td><td>${money(custTotal(c.id))}</td><td class="${b > 0 ? 'neg' : ''}">${money(b)}</td><td class="act"><button class="btn sm" onclick="statement('${c.id}')">📄 كشف</button><button class="btn sm grn" onclick="payForm('${c.id}')">💵 دفعة</button><button class="btn sm ghost" onclick="customerForm('${c.id}')">✏️</button><button class="btn sm red" onclick="delCustomer('${c.id}')">🗑</button></td></tr>`; }).join('') : '<tr><td colspan="5" class="empty">مفيش عملاء لسه</td></tr>'}</tbody></table>`;
}
function printCustomers() { printTable('قائمة العملاء', ['الاسم', 'الموبايل', 'إجمالي المشتريات', 'الباقي عليه'], filteredCustomers().map(c => [c.name, c.phone || '—', money(custTotal(c.id)), money(custBalance(c.id))])); }
function customerForm(id) {
  const c = db.customers.find(x => x.id === id) || { name: '', phone: '', address: '' };
  modal(`<h3>${id ? 'تعديل عميل' : 'إضافة عميل'}</h3>
    <label>اسم العميل</label><input id="f_name" value="${esc(c.name)}">
    <label>رقم الموبايل</label><input id="f_phone" type="tel" inputmode="tel" value="${esc(c.phone || '')}">
    <label>العنوان (اختياري)</label><input id="f_addr" value="${esc(c.address || '')}">
    <div class="acts"><button class="btn" onclick="saveCustomer('${id || ''}')">حفظ</button><button class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  $('#f_name').focus();
}
function saveCustomer(id) {
  const name = $('#f_name').value.trim(), phone = $('#f_phone').value.trim(), address = $('#f_addr').value.trim();
  if (!name) return alert('اكتب اسم العميل');
  if (id) { const c = db.customers.find(x => x.id === id); Object.assign(c, { name, phone, address }); db.sales.forEach(s => { if (s.cid === id) s.cname = name; }); }
  else db.customers.push({ id: uid(), name, phone, address });
  save(); closeModal(); renderCustomers();
}
function delCustomer(id) {
  if (db.sales.some(s => s.cid === id)) return alert('العميل ده عليه فواتير مبيعات، مينفعش يتحذف.');
  if (!confirm('حذف العميل؟')) return;
  db.customers = db.customers.filter(c => c.id !== id); db.payments = db.payments.filter(p => p.cid !== id); save(); renderCustomers();
}
function payForm(id) {
  const c = db.customers.find(x => x.id === id), b = custBalance(id);
  modal(`<h3>تسجيل دفعة من ${esc(c.name)}</h3><p class="note">الباقي عليه حاليًا: <b>${money(b)}</b></p>
    <label>المبلغ المدفوع</label><input id="f_amt" type="number" min="0" step="any" inputmode="decimal" value="${b > 0 ? b : ''}">
    <div class="acts"><button class="btn grn" onclick="savePay('${id}')">تسجيل</button><button class="btn ghost" onclick="closeModal()">إلغاء</button></div>`);
  $('#f_amt').focus();
}
function savePay(id) {
  const amount = +$('#f_amt').value;
  if (!(amount > 0)) return alert('اكتب مبلغ صحيح');
  db.payments.push({ id: uid(), date: new Date().toISOString(), cid: id, amount }); save(); closeModal(); renderCustomers();
}
function statementData(id) {
  const ev = [
    ...db.sales.filter(s => s.cid === id).map(s => ({ d: s.date, t: 'فاتورة ' + s.no, debit: s.remaining, credit: 0, tot: s.total })),
    ...db.payments.filter(p => p.cid === id).map(p => ({ d: p.date, t: 'دفعة', debit: 0, credit: p.amount, tot: 0 }))
  ].sort((a, b) => a.d < b.d ? -1 : 1);
  let bal = 0;
  return ev.map(e => { bal += e.debit - e.credit; return [fmtDate(e.d), e.t, e.tot ? money(e.tot) : '—', e.debit ? money(e.debit) : '—', e.credit ? money(e.credit) : '—', money(bal)]; });
}
const stHeads = ['التاريخ', 'البيان', 'إجمالي الفاتورة', 'الباقي (عليه)', 'دفعة', 'الرصيد'];
function statement(id) {
  const c = db.customers.find(x => x.id === id);
  const html = docHead('كشف حساب: ' + c.name) + tableHTML(stHeads, statementData(id)) + `<div class="tt">الرصيد الحالي: <b>${money(custBalance(id))}</b></div>`;
  modal(`<style>${DOC_CSS}</style><div class="doc">${html}</div><div class="acts"><button class="btn" id="stp">🖨 طباعة / PDF</button><button class="btn ghost" onclick="closeModal()">إغلاق</button></div>`);
  $('#stp').onclick = () => printDoc('كشف حساب ' + c.name, html);
}

/* ===== الإعدادات ===== */
function renderSettings() {
  const s = db.settings;
  view.innerHTML = `<div class="bar"><h2>الإعدادات</h2></div>
    <div class="card"><h3>بيانات المحل (بتظهر على الفواتير)</h3>
      <label>اسم المحل</label><input id="s_shop" value="${esc(s.shop)}">
      <label>رقم التليفون</label><input id="s_phone" value="${esc(s.phone)}">
      <label>حد "قرب يخلص" (الكمية)</label><input id="s_low" type="number" min="0" value="${s.lowStock}">
      <div class="acts"><button class="btn" onclick="saveSettings()">حفظ</button></div></div>
    <div class="card" style="margin-top:12px"><h3>🔖 ختم الفاتورة</h3>
      <p class="note">الختم بيظهر تلقائي على كل فاتورة مبيعات. ارفع صورة الختم (الأفضل PNG بخلفية شفافة).</p>
      ${s.stamp ? `<img class="stampprev" src="${s.stamp}">` : '<p class="note">لسه مفيش ختم.</p>'}
      <input type="file" id="s_stamp" accept="image/*">
      ${s.stamp ? '<div class="acts"><button class="btn red sm" onclick="removeStamp()">إزالة الختم</button></div>' : ''}</div>
    <div class="card" style="margin-top:12px"><h3>💾 نسخة احتياطية</h3>
      <p class="note">البيانات محفوظة على نفس الجهاز والمتصفح. خد نسخة احتياطية (ملف PDF) من وقت للتاني، واحتفظ بيها ومتعدلوش.</p>
      <div class="acts"><button class="btn ghost" onclick="exportData()">⬇️ تصدير نسخة (PDF)</button><button class="btn ghost" onclick="$('#s_imp').click()">⬆️ استرجاع نسخة (PDF)</button></div>
      <input type="file" id="s_imp" accept=".pdf,application/pdf" hidden></div>`;
  $('#s_stamp').onchange = e => loadStamp(e.target.files[0]);
  $('#s_imp').onchange = e => importData(e.target.files[0]);
}
function saveSettings() {
  db.settings.shop = $('#s_shop').value.trim() || 'اسم المحل';
  db.settings.phone = $('#s_phone').value.trim();
  db.settings.lowStock = Math.max(0, +$('#s_low').value || 0);
  save(); $('#shopTitle').textContent = db.settings.shop; alert('تم الحفظ ✅');
}
function loadStamp(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 400 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      db.settings.stamp = c.toDataURL('image/png'); save(); renderSettings();
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function removeStamp() { db.settings.stamp = ''; save(); renderSettings(); }
/*PDF-START*/
/* النسخة الاحتياطية: ملف PDF صفحته الأولى ملخص مقروء، وجواه ملف بيانات مدمج بيستخدمه الاسترجاع */
function buildPDF(jpegBin, jsonStr) {
  const data = 'CASHIERDATA-BEGIN' + btoa(unescape(encodeURIComponent(jsonStr))) + 'CASHIERDATA-END';
  const stream = (dict, body) => `<< ${dict} /Length ${body.length} >>\nstream\n${body}\nendstream`;
  const objs = [null,
    '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(backup.json) 6 0 R] >> >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    stream('/Type /XObject /Subtype /Image /Width 1190 /Height 842 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', jpegBin),
    stream('', 'q 595 0 0 421 0 421 cm /Im0 Do Q'),
    '<< /Type /Filespec /F (backup.json) /UF (backup.json) /EF << /F 7 0 R >> >>',
    stream('/Type /EmbeddedFile', data)
  ];
  let out = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offs = [];
  for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xr = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
  return out;
}
function extractBackup(txt) {
  const m = /CASHIERDATA-BEGIN([A-Za-z0-9+\/=]+)CASHIERDATA-END/.exec(txt);
  if (!m) return null;
  return JSON.parse(decodeURIComponent(escape(atob(m[1]))));
}
/*PDF-END*/
function exportData() {
  const c = document.createElement('canvas'); c.width = 1190; c.height = 842;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1190, 842);
  x.fillStyle = '#1565c0'; x.fillRect(0, 0, 1190, 150);
  x.direction = 'rtl'; x.textAlign = 'right';
  const put = (t, y, size, col, bold) => { x.fillStyle = col; x.font = `${bold ? 'bold ' : ''}${size}px Tahoma, Arial, sans-serif`; x.fillText(t, 1120, y); };
  put('نسخة احتياطية - برنامج الكاشير', 95, 56, '#fff', true);
  put(db.settings.shop || '', 230, 46, '#000', true);
  put('تاريخ النسخة: ' + fmtDate(new Date()), 305, 36, '#333');
  put('عدد المنتجات: ' + db.products.length, 395, 38, '#000');
  put('فواتير المبيعات: ' + db.sales.length, 455, 38, '#000');
  put('فواتير المشتريات: ' + db.purchases.length, 515, 38, '#000');
  put('العملاء: ' + db.customers.length, 575, 38, '#000');
  put('تنبيه: الملف ده فيه كل بيانات البرنامج، احتفظ بيه ومتعدلوش.', 690, 32, '#c62828', true);
  put('للاسترجاع: الإعدادات ثم استرجاع نسخة (PDF) ثم اختار الملف ده.', 745, 32, '#333');
  const jpeg = atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
  const pdf = buildPDF(jpeg, JSON.stringify(db));
  const u = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) u[i] = pdf.charCodeAt(i);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([u], { type: 'application/pdf' }));
  a.download = 'cashier-backup-' + new Date().toISOString().slice(0, 10) + '.pdf'; a.click();
}
function importData(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let d = null;
    try { d = extractBackup(new TextDecoder('latin1').decode(new Uint8Array(fr.result))); } catch (e) {}
    if (!d || !d.products || !d.sales) return alert('الملف ده مش نسخة احتياطية صحيحة. اختار ملف الـ PDF اللي طلع من "تصدير نسخة".');
    if (!confirm('الاسترجاع هيمسح البيانات الحالية ويحط النسخة دي. متأكد؟')) return;
    if (!store.set(KEY, JSON.stringify(d))) return alert('المتصفح بيمنع حفظ البيانات، مش هينفع الاسترجاع.');
    location.reload();
  };
  fr.readAsArrayBuffer(file);
}

/* ===== تشغيل ===== */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ===== منطق كلمة السر ===== */

function sha256x(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const b = new TextEncoder().encode(str);
  const l = b.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n);
  m.set(b); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(n - 8, Math.floor(l * 8 / 4294967296)); dv.setUint32(n - 4, (l * 8) >>> 0);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Array(64);
  const rr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i-15],7) ^ rr(w[i-15],18) ^ (w[i-15] >>> 3), s1 = rr(w[i-2],17) ^ rr(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a,bb,c,d,e,f,g,hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e,6) ^ rr(e,11) ^ rr(e,25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rr(a,2) ^ rr(a,13) ^ rr(a,22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h = [(h[0]+a)|0,(h[1]+bb)|0,(h[2]+c)|0,(h[3]+d)|0,(h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
  }
  return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

const AUTH_KEY = 'cashier_auth';
let memAuth = false; // لو التخزين ممنوع، الدخول يفضل شغال لحد ما الصفحة تتقفل
const cfgOk = () => true;
function isAuthed() {
  if (memAuth) return true;
  if (!cfgOk()) return false;
  let ss = null; try { ss = sessionStorage; } catch (e) {}
  return store.get(AUTH_KEY) === APP_AUTH.PASS_HASH || (ss && store.get(AUTH_KEY, ss) === APP_AUTH.PASS_HASH);
}
const LOCKABLE = ['header', 'nav', 'main', '#modal'];
/* القفل بيتعمل بالـ JavaScript مباشرة (inline) عشان يشتغل حتى لو style.css قديم */
function setLocked(on) {
  document.body.classList.toggle('locked', on);
  LOCKABLE.forEach(sel => { const el = $(sel); if (el) { if (on) el.style.setProperty('display', 'none', 'important'); else el.style.removeProperty('display'); } });
  const l = $('#login'); if (l) l.style.display = on ? 'flex' : 'none';
}
function startApp() { setLocked(false); go(page); }
function logout() { memAuth = false; store.del(AUTH_KEY); location.reload(); }
/* شاشة الدخول بتتبني كلها من هنا (بالتنسيق جواها) فمش بتعتمد على index.html ولا style.css */
function ensureLoginUI() {
  let l = $('#login');
  if (!l) { l = document.createElement('div'); l.id = 'login'; document.body.prepend(l); }
  l.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:16px;background:linear-gradient(160deg,#1565c0,#0d47a1);overflow:auto';
  l.innerHTML = `<form id="loginForm" autocomplete="off" action="javascript:void(0)" onsubmit="return false" style="background:#fff;border-radius:14px;padding:26px 22px;width:100%;max-width:340px;text-align:center;box-shadow:0 10px 30px #0004">
    <div style="font-size:42px">🔒</div><h2 style="margin:6px 0">برنامج الكاشير</h2>
    <p style="color:#6b7785;margin:0 0 12px;font-size:14px">اكتب كلمة السر عشان تفتح البرنامج</p>
    <input id="pw" type="password" placeholder="كلمة السر" autocomplete="current-password" style="text-align:center;margin-bottom:10px;font-size:17px">
    <button id="pwBtn" class="btn" type="button" style="width:100%;padding:11px">دخول</button>
    <div id="pwErr" style="color:#e53935;margin-top:10px;min-height:20px;font-size:14px;font-weight:600"></div><div style="color:#aab;font-size:11px;margin-top:6px">${APP_VERSION}</div></form>`;
}
function loginMsg(t, ok) { const e = $('#pwErr'); if (e) { e.style.color = ok ? '#2e7d32' : '#e53935'; e.textContent = t; } }
let fails = 0, lockUntil = 0;
function attemptLogin() {
  try {
    if (Date.now() < lockUntil) return loginMsg(`استنى ${Math.ceil((lockUntil - Date.now()) / 1000)} ثانية وجرب تاني`);
    const pw = $('#pw').value;
    if (!pw) return loginMsg('اكتب كلمة السر');
    const h = sha256x(APP_AUTH.PASS_SALT + pw);
    if (h === APP_AUTH.PASS_HASH) {
      memAuth = true; fails = 0;
      try { store.set(AUTH_KEY, h, APP_AUTH.REMEMBER ? localStorage : sessionStorage); } catch (e) {}
      $('#pw').value = ''; loginMsg('');
      startApp();
    } else {
      fails++;
      if (fails % 3 === 0) { lockUntil = Date.now() + 30000; loginMsg('محاولات كتير غلط، استنى 30 ثانية'); }
      else loginMsg('كلمة السر خطأ ❌');
      $('#pw').value = ''; $('#pw').focus();
    }
  } catch (err) { loginMsg('حصل خطأ: ' + (err && err.message || err)); }
}
function showLogin() {
  ensureLoginUI();
  setLocked(true);
  $('#pwBtn').onclick = attemptLogin;
  $('#pw').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); attemptLogin(); } };
  $('#pw').focus();
}
/* أي خطأ برمجي يظهر على شاشة الدخول بدل ما البرنامج يسكت */
window.addEventListener('error', e => { const l = $('#login'); if (l && l.style.display === 'flex') loginMsg('خطأ في البرنامج: ' + e.message); });
/* التشغيل: نخبي البرنامج فورًا، وبعدين نقرر ندخل ولا نطلب كلمة السر */
LOCKABLE.forEach(sel => { const el = $(sel); if (el) el.style.setProperty('display', 'none', 'important'); });
try { if (isAuthed()) startApp(); else showLogin(); }
catch (e) { try { showLogin(); loginMsg('خطأ: ' + e.message); } catch (x) { document.body.textContent = 'خطأ: ' + e.message; } }
