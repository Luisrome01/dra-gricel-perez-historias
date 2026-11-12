// Construcción estática sin paquetes ni credenciales privadas.
// Las dos variables SUPABASE_* son PUBLICABLES en el navegador.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
fs.copyFileSync(path.join(root,'index.html'),path.join(dist,'index.html'));
fs.cpSync(path.join(root,'src'),path.join(dist,'src'),{recursive:true});
fs.cpSync(path.join(root,'public'),path.join(dist,'public'),{recursive:true});
const configuration={
  supabaseUrl:process.env.SUPABASE_URL||'',
  publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY||''
};
fs.writeFileSync(path.join(dist,'config.js'),'window.CLINIC_CONFIG = '+JSON.stringify(configuration)+';\n');
console.log('Sitio compilado en dist. Modo: '+(configuration.supabaseUrl&&configuration.publishableKey?'Supabase autenticado':'exportación local'));
