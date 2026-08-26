import json

with open('needs_mapping.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with open('all_skus.json', 'r', encoding='utf-8') as f:
    skus = json.load(f)

def get_sku(desc):
    for s in skus:
        if s['descricao'] == desc:
            return s['id']
    return None

updates = []

for row in data:
    name = row.get('Armazém.2') or row.get('Armazém.1')
    qty = row.get('Armazém.4')
    opts = row.get('options', [])
    if qty is None or name is None:
        continue
        
    chosen = None
    if not opts:
        # Was exactly matched by match_skus.py ? Wait, match_skus.py didn't put it in options if it was exact match.
        cname = name.lower().strip()
        for s in skus:
            if s['descricao'].lower().strip() == cname:
                chosen = s['descricao']
                break
    else:
        # Rules for choosing
        n_lower = name.lower()
        is_kit = '2un' in n_lower or '2 un' in n_lower or 'kit' in n_lower
        is_new = 'new' in n_lower
        
        for o in opts:
            o_lower = o.lower()
            o_is_kit = 'kit 2' in o_lower
            o_is_new = 'new' in o_lower
            
            if is_kit == o_is_kit and is_new == o_is_new:
                chosen = o
                break
        
        if not chosen:
            chosen = opts[0]
            
    if chosen:
        updates.append({
            'original': name,
            'chosen': chosen,
            'sku_id': get_sku(chosen),
            'qty': qty
        })

with open('final_updates.json', 'w', encoding='utf-8') as f:
    json.dump(updates, f, ensure_ascii=False, indent=2)
