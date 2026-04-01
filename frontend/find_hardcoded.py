#!/usr/bin/env python3
"""Find hardcoded Chinese strings in TypeScript/React files."""

import os
import re
import sys

def has_chinese(text):
    """Check if text contains Chinese characters."""
    for char in text:
        if '\u4e00' <= char <= '\u9fff':
            return True
    return False

def find_chinese_in_file(filepath):
    """Find all lines with hardcoded Chinese in a file."""
    results = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for i, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith('//') or stripped.startswith('*'):
                continue
            
            # Skip import statements
            if 'import' in line and 'from' in line:
                continue
            
            # Skip lines that are already using t() function
            if 't(' in line or 't(`' in line or "t('" in line or 't("' in line:
                # But check if there's Chinese outside of t() calls
                # This is a simplified check
                pass
            
            # Check for Chinese characters
            if has_chinese(line):
                # Ignore if it's a translation key reference
                if 'labelKey:' in line or 'label: t(' in line or 'title: t(' in line:
                    continue
                # Ignore if it's already in t() function
                if re.search(r't\(["\'][^"\']*[\u4e00-\u9fa5][^"\']*["\']', line):
                    continue
                results.append((i, line.rstrip()))
    except Exception as e:
        pass
    
    return results

def main():
    src_dir = 'src'
    exclude_dirs = ['locales', 'node_modules']
    
    all_results = {}
    
    for root, dirs, files in os.walk(src_dir):
        # Remove excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                filepath = os.path.join(root, file)
                results = find_chinese_in_file(filepath)
                if results:
                    all_results[filepath] = results
    
    # Print results
    for filepath, lines in sorted(all_results.items()):
        print(f"\n{filepath}:")
        for line_no, line in lines:
            print(f"  L{line_no}: {line}")

if __name__ == '__main__':
    main()
