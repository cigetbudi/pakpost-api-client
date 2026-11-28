import tempfile,subprocess,sys,unittest,importlib.util
from pathlib import Path
root=Path(__file__).resolve().parent
class Test(unittest.TestCase):
 def test_audit(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t)
   def git(*args): return subprocess.check_output(['git','-C',t,*args],stderr=subprocess.DEVNULL)
   git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test')
   (p/'README.md').write_text('example');git('add','.');git('commit','-qm','clean')
   def audit(): return subprocess.run([sys.executable,str(root/'audit-tracked.py')],cwd=t,capture_output=True,text=True)
   self.assertEqual(audit().returncode,0)
   (p/'frontend').mkdir();(p/'frontend/kunci').write_text('fake fixture, not a key');git('add','.');git('commit','-qm','unsafe path')
   a=audit();self.assertNotEqual(a.returncode,0);self.assertIn('frontend/kunci',a.stdout);self.assertNotIn('fake fixture',a.stdout)
 def test_collect(self):
  spec=importlib.util.spec_from_file_location('collect',root/'collect.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  with tempfile.TemporaryDirectory() as t:
   p=Path(t);src=p/'src';src.mkdir();out=p/'out';(src/'test-setup.exe').write_bytes(b'fixture-not-a-real-installer')
   m.collect(src,out,['windows']);self.assertTrue((out/m.NAMES['windows'][1]).exists())
   with self.assertRaises(SystemExit):m.collect(src,out,['windows'])
   with self.assertRaises(SystemExit):m.collect(src,p/'missing',['rpm'])
   (src/'other-setup.exe').write_bytes(b'fixture-not-a-real-installer');self.assertRaises(SystemExit,m.collect,src,p/'multi',['windows'])
 def test_updater_manifest(self):
  import base64
  spec=importlib.util.spec_from_file_location('updater_manifest',root/'updater-manifest.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  with tempfile.TemporaryDirectory() as t:
   p=Path(t);v='1.2.3'
   names=[f'PakPost-{v}-linux-amd64.deb',f'PakPost-{v}-linux-x86_64.rpm',f'PakPost-{v}-windows-x64.exe',f'PakPost-{v}-macos-universal.app.tar.gz']
   for name in names:
    (p/name).write_bytes(b'not-a-real-installer')
    (p/(name+'.sig')).write_bytes(base64.b64encode(b'trusted comment: version:1.2.3'))
   result=m.generate(p,v);targets=result['platforms']
   self.assertNotIn('linux-x86_64',targets)
   self.assertTrue(targets['linux-x86_64-deb']['url'].endswith('.deb'))
   self.assertTrue(targets['linux-x86_64-rpm']['url'].endswith('.rpm'))
   self.assertEqual(targets['darwin-x86_64-app'],targets['darwin-aarch64-app'])
   (p/(names[0]+'.sig')).write_bytes(base64.b64encode(b'trusted comment: version:0.1.0'))
   with self.assertRaises(ValueError):m.generate(p,v)
   (p/(names[0]+'.sig')).unlink()
   with self.assertRaises(ValueError):m.generate(p,v)
if __name__=='__main__':unittest.main()
