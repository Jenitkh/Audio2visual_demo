import os

# Your folder path
folder_path = r"E:\2026\testing_tallip\testing_audio_to_visual_frontend\frontend__demo\public\generated_image"

for filename in os.listdir(folder_path):
    if filename.endswith(".png") and "_" in filename:
        
        # Separate name and extension
        name, ext = os.path.splitext(filename)
        
        # Keep only the LAST part after underscore
        new_base = name.split("_")[-1]
        new_name = new_base + ext

        old_path = os.path.join(folder_path, filename)
        new_path = os.path.join(folder_path, new_name)

        # Prevent overwrite
        count = 1
        while os.path.exists(new_path):
            new_name = f"{new_base}_{count}{ext}"
            new_path = os.path.join(folder_path, new_name)
            count += 1

        os.rename(old_path, new_path)
        print(f"Renamed: {filename} → {new_name}")

print("✅ Done safely!")