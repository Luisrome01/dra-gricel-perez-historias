import { sections, riskFactors, bodySystems, emptyRecord } from './schema.js';
import { exportClinicalPdf } from './pdf.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const $ = (id) => document.getElementById(id);
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured = window.CLINIC_CONFIG || {};
const url = (configured.supabaseUrl || '').trim();
const publicKey = (configured.publishableKey || '').trim();
const db = url && publicKey
  ? createClient(url, publicKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}})
  : null;
const viewSections = [sections[1], sections[2], sections[0], ...sections.slice(3)];
const shortTabs = ['Empresa','Paciente','Evaluación','Puesto','Riesgos','Salud laboral','Antecedentes','Examen físico','Paraclínicos','Diagnósticos','Aptitud','Firmas'];
const evaluationTypes = sections[0].fields[0].options.filter(Boolean);

const patientFields = [
  ['full_name','Nombres y apellidos','text',true],['document_number','Documento de identidad','text',false],
  ['birth_date','Fecha de nacimiento','date',false],['gender','Género','select',false,['','M','F','Otro']],
  ['marital_status','Estado civil','text',false],['education','Nivel de instrucción','text',false],
  ['hand','Mano hábil','select',false,['','Derecha','Izquierda','Ambidextra']],
  ['address','Dirección de domicilio','text',false],['contact','Teléfono / Correo','text',false],
];
const companyFields = [
  ['name','Razón social','text',true],['economic_activity','Actividad económica','text',false],
  ['contact_name','Persona de contacto','text',false],['contact_phone','Teléfono','text',false],
  ['contact_email','Correo de la empresa','email',false],['address','Dirección','text',false],
];

let activeUser = null, patients = [], companies = [], histories = [];
let selectedPatientId = null, selectedCompanyId = null, historyId = null;
let record = emptyRecord(), step = 0, dirty = false;
let mainTab = 'histories', directoryTab = 'patients', formOpen = false;
let modalType = 'patients', modalId = null, quickLink = false, toastTimer;

function toast(message, isError = false) {
  const node = $('toast');
  node.textContent = message; node.classList.toggle('error',isError); node.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 4400);
}
function filled(v) { return v !== '' && v !== undefined && v !== null && v !== false; }
function shortDate(iso) {
  if (!iso) return 'Sin fecha';
  const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3]+'/'+m[2]+'/'+m[1] : iso;
}
function localToday(){
  const d=new Date(); const n=v=>String(v).padStart(2,'0');
  return d.getFullYear()+'-'+n(d.getMonth()+1)+'-'+n(d.getDate());
}
function hasUnsaved(){return dirty && Object.values(record).some(filled);}
function exitWarning(){return !hasUnsaved() || confirm('Hay cambios en la historia que no se han guardado. ¿Deseas salir sin guardarlos?');}
function sortByName(a,b,key){return String(a[key]||'').localeCompare(String(b[key]||''),'es',{sensitivity:'base'});}
function option(id,label,selected){return '<option value="'+escapeHtml(id)+'" '+(selected===id?'selected':'')+'>'+escapeHtml(label)+'</option>';}

function switchPrimary(target){
  if (target===mainTab)return;
  if(formOpen && !exitWarning())return;
  mainTab=target;formOpen=false;
  document.querySelectorAll('#primary-tabs [data-main-tab]').forEach(b=>{
    const active=b.dataset.mainTab===target;
    b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));
  });
  $('histories-view').hidden=target!=='histories';
  $('directory-view').hidden=target!=='directory';
  $('history-list-view').hidden=false;$('history-editor-view').hidden=true;
  if(target==='directory')renderDirectory();else renderHistoryTable();
}
function switchDirectory(tab){
  directoryTab=tab; $('directory-search').value='';
  document.querySelectorAll('#directory-tabs [data-directory-tab]').forEach(b=>{
    const active=b.dataset.directoryTab===tab;
    b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));
  });
  renderDirectory();
}
function showEditor() {
  formOpen=true;mainTab='histories';
  $('history-list-view').hidden=true;$('history-editor-view').hidden=false;$('histories-view').hidden=false;
  $('directory-view').hidden=true;
  document.querySelectorAll('#primary-tabs [data-main-tab]').forEach(b=>{
    const active=b.dataset.mainTab==='histories';
    b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));
  });
  $('editor-heading').textContent=historyId ? 'Editar historia clínica' : 'Nueva historia clínica';
  $('editor-state').textContent=historyId ? 'Historia guardada · en edición' : 'Nueva evaluación';
  renderFormStep();
  window.scrollTo({top:0,behavior:'smooth'});
}
function resetHistory(){
  if(formOpen && !exitWarning())return;
  record=emptyRecord();
  record.evaluation_date=localToday();
  selectedPatientId=null;selectedCompanyId=null;historyId=null;step=0;dirty=false;
  showEditor();
}
function loadHistory(id){
  if(formOpen && !exitWarning())return;
  const item=histories.find(h=>h.id===id);if(!item)return;
  record={...emptyRecord(),...(item.form_data||{})};
  selectedPatientId=item.patient_id||null;
  selectedCompanyId=item.company_id||null;
  historyId=id;step=0;dirty=false;showEditor();
}
function closeEditor(){
  if(!exitWarning())return;
  formOpen=false;dirty=false;
  $('history-editor-view').hidden=true;$('history-list-view').hidden=false;
  renderHistoryTable();window.scrollTo({top:0,behavior:'smooth'});
}
function setStep(index){
  step=Math.min(Math.max(0,index),viewSections.length-1);
  renderFormStep();
}
function formField(f){
  if(f.type==='info')return '<div class="info-field span2">'+escapeHtml(f.label)+'</div>';
  const val=record[f.id] ?? '';
  const field='data-field="'+escapeHtml(f.id)+'" id="field-'+escapeHtml(f.id)+'"';
  let el='';
  if(f.type==='textarea')el='<textarea '+field+' rows="'+(f.rows||3)+'" maxlength="3000" placeholder="Escribe aquí los detalles...">'+escapeHtml(val)+'</textarea>';
  else if(f.type==='select')el='<select '+field+'>'+f.options.map((s,i)=>'<option value="'+escapeHtml(s)+'" '+(val===s?'selected':'')+'>'+(s?escapeHtml(s):'Seleccionar...')+'</option>').join('')+'</select>';
  else el='<input '+field+' type="'+escapeHtml(f.type)+'" '+(f.type==='number'?'step="'+escapeHtml(f.step||'any')+'" ':'')+' '+(f.id==='bmi'?'readonly title="Calculado automáticamente" ':'')+' value="'+escapeHtml(val)+'" maxlength="3000" />';
  return '<div class="field '+(f.span===2?'span2':'')+'"><label for="field-'+escapeHtml(f.id)+'">'+escapeHtml(f.label)+'</label>'+el+'</div>';
}
function riskMatrix(){
  const rows=riskFactors.map(([id,label,description])=>'<tr><td><strong>'+escapeHtml(label)+'</strong><small>'+escapeHtml(description)+'</small></td>'+
    ['current','previous'].map(which=>{
      const k='risk_'+id+'_'+which;
      return '<td><input type="checkbox" data-field="'+k+'" aria-label="'+escapeHtml(label+' '+(which==='current'?'actual':'anterior'))+'" '+(record[k]?'checked':'')+' /></td>';
    }).join('')+'</tr>').join('');
  return '<div class="span2"><p class="subheading">Exposición a riesgos</p><div class="table-scroll"><table class="risk-table"><thead><tr><th>Factor de riesgo</th><th>Actual</th><th>Anterior</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function systemMatrix(){
  return '<div class="span2"><p class="subheading">Evaluación por sistemas</p><div class="systems-grid">'+bodySystems.map(([key,label])=>{
    const v=record['system_'+key]||'';
    return '<div class="field"><label for="system-'+key+'">'+escapeHtml(label)+'</label><select id="system-'+key+'" data-field="system_'+key+'">'+
      ['','Sin hallazgos','Con hallazgos'].map(x=>'<option value="'+escapeHtml(x)+'" '+(v===x?'selected':'')+'>'+(x||'Sin evaluar')+'</option>').join('')+'</select></div>';
  }).join('')+'</div></div>';
}
function catalogPicker(){
  const first=step===0,patient=step===1;
  if(!first&&!patient){$('catalog-picker').hidden=true;return}
  const list=first?companies:patients;
  const id=first?selectedCompanyId:selectedPatientId;
  const title=first?'Empresa registrada':'Paciente registrado';
  const opts=list.slice().sort((a,b)=>sortByName(a,b,first?'name':'full_name'))
    .map(x=>option(x.id,first?x.name:x.full_name+(x.document_number?' · '+x.document_number:''),id)).join('');
  $('catalog-picker').hidden=false;
  $('catalog-picker').innerHTML='<div><label for="linked-catalog">'+title+'</label>'+
    '<select id="linked-catalog"><option value="">Seleccionar del directorio o escribir manualmente...</option>'+opts+'</select></div>'+
    '<button type="button" class="btn light" id="create-linked" data-kind="'+(first?'companies':'patients')+'">+ Registrar '+(first?'empresa':'paciente')+'</button>'+
    '<p class="picker-hint">Al seleccionar un registro, sus datos se incorporan a esta historia.</p>';
}
function countProgress(){
  const keys=viewSections.flatMap(section=>section.fields.filter(f=>f.type!=='info').map(f=>f.id));
  riskFactors.forEach(([k])=>keys.push('risk_'+k+'_current','risk_'+k+'_previous'));
  bodySystems.forEach(([k])=>keys.push('system_'+k));
  return {done:keys.filter(key=>filled(record[key])).length,total:keys.length};
}
function renderFormStep(){
  const section=viewSections[step];
  $('form-tabs').innerHTML=shortTabs.map((label,i)=>'<button type="button" role="tab" aria-selected="'+(i===step)+'" class="tab '+(i===step?'active':'')+'" data-step="'+i+'">'+
    '<span class="tab-counter">'+(i+1)+'</span>'+escapeHtml(label)+'</button>').join('');
  $('section-number').textContent=String(step+1).padStart(2,'0');
  $('form-section-heading').textContent=section.title;
  $('form-section-caption').textContent=section.subtitle;
  $('form-step-indicator').textContent=(step+1)+' de '+viewSections.length;
  const fields=section.fields.map(formField);
  if(section.kind==='risk') fields.unshift(riskMatrix());
  if(section.kind==='exam') fields.splice(fields.length-1,0,systemMatrix());
  $('section-form').innerHTML=fields.join('');
  catalogPicker();
  $('prev-form-tab').disabled=step===0;
  const last=step===viewSections.length-1;
  $('next-form-tab').hidden=last;
  $('save-history').hidden=!last;
  $('export-pdf').hidden=!last;
  const {done,total}=countProgress();const pct=Math.round(100*done/total);
  $('progress-percentage').textContent=pct+'%';
  $('progress-bar').style.width=pct+'%';
  requestAnimationFrame(()=>{
    const active=$('form-tabs').querySelector('.tab.active');
    if(active)active.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  });
}
function updateDerived(field){
  if(field==='birth_date'){
    const dob=record.birth_date&&new Date(record.birth_date+'T12:00:00');
    const now=new Date();
    if(dob && !isNaN(+dob)){
      let y=now.getFullYear()-dob.getFullYear();
      if(now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate()))y--;
      record.age=y>=0&&y<125?String(y):'';
    }else record.age='';
  }
  if(field==='weight'||field==='height'){
    const w=Number(record.weight),h=Number(record.height);
    record.bmi=(w>0&&h>0)?(w/(h*h)).toFixed(2):'';
  }
  ['age','bmi'].forEach(k=>{const el=$('field-'+k);if(el)el.value=record[k]||''});
}
function updateProgress(){
  const {done,total}=countProgress(),pct=Math.round(100*done/total);
  $('progress-percentage').textContent=pct+'%';$('progress-bar').style.width=pct+'%';
}
function applyLinked(kind,id){
  const isCompany=kind==='companies';
  if(isCompany)selectedCompanyId=id||null;else selectedPatientId=id||null;
  const item=(isCompany?companies:patients).find(x=>x.id===id);
  if(!item){dirty=true;updateProgress();return}
  if(isCompany){
    record.company=item.name||'';
    record.activity=item.economic_activity||'';
  }else{
    const pairs={
      name:'full_name',document:'document_number',birth_date:'birth_date',gender:'gender',
      marital_status:'marital_status',education:'education',hand:'hand',address:'address',contact:'contact'
    };
    Object.entries(pairs).forEach(([target,source])=>record[target]=item[source]||'');
    updateDerived('birth_date');
  }
  dirty=true;renderFormStep();toast('Datos incorporados desde el directorio.');
}
function renderHistoryTable(){
  $('histories-total').textContent=histories.length;
  $('patients-total').textContent=patients.length;
  $('companies-total').textContent=companies.length;
  const search=$('history-search').value.toLocaleLowerCase('es').trim();
  const type=$('history-type-filter').value, date=$('history-date-filter').value;
  const sort=$('history-sort').value;
  const list=histories.filter(h=>{
    const d=h.form_data||{};
    if(type && d.evaluation_type!==type)return false;
    if(date && h.evaluation_date!==date)return false;
    if(search && ![h.patient_name,h.document_number,d.company,d.evaluation_type].join(' ').toLowerCase().includes(search))return false;
    return true;
  }).sort((a,b)=>{
    if(sort.startsWith('type-')){
      const cmp=String(a.form_data?.evaluation_type||'').localeCompare(String(b.form_data?.evaluation_type||''),'es');
      return sort==='type-asc'?cmp:-cmp;
    }
    const cmp=(a.evaluation_date||'').localeCompare(b.evaluation_date||'');
    return sort==='date-asc'?cmp:-cmp;
  });
  $('histories-rows').innerHTML=list.length?list.map(h=>{
    const d=h.form_data||{};
    const status=d.fitness||'Pendiente';
    return '<tr><td class="date-col">'+escapeHtml(shortDate(h.evaluation_date))+'</td>'+
      '<td><strong>'+escapeHtml(h.patient_name||'Sin nombre')+'</strong><small>'+escapeHtml(h.document_number||'Sin documento')+'</small></td>'+
      '<td>'+escapeHtml(d.company||'—')+'</td>'+
      '<td><span class="tag neutral">'+escapeHtml(d.evaluation_type||'Sin clasificar')+'</span></td>'+
      '<td><span class="tag '+(status==='APTO'?'positive':'neutral')+'">'+escapeHtml(status)+'</span></td>'+
      '<td><button type="button" class="btn table-action" data-open-history="'+escapeHtml(h.id)+'">Abrir →</button></td></tr>';
  }).join(''):'<tr><td colspan="6" class="empty-table"><div class="empty-illustration">▤</div><strong>No hay historias para mostrar</strong><p>Prueba otros filtros o crea una nueva historia.</p></td></tr>';
  $('history-list-message').textContent=list.length+' de '+histories.length+' historias';
}
function renderDirectory(){
  const isPatients=directoryTab==='patients', source=isPatients?patients:companies;
  $('directory-title').textContent=isPatients?'Pacientes registrados':'Empresas registradas';
  $('directory-subtitle').textContent=isPatients?'Directorio de trabajadores y su información personal.':'Directorio de organizaciones y actividades económicas.';
  $('new-catalog-item').textContent=isPatients?'+ Registrar paciente':'+ Registrar empresa';
  const cols=isPatients?['Nombre','Documento','Contacto',''] : ['Empresa','Actividad económica','Contacto',''];
  $('directory-table-head').innerHTML='<tr>'+cols.map((c,i)=>'<th '+(i===cols.length-1?'class="action-head"':'')+'>'+escapeHtml(c)+'</th>').join('')+'</tr>';
  const q=$('directory-search').value.toLowerCase().trim();
  const list=source.filter(r=>Object.values(r).some(x=>typeof x==='string'&&x.toLowerCase().includes(q)))
    .sort((a,b)=>sortByName(a,b,isPatients?'full_name':'name'));
  $('directory-table-body').innerHTML=list.length?list.map(r=>{
    const name=isPatients?r.full_name:r.name;
    return '<tr><td><strong>'+escapeHtml(name)+'</strong></td><td>'+escapeHtml(isPatients?(r.document_number||'—'):(r.economic_activity||'—'))+'</td>'+
      '<td>'+escapeHtml(isPatients?(r.contact||'—'):(r.contact_phone||r.contact_email||'—'))+'</td>'+
      '<td><button type="button" class="btn table-action" data-edit-kind="'+(isPatients?'patients':'companies')+'" data-edit-id="'+escapeHtml(r.id)+'">Editar →</button></td></tr>';
  }).join(''):'<tr><td colspan="4" class="empty-table"><div class="empty-illustration">▤</div><strong>Aún no hay '+(isPatients?'pacientes':'empresas')+'</strong><p>Registra el primer elemento para usarlo en las historias.</p></td></tr>';
  $('directory-message').textContent=list.length+' registros mostrados';
}
function modalField(item,val){
  const [key,label,type,required,opts]=item;
  const id='catalog-'+key;
  const attr='name="'+escapeHtml(key)+'" id="'+escapeHtml(id)+'" '+(required?'required':'');
  let html;
  if(type==='select')html='<select '+attr+'>'+opts.map(o=>'<option value="'+escapeHtml(o)+'" '+(o===val?'selected':'')+'>'+(o||'Seleccionar...')+'</option>').join('')+'</select>';
  else html='<input '+attr+' type="'+type+'" maxlength="240" value="'+escapeHtml(val||'')+'" />';
  return '<div class="field"><label for="'+escapeHtml(id)+'">'+escapeHtml(label)+(required?' *':'')+'</label>'+html+'</div>';
}
function openCatalog(kind,id=null,fromEditor=false){
  if(!db||!activeUser){toast('Necesitas iniciar sesión para registrar datos.',true);return}
  modalType=kind;modalId=id;quickLink=fromEditor;
  const source=kind==='patients'?patients:companies;
  const item=source.find(x=>x.id===id)||{};
  const isPatient=kind==='patients';
  $('catalog-modal-title').textContent=(id?'Editar ':'Registrar ')+(isPatient?'paciente':'empresa');
  $('catalog-fields').innerHTML=(isPatient?patientFields:companyFields).map(f=>modalField(f,item[f[0]])).join('');
  $('catalog-error').textContent='';
  $('catalog-modal').hidden=false;
  document.body.classList.add('modal-open');
  $('catalog-fields').querySelector('input,select')?.focus();
}
function closeCatalog(){
  $('catalog-modal').hidden=true;document.body.classList.remove('modal-open');
  modalId=null;quickLink=false;
}
async function saveCatalog(event){
  event.preventDefault();
  if(!db||!activeUser)return;
  const isPatient=modalType==='patients',table=isPatient?'clinic_patients':'clinic_companies';
  const fields=isPatient?patientFields:companyFields;
  const form=new FormData($('catalog-form'));
  const data={created_by:activeUser.id,updated_at:new Date().toISOString()};
  fields.forEach(([key,typeLabel,type])=>{
    const value=String(form.get(key)||'').trim();
    data[key]=type==='date'?(value||null):value;
  });
  if(!(data[isPatient?'full_name':'name']||'').trim()){
    $('catalog-error').textContent='Completa el nombre para continuar.';return;
  }
  const button=$('catalog-submit');button.disabled=true;button.textContent='Guardando...';
  try{
    const result=modalId?
      await db.from(table).update(data).eq('id',modalId).select().single():
      await db.from(table).insert(data).select().single();
    if(result.error)throw result.error;
    const saved=result.data;
    const doLink=quickLink;
    const wasEditing=Boolean(modalId);
    await fetchData();
    closeCatalog();
    if(doLink && formOpen)applyLinked(modalType,saved.id);
    toast((isPatient?'Paciente':'Empresa')+' '+(wasEditing?'actualizado/a':'registrado/a')+' correctamente.');
  }catch(e){console.error(e);$('catalog-error').textContent=e.code==='23505'?'Este registro ya existe. Revisa el nombre o documento.':'No se pudo guardar el registro: '+e.message}
  finally{button.disabled=false;button.textContent='Guardar registro'}
}
async function fetchData(){
  if(!db||!activeUser){histories=[];patients=[];companies=[];renderHistoryTable();return}
  const [h,p,c]=await Promise.all([
    db.from('clinic_histories').select('id,patient_name,document_number,evaluation_date,form_data,patient_id,company_id,updated_at').order('updated_at',{ascending:false}).limit(1000),
    db.from('clinic_patients').select('*').order('full_name',{ascending:true}).limit(1000),
    db.from('clinic_companies').select('*').order('name',{ascending:true}).limit(1000)
  ]);
  const errors=[h.error,p.error,c.error].filter(Boolean);
  if(errors.length){console.error(errors);toast('Error cargando datos del proyecto clínico. Revisa tus permisos.',true)}
  if(!h.error)histories=h.data||[];
  if(!p.error)patients=p.data||[];
  if(!c.error)companies=c.data||[];
  renderHistoryTable();if(!$('directory-view').hidden)renderDirectory();
}
async function saveHistory(){
  if(!db||!activeUser){toast('El guardado requiere una sesión válida.',true);return}
  if(!record.name?.trim()){toast('Completa el nombre del paciente.',true);setStep(1);return}
  if(!record.evaluation_type){toast('Selecciona el tipo de evaluación.',true);setStep(2);return}
  if(!record.evaluation_date){toast('Selecciona la fecha de evaluación.',true);setStep(viewSections.length-1);return}
  const payload={
    created_by:activeUser.id, patient_name:record.name.trim(),document_number:record.document||'',
    evaluation_date:record.evaluation_date,form_data:structuredClone(record),
    patient_id:selectedPatientId||null,company_id:selectedCompanyId||null,
    updated_at:new Date().toISOString()
  };
  const button=$('save-history');button.disabled=true;button.textContent='Guardando...';
  try{
    const op=historyId?db.from('clinic_histories').update(payload).eq('id',historyId).select('id').single()
                      :db.from('clinic_histories').insert(payload).select('id').single();
    const {data,error}=await op;
    if(error)throw error;
    historyId=data.id;dirty=false;
    $('editor-heading').textContent='Editar historia clínica';
    $('editor-state').textContent='Historia guardada';
    await fetchData();
    toast('Historia clínica guardada correctamente.');
  }catch(e){console.error(e);toast('No se pudo guardar la historia: '+e.message,true)}
  finally{button.disabled=false;button.textContent='Guardar historia'}
}
async function downloadPdf(){
  const button=$('export-pdf');button.disabled=true;button.textContent='Generando PDF...';
  try{
    const bytes=await exportClinicalPdf(structuredClone(record));
    const name=(record.name||'Sin_nombre').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').slice(0,55);
    const filename='Historia_Ocupacional_'+name+'_'+(record.evaluation_date||localToday())+'.pdf';
    const obj=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const a=document.createElement('a');a.href=obj;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(obj),60000);
    toast('PDF exportado conservando el formato original.');
  }catch(e){console.error(e);toast('No se pudo generar el PDF: '+e.message,true)}
  finally{button.disabled=false;button.textContent='↓ Exportar PDF'}
}
async function verifyAccess(user){
  if(!db)return;
  const {data,error}=await db.from('clinic_staff').select('active,role').eq('user_id',user.id).maybeSingle();
  if(error||!data?.active){
    await db.auth.signOut();
    $('app-shell').hidden=true;$('auth-screen').hidden=false;
    $('login-error').textContent='Esta cuenta todavía no está autorizada en el proyecto clínico.';
    return;
  }
  activeUser=user;
  $('auth-screen').hidden=true;$('app-shell').hidden=false;
  $('logout-button').hidden=false;
  $('user-email').textContent=user.email||'Usuario clínico';
  await fetchData();
}
async function start(){
  $('history-type-filter').innerHTML='<option value="">Todas las evaluaciones</option>'+
    evaluationTypes.map(x=>option(x,x,'')).join('');
  if(!db){
    $('auth-screen').hidden=true;$('app-shell').hidden=false;$('local-banner').hidden=false;
    $('new-catalog-item').disabled=true;
    await fetchData();return;
  }
  $('auth-screen').hidden=false;
  const {data,error}=await db.auth.getUser();
  if(!error && data.user)await verifyAccess(data.user);
}
$('login-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!db)return;
  const button=$('login-form').querySelector('button');
  button.disabled=true;button.textContent='Verificando...';$('login-error').textContent='';
  try{
    const {data,error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
    if(error)throw error;
    await verifyAccess(data.user);
  }catch(e){console.error(e);$('login-error').textContent='No se pudo iniciar sesión. Verifica tus credenciales.'}
  finally{button.disabled=false;button.textContent='Entrar al sistema'}
});
$('logout-button').addEventListener('click',async()=>{
  if(formOpen && !exitWarning())return;
  await db.auth.signOut();activeUser=null;histories=[];patients=[];companies=[];formOpen=false;dirty=false;
  $('app-shell').hidden=true;$('auth-screen').hidden=false;$('login-password').value='';
});
$('primary-tabs').addEventListener('click',e=>{
  const tab=e.target.closest('[data-main-tab]');if(tab)switchPrimary(tab.dataset.mainTab);
});
$('directory-tabs').addEventListener('click',e=>{
  const tab=e.target.closest('[data-directory-tab]');if(tab)switchDirectory(tab.dataset.directoryTab);
});
$('new-history').addEventListener('click',resetHistory);
$('back-to-histories').addEventListener('click',closeEditor);
$('form-tabs').addEventListener('click',e=>{
  const tab=e.target.closest('[data-step]');if(tab)setStep(Number(tab.dataset.step));
});
$('scroll-tabs-prev').addEventListener('click',()=>$('form-tabs').scrollBy({left:-280,behavior:'smooth'}));
$('scroll-tabs-next').addEventListener('click',()=>$('form-tabs').scrollBy({left:280,behavior:'smooth'}));
$('prev-form-tab').addEventListener('click',()=>setStep(step-1));
$('next-form-tab').addEventListener('click',()=>setStep(step+1));
$('save-history').addEventListener('click',saveHistory);
$('export-pdf').addEventListener('click',downloadPdf);
$('section-form').addEventListener('input',e=>{
  const el=e.target.closest('[data-field]');if(!el)return;
  record[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;
  dirty=true;updateDerived(el.dataset.field);updateProgress();
});
$('section-form').addEventListener('change',e=>{
  const el=e.target.closest('[data-field]');if(!el)return;
  record[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;
  dirty=true;updateDerived(el.dataset.field);updateProgress();
});
$('catalog-picker').addEventListener('change',e=>{
  if(e.target.id==='linked-catalog')applyLinked(step===0?'companies':'patients',e.target.value);
});
$('catalog-picker').addEventListener('click',e=>{
  const btn=e.target.closest('[data-kind]');if(btn)openCatalog(btn.dataset.kind,null,true);
});
$('histories-rows').addEventListener('click',e=>{
  const btn=e.target.closest('[data-open-history]');if(btn)loadHistory(btn.dataset.openHistory);
});
['history-search','history-type-filter','history-date-filter','history-sort'].forEach(id=>{
  $(id).addEventListener(id==='history-search'?'input':'change',renderHistoryTable);
});
$('new-catalog-item').addEventListener('click',()=>openCatalog(directoryTab));
$('directory-search').addEventListener('input',renderDirectory);
$('directory-table-body').addEventListener('click',e=>{
  const b=e.target.closest('[data-edit-id]');if(b)openCatalog(b.dataset.editKind,b.dataset.editId,false);
});
$('catalog-form').addEventListener('submit',saveCatalog);
$('catalog-modal-close').addEventListener('click',closeCatalog);
$('catalog-cancel').addEventListener('click',closeCatalog);
$('catalog-modal').addEventListener('click',e=>{if(e.target===$('catalog-modal'))closeCatalog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('catalog-modal').hidden)closeCatalog()});
window.addEventListener('beforeunload',e=>{if(hasUnsaved()){e.preventDefault();e.returnValue=''}});
start().catch(e=>{console.error(e);$('auth-screen').hidden=false;$('login-error').textContent='No se pudo verificar el acceso.'});
