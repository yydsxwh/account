import {
  formatKkNumber,
  isKkLoginId,
  nextKkNumber,
  parseKkNumber,
} from "./kk-number.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(parseKkNumber("100") === 100, "start");
assert(parseKkNumber("099") === null, "too small");
assert(parseKkNumber("12") === null, "2 digits");
assert(parseKkNumber("yydsboss01") === null, "username");
assert(isKkLoginId("1000") === true, "4 digits");
assert(formatKkNumber(100) === "100", "format");
assert(nextKkNumber(null) === 100, "empty");
assert(nextKkNumber(999) === 1000, "grow to 4");
assert(nextKkNumber(9999) === 10000, "grow to 5");
console.log("kk-number ok");
