const LANG_KEY = 'solvestuff.lang';

const dict = {
  pt: {
    'nav.home': 'Início',
    'nav.pathway': 'Percurso',
    'nav.sheets': 'Fichas',
    'nav.profile': 'Perfil',
    'nav.admin': 'Área do professor',

    'login.title': 'Bem-vindo ao solvestuff',
    'login.subtitle': 'Fichas de exercícios e o teu percurso de matemática, tudo num só sítio.',
    'login.name': 'Como te chamas?',
    'login.namePlaceholder': 'O teu nome',
    'login.level': 'Em que nível estás?',
    'login.submit': 'Entrar',
    'login.nameRequired': 'Escreve o teu nome.',

    'home.hello': 'Olá, {name}!',
    'home.levelIs': 'O teu nível: {level}',
    'home.progress': 'Progresso no percurso',
    'home.continue': 'Continua por aqui',
    'home.continueEmpty': 'Ainda não há fichas para o teu nível. Volta em breve!',
    'home.allDone': 'Fizeste todas as fichas disponíveis. Excelente trabalho!',
    'home.latest': 'Fichas mais recentes',
    'home.seePathway': 'Ver percurso completo',

    'pathway.title': 'Percurso',
    'pathway.intro': 'Segue os temas por ordem. Cada tema tem fichas de exercícios para praticar.',
    'pathway.buildsOn': 'Este percurso assume que já dominas o nível {level}.',
    'pathway.review': 'Rever',
    'pathway.empty': 'Os temas deste nível ainda estão a ser preparados.',
    'pathway.yourLevel': 'o teu nível',

    'topic.back': '← Voltar ao percurso',
    'topic.empty': 'Ainda não há fichas neste tema.',

    'sheets.title': 'Fichas de exercícios',
    'sheets.search': 'Pesquisar…',
    'sheets.allLevels': 'Todos os níveis',
    'sheets.allTopics': 'Todos os temas',
    'sheets.allDifficulties': 'Todas as dificuldades',
    'sheets.hideDone': 'Esconder feitas',
    'sheets.none': 'Nenhuma ficha encontrada.',
    'sheets.count': '{n} fichas',

    'sheet.open': 'Abrir',
    'sheet.download': 'Descarregar',
    'sheet.markDone': 'Marcar como feita',
    'sheet.done': 'Feita',
    'sheet.count': '{done}/{total} feitas',

    'difficulty.1': 'Fácil',
    'difficulty.2': 'Médio',
    'difficulty.3': 'Difícil',

    'profile.title': 'Perfil',
    'profile.name': 'Nome',
    'profile.level': 'Nível',
    'profile.language': 'Idioma',
    'profile.save': 'Guardar',
    'profile.saved': 'Perfil guardado.',
    'profile.logout': 'Sair',
    'profile.resetProgress': 'Apagar progresso',
    'profile.resetConfirm': 'Tens a certeza? Clica outra vez para confirmar.',
    'profile.note': 'O teu nome e progresso ficam guardados apenas neste dispositivo.',

    'wip': 'Em construção',
    'loading': 'A carregar…',
    'error': 'Algo correu mal. Tenta outra vez.',

    'admin.title': 'Área do professor',
    'admin.password': 'Palavra-passe',
    'admin.login': 'Entrar',
    'admin.logout': 'Sair da área do professor',
    'admin.wrongPassword': 'Palavra-passe errada.',
    'admin.upload': 'Carregar ficha (PDF)',
    'admin.file': 'Ficheiro PDF',
    'admin.titlePt': 'Título (PT)',
    'admin.titleEn': 'Título (EN, opcional)',
    'admin.descPt': 'Descrição (PT, opcional)',
    'admin.descEn': 'Descrição (EN, opcional)',
    'admin.level': 'Nível',
    'admin.topic': 'Tema',
    'admin.difficulty': 'Dificuldade',
    'admin.uploadBtn': 'Carregar',
    'admin.uploading': 'A carregar…',
    'admin.uploaded': 'Ficha carregada!',
    'admin.sheets': 'Fichas carregadas',
    'admin.noSheets': 'Ainda não carregaste nenhuma ficha.',
    'admin.edit': 'Editar',
    'admin.delete': 'Apagar',
    'admin.confirmDelete': 'Confirmar?',
    'admin.save': 'Guardar',
    'admin.cancel': 'Cancelar',
    'admin.curriculum': 'Percursos e temas',
    'admin.levelWip': 'Nível em construção',
    'admin.topicWip': 'Em construção',
    'admin.addTopic': 'Adicionar tema',
    'admin.namePt': 'Nome (PT)',
    'admin.nameEn': 'Nome (EN)',
    'admin.add': 'Adicionar',
    'admin.moveUp': 'Subir',
    'admin.moveDown': 'Descer',
    'admin.noTopics': 'Sem temas ainda.',

    'err.file_too_large': 'O ficheiro é demasiado grande (máx. 50 MB).',
    'err.not_a_pdf': 'O ficheiro tem de ser um PDF.',
    'err.file_required': 'Escolhe um ficheiro PDF.',
    'err.title_required': 'Escreve um título.',
    'err.topic_has_sheets': 'Este tema tem fichas. Apaga-as ou muda-as de tema primeiro.',
    'err.topic_exists': 'Já existe um tema com esse nome.',
    'err.name_required': 'Escreve um nome.',
    'err.unauthorized': 'Sessão expirada. Entra outra vez.',
  },
  en: {
    'nav.home': 'Home',
    'nav.pathway': 'Pathway',
    'nav.sheets': 'Sheets',
    'nav.profile': 'Profile',
    'nav.admin': 'Teacher area',

    'login.title': 'Welcome to solvestuff',
    'login.subtitle': 'Exercise sheets and your math pathway, all in one place.',
    'login.name': "What's your name?",
    'login.namePlaceholder': 'Your name',
    'login.level': 'Which level are you at?',
    'login.submit': 'Start',
    'login.nameRequired': 'Please enter your name.',

    'home.hello': 'Hello, {name}!',
    'home.levelIs': 'Your level: {level}',
    'home.progress': 'Pathway progress',
    'home.continue': 'Pick up here',
    'home.continueEmpty': 'No sheets for your level yet. Check back soon!',
    'home.allDone': "You've done every sheet available. Great work!",
    'home.latest': 'Latest sheets',
    'home.seePathway': 'See full pathway',

    'pathway.title': 'Pathway',
    'pathway.intro': 'Follow the topics in order. Each topic has exercise sheets to practise.',
    'pathway.buildsOn': 'This pathway assumes you already know the {level} level.',
    'pathway.review': 'Review',
    'pathway.empty': 'Topics for this level are still being prepared.',
    'pathway.yourLevel': 'your level',

    'topic.back': '← Back to pathway',
    'topic.empty': 'No sheets in this topic yet.',

    'sheets.title': 'Exercise sheets',
    'sheets.search': 'Search…',
    'sheets.allLevels': 'All levels',
    'sheets.allTopics': 'All topics',
    'sheets.allDifficulties': 'All difficulties',
    'sheets.hideDone': 'Hide done',
    'sheets.none': 'No sheets found.',
    'sheets.count': '{n} sheets',

    'sheet.open': 'Open',
    'sheet.download': 'Download',
    'sheet.markDone': 'Mark as done',
    'sheet.done': 'Done',
    'sheet.count': '{done}/{total} done',

    'difficulty.1': 'Easy',
    'difficulty.2': 'Medium',
    'difficulty.3': 'Hard',

    'profile.title': 'Profile',
    'profile.name': 'Name',
    'profile.level': 'Level',
    'profile.language': 'Language',
    'profile.save': 'Save',
    'profile.saved': 'Profile saved.',
    'profile.logout': 'Log out',
    'profile.resetProgress': 'Reset progress',
    'profile.resetConfirm': 'Are you sure? Click again to confirm.',
    'profile.note': 'Your name and progress are only stored on this device.',

    'wip': 'Work in progress',
    'loading': 'Loading…',
    'error': 'Something went wrong. Please try again.',

    'admin.title': 'Teacher area',
    'admin.password': 'Password',
    'admin.login': 'Log in',
    'admin.logout': 'Leave teacher area',
    'admin.wrongPassword': 'Wrong password.',
    'admin.upload': 'Upload sheet (PDF)',
    'admin.file': 'PDF file',
    'admin.titlePt': 'Title (PT)',
    'admin.titleEn': 'Title (EN, optional)',
    'admin.descPt': 'Description (PT, optional)',
    'admin.descEn': 'Description (EN, optional)',
    'admin.level': 'Level',
    'admin.topic': 'Topic',
    'admin.difficulty': 'Difficulty',
    'admin.uploadBtn': 'Upload',
    'admin.uploading': 'Uploading…',
    'admin.uploaded': 'Sheet uploaded!',
    'admin.sheets': 'Uploaded sheets',
    'admin.noSheets': "You haven't uploaded any sheets yet.",
    'admin.edit': 'Edit',
    'admin.delete': 'Delete',
    'admin.confirmDelete': 'Confirm?',
    'admin.save': 'Save',
    'admin.cancel': 'Cancel',
    'admin.curriculum': 'Pathways and topics',
    'admin.levelWip': 'Level is work in progress',
    'admin.topicWip': 'Work in progress',
    'admin.addTopic': 'Add topic',
    'admin.namePt': 'Name (PT)',
    'admin.nameEn': 'Name (EN)',
    'admin.add': 'Add',
    'admin.moveUp': 'Move up',
    'admin.moveDown': 'Move down',
    'admin.noTopics': 'No topics yet.',

    'err.file_too_large': 'File is too large (max 50 MB).',
    'err.not_a_pdf': 'The file must be a PDF.',
    'err.file_required': 'Choose a PDF file.',
    'err.title_required': 'Enter a title.',
    'err.topic_has_sheets': 'This topic has sheets. Delete or move them first.',
    'err.topic_exists': 'A topic with that name already exists.',
    'err.name_required': 'Enter a name.',
    'err.unauthorized': 'Session expired. Log in again.',
  },
};

function readLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved in dict) return saved;
  } catch {}
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

let lang = readLang();

export const getLang = () => lang;

export function setLang(next) {
  if (!(next in dict)) return;
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {}
  document.documentElement.lang = next;
}

export function t(key, vars = {}) {
  const str = dict[lang][key] ?? dict.pt[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// Pick the current language from a {pt, en} object, falling back to the other.
export function L(obj) {
  if (!obj) return '';
  return obj[lang] || obj.pt || obj.en || '';
}

export function errorMessage(err) {
  const key = `err.${err?.code}`;
  return t(key) === key ? t('error') : t(key);
}
