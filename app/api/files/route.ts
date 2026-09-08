import { bucket, cleanup, db, expiry, json, LIMIT, sameOrigin } from '@/lib/files';
export async function GET(){try{await cleanup();const rows=await db().prepare("SELECT id,name,size,created,expires FROM files WHERE status = 'ready' AND expires > ? ORDER BY created DESC").bind(Date.now()).all();return json({files:rows.results})}catch{ return json({error:'暂时无法读取文件，请重试'},503)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'请求来源无效'},403);
 const name=new URL(request.url).searchParams.get('name')?.trim();const raw=request.headers.get('X-File-Size');const size=Number(raw);
 if(!name||name.length>255||/[\x00-\x1f]/.test(name))return json({error:'文件名无效或过长'},400);
 if(raw===null||!Number.isSafeInteger(size)||size<0||size>LIMIT)return json({error:'文件不能超过 100 MB'},413);
 const id=crypto.randomUUID(),created=Date.now(),expires=expiry(created);
 try{
 await cleanup();
 const result=await db().prepare("INSERT INTO files (id,name,size,created,expires,status) SELECT ?,?,?,?,?, 'uploading' WHERE COALESCE((SELECT SUM(size) FROM files),0) + ? <= ? AND (SELECT COUNT(*) FROM files) < 500").bind(id,name,size,created,expires,size,LIMIT).run();
 if(!result.meta.changes)return json({error:'临时空间不足或文件数量已达上限，请等待清理后再试'},409);
 if(size===0){await bucket().put(id,new Uint8Array(0));}else{
 if(!request.body)throw Error('缺少文件内容');
 const stream=new FixedLengthStream(size);
 const pipe=request.body.pipeTo(stream.writable);
 await Promise.all([pipe,bucket().put(id,stream.readable,{httpMetadata:{contentType:'application/octet-stream'}})]);
 }
 if(Date.now()>=expires){throw Error('文件已到清理时间，请重新上传')}
 const updated=await db().prepare("UPDATE files SET status = 'ready' WHERE id = ?").bind(id).run();
 if(!updated.meta.changes)throw Error('上传已超时，请重试');
 return json({id},201);
 }catch{await bucket().delete(id).catch(()=>{});await db().prepare('DELETE FROM files WHERE id = ?').bind(id).run().catch(()=>{});return json({error:'上传未完成，请重新上传'},500)}
}
