const FUNCTIONS = { sqrt: Math.sqrt };

export function evaluateExpression(source) {
  const text = String(source || "").trim();
  if (!text) throw new Error("Enter a calculation.");
  if (text.length > 200) throw new Error("That calculation is too long.");
  let i = 0;
  const peek = () => text[i];
  const eat = (ch) => {
    if (text[i] !== ch) throw new Error("Could not read that calculation.");
    i += 1;
  };
  const skip = () => { while (text[i] === " ") i += 1; };

  function parseNumber() {
    skip();
    const start = i;
    if (text[i] === ".") i += 1;
    while (text[i] >= "0" && text[i] <= "9") i += 1;
    if (text[i] === ".") {
      i += 1;
      while (text[i] >= "0" && text[i] <= "9") i += 1;
    }
    if (i === start || text.slice(start, i) === ".") throw new Error("Could not read that calculation.");
    return Number(text.slice(start, i));
  }

  function parseFactor() {
    skip();
    if (peek() === "+") { i += 1; return parseFactor(); }
    if (peek() === "-") { i += 1; return -parseFactor(); }
    if (peek() === "(") {
      i += 1;
      const value = parseExpression();
      skip();
      eat(")");
      return value;
    }
    const nameStart = i;
    while (/[a-z]/i.test(text[i] || "")) i += 1;
    if (i > nameStart) {
      const name = text.slice(nameStart, i).toLowerCase();
      const fn = FUNCTIONS[name];
      if (!fn) throw new Error("Only numbers and sqrt() are allowed.");
      skip();
      eat("(");
      const inner = parseExpression();
      skip();
      eat(")");
      const value = fn(inner);
      if (!Number.isFinite(value)) throw new Error("That calculation is not a finite number.");
      return value;
    }
    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();
    for (;;) {
      skip();
      if (peek() === "*" || peek() === "/") {
        const op = peek();
        i += 1;
        const right = parseFactor();
        value = op === "*" ? value * right : value / right;
      } else if (peek() === "%") {
        i += 1;
        value /= 100;
      } else break;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    for (;;) {
      skip();
      if (peek() === "+" || peek() === "-") {
        const op = peek();
        i += 1;
        const right = parseTerm();
        value = op === "+" ? value + right : value - right;
      } else break;
    }
    return value;
  }

  const value = parseExpression();
  skip();
  if (i !== text.length) throw new Error("Could not read that calculation.");
  if (!Number.isFinite(value)) throw new Error("That calculation is not a finite number.");
  return value;
}
