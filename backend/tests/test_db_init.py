"""
Simple test to verify database initialization
"""
import os
import sys

# Add the backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test database
os.environ["DATABASE_URL"] = "sqlite:///./test_init.db"

from tests.conftest import init_test_db

try:
    print("Attempting to initialize test database...")
    init_test_db()
    print("✓ Database initialization successful!")
except Exception as e:
    print(f"✗ Database initialization failed: {e}")
    import traceback
    traceback.print_exc()
finally:
    # Clean up test database
    if os.path.exists("./test_init.db"):
        os.unlink("./test_init.db")
        print("✓ Test database cleaned up")
