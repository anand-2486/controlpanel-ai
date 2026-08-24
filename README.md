### Clone the github repo and then switch to "integration" branch and then create your respective branch and then switch to it and then start working by following methods

1. Set Up the Python Environment
    Change to the backend directory: cd backend.  
    Create a virtual environment: python -m venv venv.  Activate it (Windows: .venv\Scripts\activate, Mac/Linux: source .venv/bin/activate).  
    Install the required packages: pip install -r requirement.txt

2. Run a server
    uvicorn app.main:app --reload --port 8000
    http://localhost:8000/health