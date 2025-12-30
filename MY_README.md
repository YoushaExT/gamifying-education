FRONTEND
```
nvm use
```

```
npm i
```

```
npm run dev
```

BACKEND

Activate venv
```
source backend/.venv/bin/activate
```

Run
```
docker compose watch
```

LOGIN

`admin@example.com`

`12345678`

Generate types
```
./scripts/generate-client.sh
```

LINT FE
```
cd frontend/
npm run lint
```

LINT BE (activate venv first)
```
cd backend/
bash scripts/lint.sh
```