import sys
import os

# Add the parent directory to sys.path so we can import 'app'
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def test_app_initialization():
    """
    A basic smoke test to ensure the FastAPI app and its routers 
    can be initialized without the dependency injection errors 
    we encountered in production.
    """
    try:
        from app.main import app
        print("✅ FastAPI app initialized successfully.")
        
        # Check if routers are registered
        routes = [route.path for route in app.routes]
        print(f"✅ Found {len(routes)} routes registered.")
        
        if len(routes) < 10:
            print("❌ Suspiciously low number of routes.")
            sys.exit(1)
            
    except AssertionError as e:
        print(f"❌ Initialization failed with AssertionError: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error during initialization: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_app_initialization()
