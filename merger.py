import pandas as pd
import os

def merge_lexus_and_toyodiy(toyodiy_path="ToyoDIY_Fixed_Export.csv", lexus_path="ClubLexus_Export.csv"):
    # 1. Load the files
    if not os.path.exists(toyodiy_path) or not os.path.exists(lexus_path):
        print("[!] Error: One or both files are missing from the folder.")
        return

    try:
        # Added encoding='latin1' to handle special symbols or characters
        df_toyodiy = pd.read_csv(toyodiy_path, encoding='latin1')
        df_lexus = pd.read_csv(lexus_path, encoding='latin1')
        print("[*] Files loaded successfully.")
    except UnicodeDecodeError:
        # Secondary fallback just in case
        df_toyodiy = pd.read_csv(toyodiy_path, encoding='ISO-8859-1')
        df_lexus = pd.read_csv(lexus_path, encoding='ISO-8859-1')
        print("[*] Files loaded using ISO-8859-1 fallback.")

    # 2. Align the column names
    # Renaming 'VIN_IDENTIFIER' to 'SEARCHED_VIN' so they match
    if 'VIN_IDENTIFIER' in df_lexus.columns:
        df_lexus = df_lexus.rename(columns={'VIN_IDENTIFIER': 'SEARCHED_VIN'})

    # 3. Combine the data
    # 'how=outer' keeps all VINs from both files
    combined_df = pd.merge(df_toyodiy, df_lexus, on='SEARCHED_VIN', how='outer')

    # 4. Cleanup: Remove the buffer/fake row
    # Replace this with the buffer VIN you used (e.g., 'JZZ30-0016235')
    buffer_vin = 'JZZ30-0016235' 
    combined_df = combined_df[combined_df['SEARCHED_VIN'] != buffer_vin]

    # 5. Save the final master list
    output_file = "Master_Soarer_Database.csv"
    # Saving with index=False keeps the spreadsheet clean
    combined_df.to_csv(output_file, index=False)
    
    print(f"SUCCESS: {len(combined_df)} real vehicle records merged.")
    print(f"File saved as: {output_file}")

if __name__ == "__main__":
    merge_lexus_and_toyodiy()