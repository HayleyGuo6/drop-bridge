import { env } from 'cloudflare:workers';
export const LIMIT=100000000;
export function db(){return env.DB}
export function bucket(){return env.FILES}
export function expiry(now=Date.now()){return (Math.floor(now/86400000)+1)*86400000;}
export async function cleanup(){
 const now=Date.now();
 const rows=await db().prepare("SELECT id FROM files WHERE expires <= ? OR (status = 'uploading' AND created < ?)").bind(now,now-3600000).all<{id:string}>();
 for(const row of rows.results){await bucket().delete(row.id);await db().prepare('DELETE FROM files WHERE id = ?').bind(row.id).run()}
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function sameOrigin(request:Request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin}
