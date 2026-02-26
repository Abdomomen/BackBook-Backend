// Basic profanity filter for English and Arabic
const badWordsEn = [
  "badword1",
  "badword2", // placeholders, in a real app use a library
  "shit",
  "fuck",
  "bitch",
  "asshole",
  "damn",
];

const badWordsAr = [
  "كلب",
  "حمار",
  "يا واطي", // placeholders for offensive words
  // Add more specific offensive words here
];

const allBadWords = [...badWordsEn, ...badWordsAr];

/**
 * Checks if a string contains profanity.
 * @param {string} text
 * @returns {boolean}
 */
const containsProfanity = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return allBadWords.some((word) => lowerText.includes(word));
};

module.exports = { containsProfanity };
