import json
import difflib
import re

with open('all_skus.json', 'r', encoding='utf-8') as f:
    skus = json.load(f)

with open('../estoque.json', 'r', encoding='utf-8') as f:
    estoque = json.load(f)

def clean(s):
    if not s:
        return ''
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9 ]', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s

mapped = []

print("Manual Mapping Tool")
for row in estoque:
    name = row.get('Armazém.2') or row.get('Armazém.1')
    qty = row.get('Armazém.4')
    if qty is None or name is None:
        continue
        
    cname = clean(name)
    
    # EXACT MATCH
    exact = [s for s in skus if clean(s['descricao']) == cname]
    if exact:
        mapped.append({'estoque': name, 'sku_id': exact[0]['id'], 'sku_desc': exact[0]['descricao'], 'qty': qty})
        continue
    
    # FUZZY MATCH
    desc_list = [s['descricao'] for s in skus]
    c_desc_list = [clean(s['descricao']) for s in skus]
    
    matches = difflib.get_close_matches(cname, c_desc_list, n=3, cutoff=0.3)
    
    # Try subset matching
    subset_matches = [s['descricao'] for s in skus if all(w in clean(s['descricao']) for w in cname.split())]
    
    print(f"\n--- Need to map: {name} (Qty: {qty}) ---")
    options = []
    
    if subset_matches:
        for s in subset_matches:
            if s not in options: options.append(s)
            
    for m in matches:
        orig_s = desc_list[c_desc_list.index(m)]
        if orig_s not in options:
            options.append(orig_s)
            
    if not options:
        # Just show top 3 difflib
        pass

    for i, opt in enumerate(options[:10]):
        print(f"[{i}] {opt}")
        
    # We will output this to a text file for review instead of interactive
    row['options'] = options[:10]

with open('needs_mapping.json', 'w', encoding='utf-8') as f:
    json.dump(estoque, f, ensure_ascii=False, indent=2)
