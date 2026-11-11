#!/usr/bin/env python3
"""Check that the directory illustration does not disappear near the last card.

Run from repository root:
    python tests/service_showcase_browser.py

Requires Playwright with Chromium installed, or CHROME_BIN pointing to Chromium.
"""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):  # noqa: A002
        pass


def test_directory(browser, url, width, height):
    page = browser.new_page(viewport={"width": width, "height": height},
                            reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        page.goto(url + "/#directory")
        page.wait_for_selector(".sc-row--games")
        assert page.locator(".sc-row").count() == 10
        gallery = page.locator(".sc-gallery-sticky")
        assert gallery.evaluate("el => getComputedStyle(el).position") == "sticky"

        lighthouse = page.locator('[data-sc-picture="default"]')
        assert "is-visible" in lighthouse.get_attribute("class")
        assert lighthouse.evaluate("el => el.complete && el.naturalWidth > 0")

        # This previously failed: sticky gallery had already scrolled away.
        last = page.locator(".sc-row--games")
        last.scroll_into_view_if_needed()
        last.hover()
        page.wait_for_timeout(160)
        gallery_rect = gallery.bounding_box()
        card_rect = last.bounding_box()
        picture = page.locator(".sc-gallery-image.is-visible")
        image_rect = picture.bounding_box()
        assert gallery_rect is not None and image_rect is not None
        assert 0 <= gallery_rect["y"] <= 130, gallery_rect
        assert gallery_rect["x"] + gallery_rect["width"] + 12 < card_rect["x"], (
            gallery_rect, card_rect)
        assert image_rect["y"] + image_rect["height"] > height * .55, image_rect
        title_rect = page.locator(".sc-intro h1").bounding_box()
        assert title_rect is not None
        assert image_rect["x"] + image_rect["width"] < title_rect["x"] - 10, (
            image_rect, title_rect)
        assert picture.get_attribute("data-sc-picture") == "games"
        assert picture.evaluate("el => el.complete && el.naturalWidth > 0")

        # Moving off the card restores the original lighthouse.
        page.mouse.move(3, 3)
        page.wait_for_timeout(100)
        assert page.locator(".sc-gallery").get_attribute("data-sc-active") == "default"
        assert "is-visible" in lighthouse.get_attribute("class")

        # Verify no new horizontal overflow.
        assert page.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth + 1"
        ), width
        assert not errors, errors
    finally:
        page.close()


def main():
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            executable = (os.getenv("CHROME_BIN") or shutil.which("chromium")
                          or shutil.which("google-chrome"))
            kwargs = {"headless": True, "args": ["--no-sandbox"]}
            if executable:
                kwargs["executable_path"] = executable
            browser = playwright.chromium.launch(**kwargs)
            try:
                url = "http://127.0.0.1:" + str(server.server_port)
                for width, height in ((1280, 900), (1560, 960), (1920, 1080)):
                    test_directory(browser, url, width, height)
                    print(f"PASS: illustrated gallery remains visible at {width}×{height}")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
