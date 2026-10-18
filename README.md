# solvestuff

Fichas de exercícios e percursos de matemática (Básico, Secundário, Universidade), em PT e EN.

## Correr

Requer Node.js 22+ (sem dependências, não é preciso `npm install`).

```bash
cp .env.example .env   # define ADMIN_PASSWORD
node server.js         # ou: node --watch server.js
```

Abre http://localhost:8087. A área do professor está em `#/admin` (link no rodapé).

## Estrutura

```
server.js                 servidor HTTP: API em /api/*, ficheiros estáticos de public/
src/api.js                rotas da API (fichas, upload de PDFs, temas, login admin)
src/store.js              "base de dados" em ficheiros JSON (escritas atómicas)
data/curriculum.seed.json percursos e temas iniciais
storage/                  criado no arranque (não vai para o git)
  curriculum.json         percursos/temas atuais (editáveis na área do professor)
  sheets.json             metadados das fichas
  uploads/<id>.pdf        os PDFs
public/                   a app (SPA em JS puro, rotas com #)
  js/config.js            URL base da API (para a futura app Android)
  js/i18n.js              textos PT/EN
  js/user.js              nome, nível e progresso do aluno (guardados no dispositivo)
```

O `curriculum.seed.json` só é usado na primeira vez que o servidor arranca. Depois disso, edita os temas
na área do professor (ou apaga `storage/curriculum.json` para voltar a usar o seed).

Para fazer backup basta copiar a pasta `storage/`.

## API

| Método | Caminho | |
|---|---|---|
| GET | `/api/curriculum` | níveis e temas |
| GET | `/api/sheets?level=&topic=` | lista de fichas |
| GET | `/api/sheets/:id/file[?download=1]` | o PDF |
| POST | `/api/admin/login` | `{password}` → `{token}` |
| POST | `/api/admin/sheets` | multipart: `file`, `titlePt`, `titleEn`, `descriptionPt`, `descriptionEn`, `level`, `topic`, `difficulty` (1–3) |
| PATCH / DELETE | `/api/admin/sheets/:id` | editar / apagar ficha |
| PATCH | `/api/admin/levels/:level` | `{wip}` |
| POST | `/api/admin/levels/:level/topics` | novo tema |
| PATCH / DELETE | `/api/admin/levels/:level/topics/:topic` | editar, mover (`{move: -1|1}`), apagar |

As rotas `/api/admin/*` precisam de `Authorization: Bearer <token>`.

## Futura app Android (APK)

O frontend é só HTML/CSS/JS estático e fala com o servidor apenas pela API (com CORS ligado), por isso pode
ser embrulhado com [Capacitor](https://capacitorjs.com/) sem mudar nada: copia `public/` para o projeto
Capacitor e define `window.SOLVESTUFF_API_BASE` em `public/js/config.js` com o endereço do servidor publicado.
