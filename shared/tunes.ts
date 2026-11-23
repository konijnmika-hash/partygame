// Public-domain melodies (traditional / pre-1900 classical) for Guess the Sound.
// Each note is [midi, beats]; 60 = middle C. Melodies are short opening phrases.
export interface Tune { title: string; bpm: number; notes: [number, number][] }

const n = (s: string): [number, number][] =>
  s.split(' ').map((tok) => {
    const [p, d] = tok.split(':');
    return [Number(p), Number(d ?? 1)];
  });

export const TUNES: Tune[] = [
  { title: 'Twinkle Twinkle Little Star', bpm: 110, notes: n('60 60 67 67 69 69 67:2 65 65 64 64 62 62 60:2') },
  { title: 'Ode to Joy', bpm: 120, notes: n('64 64 65 67 67 65 64 62 60 60 62 64 64:1.5 62:0.5 62:2') },
  { title: 'Mary Had a Little Lamb', bpm: 120, notes: n('64 62 60 62 64 64 64:2 62 62 62:2 64 67 67:2') },
  { title: 'Jingle Bells', bpm: 140, notes: n('64 64 64:2 64 64 64:2 64 67 60:1.5 62:0.5 64:4') },
  { title: 'Frère Jacques', bpm: 120, notes: n('60 62 64 60 60 62 64 60 64 65 67:2 64 65 67:2') },
  { title: 'London Bridge', bpm: 120, notes: n('67:1.5 69:0.5 67 65 64 65 67:2 62 64 65:2 64 65 67:2') },
  { title: 'Row, Row, Row Your Boat', bpm: 110, notes: n('60:1.5 60:1.5 60 62:0.5 64:1.5 64 62:0.5 64 65:0.5 67:3') },
  { title: 'Happy Birthday', bpm: 110, notes: n('67:0.75 67:0.25 69 67 72 71:2 67:0.75 67:0.25 69 67 74 72:2') },
  { title: 'Old MacDonald Had a Farm', bpm: 130, notes: n('67 67 67 62 64 64 62:2 71 71 69 69 67:2') },
  { title: 'Yankee Doodle', bpm: 140, notes: n('60 60 62 64 60 64 62:2 60 60 62 64 60:2 59:2') },
  { title: 'When the Saints Go Marching In', bpm: 140, notes: n('60 64 65 67:4 60 64 65 67:4 60 64 65 67:2 64:2 60:2 64:2 62:3') },
  { title: 'Für Elise', bpm: 130, notes: n('76:0.5 75:0.5 76:0.5 75:0.5 76:0.5 71:0.5 74:0.5 72:0.5 69:1.5 60:0.5 64:0.5 69:0.5 71:1.5') },
  { title: 'Brahms’ Lullaby', bpm: 100, notes: n('64:0.5 64:0.5 67:2 64:0.5 64:0.5 67:2 64:0.5 67:0.5 72 71:1.5 69:0.5 69 67') },
  { title: 'Can-Can', bpm: 150, notes: n('60:2 62 65 64 62 67 67 67:2 69 64 65 62 62 62:2') },
  { title: 'In the Hall of the Mountain King', bpm: 120, notes: n('62:0.5 64:0.5 65:0.5 67:0.5 69:0.5 65:0.5 69 68:0.5 64:0.5 68 67:0.5 63:0.5 67') },
  { title: 'Oh! Susanna', bpm: 130, notes: n('60:0.5 62:0.5 64 67 67:1.5 69:0.5 67 64 60:1.5 62:0.5 64 64 62 60 62:3') },
  { title: 'Amazing Grace', bpm: 90, notes: n('62 67:2 71:0.5 67:0.5 71:2 69 67:2 64 62:2') },
  { title: 'Itsy Bitsy Spider', bpm: 130, notes: n('67 72 72 72 74 76:1.5 76:0.5 76 74 72 74 76 72:2') },
  { title: 'Greensleeves', bpm: 110, notes: n('69 72:2 74 76:1.5 77:0.5 76 74:2 71 67:1.5 69:0.5 71 72:2 69') },
  { title: 'Bridal Chorus (Here Comes the Bride)', bpm: 100, notes: n('60 65:1.5 65:0.5 65:2 60 67:1.5 64:0.5 65:2') },
];
