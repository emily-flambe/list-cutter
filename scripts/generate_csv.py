import csv
import os
import random
import datetime

'''
Use this script to generate a CSV file with random data until it reaches the desired file size.

To use:
1. Run the script
2. Enter the desired file size in bytes when prompted
3. The script will generate a CSV file in the 'generated/' folder
4. The script will print the file path and the number of rows generated

Great job!
'''

def random_date(start_year=1930, end_year=2025):
    """Generate a random date between the given years."""
    start_date = datetime.date(start_year, 1, 1)
    end_date = datetime.date(end_year, 1, 1)
    delta = end_date - start_date
    random_days = random.randint(0, delta.days)
    return start_date + datetime.timedelta(days=random_days)

def random_bool(probability=0.05):
    """Return True with the given probability, otherwise False."""
    return random.random() < probability

def random_weight(min_weight=100, max_weight=400):
    """Return a random float weight between min and max."""
    return round(random.uniform(min_weight, max_weight), 2)

def generate_csv(target_size):
    """Generate a CSV file with random data until it reaches the desired file size."""
    script_dir = os.path.dirname(os.path.abspath(__file__))  # Get script directory
    generated_dir = os.path.join(script_dir, "generated")  # Path to 'generated/' folder
    os.makedirs(generated_dir, exist_ok=True)  # Ensure the folder exists

    file_path = os.path.join(generated_dir, "generated_data.csv")

    row_count = 0
    with open(file_path, "w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["date_of_birth", "is_fun", "weight_lbs"])  # Write header

        while os.path.getsize(file_path) <= target_size:
            writer.writerow([
                random_date().strftime("%Y-%m-%d"),
                random_bool(),
                random_weight()
            ])
            row_count += 1

    print(f"CSV file saved to: {file_path}")
    print(f"Generated ~{row_count} rows, reaching {target_size} bytes.")

if __name__ == "__main__":
    target_size = int(input("Enter the desired file size in bytes: "))
    generate_csv(target_size)
