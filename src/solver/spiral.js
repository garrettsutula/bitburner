// Spiralize Matrix

export function spiral(arr, accum = []) {
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(arr.shift());
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(column(arr, arr[0].length - 1));
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(arr.pop().reverse());
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  accum = accum.concat(column(arr, 0).reverse());
  if (arr.length === 0 || arr[0].length === 0) {
    return accum;
  }
  return spiral(arr, accum);
}

function column(arr, index) {
  const res = [];
  for (let i = 0; i < arr.length; i++) {
    const elm = arr[i].splice(index, 1)[0];
    if (elm) {
      res.push(elm);
    }
  }
  return res;
}