#!/usr/bin/env python3
"""Debug: Check lesson page state"""
from playwright.sync_api import sync_playwright
import sys

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console messages
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))
        
        # Navigate to lesson page - adjust URL as needed
        # Try to find the lesson page
        page.goto("http://localhost:5173/", wait_until="networkidle")
        
        # Take screenshot to see current state
        page.screenshot(path="/tmp/lesson-debug.png", full_page=True)
        
        # Check if there are any visible errors
        print("=== Page Title ===")
        print(page.title())
        
        print("\n=== Console Logs ===")
        for log in console_logs:
            print(log)
        
        print("\n=== Current URL ===")
        print(page.url)
        
        # Look for any lesson-related content
        content = page.content()
        if "lesson" in content.lower():
            print("\n=== Lesson content found ===")
        else:
            print("\n=== No lesson content ===")
        
        browser.close()

if __name__ == "__main__":
    main()