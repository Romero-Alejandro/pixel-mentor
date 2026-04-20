#!/usr/bin/env /home/alejandro/dev/projects/active/pixel-mentor/playwright_venv/bin/python
import json
import asyncio

from playwright.sync_api import sync_playwright

def run(playwright):
    print("Launching browser...")
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    all_requests = []
    all_responses = []
    
    page.on("request", lambda request: all_requests.append({
        'url': request.url,
        'method': request.method,
        'headers': request.headers,
        'post_data': request.post_data,
        'is_navigation_request': request.is_navigation_request()
    }))

    page.on("response", lambda response: all_responses.append({
        'url': response.url,
        'status': response.status,
        'headers': response.headers
    }))

    console_messages = []
    page.on("console", lambda msg: console_messages.append({
        'type': msg.type,
        'text': msg.text,
        'location': msg.location
    }))

    print(f"Navigating to http://localhost:5173...")
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    print("Navigation complete, network idle.")

    print(f"Captured {len(all_requests)} requests and {len(all_responses)} responses.")
    
    # Save to files
    with open('network_requests.json', 'w') as f:
        json.dump(all_requests, f, indent=2)

    with open('network_responses.json', 'w') as f:
        json.dump(all_responses, f, indent=2)

    with open('page_snapshot.html', 'w') as f:
        f.write(page.content())

    with open('console_logs.json', 'w') as f:
        json.dump(console_messages, f, indent=2)

    print("Files written successfully.")
    browser.close()

if __name__ == '__main__':
    with sync_playwright() as playwright:
        run(playwright)
