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
src/sequence.js           lê Matematica_Sequencia_de_Ensino.md (checklist dos alunos)
data/curriculum.seed.json percursos e temas iniciais
storage/                  criado no arranque (não vai para o git)
  curriculum.json         percursos/temas atuais (editáveis na área do professor)
  sheets.json             metadados das fichas
  students.json           alunos do professor e o checklist de cada um
  uploads/<id>.pdf        os PDFs
public/                   a app (SPA em JS puro, rotas com #)
  js/config.js            URL base da API (para a futura app Android)
  js/i18n.js              textos PT/EN
  js/user.js              nome, nível e progresso do aluno (guardados no dispositivo)
```

O `curriculum.seed.json` só é usado na primeira vez que o servidor arranca. Depois disso, edita os temas
na área do professor (ou apaga `storage/curriculum.json` para voltar a usar o seed).

Para fazer backup basta copiar a pasta `storage/`.

## Alunos (área do professor → Alunos)

O checklist de cada aluno é a lista de `Matematica_Sequencia_de_Ensino.md`, lida quando o servidor arranca
(reinicia-o depois de editar o ficheiro). O progresso fica guardado pelo **número** de cada tópico, por isso
acrescenta tópicos novos no fim em vez de renumerar a lista.

## API

| Método | Caminho | |
|---|---|---|
| GET | `/api/curriculum` | níveis e temas |
| GET | `/api/sheets?level=&topic=` | lista de fichas |
| GET | `/api/sheets/:id/file[?download=1]` | o PDF |
| POST | `/api/admin/login` | `{password}` → `{token}` |
| POST | `/api/admin/sheets` | multipart: `file`, `titlePt`, `titleEn`, `descriptionPt`, `descriptionEn`, `level`, `topic` |
| PATCH / DELETE | `/api/admin/sheets/:id` | editar / apagar ficha |
| PATCH | `/api/admin/levels/:level` | `{wip}` |
| POST | `/api/admin/levels/:level/topics` | novo tema |
| PATCH / DELETE | `/api/admin/levels/:level/topics/:topic` | editar, mover (`{move: -1|1}`), apagar |
| GET | `/api/admin/sequence` | sequência de ensino (lida do `.md`) |
| GET / POST | `/api/admin/students` | listar / criar aluno (`{name, grade, programme, notes}`) |
| GET / PATCH / DELETE | `/api/admin/students/:id` | ver / editar / apagar aluno |
| PATCH | `/api/admin/students/:id/progress` | `{topics: {"12": "known" \| "learning" \| "review" \| null}}` |

As rotas `/api/admin/*` precisam de `Authorization: Bearer <token>`.

## App Android (APK)

A app é o `public/` embrulhado com [Capacitor](https://capacitorjs.com/), em `mobile/`. Fala com o servidor
pela API, por isso **o servidor tem de estar acessível a partir do telemóvel**.

```bash
make apk                                  # usa o servidor de mobile/app.json
SERVER=https://o-meu-servidor.pt make apk # ou outro
```

Gera `mobile/dist/solvestuff-<versão>-build<n>.apk`. O número da build sobe sozinho a cada `make apk`
(fica guardado em `mobile/app.json`); a versão vem do `package.json`.

O build usa o JDK 21 e o Android SDK em `~/.local/share/android-toolchain/` (ou `JAVA_HOME`/`ANDROID_HOME`).

**Publicar uma atualização:** área do professor → *App Android* → carrega o APK → *Publicar*. Sempre que a app
abre (ou volta ao ecrã), pergunta ao servidor (`GET /api/app/latest`) se há uma build mais recente e, se houver,
mostra o aviso "Há uma nova versão da app". O botão *Atualizar* descarrega o APK (`GET /api/app/apk`) no browser
do telemóvel, e o aluno instala-o por cima da versão antiga, sem perder o progresso.

**Chave de assinatura:** o primeiro `make apk` cria `mobile/release.keystore` e `mobile/keystore.properties`
(fora do git). **Faz backup destes dois ficheiros.** O Android só aceita uma atualização assinada com a mesma
chave; sem eles, os alunos teriam de desinstalar a app (e perder o progresso) para instalar a nova.

## Publicar (AeonFree — https://solvestuff.zya.me)

O alojamento só corre PHP, por isso o site usa `hosting/api/index.php` (port em PHP de `src/api.js`, mesmas rotas
e mesmos ficheiros JSON). **Se mudares uma rota em `src/api.js`, muda também em `hosting/api/index.php`.**

```bash
make deploy                # envia o código alterado e sincroniza os dados nos dois sentidos
FORCE=local make deploy    # conflito: fica a versão local
FORCE=live make deploy     # conflito: fica a versão do site
```

Precisa de `FTP_USER` e `FTP_PASS` no `.env`. Os dados (`storage/`) sincronizam com base no último deploy
(`.deploy-state/`): alterações só locais sobem, alterações feitas no site (área do professor) descem, e se o mesmo
ficheiro mudou dos dois lados o deploy pára sem escrever nada. O que for substituído fica em `backups/`.
