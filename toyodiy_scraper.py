import pandas as pd
import time
import random
import re
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def load_vins_from_file(filename="vins.txt"):
    if not os.path.exists(filename):
        print(f"[!] Error: {filename} not found.")
        return []
    with open(filename, "r") as f:
        return [line.strip() for line in f if line.strip()]

def scrape_toyodiy_automated(vins):
    chrome_options = Options()
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    all_vehicle_data = []

    try:
        for index, vin in enumerate(vins):
            print(f"\n[{index + 1}/{len(vins)}] Processing: {vin}")
            driver.get(f"https://www.toyodiy.com/parts/q?vin={vin}")
            
            try:
                # Wait for the main container to load
                WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            except:
                print(f"  [!] Timeout on {vin}. Check Cloudflare.")
                continue

            data = {"SEARCHED_VIN": vin}

            # --- TARGETING THE BOTTOM TABLE (Search Results) ---
            try:
                # ToyoDIY often places the results in a table with specific headers
                # We search for the row containing the actual data (usually the first row after <th>)
                table_rows = driver.find_elements(By.XPATH, "//table//tr[td]")
                
                for row in table_rows:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    # The results row typically has 6 columns
                    if len(cells) >= 6:
                        # We check if the row's first cell looks like the VIN to confirm it's the right row
                        if any(char.isdigit() for char in cells[0].text):
                            data["VIN_STAR"] = cells[0].text.strip()
                            data["MODEL_CODE"] = cells[1].text.strip()
                            data["PROD_FROM"] = cells[2].text.strip()
                            data["PROD_TO"] = cells[3].text.strip()
                            data["FRAME_SHORT"] = cells[4].text.strip()
                            data["CHARS_BOTTOM"] = cells[5].text.strip()
                            print(f"  [+] Bottom Table Found: {data['MODEL_CODE']}")
                            break
            except Exception as e:
                print(f"  [-] Error parsing bottom table: {e}")

            # --- TARGETING THE TOP SECTION (Characteristics) ---
            page_text = driver.find_element(By.TAG_NAME, "body").text
            
            specs = {
                "MARKET": r"Market\s+(.*?)\s+Year",
                "YEAR_MONTH": r"Year\s+(.*?)\s+Make",
                "MAKE": r"Make\s+(.*?)\s+Model",
                "MODEL_NAME": r"Model\s+(.*?)\s+Frame",
                "GRADE": r"GRADE:\s*(.*?)(?=DESTINATION:|$)",
                "DESTINATION": r"DESTINATION:\s*(.*?)(?=ENGINE:|$)",
                "ENGINE": r"ENGINE:\s*(.*?)(?=TRANSMISSION:|$)",
                "TRANSMISSION": r"TRANSMISSION:\s*(.*?)(?=COLOR CODE:|$)",
                "COLOR_CODE": r"COLOR CODE:\s*(.*?)(?=TRIM CODE:|$)",
                "TRIM_CODE": r"TRIM CODE:\s*(.*?)(?=Search Results|$)"
            }

            for key, pattern in specs.items():
                match = re.search(pattern, page_text, re.IGNORECASE | re.DOTALL)
                if match:
                    clean_val = " ".join(match.group(1).split())
                    data[key] = clean_val
                    print(f"  [+] {key}: {clean_val}")

            all_vehicle_data.append(data)
            time.sleep(random.uniform(2, 4))

    finally:
        driver.quit()

    if all_vehicle_data:
        df = pd.DataFrame(all_vehicle_data)
        # Reorder to ensure the requested Bottom Side data is clearly visible at the start
        priority_cols = ['SEARCHED_VIN', 'VIN_STAR', 'MODEL_CODE', 'PROD_FROM', 'PROD_TO', 'FRAME_SHORT']
        other_cols = [c for c in df.columns if c not in priority_cols]
        df[priority_cols + other_cols].to_csv("ToyoDIY_Fixed_Export.csv", index=False)
        print(f"\nSUCCESS: Check 'ToyoDIY_Info.csv'")

if __name__ == "__main__":
    vins = load_vins_from_file("vins.txt")
    scrape_toyodiy_automated(vins)