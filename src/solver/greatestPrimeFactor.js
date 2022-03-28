// Find Largest Prime Factor

export function factor(num) {
  for (let div = 2; div <= Math.sqrt(num); div++) {
    if (num % div != 0) {
      continue;
    }
    num = num / div;
    div = 1;
  }
  return num;
}