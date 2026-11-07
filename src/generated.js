export function parseQuiz(text) {
  const blocks = String(text || "").split(/\n---\n|\nQ:/i).map((part, index) => (index === 0 ? part : `Q: ${part}`));
  const quizzes = [];
  for (const block of blocks) {
    const prompt = line(block, "Q");
    const choices = ["A", "B", "C", "D"].map((letter) => line(block, letter)).filter(Boolean);
    const answerLetter = (line(block, "Answer") || "").trim().toUpperCase()[0];
    const answer = "ABCD".indexOf(answerLetter);
    const explain = line(block, "Why");
    if (!prompt || choices.length < 2 || answer < 0) continue;
    quizzes.push({ prompt, choices: choices.slice(0, 4), answer, explain });
  }
  return quizzes;
}

export function parseCards(text) {
  const blocks = String(text || "").split(/\n---\n/);
  const cards = [];
  for (const block of blocks) {
    const front = line(block, "Front");
    const back = line(block, "Back");
    if (front && back) cards.push({ front, back });
  }
  return cards;
}

function line(block, label) {
  const match = block.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : "";
}