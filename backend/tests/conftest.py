"""
Test configuration and fixtures
"""

import os
import uuid
import pytest
from sqlalchemy import create_engine, TypeDecorator, String, event, CHAR
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.dialects.postgresql import ARRAY, UUID
import json


class SQLiteArray(TypeDecorator):
    """
    SQLite adapter for PostgreSQL ARRAY type.
    Stores arrays as JSON strings.
    """
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'sqlite':
            return dialect.type_descriptor(String())
        else:
            return dialect.type_descriptor(ARRAY(String))

    def process_bind_param(self, value, dialect):
        if dialect.name == 'sqlite':
            if value is not None:
                return json.dumps(value)
            return '[]'
        return value

    def process_result_value(self, value, dialect):
        if dialect.name == 'sqlite':
            if value is not None and value != '':
                return json.loads(value)
            return []
        return value


class SQLiteUUID(TypeDecorator):
    """
    SQLite adapter for PostgreSQL UUID type.
    Stores UUID as CHAR(32) string without hyphens.
    """
    impl = CHAR(32)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'sqlite':
            return dialect.type_descriptor(CHAR(32))
        else:
            return dialect.type_descriptor(UUID())

    def process_bind_param(self, value, dialect):
        if dialect.name == 'sqlite':
            if value is not None:
                if isinstance(value, uuid.UUID):
                    # Store UUID as 32-char string without hyphens
                    return value.hex
                else:
                    # Assume it's already a string, try to parse and format
                    return uuid.UUID(value).hex
            return None
        return value

    def process_result_value(self, value, dialect):
        if dialect.name == 'sqlite':
            if value is not None:
                # Convert 32-char hex string back to UUID
                return uuid.UUID(hex=value)
            return None
        return value


# Monkey patch ARRAY and UUID types for SQLite compatibility
from sqlalchemy.dialects import sqlite
sqlite.base.ischema_names['array'] = SQLiteArray
sqlite.base.ischema_names['uuid'] = SQLiteUUID


# Helper function to initialize only the workflow tables needed by workflow API tests.
def init_test_db():
    """
    Initialize both MVP and workflow tables required for tests.
    Uses the app's database engine to ensure consistency.
    
    Note: There are two Base classes in this project:
    - app.db.Base: for MVP models (Project, Task, etc.)
    - app.models.base.Base: for workflow models (WorkflowTemplate, etc.)
    
    We need to create tables for both.
    """
    # Import app.db to use the same engine as the application
    from app.db import engine
    
    # Import both Base classes
    from app.db import Base as MVPBase
    from app.models.base import Base as WorkflowBase
    
    # Import all models to ensure they're registered with their respective Base
    from app.models import workflow  # noqa: F401
    from app import models  # noqa: F401
    
    # Create tables for both Base classes using the same engine
    MVPBase.metadata.create_all(bind=engine)
    WorkflowBase.metadata.create_all(bind=engine)
