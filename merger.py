import pandas as pd
import os

def merge_lexus_and_toyodiy(toyodiy_path="ToyoDIY_Fixed_Export.csv", lexus_path="Lexus_Data_Ultra_Cleaned.csv"):
    # 1. Load the files
    if not os.path.exists(toyodiy_path) or not os.path.exists(lexus_path):
        print("[!] Error: One or both files are missing from the folder.")
        return

    try:
        df_toyodiy = pd.read_csv(toyodiy_path, encoding='latin1')
        df_lexus = pd.read_csv(lexus_path, encoding='latin1')
        print("[*] Files loaded successfully.")
    except UnicodeDecodeError:
        df_toyodiy = pd.read_csv(toyodiy_path, encoding='ISO-8859-1')
        df_lexus = pd.read_csv(lexus_path, encoding='ISO-8859-1')
        print("[*] Files loaded using ISO-8859-1 fallback.")

    # 2. Align the column names
    if 'VIN_IDENTIFIER' in df_lexus.columns:
        df_lexus = df_lexus.rename(columns={'VIN_IDENTIFIER': 'SEARCHED_VIN'})

    # 3. Combine the data
    combined_df = pd.merge(df_toyodiy, df_lexus, on='SEARCHED_VIN', how='outer')

    # 4. Cleanup: Remove the buffer/fake row
    buffer_vin = 'JZZ30-0016235' 
    combined_df = combined_df[combined_df['SEARCHED_VIN'] != buffer_vin]

    # --- NEW STEP ---
    # 5. Convert all column headers to lowercase
    combined_df.columns = combined_df.columns.str.lower()
    # ----------------

    # 6. Save the final master list
    output_file = "Master_Soarer_Database.csv"
    combined_df.to_csv(output_file, index=False)
    
    print(f"SUCCESS: {len(combined_df)} real vehicle records merged.")
    print(f"File saved as: {output_file}")

if __name__ == "__main__":
    merge_lexus_and_toyodiy()