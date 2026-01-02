import re
import os

def remove_comments(content, file_type):
    if file_type == 'html':
        # Remove HTML comments <!-- ... -->
        return re.sub(r'<!--[\s\S]*?-->', '', content)
    elif file_type == 'css':
        # Remove CSS comments /* ... */
        return re.sub(r'/\*[\s\S]*?\*/', '', content)
    elif file_type == 'js':
        # Remove JS comments, preserving strings
        # Pattern captures: 
        # 1. Strings (double or single quoted)
        # 2. Block comments /* ... */
        # 3. Line comments // ...
        pattern = r"((['\"])(?:(?!\2|\\).|\\.)*\2)|(\/\*[\s\S]*?\*\/)|(\/\/.*)"
        
        def replacer(match):
            # If it's a string (group 1), keep it
            if match.group(1):
                return match.group(1)
            # Otherwise it's a comment, remove it
            # specific check for line comments to keep the newline if needed, but the regex consumes //.* which doesn't include newline
            return ""
            
        return re.sub(pattern, replacer, content)
    return content

files_config = {
    'html': [
        'admin.html', 'budgets.html', 'categories.html', 'dashboard.html', 
        'index.html', 'profile.html', 'savings.html', 'transactions.html'
    ],
    'css': [
        'Admin/admin.css', 'Budgets/budgets.css', 'Categories/categories.css', 
        'Dashboard/dashboard.css', 'LoginPage/login.css', 'Savings/savings.css', 
        'Transactions/transactions.css', 'UserProfile/profile.css'
    ],
    'js': [
        'Admin/admin.js', 'AppwriteService/appwrite-config.js', 'Budgets/budgets.js', 
        'Categories/categories.js', 'Dashboard/dashboard.js', 'LoginPage/login.js', 
        'Savings/savings.js', 'Transactions/transactions.js', 'UserProfile/profile.js'
    ]
}

base_dir = "."

def process_file(filepath, ftype):
    full_path = os.path.join(base_dir, filepath)
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        return

    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = remove_comments(content, ftype)
        
        if content != new_content:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Processed: {filepath}")
        else:
            print(f"No changes: {filepath}")
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

def main():
    print("Starting comment removal...")
    for ftype, files in files_config.items():
        for fname in files:
            process_file(fname, ftype)
    print("Done.")

if __name__ == "__main__":
    main()
