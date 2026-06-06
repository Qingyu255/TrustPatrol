# TrustPatrol
Sea x OpenAI Regional Codex Hackathon - Singapore

## Quick Start
```bash
# if you dont have uv installed
pip install uv

# Install Python Packages
uv sync

# Configure your OpenAI API key
cp backend/.env.example backend/.env
# then edit backend/.env and set OPENAI_API_KEY

# If you wanna add a new package
uv add <your-package>


# Run with web interface which also spins up the fast api server
adk web

# View Backend API docs:
http://localhost:8000/docs
```

The ADK dev UI will load the `backend` app, whose `root_agent` is backed by
OpenAI through ADK's LiteLLM connector. Change `OPENAI_MODEL` in `backend/.env` if you
want to use a different OpenAI model.
