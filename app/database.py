"""Small Postgres adapter; local SQLite remains the default in server.py.

Queries keep SQLite's ? placeholders and row indexing. Only application-owned SQL
is translated; all user values remain bound parameters. Supabase's transaction
pooler owns pooling, so connections close at the end of every request.
"""
import os
import re
import sqlite3
from contextlib import contextmanager

class Row(dict):
    def __getitem__(self, key):
        return tuple(self.values())[key] if isinstance(key, int) else super().__getitem__(key)

def row_factory(cursor):
    names = [column.name for column in (cursor.description or [])]
    return lambda values: Row(zip(names, values))

def postgres_sql(sql):
    # Reserved column name in our original schema. Never translate string literals.
    return ''.join(part if i % 2 else re.sub(r'(?<!["\w])user(?!["\w])', '"user"', part).replace('?', '%s')
                   for i, part in enumerate(re.split(r"('(?:[^']|'')*')", sql)))

class Connection:
    def __init__(self, raw, driver):
        self.raw, self.driver = raw, driver
    def executemany(self, sql, params):
        try:
            return self.raw.cursor().executemany(postgres_sql(sql),params)
        except self.driver.IntegrityError as error:
            raise sqlite3.IntegrityError('Database constraint conflict') from error
    def execute(self, sql, params=()):
        try:
            return self.raw.execute(postgres_sql(sql), params)
        except self.driver.IntegrityError as error:
            # Preserve the API's existing conflict handling, without leaking SQL.
            raise sqlite3.IntegrityError('Database constraint conflict') from error

@contextmanager
def connect(url):
    import psycopg
    options = dict(row_factory=row_factory, connect_timeout=10, prepare_threshold=None)
    if os.environ.get('KITTIZEN_PG_TEST') != '1':
        options['sslmode'] = 'require'
    with psycopg.connect(url, **options) as raw:
        with raw.cursor() as cursor:
            cursor.execute("SET statement_timeout = '15s'")
            cursor.execute("SET lock_timeout = '5s'")
            cursor.execute('SET search_path TO kittizen, pg_catalog')
        yield Connection(raw, psycopg)
