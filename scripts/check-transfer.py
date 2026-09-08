"""Local-only checks against the development server and its local D1 database."""
import glob,sqlite3,pathlib,urllib.request,urllib.error,json,hashlib,tempfile,subprocess
root=pathlib.Path(__file__).resolve().parents[1]
dbpath=next(p for p in glob.glob(str(root/'.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')) if not p.endswith('metadata.sqlite'))
c=sqlite3.connect(dbpath)
if not c.execute("SELECT name FROM sqlite_master WHERE name='files'").fetchone():
 c.executescript((root/'drizzle/0000_romantic_silver_surfer.sql').read_text());c.commit()
base='http://localhost:3000'
def get(path):
 with urllib.request.urlopen(base+path) as r:return r.read(),r.headers
with tempfile.TemporaryDirectory() as temp:
 f=pathlib.Path(temp)/'sample.bin';f.write_bytes(b'File transfer verification\n'*1000)
 def upload(path,name):
  result=subprocess.run(['curl','-sS','-X','POST','-H','X-File-Size: '+str(path.stat().st_size),'-H','Content-Type: application/octet-stream','--data-binary','@'+str(path),base+'/api/files?name='+urllib.parse.quote(name)],capture_output=True,check=True)
  return json.loads(result.stdout)
 first=upload(f,'跨电脑测试.txt');assert 'id' in first,first
 body,headers=get('/api/files/'+first['id']);assert body==f.read_bytes();assert 'attachment' in headers['Content-Disposition']
 assert any(x['id']==first['id'] for x in json.loads(get('/api/files')[0])['files'])
 c.execute('UPDATE files SET expires=0 WHERE id=?',(first['id'],));c.commit()
 try:get('/api/files/'+first['id']);raise AssertionError('Expired download allowed')
 except urllib.error.HTTPError as e:assert e.code==404
 assert not c.execute('SELECT id FROM files WHERE id=?',(first['id'],)).fetchone()
 large=pathlib.Path(temp)/'large.bin'
 with large.open('wb') as output:output.truncate(100000000)
 big=upload(large,'100MB.bin');assert 'id' in big,big
 blocked=upload(f,'overflow.bin');assert 'error' in blocked,blocked
 destination=pathlib.Path(temp)/'download.bin'
 subprocess.run(['curl','-sS','--fail','-o',str(destination),base+'/api/files/'+big['id']],check=True)
 def digest(p):
  h=hashlib.sha256()
  with p.open('rb') as stream:
   for block in iter(lambda:stream.read(1048576),b''):h.update(block)
  return h.digest()
 assert digest(large)==digest(destination)
 c.execute('UPDATE files SET expires=0 WHERE id=?',(big['id'],));c.commit();get('/api/files')
print('PASS: separate upload/list/download requests; Unicode filename; 100 MB byte integrity; capacity rejection; expired download denied; local cleanup.')
