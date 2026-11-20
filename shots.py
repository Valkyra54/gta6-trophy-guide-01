#!/usr/bin/env python3
"""Take the 4 screenshots for gta6-trophy-guide-01 and verify the tracker works.

Serves app/ with the kit's serve.ts on :8123 (started separately), drives it with
Playwright/Chromium, seeds 10 earned trophies in localStorage, and checks:
  - no network request leaves localhost (offline app),
  - progress persists across a reload,
  - export downloads a JSON of the earned names and import restores it,
  - kind filter counts, spoiler masking.
Screenshots (JPEG) go to screenshots/ in this repo: shot 1 is 1280x1150 so the
masthead, progress bar, filters/export row and one open guide all fit in one
frame at scroll 0; shots 2-4 are 1280x800.
"""
import argparse
import json
import os
import sys
import tempfile

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "http://127.0.0.1:8123"
CHROME = os.path.expanduser(
    "~/workspace/tools/playwright/browsers/chromium-1255/chrome-linux/chrome"
)
SEED = [
    "Just Like Paradise",
    "Paradise Lost",
    "Trust",
    "Master of None",
    "Baited My Tackle",
    "Stick Fiddler",
    "Whip It Good",
    "In The Beginning\u2026",
    "Treat Yo Self",
    "Hot Together",
]
EARNED_KEY = "leonida-trophy-guide-v1"


def shot(page, path):
    page.screenshot(path=os.path.join(HERE, "screenshots", path), type="jpeg", quality=85)


def trophy_card(page, name):
    return page.locator(".trophy", has_text=name).first


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=int, choices=[1], default=None,
                    help="retake only shot 1 (the cover)")
    args = ap.parse_args()
    requests = []
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=CHROME, args=["--no-sandbox", "--disable-gpu"]
        )
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 800}, accept_downloads=True
        )
        page = ctx.new_page()
        page.on("request", lambda r: requests.append(r.url))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        # Seed 10 earned trophies once (only if the key is absent, so a later
        # reload still proves localStorage persistence).
        page.add_init_script(
            """(seed => {
              if (!localStorage.getItem('%s')) {
                localStorage.setItem('%s', JSON.stringify(seed));
              }
            })(%s)"""
            % (EARNED_KEY, EARNED_KEY, json.dumps(SEED))
        )
        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_selector(".trophy", timeout=15000)
        n = page.locator(".trophy").count()
        print("trophies rendered:", n)
        assert n == 55, f"expected 55, got {n}"
        print("progress text:", page.locator("#progressText").inner_text())

        # --- Shot 1 (cover): masthead + progress + filters/export + one open guide.
        # Measured layout at scroll 0 with the guide open: the guide's sources end
        # at y=1103, so the cover uses a 1280x1150 viewport at scroll 0 — every
        # required element fits in one frame and stays readable. (An 800-high
        # viewport cannot hold it all: it forced a 185px scroll that cut the
        # masthead and progress bar.)
        ctx1 = browser.new_context(
            viewport={"width": 1280, "height": 1150}, accept_downloads=True
        )
        p1 = ctx1.new_page()
        p1.add_init_script(
            """(seed => {
              if (!localStorage.getItem('%s')) {
                localStorage.setItem('%s', JSON.stringify(seed));
              }
            })(%s)"""
            % (EARNED_KEY, EARNED_KEY, json.dumps(SEED))
        )
        p1.goto(BASE + "/", wait_until="networkidle")
        p1.wait_for_selector(".trophy", timeout=15000)
        p1.locator(".trophy", has_text="Just Like Paradise").first.locator(
            ".guide-toggle"
        ).click()
        p1.wait_for_selector(".trophy-detail")
        p1.evaluate("window.scrollTo(0, 0)")
        p1.wait_for_timeout(300)
        print("shot1 progress text:", p1.locator("#progressText").inner_text())
        shot(p1, "1-checklist.jpg")
        ctx1.close()
        if args.only == 1:
            browser.close()
            print("SHOT 1 RETAKEN")
            return

        # --- Shot 2: roadmap tab.
        page.locator("#tabRoadmap").click()
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)
        shot(page, "2-roadmap.jpg")

        # --- Shot 3: spoiler on, back to checklist, scroll top.
        page.locator("#tabChecklist").click()
        page.locator("#spoiler").check()
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)
        masked = page.locator(".trophy-name", has_text="Hidden story trophy").count()
        print("spoiler-masked story trophies visible:", masked)
        assert masked > 0, "spoiler hid nothing"
        shot(page, "3-spoiler.jpg")

        # --- Shot 4: collectibles filter + A Long Road guide open + export/import row.
        page.locator("#spoiler").uncheck()
        page.locator('#kindFilters button[data-kind="collectibles"]').click()
        page.wait_for_timeout(200)
        shown = page.locator(".trophy").count()
        print("collectibles shown:", shown)
        assert shown == 7, f"expected 7 collectibles, got {shown}"
        trophy_card(page, "A Long Road").locator(".guide-toggle").click()
        page.wait_for_selector(".trophy-detail")
        page.evaluate(
            "window.scrollTo(0, document.querySelectorAll('.controls')[0].offsetTop - 8)"
        )
        page.wait_for_timeout(300)
        shot(page, "4-filters-export.jpg")

        # --- Functional checks (after the shots).
        # Export: download must carry the 10 seeded names.
        with page.expect_download() as dl:
            page.locator("#export").click()
        dl_path = dl.value.path()
        exported = json.load(open(dl_path))
        print("exported earned:", len(exported["earned"]))
        assert sorted(exported["earned"]) == sorted(SEED), "export mismatch"

        # Import a 3-name file, then check the progress text changes.
        with tempfile.NamedTemporaryFile(
            "w", suffix=".json", delete=False
        ) as tmp:
            json.dump(
                {"earned": ["Vice Got a Price!", "A Long Road", "Cunning Stunts"]},
                tmp,
            )
            tmp_path = tmp.name
        page.set_input_files("#import", tmp_path)
        page.wait_for_timeout(400)
        print("progress after import:", page.locator("#progressText").inner_text())
        assert page.locator("#progressText").inner_text().startswith("3 of 55"), "import failed"
        print("import note:", page.locator("#importNote").inner_text())

        # Reload: the 3 imported names must persist (init script must not re-seed).
        page.reload(wait_until="networkidle")
        page.wait_for_selector(".trophy")
        print("progress after reload:", page.locator("#progressText").inner_text())
        assert page.locator("#progressText").inner_text().startswith("3 of 55"), "persistence failed"

        # Offline: every request must be localhost.
        foreign = [u for u in requests if not u.startswith("http://127.0.0.1:8123")]
        print("total requests:", len(requests), "| non-localhost:", foreign)
        assert not foreign, f"non-localhost requests: {foreign}"
        print("console/page errors:", errors)
        assert not errors, f"errors: {errors}"
        browser.close()
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
