import { bucket, cleanup, db, json } from '@/lib/files';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{await cleanup();const {id}=await params;
 const file=await db().prepare("SELECT name FROM files WHERE id = ? AND status = 'ready' AND expires > ?").bind(id,Date.now()).first<{name:string}>();
 if(!file)return json({error:'文件已过期或不存在'},404);
 const object=await bucket().get(id);if(!object)return json({error:'文件不存在'},404);
 return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=\"download\"; filename*=UTF-8''"+encodeURIComponent(file.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),'Content-Length':String(object.size),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return json({error:'暂时无法下载，请重试'},503)}
}
