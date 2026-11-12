import { sections, riskFactors, bodySystems, emptyRecord } from './schema.js';
import { exportClinicalPdf } from './pdf.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const config = window.CLINIC_CONFIG || {};
const supabaseUrl = (config.supabaseUrl || '').trim();
const publishableKey = (config.publishableKey || '').trim();
const db = supabaseUrl && publishableKey ? createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }) : null;
const $ = (id) => document.getElementById(id);
let record = emptyRecord();
let currentStep = 0;
let loadedId = null;
let activeUser = null;
let records = [];
let dirty = false;
let toastTimer;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (v) => ({ '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[v]);
}
function esc(value) { return escapeHtml(value); }
function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $('toast').classList.remove('visible'), 4000);
}
function filled(value) { return value !== null && value !== undefined && value !== '' && value !== false; }
function allKeys(section) {
  const keys = section.fields.filter(f => f.type !== 'info').map(f => f.id);
  if (section.kind === 'risk') riskFactors.forEach(([k])=>keys.push('risk_'+k+'_current','risk_'+k+'_previous'));
  if (section.kind === 'exam') bodySystems.forEach(([k])=>keys.push('system_'+k));
  return keys;
}
function updateProgress() {
  const keys = sections.flatMap(allKeys);
  const completed = keys.filter(k => filled(record[k])).length;
  const percent = Math.round(100 * completed / keys.length);
  $('progress-value').textContent = percent + '%';
  $('progress-fill').style.width = percent + '%';
  $('progress-detail').textContent = completed+' de '+keys.length+' campos registrados';
  [...$('nav-list').querySelectorAll('[data-step]')].forEach((el) => {
    const n = Number(el.dataset.step);
    const has = allKeys(sections[n]).some(k => filled(record[k]));
    el.querySelector('.nav-done').textContent = has ? '✓' : '';
  });
}
function renderNav() {
  $('nav-list').innerHTML = sections.map((s,i)=>'<button type="button" class="nav-item '+(i===currentStep?'active':'')+'" data-step="'+i+'"><span class="nav-number">'+String(i+1).padStart(2,'0')+'</span><span>'+esc(s.title)+'</span><span class="nav-done"></span></button>').join('');
}
function fieldTemplate(f) {
  if (f.type === 'info') return '<div class="field span2 info-input">'+esc(f.label)+'</div>';
  const value = record[f.id] ?? '';
  const safeId = esc(f.id);
  const attr = 'data-field="'+safeId+'" id="field-'+safeId+'"';
  let control;
  if (f.type==='textarea') control='<textarea '+attr+' rows="'+(f.rows||3)+'" maxlength="3000" placeholder="Escribir aquí...">'+esc(value)+'</textarea>';
  else if (f.type==='select') control='<select '+attr+'><option value="">Seleccionar...</option>'+f.options.filter(Boolean).map(opt=>'<option value="'+esc(opt)+'" '+(String(value)===opt?'selected':'')+'>'+esc(opt)+'</option>').join('')+'</select>';
  else control='<input '+attr+' type="'+f.type+'" '+(f.type==='number'?'step="'+(f.step||'any')+'" ':'')+(f.id==='bmi'?'readonly title="Calculado a partir de peso y talla" ':'')+'value="'+esc(value)+'" '+(f.type==='text'?'maxlength="240"':'')+' />';
  return '<div class="field '+(f.span===2?'span2':'')+'"><label for="field-'+safeId+'">'+esc(f.label)+'</label>'+control+'</div>';
}
function riskTable() {
  return '<div class="span2"><div class="subheading">Exposición por factor de riesgo</div><table class="risk-table"><thead><tr><th>Factor de riesgo</th><th>Puesto actual</th><th>Puestos anteriores</th></tr></thead><tbody>'+riskFactors.map(([key,label,desc])=>'<tr><td><strong>'+esc(label)+'</strong><small>'+esc(desc)+'</small></td>'+['current','previous'].map((s)=>'<td><input aria-label="'+esc(label)+' '+s+'" type="checkbox" data-field="risk_'+key+'_'+s+'" '+(record['risk_'+key+'_'+s]?'checked':'')+' /></td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function systemsTable() {
  return '<div class="span2"><div class="subheading">Evaluación por sistemas</div><div class="systems-grid">'+bodySystems.map(([key,label])=>'<div class="system-item"><label for="system-'+key+'">'+esc(label)+'</label><select id="system-'+key+'" data-field="system_'+key+'"><option value="">Sin evaluar</option>'+['Sin hallazgos','Con hallazgos'].map(v=>'<option value="'+v+'" '+(record['system_'+key]===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div>').join('')+'</div></div>';
}
function renderStep() {
  const section = sections[currentStep];
  $('section-step').textContent='SECCIÓN '+String(currentStep+1).padStart(2,'0')+' DE '+sections.length;
  $('section-title').textContent=section.title;
  $('section-subtitle').textContent=section.subtitle;
  $('section-counter').textContent=String(currentStep+1).padStart(2,'0')+' / '+sections.length;
  const fields = section.fields.map(fieldTemplate);
  if (section.kind==='risk') fields.unshift(riskTable());
  if (section.kind==='exam') fields.splice(fields.length-1,0,systemsTable());
  $('section-form').innerHTML='<div class="fields-grid">'+fields.join('')+'</div>';
  $('back-button').disabled=currentStep===0;
  $('next-button').textContent=currentStep===sections.length-1?'Ir al inicio ↗':'Siguiente →';
  renderNav();
  updateProgress();
}
function setStep(n) {
  currentStep=Math.min(Math.max(n,0),sections.length-1);
  renderStep();
  window.scrollTo({top:0,behavior:'smooth'});
  document.querySelector('.sidebar').classList.remove('open');
}
function computeDerived(changedKey) {
  if (changedKey==='birth_date' && record.birth_date) {
    const dob = new Date(record.birth_date+'T12:00:00');
    const now = new Date();
    let yrs=now.getFullYear()-dob.getFullYear();
    if (now.getMonth()<dob.getMonth() || (now.getMonth()===dob.getMonth() && now.getDate()<dob.getDate())) yrs--;
    record.age=yrs>=0 && yrs<125 ? String(yrs) : '';
  }
  if (['weight','height'].includes(changedKey)) {
    const w=Number(record.weight),h=Number(record.height);
    record.bmi=w>0&&h>0 ? (w/(h*h)).toFixed(2):'';
  }
  for (const key of ['age','bmi']) {
    const input=$('field-'+key);
    if(input) input.value=record[key]||'';
  }
}
function snapshot(){return structuredClone(record);}
function hasUnsaved() {return dirty && Object.values(record).some(filled);}
function clearForm() {
  if (hasUnsaved()&&!window.confirm('La historia actual tiene cambios sin guardar. ¿Crear una historia nueva?'))return;
  record=emptyRecord(); loadedId=null; dirty=false; setStep(0);showToast('Nueva historia clínica lista.');
}
async function downloadPdf() {
  const button=$('export-button');
  const old=button.innerHTML;
  try{
    button.disabled=true;button.textContent='Generando PDF...';
    const pdf=await exportClinicalPdf(snapshot());
    const name=(record.name || 'historia_clinica').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').slice(0,55);
    const file='Historia_Ocupacional_'+name+'_'+(record.evaluation_date||new Date().toISOString().slice(0,10))+'.pdf';
    const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
    const link=document.createElement('a');link.href=url;link.download=file;document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    showToast('PDF generado con el formato original.');
  }catch(error){console.error(error);showToast('No se pudo generar el PDF: '+error.message)}
  finally{button.disabled=false;button.innerHTML=old}
}
async function cloudSave() {
  if(!db||!activeUser){showToast('La base de datos personal aún no está configurada.');return}
  if(!record.name?.trim()){showToast('Completa el nombre del trabajador antes de guardar.');setStep(2);return}
  const payload={patient_name:record.name.trim(),document_number:record.document||'',evaluation_date:record.evaluation_date||null,form_data:snapshot(),updated_at:new Date().toISOString(),created_by:activeUser.id};
  const button=$('save-button');button.disabled=true;button.textContent='Guardando...';
  try {
    let query;
    if(loadedId) query=db.from('clinic_histories').update(payload).eq('id',loadedId).select('id').single();
    else query=db.from('clinic_histories').insert(payload).select('id').single();
    const {data,error}=await query;
    if(error)throw error;
    loadedId=data.id;dirty=false;
    await loadRecords();
    showToast('Historia guardada de forma segura.');
  } catch(error){console.error(error);showToast('No se pudo guardar: '+error.message)}
  finally{button.disabled=false;button.textContent='Guardar historia'}
}
async function loadRecords() {
  if(!db||!activeUser)return;
  const {data,error}=await db.from('clinic_histories').select('id,patient_name,document_number,evaluation_date,form_data,updated_at').order('updated_at',{ascending:false}).limit(100);
  if(error){showToast('No se pudieron consultar las historias.');return}
  records=data||[];showRecords();
}
function showRecords() {
  const q=$('record-search').value.trim().toLowerCase();
  const filtered=records.filter(r=>(r.patient_name+' '+(r.document_number||'')).toLowerCase().includes(q));
  $('record-list').innerHTML=filtered.length?filtered.map(r=>'<button class="record-row" data-load-id="'+esc(r.id)+'"><strong>'+esc(r.patient_name)+'</strong><small>'+esc(r.document_number||'Sin documento')+' · '+esc(r.evaluation_date||'Sin fecha')+'</small></button>').join(''):'<p class="empty-list">No hay historias para mostrar.</p>';
}
function loadRecord(id) {
  const selected=records.find(r=>r.id===id);if(!selected)return;
  if(hasUnsaved() && !window.confirm('Hay cambios sin guardar. ¿Abrir otra historia?'))return;
  record={...emptyRecord(),...selected.form_data};loadedId=id;dirty=false;setStep(0);showToast('Historia cargada para revisión.');
}
async function authorizeUser(user) {
  const {data,error}=await db.from('clinic_staff').select('active').eq('user_id',user.id).maybeSingle();
  if(error||!data?.active) { await db.auth.signOut(); $('login-error').textContent='La cuenta aún no está autorizada para acceder a los registros médicos.'; $('auth-screen').hidden=false; $('app-shell').hidden=true;return }
  activeUser=user;
  $('auth-screen').hidden=true;$('app-shell').hidden=false;
  $('mode-label').textContent='Sesión clínica autorizada';
  $('mode-subtitle').textContent=user.email||'Acceso privado';
  $('logout-button').hidden=false;
  $('save-button').hidden=false;
  $('records-card').hidden=false;
  $('local-banner').hidden=true;
  renderStep();await loadRecords();
}
async function initAuth() {
  if(!db){
    $('auth-screen').hidden=true;$('app-shell').hidden=false;$('local-banner').hidden=false;
    renderStep();return;
  }
  $('auth-screen').hidden=false;
  const {data:{user},error}=await db.auth.getUser();
  if(!error&&user)await authorizeUser(user);
}
$('login-form').addEventListener('submit',async (e)=>{
  e.preventDefault();$('login-error').textContent='';
  const btn=$('login-form').querySelector('button');btn.disabled=true;btn.textContent='Verificando...';
  try{
    const {data,error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
    if(error)throw error;
    if(data.user)await authorizeUser(data.user);
  }catch(error){$('login-error').textContent='No fue posible iniciar sesión. Revisa tus credenciales y permisos.'}
  finally{btn.disabled=false;btn.textContent='Entrar al sistema'}
});
$('logout-button').addEventListener('click',async()=>{
  if(hasUnsaved()&&!window.confirm('Perderás los cambios sin guardar. ¿Cerrar sesión?'))return;
  await db.auth.signOut();activeUser=null;records=[];loadedId=null;record=emptyRecord();dirty=false;
  $('auth-screen').hidden=false;$('app-shell').hidden=true;$('login-password').value='';
});
$('section-form').addEventListener('input',(event)=>{
 const el=event.target.closest('[data-field]');if(!el)return;
 record[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;dirty=true;
 computeDerived(el.dataset.field);updateProgress();
});
$('section-form').addEventListener('change',(event)=>{
 const el=event.target.closest('[data-field]');if(!el)return;
 record[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;dirty=true;
 computeDerived(el.dataset.field);updateProgress();
});
$('nav-list').addEventListener('click',(e)=>{const el=e.target.closest('[data-step]');if(el)setStep(Number(el.dataset.step))});
$('record-list').addEventListener('click',(e)=>{const el=e.target.closest('[data-load-id]');if(el)loadRecord(el.dataset.loadId)});
$('record-search').addEventListener('input',showRecords);
$('refresh-records').addEventListener('click',loadRecords);
$('next-button').addEventListener('click',()=>setStep(currentStep===sections.length-1?0:currentStep+1));
$('back-button').addEventListener('click',()=>setStep(currentStep-1));
$('export-button').addEventListener('click',downloadPdf);
$('save-button').addEventListener('click',cloudSave);
$('new-button').addEventListener('click',clearForm);
$('menu-toggle').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
window.addEventListener('beforeunload',(event)=>{if(hasUnsaved()){event.preventDefault();event.returnValue='';}});
initAuth().catch((error)=>{console.error(error);$('auth-screen').hidden=false;$('login-error').textContent='No se pudo verificar el acceso.'});
