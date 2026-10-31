"""Strict, bounded private workspace payloads. No public ownership endpoint."""
import math,re
UUID=re.compile(r'^[0-9a-fA-F-]{36}$')
def validate(data):
    def fail():raise ValueError('Invalid workspace backup or values')
    def string(value,maxlen):
        if not isinstance(value,str) or len(value)>maxlen:fail()
        return value
    def number(value,maximum=1e9,nullable=False):
        if value is None and nullable:return None
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<=maximum:fail()
        return value
    if not isinstance(data,dict):fail()
    result={}
    for name in ('fleet','loadouts','offers'):
        rows=data.get(name)
        if not isinstance(rows,list) or len(rows)>100:fail()
        clean=[];seen=set()
        for row in rows:
            if not isinstance(row,dict):fail()
            ident=string(row.get('id'),80);item=string(row.get('itemId'),36)
            if not ident or ident in seen or not UUID.fullmatch(item):fail()
            seen.add(ident);r=dict(id=ident,itemId=item)
            if name=='fleet':
                q=row.get('quantity');currency=row.get('currency');ownership=row.get('ownership')
                if type(q) is not int or not 1<=q<=100 or currency not in ('USD','EUR','GBP','aUEC') or ownership not in ('pledged','in-game','wishlist'):fail()
                r.update(quantity=q,currency=currency,ownership=ownership,paid=number(row.get('paid'),nullable=True),melt=number(row.get('melt'),nullable=True),note=string(row.get('note',''),160))
            elif name=='loadouts':
                slots=row.get('slots')
                if not isinstance(slots,dict) or len(slots)>100:fail()
                checked={}
                for k,v in slots.items():
                    if not UUID.fullmatch(string(v,36)):fail()
                    checked[string(k,512)]=v
                r.update(name=string(row.get('name'),70),slots=checked)
            else:
                currency=row.get('currency');kind=row.get('kind')
                if currency not in ('USD','EUR','GBP') or kind not in ('standard','warbond','upgrade'):fail()
                r.update(currency=currency,kind=kind,regular=number(row.get('regular')),price=number(row.get('price')),observed=number(row.get('observed'),1e14))
            clean.append(r)
        result[name]=clean
    return result
