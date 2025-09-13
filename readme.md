frontend:
cd frontend

for dev:
npm install
npm run dev

for prod:
npm install
npm run build
npm start

backend:
first fill .env.example to .env
cd backend
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
uvicorn main:app --reload

tech stack: nextjs, tailwindcss, fastapi, documentai, gcp bucket, gemini sdk, faiss, langchain