"""Local engine selection and synthetic UI helpers shared by HUMAN checks."""
import os
ENGINE=os.getenv('HEALTH_BROWSER','chromium')

def launch_browser(playwright):
 if ENGINE not in {'chromium','firefox','webkit'}:raise ValueError('Unknown HEALTH_BROWSER')
 return getattr(playwright,ENGINE).launch()

def capture(page,**kwargs):
 # Keep committed artifacts from one engine; parallel runs must not overwrite them.
 if ENGINE=='chromium':
  page.evaluate('()=>window.scrollTo(0,0)')
  return page.screenshot(**kwargs)
 return None

def fill_home_value(page,value):
 fields=value.split('/')
 page.locator('#health-dialog [name=value]').fill(fields[0])
 if len(fields)==2:page.locator('#health-dialog [name=secondary]').fill(fields[1])
