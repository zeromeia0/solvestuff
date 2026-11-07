<?php
// PHP port of src/api.js for PHP-only shared hosting (AeonFree). Same routes, same JSON
// files, same responses, so public/ works unchanged. Storage lives in ../storage
// (blocked from the web by its own .htaccess). Needs PHP 7.4+.

declare(strict_types=1);

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_APK_BYTES = 150 * 1024 * 1024;
const SESSION_TTL_S = 12 * 60 * 60;
const PROGRAMMES = ['', 'AE2018', 'AE2023'];
const TOPIC_STATUSES = ['learning', 'known', 'review'];

$CONFIG = require __DIR__ . '/config.php'; // ['admin_password' => '...']
$STORAGE = dirname(__DIR__) . '/storage';
$UPLOADS = "$STORAGE/uploads";
$APP_DIR = "$STORAGE/app";
$APK_FILE = "$APP_DIR/solvestuff.apk";

class HttpError extends Exception
{
    public $status;
    public $codeName;
    public function __construct(int $status, string $code)
    {
        parent::__construct($code);
        $this->status = $status;
        $this->codeName = $code;
    }
}

// ---------- helpers ----------

function send_json(int $status, $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function now_iso(): string
{
    $t = microtime(true);
    return gmdate('Y-m-d\TH:i:s', (int) $t) . sprintf('.%03dZ', (int) (($t - floor($t)) * 1000));
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function text($value, int $max = 200): string
{
    return is_string($value) ? mb_substr(trim($value), 0, $max) : '';
}

function bilingual($pt, $en, int $max): array
{
    return ['pt' => text($pt, $max), 'en' => text($en, $max)];
}

function slugify($value): string
{
    $s = (string) $value;
    if (class_exists('Normalizer')) {
        $s = Normalizer::normalize($s, Normalizer::FORM_D);
        $s = preg_replace('/\p{Mn}/u', '', $s);
    } elseif (function_exists('iconv')) {
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT', $s);
        if ($t !== false) $s = $t;
    }
    $s = strtolower($s);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim($s, '-');
    return substr($s, 0, 60);
}

function prop($obj, string $key)
{
    return is_object($obj) && property_exists($obj, $key) ? $obj->$key : null;
}

function read_json_body(int $maxBytes = 1024 * 1024)
{
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || $raw === '') return new stdClass();
    if (strlen($raw) > $maxBytes) throw new HttpError(413, 'body_too_large');
    $data = json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) throw new HttpError(400, 'invalid_json');
    return is_object($data) ? $data : new stdClass();
}

// Tiny JSON-file "database": an exclusive lock around read-modify-write, atomic rename on save.
class JsonStore
{
    private $file;
    private $fallback;
    public function __construct(string $file, $fallback)
    {
        $this->file = $file;
        $this->fallback = $fallback;
    }
    public function get()
    {
        if (!is_file($this->file)) return $this->update(function () { return null; }) ?? $this->get();
        $data = json_decode((string) file_get_contents($this->file));
        if ($data === null) throw new HttpError(500, 'storage_corrupt');
        return $data;
    }
    // $fn receives the data (stdClass) and may mutate it; validate before mutating.
    public function update(callable $fn)
    {
        $lock = fopen($this->file . '.lock', 'c');
        flock($lock, LOCK_EX);
        try {
            $data = is_file($this->file) ? json_decode((string) file_get_contents($this->file)) : null;
            if ($data === null) $data = json_decode(json_encode($this->fallback));
            $result = $fn($data);
            $tmp = $this->file . '.tmp';
            file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            rename($tmp, $this->file);
            return $result;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}

// ---------- teaching sequence (port of src/sequence.js) ----------

function plain_tex(string $value): string
{
    return preg_replace_callback('/\$([^$]*)\$/u', function ($m) {
        $s = $m[1];
        foreach ([
            ['/\\\\mathbb\s*R/u', 'ℝ'], ['/\\\\mathbb\s*N/u', 'ℕ'], ['/\\\\mathbb\s*Z/u', 'ℤ'],
            ['/\\\\mathbb\s*Q/u', 'ℚ'], ['/\\\\mathbb\s*C/u', 'ℂ'], ['/\^2/u', '²'], ['/\^3/u', '³'],
        ] as [$re, $to]) $s = preg_replace($re, $to, $s);
        return $s;
    }, $value);
}

function programme_of(string $text): ?string
{
    preg_match_all('/AE20(?:18|23)/', $text, $m);
    if (count($m[0]) !== 1) return null;
    return preg_match('/(?:—\s*|\()AE20(?:18|23)\)?$/u', $text) ? $m[0][0] : null;
}

function load_sequence(string $file): array
{
    if (!is_file($file)) return ['parts' => []];
    $parts = [];
    foreach (explode("\n", str_replace("\r\n", "\n", (string) file_get_contents($file))) as $line) {
        if (preg_match('/^# (Parte .+)$/u', $line, $m)) {
            $parts[] = ['title' => trim($m[1]), 'blocks' => []];
        } elseif (preg_match('/^## \d+\.\s+(.+)$/u', $line, $m) && $parts) {
            $parts[count($parts) - 1]['blocks'][] = ['title' => trim($m[1]), 'items' => []];
        } elseif (preg_match('/^(\d+)\.\s+(.+)$/u', $line, $m) && $parts && $parts[count($parts) - 1]['blocks']) {
            $text = trim($m[2]);
            $refs = '';
            if (preg_match('/\s*\(([BS][\d.]+(?:,\s*[BS][\d.]+)*)\)$/u', $text, $t, PREG_OFFSET_CAPTURE)) {
                $refs = $t[1][0];
                $text = substr($text, 0, $t[0][1]);
            }
            $text = plain_tex($text);
            $p = count($parts) - 1;
            $b = count($parts[$p]['blocks']) - 1;
            $parts[$p]['blocks'][$b]['items'][] = ['id' => $m[1], 'text' => $text, 'refs' => $refs, 'programme' => programme_of($text)];
        }
    }
    return ['parts' => array_values(array_filter($parts, function ($p) { return count($p['blocks']) > 0; }))];
}

// ---------- auth: stateless signed tokens (no server-side session storage) ----------

function secret_key(): string
{
    global $STORAGE, $CONFIG;
    $file = "$STORAGE/secret.key";
    if (!is_file($file)) file_put_contents($file, bin2hex(random_bytes(32)));
    return hash('sha256', trim((string) file_get_contents($file)) . '|' . $CONFIG['admin_password']);
}

function make_token(): string
{
    $payload = (string) (time() + SESSION_TTL_S) . '.' . bin2hex(random_bytes(8));
    return $payload . '.' . hash_hmac('sha256', $payload, secret_key());
}

function bearer(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
    }
    if ($h === '') $h = $_SERVER['HTTP_X_AUTHORIZATION'] ?? '';
    return preg_match('/^Bearer (\S+)$/', $h, $m) ? $m[1] : null;
}

function require_admin(): void
{
    $token = bearer();
    $parts = $token ? explode('.', $token) : [];
    if (count($parts) !== 3) throw new HttpError(401, 'unauthorized');
    [$exp, $nonce, $sig] = $parts;
    if (!hash_equals(hash_hmac('sha256', "$exp.$nonce", secret_key()), $sig) || (int) $exp < time()) {
        throw new HttpError(401, 'unauthorized');
    }
}

// ---------- domain helpers ----------

function find_level($curriculum, string $id)
{
    foreach ($curriculum->levels as $l) if ($l->id === $id) return $l;
    throw new HttpError(404, 'level_not_found');
}

function find_topic($level, ?string $id)
{
    foreach ($level->topics as $t) if ($t->id === $id) return $t;
    throw new HttpError(404, 'topic_not_found');
}

function find_student($data, string $id)
{
    foreach ($data->students as $s) if ($s->id === $id) return $s;
    throw new HttpError(404, 'student_not_found');
}

function locale_cmp(string $a, string $b): int
{
    static $collator = null;
    if ($collator === null) $collator = class_exists('Collator') ? new Collator('pt_PT') : false;
    return $collator ? $collator->compare($a, $b) : strcasecmp($a, $b);
}

function student_fields($body, $current = null): array
{
    $name = text(prop($body, 'name') ?? prop($current, 'name'), 80);
    if ($name === '') throw new HttpError(400, 'name_required');
    $programme = prop($body, 'programme') ?? prop($current, 'programme') ?? '';
    if (!in_array($programme, PROGRAMMES, true)) throw new HttpError(400, 'invalid_programme');
    return [
        'name' => $name,
        'grade' => text(prop($body, 'grade') ?? prop($current, 'grade'), 40),
        'programme' => $programme,
        'notes' => text(prop($body, 'notes') ?? prop($current, 'notes'), 4000),
    ];
}

function assign($obj, array $fields)
{
    foreach ($fields as $k => $v) $obj->$k = $v;
    return $obj;
}

// Multipart uploads arrive in $_FILES. If the body is bigger than PHP's post_max_size,
// PHP drops it entirely, so an empty $_FILES with a big Content-Length means "too large".
function uploaded_file(int $maxBytes): array
{
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $maxBytes + 1024 * 1024) throw new HttpError(413, 'file_too_large');
    $f = $_FILES['file'] ?? null;
    if (!$f) throw new HttpError($len > 0 && !$_POST ? 413 : 400, $len > 0 && !$_POST ? 'file_too_large' : 'file_required');
    if (in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) throw new HttpError(413, 'file_too_large');
    if ($f['error'] !== UPLOAD_ERR_OK || !$f['size']) throw new HttpError(400, 'file_required');
    if ($f['size'] > $maxBytes) throw new HttpError(413, 'file_too_large');
    return $f;
}

function send_file(string $path, string $type, string $disposition, string $cache): void
{
    header("Content-Type: $type");
    header('Content-Length: ' . filesize($path));
    header("Content-Disposition: $disposition");
    header("Cache-Control: $cache");
    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') readfile($path);
}

// ---------- stores ----------

if (!is_dir($UPLOADS)) mkdir($UPLOADS, 0755, true);
$seedFile = "$STORAGE/curriculum.seed.json";
$curriculum = new JsonStore("$STORAGE/curriculum.json", is_file($seedFile) ? json_decode((string) file_get_contents($seedFile)) : ['levels' => []]);
$sheets = new JsonStore("$STORAGE/sheets.json", ['sheets' => []]);
$students = new JsonStore("$STORAGE/students.json", ['students' => []]);
$appRelease = new JsonStore("$STORAGE/app.json", ['latest' => null]);

function sorted_sheets(?string $level, ?string $topic): array
{
    global $curriculum, $sheets;
    $rank = [];
    foreach ($curriculum->get()->levels as $li => $l) {
        foreach ($l->topics as $ti => $t) $rank["{$l->id}/{$t->id}"] = $li * 1000 + $ti;
    }
    $list = array_values(array_filter($sheets->get()->sheets, function ($s) use ($level, $topic) {
        return (!$level || $s->level === $level) && (!$topic || $s->topic === $topic);
    }));
    usort($list, function ($a, $b) use ($rank) {
        $d = ($rank["{$a->level}/{$a->topic}"] ?? 1e9) <=> ($rank["{$b->level}/{$b->topic}"] ?? 1e9);
        return $d ?: strcmp($a->createdAt, $b->createdAt);
    });
    return $list;
}

function get_sheet(string $id)
{
    global $sheets;
    foreach ($sheets->get()->sheets as $s) if ($s->id === $id) return $s;
    throw new HttpError(404, 'sheet_not_found');
}

function validate_sheet_fields($fields, $current = null): array
{
    global $curriculum;
    $level = prop($fields, 'level') ?? prop($current, 'level');
    $topic = prop($fields, 'topic') ?? prop($current, 'topic');
    find_topic(find_level($curriculum->get(), (string) $level), $topic);
    $ct = prop($current, 'title');
    $cd = prop($current, 'description');
    $title = bilingual(prop($fields, 'titlePt') ?? prop($ct, 'pt'), prop($fields, 'titleEn') ?? prop($ct, 'en'), 160);
    if ($title['pt'] === '' && $title['en'] === '') throw new HttpError(400, 'title_required');
    $description = bilingual(prop($fields, 'descriptionPt') ?? prop($cd, 'pt'), prop($fields, 'descriptionEn') ?? prop($cd, 'en'), 600);
    return ['level' => $level, 'topic' => $topic, 'title' => $title, 'description' => $description];
}

// ---------- routes ----------

$routes = [
    ['GET', '/api/health', function () { return ['ok' => true]; }],

    ['GET', '/api/curriculum', function () use ($curriculum) { return $curriculum->get(); }],

    ['GET', '/api/sheets', function () {
        return ['sheets' => sorted_sheets($_GET['level'] ?? null, $_GET['topic'] ?? null)];
    }],

    ['GET', '/api/sheets/:id/file', function ($p) use ($UPLOADS) {
        $sheet = get_sheet($p['id']);
        $file = "$UPLOADS/" . basename($sheet->file);
        if (!is_file($file)) throw new HttpError(404, 'file_missing');
        $name = (slugify($sheet->title->pt ?: $sheet->title->en) ?: 'ficha') . '.pdf';
        $disp = isset($_GET['download']) ? 'attachment' : 'inline';
        send_file($file, 'application/pdf', "$disp; filename=\"$name\"", 'private, max-age=300');
        return null;
    }],

    ['POST', '/api/admin/login', function () use ($CONFIG) {
        $body = read_json_body();
        $given = hash('sha256', (string) (prop($body, 'password') ?? ''));
        if (!hash_equals(hash('sha256', $CONFIG['admin_password']), $given)) throw new HttpError(401, 'wrong_password');
        return ['token' => make_token()];
    }],

    // Tokens are stateless, so logout just lets the client forget its token.
    ['POST', '/api/admin/logout', function () { return ['ok' => true]; }],

    ['GET', '/api/admin/me', function () { require_admin(); return ['ok' => true]; }],

    // --- Android app ---
    ['GET', '/api/app/latest', function () use ($appRelease) { return $appRelease->get(); }],

    ['GET', '/api/app/apk', function () use ($appRelease, $APK_FILE) {
        $latest = $appRelease->get()->latest;
        if (!$latest || !is_file($APK_FILE)) throw new HttpError(404, 'apk_missing');
        $v = preg_replace('/[^\w.-]/', '', (string) $latest->versionName) ?: $latest->versionCode;
        send_file($APK_FILE, 'application/vnd.android.package-archive', "attachment; filename=\"solvestuff-$v.apk\"", 'no-cache');
        return null;
    }],

    ['POST', '/api/admin/app', function () use ($appRelease, $APP_DIR, $APK_FILE) {
        require_admin();
        $f = uploaded_file(MAX_APK_BYTES);
        if (file_get_contents($f['tmp_name'], false, null, 0, 4) !== "PK\x03\x04") throw new HttpError(400, 'not_an_apk');
        $versionCode = filter_var($_POST['versionCode'] ?? '', FILTER_VALIDATE_INT);
        if ($versionCode === false || $versionCode < 1) throw new HttpError(400, 'invalid_version');
        $latest = $appRelease->get()->latest;
        if ($latest && $versionCode <= $latest->versionCode) throw new HttpError(409, 'version_not_newer');
        if (!is_dir($APP_DIR)) mkdir($APP_DIR, 0755, true);
        move_uploaded_file($f['tmp_name'], "$APK_FILE.tmp");
        rename("$APK_FILE.tmp", $APK_FILE);
        return $appRelease->update(function ($data) use ($versionCode, $f) {
            $data->latest = [
                'versionCode' => $versionCode,
                'versionName' => text($_POST['versionName'] ?? '', 40) ?: (string) $versionCode,
                'notes' => text($_POST['notes'] ?? '', 600),
                'size' => (int) $f['size'],
                'publishedAt' => now_iso(),
            ];
            return $data;
        });
    }],

    // --- sheets ---
    ['POST', '/api/admin/sheets', function () use ($sheets, $UPLOADS) {
        require_admin();
        $f = uploaded_file(MAX_PDF_BYTES);
        if (file_get_contents($f['tmp_name'], false, null, 0, 5) !== '%PDF-') throw new HttpError(400, 'not_a_pdf');
        $meta = validate_sheet_fields((object) $_POST);
        $id = uuid4();
        $sheet = array_merge(['id' => $id], $meta, [
            'file' => "$id.pdf",
            'originalName' => text($f['name'], 200),
            'size' => (int) $f['size'],
            'createdAt' => now_iso(),
        ]);
        move_uploaded_file($f['tmp_name'], "$UPLOADS/$id.pdf");
        $sheets->update(function ($data) use ($sheet) { $data->sheets[] = $sheet; });
        return $sheet;
    }],

    ['PATCH', '/api/admin/sheets/:id', function ($p) use ($sheets) {
        require_admin();
        $body = read_json_body();
        $meta = validate_sheet_fields($body, get_sheet($p['id']));
        return $sheets->update(function ($data) use ($p, $meta) {
            foreach ($data->sheets as $s) {
                if ($s->id === $p['id']) return assign($s, $meta + ['updatedAt' => now_iso()]);
            }
            throw new HttpError(404, 'sheet_not_found');
        });
    }],

    ['DELETE', '/api/admin/sheets/:id', function ($p) use ($sheets, $UPLOADS) {
        require_admin();
        $sheet = get_sheet($p['id']);
        $sheets->update(function ($data) use ($sheet) {
            $data->sheets = array_values(array_filter($data->sheets, function ($s) use ($sheet) { return $s->id !== $sheet->id; }));
        });
        @unlink("$UPLOADS/" . basename($sheet->file));
        return ['ok' => true];
    }],

    // --- curriculum ---
    ['PATCH', '/api/admin/levels/:level', function ($p) use ($curriculum) {
        require_admin();
        $body = read_json_body();
        return $curriculum->update(function ($data) use ($p, $body) {
            $level = find_level($data, $p['level']);
            if (is_bool(prop($body, 'wip'))) $level->wip = $body->wip;
            return $level;
        });
    }],

    ['POST', '/api/admin/levels/:level/topics', function ($p) use ($curriculum) {
        require_admin();
        $body = read_json_body();
        $name = bilingual(prop($body, 'namePt'), prop($body, 'nameEn'), 80);
        if ($name['pt'] === '' && $name['en'] === '') throw new HttpError(400, 'name_required');
        $id = slugify(prop($body, 'id') ?: ($name['pt'] ?: $name['en']));
        if ($id === '') throw new HttpError(400, 'invalid_id');
        return $curriculum->update(function ($data) use ($p, $body, $name, $id) {
            $level = find_level($data, $p['level']);
            foreach ($level->topics as $t) if ($t->id === $id) throw new HttpError(409, 'topic_exists');
            $topic = (object) [
                'id' => $id,
                'name' => $name,
                'description' => bilingual(prop($body, 'descriptionPt'), prop($body, 'descriptionEn'), 300),
                'wip' => (bool) prop($body, 'wip'),
            ];
            $level->topics[] = $topic;
            return $topic;
        });
    }],

    ['PATCH', '/api/admin/levels/:level/topics/:topic', function ($p) use ($curriculum) {
        require_admin();
        $body = read_json_body();
        return $curriculum->update(function ($data) use ($p, $body) {
            $level = find_level($data, $p['level']);
            $topic = find_topic($level, $p['topic']);
            $name = bilingual(prop($body, 'namePt') ?? $topic->name->pt, prop($body, 'nameEn') ?? $topic->name->en, 80);
            if ($name['pt'] === '' && $name['en'] === '') throw new HttpError(400, 'name_required');
            $cd = prop($topic, 'description');
            $topic->name = $name;
            $topic->description = bilingual(prop($body, 'descriptionPt') ?? prop($cd, 'pt'), prop($body, 'descriptionEn') ?? prop($cd, 'en'), 300);
            if (is_bool(prop($body, 'wip'))) $topic->wip = $body->wip;
            $move = (int) (prop($body, 'move') ?? 0);
            if ($move === -1 || $move === 1) {
                $i = array_search($topic, $level->topics, true);
                $j = $i + $move;
                if ($j >= 0 && $j < count($level->topics)) {
                    [$level->topics[$i], $level->topics[$j]] = [$level->topics[$j], $level->topics[$i]];
                }
            }
            return $topic;
        });
    }],

    ['DELETE', '/api/admin/levels/:level/topics/:topic', function ($p) use ($curriculum, $sheets) {
        require_admin();
        foreach ($sheets->get()->sheets as $s) {
            if ($s->level === $p['level'] && $s->topic === $p['topic']) throw new HttpError(409, 'topic_has_sheets');
        }
        return $curriculum->update(function ($data) use ($p) {
            $level = find_level($data, $p['level']);
            find_topic($level, $p['topic']);
            $level->topics = array_values(array_filter($level->topics, function ($t) use ($p) { return $t->id !== $p['topic']; }));
            return ['ok' => true];
        });
    }],

    // --- students ---
    ['GET', '/api/admin/sequence', function () use ($STORAGE) {
        require_admin();
        return load_sequence("$STORAGE/Matematica_Sequencia_de_Ensino.md");
    }],

    ['GET', '/api/admin/students', function () use ($students) {
        require_admin();
        $all = $students->get()->students;
        usort($all, function ($a, $b) { return locale_cmp($a->name, $b->name); });
        return ['students' => $all];
    }],

    ['POST', '/api/admin/students', function () use ($students) {
        require_admin();
        $fields = student_fields(read_json_body());
        $now = now_iso();
        $student = (object) array_merge(['id' => uuid4()], $fields, ['progress' => new stdClass(), 'createdAt' => $now, 'updatedAt' => $now]);
        return $students->update(function ($data) use ($student) { $data->students[] = $student; return $student; });
    }],

    ['GET', '/api/admin/students/:id', function ($p) use ($students) {
        require_admin();
        return find_student($students->get(), $p['id']);
    }],

    ['PATCH', '/api/admin/students/:id', function ($p) use ($students) {
        require_admin();
        $body = read_json_body();
        return $students->update(function ($data) use ($p, $body) {
            $s = find_student($data, $p['id']);
            return assign($s, student_fields($body, $s) + ['updatedAt' => now_iso()]);
        });
    }],

    // {topics: {"12": "known", "13": null}} sets or clears the status of several topics at once.
    ['PATCH', '/api/admin/students/:id/progress', function ($p) use ($students, $STORAGE) {
        require_admin();
        $topics = prop(read_json_body(), 'topics');
        if (!is_object($topics)) throw new HttpError(400, 'invalid_progress');
        $ids = [];
        foreach (load_sequence("$STORAGE/Matematica_Sequencia_de_Ensino.md")['parts'] as $part) {
            foreach ($part['blocks'] as $block) foreach ($block['items'] as $item) $ids[$item['id']] = true;
        }
        foreach ($topics as $id => $status) {
            if (!isset($ids[(string) $id]) || ($status !== null && !in_array($status, TOPIC_STATUSES, true))) {
                throw new HttpError(400, 'invalid_progress');
            }
        }
        return $students->update(function ($data) use ($p, $topics) {
            $s = find_student($data, $p['id']);
            if (!is_object($s->progress)) $s->progress = (object) $s->progress;
            $now = now_iso();
            foreach ($topics as $id => $status) {
                $id = (string) $id;
                if ($status === null) unset($s->progress->$id);
                elseif ((prop(prop($s->progress, $id), 'status')) !== $status) $s->progress->$id = ['status' => $status, 'at' => $now];
            }
            $s->updatedAt = $now;
            return $s;
        });
    }],

    ['DELETE', '/api/admin/students/:id', function ($p) use ($students) {
        require_admin();
        return $students->update(function ($data) use ($p) {
            find_student($data, $p['id']);
            $data->students = array_values(array_filter($data->students, function ($s) use ($p) { return $s->id !== $p['id']; }));
            return ['ok' => true];
        });
    }],
];

// ---------- dispatch ----------

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-HTTP-Method-Override, X-Authorization');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
// Some shared hosts block PATCH/DELETE, so the client may send POST + X-HTTP-Method-Override.
$override = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '');
if ($method === 'POST' && in_array($override, ['PATCH', 'DELETE'], true)) $method = $override;
if ($method === 'HEAD') $method = 'GET';

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$path = rtrim($path, '/') ?: '/';

try {
    foreach ($routes as [$m, $pattern, $handler]) {
        $keys = [];
        $regex = '#^' . preg_replace_callback('/:(\w+)/', function ($x) use (&$keys) { $keys[] = $x[1]; return '([^/]+)'; }, $pattern) . '$#';
        if ($m !== $method || !preg_match($regex, $path, $match)) continue;
        $params = [];
        foreach ($keys as $i => $k) $params[$k] = $match[$i + 1];
        $result = $handler($params);
        if ($result !== null) send_json(200, $result);
        exit;
    }
    throw new HttpError(404, 'not_found');
} catch (HttpError $e) {
    if (!headers_sent()) send_json($e->status, ['error' => $e->codeName]);
} catch (Throwable $e) {
    error_log((string) $e);
    if (!headers_sent()) send_json(500, ['error' => 'server_error']);
}
