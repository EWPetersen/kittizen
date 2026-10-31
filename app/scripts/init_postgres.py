"""Run once against a new beta database; never copies or alters local SQLite."""
import os, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import database

def main():
    url=os.environ.get('KITTIZEN_DATABASE_URL')
    if not url: raise SystemExit('Set KITTIZEN_DATABASE_URL privately in your environment first.')
    schema=Path(__file__).resolve().parents[1]/'deployment/schema.sql'
    try:
        with database.connect(url) as db:
            db.raw.execute('SELECT pg_advisory_xact_lock(731908177)')
            db.raw.execute(schema.read_text(encoding='utf-8'))
    except Exception:
        raise SystemExit('Database initialization failed. Check the connection, SSL and database permissions; no credentials were printed.')
    print('Kittizen beta schema initialized. Local SQLite data was not copied.')
if __name__=='__main__': main()
