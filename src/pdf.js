import { PDFDocument, StandardFonts, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { riskFactors, bodySystems, fieldLabel } from './schema.js';

const PAGE_H = 792;
const ink = rgb(0.07,0.24,0.36);
const white = rgb(1,1,1);
let sourceBytes;
async function getOriginalTemplate() {
  if(sourceBytes) return sourceBytes;
  const res = await fetch('/public/plantilla.pdf.gz.b64', {cache:'force-cache'});
  if(!res.ok) throw new Error('No se encontró la plantilla PDF original.');
  const encoded=(await res.text()).trim();
  const compressed=Uint8Array.from(atob(encoded), c=>c.charCodeAt(0));
  if(!('DecompressionStream' in window)) throw new Error('El navegador no admite descompresión de la plantilla.');
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  sourceBytes=new Uint8Array(await new Response(stream).arrayBuffer());
  return sourceBytes;
}
function valueOf(data,key){ const v=data[key]; return v===undefined||v===null ? '' : String(v).trim() }
function datestr(text) {
 if(!text)return '';
 const match=String(text).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 return match ? match[3]+' / '+match[2]+' / '+match[1] : text;
}
function readable(str) {
 // The source form uses Helvetica/WinAnsi. Remove characters unsupported by that font.
 return String(str||'').replace(/[\u0000-\u001f]/g,' ').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\u0020-\u007e\u00a0-\u00ff]/g,'?');
}
function fitSize(font,text,width,start=8.4,min=6) {
 let size=start;
 while(font.widthOfTextAtSize(text,size)>width && size>min)size-=0.2;
 return Math.max(min,size);
}
function write(page,text,x,top,width,font,extra,label) {
 text=readable(text);
 if(!text.trim())return;
 const size=fitSize(font,text,width);
 if(font.widthOfTextAtSize(text,size)>width+1) {
  extra.push({label:label||'Campo adicional',text});
  text='Ver anexo';
 }
 const y=PAGE_H-top-11;
 page.drawRectangle({x:x-1,y:y-2,width:width+2,height:13,color:white});
 page.drawText(text,{x,y,size:fitSize(font,text,width),font,color:ink});
}
function wrap(font,txt,maxWidth,sz=8.1) {
 const words=readable(txt).replace(/\r/g,'').split(/\s+/).filter(Boolean);
 const lines=[];let line='';
 words.forEach(word=>{
  const next=line?line+' '+word:word;
  if(font.widthOfTextAtSize(next,sz)>maxWidth && line){lines.push(line);line=word}else line=next;
  if(font.widthOfTextAtSize(line,sz)>maxWidth) {
    // Break exceptionally long words to avoid clipping.
    while(font.widthOfTextAtSize(line,sz)>maxWidth){
      let n=line.length;
      while(n>1 && font.widthOfTextAtSize(line.slice(0,n),sz)>maxWidth)n--;
      lines.push(line.slice(0,n));line=line.slice(n);
    }
  }
 });
 if(line)lines.push(line);
 return lines;
}
function multi(page,txt,x,top,width,numLines,lineGap,font,extra,label) {
 if(!String(txt||'').trim())return;
 const lines=wrap(font,txt,width,8.1);
 if(lines.length>numLines){
   extra.push({label,text:String(txt)});
   write(page,'Ver anexo',x,top,width,font,extra,label);return;
 }
 lines.forEach((line,i)=>write(page,line,x,top+i*lineGap,width,font,extra,label));
}
function tick(page,x,top,font) {
 page.drawText('X',{x:x+1.8,y:PAGE_H-top-9.5,size:7.4,font,color:ink});
}
function opt(page,data,key,expected,x,top,font) {if(valueOf(data,key)===expected)tick(page,x,top,font)}
function yesno(page,data,key,xYes,xNo,top,font) {
 opt(page,data,key,'Sí',xYes,top,font);opt(page,data,key,'No',xNo,top,font);
}
function appendix(doc,extras,font,bold) {
 if(!extras.length)return;
 let pg, y;
 const newPage=()=>{
  pg=doc.addPage([612,792]);y=724;
  pg.drawText('ANEXO DE INFORMACIÓN CLÍNICA',{x:47,y:745,size:15,font:bold,color:ink});
  pg.drawText('Continuación de campos extensos y observaciones del examen.',{x:47,y:727,size:8.5,font,color:rgb(.42,.51,.6)});
  y=696;
 };
 newPage();
 for(const item of extras) {
  const paragraphs=String(item.text).split(/\n/);
  const lines=paragraphs.flatMap(v=>wrap(font,v,504,9));
  const need=26+lines.length*13+14;
  if(y-need<56)newPage();
  pg.drawText(readable(item.label).slice(0,110),{x:47,y,size:10,font:bold,color:ink});y-=18;
  lines.forEach(line=>{if(y<60)newPage();pg.drawText(line,{x:47,y,size:9,font,color:rgb(.13,.21,.29)});y-=13});
  y-=16;
 }
}
export async function exportClinicalPdf(data) {
 const original=await getOriginalTemplate();
 const pdf=await PDFDocument.load(original.slice());
 const font=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const pages=pdf.getPages();
 if(pages.length!==4)throw new Error('La plantilla no contiene las cuatro hojas esperadas.');
 const [p1,p2,p3,p4]=pages;
 const extra=[];
 const put=(page,key,x,y,w)=>write(page,valueOf(data,key),x,y,w,font,extra,fieldLabel(key));
 const mul=(page,key,x,y,w,n,gap)=>multi(page,valueOf(data,key),x,y,w,n,gap,font,extra,fieldLabel(key));
 // 1. Tipo de evaluación
 [['Preempleo / Ingreso',46,143.3],['Periódica / Control',223,143.3],['Prevacacional / Postvacacional',400,143.3],['Reubicación / Post-incapacidad',46,163.3],['Egreso / Retiro',223,163.3]].forEach(([name,x,y])=>opt(p1,data,'evaluation_type',name,x,y,font));
 // 2. Empresa y puesto
 put(p1,'company',213,224.3,330);
 put(p1,'activity',143,244.3,386);
 put(p1,'position',174,264.3,357);
 put(p1,'department',141,284.3,378);
 put(p1,'tenure',185,304.3,348);
 // 3. Identificación
 put(p1,'name',143,365.3,376);
 put(p1,'document',48,399.3,106);
 write(p1,datestr(valueOf(data,'birth_date')),406,399.3,105,font,extra,'Fecha de nacimiento');
 put(p1,'age',73,419.3,32);
 [['M',349],['F',369],['Otro',387]].forEach(([v,x])=>opt(p1,data,'gender',v,x,419.3,font));
 put(p1,'marital_status',104,439.3,105);
 put(p1,'education',403,439.3,140);
 [['Derecha',99.5],['Izquierda',146],['Ambidextra',195.6]].forEach(([v,x])=>opt(p1,data,'hand',v,x,459.3,font));
 put(p1,'address',149,479.3,379);
 put(p1,'contact',128,499.3,388);
 // 4. Perfil del puesto
 mul(p1,'tasks',48,579.3,496,4,20);
 // 5. Exposición a riesgos
 const rowY=[179.3,199.3,219.3,246.3,280.3,307.3];
 riskFactors.forEach(([key],i)=>{
  if(data['risk_'+key+'_current'])tick(p2,448,rowY[i],font);
  if(data['risk_'+key+'_previous'])tick(p2,528,rowY[i],font);
 });
 [['Sí',248.6],['No',269.6],['Parcial',293.6]].forEach(([v,x])=>opt(p2,data,'ppe',v,x,332.3,font));
 put(p2,'ppe_details',121,350.3,389);
 // 6. Salud laboral
 yesno(p2,data,'accidents',205.5,226.5,408.3,font);
 put(p2,'accidents_details',189,428.3,330);
 yesno(p2,data,'occupational_disease',302.6,323.6,448.3,font);
 put(p2,'disease_details',97,468.3,421);
 // 7. Salud personal / familiar
 mul(p2,'personal_history',48,549.3,495,1,15);
 put(p2,'surgical_history',165,569.3,357);
 yesno(p2,data,'tobacco',179.5,200.5,589.3,font);
 yesno(p2,data,'alcohol',267.9,288.9,589.3,font);
 yesno(p2,data,'coffee',342.8,363.8,589.3,font);
 mul(p2,'family_history',48,629.3,494,1,15);
 // 8. Exploración física
 const pa=[valueOf(data,'bp_sys'),valueOf(data,'bp_dia')].filter(Boolean).join(' / ');
 write(p3,pa,153,143.3,73,font,extra,'Presión arterial');
 put(p3,'heart_rate',264,150.3,32);
 put(p3,'respiratory_rate',354,150.3,32);
 put(p3,'temperature',440,150.3,30);
 put(p3,'weight',164,184.3,27);
 put(p3,'height',273,184.3,25);
 put(p3,'bmi',359,184.3,35);
 [['Normal',426],['Sobrepeso',467.5],['Obesidad',523.5]].forEach(([v,x])=>opt(p3,data,'weight_class',v,x,177.3,font));
 const systemX=[46,223,400,46,223,400,46,223,400],systemY=[234.3,234.3,234.3,254.3,254.3,254.3,274.3,274.3,274.3];
 bodySystems.forEach(([key,label],i)=>{
  const status=valueOf(data,'system_'+key);
  if(status)tick(p3,systemX[i],systemY[i],font);
  if(status==='Con hallazgos')extra.push({label:'Hallazgos: '+label,text:'El sistema fue marcado «Con hallazgos».'});
 });
 if(valueOf(data,'systems_notes'))extra.push({label:'Observaciones / Hallazgos por sistemas',text:valueOf(data,'systems_notes')});
 // 9. Pruebas complementarias
 put(p3,'laboratory',288,335.3,220);
 [['audiometry',104,145.5,355.3,199,298,'audiometry_notes'],['spirometry',103,144.5,375.3,198,298,'spirometry_notes'],['optometry',155.5,197,395.3,251,236,'optometry_notes']].forEach(([k,yes,no,top,x,w,note])=>{
  opt(p3,data,k,'Normal',yes,top,font);opt(p3,data,k,'Alterado',no,top,font);put(p3,note,x,top,w);
 });
 put(p3,'other_tests',163,415.3,350);
 // 10. Diagnósticos
 put(p3,'clinical_diagnosis',181,476.3,330);
 put(p3,'risk_diagnosis',247,496.3,278);
 // 11. Aptitud laboral
 [['APTO',557.3],['APTO CON RESTRICCIONES',577.3],['NO APTO',597.3]].forEach(([v,y])=>opt(p3,data,'fitness',v,46,y,font));
 mul(p3,'recommendations',48,633.3,495,2,14);
 // 12. Cierre (firma médica y huella se mantienen en blanco)
 put(p4,'doctor_name',84,111.3,166);
 put(p4,'professional_id',181,125.3,118);
 write(p4,datestr(valueOf(data,'evaluation_date')),396,111.3,101,font,extra,'Fecha de evaluación');
 // Campos que no caben en el formato original se adjuntan sin perder contenido.
 appendix(pdf,extra,font,bold);
 pdf.setTitle('Historia Clínica Médico Ocupacional');
 pdf.setAuthor('Dra. Gricel Pérez — Sistema de historias clínicas');
 pdf.setSubject('Documento médico-legal confidencial');
 return pdf.save();
}
