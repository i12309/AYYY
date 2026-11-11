"""Run current HUMAN workflows with an isolated synthetic browser per suite."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
SUITES=['health_browser','health_analytes_browser','health_medical_browser','health_episodes_browser','health_measurements_browser','health_care_browser','health_diary_browser','health_genetics_browser','health_documents_browser','health_import_draft_browser','health_storage_browser','health_journal_browser','health_recommendations_browser']
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--engine',choices=['all','chromium','firefox','webkit'],default='all')
parser.add_argument('--suite',choices=SUITES,action='append',help='Repeat to select suites; default is every current workflow')
args=parser.parse_args()
for engine in (['chromium','firefox','webkit'] if args.engine=='all' else [args.engine]):
 for suite in args.suite or SUITES:
  started=time.monotonic()
  result=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'tests'/f'{suite}.py')],cwd=ROOT,env={**os.environ,'HEALTH_BROWSER':engine},capture_output=True,text=True,encoding='utf-8')
  if result.returncode:
   print(engine,suite,'FAILED',flush=True);print(result.stdout,flush=True);print(result.stderr,file=sys.stderr,flush=True);raise SystemExit(result.returncode)
  print(engine,suite,result.stdout.strip().splitlines()[-1],f'({time.monotonic()-started:.1f}s)',flush=True)
print('All requested HUMAN browser workflows passed',flush=True)
