/* Horoscope seed-hash engine — ported from original data.js */

const HOROSCOPE_POOLS = {
  Aries: ["New career opportunities may emerge today. Stay focused and act with confidence when taking key decisions.", "Your energy levels are high. Financial discussions hold promise if you maintain patience and clarity.", "A favorable day for teamwork and leadership. Avoid hasty arguments and keep your communication calm.", "Positive news regarding a long-pending project could bring peace of mind today.", "Focus on personal health and routine today. A thoughtful approach in personal relationships will bring harmony."],
  Taurus: ["Be prudent with financial expenditures today, but expect pleasant news from close relatives by evening.", "A steady, practical approach will help resolve work challenges easily. Trust your inner wisdom.", "Relationships demand gentle understanding today. A quiet evening helps restore mental clarity.", "Good day for investments and long-term planning. Unexpected support from seniors may boost your morale.", "Prioritize wellness and rest. Expressing your feelings openly will strengthen family bonds."],
  Gemini: ["Communication and intellectual pursuits work in your favor today. A new acquaintance could prove beneficial.", "Flexibility will be your key strength today. Express your creative ideas clearly in discussions.", "Focus on finishing active tasks before embarking on new ones. Financial transactions look stable.", "Your social circle brings encouragement today. Helpful advice from a mentor guides your next steps.", "Maintain balance between work and family life. Clear dialogue avoids minor misunderstandings."],
  Cancer: ["Pay attention to home and family matters. Emotional balance helps you make sound personal decisions.", "Intuition is strong today. Rely on your inner feelings when managing sensitive workplace situations.", "Financial stability is highlighted. A peaceful home environment inspires fresh motivation.", "Good day for reflective activities and spiritual peace. Caring actions win appreciation from loved ones.", "Take time to recharge. Warm conversations with family members build confidence and happiness."],
  Leo: ["Leadership opportunities appear naturally today. Your enthusiasm and warmth inspire those around you.", "Courage and determination open new doors. Keep financial goals realistic and structured.", "Recognition for recent efforts is likely. Stay humble and continue working diligently.", "Favorable day for networking and creative expression. A family member brings heartwarming news.", "Focus on long-term growth. Your charismatic energy makes group interactions highly productive."],
  Virgo: ["Focus on details and organization. Analytical thinking solves a tricky work problem efficiently.", "Health and wellness demand attention today. Balanced nutrition and rest maintain your vitality.", "A practical mindset keeps finances on track. Helpful advice from a colleague brings clarity.", "Organizing your schedule brings peace of mind. Small steps lead to significant progress today.", "Express gratitude to supporters. Thoughtful analysis helps navigate complex choices smoothly."],
  Libra: ["Balance and harmony guide your day. Relationships flourish when mutual respect is prioritized.", "Artistic and aesthetic interests bring joy today. Important partnerships move in a positive direction.", "Diplomacy helps resolve past misunderstandings effortlessly. Financial prospects look steady.", "A favorable time for social gatherings and constructive dialogues. Trust your sense of fairness.", "Seek inner poise amidst busy routines. A collaborative approach guarantees success at work."],
  Scorpio: ["Focus and determination bring breakthrough solutions. Keep strategy discreet until plans materialize.", "Financial insights emerge through careful review. Deep research pays off in ongoing tasks.", "Transformation and growth define today. Let go of unnecessary worries and embrace positive change.", "Intuitive wisdom helps navigate complex interactions. Trust your instincts in career matters.", "Dedication to goals earns respect. Emotional clarity fosters deeper bonds with trusted companions."],
  Sagittarius: ["Optimism and expansive thinking bring favorable outcomes. Good day for higher learning or travel planning.", "Sharing ideas with friends creates exciting prospects. Stay open to fresh perspectives.", "Financial matters show steady improvement. A positive outlook overcomes temporary hurdles.", "Your generous nature brings warmth to social circles. Spiritual reflections offer deep peace.", "Adventure and growth call today. Embrace opportunities to broaden your horizons with confidence."],
  Capricorn: ["Diligence and hard work bear fruit today. Professional guidance from elders supports your ambitions.", "Focus on structured execution. Financial discipline now lays a solid foundation for the future.", "Patience and persistence overcome obstacles effortlessly. Career advancements look promising.", "Take pride in your achievements while staying grounded. A responsible step yields long-term rewards.", "Organized planning keeps stress at bay. Warm interactions with mentors bring valuable guidance."],
  Aquarius: ["Innovative ideas and original thinking shine today. Collaboration with like-minded peers brings success.", "Social connections bring unexpected opportunities. Keep an open mind toward modern solutions.", "A great day for humanitarian or community projects. Your vision inspires surrounding colleagues.", "Financial clarity improves with careful planning. Intellectual discussions spark fresh motivation.", "Embrace your unique perspective. Intellectual freedom and creative pursuits yield high satisfaction."],
  Pisces: ["Spiritual reflection and creative imagination are heightened today. Listen closely to your intuition.", "Empathy and kindness strengthen personal relationships. Artistic endeavors bring deep fulfillment.", "A peaceful mindset helps overcome daily stresses. Financial decisions require calm evaluation.", "Good day for meditation and inner reflection. Compassionate support from loved ones comforts you.", "Trust the natural flow of events. Your gentle nature spreads tranquility everywhere today."],
};

const COLORS = ['Red', 'Gold', 'Green', 'Blue', 'Yellow', 'White', 'Purple', 'Maroon', 'Pink', 'Sky Blue', 'Saffron', 'Emerald'];
const MOODS = ['Energetic', 'Steady', 'Curious', 'Warm', 'Confident', 'Analytical', 'Calm', 'Intense', 'Hopeful', 'Dedicated', 'Innovative', 'Insightful'];

function seedHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const SIGNS = [
  { key: 'aries', n: 'Aries', bn: 'Mesh', dates: 'Mar 21 – Apr 19', glyph: '♈' },
  { key: 'taurus', n: 'Taurus', bn: 'Vrishabh', dates: 'Apr 20 – May 20', glyph: '♉' },
  { key: 'gemini', n: 'Gemini', bn: 'Mithun', dates: 'May 21 – Jun 20', glyph: '♊' },
  { key: 'cancer', n: 'Cancer', bn: 'Kark', dates: 'Jun 21 – Jul 22', glyph: '♋' },
  { key: 'leo', n: 'Leo', bn: 'Singh', dates: 'Jul 23 – Aug 22', glyph: '♌' },
  { key: 'virgo', n: 'Virgo', bn: 'Kanya', dates: 'Aug 23 – Sep 22', glyph: '♍' },
  { key: 'libra', n: 'Libra', bn: 'Tula', dates: 'Sep 23 – Oct 22', glyph: '♎' },
  { key: 'scorpio', n: 'Scorpio', bn: 'Vrishchik', dates: 'Oct 23 – Nov 21', glyph: '♏' },
  { key: 'sagittarius', n: 'Sagittarius', bn: 'Dhanu', dates: 'Nov 22 – Dec 21', glyph: '♐' },
  { key: 'capricorn', n: 'Capricorn', bn: 'Makar', dates: 'Dec 22 – Jan 19', glyph: '♑' },
  { key: 'aquarius', n: 'Aquarius', bn: 'Kumbh', dates: 'Jan 20 – Feb 18', glyph: '♒' },
  { key: 'pisces', n: 'Pisces', bn: 'Meen', dates: 'Feb 19 – Mar 20', glyph: '♓' },
];

export function getReading(signKey, range = 'today') {
  const dayOffsets = { today: 0, tomorrow: 1, week: 7, month: 30 };
  const targetDate = new Date();
  targetDate.setHours(12, 0, 0, 0);
  targetDate.setDate(targetDate.getDate() + (dayOffsets[range] || 0));

  const dateStr = [targetDate.getFullYear(), String(targetDate.getMonth() + 1).padStart(2, '0'), String(targetDate.getDate()).padStart(2, '0')].join('-');
  const dateFormatted = targetDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const signName = signKey.charAt(0).toUpperCase() + signKey.slice(1);
  const idx = SIGNS.findIndex(s => s.key === signKey);

  const seedKey = `${dateStr}-${signName}`;
  const hashVal = seedHash(seedKey);
  const pool = HOROSCOPE_POOLS[signName] || HOROSCOPE_POOLS.Aries;

  const text = pool[hashVal % pool.length];
  const color = COLORS[(hashVal + idx) % COLORS.length];
  const number = ((hashVal % 9) + 1).toString();
  const mood = MOODS[(hashVal + idx * 2) % MOODS.length];

  const seed2 = Math.abs(seedHash(`${dateStr}-${signKey}-${range}`));
  return {
    text, color, number, mood, dateFormatted, dateStr,
    love:   35 + (seed2 % 61),
    career: 35 + (Math.floor(seed2 / 8) % 61),
    health: 35 + (Math.floor(seed2 / 64) % 61),
    money:  35 + (Math.floor(seed2 / 512) % 61),
  };
}
