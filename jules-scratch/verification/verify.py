import os
from playwright.sync_api import sync_playwright, expect, TimeoutError

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        logs = []
        page.on("console", lambda msg: logs.append(msg.text))

        page.goto('http://localhost:8000/index.html')

        try:
            # Wait for the level selection screen to be populated
            page.wait_for_selector('.level-btn', timeout=10000) # 10s timeout

            # Click the "Level 1" button
            level_button = page.get_by_role("button", name="Level 1")
            level_button.click()

            # Wait for the game UI to be visible
            expect(page.locator("#game-ui")).to_be_visible()

            # Take a screenshot of the course
            course_element = page.locator("#course")
            course_element.screenshot(path="jules-scratch/verification/verification.png")

        except TimeoutError:
            print("Timeout while waiting for elements.")
            print("Console logs:")
            for log in logs:
                print(log)

        finally:
            browser.close()

if __name__ == "__main__":
    run()
