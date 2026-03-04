import pandas as pd
import os

def merge_lexus_and_toyodiy(toyodiy_path="ToyoDIY_Fixed_Export.csv", lexus_path="ClubLexus_Export.csv"):
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

    # --- FIX 1: HANDLE DUPLICATE COLUMNS ---
    combined_df = combined_df.loc[:, ~combined_df.columns.duplicated()]

    # --- FIX 2: HANDLE DUPLICATE ROW INDICES (The cause of your current error) ---
    # This resets the row numbering so every row is unique
    combined_df = combined_df.reset_index(drop=True)

    # 4. Remove unwanted columns
    cols_to_remove = ['VIN_STAR', 'AdditionalErrorText', 'SuggestedVIN', 'PossibleValues']
    combined_df = combined_df.drop(columns=[c for c in cols_to_remove if c in combined_df.columns])

    # 5. Handle the VIN column naming and placement
    combined_df = combined_df.rename(columns={'SEARCHED_VIN': 'VIN'})
    
    # Move 'VIN' to the first column safely
    if 'VIN' in combined_df.columns:
        cols = combined_df.columns.tolist()
        cols.insert(0, cols.pop(cols.index('VIN')))
        combined_df = combined_df[cols]

    # 6. Cleanup: Remove the buffer/fake row
    # Now that the index is reset, this filtering will work without errors
    buffer_vin = 'JZZ30-0016235' 
    combined_df = combined_df[combined_df['VIN'] != buffer_vin]

    # 7. Save the final master list
    output_file = "Master_Soarer_Database.csv"
    combined_df.to_csv(output_file, index=False)
    
    print(f"SUCCESS: {len(combined_df)} vehicle records merged into {output_file}.")

if __name__ == "__main__":
    merge_lexus_and_toyodiy()