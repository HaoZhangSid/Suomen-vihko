import os
import json

def export_lessons_to_txt():
    lessons_dir = 'public/lessons'
    output_dir = 'lessons_txt'
    
    # Step 1: Create the output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    if not os.path.exists(lessons_dir):
        print(f"Error: Directory '{lessons_dir}' not found.")
        return

    lesson_files = sorted([f for f in os.listdir(lessons_dir) if f.endswith('.json')])

    # Step 2: Process each lesson file
    for filename in lesson_files:
        filepath = os.path.join(lessons_dir, filename)
        
        # Extract the base number from the filename (e.g., '1' from '1.json')
        base_name = os.path.splitext(filename)[0]
        output_file = os.path.join(output_dir, f"{base_name}.txt")
        
        speaker_idx = 1 # Start with speaker1 for each file
        entries = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if 'entries' in data and isinstance(data['entries'], list):
                    # Step 3: Extract finnish and chinese entries
                    for entry in data['entries']:
                        if 'finnish' in entry and 'chinese' in entry:
                            finnish_word = entry['finnish']
                            
                            # First line (Finnish), speaker alternates
                            entries.append(f"speaker{speaker_idx}:{finnish_word}")
                            speaker_idx = 2 if speaker_idx == 1 else 1
                            
                            # Second line (Chinese), speaker alternates
                            entries.append(f"speaker{speaker_idx}:{entry['chinese']}")
                            speaker_idx = 2 if speaker_idx == 1 else 1

                            # Third line (Finnish repeat), speaker alternates
                            entries.append(f"speaker{speaker_idx}:{finnish_word}")
                            speaker_idx = 2 if speaker_idx == 1 else 1
        except json.JSONDecodeError:
            print(f"Warning: Could not decode JSON from {filename}")
            continue # Skip to the next file
        except Exception as e:
            print(f"An error occurred while processing {filename}: {e}")
            continue # Skip to the next file
            
        # Step 4: Write to the individual output file
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(entries))
            print(f"Successfully exported entries to '{output_file}'")
        except Exception as e:
            print(f"An error occurred while writing to {output_file}: {e}")

    print("\nProcessing complete.")

if __name__ == '__main__':
    export_lessons_to_txt()
