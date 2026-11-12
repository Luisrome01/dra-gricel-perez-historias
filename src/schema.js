
export const riskFactors = [
  ['physical', 'Físicos', 'Ruido, vibraciones, iluminación extrema, calor/frío y radiaciones'],
  ['chemical', 'Químicos', 'Polvos, humos, gases, vapores, solventes y sustancias tóxicas'],
  ['biological', 'Biológicos', 'Virus, bacterias, hongos y residuos médicos'],
  ['ergonomic', 'Disergonómicos', 'Posturas prolongadas, cargas y movimientos repetitivos'],
  ['mechanical', 'Mecánicos / Accidentes', 'Caídas, atrapamientos, herramientas y alturas'],
  ['psychosocial', 'Psicosociales', 'Alta carga mental, turnos nocturnos y estrés'],
];
export const bodySystems = [
  ['eyes','Ojos / Agudeza visual'],
  ['ears','Oídos / Otoscopia'],
  ['mouth','Boca / Faringe'],
  ['neck','Cuello / Tiroides'],
  ['chest','Tórax / Cardiopulmonar'],
  ['abdomen','Abdomen'],
  ['musculoskeletal','Sistema osteomuscular'],
  ['neurological','Sistema nervioso / Reflejos'],
  ['skin','Piel y faneras'],
];
const t=(id,label,span=1)=>({id,label,type:'text',span});
const a=(id,label,rows=3)=>({id,label,type:'textarea',rows,span:2});
const d=(id,label)=>({id,label,type:'date'});
const n=(id,label,step='any')=>({id,label,type:'number',step});
const s=(id,label,options)=>({id,label,type:'select',options});
const yesno=(id,label)=>s(id,label,['','Sí','No']);
export const sections = [
 {title:'Tipo de evaluación',subtitle:'Motivo de la valoración médica',icon:'clipboard-list',fields:[s('evaluation_type','Tipo de evaluación',['','Preempleo / Ingreso','Periódica / Control','Prevacacional / Postvacacional','Reubicación / Post-incapacidad','Egreso / Retiro'])]},
 {title:'Empresa y puesto',subtitle:'Contexto de exposición ocupacional',icon:'building-2',fields:[t('company','Empresa / Razón social',2),t('activity','Actividad económica',2),t('position','Puesto de trabajo',2),t('department','Área / Departamento'),t('tenure','Antigüedad en el puesto')]},
 {title:'Datos del trabajador',subtitle:'Información de identificación y contacto',icon:'user-round',fields:[t('name','Nombres y apellidos',2),t('document','Documento de identidad'),d('birth_date','Fecha de nacimiento'),n('age','Edad (años)'),s('gender','Género',['','M','F','Otro']),t('marital_status','Estado civil'),t('education','Nivel de instrucción'),s('hand','Mano hábil',['','Derecha','Izquierda','Ambidextra']),t('address','Domicilio',2),t('contact','Teléfono / Correo',2)]},
 {title:'Perfil del puesto',subtitle:'Actividades y funciones habituales',icon:'briefcase-business',fields:[a('tasks','Descripción de las tareas cotidianas',6)]},
 {title:'Riesgos ocupacionales',subtitle:'Exposición actual y anterior; protección personal',icon:'shield-alert',kind:'risk',fields:[s('ppe','Uso de equipos de protección personal',['','Sí','No','Parcial']),t('ppe_details','¿Cuáles equipos utiliza?',2)]},
 {title:'Salud laboral',subtitle:'Accidentes y enfermedades profesionales',icon:'heart-pulse',fields:[yesno('accidents','¿Accidentes de trabajo?'),yesno('occupational_disease','¿Enfermedad ocupacional diagnosticada?'),a('accidents_details','Accidentes: año, lesión y secuelas'),a('disease_details','Enfermedades ocupacionales: especificar')]},
 {title:'Antecedentes médicos',subtitle:'Historia médica personal, familiar y hábitos',icon:'notebook-pen',fields:[a('personal_history','Antecedentes patológicos personales'),a('surgical_history','Antecedentes quirúrgicos / traumáticos'),yesno('tobacco','Tabaco'),yesno('alcohol','Alcohol'),yesno('coffee','Café'),a('family_history','Antecedentes familiares')]},
 {title:'Examen físico actual',subtitle:'Signos vitales y evaluación por sistemas',icon:'stethoscope',kind:'exam',fields:[n('bp_sys','PA sistólica (mmHg)'),n('bp_dia','PA diastólica (mmHg)'),n('heart_rate','Frecuencia cardíaca (bpm)'),n('respiratory_rate','Frecuencia respiratoria (rpm)'),n('temperature','Temperatura (°C)'),n('weight','Peso (kg)'),n('height','Talla (m)',0.01),n('bmi','IMC (calculado)',0.01),s('weight_class','Antropometría',['','Normal','Sobrepeso','Obesidad']),a('systems_notes','Observaciones / Hallazgos por sistemas')]},
 {title:'Exámenes complementarios',subtitle:'Laboratorio y pruebas paraclínicas',icon:'microscope',fields:[a('laboratory','Laboratorio clínico: hemograma, glicemia, perfil lipídico'),s('audiometry','Audiometría',['','Normal','Alterado']),t('audiometry_notes','Hallazgos en audiometría'),s('spirometry','Espirometría',['','Normal','Alterado']),t('spirometry_notes','Hallazgos en espirometría'),s('optometry','Visiometría / Optometría',['','Normal','Alterado']),t('optometry_notes','Hallazgos en visiometría'),a('other_tests','Otros: Rayos X, ECG, etc.',2)]},
 {title:'Diagnósticos',subtitle:'Conclusión clínica y relación con el riesgo',icon:'file-heart',fields:[a('clinical_diagnosis','Diagnóstico clínico integral',4),a('risk_diagnosis','Diagnóstico relacionado con el riesgo laboral',4)]},
 {title:'Aptitud laboral',subtitle:'Concepto médico y recomendaciones',icon:'badge-check',fields:[s('fitness','Concepto de aptitud',['','APTO','APTO CON RESTRICCIONES','NO APTO']),a('recommendations','Recomendaciones / Plan de trabajo',5)]},
 {title:'Firmas y cierre',subtitle:'Identificación del evaluador y fecha',icon:'pen-line',fields:[t('doctor_name','Nombre del médico evaluador',2),t('professional_id','Registro profesional / Colegiatura',2),d('evaluation_date','Fecha de evaluación'),{id:'signature_info',type:'info',span:2,label:'El PDF dejará los espacios de firma del médico y del trabajador libres para firmar manualmente. No se genera una firma electrónica certificada.'}]}
];
export const emptyRecord = () => {
 const r={};
 sections.forEach(g=>g.fields.forEach(f=>{if(f.type!=='info')r[f.id]=''}));
 riskFactors.forEach(([id])=>{r['risk_'+id+'_current']=false;r['risk_'+id+'_previous']=false});
 bodySystems.forEach(([id])=>{r['system_'+id]=''});
 return r;
};
export const fieldLabel = (key) => sections.flatMap(s=>s.fields).find(f=>f.id===key)?.label || key;
