"""User-level interaction with the nonmodal scene-settings disclosure."""


def set_scene_settings(page, opened=True):
    toggle = page.locator('#ww-scene-settings-toggle')
    if (toggle.get_attribute('aria-expanded') == 'true') != opened:
        toggle.click()
    page.wait_for_function("""opened => {
      const toggle = document.querySelector('#ww-scene-settings-toggle');
      const panel = document.querySelector('#ww-scene-controls');
      return toggle?.getAttribute('aria-expanded') === String(opened)
        && panel?.hidden === !opened;
    }""", arg=opened)
    page.locator('#ww-scene-controls').wait_for(state='visible' if opened else 'hidden')
