'use strict';

const ITALIAN_ALPHABET = [
    { letter: 'A', name: 'A',       word: 'amico',    meaning: 'friend',         sound: 'ah' },
    { letter: 'B', name: 'Bi',      word: 'bello',    meaning: 'beautiful',      sound: 'bee' },
    { letter: 'C', name: 'Ci',      word: 'casa',     meaning: 'house',          sound: 'chee' },
    { letter: 'D', name: 'Di',      word: 'donna',    meaning: 'woman',          sound: 'dee' },
    { letter: 'E', name: 'E',       word: 'essere',   meaning: 'to be',          sound: 'eh' },
    { letter: 'F', name: 'Effe',    word: 'fare',     meaning: 'to do / make',   sound: 'EF-feh' },
    { letter: 'G', name: 'Gi',      word: 'gatto',    meaning: 'cat',            sound: 'jee' },
    { letter: 'H', name: 'Acca',    word: 'hanno',    meaning: 'they have',      sound: 'AK-kah (silent)' },
    { letter: 'I', name: 'I',       word: 'Italia',   meaning: 'Italy',          sound: 'ee' },
    { letter: 'L', name: 'Elle',    word: 'libro',    meaning: 'book',           sound: 'EL-leh' },
    { letter: 'M', name: 'Emme',    word: 'madre',    meaning: 'mother',         sound: 'EM-meh' },
    { letter: 'N', name: 'Enne',    word: 'notte',    meaning: 'night',          sound: 'EN-neh' },
    { letter: 'O', name: 'O',       word: 'ora',      meaning: 'now / hour',     sound: 'oh' },
    { letter: 'P', name: 'Pi',      word: 'padre',    meaning: 'father',         sound: 'pee' },
    { letter: 'Q', name: 'Cu',      word: 'quando',   meaning: 'when',           sound: 'koo' },
    { letter: 'R', name: 'Erre',    word: 'Roma',     meaning: 'Rome',           sound: 'ER-reh' },
    { letter: 'S', name: 'Esse',    word: 'sole',     meaning: 'sun',            sound: 'ES-seh' },
    { letter: 'T', name: 'Ti',      word: 'tempo',    meaning: 'time / weather', sound: 'tee' },
    { letter: 'U', name: 'U',       word: 'uomo',     meaning: 'man',            sound: 'oo' },
    { letter: 'V', name: 'Vi / Vu', word: 'vino',     meaning: 'wine',           sound: 'vee' },
    { letter: 'Z', name: 'Zeta',    word: 'zero',     meaning: 'zero',           sound: 'DZEH-tah' },
];

let alphabetInited = false;

function initAlphabet() {
    if (alphabetInited) return;
    alphabetInited = true;

    const grid = document.getElementById('alphabetGrid');

    ITALIAN_ALPHABET.forEach((item, i) => {
        const card = document.createElement('button');
        card.className   = 'alphabet-card';
        card.textContent = item.letter;
        card.addEventListener('click', () => selectLetter(i, card));
        grid.appendChild(card);
    });
}

function selectLetter(index, cardEl) {
    document.querySelectorAll('.alphabet-card').forEach(c => c.classList.remove('active'));
    cardEl.classList.add('active');

    const item = ITALIAN_ALPHABET[index];

    document.getElementById('alphabetExLetter').textContent  = item.letter;
    document.getElementById('alphabetExName').textContent    = item.name + ' — /' + item.sound + '/';
    document.getElementById('alphabetExWord').textContent    = item.word;
    document.getElementById('alphabetExMeaning').textContent = item.meaning;
    document.getElementById('alphabetExample').classList.remove('hidden');

    parlo.speakItalian(item.name + '. ' + item.word);
}
